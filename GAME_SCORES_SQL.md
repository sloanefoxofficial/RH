# Game high scores (private, per person) — one-time Supabase setup

Saves each person's own best scores so they persist between sessions. Scores are
**private to that user** — nobody can see anyone else's. (A shared leaderboard would
be a separate, deliberate feature for later.)

Run once in Supabase → **SQL Editor → New query → paste → Run** (expect "Success"):

```sql
create table if not exists public.game_scores (
  user_id uuid not null references auth.users(id) on delete cascade,
  game text not null,          -- e.g. 'neojack', 'sudoku_easy', 'wordsearch'
  best numeric not null,       -- higher-is-better for points, we store best as-is
  mode text not null default 'high',  -- 'high' = keep largest, 'low' = keep smallest (times)
  updated_at timestamptz not null default now(),
  primary key (user_id, game)
);
alter table public.game_scores enable row level security;

-- Each person can only see and change their OWN scores.
drop policy if exists "own game scores select" on public.game_scores;
create policy "own game scores select" on public.game_scores
  for select using (auth.uid() = user_id);

drop policy if exists "own game scores upsert" on public.game_scores;
create policy "own game scores upsert" on public.game_scores
  for insert with check (auth.uid() = user_id);

drop policy if exists "own game scores update" on public.game_scores;
create policy "own game scores update" on public.game_scores
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

## What gets saved
- **Neo Jack** — best score (higher is better)
- **Sudoku** — best completion time per difficulty (lower is better)
- **Word Search** — best completion time (lower is better)

Each shows as "Your best: …" inside the game. Nothing is shared with other users.
