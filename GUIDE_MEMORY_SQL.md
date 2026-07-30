# Guide "about me" memory (Stage 2) — one-time Supabase setup

Stores the small set of durable notes the guides keep about each person, plus their
on/off setting. Strictly private — only that person can read their own row (not other
members, not even admin), matching how the rest of their sensitive data is handled.

**Safety, agreed with Carlos:** crisis / self-harm / abuse content and details of illegal
acts are never written to this memory in the first place (that rule lives in the app's
extraction step), so nothing painful can resurface later. And the person can see, edit,
delete, or switch all of it off from **Profile → What the guides remember**.

Run once in Supabase → **SQL Editor → New query → paste → Run** (expect "Success"):

```sql
create table if not exists public.guide_memory (
  user_id uuid primary key references auth.users(id) on delete cascade,
  memories jsonb not null default '[]'::jsonb,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.guide_memory enable row level security;

drop policy if exists "own memory all" on public.guide_memory;
create policy "own memory all" on public.guide_memory
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

## How it works

- After a conversation, the app quietly asks the model to pull out only durable, useful
  facts (name, what helps, ongoing situations, important people/pets) and saves them here.
- Those notes are fed back into the guides so they feel familiar next time — never recited
  back as a list.
- **Profile → What the guides remember** lets the person read every note in plain language,
  edit any of them, delete individual ones, clear them all, or switch memory off entirely.
- "Start over" also wipes this, alongside everything else.

Still to come (Stage 2b, when you're ready): nothing required — the guides already give the
gentle "Juan is reachable any time" nudge when they notice a worrying pattern, per Carlos.
