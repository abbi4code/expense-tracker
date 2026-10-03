-- Group permissions: RLS lets any member update member and group rows, so these triggers decide
-- what a member may change. Your own UPI ID and name are yours; only the owner removes others or
-- deletes the group; roles, invite codes and currencies are fixed. Group data is never hard-deleted
-- by clients (a hard delete wouldn't reach other members' devices).

create or replace function public.is_group_owner(target_group uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = target_group and m.user_id = (select auth.uid()) and m.role = 'owner' and m.deleted_at is null
  );
$$;

revoke execute on function public.is_group_owner(uuid) from public, anon;
grant execute on function public.is_group_owner(uuid) to authenticated;

create or replace function public.protect_member_account()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Account deletion sets user_id to null through the FK (a nested trigger); server code has no
  -- auth.uid(). Neither is a member acting on the group.
  if pg_trigger_depth() > 1 or auth.uid() is null then
    return new;
  end if;
  if new.user_id is distinct from old.user_id and coalesce(current_setting('app.claiming', true), '') <> 'on' then
    raise exception 'members can only be claimed through an invite link';
  end if;
  if new.group_id is distinct from old.group_id or new.role is distinct from old.role then
    raise exception 'a member''s group and role can''t be changed';
  end if;
  if new.upi_id is distinct from old.upi_id and old.user_id is distinct from auth.uid() then
    raise exception 'only you can change your UPI ID';
  end if;
  -- Names of friends added by name (no account yet) can be fixed by anyone in the group.
  if new.display_name is distinct from old.display_name and old.user_id is distinct from auth.uid()
     and old.user_id is not null then
    raise exception 'only they can change their name';
  end if;
  if new.deleted_at is distinct from old.deleted_at and old.user_id is distinct from auth.uid()
     and not public.is_group_owner(old.group_id) then
    raise exception 'only the group owner can remove members';
  end if;
  return new;
end;
$$;

create or replace function public.protect_group()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- created_by is set to null by the FK when that account is deleted (a nested trigger).
  if pg_trigger_depth() > 1 or auth.uid() is null then
    return new;
  end if;
  if new.invite_code is distinct from old.invite_code
     or new.created_by is distinct from old.created_by
     or new.currency is distinct from old.currency then
    raise exception 'a group''s invite link, creator and currency can''t be changed';
  end if;
  if new.deleted_at is distinct from old.deleted_at and not public.is_group_owner(old.id) then
    raise exception 'only the group owner can delete the group';
  end if;
  return new;
end;
$$;

create trigger groups_protect before update on public.groups
  for each row execute function public.protect_group();

-- Soft deletes only: replace "for all" (which included DELETE) with select/insert/update.
drop policy "Members manage group expenses" on public.group_expenses;
create policy "Members see group expenses" on public.group_expenses for select to authenticated
  using (public.is_group_member(group_id));
create policy "Members add group expenses" on public.group_expenses for insert to authenticated
  with check (public.is_group_member(group_id));
create policy "Members edit group expenses" on public.group_expenses for update to authenticated
  using (public.is_group_member(group_id)) with check (public.is_group_member(group_id));

drop policy "Members manage settlements" on public.settlements;
create policy "Members see settlements" on public.settlements for select to authenticated
  using (public.is_group_member(group_id));
create policy "Members add settlements" on public.settlements for insert to authenticated
  with check (public.is_group_member(group_id));
create policy "Members edit settlements" on public.settlements for update to authenticated
  using (public.is_group_member(group_id)) with check (public.is_group_member(group_id));
