# Game progress (resume where you left off) — one-time Supabase setup

Saves an in-progress Sudoku or Word Search so it's exactly where you left it when you
come back. Private per user, one saved puzzle per game/difficulty.

Run once in Supabase → **SQL Editor → New query → paste → Run** (expect "Success"):

```sql
create table if not exists public.game_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  game text not null,          -- 'sudoku_easy' | 'sudoku_medium' | 'sudoku_hard' | 'wordsearch'
  state jsonb not null,        -- the in-progress puzzle
  updated_at timestamptz not null default now(),
  primary key (user_id, game)
);
alter table public.game_progress enable row level security;

drop policy if exists "own game progress select" on public.game_progress;
create policy "own game progress select" on public.game_progress
  for select using (auth.uid() = user_id);

drop policy if exists "own game progress insert" on public.game_progress;
create policy "own game progress insert" on public.game_progress
  for insert with check (auth.uid() = user_id);

drop policy if exists "own game progress update" on public.game_progress;
create policy "own game progress update" on public.game_progress
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own game progress delete" on public.game_progress;
create policy "own game progress delete" on public.game_progress
  for delete using (auth.uid() = user_id);
```

## What's saved
- **Sudoku** — your board, pencil notes, mistakes and timer, per difficulty. Finishing or
  starting a fresh puzzle clears the saved one for that difficulty.
- **Word Search** — the grid and which words you've found so far. Finishing or starting a
  new puzzle clears it.

Private to each user; nothing is shared.
