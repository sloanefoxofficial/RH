# Guide personalities (admin-editable) — one-time Supabase setup

Lets Juan fine-tune each guide's personality from the admin panel, live for everyone,
without a redeploy. Only their **tone and character** — the safety rules, their role, and
what they remember stay locked in the app and can't be changed here.

Run once in Supabase → **SQL Editor → New query → paste → Run** (expect "Success"):

```sql
create table if not exists public.guide_prompts (
  slug text primary key,
  notes text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.guide_prompts enable row level security;

-- Everyone's app can READ the personalities (they shape the guides for all users).
drop policy if exists "anyone reads guide prompts" on public.guide_prompts;
create policy "anyone reads guide prompts" on public.guide_prompts
  for select using (true);

-- Only the owner account can CHANGE them.
drop policy if exists "owner writes guide prompts" on public.guide_prompts;
create policy "owner writes guide prompts" on public.guide_prompts
  for all
  using ((auth.jwt() ->> 'email') = 'sloanefox.official@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'sloanefox.official@gmail.com');
```

## How it works

- Until Juan edits anything, every guide uses the built-in default personality (the ones
  you wrote), so nothing changes on day one.
- **Admin panel → Guide personalities** → pick a guide → edit the text → **Save changes**.
  It writes here and applies on the guide's next message, for everyone.
- **Reset to default** puts a guide's original personality back in the box (then Save).
- These notes only shape tone/voice/character. The base prompt always keeps the safety,
  honesty, role, cross-referral, and memory rules on top — a personality note can't override them.
