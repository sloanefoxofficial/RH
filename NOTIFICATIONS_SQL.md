# Notifications (admin -> all registered members) — one-time Supabase setup

This replaces the old "App updates" changelog with a real notification system: the owner
writes a message in the admin panel, it's sent to every registered member, and each person
sees an unread badge on the bell until they open it.

Run once in Supabase → **SQL Editor → New query → paste → Run** (expect "Success"):

```sql
-- The messages themselves (one row per notification the owner sends)
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;

drop policy if exists "read notifications" on public.notifications;
create policy "read notifications" on public.notifications
  for select using (auth.role() = 'authenticated');

drop policy if exists "owner writes notifications" on public.notifications;
create policy "owner writes notifications" on public.notifications
  for all
  using ((auth.jwt() ->> 'email') = 'sloanefox.official@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'sloanefox.official@gmail.com');

-- Tracks which notifications each person has already seen (for the unread badge)
create table if not exists public.notification_reads (
  user_id uuid references auth.users(id) on delete cascade,
  notification_id uuid references public.notifications(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, notification_id)
);
alter table public.notification_reads enable row level security;

drop policy if exists "own reads all" on public.notification_reads;
create policy "own reads all" on public.notification_reads
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

## How it works

- Admin → shield → **Notify members** → write a title + short message → **Send to everyone**.
  It shows the current member count so you know how many people will see it.
- Every signed-in member gets a **bell icon on the hub** with a red unread count. Opening
  **Notifications** marks everything read.
- This is an **in-app** notification (seen when someone opens the Hub) — not a push alert
  that lands on their phone while the app is closed. That's a bigger separate feature
  (a service worker + a one-time permission prompt from each user) — ask if you'd like it
  built next.

If you had the old `app_updates` table from before, it's no longer used by the app and can
be left as-is or dropped — up to you (`drop table if exists public.app_updates;`).
