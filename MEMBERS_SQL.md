# Members directory + admin notes — one-time Supabase setup

Run this whole block once in Supabase → **SQL Editor → New query → Run**. It:
- moves private contact details into their own table (so admin can browse members
  WITHOUT ever seeing anyone's private contact info — keeping the promise to users),
- lets admins read every member's public profile,
- adds an admin-notes table only admins can read/write,
- makes sure every signed-in person shows up in the directory (with their email),
- records the original join date and carries a required signup name into the directory.

Admins are: `sloanefox.official@gmail.com` (Juan, founder) and `lisamaree1663@gmail.com`
(Lisa, developer).

```sql
-- Directory needs each member's email on their profile row
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists created_at timestamptz not null default now();

-- 1) Private contact -> its own table (own-row only; admins cannot read it)
create table if not exists public.private_contact (
  id uuid primary key references auth.users(id) on delete cascade,
  contact text,
  updated_at timestamptz not null default now()
);
alter table public.private_contact enable row level security;
drop policy if exists "own contact all" on public.private_contact;
create policy "own contact all" on public.private_contact
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- move any existing contact out of profiles into the private table
insert into public.private_contact (id, contact)
  select id, contact_private from public.profiles
  where contact_private is not null and contact_private <> ''
  on conflict (id) do update set contact = excluded.contact;

-- 2) Admin notes -> admins only; members can NEVER see notes about themselves
create table if not exists public.admin_notes (
  id uuid primary key references auth.users(id) on delete cascade,
  notes text,
  updated_at timestamptz not null default now()
);
alter table public.admin_notes enable row level security;
drop policy if exists "owner notes all" on public.admin_notes;
create policy "owner notes all" on public.admin_notes
  for all
  using ((auth.jwt() ->> 'email') in ('sloanefox.official@gmail.com', 'lisamaree1663@gmail.com'))
  with check ((auth.jwt() ->> 'email') in ('sloanefox.official@gmail.com', 'lisamaree1663@gmail.com'));

-- 3) Admins can read all profiles for the directory
--    (profiles no longer holds contact details, so this exposes no private contact info)
drop policy if exists "owner reads all profiles" on public.profiles;
create policy "owner reads all profiles" on public.profiles
  for select using ((auth.jwt() ->> 'email') in ('sloanefox.official@gmail.com', 'lisamaree1663@gmail.com'));

-- 4) Auto-create a profile row (with email, signup name, and join date) on signup,
--    and backfill existing users from auth.users.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, preferred_name, created_at)
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'preferred_name', new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')), ''),
    new.created_at
  )
  on conflict (id) do update set
    email = excluded.email,
    preferred_name = coalesce(nullif(trim(public.profiles.preferred_name), ''), excluded.preferred_name);
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

update public.profiles p
set created_at = u.created_at,
    preferred_name = coalesce(nullif(trim(p.preferred_name), ''), nullif(trim(coalesce(u.raw_user_meta_data ->> 'preferred_name', u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', '')), '')),
    email = coalesce(p.email, u.email)
from auth.users u
where p.id = u.id;

insert into public.profiles (id, email, preferred_name, created_at)
  select id,
    email,
    nullif(trim(coalesce(raw_user_meta_data ->> 'preferred_name', raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name', '')), ''),
    created_at
  from auth.users
  on conflict (id) do update set email = excluded.email;
```

If the admin list changes later (an email changes, or an admin is added/removed), update
it in the two policies above (and in `App.jsx`'s `ADMIN_EMAILS` constant).
