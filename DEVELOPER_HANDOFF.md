# The Resilience Hub — Developer Handoff Summary

_Last updated: July 2026 · Prepared for migration to a new development environment._

---

## 1. What this project is

The Resilience Hub is an Australian mental-health & wellbeing **Progressive Web App**. It offers AI "guides" (chat companions with distinct personalities), an optional 8-week self-guided plan, a journal, a self-help toolkit, crisis resources, and a bundled Games & Puzzles section.

**It is a support tool, not a replacement for professional or emergency help.** That framing drives almost every product and safety decision below, and a new developer must preserve it.

- **Slogan:** "You never have to walk it alone."
- **Live site:** https://rh-pi-green.vercel.app
- **Repo:** github.com/sloanefoxofficial/RH
- **Owner / admin account:** `sloanefox.official@gmail.com` (this literal string gates all admin/owner access — see §6)

### Key people
- **Lisa** — primary maintainer. First-time coder; does all the GitHub / Vercel / Supabase clicking herself. iPhone user. Deploys via the GitHub web UI, not a local toolchain.
- **Juan Carroso** — program coordinator/founder; basis for the "Juan" guide; builds the arcade games (Neo Jack, Sloane Fox). Samsung S24 Ultra.
- **Carlos Camacho** — Registered Psychologist advising the project; basis for the "Carlos" guide.
- **Trent** — additional tester (iPhone).

> Note on workflow: the current maintainer does **not** run a local dev server. Deploys happen by editing/uploading files in the GitHub web UI and letting Vercel auto-build. A new developer with a normal local toolchain can of course `npm install && npm run dev`, but keep the "editable from GitHub web" simplicity in mind (e.g. the whole app lives in one big `App.jsx` partly for this reason).

---

## 2. Tech stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend framework | **React 18.3** | Single-file app in `App.jsx` (~4,580 lines). Functional components + hooks. |
| Build tool | **Vite 5.4** (`@vitejs/plugin-react`) | `npm run dev` / `build` / `preview`. Output dir `dist`. |
| Styling | **Inline style objects** driven by a theme object `T` | No Tailwind, no CSS framework. One global `index.css` for base/reset + the crisis bar. Font: Inter. |
| Icons | **lucide-react** | |
| Auth + DB | **Supabase** (`@supabase/supabase-js` v2.45) | Postgres + Auth + Row Level Security. Client in `supabase.js`. |
| Serverless API | **Vercel Functions** (`/api/*.js`, Node) | `api/chat.js` (AI) and `api/tts.js` (voice). Keys stay server-side. |
| AI model | **Anthropic Claude** via `api/chat.js` | Model from `ANTHROPIC_MODEL` env or default `claude-sonnet-5`. |
| Text-to-speech | **Google Cloud TTS** via `api/tts.js` | Chirp3-HD **en-AU** voices (hardcoded to en-AU — see §7). Falls back to browser speech synthesis if the key is missing or a call fails. |
| Games | **Standalone HTML5 canvas** files in `public/` | Offline, ad-free, no build step. Embedded via `<iframe>`; talk to the app over `postMessage`. |
| Hosting / CI | **Vercel** (project `rh`) | Auto-deploys on push to the GitHub repo. |

### Graceful degradation
`supabase.js` exports `authEnabled = Boolean(url && anon)`. If the Supabase env vars are absent the app **runs open (no sign-in)** so a deployment still works before the backend is configured. Auth-gated features (profiles, chat memory, game saves, admin) light up only once the keys exist.

### Environment variables (set in Vercel → Project → Settings → Environment Variables, Production)
| Variable | Used by | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | `api/chat.js` | Claude access (server-side only). |
| `ANTHROPIC_MODEL` _(optional)_ | `api/chat.js` | Override model; defaults to `claude-sonnet-5`. |
| `VITE_SUPABASE_URL` | client | Supabase project URL (exposed to browser — safe). |
| `VITE_SUPABASE_ANON_KEY` | client | Supabase anon key (safe to expose; RLS enforces access). |
| `GOOGLE_TTS_KEY` | `api/tts.js` | Google Cloud TTS (server-side only). |

