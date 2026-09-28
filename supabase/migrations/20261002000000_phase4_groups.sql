-- Phase 4: shared groups, split expenses, settlements.
-- Access rule everywhere: you can see and change a group's data only while you're a member.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  emoji text not null default '👥',
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  -- Secret part of the invite link (/join/<code>).
  invite_code text not null unique default translate(encode(extensions.gen_random_bytes(9), 'base64'), '+/', '-_'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- A member is an account (user_id) or just a name for a friend without the app (user_id null),
-- who can claim that spot later through the invite link.
create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  display_name text not null check (char_length(display_name) between 1 and 60),
  role text not null default 'member' check (role in ('owner', 'member')),
  upi_id text check (char_length(upi_id) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, group_id)
);

create unique index group_members_one_per_user
  on public.group_members (group_id, user_id) where user_id is not null and deleted_at is null;
create index group_members_user_idx on public.group_members (user_id) where deleted_at is null;

create table public.group_expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  paid_by_member_id uuid not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  description text not null check (char_length(description) between 1 and 200),
  spent_on date not null default current_date,
  split_mode text not null default 'equal' check (split_mode in ('equal', 'exact', 'percent', 'shares')),
  -- [{ "member_id": uuid, "share_minor": int, "weight": number? }], validated by trigger below.
  -- Kept in the row so an edit is atomic (no half-updated splits when two people edit).
  splits jsonb not null,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (paid_by_member_id, group_id) references public.group_members (id, group_id)
);

create index group_expenses_group_updated_idx on public.group_expenses (group_id, updated_at);

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  from_member_id uuid not null,
  to_member_id uuid not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  spent_on date not null default current_date,
  note text check (char_length(note) <= 200),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (from_member_id <> to_member_id),
  foreign key (from_member_id, group_id) references public.group_members (id, group_id),
  foreign key (to_member_id, group_id) references public.group_members (id, group_id)
);

create index settlements_group_updated_idx on public.settlements (group_id, updated_at);

-- Your share of a group expense is mirrored as a personal expense (created by your app).
alter table public.expenses add column group_expense_id uuid;
alter table public.profiles add column notify_groups boolean not null default true;

create trigger groups_set_updated_at before update on public.groups
  for each row execute function public.set_updated_at();
create trigger group_members_set_updated_at before update on public.group_members
  for each row execute function public.set_updated_at();
create trigger group_expenses_set_updated_at before update on public.group_expenses
  for each row execute function public.set_updated_at();
create trigger settlements_set_updated_at before update on public.settlements
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Integrity
-- ---------------------------------------------------------------------------

-- Splits must be members of the same group, non-negative, and add up to the amount.
create or replace function public.validate_group_expense()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  total bigint;
  bad integer;
begin
  if jsonb_typeof(new.splits) <> 'array' or jsonb_array_length(new.splits) = 0 then
    raise exception 'splits must be a non-empty array';
  end if;
  select coalesce(sum((s ->> 'share_minor')::bigint), 0) into total from jsonb_array_elements(new.splits) s;
  if total <> new.amount_minor then
    raise exception 'splits (%) must add up to the amount (%)', total, new.amount_minor;
  end if;
  select count(*) into bad
  from jsonb_array_elements(new.splits) s
  where (s ->> 'share_minor')::bigint < 0
     or not exists (
       select 1 from public.group_members m
       where m.id = (s ->> 'member_id')::uuid and m.group_id = new.group_id
     );
  if bad > 0 then
    raise exception 'every split must be a member of this group';
  end if;
  return new;
end;
$$;

create trigger group_expenses_validate before insert or update on public.group_expenses
  for each row execute function public.validate_group_expense();

-- A member row's account can only be set by the join_group function (claiming a spot).
create or replace function public.protect_member_account()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id and coalesce(current_setting('app.claiming', true), '') <> 'on' then
    raise exception 'members can only be claimed through an invite link';
  end if;
  return new;
end;
$$;

create trigger group_members_protect_account before update on public.group_members
  for each row execute function public.protect_member_account();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

create or replace function public.is_group_member(target_group uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = target_group and m.user_id = (select auth.uid()) and m.deleted_at is null
  );
$$;

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_expenses enable row level security;
alter table public.settlements enable row level security;

