# Members directory + admin notes — one-time Supabase setup

Run this whole block once in Supabase → **SQL Editor → New query → Run**. It:
- moves private contact details into their own table (so admin can browse members
  WITHOUT ever seeing anyone's private contact info — keeping the promise to users),
- lets the owner read every member's public profile,
- adds an admin-notes table only the owner can read/write,
- makes sure every signed-in person shows up in the directory (with their email).

```sql
-- Directory needs each member's email on their profile row
alter table public.profiles add column if not exists email text;

-- 1) Private contact -> its own table (own-row only; admin cannot read it)
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

-- 2) Admin notes -> owner only; members can NEVER see notes about themselves
create table if not exists public.admin_notes (
  id uuid primary key references auth.users(id) on delete cascade,
  notes text,
  updated_at timestamptz not null default now()
);
alter table public.admin_notes enable row level security;
drop policy if exists "owner notes all" on public.admin_notes;
create policy "owner notes all" on public.admin_notes
  for all
  using ((auth.jwt() ->> 'email') = 'sloanefox.official@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'sloanefox.official@gmail.com');

-- 3) Owner can read all profiles for the directory
--    (profiles no longer holds contact details, so this exposes no private contact info)
drop policy if exists "owner reads all profiles" on public.profiles;
create policy "owner reads all profiles" on public.profiles
  for select using ((auth.jwt() ->> 'email') = 'sloanefox.official@gmail.com');

-- 4) Auto-create a profile row (with email) on signup, and backfill existing users
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
    on conflict (id) do update set email = excluded.email;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

insert into public.profiles (id, email)
  select id, email from auth.users
  on conflict (id) do update set email = excluded.email;
```

If you change the owner email later, update it in the two policies above (and in `App.jsx`).
