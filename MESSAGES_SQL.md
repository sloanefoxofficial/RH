# Direct messages (members ↔ Juan) — one-time Supabase setup

A private one-to-one channel: each member can message **only Juan** (the coordinator),
and Juan replies from the admin panel. No member can see another member's messages.

Run once in Supabase → **SQL Editor → New query → paste → Run** (expect "Success"):

```sql
create table if not exists public.coordinator_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade, -- whose thread this is
  sender text not null check (sender in ('user','coordinator')),
  body text not null,
  created_at timestamptz not null default now(),
  read_by_user boolean not null default false,
  read_by_coordinator boolean not null default false
);
alter table public.coordinator_messages enable row level security;

-- A member can only see and write in their OWN thread, and only as 'user'.
drop policy if exists "member reads own thread" on public.coordinator_messages;
create policy "member reads own thread" on public.coordinator_messages
  for select using (auth.uid() = user_id);

drop policy if exists "member sends own thread" on public.coordinator_messages;
create policy "member sends own thread" on public.coordinator_messages
  for insert with check (auth.uid() = user_id and sender = 'user');

drop policy if exists "member updates own thread" on public.coordinator_messages;
create policy "member updates own thread" on public.coordinator_messages
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- The coordinator (owner account) can read and reply to every thread.
drop policy if exists "coordinator all" on public.coordinator_messages;
create policy "coordinator all" on public.coordinator_messages
  for all
  using ((auth.jwt() ->> 'email') = 'sloanefox.official@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'sloanefox.official@gmail.com');
```

## How it works

- Members get a **"Message Juan"** card on the hub → a private chat thread with the coordinator.
  It's clearly labelled as a **real person** (not the AI guide), replies aren't instant, and it tells
  them to use crisis support for anything urgent.
- Juan reads and replies from **admin → Member messages** — a simple inbox of every member's thread,
  with unread badges. Only the owner account can see it.
- A red badge appears on the member's "Message Juan" card when Juan has replied.

## Who is "the coordinator"?

Right now the inbox is tied to the **owner account** (`sloanefox.official@gmail.com`) — so whoever
signs in there handles the messages. If **Juan has his own login** and you'd like him to answer from
his own account, tell me his email and I'll add it as a second coordinator (one line in the app + this
policy). Members always just see "Juan" either way.
