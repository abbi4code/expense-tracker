-- Phase 1: offline sync support, add-sheet preferences, account deletion.

-- Soft delete for categories and payment methods, so deletions reach other devices through
-- incremental ("updated since") sync, and old soft-deleted expenses keep a valid FK target.
alter table public.categories add column deleted_at timestamptz;
alter table public.payment_methods add column deleted_at timestamptz;

create index categories_user_updated_idx on public.categories (user_id, updated_at);
create index payment_methods_user_updated_idx on public.payment_methods (user_id, updated_at);

-- Add-sheet preference: show the optional payment method row.
alter table public.profiles add column show_payment_method boolean not null default true;

-- Permanently delete the signed-in user's account and (via cascades) all their data.
create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
