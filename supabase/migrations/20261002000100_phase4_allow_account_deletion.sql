-- Deleting an account sets group_members.user_id to null through the foreign key's
-- ON DELETE SET NULL. That runs as a nested (referential) trigger, so allow it there;
-- direct updates from clients (trigger depth 1) still can't change the account.
create or replace function public.protect_member_account()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id
     and coalesce(current_setting('app.claiming', true), '') <> 'on'
     and pg_trigger_depth() <= 1 then
    raise exception 'members can only be claimed through an invite link';
  end if;
  return new;
end;
$$;