Any change to env vars requires a Vercel redeploy to take effect. SQL changes in Supabase are instant.

### Repository layout
```
App.jsx                  ← the entire React app (all screens/components)
main.jsx                 ← React entry point
index.html               ← Vite HTML shell
index.css                ← base styles + crisis bar
images.js                ← base64/asset references (IMG.*)
supabase.js              ← Supabase client + authEnabled flag
package.json / vite.config.js / vercel.json / .env.example / .gitignore
README.md
api/
  chat.js                ← one shared Claude endpoint for ALL AI features
  tts.js                 ← Google TTS endpoint
public/
  manifest.webmanifest, icon-192.png, icon-512.png, apple-touch-icon.png
  merch/ (hoodie, pants, signature, vertical, vixen .png)
  neojack.html           ← Arcade — Juan's shooter ("Rogue Breakout" build)
  sloanefox.html         ← Arcade — Juan's side-scrolling co-op run-and-gun
  sudoku.html            ← Puzzle
  wordsearch.html        ← Puzzle
  crossword.html         ← Puzzle — 5×5 mini (newest)
*_SQL.md / SUPABASE_SETUP.md   ← one-time DB setup scripts (authoritative DDL)
```

---

## 3. Database schema (Supabase / Postgres)

All tables live in schema `public`, all have **Row Level Security enabled**, and all owner-only access is gated on the literal email `sloanefox.official@gmail.com` via `auth.jwt() ->> 'email'`. The authoritative `CREATE` statements are in the `*_SQL.md` files in the repo root; run each once in the Supabase SQL Editor. Summary below.

### `profiles` — public member profile (own-row; owner can read all)
`SUPABASE_SETUP.md` + `MEMBERS_SQL.md`
```
id uuid PK → auth.users(id)   preferred_name text   pronouns text
bio text   avatar text   email text   updated_at timestamptz
-- contact_private was MOVED OUT to private_contact (see below)
```
A signup trigger `handle_new_user()` auto-creates a profile row (with email). Also stores onboarding answers / plan path (`planPath` = `"full"` | `"short"`) as part of profile state used by the app.

### `private_contact` — private contact details (own-row ONLY)
`MEMBERS_SQL.md` — deliberately separated so the admin/owner can browse the member directory **without ever seeing anyone's private contact info**.
```
id uuid PK → auth.users(id)   contact text   updated_at timestamptz
RLS: auth.uid() = id  (owner has NO read policy here — by design)
```

### `admin_notes` — owner-only notes about members
`MEMBERS_SQL.md`
```
id uuid PK → auth.users(id)   notes text   updated_at timestamptz
RLS: owner email only (members can never read notes about themselves)
```

### `settings` — global key/value app settings
`SUPABASE_SETUP.md`
```
key text PK   value text   updated_at timestamptz
RLS: everyone reads; owner writes
```

### `chat_history` — AI guide conversation history (own-row, private even from admin)
`CHAT_MEMORY_SQL.md`
```
user_id uuid → auth.users(id)   character text   messages jsonb default '[]'
updated_at timestamptz   PK (user_id, character)
RLS: own rows only
```

### `guide_memory` — derived long-term memory for the guides (own-row)
`GUIDE_MEMORY_SQL.md`
```
user_id uuid PK → auth.users(id)   memories jsonb default '[]'
enabled boolean default true   updated_at timestamptz
RLS: own rows only
```
Users can see/edit/delete/toggle-off/add their own memories. **Crisis, self-harm, and abuse content is never written here** (see §6).

