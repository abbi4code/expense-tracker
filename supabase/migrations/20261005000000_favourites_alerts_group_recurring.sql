-- Favourites (one-tap repeat spends), budget and settle-up alert settings, and repeating group
-- expenses (monthly rent split with flatmates).

-- ---------------------------------------------------------------------------
-- Favourites: a pinned spend ("Chai ₹20") logged with one tap from Home
-- ---------------------------------------------------------------------------

create table public.favourites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  category_id uuid not null,
  payment_method_id uuid,
  note text check (char_length(note) <= 500),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (category_id, user_id) references public.categories (id, user_id),
  foreign key (payment_method_id, user_id) references public.payment_methods (id, user_id)
);

create index favourites_user_updated_idx on public.favourites (user_id, updated_at);

create trigger favourites_set_updated_at
  before update on public.favourites
  for each row execute function public.set_updated_at();

alter table public.favourites enable row level security;

create policy "Users manage their own favourites"
  on public.favourites for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Alert settings
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column notify_budgets boolean not null default true,
  add column notify_settle boolean not null default true;

-- ---------------------------------------------------------------------------
-- Repeating group expenses. Occurrences are added by members' apps with ids derived from
-- (rule, date) and "insert if missing", so a month is never added twice and a deleted one stays deleted.
-- ---------------------------------------------------------------------------

create table public.group_recurring_rules (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  paid_by_member_id uuid not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  description text not null check (char_length(description) between 1 and 200),
  split_mode text not null default 'equal' check (split_mode in ('equal', 'exact', 'percent', 'shares')),
  splits jsonb not null,
  frequency text not null default 'monthly' check (frequency in ('weekly', 'monthly', 'yearly')),
  interval smallint not null default 1 check (interval between 1 and 12),
  anchor_date date not null,       -- first occurrence; later ones are counted from it
  next_due_on date not null,       -- next occurrence not yet added
  is_active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, group_id),
  foreign key (paid_by_member_id, group_id) references public.group_members (id, group_id)
);

create index group_recurring_rules_group_updated_idx on public.group_recurring_rules (group_id, updated_at);

create trigger group_recurring_rules_set_updated_at before update on public.group_recurring_rules
  for each row execute function public.set_updated_at();

-- Same rules as a group expense: splits are members of the group and add up to the amount.
create trigger group_recurring_rules_validate before insert or update on public.group_recurring_rules
  for each row execute function public.validate_group_expense();

alter table public.group_recurring_rules enable row level security;

create policy "Members see repeating group expenses" on public.group_recurring_rules for select to authenticated
  using (public.is_group_member(group_id));
create policy "Members add repeating group expenses" on public.group_recurring_rules for insert to authenticated
  with check (public.is_group_member(group_id));
create policy "Members edit repeating group expenses" on public.group_recurring_rules for update to authenticated
  using (public.is_group_member(group_id)) with check (public.is_group_member(group_id));

alter table public.group_expenses add column recurring_rule_id uuid;
alter table public.group_expenses
  add foreign key (recurring_rule_id, group_id) references public.group_recurring_rules (id, group_id);
