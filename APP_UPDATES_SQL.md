# App updates ("What's new") — one-time Supabase setup

Lets you post dated update notes from the admin panel that every signed-in member can read.

Run once in Supabase → **SQL Editor → New query → paste → Run** (expect "Success"):

```sql
create table if not exists public.app_updates (
  id uuid primary key default gen_random_uuid(),
  update_date date not null default current_date,
  title text not null,
  body text,
  created_at timestamptz not null default now()
);
alter table public.app_updates enable row level security;

-- anyone signed in can read updates
drop policy if exists "read updates" on public.app_updates;
create policy "read updates" on public.app_updates
  for select using (auth.role() = 'authenticated');

-- only the owner can post / edit / delete updates
drop policy if exists "owner writes updates" on public.app_updates;
create policy "owner writes updates" on public.app_updates
  for all
  using ((auth.jwt() ->> 'email') = 'sloanefox.official@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'sloanefox.official@gmail.com');
```

Then: open the app → shield (Admin) → **App updates** → post one. Members see it under the
**"App updates"** card on their hub.