### `guide_prompts` — per-guide personality customisations (owner-editable)
`GUIDE_PROMPTS_SQL.md`
```
slug text PK ('rex'|'juan'|'carlos'|'mick'|'lila')   notes text default ''
updated_at timestamptz
RLS: anyone reads; owner writes
```
These notes are **append-only personality layers** on top of the locked safety/role/memory base prompt — they cannot override safety behaviour. "Reset to default" clears the notes.

### `notifications` + `notification_reads` — broadcast messages & read state
`NOTIFICATIONS_SQL.md`
```
notifications:       id uuid PK   title text   body text   created_at timestamptz
                     RLS: everyone reads; owner writes
notification_reads:  user_id uuid   notification_id uuid   read_at timestamptz
                     PK (user_id, notification_id)   RLS: own rows only
```

### `coordinator_messages` — 1:1 member ↔ coordinator threads
`MESSAGES_SQL.md`
```
id uuid PK   user_id uuid (whose thread)   sender text CHECK in ('user','coordinator')
body text   created_at timestamptz   read_by_user boolean   read_by_coordinator boolean
RLS: member reads/sends/updates own thread; coordinator (owner) sees all
```

### `game_scores` — private best scores (own-row)
`GAME_SCORES_SQL.md`
```
user_id uuid → auth.users(id)   game text   best numeric
mode text default 'high'  ('high' = keep largest; 'low' = keep smallest, for times)
updated_at timestamptz   PK (user_id, game)
RLS: own rows only (select/insert/update)
```
Game keys in use: `neojack` (high), `sudoku_easy|medium|hard` (low, best time), `wordsearch` (low), `sloanefox` (high), `crossword` (low, best time). **No shared leaderboard** — that's a deliberate future feature.

### `game_progress` — resume in-progress puzzles (own-row incl. delete)
`GAME_PROGRESS_SQL.md`
```
user_id uuid → auth.users(id)   game text   state jsonb   updated_at timestamptz
PK (user_id, game)   RLS: own rows only (select/insert/update/DELETE)
```
Used by **Sudoku** and **Word Search** only (action games intentionally do not resume).

> ⚠️ **Migration action:** confirm all of the above `*_SQL.md` scripts have been run in the target Supabase project — including `GAME_SCORES_SQL.md` and `GAME_PROGRESS_SQL.md`, which were the two most recent. Game saving/resume silently no-ops until both exist. If pointing at a brand-new Supabase project, run every SQL file once and re-set the four env vars.

---

## 4. Application architecture (`App.jsx`)

Everything is in one file by design (keeps it editable from the GitHub web UI).

- **Theme:** a `T` object (~line 20) holds the palette and shadows:
  `bgTop #ece7f4 · bgMid #eef0f7 · bgBot #fdefe7 · card #fff · ink #28262f · sub #726e7c · line #e9e3f0 · green #37a065 · greenDk #2c7d50 · teal #2f9e93 · tealDk #227d74 · blue #3f6faf · blueDk #2f5a8c`, plus `soft`/`lift` box-shadows. Font: Inter. New UI should reuse these tokens.
- **Navigation:** `screen`/`setScreen` with an `activeChar` for the current guide, and a history stack `histRef`. `go(screen, char)` pushes; `back()` pops. All back buttons use `<BackBtn onBack={back}/>` — a solid green "Previous Page" pill.
- **Screens:** `welcome → intro (RexIntro) → planChoice → onboarding (full|short) → hub`, then from the hub: `program · guides · merch · games · chat · journal · toolkit · admin · profile · notifications · coordinator · memory · settings`.
- **The 5 guides** (`CHARS`, ~line 82), each with `slug`, `name`, `role`, `img`, `tint`, `voice` (pitch/rate), and an en-AU `voiceId`:
  - `rex` — welcomer/onboarding host (Chirp3-HD Algenib)
  - `juan` — lived-experience "main mate" (Umbriel)
  - `carlos` — Registered Psychologist / clinical guide (Puck)
  - `mick` — practical life & housing (Enceladus, `standby`)
  - `lila` — family & relationships (Leda, `standby`)