create policy "Members see their groups" on public.groups for select to authenticated
  using (public.is_group_member(id));
create policy "Members update their groups" on public.groups for update to authenticated
  using (public.is_group_member(id)) with check (public.is_group_member(id));

create policy "Members see group members" on public.group_members for select to authenticated
  using (public.is_group_member(group_id));
-- Members can add friends by name (no account); accounts join only via join_group().
create policy "Members add named members" on public.group_members for insert to authenticated
  with check (public.is_group_member(group_id) and user_id is null and role = 'member');
create policy "Members edit group members" on public.group_members for update to authenticated
  using (public.is_group_member(group_id)) with check (public.is_group_member(group_id));

create policy "Members manage group expenses" on public.group_expenses for all to authenticated
  using (public.is_group_member(group_id)) with check (public.is_group_member(group_id));

create policy "Members manage settlements" on public.settlements for all to authenticated
  using (public.is_group_member(group_id)) with check (public.is_group_member(group_id));

-- ---------------------------------------------------------------------------
-- Functions: create, preview (from an invite), join, leave
-- ---------------------------------------------------------------------------

create or replace function public.create_group(
  p_name text, p_emoji text, p_currency text, p_display_name text, p_member_names text[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_group uuid;
  member_name text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into public.groups (name, emoji, currency, created_by)
  values (btrim(p_name), coalesce(nullif(p_emoji, ''), '👥'), p_currency, auth.uid())
  returning id into new_group;
  insert into public.group_members (group_id, user_id, display_name, role)
  values (new_group, auth.uid(), coalesce(nullif(btrim(p_display_name), ''), 'Me'), 'owner');
  foreach member_name in array coalesce(p_member_names, '{}') loop
    if btrim(member_name) <> '' then
      insert into public.group_members (group_id, display_name) values (new_group, left(btrim(member_name), 60));
    end if;
  end loop;
  return new_group;
end;
$$;

-- What the invite page shows before joining. Knowing the code is the permission.
create or replace function public.group_preview(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', g.id,
    'name', g.name,
    'emoji', g.emoji,
    'already_member', exists (
      select 1 from public.group_members m
      where m.group_id = g.id and m.user_id = auth.uid() and m.deleted_at is null
    ),
    'members', (
      select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'name', m.display_name, 'claimed', m.user_id is not null)
                                order by m.created_at), '[]'::jsonb)
      from public.group_members m
      where m.group_id = g.id and m.deleted_at is null
    )
  )
  from public.groups g
  where g.invite_code = p_code and g.deleted_at is null;
$$;

-- Join as a new member, or claim a named spot (p_member_id) that a friend added for you.
create or replace function public.join_group(p_code text, p_member_id uuid default null, p_display_name text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select id into target from public.groups where invite_code = p_code and deleted_at is null;
  if target is null then raise exception 'This invite link is invalid or the group was deleted'; end if;
  if exists (select 1 from public.group_members where group_id = target and user_id = auth.uid() and deleted_at is null) then
    return target;
  end if;

  if p_member_id is not null then
    perform set_config('app.claiming', 'on', true);
    update public.group_members set user_id = auth.uid()
    where id = p_member_id and group_id = target and user_id is null and deleted_at is null;
    if not found then raise exception 'That spot has already been taken'; end if;
  else
    insert into public.group_members (group_id, user_id, display_name)
    values (target, auth.uid(), coalesce(nullif(btrim(p_display_name), ''), 'Member'));
  end if;
  return target;
end;
$$;

-- Leaving keeps your past expenses and balances in the group (under your name).
create or replace function public.leave_group(p_group uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.group_members set deleted_at = now()
  where group_id = p_group and user_id = auth.uid() and deleted_at is null;
end;
$$;

revoke execute on function public.create_group(text, text, text, text, text[]) from public, anon;
revoke execute on function public.group_preview(text) from public, anon;
revoke execute on function public.join_group(text, uuid, text) from public, anon;
revoke execute on function public.leave_group(uuid) from public, anon;
grant execute on function public.create_group(text, text, text, text, text[]) to authenticated;
grant execute on function public.group_preview(text) to authenticated;
grant execute on function public.join_group(text, uuid, text) to authenticated;
grant execute on function public.leave_group(uuid) to authenticated;
