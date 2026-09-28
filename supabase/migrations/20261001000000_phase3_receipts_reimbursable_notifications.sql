-- Phase 3: reimbursable expenses, receipts, push notifications.

-- ---------------------------------------------------------------------------
-- Expenses: reimbursable + receipt photo
-- ---------------------------------------------------------------------------

alter table public.expenses
  add column reimbursable boolean not null default false,
  add column reimbursed_at timestamptz,
  add column receipt_path text check (char_length(receipt_path) <= 300);

-- ---------------------------------------------------------------------------
-- Notification preferences (on the profile) + the device's time zone for scheduling
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column timezone text check (char_length(timezone) <= 64),
  add column notify_daily boolean not null default true,
  add column notify_daily_hour smallint not null default 21 check (notify_daily_hour between 0 and 23),
  add column notify_bills boolean not null default true,
  add column notify_weekly boolean not null default true;

-- ---------------------------------------------------------------------------
-- Web push subscriptions (one per device/browser)
-- ---------------------------------------------------------------------------

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) <= 1000),
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "Users manage their own push subscriptions"
  on public.push_subscriptions for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- What the scheduler already sent, so a reminder goes out once per day/week at most.
-- Server-only (service role): RLS on, no policies.
create table public.notification_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  key text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, kind, key)
);

alter table public.notification_log enable row level security;

-- ---------------------------------------------------------------------------
-- Receipts: private bucket, files live under "<user id>/…"
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Users read their own receipts"
  on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users upload their own receipts"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users update their own receipts"
  on storage.objects for update to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users delete their own receipts"
  on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