- **AI plumbing:** a `SHARED` system prompt carries the locked safety/honesty/referral rules and "reply in whatever language the person writes in" (multilingual). Chat goes `callModel → /api/chat`. Voice goes `useVoice → /api/tts` with autoplay-unlock (silent WAV), a TTS cache + prefetch, barge-in off by default, and a hold-to-talk watchdog.

### Current UI state (what's built & live)
- **Onboarding is opt-out for the plan.** After Rex's intro, `PlanChoice` offers "Yes, build my 8-week plan" (→ full 15-question onboarding → Carlos builds the plan) or "Not right now" (→ short mode: name, mood, areas, safety — safety never skipped → hub, no plan). Choice persists as `profile.planPath`. The Program page shows a warm "Ready for a plan?" card for short-mode users; a gentle one-time plan nudge appears in guide prompts only when `!plan`.
- **Guides** all live together on `GuidesPage` (Juan, Carlos, Mick, Lila), each with a "Best for / Tip"; Carlos's AI disclaimer is a note under his card. Tabs were renamed to "Your 8-Week Plan" and "Your Guides."
- **Crisis bar** is always visible (fixed bottom). It was moved *inside* the text-zoom container so modals (notification popup, etc.) stack above it correctly — don't reintroduce that stacking bug when refactoring.
- **Games & Puzzles** (`GamesPage`) — five games, opened in an in-app iframe with a "Full screen" option. **Ordered by type: Puzzles first (Sudoku, Word Search, Mini Crossword), then Arcade (Neo Jack, Sloane Fox).** Each game card carries a `tag`, `tint`, and icon colour from a `GAMES` array near the bottom of `App.jsx`.

### Games ↔ app bridge (`postMessage`)
Games are sandboxed and cannot touch Supabase directly. The app ↔ iframe protocol:
- Score: game → `{type:'rh-score', game, value, mode}`; game → `{type:'rh-get-best', game}`; app → `{type:'rh-best', game, best}`. Games guard with an in-frame check and show a "Your best" line.
- Progress (Sudoku/Word Search): `rh-get-progress` / `rh-progress`, `rh-save-progress`, `rh-clear-progress`.
- **localStorage is blocked in the iframe sandbox.** Neo Jack's in-game initials leaderboard therefore falls back to in-memory (resets each session) — the persistent value is the per-user best score saved via the bridge.

---

## 5. Deployment workflow (as currently done)

1. Edit `App.jsx` (or add/replace a file) in the **GitHub web UI** → **Commit**. Vercel auto-builds and redeploys.
2. New `api/*.js` files: create individually via GitHub "Create new file."
3. New/updated `public/*` files (e.g. games): GitHub "Upload files" into `public/`.
4. Env-var or key changes require a Vercel redeploy; SQL changes in Supabase are instant.

A conventional local flow works too: `npm install`, `npm run dev`, `npm run build`. There's no test suite; validation to date has been a JSX brace/paren balance scanner + per-game `new Function(scriptBody)` syntax checks + manual playtesting on real devices.

---

## 6. Safety & compliance decisions (do not regress)

These are load-bearing for a mental-health product. Preserve them through any refactor.

- **No hardcoded admin backdoor.** Admin is locked to the owner email via Supabase auth; there is no bypass. Owner-gating uses the literal `sloanefox.official@gmail.com`.
- **Crisis resources always available** (bar fixed to the bottom on every screen), plus a consent screen and disclaimers. Australian numbers currently used: Emergency **000**, Lifeline **13 11 14**, Suicide Call Back Service **1300 659 467**, Beyond Blue **1300 22 4636**. Re-verify these periodically from official sources.
- **No diagnosis.** Guides never diagnose; they can suggest seeing a licensed professional.
- **Guide memory excludes crisis/self-harm/abuse content** — it is never persisted. Users have full see/edit/delete/off/add controls over their memory.
- **Guides must not lie to comfort, must not help with illegal/dishonest acts, and must not police disclosures.** They cross-refer to each other by name.
- **Factual data (phone numbers, services) must be web-verified from official sources — never generated from model memory.** Meditation/self-help "links" return AI-generated YouTube *search phrases*, never specific URLs.
- **Guide personality edits are append-only** layers on top of the locked safety/role/memory base; "Reset to default" is the undo.
- **Games:** private per-user scores/progress only. No leaderboards or any cross-user visibility until community features are deliberately opened later.

