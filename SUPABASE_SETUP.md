# Login & Admin setup (Supabase)

The app runs **without** login until you add the two Supabase keys below. Once they're set,
**login becomes required for everyone** and your admin area switches on. So you can do this whenever
you're ready — it won't break your current deploy.

Time: ~15 minutes. You'll do this once.

---

## 1. Create a Supabase project

1. Go to <https://supabase.com> → sign in → **New project**. Give it a name and a database password
   (save that password somewhere).
2. When it finishes setting up, open **Project Settings → API**. Copy two values:
   - **Project URL**
   - **anon public** key (this one is safe to expose in a browser — it's the public key, not the secret one)

## 2. Add the keys to Vercel

In your Vercel project → **Settings → Environment Variables**, add:

| Name | Value |
|------|-------|
| `VITE_SUPABASE_URL` | your Project URL |
| `VITE_SUPABASE_ANON_KEY` | your anon public key |

(You should already have `ANTHROPIC_API_KEY` here from before.) Then redeploy once.

## 3. Create the tables

In Supabase → **SQL Editor** → **New query**, paste all of this and click **Run**:

```sql
-- Profiles: one row per user, with an admin flag
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "read own profile" on public.profiles
  for select using (auth.uid() = id);

-- Auto-create a profile whenever someone signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Settings: admin-editable key/value pairs (e.g. the welcome note)
create table if not exists public.settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);
alter table public.settings enable row level security;

create policy "read settings" on public.settings
  for select using (auth.role() = 'authenticated');

create policy "admins write settings" on public.settings
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  ) with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );
```

Note: there is **no** rule that lets a user set their own `is_admin`, so nobody can promote
themselves. Admin is granted only by you, in step 5.

## 4. Turn on sign-in methods

- **Email + password** works out of the box (Authentication → Providers → Email is on by default).
  For easy testing you can turn *off* "Confirm email" under Authentication → Providers → Email.
- **Google** (optional): Authentication → Providers → **Google** → enable, then follow Supabase's
  linked steps to create a Google OAuth client and paste in the Client ID/Secret. Guide:
  <https://supabase.com/docs/guides/auth/social-login/auth-google>
- Under **Authentication → URL Configuration**, set the **Site URL** to your Vercel URL and add it to
  the redirect allow-list, so Google sign-in and email confirmations return to your app.

## 5. Make yourself the admin

Sign in to your deployed app once (with the email you'll use as owner) so your profile row exists.
Then in Supabase → SQL Editor, run this with **your** email:

```sql
update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'YOU@EXAMPLE.COM');
```

Refresh the app — you'll see a green shield (Admin) in the hub header. Everyone else just sees the
normal experience. To make Carlos an admin too, run the same line with his email.

---

## What the admin area gives you

- **Claude admin assistant** — drafts and rewrites content, suggests guide wording, and helps you
  work through bugs/errors. It hands you drafts and steps to apply; it does **not** edit the live app
  or safety wording by itself.
- **Welcome note** — a short message you can edit, saved to Supabase.
- **Crisis contacts** — shown read-only on purpose; change those in the code (`CONTACTS` in
  `src/App.jsx`) with care and re-verification, not from a text box.

## Notes

- People's journal, plan, and chat history still live on their own device (localStorage) for now —
  login gates access but doesn't yet sync personal data to the server. Moving that into Supabase
  (per-user, with row-level security) is a sensible next step when you want cross-device history.
- For actual **code** changes (fixing bugs, adding features), use **Claude Code** in your dev
  workflow: describe the change, it edits the repo, and pushing to GitHub redeploys via Vercel.
