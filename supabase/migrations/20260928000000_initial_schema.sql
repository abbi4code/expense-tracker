-- Initial schema: profiles, categories, payment methods, expenses.
-- Money is stored as integer minor units (paise/cents). Every table is protected by RLS.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  currency char(3) check (currency ~ '^[A-Z]{3}$'),          -- set during onboarding
  locale text,
  month_start_day smallint not null default 1 check (month_start_day between 1 and 28),
  week_start smallint not null default 1 check (week_start in (0, 1)), -- 0 = Sunday, 1 = Monday
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ---------------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  emoji text not null default '💸',
  color text not null default 'slate',
  sort_order integer not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)  -- target for composite FK from expenses
);

create index categories_user_idx on public.categories (user_id, sort_order);

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

alter table public.categories enable row level security;

create policy "Users manage their own categories"
  on public.categories for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Payment methods
-- ---------------------------------------------------------------------------

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  icon text not null default 'wallet',
  sort_order integer not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create index payment_methods_user_idx on public.payment_methods (user_id, sort_order);

create trigger payment_methods_set_updated_at
  before update on public.payment_methods
  for each row execute function public.set_updated_at();

alter table public.payment_methods enable row level security;

create policy "Users manage their own payment methods"
  on public.payment_methods for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Expenses
-- ---------------------------------------------------------------------------

create table public.expenses (
  id uuid primary key default gen_random_uuid(), -- usually generated on the client (offline-safe retries)
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  category_id uuid not null,
  payment_method_id uuid,
  note text check (char_length(note) <= 500),
  spent_on date not null default current_date,   -- the user's local calendar date
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,                          -- soft delete: enables undo + offline sync
  -- Composite FKs guarantee an expense can only reference the same user's category/method.
  foreign key (category_id, user_id) references public.categories (id, user_id),
  foreign key (payment_method_id, user_id) references public.payment_methods (id, user_id)
);

create index expenses_user_spent_on_idx on public.expenses (user_id, spent_on desc) where deleted_at is null;
create index expenses_user_category_idx on public.expenses (user_id, category_id) where deleted_at is null;
create index expenses_user_updated_idx on public.expenses (user_id, updated_at); -- incremental sync

create trigger expenses_set_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

alter table public.expenses enable row level security;

create policy "Users manage their own expenses"
  on public.expenses for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- New user bootstrap: profile + default categories + payment methods
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  );

  insert into public.categories (user_id, name, emoji, color, sort_order)
  values
    (new.id, 'Food & Drinks',     '🍔', 'orange',  0),
    (new.id, 'Groceries',         '🛒', 'lime',    1),
    (new.id, 'Transport',         '🚕', 'sky',     2),
    (new.id, 'Shopping',          '🛍️', 'pink',    3),
    (new.id, 'Bills & Utilities', '💡', 'amber',   4),
    (new.id, 'Rent',              '🏠', 'violet',  5),
    (new.id, 'Health',            '💊', 'emerald', 6),
    (new.id, 'Entertainment',     '🎬', 'fuchsia', 7),
    (new.id, 'Travel',            '✈️', 'cyan',    8),
    (new.id, 'Education',         '📚', 'indigo',  9),
    (new.id, 'Personal Care',     '💅', 'rose',   10),
    (new.id, 'Gifts',             '🎁', 'red',    11),
    (new.id, 'Other',             '📦', 'slate',  12);

  insert into public.payment_methods (user_id, name, icon, sort_order)
  values
    (new.id, 'Cash',          'banknote',   0),
    (new.id, 'Card',          'credit-card', 1),
    (new.id, 'UPI / Online',  'smartphone', 2);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