---

## 7. Known limitations & gotchas

- **Voice in-browser is fussy**, especially iOS Safari (autoplay policies). The app unlocks audio on first gesture and falls back to browser speech synthesis if Google TTS is unavailable.
- **TTS is hardcoded to en-AU** in `api/tts.js`. Chat is multilingual, but spoken output is always Australian English — proper per-language TTS is a parked feature.
- **iframe sandbox blocks localStorage** (see the bridge note in §4). Games persist only through the Supabase bridge, and only when signed in and running in-app (full-screen tab and logged-out play don't persist — handled gracefully).
- **Text-zoom uses the CSS `zoom` property**, which creates a stacking context — this previously trapped the crisis bar under modals. Keep the crisis bar inside that container.
- **`App.jsx` is one large file** — intentional, but mind merge conflicts and keep components cohesive.
- The **plan may occasionally repeat tasks** across weeks (minor, known).
- **Action games are landscape / full-screen–best** on phones; Sloane Fox co-op needs two keyboards, so it's effectively desktop-only for co-op.

---

## 8. Next immediate features (planned roadmap)

**In priority order:**

1. **Capacitor Android wrap** — the next major initiative, maintainer-led, expected imminently. Trigger phrase in past working sessions: "let's start the Capacitor wrap." Plan is a staged rollout: **web (live) → Android via Capacitor → iOS later.** Capacitor itself is free; costs are store fees (Google Play ~US$25 one-time, buildable from Windows; Apple US$99/yr and requires a Mac). The wrap's value is native speech plugins (to fix the finicky in-browser voice) and native per-user storage. Start with Juan's Samsung S24 Ultra.

2. **Post-migration verification pass** (do these first on the new environment):
   - Confirm every `*_SQL.md` script has been run in the target Supabase project (especially `GAME_SCORES_SQL.md` and `GAME_PROGRESS_SQL.md`).
   - Re-set the five environment variables in Vercel and redeploy.
   - Smoke-test: sign-in, a guide chat with **sound on** (try a French/Spanish reply), a plan build, and each of the five games (score save + "Your best" line; Sudoku/Word Search resume).
   - Verify the notification popup "Got it" button is tappable over the crisis bar.
   - Confirm Facebook links resolve and re-verify the crisis numbers.
   - Real-device checks: Word Search drag-select on iPhone/Android; Neo Jack "Rogue Breakout" and Sloane Fox playthroughs (both were hand-rebuilt from pasted source and want a solid playtest); crossword solve/check/reveal/new + best-time save.

3. **Parked / later features:**
   - **Shared game leaderboards** — only when community features are deliberately opened. Neo Jack's local initials leaderboard could then persist via the Supabase bridge.
   - **Proper per-language TTS** — `api/tts.js` currently hardcodes en-AU.

---

## 9. External links & accounts

- **Live app:** https://rh-pi-green.vercel.app
- **Repo:** github.com/sloanefoxofficial/RH · **Vercel project:** `rh`
- **Facebook group:** https://www.facebook.com/share/g/1Edkyyez1t/
- **Sloane Fox page:** https://www.facebook.com/people/Sloanefox/61586163260435/
- **Merch (Big Cartel):** https://sloanefox.bigcartel.com/
- **Owner/admin email:** `sloanefox.official@gmail.com`

---

_This document reflects the project state at handoff. The authoritative source for database DDL is the `*_SQL.md` files in the repo; the authoritative source for app behaviour is `App.jsx` and the two `api/` functions._
