# The Resilience Hub

A warm, voice-enabled wellbeing companion with cloud-mascot guides (Rex, Juan, Carlos, Mick, Lila).
_You never have to walk it alone._

This is the **hosted** version: a React front end plus a tiny backend (`/api/chat`) that
holds your Anthropic API key **server-side**, so the guides can chat for anyone, on any device —
your key is never exposed to the browser.

> This is a **support tool**, not a replacement for a doctor, psychologist, or emergency service.

**Includes:** Rex's welcome, a guided onboarding, a personalised 8-week plan, per-character AI chat
with voice, a voice-first journal, an always-on crisis bar, and a **Toolkit** of self-guided anxiety
aids — animated box-breathing, 5-4-3-2-1 grounding, affirmations, and quick-calm tips (all work
offline, no AI needed). During a chat, a guide can also suggest the right tool for the moment (e.g.
Carlos offering breathing when someone mentions a panic spike) as a tap-to-open button.

**Login & admin (optional):** add your Supabase keys and everyone signs in (Google or email/password).
Full admin/owner control is locked to a single address (`sloanfox.official@gmail.com`, set as
`OWNER_EMAIL` in `App.jsx`) — you get an admin area with a Claude assistant that drafts content and
helps with fixes (you review and apply) plus an editable welcome note. There is **no** hardcoded
password or backdoor: admin is tied to that signed-in identity, so no one else can reach it. Setup
steps: see `SUPABASE_SETUP.md`.

---

## What you need

- [Node.js](https://nodejs.org) 18 or newer
- An **Anthropic API key** — create one at <https://console.anthropic.com> → *API Keys*
- A free **GitHub** account and a free **Vercel** account (easiest host; others work too)

---

## Deploy it (≈10 minutes)

1. **Put this folder in a GitHub repo.** Create a new repo and upload these files (or `git push`).
2. **Import it into Vercel.** Go to <https://vercel.com/new>, pick the repo. Vercel auto-detects
   **Vite** — leave the build settings as they are.
3. **Add your key.** In the import screen (or *Project → Settings → Environment Variables*) add:
   - `ANTHROPIC_API_KEY` = your key
   - *(optional)* `ANTHROPIC_MODEL` = `claude-sonnet-5` (the default) or `claude-haiku-4-5` (cheaper/faster)
4. **Deploy.** You get a public URL like `https://resilience-hub.vercel.app`.
   Send that link to Carlos or anyone else — the chat works for them, no sign-in, on phone or desktop.

Any time you push changes to GitHub, Vercel redeploys automatically.

---

## Run it locally

```bash
npm install
npm run dev        # UI only — the chat needs the /api function (see below)
```

`npm run dev` serves the interface, but the guides won't reply because `/api/chat` isn't running.
To test chat locally, use the Vercel CLI, which runs the function too:

```bash
npm i -g vercel
vercel dev         # then create a .env from .env.example with your key
```

---

## Choosing the model / cost

The backend defaults to **`claude-sonnet-5`** — a strong balance of warmth, quality, and cost,
which suits sensitive conversations. To change it, set `ANTHROPIC_MODEL`:

- `claude-sonnet-5` — recommended default.
- `claude-haiku-4-5` — noticeably cheaper and faster; good if costs add up, slightly less nuanced.

You pay Anthropic per use based on your API key. See <https://www.anthropic.com/pricing> for current rates.

---

## How data is stored

- **Journal entries, chat history, plan progress** are saved in the **user's own browser**
  (`localStorage`). They stay on that device and are **not** sent to any server you run.
- **Chat messages and "help me unpack" journal text** are sent to Anthropic (through your key)
  so the guides can respond. Nothing else leaves the device.
- On **first launch**, users see a short consent screen explaining this and must agree before
  continuing (their choice is remembered on the device).

---

## Before you put this in front of real users

This is a solid prototype, but a wellbeing app for vulnerable people needs a few things handled
first. Please treat this as a checklist, not an afterthought:

- **Re-verify every crisis number** in `App.jsx` (`CONTACTS`) against current official sources.
- **Privacy & consent:** add a clear privacy notice and consent flow explaining that chat/journal
  text is sent to an AI provider. Consider the Australian Privacy Principles and whether you need
  formal review before handling people's mental-health disclosures.
- **Clinical review:** have Carlos (Registered Psychologist) review the guide personas and the
  crisis-routing wording in `App.jsx` (the `CHARS` system prompts and the onboarding safety step).
- **Data handling:** decide whether sensitive entries should ever leave the device, and how long
  anything is kept. Right now journals stay local by design — keep it that way unless you add
  proper, consented, secure storage.
- **Rate limiting / abuse:** add basic limits on `/api/chat` before a public launch.

There is intentionally **no hidden developer/admin backdoor** in this app. If you want an admin
area later, use a proper authenticated role, not a shared password.

---

## Project structure

```
resilience-hub/
├── api/chat.js        # backend: holds your key, calls Anthropic (the only folder)
├── App.jsx            # the whole app (screens, characters, voice, crisis bar, login, admin)
├── images.js          # character art (watermark-free), inlined
├── main.jsx           # React entry
├── index.css          # minimal reset
├── supabase.js        # auth client (login turns on when keys are set)
├── index.html
├── package.json
├── vite.config.js
├── vercel.json
├── .env.example
├── README.md
└── SUPABASE_SETUP.md
```

Everything except the `api/` folder sits at the top level, so uploading is simple: drop all the
files in, plus the `api` folder.

Voice (speaking + hold-to-talk) uses the browser's built-in Web Speech API and works best in
Chrome / Edge; it falls back to typing where speech isn't supported.
