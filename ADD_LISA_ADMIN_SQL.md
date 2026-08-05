# Add Lisa as a second admin — one-time Supabase update

Run once in Supabase → **SQL Editor → New query → paste → Run** (expect "Success").
This updates the three existing owner-only policies (from `MEMBERS_SQL.md` and
`NOTIFICATIONS_SQL.md`) to recognise **two** admin emails instead of one. No tables
or data are touched — this only replaces who the policies let in.

```sql
-- Admin notes: owner + Lisa can read/write member notes
drop policy if exists "owner notes all" on public.admin_notes;
create policy "owner notes all" on public.admin_notes
  for all
  using ((auth.jwt() ->> 'email') in ('sloanefox.official@gmail.com', 'lisamaree1663@gmail.com'))
  with check ((auth.jwt() ->> 'email') in ('sloanefox.official@gmail.com', 'lisamaree1663@gmail.com'));

-- Profiles: owner + Lisa can read every profile for the members directory
drop policy if exists "owner reads all profiles" on public.profiles;
create policy "owner reads all profiles" on public.profiles
  for select using ((auth.jwt() ->> 'email') in ('sloanefox.official@gmail.com', 'lisamaree1663@gmail.com'));

-- Notifications: owner + Lisa can write and broadcast notifications
drop policy if exists "owner writes notifications" on public.notifications;
create policy "owner writes notifications" on public.notifications
  for all
  using ((auth.jwt() ->> 'email') in ('sloanefox.official@gmail.com', 'lisamaree1663@gmail.com'))
  with check ((auth.jwt() ->> 'email') in ('sloanefox.official@gmail.com', 'lisamaree1663@gmail.com'));
```

Guide prompts (`GUIDE_PROMPTS_SQL.md`) were deliberately left owner-only — Lisa doesn't
need or want access there, Juan handles guide personalities.

If either admin's email ever changes, or a third admin is added, update the email list
in these three policies (and in `App.jsx`'s `ADMIN_EMAILS` constant).
