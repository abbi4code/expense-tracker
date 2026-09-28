-- Phase 2: budgets, recurring expenses, income, tags.

-- ---------------------------------------------------------------------------
-- Income: categories and entries get a kind
-- ---------------------------------------------------------------------------

alter table public.categories
  add column kind text not null default 'expense' check (kind in ('expense', 'income'));

alter table public.expenses
  add column kind text not null default 'expense' check (kind in ('expense', 'income')),
  add column tags text[] not null default '{}' check (cardinality(tags) <= 20),
  add column recurring_rule_id uuid;

create index expenses_tags_idx on public.expenses using gin (tags);

alter table public.profiles add column track_income boolean not null default false;

-- Income categories for existing users (new users get them from handle_new_user below).
insert into public.categories (user_id, name, emoji, color, sort_order, kind)
select p.id, c.name, c.emoji, c.color, c.sort_order, 'income'
from public.profiles p
cross join (values ('Salary', '💼', 'emerald', 100), ('Freelance', '🧑‍💻', 'sky', 101), ('Other income', '💰', 'lime', 102))
  as c(name, emoji, color, sort_order);

-- ---------------------------------------------------------------------------
-- Budgets: one overall (category_id null) + optional per category, per month
-- ---------------------------------------------------------------------------

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id uuid,
  amount_minor bigint not null check (amount_minor > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (category_id, user_id) references public.categories (id, user_id)
);

create index budgets_user_updated_idx on public.budgets (user_id, updated_at);

create trigger budgets_set_updated_at
  before update on public.budgets
  for each row execute function public.set_updated_at();

alter table public.budgets enable row level security;

create policy "Users manage their own budgets"
  on public.budgets for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Recurring rules: rent, subscriptions, EMIs, salary…
-- Occurrences are created by the app (deterministic ids, so devices never duplicate them).
-- ---------------------------------------------------------------------------

create table public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null default 'expense' check (kind in ('expense', 'income')),
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  category_id uuid not null,
  payment_method_id uuid,
  note text check (char_length(note) <= 500),
  tags text[] not null default '{}',
  frequency text not null check (frequency in ('weekly', 'monthly', 'yearly')),
  interval smallint not null default 1 check (interval between 1 and 12),
  anchor_date date not null,       -- first occurrence; later ones are counted from it
  next_due_on date not null,       -- next occurrence not yet added
  mode text not null default 'auto' check (mode in ('auto', 'ask')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id),
  foreign key (category_id, user_id) references public.categories (id, user_id),
  foreign key (payment_method_id, user_id) references public.payment_methods (id, user_id)
);

create index recurring_rules_user_updated_idx on public.recurring_rules (user_id, updated_at);

create trigger recurring_rules_set_updated_at
  before update on public.recurring_rules
  for each row execute function public.set_updated_at();

alter table public.recurring_rules enable row level security;

create policy "Users manage their own recurring rules"
  on public.recurring_rules for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Expenses created from a rule point back at it (same user only).
alter table public.expenses
  add foreign key (recurring_rule_id, user_id) references public.recurring_rules (id, user_id);

-- ---------------------------------------------------------------------------
-- New users also get income categories
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

  insert into public.categories (user_id, name, emoji, color, sort_order, kind)
  values
    (new.id, 'Food & Drinks',     '🍔', 'orange',  0, 'expense'),
    (new.id, 'Groceries',         '🛒', 'lime',    1, 'expense'),
    (new.id, 'Transport',         '🚕', 'sky',     2, 'expense'),
    (new.id, 'Shopping',          '🛍️', 'pink',    3, 'expense'),
    (new.id, 'Bills & Utilities', '💡', 'amber',   4, 'expense'),
    (new.id, 'Rent',              '🏠', 'violet',  5, 'expense'),
    (new.id, 'Health',            '💊', 'emerald', 6, 'expense'),
    (new.id, 'Entertainment',     '🎬', 'fuchsia', 7, 'expense'),
    (new.id, 'Travel',            '✈️', 'cyan',    8, 'expense'),
    (new.id, 'Education',         '📚', 'indigo',  9, 'expense'),
    (new.id, 'Personal Care',     '💅', 'rose',   10, 'expense'),
    (new.id, 'Gifts',             '🎁', 'red',    11, 'expense'),
    (new.id, 'Other',             '📦', 'slate',  12, 'expense'),
    (new.id, 'Salary',            '💼', 'emerald', 100, 'income'),
    (new.id, 'Freelance',         '🧑‍💻', 'sky',   101, 'income'),
    (new.id, 'Other income',      '💰', 'lime',   102, 'income');

  insert into public.payment_methods (user_id, name, icon, sort_order)
  values
    (new.id, 'Cash',          'banknote',    0),
    (new.id, 'Card',          'credit-card', 1),
    (new.id, 'UPI / Online',  'smartphone',  2);

  return new;
end;
$$;
