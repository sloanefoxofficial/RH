# Login & Admin setup (Supabase)

The app runs **without** login until you add the two Supabase keys below. Once they're set,
**login becomes required for everyone**, and full admin/owner control is automatically yours —
locked to **sloanfox.official@gmail.com**. Nobody else can get admin, no matter what.

Time: ~15 minutes, once.

---

## 1. Create a Supabase project

1. <https://supabase.com> → sign in → **New project**. Give it a name + database password (save it).
2. When ready, open **Project Settings → API** and copy:
   - **Project URL**
   - **anon public** key (safe to expose in a browser — it's the public key, not the secret one)

## 2. Add the keys to Vercel

Vercel → your project → **Settings → Environment Variables**:

| Name | Value |
|------|-------|
| `VITE_SUPABASE_URL` | your Project URL |
| `VITE_SUPABASE_ANON_KEY` | your anon public key |

(You should already have `ANTHROPIC_API_KEY` here.) Then redeploy once.

## 3. Turn on sign-in methods

- **Email + password** works out of the box. For easy testing you can turn *off* "Confirm email"
  under Authentication → Providers → Email.
- **Google** (optional): Authentication → Providers → **Google** → enable, then follow the linked
  steps to create a Google OAuth client. Guide:
  <https://supabase.com/docs/guides/auth/social-login/auth-google>
- Under **Authentication → URL Configuration**, set the **Site URL** to your Vercel URL (and add it
  to the redirect list) so Google sign-in and email confirmations return to your app.

## 4. (Optional) Create the settings table

Only needed if you want the editable **welcome note** in the admin area to save. In Supabase →
**SQL Editor** → New query → paste → Run:

```sql
create table if not exists public.settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);
alter table public.settings enable row level security;

-- Anyone signed in can read settings
create policy "read settings" on public.settings
  for select using (auth.role() = 'authenticated');

-- Only the owner email can change settings (server-side lock, matches the app)
create policy "owner writes settings" on public.settings
  for all
  using ((auth.jwt() ->> 'email') = 'sloanfox.official@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'sloanfox.official@gmail.com');
```

## 5. Log in

That's it — no "make me admin" step. Open your deployed app, sign in as
**sloanfox.official@gmail.com**, and the green **shield (Admin)** appears in the hub header.
Anyone else who signs in (Lisa, testers, real users) just gets the normal experience.

---

## How admin is locked (plain English)

- Admin isn't a password — it's tied to **one specific signed-in identity**. The app checks: *is the
  logged-in email exactly `sloanfox.official@gmail.com`?* If yes → admin. If not → normal user.
- To be that person you must actually **log into that Google/email account** (its real password /
  Google login). There's no secret code that flips admin on, so there's nothing for anyone to find
  in the app or guess.
- Even the database is locked the same way: only that email can write settings (step 4's policy).
- To change who the owner is, change `OWNER_EMAIL` at the top of `App.jsx` (and the email in the
  policy above). To add a second admin later, we'd switch to a small admin-list — ask me.

## Adding ElevenLabs voice cloning later (overview)

The voices today use the browser's built-in speech. To use ElevenLabs cloned voices:
1. Get an ElevenLabs API key and add it in Vercel as `ELEVENLABS_API_KEY` (server-side, like your
   Anthropic key — never in the browser).
2. Add a small `api/tts.js` endpoint that takes text + a voice ID, calls ElevenLabs, and returns audio.
3. In the app, when a guide speaks, play that audio instead of the browser voice (with the browser
   voice as a fallback). Each guide can have its own ElevenLabs voice ID.

That's a clean, self-contained add-on — tell me when you want it and I'll build it.

## Note

People's journal, plan, and chat history still live on their own device (localStorage). Login gates
access but doesn't yet sync personal data across devices — moving that into Supabase per-user is a
sensible next step when you want it.
