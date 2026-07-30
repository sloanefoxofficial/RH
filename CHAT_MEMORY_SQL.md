# Guide memory — one-time Supabase setup

This lets each guide remember a person's past conversations across sessions and devices.
It's stored **per person and strictly private** — only that member can read their own
history (not other users, not even admin).

Run once in Supabase → **SQL Editor → New query → paste → Run** (expect "Success"):

```sql
create table if not exists public.chat_history (
  user_id uuid references auth.users(id) on delete cascade,
  character text not null,
  messages jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, character)
);
alter table public.chat_history enable row level security;

drop policy if exists "own chat all" on public.chat_history;
create policy "own chat all" on public.chat_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

Notes:
- Memory only applies to **signed-in** people (it's tied to their account). In open/no-login mode,
  chats stay in the browser as before.
- A person can wipe their remembered conversations any time with the **"Start over"** button in the app.
- This is sensitive content, so it's intentionally private even from admin.
