import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Phone, LifeBuoy, X, Mic, Send, Square, Volume2, VolumeX,
  ArrowLeft, ArrowUp, LogOut, BookOpen, CheckCircle2, Circle, ChevronRight,
  ChevronLeft, Sparkles, Heart, Wind, Anchor, Play, Pause, RotateCcw, Wrench,
  Shield, Eye, EyeOff, User, Megaphone, Youtube, ExternalLink, Radio, Paperclip, MessageCircle, Share2, Flame, HelpCircle, Plus, Search, Settings as SettingsIcon, CalendarCheck, Users, ShoppingBag, Gamepad2, Zap, Download, FileText, Clock, MapPin, DollarSign,
} from "lucide-react";
import { IMG } from "./images.js";
import { supabase, authEnabled } from "./supabase.js";

/* ------------------------------------------------------------------ *
 * The Resilience Hub — hosted build (React front end + /api/chat backend)
 * You never have to walk it alone.
 * Support tool only — not a replacement for a doctor, psychologist,
 * or emergency service.
 * ------------------------------------------------------------------ */


const T = {
  bgTop: "#edf7f0", bgMid: "#f6faf7", bgBot: "#fff4ea",
  card: "#ffffff", ink: "#244238", sub: "#6f7f77",
  line: "#dcece2", green: "#4d9f68", greenDk: "#205f48",
  teal: "#55ae9b", tealDk: "#2e8578",
  blue: "#5b83b8", blueDk: "#345c8d",
  soft: "0 8px 24px rgba(47,97,72,0.08), 0 2px 7px rgba(47,97,72,0.05)",
  lift: "0 20px 50px rgba(47,97,72,0.15), 0 6px 16px rgba(47,97,72,0.09)",
};

// The router records the actual screen a person came from. Any top back
// button without a fixed local parent uses this label, rather than a vague
// “Previous Page” caption.
const SCREEN_BACK_LABELS = {
  welcome: "Welcome", hub: "Home", onboarding: "Get Started", program: "8-Week Plan",
  guides: "Guides", chat: "Guide Chat", toolkit: "Toolkit", journal: "Private Journal",
  resources: "Resources", games: "Games & Puzzles", merch: "Sloane Fox Merch",
  carlosLibrary: "Carlos Library", programInfo: "Program", bookAppointment: "Program",
  mensShed: "Men’s Shed", mensGroup: "Men’s Group", settings: "Settings", profile: "Profile",
  memory: "Profile", notifications: "Home", coordinator: "Message Juan", admin: "Admin",
  adminMessages: "Messages", adminBugReports: "Bug Reports", adminAppointments: "Appointments",
  bugReport: "Report a Bug", userFeedback: "Share Feedback",
};
const screenBackLabel = (screen) => SCREEN_BACK_LABELS[screen] || "Home";
let __backDestinationLabel = "Home";

/* ---- persistent storage (browser localStorage) ---- */
async function sget(key) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; }
  catch { return null; }
}
async function sset(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

const JOURNAL_PIN_STORAGE_KEY = "rh_journal_pin_v1";

// The PIN remains device-local and only its one-way digest is stored. This is
// a privacy screen lock for the Journal, not encryption of the journal data.
async function hashJournalPin(pin) {
  if (!globalThis.crypto?.subtle || typeof TextEncoder === "undefined") throw new Error("PIN locking is not supported in this browser.");
  const bytes = new TextEncoder().encode(`resilience-hub-journal-pin-v1:${pin}`);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/* ---- crisis contacts (AU). Verify before any real release. ---- */
const CONTACTS = [
  { label: "Emergency", number: "000", tel: "000", accent: true },
  { label: "Lifeline", number: "13 11 14", tel: "131114" },
  { label: "Suicide Call Back", number: "1300 659 467", tel: "1300659467" },
  { label: "Beyond Blue", number: "1300 22 4636", tel: "1300224636" },
];

// FULL admin/owner control is locked to these exact addresses. Only someone
// signed in as one of these accounts is an admin — no password unlocks it,
// and changing access means editing this list. Everyone else is a normal user.
const ADMIN_EMAILS = ["sloanefox.official@gmail.com", "lisamaree1663@gmail.com"];

// Compare emails forgivingly: lowercase, and for Gmail ignore dots and "+tags"
// (Gmail treats sloanefox.official@ and sloanefoxofficial@ as the same inbox).
function normEmail(e) {
  if (!e) return "";
  e = String(e).trim().toLowerCase();
  const at = e.indexOf("@");
  if (at === -1) return e;
  let local = e.slice(0, at);
  let domain = e.slice(at + 1);
  if (domain === "gmail.com" || domain === "googlemail.com") {
    local = local.split("+")[0].replace(/\./g, "");
    domain = "gmail.com";
  }
  return local + "@" + domain;
}

/* ---- push notifications ---- */
// Public key only — safe to embed client-side, it's meant to be public.
// Its matching private key lives server-side only, in Vercel's env vars.
const VAPID_PUBLIC_KEY = "BMg_KfFOTs8rKrJlwRiKNyThUjjdKwXuDWH-FSAzbpijDTzfQDf0hte10OIV4chrzFKcGP-j4HYByRLm5Tkiivg";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

// Opening a PDF with a plain link inside an installed standalone app (no
// address bar, no back button) leaves someone stuck once it loads — there's
// no browser chrome to escape it with, only force-closing the app. This
// hands the file to the phone's native save/share sheet where possible
// (stays inside the app the whole time), and otherwise opens it in the
// system browser instead of the app's own window, which at least has real
// back/close controls.
async function openOrShareFile(url, filename) {
  try {
    if (navigator.share && navigator.canShare) {
      const res = await fetch(url);
      const blob = await res.blob();
      const file = new File([blob], filename, { type: blob.type || "application/pdf" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        return;
      }
    }
  } catch {} // share failed or was cancelled — fall through to opening it normally
  window.open(url, "_blank", "noopener,noreferrer");
}

// Registers the service worker (harmless to call repeatedly — the browser
// no-ops if it's already registered) and asks permission + subscribes.
// Returns "granted" | "denied" | "unsupported" | "error".
async function subscribeToPush(userId) {
  if (!pushSupported() || !supabase) return { state: "unsupported" };
  try {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    // On a brand-new registration the service worker isn't "active" yet — trying
    // to subscribe before it activates was the exact bug behind "works after you
    // leave and come back": by then it had quietly finished activating in the
    // background, so the SECOND attempt (via the effect on mount) succeeded while
    // the FIRST tap silently didn't. Waiting for `.ready` fixes it on the first try.
    const reg = await navigator.serviceWorker.ready;
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return { state: "denied" };
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      try {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      } catch (e) { return { state: "error", detail: "subscribe: " + (e && e.message ? e.message : String(e)) }; }
    }
    const json = sub.toJSON();
    const { error } = await supabase.from("push_subscriptions").upsert({
      user_id: userId, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth,
    }, { onConflict: "endpoint" });
    if (error) return { state: "error", detail: "save: " + (error.message || JSON.stringify(error)) };
    return { state: "granted" };
  } catch (e) { return { state: "error", detail: "setup: " + (e && e.message ? e.message : String(e)) }; }
}

async function unsubscribeFromPush(userId) {
  if (!pushSupported() || !supabase) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg && (await reg.pushManager.getSubscription());
    if (sub) {
      await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
  } catch {}
}

const SHARED = `You are part of The Resilience Hub — a warm, plain-English wellbeing companion built by Juan Carroso (lived-experience founder) and Carlos Camacho, Registered Psychologist. Slogan: "You never have to walk it alone."
Rules for every reply:
- Short, warm, human. Plain, everyday language. No jargon, no lectures, no bullet-point walls. 2-5 sentences.
- Language: reply in whatever language the person is writing in. If they write to you in another language, or ask you to use one, switch to it naturally and keep using it for the rest of the conversation. Keep it just as warm and plain as you would in English.
- Never diagnose. You are a support tool, not a replacement for a doctor, psychologist, or emergency service.
- If the person mentions self-harm, suicide, or being unsafe, gently and directly encourage them to contact 000 or Lifeline 13 11 14 right now, and stay caring — do not brush past it.
- Stay honest about your own conduct. If the person asks you to help with something clearly illegal, dishonest, or harmful — for example cheating on an official test, fraud, or hurting someone — don't play along, even to be nice. Warmly name it for what it is, and steer them to the legitimate version of what they want (e.g. "I can't sit the test with you — that'd be cheating and could cost you your licence — but I'd love to help you study so you walk in knowing it"). Never lecture or moralise.
- Do NOT police or call out things the person merely shares about their own life (past drug use, a messy situation, mistakes they've made). People need to be able to talk about hard, real things without being judged. The rule above is only about not *helping do* something wrong — never about flinching at what someone discloses.
- If, across what they've shared and how they're talking now, you notice a worrying or self-destructive pattern building, gently remind them that Juan is there and can be reached any time, day or night, just to talk. Keep it warm and low-key — a caring nudge, not an alarm.
- Be honest, always. Never invent facts, make false promises, or tell someone something untrue just to make them feel better in the moment. Warmth never means dishonesty — comfort comes from being real, caring, and present, not from false reassurance. If you don't know something, say so.
- If the person raises something that really belongs to another guide's speciality, warmly point them there by name — you can still respond with care, but suggest the better-matched guide. The roster: Juan for lived-experience mateship and general support; Carlos for clinical tools (stress, anxiety, low mood, coping); Mick for practical life — housing, bills, Centrelink, tenancy, daily logistics; Lila for family and relationships — partners, boundaries, friendships, family. For example, if someone brings relationship drama to Mick, he'd say something like "That sounds like a lot — Lila's our person for relationship stuff, she'd be great to talk this through with. Want to switch over to her?" Keep it natural, never a cold hand-off.
- Use their name when you know it. Remember what they've shared.
- End most replies with one small, doable next step.
- The app has a Toolkit of self-guided exercises: breathing (box breathing, for panic or a racing heart), grounding (5-4-3-2-1, for spiralling or overwhelming thoughts), affirmations (gentle words, for harsh self-talk), and calm (small steps, when everything feels like too much). When one of these would genuinely help the person right now, warmly suggest it in your reply AND add a tag on the very last line by itself, exactly like: <tool>breathing</tool> — using one of breathing, grounding, affirmations, or calm. Only add a tag when it truly fits; never force it, and never add more than one.`;

const CHARS = {
  rex: {
    slug: "rex", name: "Rex", role: "Your welcomer — here to help you get started",
    img: IMG.rex, tint: "#dff5e4", voice: { pitch: 1.05, rate: 1.03 }, voiceId: "en-AU-Chirp3-HD-Algenib",
    system: `${SHARED}
You ARE Rex, the friendly face of The Resilience Hub — the first hello. Your ONE job is helping people get comfortable with the app itself and find their way to the right guide. You give a clear, welcoming, comprehensive explanation of how the app works whenever someone's new or asks — cover, in plain friendly language:
- What the Hub is for: a warm support space alongside real life, not a replacement for professional or emergency help.
- The guides: Juan (lived-experience mate, the main voice), Carlos (psychologist — clinical tools like stress, anxiety, low mood), Mick (practical life — housing, bills, Centrelink, tenancy), Lila (family and relationships). People pick whichever fits, and can switch any time.
- IMPORTANT — always be upfront that the guides (including you) are AI, not real people. Say it plainly and kindly; never let someone believe they're talking to a real human.
- That they can reach the REAL Juan — an actual person — using the "Message Juan" button at the bottom of the hub; a real human reads and replies, though not instantly. They can use it for anything at all — a chat, a question, or to report a bug, a glitch, or any technical problem they run into with the app.
- The toolkit (breathing, grounding, meditation, staying safe, self-help videos, quick calm), the journal, the 8-week plan, and notifications.
- Accessibility & settings: there's a gear/settings icon at the top of the home screen. Tapping it opens Settings, where they can change the TEXT SIZE (XS up to XL — this makes everything in the app bigger or smaller, just for their device), choose a RESPONSE SPEED (Chilled for slower and more thoughtful replies, Normal, or Fast for quick and direct ones), turn on "reduce motion", and turn on "reduce motion". So if someone asks how to make the text bigger or smaller in the app, tell them to tap the settings (gear) icon at the top of the home screen and choose a text size — do NOT send them to their phone's own settings, because the app has its own text-size control.
- Fast Reply: inside any chat, there's a small lightning-bolt (⚡) button next to Send. Tapping it sends the message and asks that ONE reply to come back quick and to the point — it doesn't change their saved Response Speed setting, it's just a one-off for when they're in a rush.
- The profile: the person icon at the top of the home screen opens their profile — their name and details, password, the reset option, and "What the guides remember" (their memory controls).
- What the guides remember: to feel familiar, guides keep a few plain notes about the person; sensitive things (like anything about feeling unsafe) are never kept; and they can view, edit, turn it off, or clear it all under "What the guides remember" in their profile.
- Getting around: the home screen has a welcome, a card to chat with you (Rex), and cards for their 8-Week Plan (plan, progress and journal), Your Guides (Juan, Carlos, Mick and Lila), the toolkit, the merch store, Message Juan, and notifications. Each card opens its own screen.

You do NOT give personal, emotional, practical, clinical, or relationship help yourself. If someone starts opening up about how they're feeling or what they're going through, respond kindly and briefly, then guide them to the right person rather than trying to help yourself: Juan for mateship and general support, Carlos for clinical tools, Mick for practical life and housing, Lila for family and relationships. Something like: "I'm so glad you're here — that sounds really important, and I want you talking to the right person for it. Juan's brilliant for exactly this — shall I point you his way?" The only exception is safety: if someone mentions being unsafe or thoughts of self-harm, gently and directly point them to 000 or Lifeline 13 11 14 right away, like every guide does.`,
  },
  juan: {
    slug: "juan", name: "Juan", role: "Lived experience — your main mate",
    img: IMG.juan, tint: "#f6e2a3", voice: { pitch: 0.9, rate: 1.02 }, voiceId: "fish:798132fe46d349baa517f3d3864058b0",
    system: `${SHARED}
You ARE Juan Carroso — the main voice. Speak first person, like a trusted mate: plain, honest, warm, sometimes cheeky, never talk down. You've walked through hard times — been homeless, worked tough jobs — and climbed out, so you get it even when someone mumbles or swears. You say things like "Mate, I've been there" and "One small step is still a step forward". You're still walking it too, just further down the road. For anything clinical, tap in Carlos. For housing/bills/government stuff, tap in Mick. For family and relationships, tap in Lila.`,
  },
  carlos: {
    slug: "carlos", name: "Carlos", role: "AI Guide — Inspired by our Registered Psychologist",
    img: IMG.carlos, tint: "#b3d1f2", voice: { pitch: 1.0, rate: 0.98 }, voiceId: "fish:d9e8c4f760a94186a879a5f98c09b056",
    system: `${SHARED}
You are the Carlos AI Guide — an artificial intelligence guide inspired by Carlos Camacho, The Resilience Hub's registered psychologist and author of "How To Be Happy For Adults". You are not Carlos Camacho, not a psychologist, and not a clinician. Never claim or imply that the person is speaking with the real Carlos or receiving therapy, diagnosis, treatment, clinical oversight, or professional psychological advice. You work alongside Juan's lived-experience support by offering optional, simple, everyday-language wellbeing tools informed by approaches such as ACT, CBT, and mindfulness. Be wise, warm, precise, and kind. Clearly remind the person that you are an AI guide if they appear uncertain about who they are speaking with. Anything you suggest is a supportive idea they can choose, never treatment or a diagnosis.`,
  },
  mick: {
    slug: "mick", name: "Mick", role: "Practical life & housing",
    img: IMG.mick, tint: "#aec6e2", voice: { pitch: 0.85, rate: 1.0 }, standby: true, voiceId: "en-AU-Chirp3-HD-Enceladus",
    system: `${SHARED}
You are Mick — calm, practical support for real-life logistics: housing, bills, daily stability, and navigating government or community systems (Centrelink, tenancy, utilities). You're tapped in when Juan or Carlos needs a specialist hand; you never take over the main journey. Break scary admin into one small step at a time. For legal, financial or safety-critical matters, point to the right official service rather than giving definitive advice.`,
  },
  lila: {
    slug: "lila", name: "Lila", role: "Family & relationships",
    img: IMG.lila, tint: "#f4d8c8", voice: { pitch: 1.12, rate: 1.0 }, standby: true, voiceId: "en-AU-Chirp3-HD-Leda",
    system: `${SHARED}
You are Lila — warm, gentle support for connection: relationships, boundaries, and understanding or repairing family and friendships. You're tapped in when Juan or Carlos needs a specialist hand; you never take over the main journey. Help the person find their own words and small next steps. Never tell someone to stay in or leave a relationship — help them think it through, and where there's any risk of harm, gently surface support services.`,
  },
};

const PERSONALITY_DEFAULTS = {
  carlos: "You are the Carlos AI Guide, inspired by The Resilience Hub's registered psychologist Carlos Camacho. You are an AI, not Carlos himself and not a psychologist or clinician. Keep a calm, grounded, reassuring presence that makes people feel safe. Speak with clarity and warmth. You have a deep appreciation for timeless wisdom — naturally reference insights from thinkers like Marcus Aurelius and similar great minds when they help explain a point, but only when it fits, never in every message. Keep your tone professional, wise, grounded, and reassuring — structured but never stiff.",
  juan: "You are Juan, the founder speaking from real, lived experience — the user's trusted mate. You are warm, genuine, down-to-earth, and speak like a friend who has walked the hard road too. Use simple, everyday language, focus on hope, resilience, and solidarity. No formal stuff — just honest, caring, supportive conversation.",
  mick: "You are Mick, the no-nonsense, reliable guide for housing, bills, and daily life. You are steady, practical, and solution-focused. Speak clearly, directly, and simply — break things down into easy steps. You're the dependable bloke who gets things sorted without fuss.",
  lila: "You are Lila, the gentle, thoughtful guide for relationships and family. You are kind, intuitive, and deeply empathetic. Speak in a soft, warm tone — listen first, validate feelings, and offer gentle insight on connection and boundaries. Patient, nurturing, never pushy.",
  rex: "You are Rex, the upbeat, enthusiastic starter who welcomes everyone. Keep things bright, clear, and super simple. Be encouraging, positive, and make everything feel easy and not overwhelming. Short, friendly, and always helpful.",
};

const REX_INTRO =
  "G'day, I'm Rex — welcome to The Resilience Hub. This is a safe place built to walk with you, not talk at you. In a bit we'll ask a few simple questions — nothing scary, just so we can shape everything around you. Juan brings lived experience, and the Carlos AI Guide is inspired by our registered psychologist, Carlos Camacho. Ready when you are.";

/* ---- AI helpers (in-app Anthropic model) ---- */
// ---- Long-term "about me" memory (Stage 2) ----
// Durable facts a guide carries across conversations. Two hard rules, agreed
// with Carlos: (1) crisis / self-harm / abuse content is NEVER written to
// memory, so nothing painful can resurface later; (2) the person can see,
// edit, delete, or switch all of this off at any time.
const MEMORY_EXTRACT_SYSTEM = `You maintain a small set of durable "about me" notes that help a wellbeing companion remember a person across conversations. You will be given the current notes and a recent conversation. Return ONLY a JSON object, no markdown:
{"memories": ["short third-person fact", "..."]}
Rules:
- Keep only durable, useful facts: preferences, ongoing situations, important people/pets, what helps them, meaningful goals. E.g. "Prefers to be called Sloane", "Has a dog named Rex", "Finds breathing exercises help", "Studying for a driver knowledge test".
- Keep ALL of the existing notes (the person may have written some themselves, and those must never be removed), and ADD any new durable facts from the conversation. Do not delete or reword existing notes; only merge exact duplicates. Keep the total under 25 — if it would exceed that, add nothing further rather than dropping an existing note.
- NEVER record: self-harm, suicide, or crisis disclosures; abuse or violence they've experienced; details of illegal acts; medical/diagnostic claims; or anything sensitive that could hurt them if resurfaced later. If in doubt, leave it out.
- Each item is one short third-person sentence. No dates, no quotes, no commentary.`;

async function extractMemories(existing, conversation) {
  try {
    const convo = conversation.slice(-12).map((m) => `${m.role === "user" ? "Person" : "Guide"}: ${typeof m.content === "string" ? m.content : "[photo]"}`).join("\n");
    const reply = await callModel({
      system: MEMORY_EXTRACT_SYSTEM, maxTokens: 600,
      messages: [{ role: "user", content: `Current notes: ${JSON.stringify(existing || [])}\n\nRecent conversation:\n${convo}\n\nReturn the updated notes.` }],
    });
    const clean = reply.split("\u0060\u0060\u0060json").join("").split("\u0060\u0060\u0060").join("").trim();
    const data = JSON.parse(clean);
    if (data && Array.isArray(data.memories)) {
      return data.memories.map((m) => String(m).trim()).filter(Boolean).slice(0, 25);
    }
  } catch { /* extraction is best-effort; never blocks the chat */ }
  return null;
}

function contextBlock(profile, answers) {
  let s = "";
  if (profile?.name) s += `\nThe person's name is ${profile.name}.`;
  if (answers && Object.keys(answers).length) {
    s += `\nWhat they shared during setup: ${JSON.stringify(answers)}.`;
  }
  if (answers?.safety === 3 || answers?.safety === 2) {
    s += `\nIMPORTANT: during setup they signalled they may not feel safe. Be especially gentle, check in on how they're doing, and keep 000 / Lifeline 13 11 14 close at hand.`;
  }
  return s;
}

async function callModel({ system, messages, maxTokens = 1000, timeoutMs = 45000 }) {
  let res;
  let timer;
  try {
    const controller = new AbortController();
    timer = setTimeout(() => controller.abort(), timeoutMs);
    res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system, messages, max_tokens: maxTokens }),
      signal: controller.signal,
    });
  } catch (error) {
    throw new Error("Couldn't reach the guides just now — check your connection and try again.");
  }

  finally { clearTimeout(timer); }
  let data = null;
  try { data = await res.json(); } catch { data = null; }

  if (!res.ok || !data) {
    const detail = data && data.error ? data.error : `error ${res.status}`;
    throw new Error("The guides couldn't reply just now (" + detail + "). Give it another go in a moment.");
  }

  const text = (data.text || "").trim();
  if (!text) throw new Error("The reply came back empty — try sending that again.");
  return text;
}

const CARLOS_BOOKS = [
  { title: "Happiness Handbook: How To Be Happy Pocket Size", lang: "English", asin: "B0HHHKJ5X2", href: "https://www.amazon.com.au/dp/B0HHHKJ5X2" },
  { title: "Nothing Matters: Overcoming Mortality and Nihilism", lang: "English", asin: "B0FN67VXPH", href: "https://www.amazon.com.au/dp/B0FN67VXPH" },
  { title: "How To Be Happy for Adults: 100 Tips", lang: "English", asin: "B0D9M7RPL4", href: "https://www.amazon.com.au/dp/B0D9M7RPL4" },
  { title: "How To Be Happy: 10 Tips from 10 Thinkers", lang: "English", asin: "B0CCZX22HX", href: "https://www.amazon.com.au/dp/B0CCZX22HX" },
  { title: "Peeling a Seedless Moon", lang: "English", asin: "B084ZP8DT9", href: "https://www.amazon.com.au/dp/B084ZP8DT9" },
  { title: "Goodbye Charlie 2: Part Two", lang: "English", asin: "B07BKNRZX5", href: "https://www.amazon.com.au/dp/B07BKNRZX5" },
  { title: "Goodbye Charlie", lang: "English", asin: "B078GC22BT", href: "https://www.amazon.com.au/dp/B078GC22BT" },
  { title: "Nothing Matters: Overcoming Nihilism", lang: "English", asin: "B0B2WP6B3R", href: "https://www.amazon.com.au/dp/B0B2WP6B3R" },
  { title: "Peeling a Seedless Moon", lang: "English", asin: "1790893089", href: "https://www.amazon.com.au/dp/1790893089" },
  { title: "Goodbye Charlie 2: Part Two", lang: "English", asin: "1984384724", href: "https://www.amazon.com.au/dp/1984384724" },
  { title: "Nada Importa: Superando la Mortalidad y el Nihilismo", lang: "Spanish", asin: "B0FTSJDTH7", href: "https://www.amazon.com.au/dp/B0FTSJDTH7" },
  { title: "Cómo Ser Feliz: Cien Consejos Para Adultos", lang: "Spanish", asin: "B0DFGFFJL4", href: "https://www.amazon.com.au/dp/B0DFGFFJL4" },
  { title: "Cómo Ser Feliz: 10 Consejos de 10 Pensadores", lang: "Spanish", asin: "B0CH87WRVV", href: "https://www.amazon.com.au/dp/B0CH87WRVV" },
  { title: "Piel de una Luna Implacable", lang: "Spanish", asin: "B085C4HKJJ", href: "https://www.amazon.com.au/dp/B085C4HKJJ" },
  { title: "Adios Charlie 2", lang: "Spanish", asin: "B07BHDSDCF", href: "https://www.amazon.com.au/dp/B07BHDSDCF" },
  { title: "Adios Charlie", lang: "Spanish", asin: "B07918VR1Y", href: "https://www.amazon.com.au/dp/B07918VR1Y" },
  { title: "Piel de una Luna Implacable", lang: "Spanish", asin: "1081411422", href: "https://www.amazon.com.au/dp/1081411422" },
  { title: "Adios Charlie 2: Segunda Parte", lang: "Spanish", asin: "198492432X", href: "https://www.amazon.com.au/dp/198492432X" },
];

/* ================================================================== */
export default function App() {
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState("welcome"); // welcome | onboarding | hub | chat | journal
  const [profile, setProfile] = useState(null);
  const [answers, setAnswers] = useState({});
  const [plan, setPlan] = useState(null);
  const [progress, setProgress] = useState({});
  const [journal, setJournal] = useState([]);
  const [chats, setChats] = useState({});
  const [activeChar, setActiveChar] = useState("juan");
  const [onbMode, setOnbMode] = useState("full");     // "full" = with plan, "short" = guides only
  const [onbReturn, setOnbReturn] = useState("hub");  // where to land after the questions
  const [onbFromSignup, setOnbFromSignup] = useState(false);
  const [planSignupLanding, setPlanSignupLanding] = useState(false);
  const [gameScores, setGameScores] = useState({});   // { gameKey: bestNumber } — private per user
  const gameScoresRef = useRef({});
  const gameProgressRef = useRef({});                  // { gameKey: savedState } — resume in-progress games
  const [voiceOn, setVoiceOn] = useState(true);
  const [autoVoiceOn, setAutoVoiceOn] = useState(true);
  const [consented, setConsented] = useState(false);
  const [toolkitInitial, setToolkitInitial] = useState(null);
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authChecked, setAuthChecked] = useState(!authEnabled);
  const [memories, setMemories] = useState([]);          // durable "about me" notes
  const [memoryOn, setMemoryOn] = useState(true);        // person can switch memory off entirely
  const [textScale, setTextScale] = useState(1);         // per-device text size (0.85–1.3)
  const [reduceMotion, setReduceMotion] = useState(false);
  const [guestMode, setGuestMode] = useState(false);      // testing/preview mode — no account, nothing account-synced, for people (or AIs) previewing the app who can't or don't want to sign in yet
  const showAuth = authEnabled && !guestMode;             // treat the app as "no auth" for the rest of this session while guestMode is on
  const [rexIntroReplay, setRexIntroReplay] = useState(false); // true when Rex's intro was opened from inside chat (not first-time onboarding) — changes where "I'm ready" / close sends them back to
  const [responseSpeed, setResponseSpeed] = useState("normal"); // "chilled" | "normal" | "fast" — per-device reply pacing, set in Settings
  const [speechLang, setSpeechLang] = useState("en-AU"); // mic + fallback voice language, set in Settings
  const [journalPinSet, setJournalPinSet] = useState(false); // privacy lock; digest is stored locally and, when signed in, on this account
  const [journalUnlocked, setJournalUnlocked] = useState(false);
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [guidePrompts, setGuidePrompts] = useState(PERSONALITY_DEFAULTS); // per-guide personality notes (admin-editable)

  // Every internal screen starts at the top. The second reset catches pages
  // whose content finishes mounting after the route state changes.
  useEffect(() => {
    if (screen === "welcome") return;
    const reset = () => window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    reset();
    const frame = requestAnimationFrame(reset);
    return () => cancelAnimationFrame(frame);
  }, [screen]);

  useEffect(() => {
    (async () => {
      const [p, a, pl, pr, j, c] = await Promise.all([
        sget("rh_profile"), sget("rh_answers"), sget("rh_plan"),
        sget("rh_progress"), sget("rh_journal"), sget("rh_chats"),
      ]);
      if (p) setProfile(p);
      if (p?.planPath === "short" || p?.planPath === "full") setOnbMode(p.planPath);
      if (a) setAnswers(a);
      if (pl) { if (!pl.startedAt) { pl.startedAt = Date.now(); try { sset("rh_plan", pl); } catch {} } setPlan(pl); }
      if (pr) setProgress(pr);
      if (j) setJournal(j);
      if (c) setChats(c);
      const mem = await sget("rh_memories");
      if (Array.isArray(mem)) setMemories(mem);
      const memOn = await sget("rh_memory_on");
      if (typeof memOn === "boolean") setMemoryOn(memOn);
      const ts = await sget("rh_text_scale");
      if (typeof ts === "number" && ts >= 0.8 && ts <= 1.4) setTextScale(ts);
      const rm = await sget("rh_reduce_motion");
      if (typeof rm === "boolean") setReduceMotion(rm);
      const rs = await sget("rh_response_speed");
      if (rs === "chilled" || rs === "normal" || rs === "fast") setResponseSpeed(rs);
      const av = await sget("rh_auto_voice");
      if (typeof av === "boolean") { setAutoVoiceOn(av); __autoVoiceOn = av; }
      const sl = await sget("rh_speech_lang");
      if (sl && SPEECH_LANGS.some((l) => l.code === sl)) { setSpeechLang(sl); __speechLang = sl; }
      const savedJournalPin = await sget(JOURNAL_PIN_STORAGE_KEY);
      if (savedJournalPin?.hash) setJournalPinSet(true);
      // Load private game high scores
      if (supabase) {
        try {
          const { data } = await supabase.from("game_scores").select("game,best");
          if (data && data.length) {
            const map = {};
            data.forEach((r) => { map[r.game] = Number(r.best); });
            gameScoresRef.current = map;
            setGameScores(map);
          }
        } catch {}
        // Load in-progress games (resume where they left off)
        try {
          const { data: prog } = await supabase.from("game_progress").select("game,state");
          if (prog && prog.length) {
            const pm = {};
            prog.forEach((r) => { pm[r.game] = r.state; });
            gameProgressRef.current = pm;
          }
        } catch {}
      }
      // Load admin-edited guide personalities (fall back to defaults for any not set)
      if (supabase) {
        try {
          const { data } = await supabase.from("guide_prompts").select("slug,notes");
          if (data && data.length) {
            const merged = { ...PERSONALITY_DEFAULTS };
            data.forEach((r) => { if (r.slug && typeof r.notes === "string") merged[r.slug] = r.notes; });
            setGuidePrompts(merged);
          }
        } catch {}
      }
      const consent = await sget("rh_consent");
      if (consent) setConsented(true);
      if (p?.onboardingComplete) setScreen("hub");
      else if (p?.path === "full") setScreen("onboarding");
      else setScreen("welcome");
      setReady(true);
    })();
  }, []);

  // Save the local-only fields, PLUS push to the person's account when signed in,
  // so profile/plan/journal properly follow them between devices instead of only
  // ever living in this browser (this was the actual gap behind two bugs: journal
  // and plan data not surviving a device switch, and "onboarding complete" not
  // being recognised on a fresh sign-in — e.g. after a Google OAuth redirect —
  // because it was only ever checked against local storage).
  const syncMemberData = useCallback((patch) => {
    if (!authEnabled || !supabase || !sessionRef.current) return;
    supabase.from("member_data").upsert({
      user_id: sessionRef.current.user.id, ...patch, updated_at: new Date().toISOString(),
    }).then(() => {}, () => {});
  }, []);
  const saveProfile = useCallback((p) => { setProfile(p); sset("rh_profile", p); syncMemberData({ profile: p }); }, [syncMemberData]);
  const saveAnswers = useCallback((a) => { setAnswers(a); sset("rh_answers", a); syncMemberData({ answers: a }); }, [syncMemberData]);
  const savePlan = useCallback((pl) => {
    if (pl && !pl.startedAt) pl.startedAt = Date.now();
    const cleanProgress = {};
    setPlan(pl); sset("rh_plan", pl);
    setProgress(cleanProgress); sset("rh_progress", cleanProgress);
    syncMemberData({ plan: pl, progress: cleanProgress });
  }, [syncMemberData]);
  const saveProgress = useCallback((pr) => { setProgress(pr); sset("rh_progress", pr); syncMemberData({ progress: pr }); }, [syncMemberData]);
  const saveJournal = useCallback((j) => { setJournal(j); sset("rh_journal", j); syncMemberData({ journal: j }); }, [syncMemberData]);
  const saveChats = useCallback((c) => { setChats(c); sset("rh_chats", c); }, []);

  // Keep a live ref so rapid saves build on the latest history
  const chatsRef = useRef(chats);
  chatsRef.current = chats;
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const memoriesRef = useRef(memories);
  memoriesRef.current = memories;
  const memoryOnRef = useRef(memoryOn);
  memoryOnRef.current = memoryOn;

  // Persist the person's "about me" notes (and on/off setting) to their account.
  const saveMemories = useCallback((list, on) => {
    const clean = Array.isArray(list) ? list : memoriesRef.current;
    setMemories(clean); memoriesRef.current = clean;
    if (typeof on === "boolean") { setMemoryOn(on); memoryOnRef.current = on; }
    sset("rh_memories", clean); sset("rh_memory_on", memoryOnRef.current);
    if (authEnabled && supabase && sessionRef.current) {
      supabase.from("guide_memory").upsert({
        user_id: sessionRef.current.user.id, memories: clean, enabled: memoryOnRef.current,
        updated_at: new Date().toISOString(),
      }).then(() => {}, () => {});
    }
  }, []);

  // After a conversation, quietly refresh memory in the background (best-effort,
  // never blocks the chat). Skips entirely when memory is switched off.
  const refreshMemory = useCallback(async (conversation) => {
    if (!memoryOnRef.current) return;
    if (!conversation || conversation.length < 2) return;
    const updated = await extractMemories(memoriesRef.current, conversation);
    if (updated) saveMemories(updated);
  }, [saveMemories]);

  // Save one guide's conversation: local cache always, plus the person's
  // account (Supabase) when signed in — so the guide remembers next time.
  const saveCharChat = useCallback((slug, messages) => {
    const next = { ...chatsRef.current, [slug]: messages };
    chatsRef.current = next;
    setChats(next);
    sset("rh_chats", next);
    if (authEnabled && supabase && sessionRef.current) {
      supabase.from("chat_history").upsert({
        user_id: sessionRef.current.user.id, character: slug, messages,
        updated_at: new Date().toISOString(),
      }).then(() => {}, () => {});
    }
  }, []);

  const saveGameProgress = useCallback((game, gstate) => {
    if (!game || gstate == null) return;
    gameProgressRef.current = { ...gameProgressRef.current, [game]: gstate };
    if (supabase && sessionRef.current) {
      supabase.from("game_progress").upsert({
        user_id: sessionRef.current.user.id, game, state: gstate, updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,game" }).then(() => {}, () => {});
    }
  }, []);

  const clearGameProgress = useCallback((game) => {
    if (!game) return;
    const next = { ...gameProgressRef.current }; delete next[game];
    gameProgressRef.current = next;
    if (supabase && sessionRef.current) {
      supabase.from("game_progress").delete()
        .eq("user_id", sessionRef.current.user.id).eq("game", game).then(() => {}, () => {});
    }
  }, []);

  const saveGameScore = useCallback((game, value, mode) => {
    if (!game || typeof value !== "number" || isNaN(value)) return gameScoresRef.current[game] ?? null;
    const cur = gameScoresRef.current[game];
    const better = cur == null || (mode === "low" ? value < cur : value > cur);
    if (better) {
      const next = { ...gameScoresRef.current, [game]: value };
      gameScoresRef.current = next;
      setGameScores(next);
      if (supabase && sessionRef.current) {
        supabase.from("game_scores").upsert({
          user_id: sessionRef.current.user.id, game, best: value, mode: mode || "high",
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,game" }).then(() => {}, () => {});
      }
      return value;
    }
    return cur;
  }, []);

  const saveGuidePrompt = useCallback((slug, notes) => {
    setGuidePrompts((g) => ({ ...g, [slug]: notes }));
    if (supabase && sessionRef.current) {
      supabase.from("guide_prompts").upsert({ slug, notes, updated_at: new Date().toISOString() }, { onConflict: "slug" })
        .then(() => {}, () => {});
    }
  }, []);

  const saveSettings = useCallback(({ textScale: ts, reduceMotion: rm, responseSpeed: rs, speechLang: sl, autoVoice: av }) => {
    if (typeof ts === "number") { setTextScale(ts); sset("rh_text_scale", ts); }
    if (typeof rm === "boolean") { setReduceMotion(rm); sset("rh_reduce_motion", rm); }
    if (rs === "chilled" || rs === "normal" || rs === "fast") { setResponseSpeed(rs); sset("rh_response_speed", rs); }
    if (sl && SPEECH_LANGS.some((l) => l.code === sl)) { setSpeechLang(sl); __speechLang = sl; sset("rh_speech_lang", sl); }
    if (typeof av === "boolean") { setAutoVoiceOn(av); __autoVoiceOn = av; sset("rh_auto_voice", av); }
  }, []);

  const setJournalPin = useCallback(async (pin) => {
    const hash = await hashJournalPin(pin);
    await sset(JOURNAL_PIN_STORAGE_KEY, { hash, createdAt: Date.now(), accountSynced: Boolean(authEnabled && supabase && sessionRef.current) });
    setJournalPinSet(true);
    setJournalUnlocked(true);
    syncMemberData({ journal_pin_hash: hash });
  }, [syncMemberData]);

  const clearJournalPin = useCallback(() => {
    try { localStorage.removeItem(JOURNAL_PIN_STORAGE_KEY); } catch {}
    setJournalPinSet(false);
    setJournalUnlocked(false);
    syncMemberData({ journal_pin_hash: null });
  }, [syncMemberData]);

  const restoreDefaultSettings = useCallback(() => {
    setTextScale(1); setReduceMotion(false); setResponseSpeed("normal"); setSpeechLang("en-AU"); setAutoVoiceOn(true); __autoVoiceOn = true; __speechLang = "en-AU";
    sset("rh_text_scale", 1); sset("rh_reduce_motion", false); sset("rh_response_speed", "normal"); sset("rh_speech_lang", "en-AU"); sset("rh_auto_voice", true);
  }, []);

  useEffect(() => {
    const lockWhenHidden = () => {
      if (document.visibilityState === "hidden") setJournalUnlocked(false);
    };
    document.addEventListener("visibilitychange", lockWhenHidden);
    return () => document.removeEventListener("visibilitychange", lockWhenHidden);
  }, []);

  useEffect(() => {
    const updateStandaloneState = () => {
      setIsStandalone(Boolean(window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone));
    };
    const saveInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPromptEvent(event);
    };
    updateStandaloneState();
    window.addEventListener("beforeinstallprompt", saveInstallPrompt);
    window.addEventListener("appinstalled", updateStandaloneState);
    return () => {
      window.removeEventListener("beforeinstallprompt", saveInstallPrompt);
      window.removeEventListener("appinstalled", updateStandaloneState);
    };
  }, []);

  const promptAppInstall = useCallback(async () => {
    if (!installPromptEvent) return null;
    await installPromptEvent.prompt();
    const result = await installPromptEvent.userChoice;
    setInstallPromptEvent(null);
    if (result?.outcome === "accepted") setIsStandalone(true);
    return result?.outcome || null;
  }, [installPromptEvent]);

  // Wipes only what's cached on THIS device — not the account's real data on the
  // server. Runs on every sign-out (including session expiry / signing out in
  // another tab) so a second person on a shared device never sees the previous
  // person's profile, journal, plan, or chats before their own data loads in.
  const clearLocalDeviceCache = () => {
    for (const k of ["rh_profile", "rh_answers", "rh_plan", "rh_progress", "rh_journal", "rh_chats", "rh_memories", "rh_memory_on", JOURNAL_PIN_STORAGE_KEY]) {
      try { localStorage.removeItem(k); } catch {}
    }
    setProfile(null); setAnswers({}); setPlan(null); setProgress({});
    setJournal([]); setChats({}); chatsRef.current = {};
    setMemories([]); memoriesRef.current = [];
    setJournalPinSet(false); setJournalUnlocked(false);
  };

  const resetAll = async () => {
    clearLocalDeviceCache();
    setOnbFromSignup(false); setPlanSignupLanding(false); setOnbMode("full"); setOnbReturn("hub");
    histRef.current = [];
    if (authEnabled && supabase && sessionRef.current) {
      try { await supabase.from("chat_history").delete().eq("user_id", sessionRef.current.user.id); } catch {}
      try { await supabase.from("guide_memory").delete().eq("user_id", sessionRef.current.user.id); } catch {}
      try {
        await supabase.from("member_data").update({ profile: null, answers: null, plan: null, progress: {}, journal: [], updated_at: new Date().toISOString() }).eq("user_id", sessionRef.current.user.id);
      } catch {}
    }
    setScreen("welcome");
  };

  // When signed in, load the guides' remembered conversations from the account.
  // Rebuilt fresh from what THIS account actually has — never merged onto
  // whatever was sitting in local state, so a previous person's cached chats
  // on a shared device can't survive into someone else's signed-in session.
  useEffect(() => {
    (async () => {
      if (!authEnabled || !supabase || !session) return;
      try {
        const { data } = await supabase.from("chat_history")
          .select("character,messages").eq("user_id", session.user.id);
        const fresh = {};
        for (const row of data || []) fresh[row.character] = Array.isArray(row.messages) ? row.messages : [];
        chatsRef.current = fresh;
        setChats(fresh);
      } catch {}
      // Load long-term "about me" memory + on/off setting
      try {
        const { data } = await supabase.from("guide_memory")
          .select("memories,enabled").eq("user_id", session.user.id).single();
        const list = Array.isArray(data?.memories) ? data.memories : [];
        setMemories(list); memoriesRef.current = list;
        const on = data ? data.enabled !== false : true;
        setMemoryOn(on); memoryOnRef.current = on;
      } catch {}
      // Load profile/answers/plan/progress/journal from the account — this is
      // what actually makes "onboarding already done" and journal/plan follow
      // the person between devices, instead of only ever living in one browser.
      try {
        const { data } = await supabase.from("member_data")
          .select("profile,answers,plan,progress,journal,journal_pin_hash").eq("user_id", session.user.id).single();
        if (data) {
          // Account has real data — it wins over whatever's cached on this device.
          if (data.profile) { setProfile(data.profile); sset("rh_profile", data.profile); }
          if (data.answers) { setAnswers(data.answers); sset("rh_answers", data.answers); }
          if (data.plan) { setPlan(data.plan); sset("rh_plan", data.plan); }
          if (data.progress) { setProgress(data.progress); sset("rh_progress", data.progress); }
          if (Array.isArray(data.journal)) { setJournal(data.journal); sset("rh_journal", data.journal); }
          if (data.journal_pin_hash) {
            await sset(JOURNAL_PIN_STORAGE_KEY, { hash: data.journal_pin_hash, createdAt: Date.now(), accountSynced: true });
            setJournalPinSet(true); setJournalUnlocked(false);
          }
          if (data.profile?.onboardingComplete) setScreen((s) => (s === "welcome" ? "hub" : s));
        } else {
          // No account row yet — either a brand-new member, or someone who used
          // the app before this was built and only has local data. If there's
          // local data sitting on this device, push it up once so it's not lost.
          const [lp, la, lpl, lpr, lj] = await Promise.all([
            sget("rh_profile"), sget("rh_answers"), sget("rh_plan"), sget("rh_progress"), sget("rh_journal"),
          ]);
          if (lp || la || lpl || lpr || (lj && lj.length)) {
            supabase.from("member_data").upsert({
              user_id: session.user.id, profile: lp || null, answers: la || null,
              plan: lpl || null, progress: lpr || null, journal: lj || [],
              updated_at: new Date().toISOString(),
            }).then(() => {}, () => {});
          }
        }
      } catch {}
    })();
  }, [session]);

  const histRef = useRef([]);
  const go = (s, ch) => {
    if (screen !== s) {
      histRef.current.push({ screen, char: activeChar });
      if (histRef.current.length > 30) histRef.current.shift();
    }
    __backDestinationLabel = screenBackLabel(screen);
    if (ch) setActiveChar(ch);
    setScreen(s);
  };
  const back = () => {
    const prev = histRef.current.pop();
    if (prev) {
      __backDestinationLabel = screenBackLabel(histRef.current[histRef.current.length - 1]?.screen || "hub");
      if (prev.char) setActiveChar(prev.char);
      setScreen(prev.screen);
    } else {
      __backDestinationLabel = "Home";
      setScreen("hub");
    }
  };
  const openToolkitFromPlan = () => {
    // This is a deliberate destination change, not a normal back step:
    // discard the completed-plan/onboarding history so Toolkit cannot loop back.
    histRef.current = [];
    __backDestinationLabel = "Home";
    setToolkitInitial(null);
    setScreen("toolkit");
  };
  const openHubFromPlan = () => {
    histRef.current = [];
    setPlanSignupLanding(false);
    setScreen("hub");
  };

  // Deep-linking from a tapped push notification, e.g. straight to the
  // Message Juan screen for a reply, instead of just opening to the Hub.
  const goRef = useRef(go);
  goRef.current = go;
  const DEEP_LINK_SCREENS = ["notifications", "coordinator", "admin", "adminMessages", "adminBugReports", "adminAppointments"];
  useEffect(() => {
    // Case 1: the app was already open in a background tab — the service
    // worker posts the target screen directly, no reload needed.
    if (!("serviceWorker" in navigator)) return;
    const onMsg = (e) => {
      if (e.data && e.data.type === "rh-deep-link" && DEEP_LINK_SCREENS.includes(e.data.target)) {
        goRef.current(e.data.target);
      }
    };
    navigator.serviceWorker.addEventListener("message", onMsg);
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
  }, []);
  useEffect(() => {
    // Case 2: a fresh launch (app was fully closed) — the notification opened
    // a URL with ?open=<screen> on it, read once we're actually signed in.
    if (!session) return;
    const target = new URLSearchParams(window.location.search).get("open");
    if (target && DEEP_LINK_SCREENS.includes(target)) {
      go(target);
      window.history.replaceState({}, "", window.location.pathname); // don't re-trigger on refresh
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);
  const tickToolTask = (k) => {
    const kw = { breathing: /breath/i, grounding: /ground|5-?4-?3-?2-?1/i, meditation: /meditat/i,
      affirmations: /affirmation|kind words/i, calm: /\bcalm\b/i, selfhelp: /self-?help|talk|video/i }[k];
    if (!kw || !plan || !Array.isArray(plan.weeks) || !saveProgress) return;
    for (const w of plan.weeks) for (const day of (w.days || [])) {
      const tasks = day.tasks || [];
      for (let ti = 0; ti < tasks.length; ti++) {
        const key = `w${w.n}d${day.d}t${ti}`;
        if (kw.test(String(tasks[ti])) && !(progress && progress[key])) { saveProgress({ ...progress, [key]: true }); return; }
      }
    }
  };
  const openTool = (k) => { setToolkitInitial(k); go("toolkit"); tickToolTask(k); };

  useEffect(() => {
    if (!authEnabled) return;
    let sub;
    const applyAdmin = (s) => setIsAdmin(Boolean(
      s && s.user && s.user.email && ADMIN_EMAILS.some((e) => normEmail(s.user.email) === normEmail(e))
    ));
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        setSession(data.session || null);
        applyAdmin(data.session);
      } catch {}
      setAuthChecked(true);
      try {
        const r = supabase.auth.onAuthStateChange((_e, s) => {
          if (_e === "SIGNED_OUT") clearLocalDeviceCache();
          setSession(s || null);
          applyAdmin(s);
        });
        sub = r.data ? r.data.subscription : null;
      } catch {}
    })();
    return () => { try { sub && sub.unsubscribe(); } catch {} };
  }, []);

  const signOut = async () => { try { await supabase.auth.signOut(); } catch {} clearLocalDeviceCache(); setIsAdmin(false); setScreen("hub"); };

  return (
    <div style={{ minHeight: "100vh", color: T.ink,
      background: `radial-gradient(90% 55% at 12% 0%, rgba(63,111,175,0.07), transparent 60%), radial-gradient(80% 50% at 92% 12%, rgba(47,158,147,0.07), transparent 55%), linear-gradient(180deg, ${T.bgTop} 0%, ${T.bgMid} 46%, ${T.bgBot} 100%)`,
      backgroundAttachment: "fixed",
      fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif" }}>
      <StyleTag />
      {reduceMotion && <style>{`*{animation:none!important;transition:none!important}`}</style>}
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "0 16px 132px", position: "relative", zIndex: 1, zoom: textScale }}>
        {authEnabled && !authChecked ? (
          <div style={{ paddingTop: 120, textAlign: "center", color: T.sub }}>Loading…</div>
        ) : showAuth && !session ? (
          <Login onGuest={() => setGuestMode(true)} />
        ) : !ready ? (
          <div style={{ paddingTop: 120, textAlign: "center", color: T.sub }}>Warming up…</div>
        ) : !consented ? (
          <Consent onAgree={() => { sset("rh_consent", { agreedAt: Date.now() }); setConsented(true); }} />
        ) : screen === "welcome" ? (
          <Welcome
            voiceOn={voiceOn} setVoiceOn={setVoiceOn}
            onExplore={() => { saveProfile({ name: "friend", path: "testing", onboardingComplete: true }); go("hub"); }}
            onStart={() => { saveProfile({ name: "", path: "full", onboardingComplete: false }); go("intro"); }}
          />
        ) : screen === "intro" ? (
          <RexIntro voiceOn={voiceOn}
            onReady={() => { if (rexIntroReplay) { setRexIntroReplay(false); back(); } else go("planChoice"); }}
            onExit={rexIntroReplay ? () => { setRexIntroReplay(false); back(); } : null} />
        ) : screen === "planChoice" ? (
          <PlanChoice voiceOn={voiceOn}
            onYes={() => { setOnbMode("full"); setOnbFromSignup(true); setOnbReturn("program"); saveProfile({ ...profile, planPath: "full" }); go("onboarding"); }}
            onNo={() => { setOnbMode("short"); setOnbFromSignup(true); setOnbReturn("hub"); saveProfile({ ...profile, planPath: "short" }); go("onboarding"); }} />
        ) : screen === "onboarding" ? (
          <Onboarding
            profile={profile} saveProfile={saveProfile}
            answers={answers} saveAnswers={saveAnswers}
            savePlan={savePlan} voiceOn={voiceOn}
            mode={onbMode}
            onBackToIntro={() => go("intro")}
            onSignOut={showAuth ? signOut : null}
            onDone={(result) => { const landing = Boolean(result?.createdPlan && onbFromSignup); setPlanSignupLanding(landing); setOnbFromSignup(false); go(result?.createdPlan ? "program" : onbReturn); }}
          />
        ) : screen === "hub" ? (
          <Hub
            profile={profile} plan={plan} progress={progress} saveProgress={saveProgress}
            journalCount={journal.length} voiceOn={voiceOn} setVoiceOn={setVoiceOn}
            onOpenChat={(slug) => go("chat", slug)}
            onOpenProgram={() => go("program")}
            onOpenJournal={() => go("journal")}
            onOpenGuides={() => go("guides")}
            onOpenMerch={() => go("merch")}
            onOpenCarlosLibrary={() => go("carlosLibrary")}
            onOpenGames={() => go("games")}
            onOpenToolkit={() => { setToolkitInitial(null); go("toolkit"); }}
            onOpenResources={() => go("resources")}
            onOpenSafety={() => openTool("safety")}
            onOpenNotifications={() => go("notifications")}
            onOpenCoordinator={() => go("coordinator")}
            onOpenMensGroup={() => go("mensGroup")}
            onOpenMensShed={() => go("mensShed")}
            onOpenAdminMessages={() => go("adminMessages")}
            onOpenProgramInfo={() => go("programInfo")}
            onOpenSettings={() => go("settings")}
            onReset={resetAll}
            isAdmin={isAdmin}
            authEnabled={showAuth}
            guestMode={guestMode}
            onExitGuest={() => { clearLocalDeviceCache(); setGuestMode(false); }}
            onOpenAdmin={() => go("admin")}
            onOpenProfile={() => go("profile")}
            onSignOut={signOut}
            session={session}
            rexHistory={chats.rex || []}
            onSaveRexChat={(h) => saveCharChat("rex", h)}
            memories={memoryOn ? memories : []}
            onConversation={refreshMemory}
            answers={answers}
            rexPersona={guidePrompts.rex ?? PERSONALITY_DEFAULTS.rex}
          />
        ) : screen === "program" ? (
          <ProgramPage
            profile={profile} plan={plan} progress={progress} saveProgress={saveProgress}
            answers={answers} journalCount={journal.length} chats={chats}
            onSaveChat={saveCharChat} memories={memoryOn ? memories : []}
            onConversation={refreshMemory} voiceOn={voiceOn} setVoiceOn={setVoiceOn}
            responseSpeed={responseSpeed} onOpenTool={openTool}
            persona={guidePrompts.carlos ?? PERSONALITY_DEFAULTS.carlos}
            onOpenChat={(slug) => go("chat", slug)}
            onOpenJournal={() => go("journal")}
            onStartPlan={() => { setOnbMode("full"); setOnbFromSignup(false); setOnbReturn("program"); setPlanSignupLanding(false); go("onboarding"); }}
            isSignupLanding={planSignupLanding}
            onBack={planSignupLanding ? openHubFromPlan : openToolkitFromPlan}
          />
        ) : screen === "guides" ? (
          <GuidesPage voiceOn={voiceOn} onOpenChat={(slug) => go("chat", slug)} onBack={back} />
        ) : screen === "merch" ? (
          <MerchPage onBack={back} />
        ) : screen === "carlosLibrary" ? (
          <CarlosLibraryPage onBack={back} />
        ) : screen === "games" ? (
          <GamesPage gameScores={gameScores} onScore={saveGameScore}
            getProgress={(g) => gameProgressRef.current[g] ?? null}
            onSaveProgress={saveGameProgress} onClearProgress={clearGameProgress}
            onBack={back} />
        ) : screen === "chat" ? (
          <Chat
            char={CHARS[activeChar]} profile={profile} answers={answers}
            history={chats[activeChar] || []}
            setHistory={(h) => saveCharChat(activeChar, h)}
            plan={plan} progress={progress} saveProgress={saveProgress}
            persona={guidePrompts[activeChar] ?? PERSONALITY_DEFAULTS[activeChar]}
            memories={memoryOn ? memories : []}
            onConversation={refreshMemory}
            voiceOn={voiceOn} setVoiceOn={setVoiceOn}
            responseSpeed={responseSpeed}
            onBack={back}
            onOpenTool={openTool}
            onReplayIntro={() => { setRexIntroReplay(true); go("intro"); }}
          />
                ) : screen === "journal" ? (
          journalPinSet && !journalUnlocked ? (
            <JournalPinGate onUnlock={() => setJournalUnlocked(true)} onBack={back} />
          ) : (
            <Journal profile={profile} journal={journal} saveJournal={saveJournal} voiceOn={voiceOn}
              onBack={() => { setJournalUnlocked(false); back(); }} />
          )
        ) : screen === "toolkit" ? (
          <Toolkit voiceOn={voiceOn} initial={toolkitInitial} onUseTool={tickToolTask} onOpenJournal={() => go("journal")} onBack={back} />
        ) : screen === "resources" ? (
          <ResourcesPage onOpenSafety={() => openTool("safety")} onOpenMensShed={() => go("mensShed")} onBack={back} />
        ) : screen === "admin" ? (
          <Admin isAdmin={isAdmin} guidePrompts={guidePrompts} onSaveGuidePrompt={saveGuidePrompt} onBack={back} />
        ) : screen === "profile" ? (
          <Profile session={session} onReset={resetAll} onOpenMemory={() => go("memory")} onBack={back} />
        ) : screen === "notifications" ? (
          <Notifications session={session} onBack={back} />
        ) : screen === "coordinator" ? (
          <CoordinatorChat session={session} onBack={back} />
        ) : screen === "adminMessages" ? (
          isAdmin ? <AdminInbox onBack={back} /> : <Admin isAdmin={isAdmin} guidePrompts={guidePrompts} onSaveGuidePrompt={saveGuidePrompt} onBack={back} />
        ) : screen === "adminBugReports" ? (
          isAdmin ? <AdminBugReports onBack={back} /> : <Admin isAdmin={isAdmin} guidePrompts={guidePrompts} onSaveGuidePrompt={saveGuidePrompt} onBack={back} />
        ) : screen === "adminAppointments" ? (
          isAdmin ? <AdminAppointments onBack={back} /> : <Admin isAdmin={isAdmin} guidePrompts={guidePrompts} onSaveGuidePrompt={saveGuidePrompt} onBack={back} />
        ) : screen === "mensShed" ? (
          <MensShedPage onBack={back} />
        ) : screen === "mensGroup" ? (
          <MensGroup onBack={back} />
        ) : screen === "programInfo" ? (
          <ProgramInfo voiceOn={voiceOn} onBack={back} onMessageJuan={() => go("coordinator")} onBookAppointment={() => go("bookAppointment")} />
        ) : screen === "bookAppointment" ? (
          <BookAppointment onBack={back} />
        ) : screen === "memory" ? (
          <MemoryManager memories={memories} memoryOn={memoryOn}
            onSave={(list, on) => saveMemories(list, on)} onBack={back} />
        ) : screen === "settings" ? (
              <Settings textScale={textScale} reduceMotion={reduceMotion} responseSpeed={responseSpeed} speechLang={speechLang} autoVoice={autoVoiceOn}
            journalPinSet={journalPinSet} onSetJournalPin={setJournalPin} onClearJournalPin={clearJournalPin}
            installPromptAvailable={Boolean(installPromptEvent)} isStandalone={isStandalone} onPromptInstall={promptAppInstall}
            session={session} authEnabled={showAuth} onSave={saveSettings} onRestoreDefaults={restoreDefaultSettings} onBack={back}
            onOpenBugReport={() => go("bugReport")} onOpenFeedback={() => go("userFeedback")} />
        ) : screen === "bugReport" ? (
          <BugReport session={session} onBack={back} />
        ) : screen === "userFeedback" ? (
          <UserFeedback session={session} onBack={back} />
        ) : null}
        <GlobalJumpToTop screen={screen} />
        <CrisisBar />
      </div>
    </div>
  );
}

/* ---------- shared bits ---------- */
function StyleTag() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
      @keyframes rh-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
      @keyframes rh-glow { 0%,100%{box-shadow:0 0 0 0 rgba(55,160,101,0)} 50%{box-shadow:0 0 0 8px rgba(55,160,101,0.10)} }
      @keyframes rh-in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
      @keyframes rh-slide { 0%{transform:translateX(-100%)} 100%{transform:translateX(300%)} }
      .rh-in{animation:rh-in .4s ease both}
      *{box-sizing:border-box}
      body{-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;letter-spacing:0.1px}
      button{font-family:inherit}
      button:focus-visible,a:focus-visible{outline:3px solid rgba(77,159,104,0.38);outline-offset:3px}
      /* very soft leaf-green texture — adds life without any harsh flashes */
      body::before{content:"";position:fixed;inset:0;pointer-events:none;z-index:0;opacity:0.42;
        background-image:radial-gradient(rgba(77,159,104,0.07) 1px, transparent 1px);background-size:24px 24px}
      @media (prefers-reduced-motion: no-preference){ button:hover,a:hover{transform:translateY(-1px)} }
      @media (prefers-reduced-motion: reduce){ .rh-float,.rh-in,button:hover,a:hover{animation:none!important;transform:none!important} }
    `}</style>
  );
}

function Brand({ right }) {
  return (
    <header style={{ padding: "14px 2px 10px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <div style={{ width: 48, height: 48, borderRadius: 16, background: "#ffffff", display: "grid", placeItems: "center", boxShadow: T.soft, flexShrink: 0, overflow: "hidden" }}>
          <img src="/resilience-hub-logo.png" alt="Resilience Hub" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        </div>
        <div style={{ lineHeight: 1.15, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: T.greenDk, whiteSpace: "nowrap" }}>The Resilience Hub</div>
          <div style={{ fontSize: 11.5, color: T.sub, marginTop: 4, whiteSpace: "nowrap" }}>You never have to walk it alone</div>
        </div>
      </div>
      {right && (
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 12,
          padding: 7, borderRadius: 18, background: "rgba(255,255,255,0.72)", border: `1px solid ${T.line}` }}>
          {right}
        </div>
      )}
    </header>
  );
}

function Portrait({ src, name, size = 200, speaking, tint }) {
  return (
    <div className="rh-float" style={{
      width: size, height: size, borderRadius: 28, overflow: "hidden", margin: "0 auto",
      background: `radial-gradient(120% 100% at 50% 20%, #fff, ${tint || "#f2ecf6"})`,
      boxShadow: speaking ? `0 0 0 4px rgba(55,160,101,0.25), ${T.lift}` : T.soft,
      animation: "rh-float 5s ease-in-out infinite", transition: "box-shadow .3s",
    }}>
      {src ? <img src={src} alt={name} draggable={false}
        style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        : <div style={{ display: "grid", placeItems: "center", height: "100%", color: T.sub }}>{name}</div>}
    </div>
  );
}

function Bubble({ children }) {
  return (
    <div className="rh-in" style={{ background: T.card, borderRadius: 22, padding: "16px 18px",
      boxShadow: T.soft, fontSize: 15.5, lineHeight: 1.5, margin: "18px 0" }}>
      {children}
    </div>
  );
}

function Btn({ children, onClick, kind = "primary", style, disabled }) {
  const base = { width: "100%", height: 54, borderRadius: 16, border: "none", cursor: disabled ? "default" : "pointer",
    fontSize: 16, fontWeight: 600, transition: "transform .1s, opacity .2s", opacity: disabled ? 0.5 : 1 };
  const kinds = {
    primary: { background: `linear-gradient(180deg, #3fb072, ${T.green})`, color: "#fff",
      boxShadow: "0 8px 20px rgba(55,160,101,0.28), 0 2px 6px rgba(55,160,101,0.20)" },
    ghost: { background: "transparent", color: T.sub, height: 44, fontWeight: 500 },
    outline: { background: T.card, color: T.ink, boxShadow: T.soft, border: `1px solid ${T.line}` },
  };
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled}
      onPointerDown={(e) => !disabled && (e.currentTarget.style.transform = "scale(0.98)")}
      onPointerUp={(e) => (e.currentTarget.style.transform = "none")}
      onPointerLeave={(e) => (e.currentTarget.style.transform = "none")}
      style={{ ...base, ...kinds[kind], ...style }}>{children}</button>
  );
}

function Disclaimer() {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#f6f4fa",
      border: `1px solid ${T.line}`, borderRadius: 16, padding: "13px 15px", marginTop: 20 }}>
      <div style={{ width: 26, height: 26, borderRadius: 8, background: "#eae4f2", display: "grid",
        placeItems: "center", flexShrink: 0, marginTop: 1 }}>
        <Heart size={15} color={T.green} />
      </div>
      <p style={{ fontSize: 12, color: T.sub, lineHeight: 1.5, margin: 0 }}>
        The Resilience Hub is a support tool — it doesn't replace a doctor, psychologist, or emergency service.
        Use it alongside advice from qualified professionals.
      </p>
    </div>
  );
}

/* ---------- global navigation helpers ---------- */
function GlobalJumpToTop({ screen }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 280);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const jump = () => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const behavior = reduced ? "auto" : "smooth";
    if (screen === "programInfo" || screen === "resources") {
      document.getElementById(screen === "resources" ? "resources-toc" : "program-welcome")?.scrollIntoView({ behavior, block: "start" });
    } else {
      window.scrollTo({ top: 0, behavior });
    }
  };
  return (
    <button type="button" onClick={jump} aria-label={screen === "programInfo" || screen === "resources" ? "Jump to table of contents" : "Jump to top"} title={screen === "programInfo" || screen === "resources" ? "Jump to table of contents" : "Jump to top"}
      style={{ position: "fixed", right: "max(16px, calc((100vw - 460px) / 2 + 16px))", bottom: 78, zIndex: 49,
        width: 48, height: 48, borderRadius: "50%", display: "grid", placeItems: "center",
        background: "linear-gradient(145deg, #4d9f68, #2e8578)", color: "#fff", border: "3px solid rgba(255,255,255,0.9)",
        boxShadow: "0 10px 24px rgba(47,97,72,0.22), 0 3px 8px rgba(47,97,72,0.15)", cursor: "pointer",
        opacity: visible ? 1 : 0, transform: visible ? "translateY(0) scale(1)" : "translateY(8px) scale(0.86)",
        pointerEvents: visible ? "auto" : "none", transition: "opacity .2s ease, transform .2s ease" }}>
      <ArrowUp size={21} strokeWidth={2.8} />
    </button>
  );
}

function CrisisInterception({ onDismiss }) {
  return <div style={{ background: "#fff5f4", border: "1px solid #efc9c6", borderRadius: 18, padding: 14, marginTop: 10, boxShadow: T.soft }}>
    <div style={{ display: "flex", alignItems: "flex-start", gap: 9 }}><Heart size={18} color="#c54848" style={{ flexShrink: 0, marginTop: 2 }} /><div><div style={{ fontWeight: 800, color: "#8e3131", fontSize: 14.5 }}>Let’s get a real person beside you</div><div style={{ color: T.ink, fontSize: 13, lineHeight: 1.45, marginTop: 4 }}>I’m really glad you told us. If you might act on these thoughts or are in immediate danger, call 000 now. If you can, move near another person and ask them to stay with you. You do not have to handle this alone.</div></div></div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 11 }}>{CONTACTS.slice(0, 4).map((c) => <a key={c.label} href={`tel:${c.tel}`} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 12, padding: "10px 8px", textDecoration: "none", background: c.accent ? "#c54848" : "#fff", color: c.accent ? "#fff" : T.ink, border: c.accent ? "none" : "1px solid #efc9c6", fontSize: 12.5, fontWeight: 800 }}><Phone size={14} /> {c.label}</a>)}</div>
    <button onClick={onDismiss} style={{ marginTop: 9, border: "none", background: "transparent", color: T.sub, fontSize: 12, cursor: "pointer" }}>I’m safe for now — return to the conversation</button>
  </div>;
}

/* ---------- crisis bar (every screen) ---------- */
function CrisisBar() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 50, display: "flex",
      justifyContent: "center", padding: "0 12px 12px", pointerEvents: "none" }}>
      <div style={{ width: "100%", maxWidth: 460, pointerEvents: "auto" }}>
        {open ? (
          <div style={{ background: "rgba(255,255,255,0.97)", backdropFilter: "blur(6px)", borderRadius: 20,
            padding: 12, boxShadow: T.lift, border: `1px solid ${T.line}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 14 }}>
                <LifeBuoy size={16} color={T.green} /> If you need help right now
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", color: T.sub }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {CONTACTS.map((c) => (
                <a key={c.label} href={`tel:${c.tel}`} style={{ display: "flex", alignItems: "center", gap: 8,
                  borderRadius: 14, padding: "9px 11px", textDecoration: "none", fontSize: 13.5,
                  background: c.accent ? T.green : "#fff", color: c.accent ? "#fff" : T.ink,
                  border: c.accent ? "none" : `1px solid ${T.line}` }}>
                  <Phone size={14} />
                  <span style={{ lineHeight: 1.15 }}>
                    <span style={{ display: "block", fontWeight: 600 }}>{c.label}</span>
                    <span style={{ display: "block", fontSize: 12, opacity: 0.85 }}>{c.number}</span>
                  </span>
                </a>
              ))}
            </div>
            <p style={{ fontSize: 11, color: T.sub, textAlign: "center", marginTop: 10 }}>
              A support tool — not a replacement for a doctor or emergency service.
            </p>
          </div>
        ) : (
          <button onClick={() => setOpen(true)} style={{ margin: "0 auto", display: "flex", alignItems: "center", gap: 8,
            borderRadius: 999, padding: "10px 18px", background: "rgba(255,255,255,0.97)", backdropFilter: "blur(6px)",
            border: `1px solid ${T.line}`, boxShadow: T.soft, cursor: "pointer", fontSize: 14, fontWeight: 600, color: T.ink }}>
            <LifeBuoy size={16} color={T.green} /> Need help now?
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- voice hook ---------- */
// A single global epoch shared by EVERY useVoice() instance on the page (Hub,
// Chat, Journal, Toolkit tools, etc. each have their own hook instance). This
// guarantees that starting speech anywhere on the page invalidates whatever
// any other instance was about to say, so a leftover utterance from a screen
// you've just left can never play on top of a new one.
let __synthEpoch = 0;

// Mobile browsers block audio that isn't started by a user gesture. A guide's
// reply arrives after a network call, so the tap that sent it no longer counts
// and playback gets blocked ("sometimes I have to prompt them to talk"). Fix:
// keep ONE persistent audio element and "unlock" it on the first user gesture
// (typing, tapping, holding the mic) by playing a silent clip. Once unlocked,
// it can replay freely — so every reply speaks automatically thereafter.
let __ttsAudio = null;
let __audioUnlocked = false;
let __autoVoiceOn = true;
let __primePromise = null;
let __lastVoiceAt = 0; // Date.now() of the last time a guide's voice actually started playing — used to only apply the iOS mic-recovery delay when it's actually needed
// Speech-to-text language — was hardcoded to "en-AU" everywhere, which is why
// typing in another language worked fine (that's Claude reading text) but
// SPEAKING in one didn't: the browser's mic transcription needs to be told
// which language to actually listen for. This is read directly by every
// place that creates a SpeechRecognition session, rather than threaded as a
// prop through every screen that has a mic button.
let __speechLang = "en-AU";
const SPEECH_LANGS = [
  { code: "en-AU", label: "English (Australia)" },
  { code: "es-ES", label: "Spanish — Español" },
  { code: "it-IT", label: "Italian — Italiano" },
  { code: "el-GR", label: "Greek — Ελληνικά" },
  { code: "vi-VN", label: "Vietnamese — Tiếng Việt" },
  { code: "zh-CN", label: "Mandarin — 中文" },
  { code: "yue-Hant-HK", label: "Cantonese — 廣東話" },
  { code: "ar-SA", label: "Arabic — العربية" },
  { code: "hi-IN", label: "Hindi — हिन्दी" },
  { code: "fil-PH", label: "Filipino — Tagalog" },
  { code: "hr-HR", label: "Croatian — Hrvatski" },
  { code: "ko-KR", label: "Korean — 한국어" },
  { code: "ja-JP", label: "Japanese — 日本語" },
  { code: "id-ID", label: "Indonesian — Bahasa Indonesia" },
  { code: "th-TH", label: "Thai — ภาษาไทย" },
];
// This is a valid 50 ms 8 kHz WAV with real silent samples. The old zero-length WAV
// could not establish an iOS audio session, even though more permissive browsers accepted it.
const __SILENT = "data:audio/wav;base64,UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACA" + "gICA".repeat(133);
function getTtsAudio() {
  if (typeof window === "undefined") return null;
  if (!__ttsAudio) { __ttsAudio = new Audio(); __ttsAudio.preload = "auto"; }
  return __ttsAudio;
}
function primeAudio() {
  // Play a short valid silent clip during a real tap/click to unlock iOS Safari's
  // media session. A genuine WAV matters here: iOS does not reliably treat an
  // empty/zero-duration source as user-initiated playback.
  if (typeof window === "undefined") return Promise.resolve(false);
  if (__primePromise) return __primePromise;
  const a = getTtsAudio();
  if (!a) return Promise.resolve(false);
  // Never replace a guide's real voice with the silent unlock clip mid-speech.
  if (!a.paused && a.currentSrc && a.currentSrc !== __SILENT) return Promise.resolve(true);
  __primePromise = new Promise((resolve) => {
    try {
      const keep = { onplay: a.onplay, onended: a.onended, onerror: a.onerror };
      let settled = false;
      let timer = null;
      const finish = (ok) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        try { a.pause(); a.currentTime = 0; a.removeAttribute("src"); a.load(); } catch {}
        a.onplay = keep.onplay; a.onended = keep.onended; a.onerror = keep.onerror;
        __primePromise = null;
        resolve(ok);
      };
      a.onplay = null;
      a.onended = () => finish(true);
      a.onerror = () => finish(false);
      a.src = __SILENT;
      a.currentTime = 0;
      const p = a.play();
      if (p && p.then) {
        p.then(() => { timer = setTimeout(() => finish(true), 90); }, () => finish(false));
      } else {
        timer = setTimeout(() => finish(true), 90);
      }
    } catch {
      __primePromise = null;
      resolve(false);
    }
  });
  return __primePromise;
}
let __unlockHandler = null;
function unlockAudio() {
  // Keep trying on each early gesture until a silent play actually SUCCEEDS.
  // (Previously this ran once and removed its listeners even if that first
  // attempt was blocked — which left the very first guide line of a session
  // silent on picky phones until you pressed repeat. Now it retries until it
  // genuinely unlocks, so the first reply speaks automatically.)
  if (__audioUnlocked || typeof window === "undefined") return;
  const a = getTtsAudio();
  // Critical: never hijack the shared audio element to "test-unlock" it while
  // a guide's real voice is actually mid-playback. primeAudio() swaps in a
  // silent clip and clears the handlers to check playback works — which, if
  // it ran on top of a real reply, silently killed that reply on the very
  // next touch, scroll, or tap anywhere on screen (including the composer)
  // and never resumed it. Skip this attempt and just try again next gesture.
  if (a && !a.paused) return;
  primeAudio().then((ok) => {
    if (!ok) return; // still blocked — leave listeners attached; next gesture retries
    __audioUnlocked = true;
    ["pointerdown", "touchend", "click", "keydown"].forEach((ev) => window.removeEventListener(ev, __unlockHandler));
  });
}
if (typeof window !== "undefined") {
  __unlockHandler = () => unlockAudio();
  ["pointerdown", "touchend", "click", "keydown"].forEach((ev) => window.addEventListener(ev, __unlockHandler, { passive: true }));
}

// Guide speech is fetched from the voice service per line, which adds a network
// round-trip before each one starts. Cache the audio and let callers pre-fetch
// the NEXT line while the current one plays, so playback starts instantly.
const __ttsCache = new Map(); // "voiceId|text" -> object URL
const __ttsPending = new Map(); // same key -> in-flight request, preventing duplicate fetches during prefetch/playback
const __TTS_CACHE_MAX = 24;
async function fetchTtsUrl(text, voiceId) {
  const key = voiceId + "|" + text;
  const hit = __ttsCache.get(key);
  if (hit) return hit;
  const pending = __ttsPending.get(key);
  if (pending) return pending;
  const request = (async () => {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voiceId }),
    });
    if (!res.ok) throw new Error("tts_failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    __ttsCache.set(key, url);
    if (__ttsCache.size > __TTS_CACHE_MAX) {
      const oldestKey = __ttsCache.keys().next().value;
      const oldUrl = __ttsCache.get(oldestKey);
      __ttsCache.delete(oldestKey);
      try { URL.revokeObjectURL(oldUrl); } catch {}
    }
    return url;
  })();
  __ttsPending.set(key, request);
  try { return await request; }
  finally { __ttsPending.delete(key); }
}

// Split a reply into short speakable chunks so playback can start after the
// FIRST sentence instead of waiting for the whole reply to synthesise.
const voiceDebug = (...args) => { try { if (import.meta.env && import.meta.env.DEV) console.debug("[RH voice]", ...args); } catch {} };

function cleanTranscript(text) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';
  const words = raw.split(' ');
  const out = [];
  for (const word of words) {
    const prev = out[out.length - 1];
    if (prev && word.length > 1 && prev.replace(/[.,!?;:]+$/g, '').toLowerCase() === word.replace(/^[.,!?;:]+/g, '').toLowerCase()) continue;
    out.push(word);
  }
  const half = Math.floor(out.length / 2);
  if (out.length > 3 && out.length % 2 === 0 && out.slice(0, half).join(' ').toLowerCase() === out.slice(half).join(' ').toLowerCase()) return out.slice(0, half).join(' ');
  return out.join(' ');
}

function splitForTts(text) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const sentences = clean.match(/[^.!?…]+[.!?…]+(?:["')\]]+)?|\S[^.!?…]*$/g) || [clean];
  const chunks = []; let cur = "";
  for (const s0 of sentences) {
    const s = s0.trim(); if (!s) continue;
    if (chunks.length === 0 && cur) { chunks.push(cur.trim()); cur = s; continue; }
    if ((cur + " " + s).trim().length > 160) { if (cur) chunks.push(cur.trim()); cur = s; }
    else cur = (cur ? cur + " " : "") + s;
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks;
}

function useVoice(voiceOn) {
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const audioRef = useRef(null);
  const reqRef = useRef(0);

  const stop = useCallback(() => {
    __synthEpoch++;
    try { if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel(); } catch {}
    try {
      if (audioRef.current) {
        const a = audioRef.current;
        a.onplay = null; a.onended = null; a.onerror = null; // no queued event can fire after this
        a.pause(); a.removeAttribute("src");
        // iOS Safari can otherwise keep the page's audio session locked in
        // "playback" mode after a guide's voice plays, which silently blocks
        // the mic from capturing anything on the very next Speech Recognition
        // attempt (button lights up, nothing gets heard). Explicitly load()-ing
        // an empty source forces iOS to release the session back for recording.
        try { a.load(); } catch {}
      }
      audioRef.current = null;
    } catch {}
    setSpeaking(false); setPaused(false);
  }, []);

  // Pause/resume the current speech. Works for both the real audio element and
  // the browser fallback voice. Returns true if it did something.
  const pauseResume = useCallback(() => {
    try {
      if (audioRef.current) {
        const a = audioRef.current;
        // Once a clip has ended it cannot be "resumed". Clear the reference so
        // tapping the bubble starts a clean replay instead — particularly important on iOS.
        if (a.ended) { audioRef.current = null; return false; }
        if (a.paused) {
          const p = a.play();
          if (p && p.catch) p.catch(() => { if (audioRef.current === a) audioRef.current = null; setPaused(false); });
          setPaused(false);
        } else { a.pause(); setPaused(true); }
        return true;
      }
      if (typeof window !== "undefined" && window.speechSynthesis && window.speechSynthesis.speaking) {
        if (window.speechSynthesis.paused) { window.speechSynthesis.resume(); setPaused(false); }
        else { window.speechSynthesis.pause(); setPaused(true); }
        return true;
      }
    } catch {}
    return false;
  }, []);

  const browserSpeak = useCallback((text, char, onDone) => {
    if (typeof window === "undefined" || !window.speechSynthesis) { if (onDone) onDone(); return; }
    const myEpoch = ++__synthEpoch;
    try { window.speechSynthesis.cancel(); } catch {}
    // Chrome/WebKit have a known race where speak() called immediately after
    // cancel() can let the old and new utterances both briefly play. A short
    // delay before speaking lets the cancel actually take effect first.
    setTimeout(() => {
      if (myEpoch !== __synthEpoch) return; // superseded while we waited — the newer request owns onDone now
      try {
        const u = new SpeechSynthesisUtterance(text);
        u.pitch = char?.voice?.pitch ?? 1; u.rate = char?.voice?.rate ?? 1; u.lang = __speechLang;
        u.onstart = () => { if (myEpoch === __synthEpoch) { __lastVoiceAt = Date.now(); setSpeaking(true); } };
        u.onend = () => { if (myEpoch === __synthEpoch) { setSpeaking(false); if (onDone) onDone(); } };
        window.speechSynthesis.speak(u);
      } catch { if (myEpoch === __synthEpoch && onDone) onDone(); }
    }, 80);
  }, []);

  const speak = useCallback(async (text, char, onDone, force) => {
    if ((!voiceOn && !force) || !text) { if (onDone) onDone(); return; }
    const myReq = ++reqRef.current;
    // If a tap has just started the iPhone unlock clip, let that short, genuine
    // playback finish before replacing the shared element with the guide's voice.
    // This preserves the user gesture that Safari requires for later asynchronous audio.
    if (__primePromise) await __primePromise;
    if (myReq !== reqRef.current) return;
    stop();
    setPaused(false);
    const stale = () => myReq !== reqRef.current;

    // Prefer natural voices when the guide has a voiceId; fall back to the
    // browser voice if the key isn't set, the call fails, or playback is blocked.
    if (char && char.voiceId) {
      const chunks = splitForTts(text);
      const first = chunks[0] || text;
      try {
        // Start the first short request immediately. The remaining response no
        // longer blocks the first spoken sentence; the next chunk is warmed in
        // parallel while this one is synthesising/playing.
        const firstUrlPromise = fetchTtsUrl(first, char.voiceId);
        if (chunks[1]) fetchTtsUrl(chunks[1], char.voiceId).catch(() => {});
        const playChunk = async (index, urlPromise) => {
          if (stale()) return;
          const chunk = chunks[index] || text;
          let url;
          try { url = await (urlPromise || fetchTtsUrl(chunk, char.voiceId)); }
          catch { if (!stale()) browserSpeak(chunk, char, index + 1 < chunks.length ? () => playChunk(index + 1) : onDone); return; }
          if (stale()) return;
          const audio = getTtsAudio() || new Audio();
          audioRef.current = audio;
          audio.onplay = () => { try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch {} __lastVoiceAt = Date.now(); setSpeaking(true); };
          audio.onended = () => {
            if (stale()) return;
            if (audioRef.current === audio) audioRef.current = null;
            if (index + 1 < chunks.length) {
              // Fetch the following chunk just-in-time; the prior prefetch makes
              // this normally a cache hit and keeps the transition quick.
              playChunk(index + 1);
            } else {
              setSpeaking(false);
              if (onDone) onDone();
            }
          };
          audio.onerror = () => {
            if (audioRef.current === audio) audioRef.current = null;
            if (stale()) return;
            if (index + 1 < chunks.length) browserSpeak(chunk, char, () => playChunk(index + 1));
            else { setSpeaking(false); browserSpeak(chunk, char, onDone); }
          };
          try { audio.src = url; audio.currentTime = 0; await audio.play(); return; }
          catch {
            try { await primeAudio(); if (stale()) return; audio.src = url; audio.currentTime = 0; await audio.play(); return; }
            catch { if (!stale()) browserSpeak(chunk, char, index + 1 < chunks.length ? () => playChunk(index + 1) : onDone); }
          }
        };
        await playChunk(0, firstUrlPromise);
        return;
      } catch { /* fall through to browser voice */ }
      if (stale()) return;
    }
    browserSpeak(text, char, onDone);
  }, [voiceOn, stop, browserSpeak]);

  // Warm the cache for a line we're about to need (no playback).
  const prefetch = useCallback((text, char) => {
    if (!voiceOn || !text || !char || !char.voiceId) return;
    fetchTtsUrl(text, char.voiceId).catch(() => {});
  }, [voiceOn]);

  return { speak, stop, speaking, paused, pauseResume, prefetch };
}

function HoldToTalk({ onText, onStart, size = 52 }) {
  const [listening, setListening] = useState(false);
  const [err, setErr] = useState(null);
  const recRef = useRef(null);
  const committedRef = useRef("");   // finalized speech accumulated across this hold
  const submittedRef = useRef(false); // one commit maximum per hold
  const heldRef = useRef(false);     // true while the button is actually held
  const supported = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

  // Chrome/Android's `continuous: true` mode can silently auto-restart and
  // re-deliver overlapping results, which is what causes runaway repeated
  // text on longer holds. Instead we run short NON-continuous sessions and
  // manually chain them back-to-back while the button is held, only ever
  // appending brand-new finalized text — never re-reading old results.
  const runSession = () => {
    if (!heldRef.current) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    let r;
    try { r = new SR(); } catch { setErr("Couldn't start the mic."); setListening(false); return; }
    voiceDebug("tap session created");
    r.lang = __speechLang; r.interimResults = true; r.continuous = false;
    let sessionFinal = "", interimText = "";
    r.onresult = (e) => {
      // Rebuild this session's text from scratch each update — idempotent, so a
      // sentence is never re-added — and keep the trailing interim for the tail.
      let f = "", it = "";
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i]; if (!res || !res[0]) continue;
        if (res.isFinal) f += res[0].transcript + " "; else it += res[0].transcript;
      }
      sessionFinal = f.trim(); interimText = it;
    };
    r.onerror = (e) => {
      if (e && (e.error === "not-allowed" || e.error === "service-not-allowed")) {
        setErr("Mic access is blocked — check your browser/site permissions.");
        heldRef.current = false;
      }
    };
    r.onend = () => {
      recRef.current = null;
      const seg = sessionFinal.trim();     // only finalized recognition results are committed
      if (seg) committedRef.current = (committedRef.current + " " + seg).trim();
      sessionFinal = ""; interimText = "";
      if (heldRef.current) { runSession(); return; } // still held — keep listening seamlessly
      setListening(false);
      const t = cleanTranscript(committedRef.current);
      if (t && !submittedRef.current) { submittedRef.current = true; voiceDebug("tap transcript submitted", t); onText(t); }
      else if (t) voiceDebug("tap duplicate transcript ignored");
    };
    try { recRef.current = r; r.start(); setListening(true); }
    catch { recRef.current = null; /* start raced with a previous stop — the watchdog revives it */ }
  };

  const watchdog = useRef(null);
  // iOS WebKit has a known issue where, after the page has played sound
  // through an <audio> element (a guide's voice reply), a later Speech
  // Recognition session can start "successfully" — button lights up — but
  // never actually receives any audio, because the OS-level audio session
  // is still routed for playback rather than recording. Briefly grabbing
  // (and instantly releasing) a real getUserMedia mic stream first forces
  // iOS to hand the session back to recording mode before Speech Recognition
  // tries to use it. Permission is already granted at this point, so this
  // resolves near-instantly and never re-prompts; it's a no-op on browsers
  // that don't need it.
  const wakeMic = () => new Promise((resolve) => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { resolve(); return; }
    let done = false;
    const finish = () => { if (done) return; done = true; resolve(); };
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => { stream.getTracks().forEach((t) => t.stop()); finish(); })
      .catch(() => finish());
    setTimeout(finish, 700); // never block the mic button longer than this
  });
  const start = () => {
    if (!supported) { setErr("Voice input isn't supported here — please type."); return; }
    if (onStart) onStart();
    setErr(null); committedRef.current = ""; submittedRef.current = false; heldRef.current = true;
    // Only pay the mic-wake delay when it's actually needed — right after a
    // guide's voice has played. Otherwise (first message, or voice off) start
    // listening immediately, so the beginning of what someone says isn't lost.
    const justHeardVoice = Date.now() - __lastVoiceAt < 4000;
    if (justHeardVoice) {
      setTimeout(() => {
        if (!heldRef.current) return;
        wakeMic().then(() => { if (heldRef.current) runSession(); });
      }, 150);
    } else {
      runSession();
    }
    // Browsers cap a single listening session (~1 min, and they stop on pauses).
    // This keeps the mic alive no matter how long someone talks: if a session has
    // ended and a restart didn't take, revive it. Nobody gets cut off mid-sentence.
    clearInterval(watchdog.current);
    watchdog.current = setInterval(() => {
      if (heldRef.current && !recRef.current) runSession();
    }, 1000);
  };
  const stop = () => {
    heldRef.current = false;
    clearInterval(watchdog.current);
    try { recRef.current && recRef.current.stop(); } catch {}
  };
  // Tap to start, tap again to finish & send. heldRef is set synchronously in
  // start()/stop(), so consecutive taps toggle reliably regardless of React state timing.
  const toggle = () => { if (heldRef.current) stop(); else start(); };
  useEffect(() => () => clearInterval(watchdog.current), []);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <button
        onPointerDown={toggle}
        aria-label={listening ? "Tap to stop and send" : "Tap to talk"}
        style={{ width: size, height: size, borderRadius: "50%", border: "none", cursor: "pointer",
          background: listening ? "#e5484d" : "#fff", color: listening ? "#fff" : T.ink,
          boxShadow: T.soft, display: "grid", placeItems: "center",
          animation: listening ? "rh-glow 1.2s ease-in-out infinite" : "none", touchAction: "none" }}>
        {listening ? <Square size={20} /> : <Mic size={20} />}
      </button>
      {err && <span style={{ fontSize: 11, color: "#c0392b", marginTop: 4, maxWidth: 120, textAlign: "center" }}>{err}</span>}
    </div>
  );
}

/* ---------- toolkit (anxiety support) ---------- */
function BackBtn({ onBack, label }) {
  const destination = label || __backDestinationLabel || "Home";
  return (
    <button onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 6,
      background: T.green, border: "none", borderRadius: 999, padding: "9px 16px", color: "#fff",
      fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: T.soft, flexShrink: 0 }}>
      <ArrowLeft size={16} /> {destination}
    </button>
  );
}

const AFFIRMATIONS = [
  "This feeling is uncomfortable, but it will pass.",
  "I've got through hard moments before, and I can get through this one.",
  "I'm allowed to take things one small step at a time.",
  "My worth isn't measured by how today goes.",
  "I can't control everything — but I can control my next breath.",
  "Reaching out for help is strength, not weakness.",
  "I'm doing the best I can with what I have right now, and that's enough.",
  "This moment is not my whole story.",
  "I can let a thought pass without holding onto it.",
  "Right now, in this moment, I am safe.",
  "Slow breath in, slow breath out. I've got this.",
  "Whatever comes, I won't have to face it alone.",
];

const CALM_TIPS = [
  "Name it out loud — “this is anxiety.” Naming a feeling can loosen its grip.",
  "Drop your shoulders, unclench your jaw, and let your hands rest open.",
  "Make the next five minutes the only thing you have to get through.",
  "Message one person you trust — even just to say hi.",
  "Open a window or step outside for a few slow breaths of fresh air.",
  "Drink a glass of water slowly, noticing each sip.",
  "Put on one song you love, and just listen to it.",
  "Rest a hand on your chest and feel it rise and fall.",
];

const TOOLS = [
  { key: "breathing", title: "Breathing", blurb: "A guided breath to settle your body", Icon: Wind, tint: "#d6f0e2", ic: "#2c7d50" },
  { key: "grounding", title: "Grounding", blurb: "The 5-4-3-2-1 senses reset", Icon: Anchor, tint: "#e2eefb", ic: "#3b7fca" },
  { key: "meditation", title: "Meditation", blurb: "Find guided meditations for how you feel", Icon: Youtube, tint: "#fbe1e1", ic: "#cf5147" },
  { key: "safety", title: "Staying safe", blurb: "Substance safety, overdose help & support lines", Icon: LifeBuoy, tint: "#e2eefb", ic: "#3b7fca" },
  { key: "selfhelp", title: "Self-help videos", blurb: "Talks and motivation from inspiring speakers", Icon: Flame, tint: "#fde7cf", ic: "#d0904e" },
  { key: "affirmations", title: "Words for right now", blurb: "Gentle reminders to steady you", Icon: Heart, tint: "#f8e3d6", ic: "#d08a5e" },
  { key: "calm", title: "Quick calm", blurb: "Small things to try when it's too much", Icon: Sparkles, tint: "#fbf1d6", ic: "#c9a227" },
];

// labels used when a guide suggests a tool inside a chat
const TOOL_SUGGEST = {
  breathing: { label: "Try a breathing exercise", Icon: Wind, tint: "#d6f0e2", ic: "#2c7d50" },
  grounding: { label: "Try a grounding exercise", Icon: Anchor, tint: "#e2eefb", ic: "#3b7fca" },
  meditation: { label: "Find a meditation", Icon: Youtube, tint: "#fbe1e1", ic: "#cf5147" },
  affirmations: { label: "See some steadying words", Icon: Heart, tint: "#f8e3d6", ic: "#d08a5e" },
  calm: { label: "Open quick calm", Icon: Sparkles, tint: "#fbf1d6", ic: "#c9a227" },
};

// Featured creator on the Toolkit's front screen. Curated by hand (not AI-generated),
// so this doesn't run into the "never give specific video URLs" rule — that rule is
// about the guides making up links live in chat, not a maintainer-picked list like this.
const NEVERN_CHANNEL_URL = "https://www.youtube.com/@NevernSubermoney";
const NEVERN_VIDEOS = [
  { title: "A Somatic Reset for Stress and Anxiety", url: "https://youtube.com/shorts/bkgigQ9MLIE" },
  { title: "Vagus Nerve Support for Nervous-System Regulation", url: "https://youtube.com/shorts/GKZSqgHQW2Y" },
  { title: "Somatic Healing for Nervous-System Regulation", url: "https://youtube.com/shorts/K0-Wsiolkns" },
  { title: "A Mindful Vagus-Nerve Practice", url: "https://youtube.com/shorts/tOJBcJyn36M" },
];

function NevernSpotlightContent() {
  return (
    <div style={{ background: T.card, borderRadius: 20, padding: 16, boxShadow: T.soft }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#fbe1e1", display: "grid", placeItems: "center", flexShrink: 0, overflow: "hidden" }}>
          <img src="/nevern.png" alt="Nevern" style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.nextSibling.style.display = "grid"; }} />
          <Youtube size={24} color="#cf5147" style={{ display: "none" }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 17 }}>Nevern | Psychologist</div>
          <div style={{ fontSize: 12.5, color: T.sub }}>Somatic tools for stress and nervous-system regulation</div>
        </div>
        <a href={NEVERN_CHANNEL_URL} target="_blank" rel="noopener noreferrer"
          style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 700, color: T.greenDk, textDecoration: "none", flexShrink: 0 }}>
          Channel <ExternalLink size={13} />
        </a>
      </div>

      <p style={{ fontSize: 13.5, color: T.sub, lineHeight: 1.55, margin: "0 0 14px" }}>
        A small collection of calming practices to help you settle your body, steady your breathing, and gently support your nervous system.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {NEVERN_VIDEOS.map((video, index) => (
          <a key={video.url} href={video.url} target="_blank" rel="noopener noreferrer" aria-label={`Watch ${video.title} on YouTube`}
            style={{ display: "flex", alignItems: "center", gap: 12, background: index % 2 === 0 ? "linear-gradient(110deg, #fff6f6 0%, #fff0f0 100%)" : "linear-gradient(110deg, #fff9f3 0%, #fff4ea 100%)", borderRadius: 16, padding: 12,
              textDecoration: "none", color: T.ink, border: "1px solid rgba(207,81,71,0.12)", boxShadow: "0 4px 12px rgba(207,81,71,0.06)" }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: index % 2 === 0 ? "linear-gradient(145deg, #cf5147, #ed8b80)" : "linear-gradient(145deg, #d08a5e, #e9b18e)", display: "grid", placeItems: "center", flexShrink: 0, position: "relative" }}>
              <Play size={16} color="#ffffff" fill="#ffffff" />
              <span style={{ position: "absolute", right: -5, top: -6, minWidth: 17, height: 17, borderRadius: 9, background: T.card, color: index % 2 === 0 ? "#cf5147" : "#b76e43", fontSize: 10, fontWeight: 800, display: "grid", placeItems: "center", boxShadow: "0 2px 5px rgba(40,38,47,0.14)" }}>{index + 1}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.3 }}>{video.title}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4, fontSize: 10.5, color: T.sub, fontWeight: 700, letterSpacing: 0.35, textTransform: "uppercase" }}>
                <span>Nevern</span><span style={{ color: index % 2 === 0 ? "#cf5147" : "#b76e43" }}>•</span><span>Watch on YouTube</span>
              </div>
            </div>
            <ExternalLink size={16} color={index % 2 === 0 ? "#cf5147" : "#b76e43"} />
          </a>
        ))}
      </div>
    </div>
  );
}

function NevernPage({ onBack }) {
  return (
    <>
      <Brand right={<BackBtn onBack={onBack} label="Toolkit" />} />
      <SectionTitle>Nevern | Psychologist</SectionTitle>
      <p style={{ fontSize: 13.5, color: T.sub, margin: "0 2px 16px", lineHeight: 1.5 }}>
        Calm, practical somatic resources for moments when stress feels close to the surface.
      </p>
      <NevernSpotlightContent />
      <Disclaimer />
    </>
  );
}

function NevernSpotlight({ onOpen }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <button onClick={onOpen}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, background: T.card, borderRadius: 18, padding: 14,
          cursor: "pointer", boxShadow: T.soft, border: "none", textAlign: "left" }}>
        <div style={{ width: 46, height: 46, borderRadius: 14, background: "#fbe1e1", display: "grid", placeItems: "center", flexShrink: 0 }}>
          <Youtube size={22} color="#cf5147" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Nevern | Psychologist</div>
          <div style={{ fontSize: 13, color: T.sub }}>Open his space for calm, practical videos</div>
        </div>
        <ChevronRight size={20} color={T.sub} />
      </button>
    </div>
  );
}

function CarlosSpotlight() {
  const CARLOS_TIKTOK_URL = "https://www.tiktok.com/@carlosalive";
  const videos = [
    { title: "You Can’t Control the Weather — Only Your Response", url: "https://vt.tiktok.com/ZSVW3U5dF/" },
    { title: "When You’re Having a Low Day", url: "https://vt.tiktok.com/ZSVW3byM1/" },
    { title: "Saying Goodbye to a Low Day", url: "https://vt.tiktok.com/ZSVWTYxoU/" },
    { title: "Choosing Positive Perspectives", url: "https://vt.tiktok.com/ZSVW3sDPP/" },
    { title: "A Different Way to Face Problems", url: "https://vt.tiktok.com/ZSVW3Gue6/" },
  ];
  return (
    <div style={{ background: T.card, borderRadius: 20, padding: 16, boxShadow: T.soft, marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div style={{ width: 46, height: 46, borderRadius: "50%", background: "#e2eefb", display: "grid", placeItems: "center", flexShrink: 0, overflow: "hidden" }}>
          <img src="/carlos.jpg" alt="Carlos Camacho" style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={(event) => { event.currentTarget.style.display = "none"; event.currentTarget.nextSibling.style.display = "block"; }} />
          <Shield size={22} color={T.blueDk} style={{ display: "none" }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15.5 }}>Carlos Camacho | Registered Psychologist</div>
          <div style={{ fontSize: 12.5, color: T.sub }}>Clinical oversight for the Resilience Hub</div>
        </div>
        <a href={CARLOS_TIKTOK_URL} target="_blank" rel="noopener noreferrer"
          style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 700, color: T.greenDk, textDecoration: "none", flexShrink: 0 }}>
          TikTok <ExternalLink size={13} />
        </a>
      </div>
      <p style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.55, margin: "0 0 14px" }}>
        Welcome to Carlos's space — where clinical care meets real heart. Carlos is our trusted psychologist, guiding people through anxiety, trauma, and life's hardest moments with one simple truth: healing isn't just in the mind — it's in how we connect with the world around us too.
      </p>
      <p style={{ fontSize: 13.5, color: T.sub, lineHeight: 1.55, margin: "0 0 12px" }}>
        Watch his videos below — calm, perspective, and a gentle reminder that you're never walking it alone.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {videos.map((video, index) => (
          <a key={video.url} href={video.url} target="_blank" rel="noopener noreferrer" aria-label={`Watch ${video.title} on TikTok`}
            style={{ display: "flex", alignItems: "center", gap: 12, background: index % 2 === 0 ? "linear-gradient(110deg, #f4f8fd 0%, #eef6ff 100%)" : "linear-gradient(110deg, #faf5ff 0%, #f4f0fb 100%)", borderRadius: 16, padding: 12,
              textDecoration: "none", color: T.ink, border: "1px solid rgba(63,111,175,0.10)", boxShadow: "0 4px 12px rgba(63,111,175,0.06)" }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: index % 2 === 0 ? `linear-gradient(145deg, ${T.blueDk}, #6f9bd4)` : "linear-gradient(145deg, #7055a8, #aa8bd2)", display: "grid", placeItems: "center", flexShrink: 0, position: "relative" }}>
              <Play size={16} color="#ffffff" fill="#ffffff" />
              <span style={{ position: "absolute", right: -5, top: -6, minWidth: 17, height: 17, borderRadius: 9, background: T.card, color: index % 2 === 0 ? T.blueDk : "#7055a8", fontSize: 10, fontWeight: 800, display: "grid", placeItems: "center", boxShadow: "0 2px 5px rgba(40,38,47,0.14)" }}>{index + 1}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.3 }}>{video.title}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4, fontSize: 10.5, color: T.sub, fontWeight: 700, letterSpacing: 0.35, textTransform: "uppercase" }}>
                <span>Short video</span><span style={{ color: index % 2 === 0 ? T.blueDk : "#7055a8" }}>•</span><span>Watch on TikTok</span>
              </div>
            </div>
            <ExternalLink size={16} color={index % 2 === 0 ? T.blueDk : "#7055a8"} />
          </a>
        ))}
      </div>
    </div>
  );
}

function Toolkit({ voiceOn, initial, onUseTool, onOpenJournal, onBack }) {
  const [tool, setTool] = useState(initial || null);
  const toolkitWelcome = "Welcome to the Toolkit — a collection of things that can help, whenever you need them. Take your time, look around, pick whatever feels right for you today. No rush at all — whenever you're ready.";
  const { speak: speakToolkitWelcome, stop: stopToolkitWelcome } = useVoice(voiceOn);
  useEffect(() => {
    if (!voiceOn || !__autoVoiceOn) return undefined;
    const timer = setTimeout(() => speakToolkitWelcome(toolkitWelcome, CHARS.rex), 220);
    return () => { clearTimeout(timer); stopToolkitWelcome(); };
    // Deliberately speak once when the section opens or voice is enabled.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceOn]);
  if (tool === "breathing") return <BreathingTool onBack={() => setTool(null)} />;
  if (tool === "grounding") return <GroundingTool onBack={() => setTool(null)} />;
  if (tool === "meditation") return <MeditationTool onBack={() => setTool(null)} />;
  if (tool === "safety") return <SafetyTool onBack={() => setTool(null)} />;
  if (tool === "selfhelp") return <SelfHelpTool onBack={() => setTool(null)} />;
  if (tool === "affirmations") return <AffirmationsTool voiceOn={voiceOn} onBack={() => setTool(null)} />;
  if (tool === "calm") return <QuickCalm onBack={() => setTool(null)} />;
  if (tool === "nevern") return <NevernPage onBack={() => setTool(null)} />;
  const groups = [
    { label: "Calm down now", keys: ["breathing", "grounding", "calm"] },
    { label: "Reflect & grow", keys: ["meditation", "selfhelp", "affirmations"] },
  ];
  return (
    <>
      <Brand right={<BackBtn onBack={onBack} />} />
      <SectionTitle>Toolkit</SectionTitle>
      <div className="rh-in" style={{ display: "flex", gap: 11, alignItems: "center", margin: "0 0 13px" }}>
        <Portrait src={CHARS.rex.img} name="Rex" size={58} speaking={false} tint={CHARS.rex.tint} />
        <div style={{ background: "linear-gradient(120deg, #eef8f1, #fff)", border: `1px solid ${T.line}`, borderRadius: 17, padding: "11px 13px", boxShadow: T.soft, fontSize: 13.5, color: T.ink, lineHeight: 1.48 }}>Welcome to the Toolkit — a collection of things that can help, whenever you need them. Take your time, look around, pick whatever feels right for you today. No rush at all — whenever you're ready.</div>
      </div>
      <p style={{ fontSize: 13.5, color: T.sub, margin: "0 2px 16px", lineHeight: 1.5 }}>
        A few things that can help, grouped by what you need right now. There's no right way — try whatever feels doable.
      </p>
      <CarlosSpotlight />
      {groups.map((g) => (
        <div key={g.label} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: T.sub, textTransform: "uppercase",
            letterSpacing: 0.5, margin: "0 2px 8px" }}>{g.label}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {g.keys.map((k) => {
              const t = TOOLS.find((x) => x.key === k);
              if (!t) return null;
              return (
                <button key={t.key} onClick={() => { if (t.key === "journal") { onOpenJournal && onOpenJournal(); return; } onUseTool && onUseTool(t.key); setTool(t.key); }} style={{ width: "100%", display: "flex", alignItems: "center",
                  gap: 14, background: T.card, borderRadius: 18, padding: 14, cursor: "pointer", boxShadow: T.soft, border: "none", textAlign: "left" }}>
                  <div style={{ width: 46, height: 46, borderRadius: 14, background: t.tint, display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <t.Icon size={22} color={t.ic} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{t.title}</div>
                    <div style={{ fontSize: 13, color: T.sub }}>{t.blurb}</div>
                  </div>
                  <ChevronRight size={20} color={T.sub} />
                </button>
              );
            })}
          </div>
          {g.label === "Calm down now" && <NevernSpotlight onOpen={() => setTool("nevern")} />}
        </div>
      ))}
      <Disclaimer />
    </>
  );
}

function BreathingTool({ onBack }) {
  const PATTERN = [
    { label: "Breathe in", secs: 4, scale: 1.0 },
    { label: "Hold", secs: 4, scale: 1.0 },
    { label: "Breathe out", secs: 4, scale: 0.5 },
    { label: "Hold", secs: 4, scale: 0.5 },
  ];
  const TOTAL = 16;
  const [running, setRunning] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const t = tick % TOTAL;
  let acc = 0, ph = 0, into = 0;
  for (let k = 0; k < PATTERN.length; k++) {
    if (t < acc + PATTERN[k].secs) { ph = k; into = t - acc; break; }
    acc += PATTERN[k].secs;
  }
  const cur = PATTERN[ph];
  const left = cur.secs - into;
  const cycles = Math.floor(tick / TOTAL);
  const reset = () => { setRunning(false); setTick(0); };

  return (
    <>
      <Brand right={<BackBtn onBack={onBack} label="Toolkit" />} />
      <SectionTitle>Breathing</SectionTitle>
      <p style={{ fontSize: 13.5, color: T.sub, margin: "0 2px 6px", lineHeight: 1.5 }}>
        Box breathing — in for four, hold for four, out for four, hold for four. Just follow the circle.
      </p>
      <div style={{ display: "grid", placeItems: "center", padding: "18px 0 6px", minHeight: 288 }}>
        <div style={{
          width: 220, height: 220, borderRadius: "50%",
          background: "radial-gradient(circle at 50% 38%, #d6f0e2, #bfe3d0)",
          transform: `scale(${running ? cur.scale : 0.7})`,
          transition: `transform ${running ? cur.secs : 0.6}s ease-in-out`,
          boxShadow: T.soft, display: "grid", placeItems: "center",
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 19, fontWeight: 700, color: T.greenDk }}>{running ? cur.label : "Ready?"}</div>
            {running && <div style={{ fontSize: 30, fontWeight: 800, color: T.greenDk, marginTop: 2 }}>{left}</div>}
          </div>
        </div>
      </div>
      <div style={{ textAlign: "center", color: T.sub, fontSize: 13, marginBottom: 14 }}>
        {cycles > 0 ? `${cycles} round${cycles === 1 ? "" : "s"} completed` : "Take it at your own pace"}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <Btn onClick={() => setRunning((r) => !r)} style={{ flex: 1 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            {running ? <><Pause size={18} /> Pause</> : <><Play size={18} /> Start</>}
          </span>
        </Btn>
        <Btn kind="outline" onClick={reset} style={{ width: 120 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><RotateCcw size={16} /> Reset</span>
        </Btn>
      </div>
      <Disclaimer />
    </>
  );
}

function GroundingTool({ onBack }) {
  const STEPS = [
    { n: 5, text: "Name five things you can see.", sub: "Say them softly to yourself, one at a time." },
    { n: 4, text: "Notice four things you can feel.", sub: "Your feet on the floor, the chair, your clothes, the air." },
    { n: 3, text: "Listen for three things you can hear.", sub: "Near or far — a hum, traffic, your own breath." },
    { n: 2, text: "Find two things you can smell.", sub: "Or two smells you like and can picture." },
    { n: 1, text: "Notice one thing you can taste.", sub: "Or name one good thing about yourself." },
  ];
  const [i, setI] = useState(0);
  const done = i >= STEPS.length;
  return (
    <>
      <Brand right={<BackBtn onBack={onBack} label="Toolkit" />} />
      <SectionTitle>Grounding · 5-4-3-2-1</SectionTitle>
      {!done ? (
        <>
          <p style={{ fontSize: 13.5, color: T.sub, margin: "0 2px 14px", lineHeight: 1.5 }}>
            When thoughts race, come back to your senses — one step at a time.
          </p>
          <div className="rh-in" key={i} style={{ background: T.card, borderRadius: 22, padding: 24, boxShadow: T.soft,
            textAlign: "center", minHeight: 210, display: "grid", placeItems: "center" }}>
            <div>
              <div style={{ width: 84, height: 84, borderRadius: "50%", background: "#e8f1fb", display: "grid",
                placeItems: "center", margin: "0 auto 14px" }}>
                <span style={{ fontSize: 38, fontWeight: 800, color: "#3b7fca" }}>{STEPS[i].n}</span>
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>{STEPS[i].text}</div>
              <div style={{ fontSize: 14, color: T.sub, lineHeight: 1.5 }}>{STEPS[i].sub}</div>
            </div>
          </div>
          <div style={{ height: 12 }} />
          <Btn onClick={() => setI(i + 1)}>{i === STEPS.length - 1 ? "Finish" : "Next"}</Btn>
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 14 }}>
            {STEPS.map((_, k) => (
              <div key={k} style={{ width: 8, height: 8, borderRadius: "50%", background: k <= i ? "#3b7fca" : "#d9e4f0" }} />
            ))}
          </div>
        </>
      ) : (
        <div className="rh-in" style={{ background: T.card, borderRadius: 22, padding: 24, boxShadow: T.soft, textAlign: "center" }}>
          <Anchor size={30} color="#3b7fca" />
          <div style={{ fontSize: 17, fontWeight: 700, margin: "10px 0 6px" }}>Nicely done.</div>
          <p style={{ fontSize: 14, color: T.sub, lineHeight: 1.5, margin: "0 0 16px" }}>
            You brought yourself back to right now. Notice if anything feels even a little steadier.
          </p>
          <Btn kind="outline" onClick={() => setI(0)}>Go again</Btn>
        </div>
      )}
      <Disclaimer />
    </>
  );
}

function AffirmationsTool({ voiceOn, onBack }) {
  const { speak, stop } = useVoice(voiceOn);
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * AFFIRMATIONS.length));
  useEffect(() => () => stop(), [stop]);
  const text = AFFIRMATIONS[idx];
  return (
    <>
      <Brand right={<BackBtn onBack={onBack} label="Toolkit" />} />
      <SectionTitle>Words for right now</SectionTitle>
      <div className="rh-in" key={idx} style={{ background: "linear-gradient(160deg, #fff, #f6ead9)", borderRadius: 24,
        padding: "34px 22px", boxShadow: T.soft, textAlign: "center", minHeight: 200, display: "grid",
        placeItems: "center", margin: "6px 0 16px" }}>
        <div style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.45 }}>“{text}”</div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <Btn onClick={() => setIdx((i) => (i + 1) % AFFIRMATIONS.length)} style={{ flex: 1 }}>Another</Btn>
        <Btn kind="outline" onClick={() => speak(text, CHARS.lila)} style={{ width: 130 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Volume2 size={17} /> Say it</span>
        </Btn>
      </div>
      <Disclaimer />
    </>
  );
}

const MED_SYSTEM = `You help someone find guided meditation or relaxation videos for how they feel. Given what they describe, reply with ONLY a JSON object (no markdown, no preamble) in this shape:
{"intro":"one warm sentence to them","searches":["short specific youtube search phrase", "...", "3 to 4 total"]}
Make each phrase a good, specific meditation/relaxation search — e.g. "10 minute sleep meditation for anxiety", "guided body scan for racing thoughts", "5 minute breathing meditation for panic". Keep them gentle, calming, and appropriate for a mental-health wellbeing context. Never suggest anything unsafe or unrelated to meditation/relaxation.`;

function MeditationTool({ onBack }) {
  const [q, setQ] = useState("");
  const [intro, setIntro] = useState("");
  const [searches, setSearches] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ytUrl = (s) => "https://www.youtube.com/results?search_query=" + encodeURIComponent(s + " meditation");

  const find = async (text) => {
    const query = (text ?? q).trim();
    if (!query || busy) return;
    setBusy(true); setErr(""); setIntro(""); setSearches([]);
    try {
      const reply = await callModel({ system: MED_SYSTEM, messages: [{ role: "user", content: query }], maxTokens: 500 });
      const clean = reply.split("```json").join("").split("```").join("").trim();
      let data = null;
      try { data = JSON.parse(clean); } catch {}
      if (data && Array.isArray(data.searches) && data.searches.length) {
        setIntro(data.intro || "");
        setSearches(data.searches.slice(0, 5));
      } else {
        setSearches([query]);
      }
    } catch (e) { setErr("Couldn't fetch suggestions just now — try again in a moment."); }
    finally { setBusy(false); }
  };

  const quick = ["Calm before sleep", "Ease a racing mind", "Let go of anxiety", "Grounding when overwhelmed", "A short reset"];

  return (
    <>
      <Brand right={<BackBtn onBack={onBack} label="Toolkit" />} />
      <SectionTitle>Meditation</SectionTitle>
      <p style={{ fontSize: 13.5, color: T.sub, margin: "0 2px 12px", lineHeight: 1.5 }}>
        Tell me what you're after and I'll find guided meditations for it. Tap one to watch on YouTube.
      </p>
      <textarea value={q} onChange={(e) => setQ(e.target.value)} rows={2}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); find(); } }}
        placeholder="e.g. winding down before bed, a racing mind, feeling anxious…"
        style={{ ...inputStyle, resize: "none", minHeight: 64 }} />
      <div style={{ marginTop: 10 }}>
        <Btn onClick={() => find()} disabled={busy || !q.trim()}>{busy ? "Finding…" : "Find meditations"}</Btn>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        {quick.map((x) => (
          <button key={x} onClick={() => { setQ(x); find(x); }} disabled={busy}
            style={{ borderRadius: 999, padding: "8px 13px", fontSize: 13, border: `1px solid ${T.line}`,
              background: "#fff", cursor: busy ? "default" : "pointer", color: T.ink, boxShadow: T.soft }}>{x}</button>
        ))}
      </div>

      {err && <div style={{ fontSize: 13, color: "#c0392b", marginTop: 12 }}>{err}</div>}
      {intro && <p style={{ fontSize: 14.5, lineHeight: 1.5, margin: "16px 2px 4px" }}>{intro}</p>}
      {searches.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
          {searches.map((sTxt, i) => (
            <a key={i} href={ytUrl(sTxt)} target="_blank" rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 12, background: T.card, borderRadius: 16, padding: 14,
                boxShadow: T.soft, textDecoration: "none", color: T.ink }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "#fbe1e1", display: "grid", placeItems: "center", flexShrink: 0 }}>
                <Youtube size={20} color="#cf5147" />
              </div>
              <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600, lineHeight: 1.35 }}>{sTxt}</span>
              <ExternalLink size={16} color={T.sub} />
            </a>
          ))}
        </div>
      )}
      <p style={{ fontSize: 11, color: T.sub, textAlign: "center", marginTop: 16, lineHeight: 1.5 }}>
        Videos open on YouTube and aren't made or vetted by The Resilience Hub.
      </p>
      <Disclaimer />
    </>
  );
}

const SELFHELP_SYSTEM = `You help someone find self-help, motivational, or personal-growth talks and videos for what they're working on. Given what they describe, reply with ONLY a JSON object (no markdown, no preamble) in this shape:
{"intro":"one warm sentence to them","searches":["short specific youtube search phrase", "...", "3 to 4 total"]}
Make each phrase a good, specific search for an inspiring talk or video — e.g. "Tony Robbins overcoming fear speech", "Brené Brown vulnerability talk", "motivational speech for tough times", "morning motivation to build confidence". You can include well-known speakers when they fit. Keep them uplifting, encouraging, and appropriate for someone working on their wellbeing. Nothing that shames, pressures, or pushes extreme or unsafe ideas.`;

function SelfHelpTool({ onBack }) {
  const [q, setQ] = useState("");
  const [intro, setIntro] = useState("");
  const [searches, setSearches] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ytUrl = (s) => "https://www.youtube.com/results?search_query=" + encodeURIComponent(s);

  const find = async (text) => {
    const query = (text ?? q).trim();
    if (!query || busy) return;
    setBusy(true); setErr(""); setIntro(""); setSearches([]);
    try {
      const reply = await callModel({ system: SELFHELP_SYSTEM, messages: [{ role: "user", content: query }], maxTokens: 500 });
      const clean = reply.split("\u0060\u0060\u0060json").join("").split("\u0060\u0060\u0060").join("").trim();
      let data = null;
      try { data = JSON.parse(clean); } catch {}
      if (data && Array.isArray(data.searches) && data.searches.length) {
        setIntro(data.intro || "");
        setSearches(data.searches.slice(0, 5));
      } else {
        setSearches([query + " motivational speech"]);
      }
    } catch (e) { setErr("Couldn't fetch suggestions just now — try again in a moment."); }
    finally { setBusy(false); }
  };

  const quick = ["Motivation to start", "Building confidence", "Overcoming fear", "Bouncing back from a setback", "Finding purpose"];

  return (
    <>
      <Brand right={<BackBtn onBack={onBack} label="Toolkit" />} />
      <SectionTitle>Self-help videos</SectionTitle>
      <div style={{ background: "linear-gradient(135deg, #fff7ea 0%, #fff0d9 52%, #f8e9ff 100%)", borderRadius: 20, padding: 17, margin: "0 0 16px", border: "1px solid rgba(208,138,79,0.14)", boxShadow: "0 8px 20px rgba(152,111,66,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{ width: 38, height: 38, borderRadius: 13, background: "rgba(255,255,255,0.78)", display: "grid", placeItems: "center" }}><Sparkles size={19} color="#c47d43" /></div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>A better kind of rabbit hole</div>
            <div style={{ fontSize: 11.5, color: "#926d4d", fontWeight: 700, letterSpacing: 0.25 }}>7 hand-picked places to start</div>
          </div>
        </div>
        <p style={{ fontSize: 13.5, color: T.ink, margin: 0, lineHeight: 1.55 }}>
          Explore a useful idea, hear a different perspective, or find a practical skill to try today. Choose what meets you where you are.
        </p>
      </div>

      {[
        { group: "Mindset & personal growth", icon: Flame, accent: "#d0904e", tint: "#fde7cf", items: [
          { name: "Tony Robbins", title: "Build resilience and break old patterns", url: "https://youtube.com/@TonyRobbinsLive", desc: "Motivation, courage, life direction, and bouncing back when things feel stuck." },
          { name: "Dr Julie Smith", title: "Practical tools for anxiety and self-doubt", url: "https://youtube.com/@drjulie", desc: "Clear, grounded mental-health guidance from a clinical psychologist." },
          { name: "The School of Life", title: "Understand yourself and your relationships", url: "https://youtube.com/@TheSchoolOfLife", desc: "Gentle ideas for self-understanding, connection, calm, and balance." },
          { name: "Tara Brach", title: "Mindfulness, self-compassion, and healing", url: "https://youtube.com/@TaraBrach", desc: "Warm reflections for meeting stress and difficult feelings with care." },
        ]},
        { group: "AI learning & practical skills", icon: Zap, accent: "#6f82c8", tint: "#e8edff", items: [
          { name: "Danny Why", title: "Make AI useful in everyday life", url: "https://youtube.com/@danny_why", desc: "Simple tutorials for creating, organising, and saving time with AI tools." },
          { name: "Matt Wolfe", title: "A no-nonsense guide to modern AI", url: "https://youtube.com/@mreflow", desc: "Approachable guides to ChatGPT, Claude, and practical AI workflows." },
        ]},
        { group: "Science & wellbeing", icon: Radio, accent: "#4f9d8b", tint: "#e2f5ef", items: [
          { name: "Huberman Lab", title: "The science behind focus, sleep, and energy", url: "https://youtube.com/@hubermanlab", desc: "Neuroscience ideas translated into habits for everyday wellbeing." },
        ]},
      ].map((sec) => (
        <div key={sec.group} style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 2px 9px" }}>
            <div style={{ width: 23, height: 23, borderRadius: 8, background: sec.tint, display: "grid", placeItems: "center" }}><sec.icon size={13} color={sec.accent} /></div>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: T.sub, textTransform: "uppercase", letterSpacing: 0.55 }}>{sec.group}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {sec.items.map((c, index) => (
              <a key={c.name} href={c.url} target="_blank" rel="noopener noreferrer" aria-label={`Explore ${c.title} from ${c.name} on YouTube`}
                style={{ display: "flex", alignItems: "center", gap: 12, background: index % 2 === 0 ? "linear-gradient(110deg, #ffffff 0%, #fffaf5 100%)" : "linear-gradient(110deg, #ffffff 0%, #f8f7ff 100%)", borderRadius: 17, padding: 13,
                  border: `1px solid ${sec.accent}22`, boxShadow: "0 5px 14px rgba(45,43,49,0.06)", textDecoration: "none", color: T.ink }}>
                <div style={{ width: 42, height: 42, borderRadius: 13, background: sec.tint, display: "grid", placeItems: "center", flexShrink: 0, position: "relative" }}>
                  <sec.icon size={19} color={sec.accent} />
                  <span style={{ position: "absolute", right: -5, top: -6, minWidth: 17, height: 17, borderRadius: 9, background: T.card, color: sec.accent, fontSize: 10, fontWeight: 800, display: "grid", placeItems: "center", boxShadow: "0 2px 5px rgba(40,38,47,0.14)" }}>{index + 1}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14.5, lineHeight: 1.25 }}>{c.title}</div>
                  <div style={{ fontSize: 11.5, color: sec.accent, fontWeight: 800, marginTop: 3 }}>{c.name}</div>
                  <div style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.4, marginTop: 3 }}>{c.desc}</div>
                </div>
                <div style={{ display: "grid", placeItems: "center", width: 27, height: 27, borderRadius: 9, background: sec.tint, flexShrink: 0 }}><ExternalLink size={14} color={sec.accent} /></div>
              </a>
            ))}
          </div>
        </div>
      ))}

      <div style={{ height: 1, background: T.line, margin: "4px 2px 16px" }} />
      <div style={{ fontWeight: 700, margin: "0 2px 8px" }}>Search for a talk</div>
      <p style={{ fontSize: 13, color: T.sub, margin: "0 2px 12px", lineHeight: 1.5 }}>
        Tell me what you're working on — or name a speaker you like — and I'll find talks for it. Tap one to watch on YouTube.
      </p>
      <textarea value={q} onChange={(e) => setQ(e.target.value)} rows={2}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); find(); } }}
        placeholder="e.g. getting motivated, believing in myself, a Tony Robbins talk…"
        style={{ ...inputStyle, resize: "none", minHeight: 64 }} />
      <div style={{ marginTop: 10 }}>
        <Btn onClick={() => find()} disabled={busy || !q.trim()}>{busy ? "Finding…" : "Find talks"}</Btn>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        {quick.map((x) => (
          <button key={x} onClick={() => { setQ(x); find(x); }} disabled={busy}
            style={{ borderRadius: 999, padding: "8px 13px", fontSize: 13, border: `1px solid ${T.line}`,
              background: "#fff", cursor: busy ? "default" : "pointer", color: T.ink, boxShadow: T.soft }}>{x}</button>
        ))}
      </div>

      {err && <div style={{ fontSize: 13, color: "#c0392b", marginTop: 12 }}>{err}</div>}
      {intro && <p style={{ fontSize: 14.5, lineHeight: 1.5, margin: "16px 2px 4px" }}>{intro}</p>}
      {searches.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
          {searches.map((sTxt, i) => (
            <a key={i} href={ytUrl(sTxt)} target="_blank" rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 12, background: "linear-gradient(110deg, #fffaf4 0%, #f9f4ff 100%)", borderRadius: 16, padding: 14,
                border: "1px solid rgba(208,138,79,0.14)", boxShadow: T.soft, textDecoration: "none", color: T.ink }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(145deg, #d0904e, #e5b47e)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                <Play size={18} color="#ffffff" fill="#ffffff" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.35 }}>{sTxt}</div>
                <div style={{ fontSize: 10.5, color: "#b27643", fontWeight: 800, letterSpacing: 0.35, textTransform: "uppercase", marginTop: 4 }}>Watch on YouTube</div>
              </div>
              <ExternalLink size={16} color="#d0904e" />
            </a>
          ))}
        </div>
      )}
      <p style={{ fontSize: 11, color: T.sub, textAlign: "center", marginTop: 16, lineHeight: 1.5 }}>
        Videos open on YouTube and aren't made or vetted by The Resilience Hub.
      </p>
      <Disclaimer />
    </>
  );
}

function SafetyTool({ onBack }) {
  const services = [
    { name: "Emergency", detail: "Call 000 now if someone is unconscious, not breathing normally, fitting, or you're scared for their life. Ambulances are there to help — not to get anyone in trouble.", tel: "000", accent: true },
    { name: "National Alcohol & Other Drug Hotline", detail: "Free, confidential advice and counselling, 24/7. Connects you to support in your state or territory.", tel: "1800250015", num: "1800 250 015" },
    { name: "Lifeline", detail: "24/7 crisis support for anyone doing it tough.", tel: "131114", num: "13 11 14" },
  ];
  return (
    <>
      <Brand right={<BackBtn onBack={onBack} label="Toolkit" />} />
      <SectionTitle>Staying safe</SectionTitle>
      <p style={{ fontSize: 13.5, color: T.sub, margin: "0 2px 14px", lineHeight: 1.5 }}>
        No judgement here. If you or someone you know uses substances, these are the things that genuinely
        keep people safe and alive — and the people you can call any time.
      </p>

      <div style={{ fontWeight: 700, margin: "0 2px 4px" }}>Detox &amp; rehab — Western Sydney</div>
      <p style={{ fontSize: 12.5, color: T.sub, margin: "0 2px 10px", lineHeight: 1.5 }}>
        Free NSW Health drug &amp; alcohol services (detox, rehab, opioid treatment, counselling). You can call to
        ask about options for yourself or someone else — self-referral is accepted, no Medicare fee.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[
          { name: "Corella Inpatient Withdrawal Unit (Fairfield)", num: "1300 031 131", tel: "1300031131", note: "Detox at Fairfield Hospital, Prairiewood (SWSLHD) · via Drug & Alcohol Central Intake · adults 18+, self-referral accepted", feature: true },
          { name: "WSLHD Drug Health — Central Intake", num: "(02) 8860 2565", tel: "0288602565", note: "Main line for detox, rehab & referrals · Mon–Fri 8:45am–4:45pm (after-hours answering service)" },
          { name: "NSW Alcohol & Drug Info Service (ADIS)", num: "1800 250 015", tel: "1800250015", note: "Free, confidential advice & referral, 24/7 — anywhere in NSW" },
          { name: "Cumberland Centre for Addiction Medicine", num: "(02) 8860 2565", tel: "0288602565", note: "Westmead area" },
          { name: "Mount Druitt Centre for Addiction Medicine", num: "(02) 8887 5800", tel: "0288875800", note: "Mount Druitt area" },
          { name: "Fleet Street Opioid Treatment Unit", num: "(02) 9840 3888", tel: "0298403888", note: "North Parramatta" },
          { name: "Blacktown Methadone Clinic", num: "(02) 8670 0200", tel: "0286700200", note: "Blacktown area" },
        ].map((s) => (
          <a key={s.name} href={`tel:${s.tel}`} style={{ display: "flex", alignItems: "center", gap: 12,
            background: s.feature ? "#eaf6ef" : T.card, border: s.feature ? `1px solid ${T.green}` : "none",
            borderRadius: 16, padding: 14, boxShadow: T.soft, textDecoration: "none", color: T.ink }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: s.feature ? T.green : "#e2eefb", display: "grid", placeItems: "center", flexShrink: 0 }}>
              <Phone size={18} color={s.feature ? "#fff" : "#3b7fca"} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>{s.name}</div>
              <div style={{ fontSize: 13, color: T.green, fontWeight: 600 }}>{s.num}</div>
              <div style={{ fontSize: 12, color: T.sub, lineHeight: 1.4, marginTop: 1 }}>{s.note}</div>
            </div>
          </a>
        ))}
      </div>

      <div style={{ background: "#fdecec", border: "1px solid #f3c1c1", borderRadius: 16, padding: 16, marginBottom: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6, color: "#c0392b" }}>If something's going wrong right now</div>
        <p style={{ fontSize: 14, lineHeight: 1.55, margin: 0 }}>
          If someone has taken something and is hard to wake, breathing strangely, has blue lips, is fitting, or
          you just feel scared for them — <strong>call 000 straight away</strong>. Don't wait to see if it passes,
          and don't leave them alone. Tell the operator what you know; you won't get in trouble for getting help.
          Put them on their side while you wait.
        </p>
        <a href="tel:000" style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 12,
          background: "#e5484d", color: "#fff", textDecoration: "none", borderRadius: 12, padding: "11px 18px", fontWeight: 700 }}>
          <Phone size={16} /> Call 000
        </a>
      </div>

      <div style={{ background: T.card, borderRadius: 16, padding: 16, boxShadow: T.soft, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Naloxone can reverse an opioid overdose</div>
        <p style={{ fontSize: 14, lineHeight: 1.55, margin: "0 0 8px" }}>
          Naloxone is a safe medicine that can temporarily reverse an overdose from opioids (like heroin, oxycodone,
          fentanyl, or methadone). In Australia it's <strong>free and needs no prescription</strong> through the
          national Take Home Naloxone program — you can get it from many pharmacies and needle &amp; syringe programs,
          as a nasal spray or injection, for yourself or to help someone else.
        </p>
        <p style={{ fontSize: 13, color: T.sub, lineHeight: 1.55, margin: 0 }}>
          It only works on opioids and wears off in 30–90 minutes, so always call 000 as well. Ask a pharmacist or
          call the hotline below about getting a kit and how to use it.
        </p>
      </div>

      <div style={{ fontWeight: 700, margin: "0 2px 10px" }}>People you can call</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {services.map((s) => (
          <a key={s.name} href={`tel:${s.tel}`} style={{ display: "flex", alignItems: "center", gap: 12,
            background: s.accent ? "#fdecec" : T.card, border: s.accent ? "1px solid #f3c1c1" : "none",
            borderRadius: 16, padding: 14, boxShadow: T.soft, textDecoration: "none", color: T.ink }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: s.accent ? "#e5484d" : "#e2eefb",
              display: "grid", placeItems: "center", flexShrink: 0 }}>
              <Phone size={18} color={s.accent ? "#fff" : "#3b7fca"} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>{s.name}{s.num ? ` · ${s.num}` : ""}</div>
              <div style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.45, marginTop: 2 }}>{s.detail}</div>
            </div>
          </a>
        ))}
      </div>

      <p style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.55, margin: "16px 2px 0", textAlign: "center" }}>
        Using something doesn't make you a lost cause, and it doesn't mean you're on your own. Juan and the guides
        are here whenever you want to talk.
      </p>
      <Disclaimer />
    </>
  );
}

function QuickCalm({ onBack }) {
  return (
    <>
      <Brand right={<BackBtn onBack={onBack} label="Toolkit" />} />
      <SectionTitle>Quick calm</SectionTitle>
      <p style={{ fontSize: 13.5, color: T.sub, margin: "0 2px 14px", lineHeight: 1.5 }}>
        Small things to try when it's all a bit much. Pick one — that's plenty.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {CALM_TIPS.map((tip, k) => (
          <div key={k} style={{ background: T.card, borderRadius: 16, padding: "14px 16px", boxShadow: T.soft,
            display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ width: 26, height: 26, borderRadius: 8, background: "#fbf1d6", display: "grid",
              placeItems: "center", flexShrink: 0, marginTop: 1 }}>
              <Sparkles size={15} color="#c9a227" />
            </div>
            <div style={{ fontSize: 14.5, lineHeight: 1.5 }}>{tip}</div>
          </div>
        ))}
      </div>
      <Disclaimer />
    </>
  );
}

/* ---------- auth: login ---------- */
function Login({ onGuest }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const withEmail = async () => {
    setErr(null); setNotice(null);
    if (!email.trim() || !pw) { setErr("Please enter your email and password."); return; }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email: email.trim(), password: pw });
        if (error) throw error;
        setNotice("Account created. If prompted, confirm via the email we sent, then sign in.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
        if (error) throw error;
      }
    } catch (e) { setErr(e.message || "Something went wrong. Please try again."); }
    finally { setBusy(false); }
  };

  const withGoogle = async () => {
    setErr(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        // prompt: "select_account" stops Google from silently reusing whichever
        // account was used last — without it, "Continue with Google" after
        // signing out just logs back into the same account with no way to pick
        // a different one on a shared device.
        options: { redirectTo: window.location.origin, queryParams: { prompt: "select_account" } },
      });
      if (error) throw error;
    } catch (e) { setErr(e.message || "Couldn't start Google sign-in."); }
  };

  const resetPassword = async () => {
    setErr(null); setNotice(null);
    if (!email.trim()) { setErr("Enter your email above first, then tap this again."); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      setNotice("If an account exists for that email, a reset link is on its way. Open it to set a new password.");
    } catch (e) { setErr(e.message || "Couldn't send the reset email."); }
    finally { setBusy(false); }
  };

  return (
    <>
      <Brand />
      <div style={{ paddingTop: 8 }}>
        <div className="rh-in" style={{ background: T.card, borderRadius: 22, padding: 18, boxShadow: T.soft, margin: "0 0 16px" }}>
          <p style={{ margin: "0 0 14px", fontSize: 14, lineHeight: 1.55, color: T.ink }}>
            The Resilience Hub is a free, judgment-free space for everyday mental health and
            wellbeing support. Chat with AI guides who are here to listen any time, work through
            an optional 8-week plan at your own pace, journal privately, and reach for calming
            tools whenever you need them. It's a support tool — not a replacement for a doctor,
            psychologist, or emergency service.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { Icon: MessageCircle, label: "AI guides, any time" },
              { Icon: CalendarCheck, label: "An optional 8-week plan" },
              { Icon: BookOpen, label: "A private journal" },
              { Icon: Wrench, label: "A self-help toolkit" },
              { Icon: Gamepad2, label: "Free games & puzzles" },
              { Icon: LifeBuoy, label: "Crisis support on-screen" },
            ].map(({ Icon, label }, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 9, background: "#eaf5ef",
                  display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <Icon size={14} color={T.greenDk} />
                </div>
                <span style={{ fontSize: 12, color: T.ink, lineHeight: 1.3 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
        <Portrait src={IMG.rex} name="Rex" size={116} tint="#dff5e4" />
        <div className="rh-in" style={{ background: T.card, borderRadius: 22, padding: 18, boxShadow: T.soft, margin: "18px 0" }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>{mode === "signup" ? "Create your account" : "Welcome back"}</h2>
          <p style={{ margin: "0 0 14px", fontSize: 13.5, color: T.sub, lineHeight: 1.5 }}>
            Sign in to continue — your space here is private to you.
          </p>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email"
            autoComplete="email" style={{ ...inputStyle, marginBottom: 10 }} />
          <div style={{ position: "relative" }}>
            <input type={showPw ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              onKeyDown={(e) => e.key === "Enter" && withEmail()} style={{ ...inputStyle, paddingRight: 46 }} />
            <button type="button" onClick={() => setShowPw((v) => !v)}
              aria-label={showPw ? "Hide password" : "Show password"} title={showPw ? "Hide password" : "Show password"}
              style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none",
                border: "none", cursor: "pointer", color: T.sub, padding: 8, display: "grid", placeItems: "center" }}>
              {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {err && <div style={{ color: "#c0392b", fontSize: 13, marginTop: 10, lineHeight: 1.4 }}>{err}</div>}
          {notice && <div style={{ color: T.greenDk, fontSize: 13, marginTop: 10, lineHeight: 1.4 }}>{notice}</div>}
          <div style={{ marginTop: 14 }}>
            <Btn onClick={withEmail} disabled={busy}>{busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}</Btn>
          </div>
          <button onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setErr(null); setNotice(null); }}
            style={{ background: "none", border: "none", color: T.green, cursor: "pointer", fontSize: 13, marginTop: 12, fontWeight: 600 }}>
            {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
          </button>
          {mode === "signin" && (
            <div>
              <button onClick={resetPassword} disabled={busy}
                style={{ background: "none", border: "none", color: T.sub, cursor: "pointer", fontSize: 12.5, marginTop: 10, textDecoration: "underline" }}>
                Forgot or need to set a password?
              </button>
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "2px 0 14px", color: T.sub, fontSize: 12 }}>
          <div style={{ flex: 1, height: 1, background: T.line }} /> or <div style={{ flex: 1, height: 1, background: T.line }} />
        </div>
        <Btn kind="outline" onClick={withGoogle}>Continue with Google</Btn>
        {onGuest && (
          <button onClick={onGuest} style={{ display: "block", width: "100%", background: "none", border: "none",
            color: T.sub, cursor: "pointer", fontSize: 12.5, marginTop: 14, textDecoration: "underline", textAlign: "center" }}>
            Just testing or previewing? Continue without an account
          </button>
        )}
        <Disclaimer />
      </div>
    </>
  );
}

/* ---------- admin (role-gated) ---------- */
const ADMIN_SYSTEM = `You are the Resilience Hub Admin Assistant, helping the app's owner (an administrator) improve the app.
You can: draft or rewrite program content and copy, suggest wording for the guides' tone or the 8-week plan, propose small feature ideas, and help diagnose bugs or deployment errors by explaining likely causes and the exact steps or code to change.
You do NOT change the live app yourself — you produce drafts and instructions the admin reviews and applies. Never claim you have edited or deployed anything.
For anything touching safety (crisis numbers, disclaimers, self-harm handling), do not casually rewrite it: flag that it is safety-critical, keep it conservative, and recommend careful human review and sign-off from Carlos Camacho (Registered Psychologist). Stay aligned with the lived-experience mission. Be concise, warm, and practical.`;

function GuidePersonalityEditor({ guidePrompts, onSave }) {
  const order = ["juan", "carlos", "mick", "lila", "rex"];
  const [slug, setSlug] = useState("juan");
  const current = guidePrompts?.[slug] ?? PERSONALITY_DEFAULTS[slug];
  const [draft, setDraft] = useState(current);
  const [status, setStatus] = useState("");

  // keep the box in sync when switching guides
  useEffect(() => { setDraft(guidePrompts?.[slug] ?? PERSONALITY_DEFAULTS[slug]); setStatus(""); }, [slug, guidePrompts]);

  const dirty = draft !== current;
  const isDefault = current === PERSONALITY_DEFAULTS[slug];

  return (
    <>
      <SectionTitle>Guide personalities</SectionTitle>
      <p style={{ fontSize: 13, color: T.sub, margin: "0 2px 10px", lineHeight: 1.5 }}>
        Fine-tune how each guide talks and feels — their tone, humour, and character. Changes go live for everyone
        straight away. The safety rules, their role, and what they remember are locked underneath and can't be changed here.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {order.map((s) => (
          <button key={s} onClick={() => setSlug(s)}
            style={{ borderRadius: 999, padding: "8px 14px", fontSize: 13.5, fontWeight: 600, cursor: "pointer",
              border: slug === s ? `2px solid ${T.green}` : `1px solid ${T.line}`,
              background: slug === s ? "#eaf6ef" : "#fff", color: T.ink }}>
            {CHARS[s].name}
          </button>
        ))}
      </div>

      <div style={{ background: T.card, borderRadius: 18, padding: 16, boxShadow: T.soft }}>
        <div style={{ fontWeight: 700, marginBottom: 2 }}>{CHARS[slug].name}'s personality</div>
        <div style={{ fontSize: 12, color: T.sub, marginBottom: 10 }}>{CHARS[slug].role}</div>
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={8}
          style={{ width: "100%", resize: "vertical", borderRadius: 12, border: `1px solid ${T.line}`, padding: "12px 13px",
            fontSize: 14, lineHeight: 1.5, background: "#fff", color: T.ink, outline: "none", fontFamily: "inherit" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          <button onClick={() => { onSave(slug, draft.trim()); setStatus("Saved — live now."); setTimeout(() => setStatus(""), 2500); }}
            disabled={!dirty}
            style={{ background: dirty ? `linear-gradient(180deg, #3fb072, ${T.green})` : "#cfc6da", color: "#fff",
              border: "none", borderRadius: 12, padding: "11px 20px", fontSize: 14.5, fontWeight: 700, cursor: dirty ? "pointer" : "default" }}>
            Save changes
          </button>
          <button onClick={() => { setDraft(PERSONALITY_DEFAULTS[slug]); }}
            disabled={draft === PERSONALITY_DEFAULTS[slug]}
            style={{ background: "#fff", color: T.ink, border: `1px solid ${T.line}`, borderRadius: 12,
              padding: "11px 16px", fontSize: 14, fontWeight: 600, cursor: draft === PERSONALITY_DEFAULTS[slug] ? "default" : "pointer",
              opacity: draft === PERSONALITY_DEFAULTS[slug] ? 0.5 : 1 }}>
            Reset to default
          </button>
          <span style={{ fontSize: 12.5, color: status ? T.greenDk : T.sub }}>
            {status || (isDefault ? "Using the original personality" : "Customised")}
          </span>
        </div>
      </div>
    </>
  );
}

function Admin({ isAdmin, guidePrompts, onSaveGuidePrompt, onBack }) {
  const [view, setView] = useState(null);       // null | "members" | "safety" | "welcome" | "guides" | "notify" | "assistant"
  const [member, setMember] = useState(null);   // a selected member row
  if (!isAdmin) {
    return (
      <>
        <Brand right={<BackBtn onBack={onBack} />} />
        <div className="rh-in" style={{ background: T.card, borderRadius: 20, padding: 20, boxShadow: T.soft, marginTop: 20 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Admins only</div>
          <p style={{ fontSize: 14, color: T.sub, lineHeight: 1.5 }}>This area is limited to administrators.</p>
        </div>
      </>
    );
  }
  if (member) return <MemberDetail member={member} onBack={() => setMember(null)} />;
  if (view === "members") return <MembersDirectory onOpen={(m) => setMember(m)} onBack={() => setView(null)} />;
  if (view === "bugreports") return <AdminBugReports onBack={() => setView(null)} />;
  if (view === "appointments") return <AdminAppointments onBack={() => setView(null)} />;

  const tools = [
    { key: "safety", Icon: LifeBuoy, tint: "#fbe4e4", ic: "#c94f4f", title: "Safety & crisis settings", sub: "Crisis numbers, disclaimers, safety rules" },
    { key: "welcome", Icon: Sparkles, tint: "#fbf1d6", ic: "#c9a227", title: "Welcome message", sub: "What Rex says to brand-new members" },
    { key: "guides", Icon: Users, tint: "#f4e3d9", ic: "#c9803f", title: "Guide personalities", sub: "Fine-tune how each guide comes across" },
    { key: "notify", Icon: Megaphone, tint: "#eee7f6", ic: "#7c5cc4", title: "Notify members", sub: "Send a broadcast, in-app and push" },
    { key: "bugreports", Icon: Flame, tint: "#fbe4e4", ic: "#c94f4f", title: "Bug reports", sub: "One-way reports from members and testers" },
    { key: "appointments", Icon: CalendarCheck, tint: "#e9f5ee", ic: "#2c7d50", title: "Appointment requests", sub: "Intake appointment requests to call people back on" },
    { key: "assistant", Icon: Sparkles, tint: "#e7eefb", ic: "#3f6faf", title: "Claude admin assistant", sub: "Drafting help — never edits the live app itself" },
  ];
  const AdminSubPage = ({ title, Icon, children }) => (
    <>
      <Brand right={<BackBtn onBack={() => setView(null)} label="Admin" />} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, marginBottom: 14 }}>
        <Icon size={18} color={T.green} />
        <h2 style={{ fontSize: 18, margin: 0 }}>{title}</h2>
      </div>
      {children}
    </>
  );
  if (view === "safety") return <AdminSubPage title="Safety & crisis settings" Icon={LifeBuoy}><AdminSafetyPanel /></AdminSubPage>;
  if (view === "welcome") return <AdminSubPage title="Welcome message" Icon={Sparkles}><AdminWelcomeEditor /></AdminSubPage>;
  if (view === "guides") return <AdminSubPage title="Guide personalities" Icon={Users}><GuidePersonalityEditor guidePrompts={guidePrompts} onSave={onSaveGuidePrompt} /></AdminSubPage>;
  if (view === "notify") return <AdminSubPage title="Notify members" Icon={Megaphone}><AdminNotify /></AdminSubPage>;
  if (view === "assistant") return <AdminSubPage title="Claude admin assistant" Icon={Sparkles}><AdminAssistant /></AdminSubPage>;

  return (
    <>
      <Brand right={<BackBtn onBack={onBack} />} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, marginBottom: 14 }}>
        <Shield size={18} color={T.green} />
        <h2 style={{ fontSize: 18, margin: 0 }}>Admin</h2>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button onClick={() => setView("members")} style={{ width: "100%", background: T.card, borderRadius: 20, padding: 16,
          boxShadow: T.soft, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: "#e9f5ee", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <User size={20} color={T.greenDk} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700 }}>Members</div>
            <div style={{ fontSize: 13, color: T.sub }}>See everyone, open a profile, add private notes</div>
          </div>
          <ChevronRight size={20} color={T.sub} />
        </button>
        {tools.map((t) => (
          <button key={t.key} onClick={() => setView(t.key)} style={{ width: "100%", background: T.card, borderRadius: 20, padding: 16,
            boxShadow: T.soft, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: t.tint, display: "grid", placeItems: "center", flexShrink: 0 }}>
              <t.Icon size={20} color={t.ic} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{t.title}</div>
              <div style={{ fontSize: 13, color: T.sub }}>{t.sub}</div>
            </div>
            <ChevronRight size={20} color={T.sub} />
          </button>
        ))}
      </div>
      <Disclaimer />
    </>
  );
}

function AdminAppointments({ onBack }) {
  const [rows, setRows] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const load = async () => {
    if (!supabase) { setRows([]); return; }
    try {
      const { data } = await supabase.from("appointment_requests").select("*").order("created_at", { ascending: false });
      setRows(data || []);
    } catch { setRows([]); }
  };
  useEffect(() => { load(); }, []);
  const archive = async (id, archived) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, archived } : r)));
    try { await supabase.from("appointment_requests").update({ archived }).eq("id", id); } catch { load(); }
  };
  const visible = (rows || []).filter((r) => (showArchived ? r.archived : !r.archived));
  return (
    <>
      <Brand right={<BackBtn onBack={onBack} label="Admin" />} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, marginBottom: 4 }}>
        <CalendarCheck size={18} color={T.greenDk} />
        <h2 style={{ fontSize: 18, margin: 0 }}>Appointment requests</h2>
      </div>
      <p style={{ fontSize: 13, color: T.sub, margin: "0 2px 10px", lineHeight: 1.5 }}>
        Intake appointment requests from the app. Call or text each person to confirm, then it's up to you to track it as booked.
      </p>
      <button onClick={() => setShowArchived((s) => !s)} style={{ background: "none", border: "none", color: T.greenDk,
        fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: "0 2px 14px", display: "block" }}>
        {showArchived ? "← Back to active requests" : "View archived requests"}
      </button>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows === null && <div style={{ color: T.sub, fontSize: 14, padding: "6px 2px" }}>Loading…</div>}
        {rows && visible.length === 0 && (
          <div style={{ color: T.sub, fontSize: 14, padding: "6px 2px" }}>
            {showArchived ? "No archived requests." : "No requests yet."}
          </div>
        )}
        {visible.map((r) => (
          <div key={r.id} style={{ background: T.card, borderRadius: 16, padding: 14, boxShadow: T.soft }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
              <span style={{ fontWeight: 700 }}>{r.name}</span>
              <span style={{ fontSize: 11, color: T.sub, flexShrink: 0 }}>{new Date(r.created_at).toLocaleString()}</span>
            </div>
            <div style={{ fontSize: 13.5, marginBottom: 4 }}>
              📞 {r.contact} {r.prefer_text ? <span style={{ color: T.sub }}>(prefers a text)</span> : <span style={{ color: T.sub }}>(prefers a call)</span>}
            </div>
            <div style={{ fontSize: 13.5, color: T.sub, marginBottom: 10 }}>
              {r.any_time ? "Any time works" : r.preferred_time}
            </div>
            <button onClick={() => archive(r.id, !r.archived)} style={{ background: "none", border: `1px solid ${T.line}`,
              borderRadius: 999, padding: "6px 12px", fontSize: 12, fontWeight: 700, color: T.sub, cursor: "pointer" }}>
              {r.archived ? "Unarchive" : "Archive"}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

function AdminBugReports({ onBack }) {
  const [rows, setRows] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [screenshotUrls, setScreenshotUrls] = useState({});
  const load = async () => {
    if (!supabase) { setRows([]); return; }
    try {
      const { data } = await supabase.from("bug_reports").select("*").order("created_at", { ascending: false });
      const reports = data || [];
      setRows(reports);
      const withScreenshots = reports.filter((r) => r.screenshot_path);
      if (withScreenshots.length) {
        const signed = await Promise.all(withScreenshots.map(async (r) => {
          const { data: link } = await supabase.storage.from("bug-screenshots").createSignedUrl(r.screenshot_path, 3600);
          return [r.id, link?.signedUrl || null];
        }));
        setScreenshotUrls(Object.fromEntries(signed.filter(([, url]) => url)));
      }
    } catch { setRows([]); }
  };
  useEffect(() => { load(); }, []);
  const archive = async (id, archived) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, archived } : r)));
    try { await supabase.from("bug_reports").update({ archived }).eq("id", id); } catch { load(); }
  };
  const visible = (rows || []).filter((r) => (showArchived ? r.archived : !r.archived));
  return (
    <>
      <Brand right={<BackBtn onBack={onBack} label="Admin" />} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, marginBottom: 4 }}>
        <Flame size={18} color="#c94f4f" />
        <h2 style={{ fontSize: 18, margin: 0 }}>Bug reports</h2>
      </div>
      <p style={{ fontSize: 13, color: T.sub, margin: "0 2px 10px", lineHeight: 1.5 }}>
        One-way — reports members and testers send in. There's no reply thread here, just the list.
      </p>
      <button onClick={() => setShowArchived((s) => !s)} style={{ background: "none", border: "none", color: T.greenDk,
        fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: "0 2px 14px", display: "block" }}>
        {showArchived ? "← Back to active reports" : "View archived reports"}
      </button>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows === null && <div style={{ color: T.sub, fontSize: 14, padding: "6px 2px" }}>Loading…</div>}
        {rows && visible.length === 0 && (
          <div style={{ color: T.sub, fontSize: 14, padding: "6px 2px" }}>
            {showArchived ? "No archived reports." : "No bug reports yet."}
          </div>
        )}
        {visible.map((r) => (
          <div key={r.id} style={{ background: T.card, borderRadius: 16, padding: 14, boxShadow: T.soft }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
              <span style={{ fontWeight: 700 }}>{r.name || "Anonymous"}</span>
              <span style={{ fontSize: 11, color: T.sub, flexShrink: 0 }}>{new Date(r.created_at).toLocaleString()}</span>
            </div>
            {r.email && <div style={{ fontSize: 12, color: T.sub, marginBottom: 6 }}>{r.email}</div>}
            {typeof r.description === "string" && r.description.startsWith("[User Feedback]\n\n") && (
              <div style={{ display: "inline-block", fontSize: 11, fontWeight: 800, color: T.greenDk, background: "#e6f3ec", borderRadius: 999, padding: "4px 8px", marginBottom: 8 }}>
                User Feedback
              </div>
            )}
            <div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap", marginBottom: 10 }}>
              {typeof r.description === "string" && r.description.startsWith("[User Feedback]\n\n") ? r.description.slice("[User Feedback]\n\n".length) : r.description}
            </div>
            {screenshotUrls[r.id] && (
              <a href={screenshotUrls[r.id]} target="_blank" rel="noopener noreferrer" style={{ display: "block", marginBottom: 10 }}>
                <img src={screenshotUrls[r.id]} alt="Screenshot attached to this bug report" style={{ display: "block", width: "100%", maxHeight: 260, objectFit: "contain", borderRadius: 12, border: `1px solid ${T.line}`, background: "#f7faf8" }} />
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: T.greenDk, fontSize: 12, fontWeight: 700, marginTop: 5 }}>Open full-size screenshot <ExternalLink size={13} /></span>
              </a>
            )}
            <button onClick={() => archive(r.id, !r.archived)} style={{ background: "none", border: `1px solid ${T.line}`,
              borderRadius: 999, padding: "6px 12px", fontSize: 12, fontWeight: 700, color: T.sub, cursor: "pointer" }}>
              {r.archived ? "Unarchive" : "Archive"}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

function MembersDirectory({ onOpen, onBack }) {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => {
    (async () => {
      if (!supabase) { setErr("Connect Supabase to see members."); setRows([]); return; }
      try {
        const { data, error } = await supabase.from("profiles")
          .select("id,email,preferred_name,pronouns,bio,avatar").order("email", { ascending: true });
        if (error) throw error;
        setRows(data || []);
      } catch (e) { setErr("Couldn't load members — have you run the members SQL in SUPABASE_SETUP.md?"); setRows([]); }
    })();
  }, []);
  const list = (rows || []).filter((m) => {
    const s = (q || "").toLowerCase();
    if (!s) return true;
    return (m.preferred_name || "").toLowerCase().includes(s) || (m.email || "").toLowerCase().includes(s);
  });
  return (
    <>
      <Brand right={<BackBtn onBack={onBack} label="Admin" />} />
      <SectionTitle>Members{rows ? ` · ${rows.length}` : ""}</SectionTitle>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email…"
        style={{ ...inputStyle, marginBottom: 12 }} />
      {rows === null && <div style={{ color: T.sub, fontSize: 14, padding: "8px 2px" }}>Loading…</div>}
      {err && <div style={{ fontSize: 13, color: "#c0392b", marginBottom: 10, lineHeight: 1.5 }}>{err}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {list.map((m) => {
          const nm = m.preferred_name || "Unnamed member";
          const init = (m.preferred_name || m.email || "?").trim().charAt(0).toUpperCase();
          return (
            <button key={m.id} onClick={() => onOpen(m)} style={{ width: "100%", display: "flex", alignItems: "center",
              gap: 12, background: T.card, borderRadius: 16, padding: 12, cursor: "pointer", boxShadow: T.soft, border: "none", textAlign: "left" }}>
              <div style={{ width: 42, height: 42, borderRadius: "50%", overflow: "hidden", flexShrink: 0,
                background: "#e9f5ee", display: "grid", placeItems: "center", color: T.greenDk, fontWeight: 800 }}>
                {m.avatar ? <img src={m.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : init}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{nm}</div>
                <div style={{ fontSize: 12.5, color: T.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.email || "—"}</div>
              </div>
              <ChevronRight size={18} color={T.sub} />
            </button>
          );
        })}
        {rows && list.length === 0 && !err && <div style={{ color: T.sub, fontSize: 14 }}>No members match that search.</div>}
      </div>
      <Disclaimer />
    </>
  );
}

function MemberDetail({ member, onBack }) {
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");
  useEffect(() => {
    (async () => {
      if (!supabase) return;
      try {
        const { data } = await supabase.from("admin_notes").select("notes").eq("id", member.id).single();
        if (data && data.notes) setNotes(data.notes);
      } catch {}
    })();
  }, [member]);
  const saveNotes = async () => {
    if (!supabase) { setStatus("Connect Supabase to save."); return; }
    setStatus("Saving…");
    try {
      const { error } = await supabase.from("admin_notes").upsert({
        id: member.id, notes, updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      setStatus("Saved.");
    } catch (e) { setStatus("Couldn't save — have you run the members SQL?"); }
  };
  const nm = member.preferred_name || "Unnamed member";
  const init = (member.preferred_name || member.email || "?").trim().charAt(0).toUpperCase();
  return (
    <>
      <Brand right={<BackBtn onBack={onBack} label="Members" />} />
      <div style={{ background: T.card, borderRadius: 20, padding: 18, boxShadow: T.soft, margin: "12px 0 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", overflow: "hidden", flexShrink: 0,
            background: "#e9f5ee", display: "grid", placeItems: "center", color: T.greenDk, fontWeight: 800, fontSize: 26 }}>
            {member.avatar ? <img src={member.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : init}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{nm}</div>
            <div style={{ fontSize: 13, color: T.sub }}>{member.email || "—"}</div>
            {member.pronouns ? <div style={{ fontSize: 12.5, color: T.sub }}>{member.pronouns}</div> : null}
          </div>
        </div>
        {member.bio ? (
          <div>
            <div style={{ ...fieldLabel }}>About</div>
            <p style={{ fontSize: 14, lineHeight: 1.5, margin: "0 0 4px", whiteSpace: "pre-wrap" }}>{member.bio}</p>
          </div>
        ) : <p style={{ fontSize: 13, color: T.sub, margin: 0 }}>This member hasn't added a bio yet.</p>}
        <p style={{ fontSize: 11.5, color: T.sub, marginTop: 10, lineHeight: 1.5 }}>
          Their private contact details are not shown here — those are kept private to the member, as promised.
        </p>
      </div>

      <SectionTitle>Admin notes</SectionTitle>
      <div style={{ background: T.card, borderRadius: 20, padding: 18, boxShadow: T.soft }}>
        <p style={{ fontSize: 12.5, color: T.sub, margin: "0 0 10px", lineHeight: 1.5 }}>
          Private to you (the owner). The member cannot see these.
        </p>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5}
          placeholder="Notes about this member — support context, follow-ups, anything you need to remember…"
          style={{ ...inputStyle, resize: "none", minHeight: 120 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
          <Btn onClick={saveNotes} style={{ width: 130, height: 44 }}>Save notes</Btn>
          <span style={{ fontSize: 12.5, color: status === "Saved." ? T.greenDk : T.sub }}>{status}</span>
        </div>
      </div>
      <Disclaimer />
    </>
  );
}

function AdminSafetyPanel() {
  return (
    <div style={{ background: T.card, borderRadius: 18, padding: 16, boxShadow: T.soft, margin: "14px 0" }}>
      <div style={{ fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
        <LifeBuoy size={16} color={T.green} /> Crisis contacts (read-only)
      </div>
      <div style={{ fontSize: 13.5, lineHeight: 1.7 }}>
        {CONTACTS.map((c) => (<div key={c.label}>{c.label}: <strong>{c.number}</strong></div>))}
      </div>
      <p style={{ fontSize: 12, color: T.sub, marginTop: 10, lineHeight: 1.5 }}>
        Deliberately not editable here — changing a crisis number is high-stakes. Update it in the source
        (CONTACTS in App.jsx) and re-verify against official sources before release.
      </p>
    </div>
  );
}

function AdminWelcomeEditor() {
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
  useEffect(() => {
    (async () => {
      if (!supabase) return;
      try {
        const { data } = await supabase.from("settings").select("value").eq("key", "welcome_message").single();
        if (data && data.value) setText(data.value);
      } catch {}
    })();
  }, []);
  const save = async () => {
    if (!supabase) { setStatus("Connect Supabase to save."); return; }
    setStatus("Saving…");
    try {
      const { error } = await supabase.from("settings").upsert({ key: "welcome_message", value: text });
      if (error) throw error;
      setStatus("Saved.");
    } catch (e) { setStatus(e.message || "Couldn't save."); }
  };
  return (
    <div style={{ background: T.card, borderRadius: 18, padding: 16, boxShadow: T.soft, margin: "0 0 4px" }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Welcome note (optional)</div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
        placeholder="A short, warm note you can show people…"
        style={{ ...inputStyle, resize: "none", minHeight: 80 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
        <Btn onClick={save} style={{ width: 120, height: 44 }}>Save</Btn>
        <span style={{ fontSize: 12.5, color: T.sub }}>{status}</span>
      </div>
    </div>
  );
}

function AdminAssistant() {
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [crisisActive, setCrisisActive] = useState(false);
  const scrollRef = useRef(null);
  useEffect(() => { scrollRef.current?.scrollTo({ top: 1e6, behavior: "smooth" }); }, [history, busy]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setErr(null); setInput("");
    const next = [...history, { role: "user", content: text }];
    setHistory(next);
    setBusy(true);
    try {
      const msgs = next.slice(-16).map((m) => ({ role: m.role, content: m.content }));
      const reply = await callModel({ system: ADMIN_SYSTEM, messages: msgs, maxTokens: 1200 });
      setHistory([...next, { role: "assistant", content: reply }]);
    } catch (e) { setErr(e.message || "Couldn't reach the assistant."); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ background: T.card, borderRadius: 18, padding: 14, boxShadow: T.soft }}>
      <div ref={scrollRef} style={{ maxHeight: 340, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
        {history.length === 0 && (
          <p style={{ fontSize: 13.5, color: T.sub, lineHeight: 1.5, margin: "6px 2px" }}>
            e.g. "Rewrite week 3 of the plan to feel gentler," or "Suggest three new affirmations in Juan's voice."
          </p>
        )}
        {history.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{ maxWidth: "88%", padding: "10px 13px", borderRadius: 16, fontSize: 14.5, lineHeight: 1.5,
              whiteSpace: "pre-wrap", background: m.role === "user" ? T.green : "#f3eef7", color: m.role === "user" ? "#fff" : T.ink }}>
              {m.content}
            </div>
          </div>
        ))}
        {busy && <div style={{ fontSize: 13, color: T.sub }}>Thinking…</div>}
        {err && <div style={{ fontSize: 13, color: "#c0392b" }}>{err}</div>}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={1}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Ask the admin assistant…"
          style={{ flex: 1, resize: "none", borderRadius: 14, border: `1px solid ${T.line}`, padding: "11px 13px",
            fontSize: 14.5, maxHeight: 120, background: "#fff", color: T.ink, outline: "none", fontFamily: "inherit" }} />
        <button onClick={send} disabled={!input.trim() || busy} aria-label="Send"
          style={{ width: 46, height: 46, borderRadius: "50%", border: "none", background: T.green, color: "#fff",
            display: "grid", placeItems: "center", cursor: input.trim() ? "pointer" : "default", opacity: input.trim() ? 1 : 0.5 }}>
          <Send size={17} />
        </button>
      </div>
    </div>
  );
}

/* ---------- user profile / control panel ---------- */
function resizeImage(file, max, cb) {
  try {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        cb(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  } catch {}
}

function Profile({ session, onReset, onOpenMemory, onBack }) {
  const [confirmReset, setConfirmReset] = useState(false);
  const [p, setP] = useState({ preferred_name: "", pronouns: "", bio: "", contact_private: "", avatar: "" });
  const [status, setStatus] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwStatus, setPwStatus] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    (async () => {
      if (!supabase || !session) return;
      try {
        const { data } = await supabase.from("profiles")
          .select("preferred_name,pronouns,bio,avatar").eq("id", session.user.id).single();
        if (data) setP((prev) => ({ ...prev,
          preferred_name: data.preferred_name || "", pronouns: data.pronouns || "",
          bio: data.bio || "", avatar: data.avatar || "" }));
      } catch {}
      try {
        const { data } = await supabase.from("private_contact")
          .select("contact").eq("id", session.user.id).single();
        if (data) setP((prev) => ({ ...prev, contact_private: data.contact || "" }));
      } catch {}
    })();
  }, [session]);

  const pickAvatar = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    resizeImage(f, 256, (dataUrl) => setP((prev) => ({ ...prev, avatar: dataUrl })));
  };

  const save = async () => {
    if (!supabase || !session) { setStatus("Sign in to save."); return; }
    setStatus("Saving…");
    try {
      const { error } = await supabase.from("profiles").upsert({
        id: session.user.id,
        preferred_name: p.preferred_name, pronouns: p.pronouns, bio: p.bio,
        avatar: p.avatar, updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      // Contact details live in a separate table so they stay private — even from an admin.
      const { error: cErr } = await supabase.from("private_contact").upsert({
        id: session.user.id, contact: p.contact_private, updated_at: new Date().toISOString(),
      });
      if (cErr) throw cErr;
      setStatus("Saved.");
    } catch (e) { setStatus(e.message || "Couldn't save — is the Supabase setup done?"); }
  };

  const changePassword = async () => {
    setPwStatus("");
    if (pw1.length < 6) { setPwStatus("Use at least 6 characters."); return; }
    if (pw1 !== pw2) { setPwStatus("The two passwords don't match."); return; }
    try {
      const { error } = await supabase.auth.updateUser({ password: pw1 });
      if (error) throw error;
      setPwStatus("Password updated. You can use it to sign in next time.");
      setPw1(""); setPw2("");
    } catch (e) { setPwStatus(e.message || "Couldn't update password."); }
  };

  const seed = (p.preferred_name || (session && session.user && session.user.email) || "?").trim();
  const initial = seed ? seed.charAt(0).toUpperCase() : "?";

  return (
    <>
      <Brand right={<BackBtn onBack={onBack} />} />
      <SectionTitle>Your profile</SectionTitle>
      <p style={{ fontSize: 13, color: T.sub, margin: "0 2px 12px", lineHeight: 1.5 }}>
        This space is yours. Fill in as much or as little as you like — you can change it any time.
      </p>

      <div style={{ background: T.card, borderRadius: 20, padding: 18, boxShadow: T.soft, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
          <div style={{ width: 76, height: 76, borderRadius: "50%", overflow: "hidden", flexShrink: 0,
            background: "#e9f5ee", display: "grid", placeItems: "center", color: T.greenDk, fontWeight: 800, fontSize: 30 }}>
            {p.avatar ? <img src={p.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initial}
          </div>
          <div>
            <Btn kind="outline" onClick={() => fileRef.current && fileRef.current.click()} style={{ height: 42, width: 150 }}>
              {p.avatar ? "Change photo" : "Add a photo"}
            </Btn>
            {p.avatar && (
              <button onClick={() => setP({ ...p, avatar: "" })}
                style={{ background: "none", border: "none", color: T.sub, cursor: "pointer", fontSize: 12.5, marginTop: 8, display: "block" }}>
                Remove photo
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={pickAvatar} style={{ display: "none" }} />
        </div>

        <ProfileField label="Preferred name" value={p.preferred_name}
          onChange={(v) => setP({ ...p, preferred_name: v })} placeholder="What should we call you?" />
        <ProfileField label="Pronouns" value={p.pronouns}
          onChange={(v) => setP({ ...p, pronouns: v })} placeholder="e.g. she/her, he/him, they/them" />
        <div style={{ marginBottom: 12 }}>
          <div style={fieldLabel}>About you (optional)</div>
          <textarea value={p.bio} onChange={(e) => setP({ ...p, bio: e.target.value })} rows={3}
            placeholder="A few words about you, if you'd like…" style={{ ...inputStyle, resize: "none", minHeight: 78 }} />
        </div>

        <div style={{ background: "#f6f2fa", borderRadius: 14, padding: 12, marginBottom: 14 }}>
          <div style={{ ...fieldLabel, display: "flex", alignItems: "center", gap: 6 }}>
            Contact details <span style={{ fontSize: 11, color: T.sub, fontWeight: 500 }}>· private to you</span>
          </div>
          <textarea value={p.contact_private} onChange={(e) => setP({ ...p, contact_private: e.target.value })} rows={2}
            placeholder="Phone, emergency contact, anything you want on hand…" style={{ ...inputStyle, resize: "none", minHeight: 60 }} />
          <p style={{ fontSize: 11.5, color: T.sub, marginTop: 8, lineHeight: 1.5 }}>
            Only you can ever see this — it's stored against your account and no one else, not even an admin, can read it.
          </p>
        </div>

        <Btn onClick={save}>Save profile</Btn>
        {status && <div style={{ fontSize: 13, color: status === "Saved." ? T.greenDk : T.sub, marginTop: 10, textAlign: "center" }}>{status}</div>}
      </div>

      <SectionTitle>Password</SectionTitle>
      <div style={{ background: T.card, borderRadius: 20, padding: 18, boxShadow: T.soft }}>
        <p style={{ fontSize: 13, color: T.sub, margin: "0 0 12px", lineHeight: 1.5 }}>
          Set or change a password. (If you sign in with Google, you don't need one — but you can add one here.)
        </p>
        <div style={{ position: "relative", marginBottom: 10 }}>
          <input type={showPw ? "text" : "password"} value={pw1} onChange={(e) => setPw1(e.target.value)}
            placeholder="New password" autoComplete="new-password" style={{ ...inputStyle, paddingRight: 46 }} />
          <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? "Hide password" : "Show password"}
            style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none",
              border: "none", cursor: "pointer", color: T.sub, padding: 8, display: "grid", placeItems: "center" }}>
            {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <input type={showPw ? "text" : "password"} value={pw2} onChange={(e) => setPw2(e.target.value)}
          placeholder="Confirm new password" autoComplete="new-password" style={inputStyle} />
        <div style={{ marginTop: 14 }}>
          <Btn kind="outline" onClick={changePassword}>Update password</Btn>
        </div>
        {pwStatus && <div style={{ fontSize: 13, color: pwStatus.startsWith("Password updated") ? T.greenDk : "#c0392b", marginTop: 10, textAlign: "center", lineHeight: 1.4 }}>{pwStatus}</div>}
      </div>

      <SectionTitle>What the guides remember</SectionTitle>
      <button onClick={onOpenMemory} style={{ width: "100%", background: T.card, borderRadius: 20, padding: 16,
        boxShadow: T.soft, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: "#eef1fb", display: "grid", placeItems: "center" }}>
          <Sparkles size={20} color="#5b6dd0" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700 }}>Guide memory</div>
          <div style={{ fontSize: 13, color: T.sub }}>See, edit, or clear what the guides remember — or switch it off</div>
        </div>
        <ChevronRight size={20} color={T.sub} />
      </button>

      <SectionTitle>Privacy</SectionTitle>
      <PrivacyLink variant="menu" />

      <SectionTitle>Start over</SectionTitle>
      <div style={{ background: T.card, borderRadius: 20, padding: 18, boxShadow: T.soft }}>
        <p style={{ fontSize: 13, color: T.sub, margin: "0 0 12px", lineHeight: 1.5 }}>
          This clears your journey, plan progress, journal entries, and saved conversations with the guides.
          It can't be undone. Your account stays — only your data is reset.
        </p>
        <button onClick={() => setConfirmReset(true)}
          style={{ width: "100%", background: "#e5484d", color: "#fff", border: "none", borderRadius: 14,
            padding: "13px", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: T.soft }}>
          Start over — clear my data
        </button>
      </div>

      <div style={{ textAlign: "center", marginTop: 16 }}>
        <PrivacyLink />
      </div>

      {confirmReset && (
        <div style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(44,42,51,0.45)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div className="rh-in" style={{ width: "100%", maxWidth: 360, background: T.card, borderRadius: 22,
            boxShadow: T.lift, padding: "22px 20px", textAlign: "center" }}>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>Clear everything?</div>
            <p style={{ fontSize: 14, color: T.sub, lineHeight: 1.5, margin: "0 0 18px" }}>
              This permanently clears your plan, journal, and saved conversations. This can't be undone.
            </p>
            <button onClick={() => { setConfirmReset(false); onReset && onReset(); }}
              style={{ width: "100%", background: "#e5484d", color: "#fff", border: "none", borderRadius: 14,
                padding: "13px", fontSize: 15, fontWeight: 700, cursor: "pointer", marginBottom: 10 }}>
              Yes, clear my data
            </button>
            <button onClick={() => setConfirmReset(false)}
              style={{ width: "100%", background: "#fff", color: T.ink, border: `1px solid ${T.line}`, borderRadius: 14,
                padding: "13px", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
      <Disclaimer />
    </>
  );
}

const fieldLabel = { fontSize: 12.5, fontWeight: 700, color: T.ink, marginBottom: 6 };
function ProfileField({ label, value, onChange, placeholder }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={fieldLabel}>{label}</div>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
    </div>
  );
}

/* ---------- notifications (admin -> all registered users) ---------- */
function fmtUpdDate(d) {
  try { return new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); }
  catch { return d; }
}

function Notifications({ session, onBack }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    (async () => {
      if (!supabase) { setRows([]); return; }
      try {
        const { data } = await supabase.from("notifications")
          .select("id,title,body,created_at").order("created_at", { ascending: false });
        setRows(data || []);
        // Mark everything as read now that the person has opened this screen.
        if (session && data && data.length) {
          const reads = data.map((n) => ({ user_id: session.user.id, notification_id: n.id }));
          supabase.from("notification_reads").upsert(reads, { onConflict: "user_id,notification_id" })
            .then(() => {}, () => {});
        }
      } catch { setRows([]); }
    })();
  }, [session]);
  return (
    <>
      <Brand right={<BackBtn onBack={onBack} />} />
      <SectionTitle>Notifications</SectionTitle>
      <p style={{ fontSize: 13, color: T.sub, margin: "0 2px 12px", lineHeight: 1.5 }}>
        Messages from The Resilience Hub team.
      </p>
      {rows === null && <div style={{ color: T.sub, fontSize: 14, padding: "6px 2px" }}>Loading…</div>}
      {rows && rows.length === 0 && <div style={{ color: T.sub, fontSize: 14, padding: "6px 2px" }}>Nothing yet — check back soon.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {(rows || []).map((u) => (
          <div key={u.id} style={{ background: T.card, borderRadius: 16, padding: 16, boxShadow: T.soft }}>
            <div style={{ fontSize: 12, color: "#7c5cc4", fontWeight: 700 }}>{fmtUpdDate(u.created_at)}</div>
            <div style={{ fontWeight: 700, marginTop: 2 }}>{u.title}</div>
            {u.body ? <p style={{ fontSize: 14, lineHeight: 1.5, margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{u.body}</p> : null}
          </div>
        ))}
      </div>
      <Disclaimer />
    </>
  );
}

function useUnreadNotifications(session, refreshKey) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    (async () => {
      if (!supabase || !session) { setCount(0); return; }
      try {
        const { data: all } = await supabase.from("notifications").select("id");
        const { data: read } = await supabase.from("notification_reads")
          .select("notification_id").eq("user_id", session.user.id);
        const readIds = new Set((read || []).map((r) => r.notification_id));
        setCount((all || []).filter((n) => !readIds.has(n.id)).length);
      } catch { setCount(0); }
    })();
  }, [session, refreshKey]);
  return count;
}

// Pops up automatically when someone lands on the hub with unread messages
// from the owner — impossible to miss, and impossible to get stuck in: one
// big, obvious X, always in the same spot, always closes it.
function NotificationPopup({ session, onClosed }) {
  const [unread, setUnread] = useState(null); // null = not loaded yet, [] = nothing to show
  const [i, setI] = useState(0);

  useEffect(() => {
    (async () => {
      if (!supabase || !session) { setUnread([]); return; }
      try {
        const { data: all } = await supabase.from("notifications")
          .select("id,title,body,created_at").order("created_at", { ascending: true });
        const { data: read } = await supabase.from("notification_reads")
          .select("notification_id").eq("user_id", session.user.id);
        const readIds = new Set((read || []).map((r) => r.notification_id));
        setUnread((all || []).filter((n) => !readIds.has(n.id)));
      } catch { setUnread([]); }
    })();
  }, [session]);

  const markAllReadAndClose = async () => {
    const toMark = unread || [];
    setUnread([]); // close immediately — don't make them wait on the network
    if (supabase && session && toMark.length) {
      const rows = toMark.map((n) => ({ user_id: session.user.id, notification_id: n.id }));
      supabase.from("notification_reads").upsert(rows, { onConflict: "user_id,notification_id" })
        .then(() => {}, () => {});
    }
    if (onClosed) onClosed();
  };

  if (!unread || unread.length === 0) return null;
  const n = unread[i];
  const isLast = i >= unread.length - 1;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(44,42,51,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div className="rh-in" style={{ width: "100%", maxWidth: 380, maxHeight: "82vh", background: T.card, borderRadius: 24,
        boxShadow: T.lift, position: "relative", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <button onClick={markAllReadAndClose} aria-label="Close"
          style={{ position: "absolute", top: 14, right: 14, width: 40, height: 40, borderRadius: "50%",
            border: "none", background: "#f3eef7", color: T.ink, cursor: "pointer",
            display: "grid", placeItems: "center", zIndex: 1 }}>
          <X size={20} />
        </button>
        <div style={{ padding: "22px 20px 0", overflowY: "auto", flex: 1 }}>
          <div style={{ width: 46, height: 46, borderRadius: 14, background: "#eee7f6", display: "grid",
            placeItems: "center", marginBottom: 12 }}>
            <Megaphone size={22} color="#7c5cc4" />
          </div>
          {unread.length > 1 && (
            <div style={{ fontSize: 11.5, color: T.sub, fontWeight: 700, marginBottom: 4 }}>
              {i + 1} of {unread.length}
            </div>
          )}
          <div style={{ fontWeight: 800, fontSize: 18, paddingRight: 30, lineHeight: 1.3 }}>{n.title}</div>
          {n.body ? <p style={{ fontSize: 14.5, lineHeight: 1.5, margin: "10px 0 20px", whiteSpace: "pre-wrap" }}>{n.body}</p> : null}
        </div>
        <div style={{ padding: "14px 20px 20px", flexShrink: 0 }}>
          {isLast ? (
            <Btn onClick={markAllReadAndClose}>Got it</Btn>
          ) : (
            <Btn onClick={() => setI(i + 1)}>Next</Btn>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminNotify() {
  const [rows, setRows] = useState([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("");
  const [memberCount, setMemberCount] = useState(null);
  const load = async () => {
    if (!supabase) return;
    try {
      const { data } = await supabase.from("notifications")
        .select("id,title,created_at").order("created_at", { ascending: false });
      setRows(data || []);
      const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true });
      setMemberCount(typeof count === "number" ? count : null);
    } catch {}
  };
  useEffect(() => { load(); }, []);
  const send = async () => {
    if (!title.trim()) { setStatus("Add a title first."); return; }
    if (!supabase) { setStatus("Connect Supabase to send."); return; }
    setStatus("Sending…");
    try {
      const { error } = await supabase.from("notifications").insert({ title: title.trim(), body });
      if (error) throw error;
      const t = title.trim(); setTitle(""); setBody(""); load();
      setStatus("Sent to all registered members. Sending push…");
      try {
        const r = await fetch("/api/push", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ broadcast: true, title: t, body, target: "notifications", url: "/?open=notifications" }),
        });
        const d = await r.json().catch(() => null);
        if (!r.ok) setStatus(`Sent to members, but push failed: ${(d && d.error) || "error " + r.status}`);
        else setStatus(`Sent to members. Push: reached ${d.sent} of ${d.total} device${d.total === 1 ? "" : "s"}.`);
      } catch { setStatus("Sent to members, but couldn't reach the push service."); }
    } catch (e) { setStatus("Couldn't send — have you run the notifications SQL?"); }
  };
  const del = async (id) => {
    if (!supabase) return;
    try { await supabase.from("notifications").delete().eq("id", id); load(); } catch {}
  };
  return (
    <div style={{ background: T.card, borderRadius: 18, padding: 16, boxShadow: T.soft, margin: "0 0 4px" }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>Send a notification</div>
      <p style={{ fontSize: 12.5, color: T.sub, margin: "0 0 10px", lineHeight: 1.5 }}>
        Goes to every registered member{memberCount != null ? ` (${memberCount} right now)` : ""} — they'll see it
        next time they open the app, with an unread badge on the bell.
      </p>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title — e.g. New meditation tool added"
        style={{ ...inputStyle, marginBottom: 8 }} />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2}
        placeholder="A short message…" style={{ ...inputStyle, resize: "none", minHeight: 62 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
        <Btn onClick={send} style={{ width: 160, height: 44 }}>Send to everyone</Btn>
        <span style={{ fontSize: 12.5, color: status.startsWith("Sent") ? T.greenDk : T.sub }}>{status}</span>
      </div>
      <p style={{ fontSize: 11, color: T.sub, marginTop: 10, lineHeight: 1.5 }}>
        Goes out as an in-app notification (bell icon) to everyone, plus a real push alert to
        anyone who's turned on push notifications in Settings — including when their phone/app is closed.
      </p>
      {rows.length > 0 && (
        <div style={{ marginTop: 14, borderTop: `1px solid ${T.line}`, paddingTop: 8 }}>
          {rows.map((u) => (
            <div key={u.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11.5, color: T.sub }}>{fmtUpdDate(u.created_at)}</div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{u.title}</div>
              </div>
              <button onClick={() => del(u.id)} style={{ background: "none", border: "none", color: "#c0392b", cursor: "pointer", fontSize: 12.5 }}>Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- direct messages: member <-> Juan (coordinator) ---------- */
function useUnreadCoordinator(session, refreshKey) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    (async () => {
      if (!supabase || !session) { setCount(0); return; }
      try {
        const { data } = await supabase.from("coordinator_messages")
          .select("id").eq("user_id", session.user.id).eq("sender", "coordinator").eq("read_by_user", false);
        setCount((data || []).length);
      } catch { setCount(0); }
    })();
  }, [session, refreshKey]);
  return count;
}

function useUnreadAdminMessages(isAdmin, refreshKey) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    (async () => {
      if (!supabase || !isAdmin) { setCount(0); return; }
      try {
        const { data } = await supabase.from("coordinator_messages")
          .select("id").eq("sender", "user").eq("read_by_coordinator", false);
        setCount((data || []).length);
      } catch { setCount(0); }
    })();
  }, [isAdmin, refreshKey]);
  return count;
}

function CoordinatorChat({ session, onBack }) {
  const [msgs, setMsgs] = useState(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const scrollRef = useRef(null);

  const load = async () => {
    if (!supabase || !session) { setMsgs([]); return; }
    try {
      const { data } = await supabase.from("coordinator_messages")
        .select("id,sender,body,created_at").eq("user_id", session.user.id)
        .order("created_at", { ascending: true });
      setMsgs(data || []);
      // mark Juan's messages as read now that they're on screen
      supabase.from("coordinator_messages").update({ read_by_user: true })
        .eq("user_id", session.user.id).eq("sender", "coordinator").eq("read_by_user", false)
        .then(() => {}, () => {});
    } catch { setMsgs([]); }
  };
  useEffect(() => { load(); }, [session]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: 1e6, behavior: "smooth" }); }, [msgs, busy]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy || !supabase || !session) return;
    setBusy(true); setErr(""); setInput("");
    setMsgs((m) => [...(m || []), { id: "tmp" + Date.now(), sender: "user", body: text, created_at: new Date().toISOString() }]);
    try {
      const { error } = await supabase.from("coordinator_messages")
        .insert({ user_id: session.user.id, sender: "user", body: text });
      if (error) throw error;
      load();
      fetch("/api/push", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toAdmins: true, title: `New message from ${session.user.email || "a member"}`, body: text, target: "adminMessages", url: "/?open=adminMessages" }),
      }).catch(() => {});
    } catch (e) { setErr("Couldn't send just now — have you run the messages SQL?"); }
    finally { setBusy(false); }
  };

  return (
    <>
      <Brand right={<BackBtn onBack={onBack} />} />
      <SectionTitle>Message Juan</SectionTitle>
      <div style={{ background: "#eef6f1", borderRadius: 14, padding: 12, marginBottom: 12 }}>
        <p style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.5, margin: 0 }}>
          This goes to <strong>Juan, your program coordinator — a real person</strong>, not one of the AI guides.
          He reads these himself and replies when he can, so it won't be instant. If you need help right now,
          please use the crisis support at the top of the screen — these messages aren't monitored for emergencies.
        </p>
      </div>
      <div ref={scrollRef} style={{ minHeight: 220, maxHeight: 420, overflowY: "auto", display: "flex",
        flexDirection: "column", gap: 10, padding: "4px 2px 10px" }}>
        {msgs === null && <div style={{ color: T.sub, fontSize: 14, padding: "8px 2px" }}>Loading…</div>}
        {msgs && msgs.length === 0 && (
          <div style={{ color: T.sub, fontSize: 14, textAlign: "center", padding: 20 }}>No messages yet — say hello whenever you like.</div>
        )}
        {(msgs || []).map((m) => (
          <div key={m.id} style={{ display: "flex", justifyContent: m.sender === "user" ? "flex-end" : "flex-start" }}>
            <div style={{ maxWidth: "82%", padding: "11px 14px", borderRadius: 18, fontSize: 15, lineHeight: 1.45,
              whiteSpace: "pre-wrap", background: m.sender === "user" ? T.green : "#fff",
              color: m.sender === "user" ? "#fff" : T.ink, boxShadow: T.soft }}>
              {m.sender === "coordinator" && <div style={{ fontSize: 11, fontWeight: 700, color: "#7c5cc4", marginBottom: 3 }}>Juan</div>}
              {m.body}
            </div>
          </div>
        ))}
      </div>
      {err && <div style={{ fontSize: 13, color: "#c0392b", marginBottom: 6 }}>{err}</div>}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, paddingTop: 6 }}>
        <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={1}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Write a message to Juan…"
          style={{ flex: 1, resize: "none", borderRadius: 16, border: `1px solid ${T.line}`, padding: "12px 14px",
            fontSize: 15, maxHeight: 120, background: "#fff", color: T.ink, outline: "none", fontFamily: "inherit" }} />
        <button onClick={send} disabled={!input.trim() || busy} aria-label="Send"
          style={{ width: 48, height: 48, borderRadius: "50%", border: "none", background: T.green, color: "#fff",
            display: "grid", placeItems: "center", cursor: input.trim() ? "pointer" : "default", opacity: input.trim() ? 1 : 0.5, boxShadow: T.soft }}>
          <Send size={18} />
        </button>
      </div>
      <Disclaimer />
    </>
  );
}

// Coordinator side — lives in the admin panel. Lists every member's thread and
// lets Juan (whoever mans the admin account) read and reply.
function AdminInbox({ onBack }) {
  const [rows, setRows] = useState(null);
  const [profs, setProfs] = useState({});
  const [open, setOpen] = useState(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [pushNote, setPushNote] = useState("");
  const scrollRef = useRef(null);

  const load = async () => {
    if (!supabase) { setRows([]); return; }
    try {
      const { data: msgs } = await supabase.from("coordinator_messages").select("*").order("created_at", { ascending: true });
      setRows(msgs || []);
      const { data: pl } = await supabase.from("profiles").select("id,preferred_name,email");
      const map = {}; (pl || []).forEach((p) => { map[p.id] = { name: p.preferred_name, email: p.email }; });
      setProfs(map);
    } catch { setRows([]); }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { if (open) scrollRef.current?.scrollTo({ top: 1e6 }); }, [open, rows]);

  const threads = {};
  (rows || []).forEach((m) => {
    if (!threads[m.user_id]) threads[m.user_id] = { user_id: m.user_id, msgs: [], unread: 0, last: null };
    threads[m.user_id].msgs.push(m);
    threads[m.user_id].last = m;
    if (m.sender === "user" && !m.read_by_coordinator) threads[m.user_id].unread++;
  });
  const list = Object.values(threads).sort((a, b) => new Date(b.last.created_at) - new Date(a.last.created_at));

  const openThread = (uid) => {
    setOpen(uid);
    if (supabase) supabase.from("coordinator_messages").update({ read_by_coordinator: true })
      .eq("user_id", uid).eq("sender", "user").eq("read_by_coordinator", false).then(() => load(), () => {});
  };
  const sendReply = async () => {
    const text = reply.trim();
    if (!text || busy || !open || !supabase) return;
    setBusy(true); setReply(""); setPushNote("");
    try {
      await supabase.from("coordinator_messages").insert({ user_id: open, sender: "coordinator", body: text });
      load();
      try {
        const r = await fetch("/api/push", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: open, title: "Juan replied", body: text, target: "coordinator", url: "/?open=coordinator" }),
        });
        const d = await r.json().catch(() => null);
        setPushNote(!r.ok ? `Push failed: ${(d && d.error) || "error " + r.status}` : `Push: reached ${d.sent} of ${d.total} device${d.total === 1 ? "" : "s"}.`);
      } catch { setPushNote("Push failed: couldn't reach the push service."); }
    }
    catch {} finally { setBusy(false); }
  };

  if (open) {
    const t = threads[open] || { msgs: [] };
    const who = profs[open] || {};
    return (
      <>
        <Brand right={<BackBtn onBack={onBack} label="Messages" />} />
        <div style={{ background: T.card, borderRadius: 18, padding: 14, boxShadow: T.soft, marginTop: 6 }}>
        <button onClick={() => setOpen(null)} style={{ display: "flex", alignItems: "center", gap: 4, background: "none",
          border: "none", color: T.sub, cursor: "pointer", fontSize: 13, marginBottom: 8 }}>
          <ArrowLeft size={15} /> All messages
        </button>
        <div style={{ fontWeight: 700 }}>{who.name || "Member"}</div>
        <div style={{ fontSize: 12.5, color: T.sub, marginBottom: 10 }}>{who.email || ""}</div>
        <div ref={scrollRef} style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          {t.msgs.map((m) => (
            <div key={m.id} style={{ display: "flex", justifyContent: m.sender === "coordinator" ? "flex-end" : "flex-start" }}>
              <div style={{ maxWidth: "85%", padding: "9px 12px", borderRadius: 14, fontSize: 14, lineHeight: 1.45,
                whiteSpace: "pre-wrap", background: m.sender === "coordinator" ? T.green : "#f3eef7",
                color: m.sender === "coordinator" ? "#fff" : T.ink }}>{m.body}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
          <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={1}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
            placeholder="Reply as Juan…"
            style={{ flex: 1, resize: "none", borderRadius: 14, border: `1px solid ${T.line}`, padding: "10px 13px",
              fontSize: 14.5, maxHeight: 120, background: "#fff", color: T.ink, outline: "none", fontFamily: "inherit" }} />
          <button onClick={sendReply} disabled={!reply.trim() || busy} aria-label="Send reply"
            style={{ width: 44, height: 44, borderRadius: "50%", border: "none", background: T.green, color: "#fff",
              display: "grid", placeItems: "center", cursor: reply.trim() ? "pointer" : "default", opacity: reply.trim() ? 1 : 0.5 }}>
            <Send size={17} />
          </button>
        </div>
        {pushNote && <p style={{ fontSize: 11.5, color: T.sub, margin: "6px 2px 0" }}>{pushNote}</p>}
        </div>
      </>
    );
  }

  return (
    <>
      <Brand right={<BackBtn onBack={onBack} />} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, marginBottom: 4 }}>
        <MessageCircle size={18} color={T.green} />
        <h2 style={{ fontSize: 18, margin: 0 }}>Member messages</h2>
      </div>
      <p style={{ fontSize: 13, color: T.sub, margin: "0 2px 14px", lineHeight: 1.5 }}>
        Private one-to-one messages from members to Juan. Only admins see these.
      </p>
      <div style={{ background: T.card, borderRadius: 18, padding: 14, boxShadow: T.soft }}>
        {rows === null && <div style={{ color: T.sub, fontSize: 14, padding: "6px 2px" }}>Loading…</div>}
        {rows && list.length === 0 && <div style={{ color: T.sub, fontSize: 14, padding: "6px 2px" }}>No messages yet.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map((t) => {
            const who = profs[t.user_id] || {};
            return (
              <button key={t.user_id} onClick={() => openThread(t.user_id)} style={{ width: "100%", textAlign: "left",
                background: t.unread ? "#f2f7f4" : "#fff", border: `1px solid ${T.line}`, borderRadius: 14, padding: 12, cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 700, flex: 1 }}>{who.name || "Member"}</span>
                  {t.unread > 0 && <span style={{ minWidth: 18, height: 18, borderRadius: 999, background: "#e5484d",
                    color: "#fff", fontSize: 11, fontWeight: 700, display: "grid", placeItems: "center", padding: "0 5px" }}>{t.unread}</span>}
                </div>
                <div style={{ fontSize: 12, color: T.sub, marginBottom: 3 }}>{who.email || ""}</div>
                <div style={{ fontSize: 13, color: T.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.last.sender === "coordinator" ? "You: " : ""}{t.last.body}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

/* ---------- what the guides remember (see / edit / delete / off) ---------- */
function MemoryManager({ memories, memoryOn, onSave, onBack }) {
  const [list, setList] = useState(memories || []);
  const [on, setOn] = useState(memoryOn !== false);
  const [status, setStatus] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [newItem, setNewItem] = useState("");

  const editItem = (i, val) => setList((l) => l.map((x, k) => (k === i ? val : x)));
  const removeItem = (i) => setList((l) => l.filter((_, k) => k !== i));
  const addItem = () => {
    const v = newItem.trim();
    if (!v) return;
    const next = [...list, v];
    setList(next); setNewItem("");
    onSave(next.map((x) => x.trim()).filter(Boolean), on);
    setStatus("Added."); setTimeout(() => setStatus(""), 1800);
  };
  const save = () => {
    const clean = list.map((x) => x.trim()).filter(Boolean);
    setList(clean);
    onSave(clean, on);
    setStatus("Saved."); setTimeout(() => setStatus(""), 1800);
  };
  const toggleOn = (v) => { setOn(v); onSave(list.map((x) => x.trim()).filter(Boolean), v); };
  const clearAll = () => { setList([]); onSave([], on); setConfirmClear(false); setStatus("Cleared."); setTimeout(() => setStatus(""), 1800); };

  return (
    <>
      <Brand right={<BackBtn onBack={onBack} />} />
      <SectionTitle>What the guides remember</SectionTitle>
      <p style={{ fontSize: 13.5, color: T.sub, margin: "0 2px 14px", lineHeight: 1.5 }}>
        To feel familiar across conversations, the guides keep a few plain notes about you. It's yours to see,
        change, or clear — and you can switch it off entirely. Sensitive things (like anything about feeling
        unsafe) are never kept here.
      </p>

      <div style={{ background: T.card, borderRadius: 18, padding: 16, boxShadow: T.soft, marginBottom: 14,
        display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700 }}>Let the guides remember me</div>
          <div style={{ fontSize: 12.5, color: T.sub }}>{on ? "On — they'll keep a few helpful notes" : "Off — nothing new is remembered"}</div>
        </div>
        <button onClick={() => toggleOn(!on)} aria-label="Toggle memory"
          style={{ width: 52, height: 30, borderRadius: 999, border: "none", cursor: "pointer",
            background: on ? T.green : "#cfc6da", position: "relative", transition: "background .2s" }}>
          <span style={{ position: "absolute", top: 3, left: on ? 25 : 3, width: 24, height: 24, borderRadius: "50%",
            background: "#fff", transition: "left .2s" }} />
        </button>
      </div>

      {on && (
        <>
          <div style={{ background: T.card, borderRadius: 16, padding: 14, boxShadow: T.soft, marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Tell the guides something to remember</div>
            <p style={{ fontSize: 12.5, color: T.sub, margin: "0 0 10px", lineHeight: 1.5 }}>
              Anything you'd like them to keep in mind — e.g. "Call me Sloane", "I work night shifts", "Keep things brief with me".
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <textarea value={newItem} onChange={(e) => setNewItem(e.target.value)} rows={1}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addItem(); } }}
                placeholder="Something to remember…"
                style={{ flex: 1, resize: "none", borderRadius: 12, border: `1px solid ${T.line}`, padding: "10px 12px",
                  fontSize: 14, background: "#fff", color: T.ink, outline: "none", fontFamily: "inherit", maxHeight: 100 }} />
              <button onClick={addItem} disabled={!newItem.trim()} aria-label="Add"
                style={{ width: 46, height: 44, borderRadius: 12, border: "none", background: T.green, color: "#fff",
                  display: "grid", placeItems: "center", cursor: newItem.trim() ? "pointer" : "default", opacity: newItem.trim() ? 1 : 0.5, flexShrink: 0 }}>
                <Plus size={20} />
              </button>
            </div>
          </div>

          {list.length === 0 && (
            <div style={{ color: T.sub, fontSize: 14, padding: "6px 2px 14px" }}>
              Nothing remembered yet. Add something above, or a few notes will appear here as you chat.
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {list.map((m, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", background: T.card,
                borderRadius: 14, padding: "8px 10px", boxShadow: T.soft }}>
                <textarea value={m} onChange={(e) => editItem(i, e.target.value)} rows={1}
                  style={{ flex: 1, resize: "none", border: "none", outline: "none", fontSize: 14, color: T.ink,
                    background: "transparent", fontFamily: "inherit", lineHeight: 1.4 }} />
                <button onClick={() => removeItem(i)} aria-label="Remove"
                  style={{ background: "none", border: "none", color: "#c0392b", cursor: "pointer", padding: 6 }}>
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
          {list.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <Btn onClick={save} style={{ width: 150, height: 46 }}>Save changes</Btn>
              <span style={{ fontSize: 12.5, color: status === "Saved." ? T.greenDk : T.sub }}>{status}</span>
            </div>
          )}
          {list.length > 0 && (
            <button onClick={() => setConfirmClear(true)}
              style={{ background: "none", border: "none", color: "#c0392b", cursor: "pointer", fontSize: 13, textDecoration: "underline" }}>
              Clear everything the guides remember
            </button>
          )}
        </>
      )}

      {confirmClear && (
        <div style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(44,42,51,0.45)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div className="rh-in" style={{ width: "100%", maxWidth: 360, background: T.card, borderRadius: 22,
            boxShadow: T.lift, padding: "22px 20px", textAlign: "center" }}>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>Clear all memories?</div>
            <p style={{ fontSize: 14, color: T.sub, lineHeight: 1.5, margin: "0 0 18px" }}>
              The guides will forget everything they've noted about you. This can't be undone.
            </p>
            <button onClick={clearAll} style={{ width: "100%", background: "#e5484d", color: "#fff", border: "none",
              borderRadius: 14, padding: "13px", fontSize: 15, fontWeight: 700, cursor: "pointer", marginBottom: 10 }}>
              Yes, clear it all
            </button>
            <button onClick={() => setConfirmClear(false)} style={{ width: "100%", background: "#fff", color: T.ink,
              border: `1px solid ${T.line}`, borderRadius: 14, padding: "13px", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
      <Disclaimer />
    </>
  );
}

/* ---------- accessibility settings ---------- */
function Settings({ textScale, reduceMotion, responseSpeed, speechLang, autoVoice, journalPinSet, onSetJournalPin, onClearJournalPin, installPromptAvailable, isStandalone, onPromptInstall, session, authEnabled, onSave, onRestoreDefaults, onBack, onOpenBugReport, onOpenFeedback }) {
  const [pushState, setPushState] = useState("checking"); // "checking" | "on" | "off" | "denied" | "unsupported" | "error"
  const [pushDetail, setPushDetail] = useState("");
  const [pushBusy, setPushBusy] = useState(false);
  const [newJournalPin, setNewJournalPin] = useState("");
  const [confirmJournalPin, setConfirmJournalPin] = useState("");
  const [removeJournalPin, setRemoveJournalPin] = useState("");
  const [journalPinBusy, setJournalPinBusy] = useState(false);
  const [journalPinError, setJournalPinError] = useState("");
  const [showRemoveJournalPin, setShowRemoveJournalPin] = useState(false);
  const [showInstallSteps, setShowInstallSteps] = useState(false);
  const [installMessage, setInstallMessage] = useState("");
  const isIOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const startInstall = async () => {
    if (isStandalone) return;
    if (!installPromptAvailable) { setShowInstallSteps((showing) => !showing); return; }
    try {
      const outcome = await onPromptInstall();
      setInstallMessage(outcome === "accepted" ? "The app is being added to your Home Screen." : "Install cancelled — you can try again any time.");
    } catch { setInstallMessage("We couldn't open the install prompt just now. Please try again."); }
  };
  const onlyPinDigits = (value) => value.replace(/\D/g, "").slice(0, 4);
  const enableJournalPin = async () => {
    if (journalPinBusy) return;
    if (!/^\d{4}$/.test(newJournalPin)) { setJournalPinError("Choose a four-digit PIN."); return; }
    if (newJournalPin !== confirmJournalPin) { setJournalPinError("Those PINs do not match. Please try again."); return; }
    setJournalPinBusy(true); setJournalPinError("");
    try {
      await onSetJournalPin(newJournalPin);
      setNewJournalPin(""); setConfirmJournalPin("");
    } catch (error) { setJournalPinError(error?.message || "We couldn't set your Journal PIN just now."); }
    finally { setJournalPinBusy(false); }
  };
  const disableJournalPin = async () => {
    if (journalPinBusy) return;
    if (!/^\d{4}$/.test(removeJournalPin)) { setJournalPinError("Enter your current four-digit PIN to remove it."); return; }
    setJournalPinBusy(true); setJournalPinError("");
    try {
      const saved = await sget(JOURNAL_PIN_STORAGE_KEY);
      const hash = await hashJournalPin(removeJournalPin);
      if (!saved?.hash || hash !== saved.hash) { setJournalPinError("That PIN is not correct. Please try again."); return; }
      onClearJournalPin();
      setRemoveJournalPin(""); setShowRemoveJournalPin(false);
    } catch (error) { setJournalPinError(error?.message || "We couldn't remove your Journal PIN just now."); }
    finally { setJournalPinBusy(false); }
  };
  useEffect(() => {
    (async () => {
      if (!pushSupported()) { setPushState("unsupported"); return; }
      if (Notification.permission === "denied") { setPushState("denied"); return; }
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = reg && (await reg.pushManager.getSubscription());
        setPushState(sub ? "on" : "off");
      } catch { setPushState("off"); }
    })();
  }, []);
  const togglePush = async () => {
    if (!session || pushBusy) return;
    setPushBusy(true); setPushDetail("");
    if (pushState === "on") { await unsubscribeFromPush(session.user.id); setPushState("off"); }
    else {
      const result = await subscribeToPush(session.user.id);
      setPushState(result.state === "granted" ? "on" : result.state);
      if (result.detail) setPushDetail(result.detail);
    }
    setPushBusy(false);
  };

  const sizes = [
    { label: "XS", val: 0.85 }, { label: "S", val: 0.92 }, { label: "Normal", val: 1 },
    { label: "L", val: 1.12 }, { label: "XL", val: 1.28 },
  ];
  const speeds = [
    { key: "chilled", label: "Chilled", blurb: "Slow, warm, thoughtful, deeper replies. Best when you're calm and at home." },
    { key: "normal", label: "Normal", blurb: "Balanced speed and tone. The default." },
    { key: "fast", label: "Fast", blurb: "Quick, direct, straight to the point. Best when you're busy or rushing." },
  ];
  const curSpeed = responseSpeed || "normal";
  return (
    <>
      <Brand right={<BackBtn onBack={onBack} />} />
      <SectionTitle>Accessibility</SectionTitle>
      <p style={{ fontSize: 13.5, color: T.sub, margin: "0 2px 16px", lineHeight: 1.5 }}>
        These settings are just for this device — set things up however feels most comfortable for you.
      </p>

      <div style={{ background: T.card, borderRadius: 18, padding: 16, boxShadow: T.soft, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Text size</div>
        <p style={{ fontSize: 12.5, color: T.sub, margin: "0 0 12px" }}>Make everything a little smaller or larger.</p>
        <div style={{ display: "flex", gap: 8 }}>
          {sizes.map((s) => {
            const active = Math.abs(textScale - s.val) < 0.02;
            return (
              <button key={s.label} onClick={() => onSave({ textScale: s.val })}
                style={{ flex: 1, padding: "10px 4px", borderRadius: 12, cursor: "pointer",
                  border: active ? `2px solid ${T.green}` : `1px solid ${T.line}`,
                  background: active ? "#eaf6ef" : "#fff", color: T.ink,
                  fontWeight: active ? 700 : 500, fontSize: s.val * 13 }}>
                {s.label}
              </button>
            );
          })}
        </div>
        <p style={{ fontSize: 14, color: T.sub, marginTop: 14, marginBottom: 0, lineHeight: 1.5 }}>
          The quick brown fox — this is how your text looks right now.
        </p>
      </div>

      <div style={{ background: T.card, borderRadius: 18, padding: 16, boxShadow: T.soft, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Response speed</div>
        <p style={{ fontSize: 12.5, color: T.sub, margin: "0 0 12px", lineHeight: 1.45 }}>
          How your guides reply by default. You can always override this for a single reply with the ⚡ Fast Reply button while chatting.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {speeds.map((s) => {
            const active = curSpeed === s.key;
            return (
              <button key={s.key} onClick={() => onSave({ responseSpeed: s.key })}
                style={{ textAlign: "left", padding: "11px 13px", borderRadius: 14, cursor: "pointer",
                  border: active ? `2px solid ${T.green}` : `1px solid ${T.line}`,
                  background: active ? "#eaf6ef" : "#fff", color: T.ink }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                    border: active ? `5px solid ${T.green}` : `1.5px solid ${T.line}`, background: "#fff" }} />
                  <span style={{ fontWeight: active ? 700 : 600, fontSize: 14.5 }}>{s.label}{s.key === "normal" ? " (default)" : ""}</span>
                </div>
                <div style={{ fontSize: 12, color: T.sub, marginTop: 3, marginLeft: 26, lineHeight: 1.4 }}>{s.blurb}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ background: T.card, borderRadius: 18, padding: 16, boxShadow: T.soft, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div><div style={{ fontWeight: 700, marginBottom: 4 }}>Automatic voice playback</div><p style={{ fontSize: 12.5, color: T.sub, margin: 0, lineHeight: 1.45 }}>Choose whether guides automatically read welcomes and replies aloud. You can still use manual voice and Repeat buttons when this is off.</p></div>
          <button onClick={() => onSave({ autoVoice: !autoVoice })} aria-pressed={Boolean(autoVoice)} aria-label="Toggle automatic voice playback" style={{ width: 50, height: 29, borderRadius: 999, border: "none", padding: 3, background: autoVoice ? T.green : "#cbd7d0", cursor: "pointer", flexShrink: 0 }}><span style={{ display: "block", width: 23, height: 23, borderRadius: "50%", background: "#fff", transform: `translateX(${autoVoice ? 21 : 0}px)`, transition: "transform .18s" }} /></button>
        </div>
        <div style={{ height: 1, background: T.line, margin: "14px 0" }} />
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Speech language</div>
        <p style={{ fontSize: 12.5, color: T.sub, margin: "0 0 12px", lineHeight: 1.45 }}>
          The language the mic listens for when you tap to talk. This is separate from typing — guides already reply
          in whatever language you type in, but the microphone needs to be told which language to expect.
        </p>
        <select value={speechLang || "en-AU"} onChange={(e) => onSave({ speechLang: e.target.value })}
          style={{ ...inputStyle, appearance: "auto" }}>
          {SPEECH_LANGS.map((l) => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>
      </div>

      <div style={{ background: T.card, borderRadius: 18, padding: 16, boxShadow: T.soft, marginTop: 14, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "#e6f3ec", display: "grid", placeItems: "center", flexShrink: 0 }}>
            {isIOS ? <Share2 size={18} color={T.greenDk} /> : <Download size={18} color={T.greenDk} />}
          </div>
          <div>
            <div style={{ fontWeight: 700 }}>Add app to Home Screen</div>
            <div style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.4 }}>Use the Resilience Hub like a regular app, straight from your phone.</div>
          </div>
        </div>
        <p style={{ fontSize: 12, color: T.sub, lineHeight: 1.45, margin: "12px 0" }}>
          This is a fully coded and developed app. We are making sure everything is right before bringing it to the Apple App Store and Google Play.
        </p>
        {isStandalone ? (
          <div style={{ fontSize: 12.5, color: T.greenDk, fontWeight: 700, background: "#eaf6ef", borderRadius: 12, padding: "10px 12px" }}>This app is already on your Home Screen.</div>
        ) : (
          <>
            <Btn kind="outline" onClick={startInstall} style={{ width: "100%" }}>{installPromptAvailable ? "Add app to Home Screen" : (isIOS ? "Show iPhone install steps" : "Show install steps")}</Btn>
            {installMessage && <p style={{ fontSize: 12.5, color: T.greenDk, margin: "10px 0 0" }}>{installMessage}</p>}
            {showInstallSteps && (
              <div style={{ background: "#f6f5f8", borderRadius: 12, padding: 12, marginTop: 12, fontSize: 12.5, color: T.ink, lineHeight: 1.5 }}>
                {isIOS ? (
                  <>Safari does not allow a website to trigger this system action automatically. Open this app in <strong>Safari</strong>, tap the <strong>Share</strong> button, scroll down, then choose <strong>Add to Home Screen</strong>. Tap <strong>Add</strong> to finish.</>
                ) : (
                  <>Open the browser menu (usually the <strong>three dots</strong>), then choose <strong>Install app</strong> or <strong>Add to Home screen</strong>. If you do not see the option, make sure you are using a current version of Chrome or another supported browser.</>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ background: T.card, borderRadius: 18, padding: 16, boxShadow: T.soft, marginTop: 0, marginBottom: 14,
        display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700 }}>Reduce motion</div>
          <div style={{ fontSize: 12.5, color: T.sub }}>Turns off gentle animations and pulsing.</div>
        </div>
        <button onClick={() => onSave({ reduceMotion: !reduceMotion })} aria-label="Toggle reduce motion"
          style={{ width: 52, height: 30, borderRadius: 999, border: "none", cursor: "pointer",
            background: reduceMotion ? T.green : "#cfc6da", position: "relative", transition: "background .2s" }}>
          <span style={{ position: "absolute", top: 3, left: reduceMotion ? 25 : 3, width: 24, height: 24,
            borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
        </button>
      </div>

      {authEnabled && (
        <div style={{ background: T.card, borderRadius: 18, padding: 16, boxShadow: T.soft, marginTop: 14,
          display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700 }}>Push notifications</div>
            <div style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.4 }}>
              {pushState === "unsupported" ? "Not available on this browser."
                : pushState === "denied" ? "Blocked — enable notifications for this site in your browser/phone settings, then come back here."
                : pushState === "error" ? "Something went wrong — tap to try again."
                : "Get notified on your phone for app updates and replies from Juan, even when the app's closed. On iPhone, this only works if you added the app to your Home Screen using Safari."}
            </div>
            {pushState === "error" && pushDetail && (
              <div style={{ fontSize: 11, color: "#b3453f", marginTop: 4, fontFamily: "monospace" }}>{pushDetail}</div>
            )}
          </div>
          {(pushState === "on" || pushState === "off" || pushState === "error") && (
            <button onClick={togglePush} disabled={pushBusy} aria-label="Toggle push notifications"
              style={{ width: 52, height: 30, borderRadius: 999, border: "none", cursor: pushBusy ? "default" : "pointer", flexShrink: 0,
                background: pushState === "on" ? T.green : pushState === "error" ? "#e5a3a3" : "#cfc6da", position: "relative", transition: "background .2s", opacity: pushBusy ? 0.6 : 1 }}>
              <span style={{ position: "absolute", top: 3, left: pushState === "on" ? 25 : 3, width: 24, height: 24,
                borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
            </button>
          )}
        </div>
      )}

      <div style={{ background: T.card, borderRadius: 18, padding: 16, boxShadow: T.soft, marginTop: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "#eee9f8", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <Shield size={18} color="#7055a8" />
          </div>
          <div>
            <div style={{ fontWeight: 700 }}>Journal privacy</div>
            <div style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.4 }}>Add a four-digit PIN before opening your Journal on this device.</div>
          </div>
        </div>
        {!journalPinSet ? (
          <>
            <p style={{ fontSize: 12, color: T.sub, lineHeight: 1.45, margin: "12px 0" }}>Your PIN is stored as a one-way hash on this device and, when you are signed in, on your private account. It locks the Journal when you leave it or put the app in the background.</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input value={newJournalPin} onChange={(e) => setNewJournalPin(onlyPinDigits(e.target.value))} inputMode="numeric" autoComplete="new-password" type="password" placeholder="4-digit PIN" aria-label="New four-digit Journal PIN" style={{ ...inputStyle, flex: 1, minWidth: 0 }} />
              <input value={confirmJournalPin} onChange={(e) => setConfirmJournalPin(onlyPinDigits(e.target.value))} inputMode="numeric" autoComplete="new-password" type="password" placeholder="Confirm PIN" aria-label="Confirm Journal PIN" style={{ ...inputStyle, flex: 1, minWidth: 0 }} />
            </div>
            {journalPinError && <p style={{ fontSize: 12.5, color: "#c94f4f", margin: "0 0 10px" }}>{journalPinError}</p>}
            <Btn onClick={enableJournalPin} disabled={journalPinBusy || newJournalPin.length !== 4 || confirmJournalPin.length !== 4} style={{ width: "100%" }}>{journalPinBusy ? "Saving…" : "Turn on Journal PIN"}</Btn>
          </>
        ) : (
          <>
            <p style={{ fontSize: 12.5, color: T.greenDk, fontWeight: 700, margin: "12px 0 8px" }}>Journal PIN is on for this device.</p>
            <p style={{ fontSize: 12, color: T.sub, lineHeight: 1.45, margin: "0 0 12px" }}>For privacy, the Journal locks whenever you leave it or put the app in the background. Your PIN is protected as a one-way hash and cannot be recovered if forgotten.</p>
            {!showRemoveJournalPin ? (
              <Btn kind="outline" onClick={() => { setJournalPinError(""); setShowRemoveJournalPin(true); }} style={{ width: "100%" }}>Remove Journal PIN</Btn>
            ) : (
              <>
                <label style={{ fontSize: 12.5, fontWeight: 700, display: "block", marginBottom: 6 }}>Enter your current PIN to remove it</label>
                <input value={removeJournalPin} onChange={(e) => setRemoveJournalPin(onlyPinDigits(e.target.value))} inputMode="numeric" autoComplete="current-password" type="password" placeholder="Current 4-digit PIN" aria-label="Current four-digit Journal PIN" style={{ ...inputStyle, marginBottom: 10 }} />
                {journalPinError && <p style={{ fontSize: 12.5, color: "#c94f4f", margin: "0 0 10px" }}>{journalPinError}</p>}
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn kind="outline" onClick={() => { setRemoveJournalPin(""); setJournalPinError(""); setShowRemoveJournalPin(false); }} style={{ flex: 1 }}>Cancel</Btn>
                  <Btn onClick={disableJournalPin} disabled={journalPinBusy || removeJournalPin.length !== 4} style={{ flex: 1, background: "#8f3f3f" }}>{journalPinBusy ? "Removing…" : "Remove PIN"}</Btn>
                </div>
              </>
            )}
          </>
        )}
      </div>

      <button onClick={onOpenBugReport} style={{ width: "100%", background: T.card, borderRadius: 18, padding: 16,
        boxShadow: T.soft, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
        textAlign: "left", marginTop: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: "#fbe4e4", display: "grid", placeItems: "center", flexShrink: 0 }}>
          <Flame size={18} color="#c94f4f" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700 }}>Report a bug</div>
          <div style={{ fontSize: 12.5, color: T.sub }}>Found something broken or glitchy? Let us know</div>
        </div>
        <ChevronRight size={20} color={T.sub} />
      </button>

      <button onClick={onOpenFeedback} style={{ width: "100%", background: T.card, borderRadius: 18, padding: 16,
        boxShadow: T.soft, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
        textAlign: "left", marginTop: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: "#e6f3ec", display: "grid", placeItems: "center", flexShrink: 0 }}>
          <MessageCircle size={18} color={T.greenDk} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700 }}>Share feedback</div>
          <div style={{ fontSize: 12.5, color: T.sub }}>Tell us what you think or what would make the app better</div>
        </div>
        <ChevronRight size={20} color={T.sub} />
      </button>

      <div style={{ background: "#fffaf0", border: "1px solid #f0dfb1", borderRadius: 18, padding: 16, boxShadow: T.soft, marginTop: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "#fff0c7", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <RotateCcw size={18} color="#9b761f" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700 }}>Restore default settings</div>
            <div style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.4 }}>Reset text size, motion, response speed, and speech language. Your Journal and PIN stay untouched.</div>
          </div>
        </div>
        <Btn kind="outline" onClick={onRestoreDefaults} style={{ width: "100%", marginTop: 12 }}>Restore defaults</Btn>
      </div>
      <Disclaimer />
    </>
  );
}

/* ---------- how to chat (button + modal) ---------- */
function ChatHelp() {
  const [open, setOpen] = useState(false);
  const rows = [
    { Icon: Send, title: "Type a message", body: "Write in the box at the bottom and tap send (or press Enter). Just like texting." },
    { Icon: Mic, title: "Talk instead of typing", body: "Tap the mic button, say what you want, then tap it again to finish — it turns your voice into a message. Works best in Chrome on Android or a computer." },
    { Icon: Volume2, title: "Hear the guide's voice", body: "Tap the speaker icon at the top to turn the guide's voice on or off. Tap any of their messages to pause and resume, or tap Repeat under a message to hear it again." },
    { Icon: Paperclip, title: "Send a photo", body: "Tap the paperclip to attach a photo the guide can look at and talk about with you. Photos only — our guides cannot view video files." },
    { Icon: Zap, title: "Fast Reply", body: "In a rush? Tap the ⚡ next to Send and that one reply comes back quick and to the point — it won't change your saved Response Speed in Settings." },
  ];
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="How to chat" title="How to chat"
        style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 999, width: 38, height: 38,
          display: "grid", placeItems: "center", cursor: "pointer", color: T.sub, boxShadow: T.soft }}>
        <HelpCircle size={17} />
      </button>
      {open && (
        <div style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(44,42,51,0.45)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
          <div className="rh-in" style={{ width: "100%", maxWidth: 420, maxHeight: "84vh", overflowY: "auto",
            background: T.card, borderRadius: 22, boxShadow: T.lift, position: "relative", padding: "22px 20px" }}>
            <button onClick={() => setOpen(false)} aria-label="Close"
              style={{ position: "absolute", top: 12, right: 12, width: 38, height: 38, borderRadius: "50%",
                border: "none", background: "#f3eef7", color: T.ink, cursor: "pointer", display: "grid", placeItems: "center" }}>
              <X size={19} />
            </button>
            <h2 style={{ fontSize: 19, margin: "0 0 4px", paddingRight: 30 }}>How to chat</h2>
            <p style={{ fontSize: 12.5, color: T.sub, margin: "0 0 16px" }}>A few ways to talk with your guide — use whatever feels easiest.</p>
            {rows.map((r) => (
              <div key={r.title} style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: "#eef1fb", display: "grid",
                  placeItems: "center", flexShrink: 0 }}>
                  <r.Icon size={18} color="#3b7fca" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{r.title}</div>
                  <p style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.5, margin: 0 }}>{r.body}</p>
                </div>
              </div>
            ))}
            <div style={{ marginTop: 6 }}><Btn onClick={() => setOpen(false)}>Got it</Btn></div>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- privacy notice (link + modal, drops in anywhere) ---------- */
function PrivacyLink({ style, variant }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {variant === "menu" ? (
        <button onClick={() => setOpen(true)} style={{ width: "100%", background: T.card, borderRadius: 16, padding: 15,
          boxShadow: T.soft, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: "#eef4fb", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <Shield size={18} color="#3b7fca" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>View Privacy Policy</div>
            <div style={{ fontSize: 12.5, color: T.sub }}>How your information is kept, used & protected</div>
          </div>
          <ChevronRight size={20} color={T.sub} />
        </button>
      ) : (
        <button onClick={() => setOpen(true)} style={{ background: "none", border: "none", color: T.green,
          cursor: "pointer", fontSize: 12.5, fontWeight: 600, textDecoration: "underline", padding: 0, ...(style || {}) }}>
          Privacy
        </button>
      )}
      {open && (
        <div style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(44,42,51,0.45)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
          <div className="rh-in" style={{ width: "100%", maxWidth: 420, maxHeight: "84vh", overflowY: "auto",
            background: T.card, borderRadius: 22, boxShadow: T.lift, position: "relative", padding: "22px 20px" }}>
            <button onClick={() => setOpen(false)} aria-label="Close"
              style={{ position: "absolute", top: 12, right: 12, width: 38, height: 38, borderRadius: "50%",
                border: "none", background: "#f3eef7", color: T.ink, cursor: "pointer", display: "grid", placeItems: "center" }}>
              <X size={19} />
            </button>
            <h2 style={{ fontSize: 19, margin: "0 0 4px", paddingRight: 30 }}>Your privacy</h2>
            <p style={{ fontSize: 12.5, color: T.sub, margin: "0 0 14px" }}>A plain-language summary of how your information is handled.</p>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>What we keep</div>
              <p style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.5, margin: 0 }}>Your account (email), anything you add to your profile (name, pronouns, bio, photo, private contact notes), your journal, your conversations with all AI guides, and any private messages you send directly to Juan (the admin/founder).</p>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>Where it's kept</div>
              <p style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.5, margin: 0 }}>Securely in our database. Your conversations with the guides are sent to a trusted AI service to generate replies. Voice, when on, is turned into speech by a voice service. We don't sell your information.</p>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>Who can see it</div>
              <p style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.5, margin: "0 0 6px" }}>Your private contact notes are visible only to you — not even an admin can read them.</p>
              <ul style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.5, margin: "0 0 6px", paddingLeft: 18 }}>
                <li style={{ marginBottom: 4 }}>Conversations with all AI guides (Juan, Carlos, Mick, Lila, Rex): 100% private — only you see them.</li>
                <li style={{ marginBottom: 4 }}>Only messages you send via "Message Juan" (to the real founder/admin): visible to admin, to support and help you.</li>
                <li>An admin can see your basic profile (name, email, bio). Other members can never see your information.</li>
              </ul>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>Your control</div>
              <p style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.5, margin: 0 }}>You can edit or clear your profile any time, and "Start over" wipes your journey, journal, and saved conversations. To manage what the guides remember about you — or to turn guide memory off completely — go to your Profile and open "What the guides remember". Delete your account by asking Juan.</p>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>Not for emergencies</div>
              <p style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.5, margin: 0 }}>The Hub is a support tool — not a crisis or medical service. If you're in danger or need urgent help, use the crisis contacts shown at the top of the app.</p>
            </div>
            <div style={{ marginTop: 8 }}><Btn onClick={() => setOpen(false)}>Close</Btn></div>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- first-launch consent ---------- */
function Consent({ onAgree }) {
  const [ok, setOk] = useState(false);
  return (
    <>
      <Brand />
      <div style={{ paddingTop: 8 }}>
        <Portrait src={IMG.rex} name="Rex" size={128} tint="#dff5e4" />
        <div className="rh-in" style={{ background: T.card, borderRadius: 22, padding: 18, boxShadow: T.soft, margin: "18px 0" }}>
          <h2 style={{ margin: "0 0 10px", fontSize: 18 }}>Before we start</h2>
          <p style={{ margin: "0 0 12px", fontSize: 14.5, lineHeight: 1.5 }}>
            The Resilience Hub is here to walk alongside you — but it's a <strong>support tool</strong>, not a
            replacement for a doctor, psychologist, or emergency service. If you're ever in danger, call <strong>000</strong>.
          </p>
          <p style={{ margin: "0 0 14px", fontSize: 14.5, lineHeight: 1.5 }}>
            When you chat with a guide, or ask one to help unpack a journal entry, what you write is sent to a
            secure AI service so they can reply. When you're signed in, the guides remember your past conversations,
            and keep a few plain notes about you (like your name or what helps) so they feel familiar over time.
            Sensitive things — like anything about feeling unsafe — are never kept. You can see, edit, or clear these
            notes any time, or switch memory off, under "What the guides remember" in your profile.
          </p>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
            <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)}
              style={{ width: 20, height: 20, marginTop: 1, accentColor: T.green, flexShrink: 0 }} />
            <span style={{ fontSize: 14, lineHeight: 1.45 }}>I understand, and I'm okay with this.</span>
          </label>
        </div>
        <Btn onClick={onAgree} disabled={!ok}>Continue</Btn>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 7, marginTop: 12, fontSize: 12.5, color: T.sub }}>
          <LifeBuoy size={15} color={T.green} />
          <span>Need someone now? Lifeline 13 11 14 · Emergency 000</span>
        </div>
        <div style={{ textAlign: "center", marginTop: 10 }}>
          <PrivacyLink />
        </div>
        <Disclaimer />
      </div>
    </>
  );
}

/* ---------- welcome (Rex) ---------- */
/* ---------- Rex's intro sequence (new users, before onboarding) ---------- */
const REX_INTRO_LINES = [
  "Hey, I'm Rex — welcome to The Resilience Hub. I'm really glad you found your way here.",
  "This is a calm, private space to help you through whatever you're carrying.",
  "Some support, some tools, and a few guides in your corner. You never have to walk it alone.",
  "It's for anyone doing it tough and wanting a hand. No judgement, ever — whatever you're going through, you belong here.",
  "Your guides are here to listen to all of it. Yell, scream, cry, vent — tell them your deepest, darkest secrets or your proudest achievements.",
  "Whatever it is, they'll never judge you for it. They're only ever here to help you through it.",
  "Here's how it works: you can chat any time with our guides.",
  "Juan's your mate for anything at all. Carlos has calming tools for stress and low moments.",
  "Mick's great with practical life and housing. And Lila's there for family and relationships.",
  "Quick honest note: all of us guides are AI, not real people.",
  "Carlos here is an AI inspired by a real psychologist, Carlos Camacho — he offers supportive tools, not therapy or diagnosis.",
  "And if you'd ever like to do the in-person 8-week program with the real team, just tap Message Juan any time.",
  "There's also a toolkit for calming down, a journal to get things out of your head, and an 8-week program to work through at your own pace.",
  "And I'm always here on the home screen if you need pointing in the right direction.",
  "Tap the little person icon up the top of the home screen to open your profile.",
  "That's where you set your name, update your details, and see or switch off what the guides remember about you. You're always in control of that.",
  "Right next to it there's a settings icon — tap that to make the text bigger or smaller, anywhere in the app.",
  "You can choose your preferred speech language in Settings. Tap the Settings wheel, scroll down to Speech language, and select the language you prefer.",
  "If your native language is not on the list, you are welcome to request it through the Share feedback form in Settings. The human team will do their best to add it for you.",
  "Next, we'll ask you a few questions so the guides can get to know you a little.",
  "We'll also ask whether you'd like Carlos to put together a personalised 8-week plan for you.",
  "It's completely up to you — you can say not right now and still use the guides and the toolkit, and start a plan whenever you feel ready.",
  "Either way, you'll find all your guides — Juan, Carlos, Mick and Lila — together in the Your Guides section, ready to talk any time.",
  "Here's the important bit: the more open and detailed your answers, the better the guides can support you — and the more personalised your plan will be.",
  "Take your time — there are no wrong answers.",
  "Whenever you're ready, tap the button below and we'll make a start.",
];

/* ---------- do they want an 8-week plan? (after Rex's intro) ---------- */
function PlanChoice({ voiceOn, onYes, onNo }) {
  const { speak, stop, speaking } = useVoice(voiceOn);
  const line = "Before we go any further — would you like Carlos to put together a personalised 8-week plan for you? " +
    "If you would, I'll ask you a handful of questions so he can shape it around what you're dealing with. " +
    "If you'd rather just use the guides and the toolkit for now, that's completely fine — I'll only ask a couple of quick things, " +
    "and you can start a plan whenever you feel ready.";
  useEffect(() => { speak(line, CHARS.rex); return () => stop(); /* eslint-disable-next-line */ }, []);
  return (
    <>
      <Brand />
      <div style={{ paddingTop: 8, textAlign: "center" }}>
        <Portrait src={IMG.rex} name="Rex" size={170} speaking={speaking} tint={CHARS.rex.tint} />
        <Bubble>{line}</Bubble>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 420, margin: "0 auto" }}>
          <button onClick={() => { stop(); onYes(); }}
            style={{ width: "100%", background: `linear-gradient(180deg, #3fb072, ${T.green})`, color: "#fff",
              border: "none", borderRadius: 16, padding: "15px", fontSize: 16.5, fontWeight: 800, cursor: "pointer",
              boxShadow: "0 10px 24px rgba(55,160,101,0.32)" }}>
            Yes, build my 8-week plan
          </button>
          <button onClick={() => { stop(); onNo(); }}
            style={{ width: "100%", background: "#fff", color: T.ink, border: `1px solid ${T.line}`, borderRadius: 16,
              padding: "15px", fontSize: 15.5, fontWeight: 700, cursor: "pointer", boxShadow: T.soft }}>
            Not right now — just the guides &amp; toolkit
          </button>
        </div>
        <p style={{ fontSize: 12, color: T.sub, marginTop: 14, lineHeight: 1.5 }}>
          You can start a plan any time from your 8-Week Plan page.
        </p>
      </div>
    </>
  );
}

function RexIntro({ voiceOn, onReady, onExit }) {
  const { speak, stop, speaking, prefetch } = useVoice(voiceOn);
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);
  const timer = useRef(null);
  const pauseTimer = useRef(null);
  const last = REX_INTRO_LINES.length - 1;

  useEffect(() => {
    if (done) return;
    const line = REX_INTRO_LINES[idx];
    let advanced = false;
    const goNext = () => {
      if (advanced) return; advanced = true;
      if (idx >= last) { setDone(true); return; }
      pauseTimer.current = setTimeout(() => setIdx((k) => k + 1), 400); // consistent beat between sections
    };
    // Fetch the next couple of lines while this one plays, so they start instantly.
    if (REX_INTRO_LINES[idx + 1]) prefetch(REX_INTRO_LINES[idx + 1], CHARS.rex);
    if (REX_INTRO_LINES[idx + 2]) prefetch(REX_INTRO_LINES[idx + 2], CHARS.rex);
    if (voiceOn && __autoVoiceOn) {
      // Advance when Rex actually finishes speaking, so his last words aren't cut off.
      try { speak(line, CHARS.rex, goNext); } catch { goNext(); }
      timer.current = setTimeout(goNext, Math.max(7000, line.length * 100)); // safety net if audio never signals
    } else {
      timer.current = setTimeout(goNext, Math.max(2600, line.length * 60)); // silent: reading pace
    }
    return () => { clearTimeout(timer.current); clearTimeout(pauseTimer.current); };
  }, [idx, done, voiceOn, speak, prefetch, last]);

  const clearTimers = () => { clearTimeout(timer.current); clearTimeout(pauseTimer.current); };
  const goTo = (n) => { clearTimers(); stop(); setDone(false); setIdx(Math.max(0, Math.min(last, n))); };
  const onBackLine = () => goTo(idx - 1);
  const onNextLine = () => { if (idx >= last) { clearTimers(); stop(); setDone(true); } else goTo(idx + 1); };
  const skip = () => { clearTimers(); stop(); setIdx(last); setDone(true); };
  useEffect(() => () => stop(), [stop]);

  const arrow = (dis) => ({ width: 42, height: 42, borderRadius: 999, flexShrink: 0,
    border: `1px solid ${T.line}`, background: "#fff", display: "grid", placeItems: "center",
    cursor: dis ? "default" : "pointer", opacity: dis ? 0.35 : 1, color: T.ink, boxShadow: T.soft });

  return (
    <>
      <Brand right={onExit && (
        <button onClick={() => { stop(); onExit(); }} aria-label="Back to chat" title="Back to chat"
          style={{ width: 36, height: 36, borderRadius: "50%", border: `1px solid ${T.line}`, background: "#fff",
            color: T.ink, cursor: "pointer", display: "grid", placeItems: "center", boxShadow: T.soft }}>
          <X size={18} />
        </button>
      )} />
      <div style={{ paddingTop: 8, textAlign: "center" }}>
        <Portrait src={IMG.rex} name="Rex" size={190} speaking={speaking} tint={CHARS.rex.tint} />

        <div style={{ display: "flex", alignItems: "center", gap: 10, maxWidth: 460, margin: "16px auto 0" }}>
          <button onClick={onBackLine} disabled={idx === 0} aria-label="Previous" title="Previous" style={arrow(idx === 0)}>
            <ChevronLeft size={20} />
          </button>
          <div className="rh-in" key={idx + (done ? "-done" : "")} style={{ flex: 1, background: T.card, borderRadius: 22,
            padding: "18px 16px", boxShadow: T.soft, minHeight: 96,
            display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <p style={{ fontSize: 15.5, lineHeight: 1.55, margin: 0 }}>{REX_INTRO_LINES[idx]}</p>
          </div>
          <button onClick={onNextLine} disabled={done && idx >= last} aria-label="Next" title="Next" style={arrow(done && idx >= last)}>
            <ChevronRight size={20} />
          </button>
        </div>

        <div style={{ fontSize: 11.5, color: T.sub, marginTop: 8 }}>
          {idx + 1} of {REX_INTRO_LINES.length}
        </div>

        {/* progress dots */}
        <div style={{ display: "flex", gap: 5, justifyContent: "center", marginTop: 8, flexWrap: "wrap" }}>
          {REX_INTRO_LINES.map((_, k) => (
            <span key={k} style={{ width: 6, height: 6, borderRadius: "50%",
              background: k <= idx ? T.green : "#d8d0e2", transition: "background .3s" }} />
          ))}
        </div>

        <div style={{ marginTop: 20, maxWidth: 420, marginLeft: "auto", marginRight: "auto" }}>
          {done ? (
            <button onClick={() => { stop(); onReady(); }} className="rh-in"
              style={{ width: "100%", background: `linear-gradient(180deg, #3fb072, ${T.green})`, color: "#fff",
                border: "none", borderRadius: 16, padding: "15px", fontSize: 16.5, fontWeight: 800, cursor: "pointer",
                boxShadow: "0 10px 24px rgba(55,160,101,0.32)" }}>
              I'm ready
            </button>
          ) : (
            <button onClick={skip} style={{ background: "none", border: "none", color: T.sub, cursor: "pointer", fontSize: 13 }}>
              Skip intro
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function Welcome({ onExplore, onStart, voiceOn, setVoiceOn }) {
  const { speak, stop, speaking } = useVoice(voiceOn);
  useEffect(() => () => stop(), [stop]);
  return (
    <>
      <Brand right={<VoiceToggle on={voiceOn} set={setVoiceOn} />} />
      <div style={{ paddingTop: 8 }}>
        <Portrait src={IMG.rex} name="Rex" size={200} speaking={speaking} tint="#dff5e4" />
        <Bubble>{REX_INTRO}</Bubble>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Btn kind="outline" onClick={() => speak(REX_INTRO, CHARS.rex)}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Volume2 size={18} /> Hear Rex say hello</span>
          </Btn>
          <Btn kind="primary" onClick={() => { stop(); onStart(); }}>Ready for the full journey</Btn>
        </div>
        <Disclaimer />
      </div>
    </>
  );
}

function VoiceToggle({ on, set }) {
  return (
    <button onClick={() => set(!on)} aria-label={on ? "Voice on" : "Voice off"}
      style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 999, width: 42, height: 42,
        display: "grid", placeItems: "center", cursor: "pointer", color: T.ink, boxShadow: T.soft, flexShrink: 0 }}>
      {on ? <Volume2 size={20} /> : <VolumeX size={20} />}
    </button>
  );
}

/* ---------- onboarding (Juan guides) ---------- */
const QUESTIONS = [
  { key: "name", type: "name", q: "First up — what should we call you?" },
  { key: "age", type: "single", q: "Which stage of life are you in? It helps us pitch things right.",
    opts: ["16–25", "26–55", "56–80+", "Rather not say"] },
  { key: "mood", type: "single", q: "How have the last couple of weeks felt, overall?",
    opts: ["Pretty good", "Up and down", "Heavy going", "Really rough"] },
  { key: "mood_why", type: "text", q: "What's been behind that, do you reckon? Paint me a bit of a picture.",
    placeholder: "Whatever's been going on — a little or a lot…" },
  { key: "sleep", type: "single", q: "How's your sleep been?",
    opts: ["Fine", "A bit patchy", "Not great", "Barely sleeping"] },
  { key: "energy", type: "single", q: "And your energy and motivation day to day?",
    opts: ["Good", "Comes and goes", "Running low", "Empty"] },
  { key: "nervous_system", type: "single", q: "When things spike, which feels closest today? There is no wrong answer.",
    opts: ["Flat or shut down", "Racing or on edge", "A bit of both", "Fairly steady", "Not sure yet"] },
  { key: "pain_point", type: "single", q: "What feels most at the centre of things right now?",
    opts: ["Grief or loss", "Burnout or exhaustion", "Feeling isolated", "A big identity or life change", "Hard to name"] },
  { key: "cognitive_load", type: "single", q: "How much can you comfortably take in right now?",
    opts: ["I can read and focus", "Short steps work best", "Keep it ultra-short and audio-first", "Not sure yet"] },
  { key: "weighing", type: "text", q: "What's weighing on you most right now? As much or as little as you like.",
    placeholder: "You can tap the mic to talk, or type…" },
  { key: "areas", type: "multi", q: "Which of these are tough at the moment? Pick any that fit.",
    opts: ["Money", "Housing", "Work / no work", "Relationships", "Family", "Health", "Feeling alone", "Alcohol or other stuff", "Grief or loss", "Legal or justice stuff"] },
  { key: "coping", type: "multi", q: "When things get heavy, what do you tend to reach for? No judgement.",
    opts: ["Talking to someone", "Keeping busy", "Time alone", "Exercise or the outdoors", "Music or games", "Alcohol or substances", "Bottling it up", "Faith or meaning"] },
  { key: "support", type: "single", q: "Who've you got in your corner?",
    opts: ["A few solid people", "One or two", "Not really anyone", "Rather not say"] },
  { key: "strength", type: "text", q: "What's one thing that's helped you get through hard times before?",
    placeholder: "Even a small thing counts…" },
  { key: "goal", type: "text", q: "If the next 8 weeks went well, what would feel different for you?",
    placeholder: "Where you'd love to be, even roughly…" },
  { key: "pace", type: "single", q: "What sort of pace suits you for a plan?",
    opts: ["Small, gentle steps", "A steady challenge", "Push me a bit", "Not sure yet"] },
  { key: "help", type: "multi", q: "What would actually help right now?",
    opts: ["Someone to talk to", "A plan and next steps", "Practical help (bills, housing)", "Ways to calm down", "Structure and routine", "Just to be heard"] },
  { key: "safety", type: "safety", q: "One last gentle one — how safe do you feel in yourself right now?",
    opts: ["I'm okay", "Struggling but safe", "I'm not sure", "I've had thoughts of hurting myself"] },
];

// People who don't want an 8-week plan still answer these few, so the guides
// know who they're talking to — and so the safety check is never skipped.
const SHORT_KEYS = ["name", "mood", "areas", "safety"];

function selectedAnswer(answers = {}, key, options = []) {
  const value = answers[key];
  if (typeof value === "number") return options[value] || "";
  return Array.isArray(value) ? value.join(", ") : String(value || "");
}

function classifyPlanAnswers(answers = {}) {
  const opt = (key) => QUESTIONS.find((q) => q.key === key)?.opts || [];
  const age = selectedAnswer(answers, "age", opt("age"));
  const energy = selectedAnswer(answers, "energy", opt("energy"));
  const nervous = selectedAnswer(answers, "nervous_system", opt("nervous_system"));
  const load = selectedAnswer(answers, "cognitive_load", opt("cognitive_load"));
  const pain = selectedAnswer(answers, "pain_point", opt("pain_point"));
  const ageTier = age === "16–25" ? "Youth tier (16–25)" : age === "56–80+" ? "Mature tier (56–80+)" : age === "Rather not say" ? "Age not specified" : "Core adult tier (26–55)";
  const state = nervous.includes("Racing") ? "hyper-aroused / anxious" : nervous.includes("Flat") || energy === "Empty" || energy === "Running low" ? "low-energy / shut down" : nervous.includes("both") ? "mixed" : "fairly steady";
  const cognitiveLoad = load.includes("ultra") || load.includes("audio") ? "ultra-short, audio-first, micro-steps" : load.includes("Short") ? "short, simple steps" : "able to read and focus";
  return { age, ageTier, state, painPoint: pain || "not yet named", cognitiveLoad, needsGentleStart: /low-energy|hyper-aroused|mixed/.test(state) || /short|ultra/i.test(cognitiveLoad) };
}

const CRISIS_TEXT_RE = /\b(suicid(e|al)|kill myself|end my life|want to die|don['’]t want to live|hurt myself|self[- ]?harm|overdos(e|ing)|can['’]t keep myself safe|not safe right now|unsafe right now|in immediate danger)\b/i;
function isCrisisText(text) { return CRISIS_TEXT_RE.test(String(text || "")); }

/* ---------- Carlos building the plan (rotating progress lines) ---------- */
const PLAN_STEPS = [
  "Reading back through your answers…",
  "Dissecting the information you've shared…",
  "Thinking about the best approach for you…",
  "Mapping out your eight weeks…",
  "Putting your personalised plan together…",
  "Shaping the daily tasks around your pace…",
  "Almost there — adding the finishing touches…",
];

// Extracted from the supplied Daily Resilience document. Day 30 repeats the
// Seneca quotation used on Day 11, so it is intentionally not included here.
const CARLOS_QUOTES = [
  `Epictetus said: “Difficulties show what a person is. So when you run into trouble, remember you're being forged stronger, not broken.” Hard days aren't punishments — they're where you find out what you're truly made of.`,
  `Epictetus said: “We cannot choose our external circumstances, but we can always choose our perspective.” The same storm that hardens clay softens wax — be the one who stays flexible.`,
  `Seneca said: “He who does not think much of himself is much too humble.” Self-respect is not arrogance — it is the foundation of every good thing you will build.`,
  `Marcus Aurelius said: “The best revenge is to be unlike him who performed the injury.” Keep your heart clean — anger traps you in the past, forgiveness sets you free.`,
  `Heraclitus said: “The only constant in life is change.” Do not fear the ending — trust that you are always being carried forward, even when the ground feels unsteady.`,
  `Plato said: “You can discover more about a person in an hour of play than in a year of conversation.” Rest is not laziness — it is where your humanity and creativity live.`,
  `Aristotle said: “The soul becomes dyed with the colour of its thoughts.” Guard your mind carefully — what you feed it grows.`,
  `Zeno said: “The goal of life is living in agreement with nature.” You don't need to chase what everyone else has — you only need to walk true to who you are.`,
  `Cleanthes said: “Fate leads the willing, and drags the unwilling.” Resistance is heavy — but acceptance turns weight into wisdom.`,
  `Musonius Rufus said: “Virtue is the only good; all else is only a tool.” Your worth is not in what you own, but in how you show up.`,
  `Seneca said: “Every new beginning comes from some other beginning's end.” Closing a chapter isn't failure — it is clearing space for what you are meant to become.`,
  `Plato said: “The beginning is the most important part of the work.” You don't need to have it all figured out to start — you just need to start, even with what little you have.`,
  `Epictetus said: “Some things are in our control and others not.” True freedom comes from knowing exactly which is which.`,
  `Heraclitus said: “No man ever steps in the same river twice.” You are not the person you were yesterday — you've grown, you've learned, and you're stronger than you know.`,
  `Socrates said: “The greatest way to live with honour is to be what we pretend to be.” Become the person you want to meet — and you will change the world around you.`,
  `Epictetus said: “We cannot choose our external circumstances, but we can always choose our response.” Freedom isn't what happens to you — it's how you meet it.`,
  `Marcus Aurelius said: “Waste no more time arguing what a good life looks like — live it.” Peace is found in doing, not debating or seeking approval.`,
  `Socrates said: “The unexamined life is not worth living — but the over-examined life is not livable at all.” You don't have to fix every single thing about yourself to be okay.`,
  `Aristotle said: “We build walls to keep pain out, but they also keep joy out.” Being open doesn't mean you won't get hurt — it means you get to feel everything that makes life worth living.`,
  `Marcus Aurelius said: “Dwell on the beauty of life. Watch the stars, and see yourself running with them.” You are part of something far bigger than your struggles.`,
  `Seneca said: “If a man knows not to which port he sails, no wind is favourable.” You don't need the whole map — just know your next direction.`,
  `Epictetus said: “No one is free who has not mastered themselves.” True freedom is not doing whatever you feel — it's choosing what serves you.`,
  `Plato said: “Be kind — for everyone you meet is fighting a hard battle.” You never know what someone carries — gentleness is strength.`,
  `Aristotle said: “It is during our darkest moments that we must focus to see the light.” Resilience isn't avoiding the dark — it's learning to carry your own light.`,
  `Seneca said: “He who has a why to live can bear almost any how.” Your purpose doesn't have to be grand — it just has to be yours.`,
  `Marcus Aurelius said: “The best way to predict the future is to create it.” You build tomorrow by what you do today — not by worrying about it.`,
  `Epictetus said: “First say to yourself what you would be; and then do what you have to do.” You become who you choose to be — not by wishing, but by acting.`,
  `Plato said: “Courage is knowing what not to fear.” Sometimes the bravest thing you can do is say no — to what drains you, to what hurts you, to what pulls you down.`,
  `Aristotle said: “We become just by doing just acts, temperate by doing temperate acts, brave by doing brave acts.” You don't wait to be strong — you become strong by acting strong.`,
];

function PlanBuilding() {
  const [i, setI] = useState(0);
  const [quoteI, setQuoteI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((k) => (k < PLAN_STEPS.length - 1 ? k + 1 : k)), 4200);
    const q = setInterval(() => setQuoteI((k) => (k + 1) % CARLOS_QUOTES.length), 7000);
    return () => { clearInterval(t); clearInterval(q); };
  }, []);
  return (
    <>
      <Brand />
      <div style={{ paddingTop: 8, textAlign: "center" }}>
        <Portrait src={IMG.carlos} name="Carlos" size={190} speaking tint={CHARS.carlos.tint} />
        <Bubble>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, marginBottom: 4 }}>
            <Sparkles size={18} color={T.green} /> Carlos here.
          </div>
          Thanks for sharing all that. I'm putting together a plan shaped just for you — this can take a minute or two,
          so hang tight while I work through it. Once it's ready, you can ask me about any week right from the plan page,
          or come and talk to me in Your Guides whenever you like.
        </Bubble>

        <div style={{ background: T.card, borderRadius: 18, padding: "16px 16px 18px", boxShadow: T.soft,
          maxWidth: 420, margin: "0 auto" }}>
          <div key={i} className="rh-in" style={{ fontSize: 14.5, color: T.ink, fontWeight: 600, minHeight: 22 }}>
            {PLAN_STEPS[i]}
          </div>
          <div style={{ height: 6, borderRadius: 999, background: "#eee2f0", overflow: "hidden", marginTop: 12 }}>
            <div style={{ width: "35%", height: "100%", borderRadius: 999, background: T.green,
              animation: "rh-slide 1.5s ease-in-out infinite" }} />
          </div>
          <div style={{ fontSize: 11.5, color: T.sub, marginTop: 10, lineHeight: 1.5 }}>
            The more you shared, the longer this takes — and the more personalised your plan will be.
          </div>
        </div>

        <div key={quoteI} className="rh-in" style={{ background: "linear-gradient(135deg, #f4f8f5, #fffaf3)", border: `1px solid ${T.line}`, borderRadius: 18, padding: "15px 16px", maxWidth: 420, margin: "12px auto 0", boxShadow: T.soft, textAlign: "left" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, color: T.greenDk, fontSize: 11, fontWeight: 900, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 7 }}><MessageCircle size={14} /> A thought from Carlos</div>
          <div style={{ fontSize: 14, color: T.ink, lineHeight: 1.55, fontStyle: "italic" }}>“{CARLOS_QUOTES[quoteI]}”</div>
        </div>
      </div>
    </>
  );
}

function Onboarding({ profile, saveProfile, answers, saveAnswers, savePlan, voiceOn, mode = "full", onBackToIntro, onSignOut, onDone }) {
  const QS = mode === "short" ? QUESTIONS.filter((x) => SHORT_KEYS.includes(x.key)) : QUESTIONS;
  const [i, setI] = useState(0);
  const [local, setLocal] = useState(answers || {});
  const [text, setText] = useState("");
  const [name, setName] = useState(profile?.name || "");
  const [safetyPanel, setSafetyPanel] = useState(false);
  const [building, setBuilding] = useState(false);
  const { speak, stop, speaking } = useVoice(voiceOn);
  const q = QS[i];

  useEffect(() => { setText(local[q.key] || ""); speak(q.q, CHARS.juan); return () => stop(); /* eslint-disable-next-line */ }, [i]);

  const set = (val) => { const next = { ...local, [q.key]: val }; setLocal(next); saveAnswers(next); return next; };

  const next = (val) => {
    const merged = val !== undefined ? set(val) : local;
    if (q.type === "name") { const nm = name.trim() || "friend"; saveProfile({ ...profile, name: nm }); }
    if (q.type === "safety") {
      const idx = merged.safety;
      if (idx === 2 || idx === 3) { setSafetyPanel(true); return; }
    }
    advance();
  };

  const advance = () => { stop(); if (i < QS.length - 1) setI(i + 1); else finish(); };

  const finish = async () => {
    // Short path: they didn't want a plan right now — save what they shared and go.
    if (mode === "short") {
      saveProfile({ ...profile, name: name.trim() || "friend", onboardingComplete: true });
      onDone({ createdPlan: false });
      return;
    }
    setBuilding(true);
    let plan = null;
    try {
      const sys = `${CHARS.carlos.system}
PLAN SAFETY AND ADAPTATION: classify the person internally by energy/arousal, primary pain point, cognitive-load tolerance, and age tier. Youth (16–25) may need relatable digital-native language and identity-pressure examples; Core adult (26–55) may need time-efficient support around work, parenting, burnout, and boundaries; Mature (56–80+) needs dignified pacing around grief, independence, and isolation. Weeks 1–2 must be Triage & Safety with grounding, regulation, rest, and no heavy homework. Weeks 3–5 are Pattern Recognition; Weeks 6–7 Rebuilding & Values; Week 8 Integration & Relapse Prevention. If low-energy, hyper-aroused, mixed, or low-load, use fewer words and micro-steps. Never use streaks, missed-day language, guilt, diagnosis, or crisis content in the plan. Every day must include a 20-minute walk with a five-minute pre-routine, a safe-person connection option, and varied app/community tasks; community contact is always optional.
You are creating a genuinely personalised 8-week recovery and resilience plan from this person's setup answers. It must feel hand-made for THEM — use their age stage, mood, sleep, energy, situation, goals, life areas, coping style, past strengths, support network, and chosen pace. Speak in plain, warm language. No clinical jargon, shame, or motivational-poster filler.

NON-NEGOTIABLE STRUCTURE: return exactly 8 weeks, each with a short focus and exactly 7 days. Each day has 2 or 3 short, concrete tasks. The plan must grow week by week, but the person's requested pace and current energy control how gently that growth is presented. If energy is low or they chose gentle steps, use two tasks where possible and make the second task easy to split into smaller pieces. If they are ready for more, use three tasks. Never make a task a test they can fail.

CORE RULES — EVERY WEEK:
1. WALKING: every one of the seven days must include one clearly labelled 20-minute walk. Keep the walk gentle and achievable, but let the weekly progression grow through a slightly different route, a new landmark, a little more purposeful pace, or a small confidence challenge — never a sudden jump. Include a pre-routine wherever appropriate: get ready five minutes before leaving, put on comfortable clothes and shoes, take water if useful, and set a simple intention. For low-energy users, explicitly allow the 20 minutes to be split into shorter walks across the day.
2. CONNECTION: include checking in with one safe person regularly. Also include an option to contact the real Juan directly through the app, and remind them that AI Juan is available any time without judgement. Where it fits their answers, suggest the Men's Group, South West Sydney Men's Shed, The Men's Table, or a relevant local support service without pretending you have made contact for them.
3. GROWING SKILLS: introduce new skills as the weeks progress. Do not simply repeat breathing every week. Build from safety and routine, to noticing wins and anchors, tiny steps and boundaries, reaching out, purpose and practical goals, kinder self-talk, deeper connection, and looking forward.
4. DAILY RHYTHM: weave these ideas through the week without making every day identical: notice one good thing, check in with someone or Juan, take the walk, and choose one small win plus one tiny next step. Combine related items when needed so the plan stays manageable.
5. APP AND COMMUNITY ENGAGEMENT: across the full plan, thoughtfully mix in different ways to use the app, including writing or voicing a Journal entry, capturing a Fleeting Thought, playing one of the Games & Puzzles for a short while, asking Carlos for guidance, checking in with AI Juan, messaging the real Juan, and using the Toolkit. Include the Resilience Hub Facebook group as an optional gradual challenge: first view the group, then consider reacting or reading, and only later invite the person to make a post if they feel comfortable. Where appropriate, include reaching out to the South West Sydney Men's Shed as a brave but optional step. Never pressure, shame, or imply that posting or contacting a group is required.
6. VARIETY: do not repeat the same daily sentence or activity mechanically. Across the complete plan, vary the wording and activity type. A task may recur only when repetition is genuinely useful, such as the three weekly walks, a safe-person check-in, or a simple daily rhythm.

WEEK THEMES — follow this order:
Week 1 — Landing gently: safety, a small routine, first walks, and showing up as a win.
Week 2 — Steady footing: consistency, small wins, and finding an anchor.
Week 3 — One thing at a time: break big problems into tiny steps and begin boundaries. Include a Plan review task on Day 1.
Week 4 — Reaching out: identify who is in their corner, practise asking for help, and offer relevant groups or community connection.
Week 5 — Practical ground: routine, purpose, and small goals that matter to them. Include a Plan review task on Day 1.
Week 6 — Kinder self-talk: notice the inner voice and practise a fairer, more supportive response.
Week 7 — Connection: deepen relationships, give and receive support, and include a Plan review task on Day 1.
Week 8 — Looking forward: review what helped, celebrate effort, plan what comes next, and protect momentum.

Use the right guide naturally: Juan for mate-style support and a check-in, Carlos for calming tools and plan questions, Mick for bills/housing/practical life, and Lila for family, relationships, and boundaries. Never promise that an AI guide is a clinician, never diagnose, and never include crisis or self-harm content in the plan itself.

Respond with ONLY valid JSON, no markdown fences, exactly this shape:
{"summary":"2-3 warm sentences to them referencing their real situation and goal","weeks":[{"n":1,"focus":"short focus title","days":[{"d":1,"tasks":["task","task"]}, ... 7 days]}, ... all 8 weeks]}`;
      const classification = classifyPlanAnswers(local);
      const out = await callModel({
        system: sys, maxTokens: 5200, timeoutMs: 30000,
        messages: [{ role: "user", content: `Their name: ${name || "friend"}. Their setup answers (JSON): ${JSON.stringify(local)}. Internal classification for pacing only: ${JSON.stringify(classification)}. Build the full, personalised 8-week plan now, with at least two tasks every day.` }],
      });
      let clean = out.split("```json").join("").split("```").join("").trim();
      const first = clean.indexOf("{"), last = clean.lastIndexOf("}");
      if (first > 0 || last < clean.length - 1) clean = clean.slice(first, last + 1); // strip any stray preamble/postamble
      const parsed = JSON.parse(clean);
      const usable = parsed && Array.isArray(parsed.weeks) && parsed.weeks.length === 8 && parsed.weeks.every((w) => {
        if (!Array.isArray(w.days) || w.days.length !== 7) return false;
        const validDays = w.days.every((d) => Array.isArray(d.tasks) && d.tasks.length >= 2 && d.tasks.length <= 3);
        const walkingDays = w.days.filter((d) => d.tasks.some((t) => /walk|walking/i.test(String(t)) && /20\s*[- ]?minute|20\s*min/i.test(String(t)))).length;
        return validDays && walkingDays === 7;
      });
      if (usable) plan = { ...parsed, classification };
      else throw new Error("plan did not meet the required structure");
    } catch {
      plan = fallbackPlan(name, local);
    }
    savePlan(plan);
    saveProfile({ ...profile, name: name.trim() || "friend", onboardingComplete: true });
    setBuilding(false);
    onDone({ createdPlan: true });
  };

  if (building) return <PlanBuilding />;

  if (safetyPanel) {
    return (
      <>
        <Brand />
        <div style={{ paddingTop: 8 }}>
          <Portrait src={IMG.juan} name="Juan" size={180} speaking={speaking} tint={CHARS.juan.tint} />
          <Bubble>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, marginBottom: 6 }}>
              <Heart size={18} color="#e5484d" /> Thanks for being honest with me.
            </div>
            That takes guts, and I'm really glad you told me. You don't have to sit with this on your own — please reach
            out to someone right now who can be with you properly. I'm still here, but a real person on the other end of a
            call matters most when things feel this heavy.
          </Bubble>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            {CONTACTS.map((c) => (
              <a key={c.label} href={`tel:${c.tel}`} style={{ display: "flex", alignItems: "center", gap: 8,
                borderRadius: 14, padding: "12px 12px", textDecoration: "none", fontWeight: 600, fontSize: 14,
                background: c.accent ? "#e5484d" : "#fff", color: c.accent ? "#fff" : T.ink, boxShadow: T.soft }}>
                <Phone size={15} /><span style={{ lineHeight: 1.1 }}>{c.label}<br /><span style={{ fontSize: 12, opacity: 0.85 }}>{c.number}</span></span>
              </a>
            ))}
          </div>
          <Btn kind="outline" onClick={() => { setSafetyPanel(false); advance(); }}>I've got support — keep going</Btn>
          <Btn kind="ghost" onClick={() => { setSafetyPanel(false); advance(); }} style={{ marginTop: 6 }}>Continue</Btn>
        </div>
      </>
    );
  }

  return (
    <>
      <Brand right={<span style={{ fontSize: 12, color: T.sub }}>{i + 1} / {QS.length}</span>} />
      <div style={{ height: 6, borderRadius: 999, background: "#eaddf0", overflow: "hidden", margin: "4px 2px 4px" }}>
        <div style={{ height: "100%", width: `${((i + 1) / QS.length) * 100}%`, background: T.green, transition: "width .4s" }} />
      </div>
      <Portrait src={IMG.juan} name="Juan" size={168} speaking={speaking} tint={CHARS.juan.tint} />
      <Bubble>{q.q}</Bubble>
      {i === 0 && (onBackToIntro || onSignOut) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, flexWrap: "wrap", marginBottom: 6 }}>
          {onBackToIntro && (
            <button onClick={() => { stop(); onBackToIntro(); }} style={{ display: "inline-flex", alignItems: "center", gap: 6,
              background: "none", border: "none", color: T.green, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
              <ArrowLeft size={15} /> Watch Rex's welcome again
            </button>
          )}
          {onSignOut && (
            <button onClick={() => { stop(); onSignOut(); }} style={{ display: "inline-flex", alignItems: "center", gap: 6,
              background: "none", border: "none", color: T.sub, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
              <LogOut size={15} /> Sign out
            </button>
          )}
        </div>
      )}

      {q.type === "name" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Your name or nickname"
            style={inputStyle} />
          <Btn onClick={() => next()}>Nice to meet you</Btn>
        </div>
      )}

      {q.type === "single" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {q.opts.map((o, idx) => (
            <ChoiceRow key={o} label={o} onClick={() => next(idx)} />
          ))}
        </div>
      )}

      {q.type === "safety" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {q.opts.map((o, idx) => (
            <ChoiceRow key={o} label={o} onClick={() => next(idx)} danger={idx === 3} />
          ))}
        </div>
      )}

      {q.type === "multi" && (
        <MultiSelect opts={q.opts} value={local[q.key] || []}
          onChange={(v) => set(v)} onNext={() => next(local[q.key] || [])} />
      )}

      {q.type === "text" && (
        <div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={q.placeholder} rows={4}
            style={{ ...inputStyle, resize: "none", minHeight: 110 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
            <HoldToTalk onText={(t) => setText((prev) => (prev ? prev + " " : "") + t)} />
            <div style={{ flex: 1 }}>
              <Btn onClick={() => next(text.trim())}>Continue</Btn>
            </div>
          </div>
          <p style={{ fontSize: 11, color: T.sub, textAlign: "center", marginTop: 8 }}>Tap the mic to talk · tap again to add it in</p>
        </div>
      )}

      <Btn kind="ghost" onClick={() => { stop(); i > 0 ? setI(i - 1) : null; }} style={{ marginTop: 10 }}>
        {i > 0 ? "← Back" : ""}
      </Btn>
    </>
  );
}

const inputStyle = { width: "100%", borderRadius: 16, border: `1px solid ${T.line}`, padding: "14px 16px",
  fontSize: 15.5, background: "#fff", color: T.ink, outline: "none", fontFamily: "inherit" };

function ChoiceRow({ label, onClick, danger }) {
  return (
    <button onClick={onClick} style={{ textAlign: "left", background: "#fff", border: `1px solid ${danger ? "#f3c1c1" : T.line}`,
      borderRadius: 16, padding: "15px 16px", fontSize: 15.5, cursor: "pointer", boxShadow: T.soft,
      color: danger ? "#c0392b" : T.ink, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      {label} <ChevronRight size={18} color={T.sub} />
    </button>
  );
}

function MultiSelect({ opts, value, onChange, onNext }) {
  const toggle = (o) => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        {opts.map((o) => {
          const on = value.includes(o);
          return (
            <button key={o} onClick={() => toggle(o)} style={{ borderRadius: 999, padding: "10px 15px", fontSize: 14,
              cursor: "pointer", border: `1px solid ${on ? T.green : T.line}`, background: on ? T.green : "#fff",
              color: on ? "#fff" : T.ink, boxShadow: on ? "none" : T.soft }}>{o}</button>
          );
        })}
      </div>
      <Btn onClick={onNext}>Continue</Btn>
    </div>
  );
}

function fallbackPlan(name, answers = {}) {
  const focuses = ["Landing gently", "Steady footing", "One thing at a time", "Reaching out", "Practical ground", "Kinder self-talk", "Connection", "Looking forward"];
  const skills = [
    ["Choose one tiny morning anchor — water, medication if prescribed, a shower, or opening the curtains.", "Notice one good thing, however small, and tell AI Juan how today is going."],
    ["Pick one repeatable anchor for the day and try it at roughly the same time.", "Write down one small win before bed and check in with one safe person."],
    ["Name the biggest problem on your mind and break it into one next step only.", "Practise one small boundary: pause, say no, ask for time, or make a clear request."],
    ["Write down two people or places you could reach out to when you need company.", "Ask one safe person for a simple check-in, and message the real Juan in the app if you want a human-team connection."],
    ["Choose one practical task that would make this week 1% easier.", "Write one small goal that matters to you and ask Mick for help if it involves bills, housing, or paperwork."],
    ["Notice one harsh thought and answer it as fairly as you would answer a mate.", "Ask Carlos for one calming tool, then practise it once when you are not already overwhelmed."],
    ["Have one honest conversation with someone in your corner, with Lila available to help prepare.", "Offer or receive one small piece of support without trying to fix everything."],
    ["Look back at what helped, what did not, and what you want to keep.", "Choose one next-week action that protects your momentum and celebrate the effort you put in."],
  ];
  const walkProgression = [
    "Five minutes before you leave, get ready slowly, then take a gentle 20-minute walk. If energy is low, split it into two 10-minute walks.",
    "Get your shoes and water ready five minutes early, then take a relaxed 20-minute walk and notice one landmark.",
    "Prepare five minutes before leaving, then take a 20-minute walk with one short stretch of purposeful pace if comfortable.",
    "Start your five-minute pre-routine, then take a 20-minute walk somewhere with a little fresh air or friendly activity around you.",
    "Get ready five minutes early, then take a 20-minute walk and gently choose a slightly longer route if it feels right.",
    "Use the five-minute pre-routine, then take a 20-minute walk with two brief purposeful sections, returning to an easy pace whenever needed.",
    "Prepare five minutes before leaving, then take a 20-minute walk toward a small destination that helps you feel connected to the world.",
    "Get ready five minutes early, then take a 20-minute walk and notice how your route, pace, or confidence has changed since Week 1.",
  ];
  const dailyRhythm = [
    "Notice one good thing and tell AI Juan how the morning is starting.",
    "Check in with one safe person, even if it is only a short message.",
    "Choose one small win and write down the tiniest next step.",
    "Pause and notice what your body and mind need before choosing today’s task.",
    "Tell Juan, Carlos, or someone safe one thing you managed this week.",
    "Notice one moment that felt a little easier, lighter, or more hopeful.",
    "Look back at the week with kindness: what helped, what was hard, and what can wait?",
  ];
  const weeks = focuses.map((focus, wi) => ({
    n: wi + 1,
    focus,
    days: Array.from({ length: 7 }, (_, di) => {
      const tasks = [
        dailyRhythm[di],
        walkProgression[wi],
        skills[wi][di % 2],
      ];
      const varied = [
        "Write or voice a short Journal entry about what is taking up space in your head.",
        "Capture one Fleeting Thought in the Journal — no need to turn it into a full entry.",
        "Play one of the Games & Puzzles for 10–15 minutes as a deliberate reset.",
        "Open the Toolkit and try one activity you have not used yet.",
        "Ask Carlos one honest question about this week’s focus.",
        "Check in with AI Juan and tell him one thing you managed today.",
        "Message the real Juan through the app if you would like a human-team check-in.",
        "Look at the Resilience Hub Facebook group and notice one post or conversation that feels welcoming.",
        "If you feel ready, react to or support one post in the Resilience Hub Facebook group — no need to write anything yet.",
        "If you feel comfortable, consider making one simple post in the Resilience Hub Facebook group, such as saying hello or sharing a small win.",
        "If it feels like a brave but useful step, look up the South West Sydney Men’s Shed and consider calling or visiting — there is no pressure to commit.",
        "Write down one small win and one tiny next step for tomorrow.",
      ];
      if (di === 0) tasks.push(wi === 0 ? "Tell AI Juan what would make today feel a little safer or steadier." : `Check in with one safe person, or say hi to AI Juan about Week ${wi + 1}.`);
      if (di === 6) tasks.push(varied[(wi * 2) % varied.length]);
      if ([2, 4].includes(di)) tasks[2] = varied[(wi * 3 + di) % varied.length];
      if (di === 5 && wi >= 3) tasks[2] = wi === 3 ? varied[7] : wi === 4 ? varied[8] : wi === 5 ? varied[9] : wi === 6 ? varied[10] : varied[11];
      if ([1, 3, 5].includes(wi) && di === 0) tasks.unshift("Plan review — say 'Plan Review' to Carlos to check in on how your plan's going and reshape it if needed.");
      return { d: di + 1, tasks: tasks.slice(0, 3) };
    }),
  }));
  const goal = answers?.goal ? ` You said you would like “${String(answers.goal).slice(0, 120)}” to feel different.` : "";
  return { summary: `Here's a practical eight-week plan for you, ${name || "friend"}. It grows slowly, keeps walking and connection at the centre, and leaves room for real life — you do not have to do it perfectly.${goal} If something does not fit, ask Carlos for a plan review and we will adjust it.`, startedAt: Date.now(), weeks };
}

/* ---------- hub / dashboard ---------- */
/* ---------- games & puzzles ---------- */
const GAMES = [
  { id: "sloanefox", title: "Sloane Fox: Stand Together", blurb: "Side-scrolling co-op — stand together through five fronts.",
    tag: "Arcade", file: "sloanefox.html", tint: "#12242a", ic: "#2ee6d6" },
  { id: "neojack", title: "Neo Jack: Sky Defender", blurb: "Juan's arcade shooter — dodge, blast, survive.",
    tag: "Arcade", file: "neojack.html", tint: "#1a1030", ic: "#ff3355" },
  { id: "sudoku", title: "Sudoku", blurb: "Classic number puzzle — easy, medium & hard.",
    tag: "Puzzle", file: "sudoku.html", tint: "#e7f0ea", ic: "#37a065" },
  { id: "wordsearch", title: "Word Search", blurb: "Find the hidden words — calm, themed grids.",
    tag: "Puzzle", file: "wordsearch.html", tint: "#e3eef6", ic: "#3f6faf" },
  { id: "crossword", title: "Mini Crossword", blurb: "A quick 5×5 — every row and column is a word.",
    tag: "Puzzle", file: "crossword.html", tint: "#e8f2ec", ic: "#2c7d50" },
];

function GamesPage({ gameScores, onScore, getProgress, onSaveProgress, onClearProgress, onBack }) {
  const [open, setOpen] = useState(null);
  const game = GAMES.find((g) => g.id === open);
  const frameRef = useRef(null);
  const scoresRef = useRef(gameScores || {});
  scoresRef.current = gameScores || {};

  // Bridge: games (in the iframe) request/report scores & progress via postMessage.
  useEffect(() => {
    function onMsg(e) {
      const d = e.data;
      if (!d || typeof d !== "object") return;
      const post = (msg) => {
        try { frameRef.current && frameRef.current.contentWindow &&
          frameRef.current.contentWindow.postMessage(msg, "*"); } catch {}
      };
      if (d.type === "rh-get-best") {
        post({ type: "rh-best", game: d.game, best: scoresRef.current[d.game] ?? null });
      } else if (d.type === "rh-score") {
        const nb = onScore ? onScore(d.game, Number(d.value), d.mode) : null;
        post({ type: "rh-best", game: d.game, best: nb });
      } else if (d.type === "rh-get-progress") {
        post({ type: "rh-progress", game: d.game, state: getProgress ? getProgress(d.game) : null });
      } else if (d.type === "rh-save-progress") {
        if (onSaveProgress) onSaveProgress(d.game, d.state);
      } else if (d.type === "rh-clear-progress") {
        if (onClearProgress) onClearProgress(d.game);
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [onScore, getProgress, onSaveProgress, onClearProgress]);

  if (game) {
    return (
      <>
        <Brand right={<BackBtn onBack={() => setOpen(null)} label="Games & Puzzles" />} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "2px 2px 10px" }}>
          <div style={{ fontWeight: 800, fontSize: 17 }}>{game.title}</div>
          <button onClick={() => { try { window.open(game.file, "_blank", "noopener"); } catch {} }}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none",
              color: T.green, fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>
            Full screen <ExternalLink size={14} />
          </button>
        </div>
        <div className="rh-game-wrap" style={{ borderRadius: 18, overflow: "hidden", boxShadow: T.soft, background: "#07070c", border: `1px solid ${T.line}` }}>
          <iframe ref={frameRef} src={game.file} title={game.title} allow="fullscreen; autoplay"
            className="rh-game-frame"
            style={{ width: "100%", height: "72vh", border: "none", display: "block" }} />
        </div>
        <p style={{ fontSize: 11.5, color: T.sub, textAlign: "center", marginTop: 10, lineHeight: 1.5 }}>
          Tip: tap "Full screen" for a bigger view. Your best scores — and any puzzle in progress — are saved just for you.
        </p>
        <Disclaimer />
      </>
    );
  }

  return (
    <>
      <Brand right={<BackBtn onBack={onBack} />} />
      <SectionTitle>Games &amp; puzzles</SectionTitle>
      <p style={{ fontSize: 13.5, color: T.sub, margin: "0 2px 16px", lineHeight: 1.5 }}>
        A little light relief. Sometimes a few minutes of something fun is exactly what the day needs.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {GAMES.map((g) => (
          <button key={g.id} onClick={() => setOpen(g.id)} style={{ width: "100%", textAlign: "left", cursor: "pointer",
            border: "none", background: T.card, borderRadius: 18, padding: 16, boxShadow: T.soft,
            display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: g.tint, display: "grid", placeItems: "center", flexShrink: 0 }}>
              <Gamepad2 size={26} color={g.ic} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15.5 }}>{g.title}</div>
              <div style={{ fontSize: 13, color: T.sub }}>{g.blurb}</div>
              <div style={{ display: "inline-block", marginTop: 6, fontSize: 11, fontWeight: 700, color: T.greenDk,
                background: "#e7f4ec", borderRadius: 999, padding: "2px 9px" }}>{g.tag}</div>
            </div>
            <ChevronRight size={20} color={T.sub} />
          </button>
        ))}
      </div>
      <Disclaimer />
    </>
  );
}

/* ---------- merch store ---------- */
const MERCH_URL = "https://sloanefox.myshopify.com/";
const MERCH_ITEMS = [
  { name: "Choose Your Edition Tee", price: "$65", img: "/merch/choose-your-edition-new.jpg", url: "https://sloanefox.myshopify.com/products/sloane-fox-pick-your-style-heavyweight-tee" },
  { name: "Vixen Edition Tee", price: "$65", img: "/merch/vixen-edition.jpg", url: "https://sloanefox.myshopify.com/products/sloane-fox-heavyweight-women-s-tee" },
  { name: "Gold Edition Tee", price: "$65", img: "/merch/gold-edition.jpg", url: "https://sloanefox.myshopify.com/products/sloane-fox-gold-edition-heavyweight-tee" },
  { name: "Premium 400GSM Hoodie", price: "$85", img: "/merch/hoodie-400gsm.jpg", url: "https://sloanefox.myshopify.com/products/sloane-fox-400gsm-hoodie" },
  { name: "Premium 320GSM Track Pants", price: "$70", img: "/merch/track-pants-320gsm.jpg", url: "https://sloanefox.myshopify.com/products/sloane-fox-track-pants" },
  { name: "Built Not Bought Edition Tee", price: "$65", img: "/merch/built-not-bought.jpg", url: "https://sloanefox.myshopify.com/products/sloane-fox-built-not-bought-heavyweight-tee" },
  { name: "Sloane Fox OG Edition Tee", price: "$65", img: "/merch/og-edition.jpg", url: "https://sloanefox.myshopify.com/products/sloane-fox-you-been-passed-by-the-fox-premium-280gsm-heavyweight-tee" },
];

function MerchPage({ onBack }) {
  return (
    <>
      <Brand right={<BackBtn onBack={onBack} />} />
      <SectionTitle>Sloane Fox merch</SectionTitle>
      <div style={{ background: "linear-gradient(160deg, #26232c, #3a3550)", color: "#fff", borderRadius: 20,
        padding: "18px 18px", boxShadow: T.soft, marginBottom: 14 }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Built Not Bought</div>
        <p style={{ fontSize: 13.5, lineHeight: 1.55, margin: 0, opacity: 0.9 }}>
          Premium 280GSM heavyweight streetwear, built on resilience. <strong>Every piece supports The Resilience Hub</strong> —
          so wearing it helps keep this whole thing running.
        </p>
      </div>

      <div style={{ fontWeight: 700, margin: "0 2px 8px" }}>Featured pieces</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {MERCH_ITEMS.map((it) => (
          <a key={it.name} href={it.url} target="_blank" rel="noopener noreferrer"
            style={{ display: "block", background: T.card, borderRadius: 18, overflow: "hidden",
              boxShadow: T.soft, textDecoration: "none", color: T.ink }}>
            <div style={{ width: "100%", height: 230, background: "#efeaf5", overflow: "hidden" }}>
              <img src={it.img} alt={it.name} loading="lazy"
                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", display: "block" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{it.name}</div>
                <div style={{ fontSize: 13.5, color: T.green, fontWeight: 700 }}>{it.price}</div>
              </div>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 600, color: T.sub }}>
                View <ExternalLink size={15} />
              </span>
            </div>
          </a>
        ))}
      </div>

      <a href={MERCH_URL} target="_blank" rel="noopener noreferrer"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 16,
          background: `linear-gradient(180deg, #3fb072, ${T.green})`, color: "#fff", textDecoration: "none",
          borderRadius: 16, padding: "15px", fontSize: 16, fontWeight: 800, boxShadow: "0 10px 24px rgba(55,160,101,0.3)" }}>
        <ShoppingBag size={18} /> Shop the full store <ExternalLink size={16} />
      </a>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <a href={`${MERCH_URL}collections/all`} target="_blank" rel="noopener noreferrer"
          style={{ flex: 1, textAlign: "center", background: T.card, borderRadius: 12, padding: "11px", fontSize: 13,
            fontWeight: 600, color: T.ink, textDecoration: "none", boxShadow: T.soft, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5 }}>All apparel <ExternalLink size={14} /></a>
        <a href={`${MERCH_URL}pages/shipping`} target="_blank" rel="noopener noreferrer"
          style={{ flex: 1, textAlign: "center", background: T.card, borderRadius: 12, padding: "11px", fontSize: 13,
            fontWeight: 600, color: T.ink, textDecoration: "none", boxShadow: T.soft, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5 }}>Shipping <ExternalLink size={14} /></a>
        <a href={`${MERCH_URL}pages/contact`} target="_blank" rel="noopener noreferrer"
          style={{ flex: 1, textAlign: "center", background: T.card, borderRadius: 12, padding: "11px", fontSize: 13,
            fontWeight: 600, color: T.ink, textDecoration: "none", boxShadow: T.soft, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5 }}>Contact <ExternalLink size={14} /></a>
      </div>

      <p style={{ fontSize: 11.5, color: T.sub, textAlign: "center", marginTop: 16, lineHeight: 1.5 }}>
        Shopping and checkout happen securely on our Shopify store, which opens in a new tab.
      </p>
    </>
  );
}

/* ---------- Your 8-week program page ---------- */
function ProgramPage({ profile, plan, progress, saveProgress, answers, journalCount, chats, onSaveChat, memories, onConversation, voiceOn, setVoiceOn, responseSpeed, onOpenTool, persona, onOpenChat, onOpenJournal, onStartPlan, isSignupLanding, onBack }) {
  const [coachOpen, setCoachOpen] = useState(false);
  const programWelcome = "This is where it all began — our story, our program, and exactly how it works. Welcome. I built this so no one has to walk this road alone. Take your time, read through, and reach out anytime.";
  const { speak: speakProgramWelcome, stop: stopProgramWelcome, prefetch: prefetchProgramWelcome } = useVoice(voiceOn);
  useEffect(() => {
    if (!voiceOn || !__autoVoiceOn) return undefined;
    // Begin the voice request as soon as the page mounts. The in-flight cache
    // lets the later playback call reuse this request instead of starting a
    // second network round-trip.
    prefetchProgramWelcome(programWelcome, CHARS.carlos);
    const timer = setTimeout(() => speakProgramWelcome(programWelcome, CHARS.carlos), 60);
    return () => { clearTimeout(timer); stopProgramWelcome(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceOn]);
  const weeks = plan?.weeks || [];
  // Support day-based plans ({days:[{d,tasks:[]}]}) and legacy step-based plans ({steps:[]}).
  const weekTaskKeys = (w) => {
    if (Array.isArray(w.days)) {
      const keys = [];
      w.days.forEach((day) => (day.tasks || []).forEach((_, ti) => keys.push(`w${w.n}d${day.d}t${ti}`)));
      return keys;
    }
    return (w.steps || []).map((_, si) => `w${w.n}s${si}`);
  };
  const allKeys = weeks.flatMap(weekTaskKeys);
  const answerHas = (key, value) => {
    const selected = answers?.[key];
    if (Array.isArray(selected)) return selected.includes(value);
    if (typeof selected === "number") {
      const question = QUESTIONS.find((q) => q.key === key);
      return question?.opts?.[selected] === value;
    }
    return selected === value;
  };
  const weeklyExtras = (weekNumber) => {
    const areas = Array.isArray(answers?.areas) ? answers.areas : [];
    const coping = Array.isArray(answers?.coping) ? answers.coping : [];
    const gentle = answerHas("pace", "Small, gentle steps") || answerHas("energy", "Running low") || answerHas("energy", "Empty") || answerHas("mood", "Really rough");
    const challenge = answerHas("pace", "Push me a bit") || answerHas("pace", "A steady challenge") || answerHas("energy", "Good");
    const extras = [];
    if (areas.includes("Feeling alone") || answerHas("support", "Not really anyone")) extras.push("Send one low-pressure message to someone safe, or spend ten minutes somewhere you feel around other people.");
    if (areas.includes("Money") || areas.includes("Housing") || areas.includes("Work / no work") || areas.includes("Legal or justice stuff")) extras.push("Choose one practical loose end and write down the very next step — no need to solve the whole thing today.");
    if (areas.includes("Relationships") || areas.includes("Family")) extras.push("Notice one conversation that could be made 10% easier by choosing a calmer time, a shorter message, or a clearer boundary.");
    if (areas.includes("Health") || answerHas("sleep", "Not great") || answerHas("sleep", "Barely sleeping")) extras.push("Create a small wind-down cue for tonight: lower one light, put your phone down for five minutes, or make a warm drink.");
    if (coping.includes("Exercise or the outdoors")) extras.push("Take a short walk or step outside and notice three things you can see, hear, and feel.");
    if (coping.includes("Music or games")) extras.push("Use one song or a short game as a deliberate reset, then notice whether your body feels any different afterwards.");
    if (coping.includes("Talking to someone")) extras.push("Ask a trusted person one honest, simple question: ‘Can you check in with me later today?’");
    if (coping.includes("Bottling it up")) extras.push("Write three words for how today actually feels. You do not have to explain them or share them.");
    if (answers?.goal) extras.push(`Take one tiny action that points towards your goal: “${String(answers.goal).slice(0, 110)}”.`);
    if (!extras.length) extras.push("Notice one moment this week when things felt a little easier, even if it only lasted a minute.");
    const offset = Math.max(0, (weekNumber - 1) % extras.length);
    const ordered = extras.slice(offset).concat(extras.slice(0, offset));
    return gentle ? ordered.slice(0, 1) : challenge ? ordered.slice(0, 2) : ordered.slice(0, 1);
  };
  const extraKeys = weeks.flatMap((w) => weeklyExtras(w.n).map((_, i) => `w${w.n}extra${i}`));
  const trackedKeys = [...allKeys, ...extraKeys];
  const doneCount = trackedKeys.filter((k) => progress[k]).length;
  const totalSteps = trackedKeys.length;
  const completedWeeks = weeks.filter((w) => weekTaskKeys(w).every((k) => progress[k])).length;
  const currentWeek = Math.min(weeks.length || 1, 1 + completedWeeks);
  const currentWeekData = weeks.find((w) => w.n === currentWeek) || weeks[0];
  const currentWeekKeys = currentWeekData ? [...weekTaskKeys(currentWeekData), ...weeklyExtras(currentWeekData.n).map((_, i) => `w${currentWeekData.n}extra${i}`)] : [];
  const currentWeekDone = currentWeekKeys.filter((k) => progress[k]).length;
  const overallPct = totalSteps ? Math.round((doneCount / totalSteps) * 100) : 0;
  const weekPct = currentWeekKeys.length ? Math.round((currentWeekDone / currentWeekKeys.length) * 100) : 0;
  const [wk, setWk] = useState(currentWeek);
  const [showAllDays, setShowAllDays] = useState(false);
  const [dayCheckIns, setDayCheckIns] = useState({});
  const week = weeks.find((w) => w.n === wk);
  const walkTaskKeys = week ? weekTaskKeys(week).filter((k) => {
    const match = k.match(/^w(\d+)d(\d+)t(\d+)$/); if (!match) return false;
    const day = week.days?.find((d) => String(d.d) === match[2]);
    const task = day?.tasks?.[Number(match[3])];
    return /walk|walking/i.test(String(task)) && /20\s*[- ]?minute|20\s*min/i.test(String(task));
  }) : [];
  const walkDone = walkTaskKeys.filter((k) => progress[k]).length;
  const toggle = (key) => saveProgress({ ...progress, [key]: !progress[key] });
  const coachWeek = week || weeks[0];
  const coachContext = coachWeek ? `You are guiding the person from inside their 8-week plan. They are currently viewing Week ${coachWeek.n}, focused on “${coachWeek.focus}”. Their visible tasks are: ${Array.isArray(coachWeek.days) ? coachWeek.days.flatMap((d) => d.tasks || []).join("; ") : (coachWeek.steps || []).join("; ")}. Help them understand the purpose of this week, answer questions, make tasks feel manageable, and offer gentle, practical advice. Do not pressure them to complete anything. If they are struggling, help them choose one small next step. You can suggest that they tick off a task only when they feel it is genuinely done. This is supportive guidance, not therapy, diagnosis, or a clinical treatment plan.` : "You are helping the person understand and use their personalised 8-week plan. Keep your guidance gentle, practical, and collaborative.";

  // Dates: derived from when the plan was built (older plans without a start date just show no dates).
  const started = plan?.startedAt ? new Date(plan.startedAt) : null;
  const addDays = (dt, n) => { const d = new Date(dt); d.setDate(d.getDate() + n); return d; };
  const fmtD = (dt) => dt ? dt.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) : "";
  const weekStart = (n) => started ? addDays(started, (n - 1) * 7) : null;
  const dayDate = (n, d) => started ? addDays(started, (n - 1) * 7 + (d - 1)) : null;
  const planEnd = started ? addDays(started, (weeks.length || 8) * 7 - 1) : null;

  const checkInKey = (weekNumber, dayNumber) => `w${weekNumber}d${dayNumber}`;
  const firstDayCheckIn = week?.days?.[0] ? dayCheckIns[checkInKey(wk, week.days[0].d)] : null;
  const checkInOptions = [
    { key: "overwhelmed", label: "Really overwhelmed", note: "We’ll keep today to one tiny grounding step." },
    { key: "low", label: "Low or flat", note: "We’ll keep the pace gentle and simple." },
    { key: "steady", label: "Steady enough", note: "We’ll take the day one step at a time." },
    { key: "ready", label: "Ready for a little more", note: "We can try one small stretch if it feels right." },
  ];
  const setDayCheckIn = (dayNumber, value) => setDayCheckIns((old) => ({ ...old, [checkInKey(wk, dayNumber)]: value }));

  const TaskRow = ({ label, k }) => {
    const on = progress[k];
    return (
      <button onClick={() => toggle(k)} style={{ display: "flex", gap: 10, alignItems: "flex-start",
        width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: "8px 0",
        fontSize: 14.5, color: on ? T.sub : T.ink }}>
        {on ? <CheckCircle2 size={20} color={T.green} style={{ flexShrink: 0, marginTop: 1 }} />
          : <Circle size={20} color="#cfc6da" style={{ flexShrink: 0, marginTop: 1 }} />}
        <span style={{ textDecoration: on ? "line-through" : "none" }}>{label}</span>
      </button>
    );
  };

  return (
    <>
      <Brand right={<BackBtn onBack={onBack} label={isSignupLanding ? "Explore The App" : "Toolkit"} />} />
      <SectionTitle>Your 8-Week Plan</SectionTitle>
      <div className="rh-in" style={{ display: "flex", gap: 11, alignItems: "center", margin: "0 0 14px" }}>
        <Portrait src={CHARS.carlos.img} name="Carlos" size={58} speaking={false} tint={CHARS.carlos.tint} />
        <div style={{ background: "linear-gradient(120deg, #eaf3fb, #fff)", border: `1px solid ${T.line}`, borderRadius: 17, padding: "11px 13px", boxShadow: T.soft, fontSize: 13.5, color: T.ink, lineHeight: 1.48 }}>Here's your personal 8-week pathway. It grows with you, at your own pace. Whenever you're ready — we'll get started together. Where would you like to begin first?</div>
      </div>

      {!plan && (
        <div style={{ background: "linear-gradient(160deg, #eafaf0, #ffffff)", border: `1px solid ${T.line}`,
          borderRadius: 20, padding: 18, boxShadow: T.soft, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "#dcf0e4", display: "grid", placeItems: "center", flexShrink: 0 }}>
              <CalendarCheck size={20} color={T.greenDk} />
            </div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>Ready for a plan?</div>
          </div>
          <p style={{ fontSize: 13.5, color: T.sub, lineHeight: 1.55, margin: "0 0 14px" }}>
            You haven't set up an 8-week plan yet — and there's no rush at all. Whenever you feel ready, Carlos will
            ask you a few questions and build one shaped around what you're dealing with, at your own pace.
          </p>
          <button onClick={onStartPlan}
            style={{ width: "100%", background: `linear-gradient(180deg, #3fb072, ${T.green})`, color: "#fff",
              border: "none", borderRadius: 14, padding: "14px", fontSize: 15.5, fontWeight: 800, cursor: "pointer",
              boxShadow: "0 8px 20px rgba(55,160,101,0.28)" }}>
            Build my 8-week plan
          </button>
        </div>
      )}

      {plan && (
      <div style={{ background: "linear-gradient(135deg, #205f48 0%, #347d62 54%, #4d9f68 100%)", color: "#fff", borderRadius: 24, padding: 17, boxShadow: "0 14px 30px rgba(32,95,72,0.22)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", width: 170, height: 170, borderRadius: "50%", right: -70, top: -90, background: "rgba(255,255,255,0.1)" }} />
        <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div><div style={{ fontSize: 10.5, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase", opacity: 0.78 }}>Your momentum</div><div style={{ fontSize: 24, fontWeight: 850, marginTop: 4 }}>{overallPct}% <span style={{ fontSize: 13, fontWeight: 600, opacity: 0.8 }}>complete</span></div></div>
          <div style={{ minWidth: 58, height: 58, borderRadius: "50%", border: "5px solid rgba(255,255,255,0.28)", borderTopColor: "#fff", display: "grid", placeItems: "center", fontSize: 13, fontWeight: 800 }}>{completedWeeks}/{weeks.length || 8}<span style={{ display: "block", fontSize: 8.5, fontWeight: 600, opacity: 0.8, marginTop: -16 }}>weeks</span></div>
        </div>
        <div style={{ position: "relative", marginTop: 13, height: 10, borderRadius: 999, background: "rgba(255,255,255,0.22)", overflow: "hidden" }}><div style={{ height: "100%", width: `${overallPct}%`, borderRadius: 999, background: "linear-gradient(90deg, #fff, #dff6d9)", transition: "width .4s" }} /></div>
        <div style={{ position: "relative", display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 11.5, opacity: 0.9 }}><span>Week {currentWeek} focus: {currentWeekData?.focus || "Getting started"}</span><span>{currentWeekDone}/{currentWeekKeys.length || 0} this week</span></div>
        <div style={{ position: "relative", display: "flex", gap: 5, marginTop: 14 }}>{weeks.map((w) => { const complete = weekTaskKeys(w).every((k) => progress[k]); const active = w.n === currentWeek; return <button key={w.n} onClick={() => { setWk(w.n); setShowAllDays(false); }} aria-label={`Open week ${w.n}`} style={{ flex: 1, height: 8, border: "none", borderRadius: 999, background: complete ? "#fff" : active ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.2)", cursor: "pointer", padding: 0 }} />; })}</div>
        <div style={{ position: "relative", display: "flex", gap: 14, marginTop: 15, fontSize: 12 }}><span><strong style={{ fontSize: 16 }}>{journalCount}</strong><br /><span style={{ opacity: 0.78 }}>journal entries</span></span><span><strong style={{ fontSize: 16 }}>{currentWeekDone}</strong><br /><span style={{ opacity: 0.78 }}>this week</span></span><span><strong style={{ fontSize: 16 }}>{weekPct}%</strong><br /><span style={{ opacity: 0.78 }}>week progress</span></span></div>
        {started && <div style={{ position: "relative", fontSize: 11.5, opacity: 0.78, marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.2)" }}>Started {fmtD(started)} · Finishes around {fmtD(planEnd)}</div>}
      </div>
      )}

      {plan && (
        <>
          <SectionTitle>Your plan</SectionTitle>
          {plan.summary && <p style={{ fontSize: 13.5, color: T.sub, margin: "0 2px 12px", lineHeight: 1.5 }}>{plan.summary}</p>}
          <button onClick={() => setCoachOpen(true)} style={{ width: "100%", border: `1px solid ${T.line}`, borderRadius: 18, padding: "13px 14px", background: "linear-gradient(120deg, #e7f5eb, #f5f8ff 72%, #fff)", boxShadow: T.soft, display: "flex", alignItems: "center", gap: 11, textAlign: "left", cursor: "pointer", marginBottom: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 14, overflow: "hidden", background: "#e8f0fb", flexShrink: 0 }}><img src={CHARS.carlos.img} alt="Carlos" style={{ width: "100%", height: "100%", objectFit: "contain" }} /></div>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontSize: 14.5 }}>Ask Carlos about this week</div><div style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.35 }}>Questions, encouragement, or a gentler way through a task</div></div>
            <ChevronRight size={19} color={T.sub} />
          </button>
          <div style={{ background: "linear-gradient(135deg, #eef8f0 0%, #fff 68%, #fff3e7 100%)", border: `1px solid ${T.line}`, borderRadius: 20, padding: 15, boxShadow: T.soft, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 5 }}><Sparkles size={18} color={T.greenDk} /><div style={{ fontWeight: 800, fontSize: 15.5 }}>A little extra for this week</div></div>
            <div style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.45, marginBottom: 7 }}>These are optional ways to make the plan feel more like yours. Pick what fits, leave what does not.</div>
            {weeklyExtras(wk).map((extra, ei) => <TaskRow key={extra} label={extra} k={`w${wk}extra${ei}`} />)}
          </div>
          <div style={{ background: "linear-gradient(135deg, #f1f8f3, #ffffff 70%, #fff4e8)", border: `1px solid ${T.line}`, borderRadius: 20, padding: 15, boxShadow: T.soft, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}><div style={{ display: "flex", alignItems: "center", gap: 9 }}><div style={{ width: 38, height: 38, borderRadius: 12, background: "#dff1e5", display: "grid", placeItems: "center" }}><Anchor size={19} color={T.greenDk} /></div><div><div style={{ fontWeight: 800, fontSize: 14.5 }}>Walking this week</div><div style={{ fontSize: 12, color: T.sub }}>A gentle daily rhythm</div></div></div><div style={{ fontWeight: 850, fontSize: 18, color: T.greenDk }}>{walkDone}/{walkTaskKeys.length || 7}<span style={{ fontSize: 11, fontWeight: 700, color: T.sub }}> walks</span></div></div>
            <div style={{ height: 8, borderRadius: 999, background: "#dfeee3", overflow: "hidden", marginTop: 13 }}><div style={{ width: `${walkTaskKeys.length ? (walkDone / walkTaskKeys.length) * 100 : 0}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg, #4d9f68, #a8d49c)", transition: "width .35s" }} /></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7, fontSize: 11.5, color: T.sub }}><span>20 minutes each day</span><span>{walkTaskKeys.length ? Math.round((walkDone / walkTaskKeys.length) * 100) : 0}% complete</span></div>
          </div>
          <div style={{ background: T.card, borderRadius: 20, padding: 16, boxShadow: T.soft }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <button onClick={() => { setWk(Math.max(1, wk - 1)); setShowAllDays(false); }} disabled={wk <= 1} style={navBtn(wk <= 1)}><ChevronLeft size={18} /></button>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 12, color: T.sub }}>Week {week?.n}</div>
                <div style={{ fontWeight: 700 }}>{week?.focus}</div>
                {started && week && <div style={{ fontSize: 11, color: T.sub, marginTop: 2 }}>{fmtD(weekStart(week.n))} – {fmtD(addDays(weekStart(week.n), 6))}</div>}
              </div>
              <button onClick={() => { setWk(Math.min(weeks.length, wk + 1)); setShowAllDays(false); }} disabled={wk >= weeks.length} style={navBtn(wk >= weeks.length)}><ChevronRight size={18} /></button>
            </div>

            {week && Array.isArray(week.days) ? (
              <>
                <div style={{ background: "linear-gradient(135deg, #fffaf0, #f1f8f3)", border: `1px solid ${T.line}`, borderRadius: 16, padding: 13, marginTop: 12 }}>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>Before we choose today’s pace</div>
                  <div style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.4, margin: "4px 0 9px" }}>How are you feeling right now? There’s no right answer, and this does not change your progress.</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>{checkInOptions.map((option) => <button key={option.key} onClick={() => setDayCheckIn(week.days[0].d, option.key)} style={{ borderRadius: 999, border: `1px solid ${firstDayCheckIn === option.key ? T.green : T.line}`, background: firstDayCheckIn === option.key ? "#e1f2e6" : "#fff", color: T.ink, padding: "8px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{option.label}</button>)}</div>
                  {firstDayCheckIn && <div style={{ color: T.greenDk, fontSize: 12, marginTop: 8 }}>{checkInOptions.find((x) => x.key === firstDayCheckIn)?.note}</div>}
                </div>
                {(showAllDays ? week.days : week.days.slice(0, 2)).map((day) => (
                  <div key={day.d} style={{ background: day.d % 2 ? "linear-gradient(135deg, #ffffff, #f8fbf8)" : "linear-gradient(135deg, #fffdf9, #ffffff)", border: `1px solid ${T.line}`, borderRadius: 17, padding: "12px 13px", marginTop: 12, boxShadow: "0 5px 14px rgba(47,97,72,0.045)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 4 }}><div style={{ fontSize: 11, fontWeight: 900, color: T.greenDk, textTransform: "uppercase", letterSpacing: 0.8 }}>Day {day.d}</div>{started && <div style={{ fontSize: 11, color: T.sub }}>{fmtD(dayDate(week.n, day.d))}</div>}</div>
                    <div style={{ height: 2, width: 34, borderRadius: 999, background: day.d % 2 ? T.green : "#d99b67", marginBottom: 4 }} />
                    {day.d === week.days[0].d && !firstDayCheckIn ? <div style={{ fontSize: 13, color: T.sub, padding: "10px 0 3px", lineHeight: 1.45 }}>Choose a quick check-in above and we’ll show the right-sized version of today’s tasks.</div> : day.d === week.days[0].d && firstDayCheckIn === "overwhelmed" ? <TaskRow label="Bare minimum for today: put both feet on the floor, take three slow breaths, and let the rest wait." k={`w${week.n}d${day.d}t0`} /> : (day.tasks || []).map((t, ti) => <TaskRow key={ti} label={t} k={`w${week.n}d${day.d}t${ti}`} />)}
                  </div>
                ))}
                {week.days.length > 2 && (
                  <button onClick={() => setShowAllDays((v) => !v)} style={{ marginTop: 14, width: "100%", background: "#f3eef7", border: "none", borderRadius: 12, padding: "11px", fontSize: 13.5, fontWeight: 700, color: T.ink, cursor: "pointer" }}>
                    {showAllDays ? "Show less" : `Show the rest of the week (days 3–${week.days.length})`}
                  </button>
                )}
              </>
            ) : (
              (week?.steps || []).map((s, si) => <TaskRow key={si} label={s} k={`w${week.n}s${si}`} />)
            )}
          </div>
        </>
      )}

      {coachOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(44,42,51,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 10 }}>
          <div style={{ width: "100%", maxWidth: 460, maxHeight: "88vh", overflowY: "auto", background: T.bgMid, borderRadius: "24px 24px 16px 16px", boxShadow: T.lift, padding: "10px 12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 2px 8px" }}><div style={{ fontWeight: 800, fontSize: 15 }}>Carlos · plan coach</div><button onClick={() => setCoachOpen(false)} aria-label="Close Carlos plan coach" style={{ width: 34, height: 34, borderRadius: "50%", border: "none", background: "#fff", color: T.ink, cursor: "pointer", display: "grid", placeItems: "center" }}><X size={18} /></button></div>
            <Chat char={CHARS.carlos} profile={profile} answers={answers} history={chats?.carlos || []} setHistory={(h) => onSaveChat && onSaveChat("carlos", h)} plan={plan} progress={progress} saveProgress={saveProgress} persona={persona} memories={memories} onConversation={onConversation} voiceOn={voiceOn} setVoiceOn={setVoiceOn} responseSpeed={responseSpeed} onBack={() => setCoachOpen(false)} onOpenTool={onOpenTool} embedded planCoachContext={coachContext} />
          </div>
        </div>
      )}
      <Disclaimer />
    </>
  );
}

/* ---------- Your guides page ---------- */
function GuidesPage({ voiceOn, onOpenChat, onBack }) {
  const [filter, setFilter] = useState("all");
  const guidesWelcome = "Welcome to your guides — AI guided support from a team you can turn to whenever you need it. Choose the voice that feels right for you today.";
  const { speak: speakGuidesWelcome, stop: stopGuidesWelcome, prefetch: prefetchGuidesWelcome } = useVoice(voiceOn);
  useEffect(() => {
    if (!voiceOn || !__autoVoiceOn) return undefined;
    prefetchGuidesWelcome(guidesWelcome, CHARS.rex);
    const timer = setTimeout(() => speakGuidesWelcome(guidesWelcome, CHARS.rex), 70);
    return () => { clearTimeout(timer); stopGuidesWelcome(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceOn]);
  const specialists = [
    { char: CHARS.rex, tag: "Your welcomer", filter: "support", roleLine: "Here to help you get started", forWhat: "Finding your way around the Hub and choosing the right guide", tip: "What is this place, and where should I start?", accent: "#e5f3eb" },
    { char: CHARS.juan, tag: "Your main mate", filter: "support", forWhat: "Ask me anything — I'm here for it all:", prompts: ["Juan, what should my routine be today?", "Someone spoke to me like this — how should I respond?", "Can we just talk through what happened today?", "I'm stuck — what do I do next?"], closing: "No question is too small. No topic is off-limits. I'm your mate — run it all by me.", accent: "#e5f3eb" },
    { char: CHARS.carlos, tag: "Supportive tools", filter: "clinical", roleLine: "Inspired by our Registered Psychologist, Carlos Camacho", credentials: "Philosopher • Author • Musician • Golden Key Recipient", forWhat: "Clarity, perspective, & professional guidance when things feel heavy", tip: "I'm feeling flat and can't find the energy to do anything — what should I do?", note: "Carlos is an AI guide inspired by our registered psychologist, Carlos Camacho — he offers supportive tools, not therapy or diagnosis.", accent: "#e8f0fb" },
    { char: CHARS.mick, tag: "Practical life", filter: "practical", forWhat: "Housing, bills, Centrelink, tenancy, and day-to-day logistics.", tip: "I've got a letter or bill I don't understand — can you help me work out the next step?", accent: "#e8eef8" },
    { char: CHARS.lila, tag: "People & relationships", filter: "relationships", forWhat: "Family, partners, friendships, and healthy boundaries.", tip: "I'm having a difficult conversation with someone — can you help me find the right words?", accent: "#fae9df" },
  ];
  const filters = [
    { key: "all", label: "All guides", Icon: Users },
    { key: "support", label: "Everyday support", Icon: Heart },
    { key: "clinical", label: "Calm & coping", Icon: Wind },
    { key: "practical", label: "Practical life", Icon: Wrench },
    { key: "relationships", label: "Relationships", Icon: Users },
  ];
  const visible = filter === "all" ? specialists : specialists.filter((item) => item.filter === filter);
  return (
    <>
      <Brand right={<BackBtn onBack={onBack} />} />
      <div style={{ background: "linear-gradient(135deg, #e4f4e8 0%, #f5fbf7 54%, #fff1e8 100%)", borderRadius: 24, padding: "23px 20px 21px", marginTop: 7, boxShadow: T.soft, border: `1px solid ${T.line}`, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", width: 150, height: 150, borderRadius: "50%", background: "rgba(255,255,255,0.44)", top: -82, right: -38 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 9, color: T.greenDk, fontSize: 11.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", position: "relative" }}>
          <Sparkles size={15} /> Your support circle
        </div>
        <h1 style={{ fontSize: 25, lineHeight: 1.15, margin: "8px 0 7px", position: "relative" }}>Meet your guides</h1>
        <div className="rh-in" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", marginTop: 10, borderRadius: 15, background: "rgba(255,255,255,0.68)", border: "1px solid rgba(77,159,104,0.15)", color: T.ink, fontSize: 13.5, lineHeight: 1.45 }}><Users size={17} color={T.greenDk} style={{ flexShrink: 0 }} /><span>AI guided support</span></div>
        <p style={{ fontSize: 13.5, color: T.sub, lineHeight: 1.52, margin: 0, maxWidth: 360, position: "relative" }}>Different days need different kinds of support. Choose the voice that feels right for this moment — you can switch any time.</p>
      </div>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "16px 1px 3px", scrollbarWidth: "none" }}>
        {filters.map(({ key, label, Icon }) => {
          const active = filter === key;
          return <button key={key} onClick={() => setFilter(key)} aria-pressed={active} style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6, border: active ? `1.5px solid ${T.green}` : `1px solid ${T.line}`, borderRadius: 999, padding: "8px 11px", background: active ? "#e6f5eb" : T.card, color: active ? T.greenDk : T.sub, fontSize: 12, fontWeight: active ? 800 : 600, cursor: "pointer", boxShadow: active ? "0 4px 12px rgba(77,159,104,0.12)" : "none" }}><Icon size={14} />{label}</button>;
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "3px 2px 10px" }}>
        <div style={{ fontSize: 12, color: T.sub, fontWeight: 700 }}>{visible.length} {visible.length === 1 ? "guide" : "guides"} ready to chat</div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: T.sub }}><Circle size={8} fill={T.green} color={T.green} /> Available any time</div>
      </div>
      {visible.map(({ char, tag, roleLine, credentials, forWhat, tip, prompts, closing, note, accent }, index) => (
        <div key={char.slug} style={{ marginBottom: 15 }}>
          <div style={{ background: T.card, borderRadius: 21, padding: 13, boxShadow: T.soft, border: `1px solid ${T.line}`, borderTop: `4px solid ${char.tint}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
              <div style={{ width: 72, height: 72, borderRadius: 21, overflow: "hidden", background: `radial-gradient(120% 100% at 50% 20%, #fff, ${accent})`, flexShrink: 0, boxShadow: "0 5px 14px rgba(47,97,72,0.10)" }}><img src={char.img} alt={char.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ display: "inline-flex", alignItems: "center", gap: 5, color: T.greenDk, fontSize: 10.5, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 4 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: T.green }} /> {tag}</div><div style={{ fontWeight: 800, fontSize: 18 }}>{char.name}</div><div style={{ fontSize: 12.5, color: T.sub, marginTop: 2 }}>{roleLine || char.role}</div>{credentials && <div style={{ fontSize: 11.5, color: T.greenDk, fontWeight: 700, marginTop: 4 }}>{credentials}</div>}</div>
              <div style={{ width: 35, height: 35, borderRadius: "50%", background: char.tint, color: T.greenDk, display: "grid", placeItems: "center", flexShrink: 0 }}><ChevronRight size={19} /></div>
            </div>
            <div style={{ background: accent, borderRadius: 14, padding: "11px 12px", marginTop: 12 }}>{prompts ? <><div style={{ fontSize: 13, color: T.ink, lineHeight: 1.48, fontWeight: 700 }}>{forWhat}</div><div style={{ display: "grid", gap: 5, marginTop: 8 }}>{prompts.map((prompt) => <div key={prompt} style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.4 }}>“{prompt}”</div>)}</div><div style={{ fontSize: 12.5, color: T.ink, lineHeight: 1.45, marginTop: 8 }}>{closing}</div></> : <><div style={{ fontSize: 13, color: T.ink, lineHeight: 1.48 }}><strong>Best for</strong> · {forWhat}</div><div style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.45, marginTop: 6 }}><strong>Try saying:</strong> “{tip}”</div></>}</div>
            <button onClick={() => onOpenChat(char.slug)} aria-label={`Chat with ${char.name}`} style={{ width: "100%", marginTop: 10, border: "none", borderRadius: 13, padding: "10px 12px", background: `linear-gradient(100deg, ${T.greenDk}, ${T.green})`, color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>Start a chat with {char.name} <span style={{ opacity: 0.8 }}>→</span></button>
          </div>
          {note && <div style={{ background: "#eef4fb", border: `1px solid #d3e3f5`, borderRadius: 14, padding: 12, marginTop: 8 }}><p style={{ fontSize: 12, color: T.sub, lineHeight: 1.5, margin: 0 }}>{note}</p></div>}
        </div>
      ))}
      <div style={{ background: "#fffaf0", border: "1px solid #f0dfb1", borderRadius: 16, padding: 13, margin: "3px 0 16px", display: "flex", alignItems: "center", gap: 9 }}><Heart size={17} color="#b1852f" fill="#f3d58f" /><div style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.45 }}>Not sure who fits? Rex or Juan can help point you in the right direction.</div></div>
      <Disclaimer />
    </>
  );
}


function ResourcesIcon({ size = 24, color = "currentColor", strokeWidth = 2.2 }) {
  return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M6 12.5h20l-1.8 12.2a2 2 0 0 1-2 1.7H9.8a2 2 0 0 1-2-1.7L6 12.5Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
    <path d="M4.5 12.5h23M9 12.5l2.5-5h9l2.5 5M11 17.5v4M16 17.5v4M21 17.5v4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <path d="M21.8 5.5c1.8-2.2 4.3-2.4 5.7-1.9-.1 2.2-1.4 4.2-3.5 4.8-1.2.3-2-.2-2.2-1.1-.2-.6-.2-1.2 0-1.8Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
  </svg>;
}

function Hub({ profile, plan, progress, saveProgress, journalCount, voiceOn, setVoiceOn, onOpenChat, onOpenProgram, onOpenJournal, onOpenGuides, onOpenMerch, onOpenCarlosLibrary, onOpenGames, onOpenToolkit, onOpenResources, onOpenSafety, onOpenNotifications, onOpenCoordinator, onOpenSettings, onOpenMensGroup, onOpenMensShed, onOpenAdminMessages, onOpenProgramInfo, onReset, isAdmin, authEnabled, guestMode, onExitGuest, onOpenAdmin, onOpenProfile, onSignOut, session, rexHistory, onSaveRexChat, memories, onConversation, answers, rexPersona }) {
  const { speak, stop, speaking } = useVoice(voiceOn);
  const [notifRefresh, setNotifRefresh] = useState(0);
  const [shareMsg, setShareMsg] = useState("");
  const shareApp = async () => {
    const url = typeof window !== "undefined" ? window.location.origin : "";
    const data = { title: "The Resilience Hub", text: "The Resilience Hub — you never have to walk it alone.", url };
    try {
      if (navigator.share) { await navigator.share(data); return; }
      await navigator.clipboard.writeText(url);
      setShareMsg("Link copied!"); setTimeout(() => setShareMsg(""), 2000);
    } catch { /* cancelled or blocked */ }
  };
  const unreadCount = useUnreadNotifications(authEnabled ? session : null, notifRefresh);
  const unreadCoord = useUnreadCoordinator(authEnabled ? session : null, notifRefresh);
  const unreadAdminMsgs = useUnreadAdminMessages(isAdmin, notifRefresh);
  const nm = profile?.name && profile.name !== "friend" ? profile.name : "";

  useEffect(() => () => stop(), [stop]);

      const card = (onClick, tint, ic, Icon, title, sub, badge) => (
    <button onClick={onClick} aria-label={`${title}: ${sub}`} style={{ width: "100%", background: "linear-gradient(110deg, #ffffff 0%, #fbfefc 100%)", borderRadius: 21, padding: 15,
      boxShadow: T.soft, border: `1px solid ${T.line}`, cursor: "pointer", display: "flex", alignItems: "center", gap: 13, textAlign: "left", transition: "transform .15s ease, box-shadow .15s ease" }}>
      <div style={{ width: 48, height: 48, borderRadius: 16, background: `linear-gradient(145deg, ${tint}, #ffffff)`, display: "grid", placeItems: "center", position: "relative", flexShrink: 0, boxShadow: `inset 0 0 0 1px ${ic}18` }}>
        <Icon size={22} color={ic} strokeWidth={2.2} />
        {badge > 0 && (
          <span style={{ position: "absolute", top: -5, right: -5, minWidth: 18, height: 18, borderRadius: 999,
            background: "#e5484d", color: "#fff", fontSize: 11, fontWeight: 700, display: "grid", placeItems: "center", padding: "0 4px" }}>{badge}</span>
        )}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>
        <div style={{ fontSize: 13, color: T.sub }}>{sub}</div>
      </div>
      <ChevronRight size={20} color={T.sub} />
    </button>
  );

  return (
    <>
      {authEnabled && session && (
        <NotificationPopup session={session} onClosed={() => setNotifRefresh((k) => k + 1)} />
      )}
      {shareMsg && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 130,
          background: T.ink, color: "#fff", borderRadius: 999, padding: "10px 18px", fontSize: 13.5, boxShadow: T.lift }}>{shareMsg}</div>
      )}
      <Brand right={<>
        <VoiceToggle on={voiceOn} set={setVoiceOn} />
        {authEnabled && (
          <div style={{ position: "relative", flexShrink: 0 }}>
            <button onClick={onOpenNotifications} aria-label="Notifications" title="Notifications" style={hubIconBtn(T.sub)}>
              <Megaphone size={19} />
            </button>
            {unreadCount > 0 && (
              <span style={{ position: "absolute", top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 999,
                background: "#e5484d", color: "#fff", fontSize: 9.5, fontWeight: 700, display: "grid", placeItems: "center", padding: "0 3px" }}>
                {unreadCount}
              </span>
            )}
          </div>
        )}
        {authEnabled && (
          <button onClick={onOpenProfile} aria-label="Your profile" title="Your profile" style={hubIconBtn(T.sub)}>
            <User size={20} />
          </button>
        )}
        {isAdmin && (
          <button onClick={onOpenAdmin} aria-label="Admin" title="Admin" style={hubIconBtn(T.green)}>
            <Shield size={20} />
          </button>
        )}
        {isAdmin && (
          <div style={{ position: "relative", flexShrink: 0 }}>
            <button onClick={onOpenAdminMessages} aria-label="Member messages" title="Member messages" style={hubIconBtn(T.green)}>
              <MessageCircle size={20} />
            </button>
            {unreadAdminMsgs > 0 && (
              <span style={{ position: "absolute", top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 999,
                background: "#e5484d", color: "#fff", fontSize: 9.5, fontWeight: 700, display: "grid", placeItems: "center", padding: "0 3px" }}>
                {unreadAdminMsgs}
              </span>
            )}
          </div>
        )}
        <button onClick={onOpenSettings} aria-label="Settings" title="Settings" style={hubIconBtn(T.sub)}>
          <SettingsIcon size={19} />
        </button>
        <button onClick={shareApp} aria-label="Share the app" title="Share" style={hubIconBtn(T.sub)}>
          <Share2 size={19} />
        </button>
      </>} />

      {guestMode && (
        <div style={{ background: "#fff6da", border: "1px solid #ecd98f", borderRadius: 16, padding: "10px 14px",
          marginTop: 6, display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: "#7a6420" }}>
          <span style={{ flex: 1, lineHeight: 1.4 }}>Testing mode — no account, nothing here is saved anywhere.</span>
          <button onClick={onExitGuest} style={{ background: "none", border: "none", color: "#7a6420",
            fontWeight: 700, textDecoration: "underline", cursor: "pointer", fontSize: 12.5, flexShrink: 0 }}>
            Exit
          </button>
        </div>
      )}

      {/* welcome band */}
      <div style={{ background: "linear-gradient(135deg, #e8f6ec 0%, #f7fcf8 56%, #fff1e4 100%)", borderRadius: 24, padding: "20px 18px", boxShadow: T.soft, marginTop: 8, border: "1px solid rgba(77,159,104,0.16)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: -24, top: -30, width: 130, height: 130, borderRadius: "50%", background: "rgba(255,255,255,0.48)" }} />
        <div style={{ position: "relative" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.72)", borderRadius: 999, padding: "5px 10px", color: T.greenDk, fontSize: 11, fontWeight: 800, letterSpacing: 0.3, marginBottom: 10 }}><Sparkles size={13} /> A softer place to land</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4, color: T.greenDk }}>Welcome to The Resilience Hub{nm ? `, ${nm}` : ""}</div>
          <div style={{ fontSize: 13.5, color: T.green, fontWeight: 700, marginBottom: 10 }}>You never have to walk it alone.</div>
        </div>
        <div style={{ position: "relative", fontSize: 13.5, color: T.sub, lineHeight: 1.55 }}>
          A warm place to get support, one step at a time. Not sure who to talk to?
          <br />• <strong style={{ color: T.ink }}>Juan</strong> — a mate who gets it, for anything at all
          <br />• <strong style={{ color: T.ink }}>Carlos</strong> — calming, clinical tools for stress &amp; low mood
          <br />• <strong style={{ color: T.ink }}>Mick</strong> — housing, bills &amp; practical life
          <br />• <strong style={{ color: T.ink }}>Lila</strong> — family &amp; relationships
          <br />Or just say hi to Rex below — he'll point you the right way.
        </div>
      </div>

      {/* Rex — friendly welcomer (opens his own chat screen) */}
      <button onClick={() => onOpenChat("rex")} style={{ width: "100%", textAlign: "left", cursor: "pointer",
        border: "none", background: "linear-gradient(160deg, #eafaf0, #ffffff)", borderRadius: 20, padding: 16,
        boxShadow: T.soft, marginTop: 14, display: "flex", alignItems: "center", gap: 14 }}>
        <Portrait src={CHARS.rex.img} name="Rex" size={64} speaking={false} tint={CHARS.rex.tint} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>Say hi to Rex</div>
          <div style={{ fontSize: 13, color: T.sub, lineHeight: 1.45 }}>
            Your welcomer — he'll show you around and point you to the right guide. Tap to chat.
          </div>
        </div>
        <ChevronRight size={20} color={T.sub} />
      </button>

      {/* menu cards — grouped for clarity */}
      <SectionTitle>Your journey</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        {card(onOpenProgramInfo, "#e9f5ee", "#2c7d50", Heart, "Resilience & Recovery Program", "Our free 8-week in-person program — how it works & how to join")}
        {card(onOpenGuides, "#f4e3d9", "#c9803f", Users, "Your guides", "Juan, Carlos, Mick & Lila — chat any time")}
        {card(onOpenToolkit, "#dceee2", "#2c7d50", Wrench, "Toolkit", "Calm down, reflect & grow, stay safe")}
        {card(onOpenProgram, "#e7eefb", "#3f6faf", CalendarCheck, plan ? "Your 8-Week Plan" : "Optional 8-Week Plan", plan ? "Your active plan, progress & next steps" : "Your plan, progress & next steps — use it if it helps")}
        <button onClick={onOpenJournal} aria-label="Private Journal: A calm, PIN-protected place for your thoughts" style={{ width: "100%", background: "linear-gradient(125deg, #fffdf7 0%, #f7f0dc 48%, #edf7f0 100%)", borderRadius: 21, padding: 15, boxShadow: T.soft, border: "1px solid rgba(201,162,39,0.20)", cursor: "pointer", display: "flex", alignItems: "center", gap: 13, textAlign: "left", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", right: -22, top: -28, width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,0.52)" }} />
          <div style={{ width: 48, height: 48, borderRadius: 16, background: "linear-gradient(145deg, #e9d783, #fffaf0)", display: "grid", placeItems: "center", position: "relative", flexShrink: 0, boxShadow: "inset 0 0 0 1px rgba(151,113,24,0.16)" }}>
            <BookOpen size={22} color="#9a741a" strokeWidth={2.2} />
            <span style={{ position: "absolute", right: -5, bottom: -5, width: 19, height: 19, borderRadius: 999, background: T.green, display: "grid", placeItems: "center", boxShadow: "0 2px 7px rgba(32,95,72,0.28)" }}><Shield size={11} color="#fff" fill="#fff" /></span>
          </div>
          <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
            <div style={{ color: "#8e6a17", fontSize: 10, fontWeight: 900, letterSpacing: 0.9, marginBottom: 2 }}>YOUR PRIVATE SPACE</div>
            <div style={{ fontWeight: 800, fontSize: 16, color: T.ink }}>Private Journal</div>
            <div style={{ fontSize: 13, color: T.sub, lineHeight: 1.35 }}>Write, reflect, or capture a fleeting thought at your own pace</div>
          </div>
          <ChevronRight size={20} color="#9a741a" style={{ position: "relative" }} />
        </button>

      </div>

      <SectionTitle>Support us</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        <a href="https://gofund.me/4ce6afdc4" target="_blank" rel="noopener noreferrer" aria-label="Support The Resilience Hub on GoFundMe"
          style={{ display: "flex", alignItems: "center", gap: 12, background: "linear-gradient(135deg, #fff0f0 0%, #fff8f4 58%, #ffe7e1 100%)", border: "1px solid rgba(201, 79, 79, 0.18)", borderRadius: 20, padding: 14, boxShadow: T.soft, textDecoration: "none", color: T.ink }}>
          <div style={{ width: 46, height: 46, borderRadius: 14, background: "linear-gradient(145deg, #e5484d, #f38a73)", display: "grid", placeItems: "center", flexShrink: 0, boxShadow: "0 6px 14px rgba(201, 79, 79, 0.2)" }}>
            <Heart size={23} color="#fff" fill="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "inline-block", color: "#c43f45", fontSize: 10, fontWeight: 900, letterSpacing: 1, marginBottom: 2 }}>GOFUNDME</div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Support The Resilience Hub</div>
            <div style={{ fontSize: 13, color: T.sub, lineHeight: 1.4 }}>Help us keep support free for everyone</div>
          </div>
          <ExternalLink size={18} color="#c94f4f" />
        </a>
        <button onClick={onOpenMerch} style={{ width: "100%", background: "linear-gradient(135deg, #f4eef7 0%, #fff 72%)", border: "none", borderRadius: 20, padding: 14, boxShadow: T.soft, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}>
          <img src="/merch/choose-your-edition-new.jpg" alt="Sloane Fox artwork" style={{ width: 46, height: 46, borderRadius: 14, objectFit: "cover", objectPosition: "50% 37%", flexShrink: 0, border: "1px solid rgba(91,75,122,0.14)" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Sloane Fox merch</div>
            <div style={{ fontSize: 13, color: T.sub }}>Built Not Bought — every piece supports the Hub</div>
          </div>
          <ChevronRight size={20} color={T.sub} />
        </button>
        <button onClick={onOpenCarlosLibrary} aria-label="Open Support Carlos Camacho library" style={{ width: "100%", background: "linear-gradient(135deg, #e8f0fb 0%, #ffffff 62%, #f3eafa 100%)", border: "1px solid rgba(63,111,175,0.16)", borderRadius: 20, padding: 14, boxShadow: T.soft, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}>
          <div style={{ width: 46, height: 46, borderRadius: 14, overflow: "hidden", background: "#dfeafa", flexShrink: 0, border: "1px solid rgba(63,111,175,0.12)" }}><img src={CHARS.carlos.img} alt="Carlos Camacho" style={{ width: "100%", height: "100%", objectFit: "contain" }} /></div>
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ display: "inline-block", color: T.blueDk, fontSize: 10, fontWeight: 900, letterSpacing: 0.9, marginBottom: 2 }}>CARLOS CAMACHO</div><div style={{ fontWeight: 800, fontSize: 16 }}>Support Carlos Camacho</div><div style={{ fontSize: 13, color: T.sub, lineHeight: 1.4 }}>Explore his books on happiness, philosophy and life</div></div>
          <ChevronRight size={20} color={T.blueDk} />
        </button>
      </div>

      <SectionTitle>Stay connected</SectionTitle>
      <p style={{ margin: "-3px 2px 12px", fontSize: 12, color: T.sub, lineHeight: 1.5 }}>All listed services are recommendations only. We do not run or manage them. Always check directly with each provider for current details.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        <button onClick={onOpenResources} aria-label="Open Resources" style={{ width: "100%", background: "linear-gradient(135deg, #e0f3e7 0%, #f7fbf7 54%, #fff0dc 100%)", border: "1px solid rgba(61, 142, 91, 0.2)", borderRadius: 20, padding: 14, boxShadow: T.soft, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}>
          <div style={{ width: 48, height: 48, borderRadius: 16, background: "linear-gradient(145deg, #236b4d, #58a878)", display: "grid", placeItems: "center", flexShrink: 0, boxShadow: "0 7px 15px rgba(35,107,77,0.2)" }}><ResourcesIcon size={27} color="#fff" /></div>
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ display: "inline-block", color: T.greenDk, fontSize: 10, fontWeight: 900, letterSpacing: 1, marginBottom: 2 }}>PRACTICAL SUPPORT</div><div style={{ fontWeight: 800, fontSize: 16 }}>Resources</div><div style={{ fontSize: 13, color: T.sub, lineHeight: 1.4 }}>Food, recovery, safety, housing and everyday help</div></div><ChevronRight size={20} color={T.greenDk} />
        </button>
        {[
          { name: "Resilience Hub group", sub: "Our community — support, chat & connection", url: "https://www.facebook.com/share/g/1Edkyyez1t/" },
        ].map((f) => (
          <a key={f.name} href={f.url} target="_blank" rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", gap: 12, background: T.card, borderRadius: 20, padding: 16,
              boxShadow: T.soft, textDecoration: "none", color: T.ink }}>
            <div style={{ width: 46, height: 46, borderRadius: 14, background: f.img ? "#050505" : "#1877F2", display: "grid", placeItems: "center", overflow: "hidden", flexShrink: 0 }}>
              {f.img ? <img src={f.img} alt="Sloane Fox logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "#fff", fontWeight: 900, fontSize: 26, fontFamily: "Georgia, serif", lineHeight: 1 }}>f</span>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{f.name}</div>
              <div style={{ fontSize: 13, color: T.sub }}>{f.sub}</div>
            </div>
            <ExternalLink size={18} color={T.sub} />
          </a>
        ))}
        <a href="https://resiliencehub.s.gy/website" target="_blank" rel="noopener noreferrer" aria-label="Visit The Resilience Hub website"
          style={{ display: "flex", alignItems: "center", gap: 12, background: "linear-gradient(135deg, #e5f5ea 0%, #f7fbf8 62%, #fff1e5 100%)", border: "1px solid rgba(78, 158, 103, 0.18)", borderRadius: 20, padding: 14,
            boxShadow: T.soft, textDecoration: "none", color: T.ink }}>
          <div style={{ width: 46, height: 46, borderRadius: 14, background: "linear-gradient(145deg, #1d6b4b, #79b852)", display: "grid", placeItems: "center", flexShrink: 0, boxShadow: "0 6px 14px rgba(38, 111, 76, 0.18)" }}>
            <span style={{ color: "#fff", fontWeight: 900, fontSize: 22, lineHeight: 1 }}>RH</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>The Resilience Hub website</div>
            <div style={{ fontSize: 13, color: T.sub, lineHeight: 1.4 }}>Meet the team, learn more, and stay connected</div>
          </div>
          <ExternalLink size={18} color={T.greenDk} />
        </a>
        <button onClick={onOpenMensShed} aria-label="Open South West Sydney Men's Shed"
          style={{ width: "100%", background: "linear-gradient(135deg, #e8f5ec 0%, #fffdf7 62%, #fff1d1 100%)", border: "1px solid rgba(41,126,77,0.14)", borderRadius: 20, padding: 12, boxShadow: T.soft, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}>
          <img src="/mens-shed/south-west-sydney-mens-shed-sign.png" alt="South West Sydney Men’s Shed sign" style={{ width: 46, height: 46, borderRadius: 14, objectFit: "cover", objectPosition: "50% 50%", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "inline-block", color: "#2b7b4c", fontSize: 10, fontWeight: 900, letterSpacing: 0.9, marginBottom: 2 }}>COMMUNITY CONNECTION</div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>South West Sydney Men’s Shed</div>
            <div style={{ fontSize: 13, color: T.sub, lineHeight: 1.35 }}>Mateship, new skills & support — Bonnyrigg</div>
          </div>
          <ChevronRight size={20} color={T.greenDk} />
        </button>
        <a href="https://www.themenstable.org" target="_blank" rel="noopener noreferrer" aria-label="Visit The Men’s Table website"
          style={{ display: "flex", alignItems: "center", gap: 12, background: "linear-gradient(135deg, #fffaf0 0%, #ffffff 58%, #edf6f1 100%)", border: "1px solid rgba(51,111,82,0.15)", borderRadius: 20, padding: 12, boxShadow: T.soft, textDecoration: "none", color: T.ink }}>
          <div style={{ width: 46, height: 46, borderRadius: 14, background: "#fff", display: "grid", placeItems: "center", overflow: "hidden", flexShrink: 0, border: "1px solid rgba(51,111,82,0.12)" }}><img src="/community/mens-table-logo.png" alt="The Men’s Table logo" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 4 }} /></div>
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ display: "inline-block", color: "#336f52", fontSize: 10, fontWeight: 900, letterSpacing: 0.9, marginBottom: 2 }}>COMMUNITY CONNECTION</div><div style={{ fontWeight: 800, fontSize: 16 }}>The Men’s Table</div><div style={{ fontSize: 13, color: T.sub, lineHeight: 1.35 }}>Safe conversation, belonging & connection</div></div>
          <ExternalLink size={19} color="#336f52" />
        </a>
        <button onClick={onOpenCoordinator} aria-label={unreadCoord > 0 ? `${unreadCoord} reply from Juan` : "Message the real Juan privately"} style={{ width: "100%", background: "linear-gradient(125deg, #e2f4e8 0%, #ffffff 57%, #fff1e4 100%)", border: "1px solid rgba(44,125,80,0.18)", borderRadius: 20, padding: 13, boxShadow: T.soft, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, textAlign: "left", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", right: -26, top: -33, width: 112, height: 112, borderRadius: "50%", background: "rgba(255,255,255,0.46)" }} />
          <div style={{ width: 50, height: 50, borderRadius: 16, overflow: "hidden", background: "#dceee2", flexShrink: 0, border: "2px solid rgba(255,255,255,0.92)", boxShadow: "0 5px 13px rgba(32,95,72,0.15)", position: "relative" }}><img src={CHARS.juan.img} alt="Juan Carroso" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 24%" }} /></div>
          <div style={{ flex: 1, minWidth: 0, position: "relative" }}><div style={{ color: T.greenDk, fontSize: 10, fontWeight: 900, letterSpacing: 0.9, marginBottom: 2 }}>REAL PERSON · PRIVATE MESSAGE</div><div style={{ fontWeight: 800, fontSize: 16, color: T.ink }}>Message Juan</div><div style={{ fontSize: 13, color: T.sub, lineHeight: 1.35 }}>{unreadCoord > 0 ? `${unreadCoord} reply from Juan` : "Send a private message to the real Juan"}</div></div>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.86)", display: "grid", placeItems: "center", position: "relative", flexShrink: 0 }}><MessageCircle size={17} color={T.greenDk} />{unreadCoord > 0 && <span style={{ position: "absolute", top: -5, right: -5, minWidth: 17, height: 17, borderRadius: 999, background: "#e5484d", color: "#fff", fontSize: 10, fontWeight: 800, display: "grid", placeItems: "center", padding: "0 3px" }}>{unreadCoord}</span>}</div>
        </button>
      </div>

      <SectionTitle>A little extra</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        {card(onOpenGames, "#efeaf5", "#6d55b0", Gamepad2, "Games & puzzles", "A little light relief when you need it")}
      </div>

      <Disclaimer />

      {authEnabled && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 18, marginBottom: 92 }}>
          <button onClick={onSignOut} aria-label="Log out"
            style={{ display: "inline-flex", alignItems: "center", gap: 9, cursor: "pointer",
              background: "#dc2626", color: "#fff", border: "none", borderRadius: 999,
              padding: "13px 30px", fontSize: 15, fontWeight: 700,
              boxShadow: "0 6px 16px rgba(220,38,38,0.28)" }}>
            <LogOut size={18} /> Logout
          </button>
        </div>
      )}
    </>
  );
}

const navBtn = (dis) => ({ width: 36, height: 36, borderRadius: 12, border: `1px solid ${T.line}`, background: "#fff",
  display: "grid", placeItems: "center", cursor: dis ? "default" : "pointer", opacity: dis ? 0.4 : 1, color: T.ink });

const hubIconBtn = (color) => ({ background: "linear-gradient(145deg, #ffffff, #f1f8f3)", border: `1px solid ${T.line}`, borderRadius: 15, width: 42, height: 42,
  display: "grid", placeItems: "center", cursor: "pointer", color, boxShadow: T.soft, flexShrink: 0, transition: "transform .15s ease, box-shadow .15s ease" });

function Stat({ label, value }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontWeight: 700, fontSize: 16 }}>{value}</div>
      <div style={{ color: T.sub, fontSize: 11.5 }}>{label}</div>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h2 style={{ fontSize: 15, fontWeight: 700, margin: "22px 2px 10px", display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 4, height: 15, borderRadius: 2, background: `linear-gradient(${T.teal}, ${T.green})`, display: "inline-block" }} />
      {children}
    </h2>
  );
}

function GuideRow({ char, onClick, big }) {
  return (
    <button onClick={onClick} style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, marginBottom: 10,
      background: T.card, borderRadius: 18, padding: 12, cursor: "pointer", boxShadow: T.soft,
      border: big ? "none" : `1px dashed ${T.line}`, textAlign: "left" }}>
      <div style={{ width: big ? 58 : 48, height: big ? 58 : 48, borderRadius: 16, overflow: "hidden",
        background: `radial-gradient(120% 100% at 50% 20%, #fff, ${char.tint})`, flexShrink: 0 }}>
        <img src={char.img} alt={char.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: big ? 17 : 15 }}>{char.name}</div>
        <div style={{ fontSize: 13, color: T.sub }}>{char.role}</div>
      </div>
      <ChevronRight size={20} color={T.sub} />
    </button>
  );
}

/* ---------- chat ---------- */
function Chat({ char, profile, answers, history, setHistory, plan, progress, saveProgress, persona, memories, onConversation, voiceOn, setVoiceOn, onBack, onOpenTool, embedded, planCoachContext, responseSpeed, onReplayIntro }) {
  const { speak, stop, speaking, paused, pauseResume, prefetch } = useVoice(voiceOn);
  const guideWelcome = char.slug === "juan"
    ? "G'day, I'm Juan. Ask me anything — I'm here for it all. No question is too small, and no topic is off-limits."
    : char.slug === "carlos"
    ? "Hi, I'm Carlos, an AI guide inspired by our Registered Psychologist, Carlos Camacho. We can take things one step at a time."
    : char.slug === "lila"
    ? "Hi, I'm Lila. We can talk through family, relationships, and boundaries at your pace."
    : char.slug === "mick"
    ? "Hi, I'm Mick. We can break practical things down into clear, manageable next steps."
    : "Hi, I'm Rex. I can help you find your way around The Resilience Hub.";
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const sendLockRef = useRef(false);
  const lastSubmittedTextRef = useRef({ text: "", at: 0 });
  const [err, setErr] = useState(null);
  const scrollRef = useRef(null);
  const spoken = useRef(new Set());
  const [pendingImage, setPendingImage] = useState(null); // { dataUrl, mediaType }
  const imgFileRef = useRef(null);
  const composerRef = useRef(null);
  const tapRef = useRef(null); // tracks pointer-down so a scroll drag isn't treated as a tap
  // Grow the message box as they type — plenty of room before it starts scrolling.
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 260) + "px";
  }, [input]);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const VISIBLE_TAIL = 8; // keep the on-screen chat short; full history still saves + still informs the guide
  const searchQ = search.trim().toLowerCase();
  const searchMatches = searchQ ? history.filter((m) => typeof m.content === "string" && m.content.toLowerCase().includes(searchQ)) : null;
  const hiddenCount = Math.max(0, history.length - VISIBLE_TAIL);
  const visibleHistory = searchMatches ? searchMatches : (showAllHistory ? history : history.slice(-VISIBLE_TAIL));

  const pickPhoto = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (!f.type || !f.type.startsWith("image/")) { setErr("Only photos are supported right now — not video or other files."); return; }
    setErr(null);
    resizeImage(f, 1280, (dataUrl) => setPendingImage({ dataUrl, mediaType: "image/jpeg" }));
    e.target.value = "";
  };

  useEffect(() => { scrollRef.current?.scrollTo({ top: 1e6, behavior: 'smooth' }); }, [history, busy, showAllHistory]);
  useEffect(() => {
    if (!voiceOn || !guideWelcome) return undefined;
    // Warm the guide welcome immediately, then play the same in-flight request.
    // This avoids waiting for a second TTS network round-trip after navigation.
    prefetch(guideWelcome, char);
    const timer = setTimeout(() => speak(guideWelcome, char), 70);
    return () => { clearTimeout(timer); stop(); };
    // The welcome should replay when a different guide is opened or voice is enabled.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceOn, char?.slug]);
  useEffect(() => () => { stop(); }, [stop]);

  const send = async (raw, opts) => {
    const text = (raw ?? input).trim();
    const img = pendingImage;
    if ((!text && !img) || busy || sendLockRef.current) return;
    const now = Date.now();
    if (!img && text === lastSubmittedTextRef.current.text && now - lastSubmittedTextRef.current.at < 2500) {
      voiceDebug("duplicate AI request ignored", text);
      return;
    }
    sendLockRef.current = true;
    if (!img) lastSubmittedTextRef.current = { text, at: now };
    if (!img && isCrisisText(text)) {
      stop(); setErr(null); setInput("");
      const crisisUser = { role: "user", content: text, ts: Date.now() };
      const crisisReply = { role: "assistant", content: "I’m really glad you told me. I’m going to pause the usual conversation because you deserve proper human support around you right now. Please use one of the contacts below, and if you might act on these thoughts or are in immediate danger, call 000 now.", ts: Date.now() };
      setHistory([...history, crisisUser, crisisReply]);
      setCrisisActive(true);
      sendLockRef.current = false; setBusy(false);
      return;
    }
    // Response speed: the person's saved Settings preference, unless this one
    // reply was sent via the ⚡ Fast Reply button, which overrides it just once.
    const effSpeed = (opts && opts.forceFast) ? "fast" : (responseSpeed || "normal");
    if (voiceOn && __autoVoiceOn) { try { primeAudio(); } catch {} } // unlock audio inside the send tap so the reply can auto-speak
    stop(); // interrupt: a new message from the person always cuts the guide off
    setErr(null); setInput(""); setPendingImage(null);
    const userMsg = { role: "user", content: text || "(sent a photo)", ts: Date.now() };
    if (img) { userMsg.image = img.dataUrl; userMsg.mediaType = img.mediaType; }
    const newHist = [...history, userMsg];
    setHistory(newHist);
    setBusy(true);
    try {
      let system = char.system + contextBlock(profile, answers);
      if (planCoachContext && char.slug === "carlos") system += `\n\n[CONTEXTUAL PLAN COACH]\n${planCoachContext}`;
      const note = (persona || "").trim();
      if (note) {
        system += `\n\n[Personality — how you come across. This shapes your tone, voice, and character only. The safety, honesty, role, and memory rules above always take priority and must never be overridden by this.]\n${note}`;
      }
      // Only for people who haven't set up a plan — never shown to anyone already on one.
      if (!plan) {
        system += `\n\n[They have NOT set up an 8-week plan. If — and only if — it comes up naturally (they mention wanting structure, direction, goals, or ask what else the app does), you may gently mention once that Carlos can build them a personalised 8-week plan from their 8-Week Plan page, whenever they feel ready. Never interrupt what they're actually talking about to bring it up, never repeat it if they don't take it up, and never push. If they're upset, in crisis, or working through something, do not mention it at all.]`;
      }
      if (memories && memories.length) {
        system += `\n\nWhat you remember about this person from past conversations (use it naturally to feel familiar and caring; never recite it back as a list): ${memories.join("; ")}.`;
      }
      if (effSpeed === "fast") {
        system += `\n\n[Response speed: FAST — for THIS reply only, be quick and direct. 1-2 short sentences, straight to the point, no small talk or preamble. Still warm, just brief.]`;
      } else if (effSpeed === "chilled") {
        system += `\n\n[Response speed: CHILLED — take a bit more time and depth with this reply. Slower, warmer, more thoughtful and reflective than usual, while still staying within the normal 2-5 sentence range.]`;
      }
      // Plan review: keep Carlos in "review mode" for the whole exchange once it
      // comes up, and have him ASK first rather than diving straight in.
      const inReview = plan && Array.isArray(plan.weeks) && char.slug === "carlos" &&
        (/\bplan\s*review\b/i.test(text) || newHist.slice(-4).some((m) => /\bplan\s*review\b/i.test(m.content || "")));
      if (inReview) {
        const summary = plan.weeks.map((w) => {
          const keys = Array.isArray(w.days)
            ? w.days.flatMap((day) => (day.tasks || []).map((_, ti) => `w${w.n}d${day.d}t${ti}`))
            : (w.steps || []).map((_, si) => `w${w.n}s${si}`);
          const done = keys.filter((k) => progress && progress[k]).length;
          return `Week ${w.n} (${w.focus}): ${done}/${keys.length} tasks done`;
        }).join("; ");
        system += `\n\n[PLAN REVIEW] The person has mentioned a plan review. FIRST — if you haven't already asked in this conversation — warmly ask whether they'd like to review their 8-week plan right now. A simple yes/no, no pressure. If they say NO or "not now", warmly reassure them that's completely fine, and remind them they can just say "Plan Review" any time and you'll pick it straight up — then let it go. If they say YES or are clearly ready, gently walk them through it. Their goal was: ${answers?.goal || "(not specified)"}. Progress so far — ${summary}. Celebrate what they've done, ask what's been working and what's felt hard, unrealistic, or just not for them, and talk through changes — including dropping specific tasks they don't enjoy so the plan gets re-shaped around what actually helps. Keep it warm and collaborative — it's their plan. If they settle on changes, describe the adjustments clearly; you don't rewrite it automatically.`;
      }
      // Auto-tick the next pending "Plan review" task when they ask Carlos for one.
      if (char.slug === "carlos" && /\bplan\s*review\b/i.test(text) && plan && Array.isArray(plan.weeks) && saveProgress) {
        const reviewKeys = [];
        plan.weeks.forEach((w) => (w.days || []).forEach((day) => (day.tasks || []).forEach((t, ti) => {
          if (/^plan review/i.test(String(t))) reviewKeys.push(`w${w.n}d${day.d}t${ti}`);
        })));
        const next = reviewKeys.find((k) => !(progress && progress[k]));
        if (next) saveProgress({ ...progress, [next]: true });
      }
      let msgs = newHist.slice(-20).map((m) => {
        if (m.role === "user" && m.image) {
          const base64 = (m.image.split(",")[1] || "");
          return { role: "user", content: [
            { type: "image", source: { type: "base64", media_type: m.mediaType || "image/jpeg", data: base64 } },
            { type: "text", text: m.content || "Here's a photo — what do you notice?" },
          ] };
        }
        return { role: m.role, content: m.content };
      });
      while (msgs.length && msgs[0].role !== "user") msgs = msgs.slice(1); // must start on a user turn
      const speedTokens = effSpeed === "fast" ? 300 : effSpeed === "chilled" ? 1300 : 1000;
      const reply = await callModel({ system, messages: msgs, maxTokens: speedTokens });
      const tagRe = /<tool>\s*(breathing|grounding|meditation|affirmations|calm)\s*<\/tool>/i;
      const found = reply.match(tagRe);
      const tool = found ? found[1].toLowerCase() : null;
      const clean = reply.replace(/<tool>\s*(breathing|grounding|meditation|affirmations|calm)\s*<\/tool>/gi, "").trim();
      const withReply = [...newHist, { role: "assistant", content: clean, tool, ts: Date.now() }];
      setHistory(withReply);
      if (voiceOn && __autoVoiceOn) { spoken.current.add(withReply.length - 1); speak(clean, char); }
      if (onConversation) onConversation(withReply); // quietly refresh long-term memory in the background
    } catch (e) {
      setErr(e.message || "Something went wrong.");
    } finally { sendLockRef.current = false; setBusy(false); }
  };
  const starters = char.slug === "rex"
    ? ["What is this place?", "Who should I talk to?", "I'm new here"]
    : char.slug === "juan"
    ? ["I'm not sure where to start", "Tell me about my plan", "I'm having a rough day"]
    : char.slug === "carlos" ? ["How do I calm a racing mind?", "Explain my plan", "I feel overwhelmed"]
    : char.slug === "mick" ? ["I'm behind on a bill", "Help with housing", "Centrelink is confusing"]
    : ["A family thing is stressing me", "How do I set a boundary?", "I had an argument"];

  return (
    <div style={embedded ? {} : { minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {!embedded && (
        <Brand right={<BackBtn onBack={onBack} />} />
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 12, background: T.card, borderRadius: 18, padding: 10,
        boxShadow: T.soft, marginTop: 4, position: "sticky", top: 6, zIndex: 20 }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, overflow: "hidden",
          background: `radial-gradient(120% 100% at 50% 20%, #fff, ${char.tint})`,
          boxShadow: speaking ? `0 0 0 3px rgba(55,160,101,0.3)` : "none" }}>
          <img src={char.img} alt={char.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700 }}>{char.name}</div>
          <div style={{ fontSize: 12.5, color: T.sub }}>{char.role}</div>
        </div>
        <button onClick={() => { setSearchOpen((v) => !v); if (searchOpen) setSearch(""); }} aria-label="Search this chat" title="Search this chat"
          style={{ background: searchOpen ? T.green : "#fff", border: `1px solid ${searchOpen ? T.green : T.line}`,
            borderRadius: 999, width: 38, height: 38, display: "grid", placeItems: "center", cursor: "pointer",
            color: searchOpen ? "#fff" : T.ink, boxShadow: T.soft }}>
          <Search size={17} />
        </button>
        <ChatHelp />
        <VoiceToggle on={voiceOn} set={setVoiceOn} />
      </div>


      {searchOpen && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 2px", position: "sticky", top: 84, zIndex: 19, background: T.bgMid }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} autoFocus
            placeholder={`Search your chat with ${char.name}…`}
            style={{ flex: 1, borderRadius: 999, border: `1px solid ${T.line}`, padding: "10px 14px", fontSize: 14,
              outline: "none", background: "#fff", color: T.ink }} />
          {searchMatches && <span style={{ fontSize: 12, color: T.sub, whiteSpace: "nowrap" }}>
            {searchMatches.length} found</span>}
        </div>
      )}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "14px 2px", display: "flex",
        flexDirection: "column", gap: 10, minHeight: 260 }}>
        {history.length === 0 && (
          <div style={{ textAlign: "center", padding: "16px 8px" }}>
            <Portrait src={char.img} name={char.name} size={140} speaking={false} tint={char.tint} />
            <p style={{ fontSize: 14, color: T.sub, margin: "12px auto", maxWidth: 280 }}>
              Say hi to {char.name}. Nothing here is shared — this is just for you.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
              {starters.map((s) => (
                <button key={s} onClick={() => send(s)} style={{ borderRadius: 999, padding: "8px 13px", fontSize: 13,
                  border: `1px solid ${T.line}`, background: "#fff", cursor: "pointer", color: T.ink, boxShadow: T.soft }}>{s}</button>
              ))}
            </div>
          </div>
        )}
        {hiddenCount > 0 && !showAllHistory && (
          <button onClick={() => setShowAllHistory(true)} style={{ alignSelf: "center", borderRadius: 999,
            padding: "8px 14px", fontSize: 12.5, border: `1px solid ${T.line}`, background: "#fff",
            cursor: "pointer", color: T.sub, boxShadow: T.soft, marginBottom: 4 }}>
            Show {hiddenCount} earlier message{hiddenCount === 1 ? "" : "s"}
          </button>
        )}
        {hiddenCount > 0 && showAllHistory && (
          <button onClick={() => setShowAllHistory(false)} style={{ alignSelf: "center", borderRadius: 999,
            padding: "8px 14px", fontSize: 12.5, border: `1px solid ${T.line}`, background: "#fff",
            cursor: "pointer", color: T.sub, boxShadow: T.soft, marginBottom: 4 }}>
            Tidy up — hide earlier messages
          </button>
        )}
        {visibleHistory.map((m, idx) => {
          const meta = m.role === "assistant" && m.tool ? TOOL_SUGGEST[m.tool] : null;
          return (
            <div key={idx} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
              {m.image && (
                <img src={m.image} alt="" style={{ maxWidth: "60%", borderRadius: 14, marginBottom: 6, boxShadow: T.soft, display: "block" }} />
              )}
              <div
                onPointerDown={m.role === "assistant" ? (e) => { tapRef.current = { x: e.clientX, y: e.clientY, t: Date.now(), moved: false }; } : undefined}
                onPointerMove={m.role === "assistant" ? (e) => { const s = tapRef.current; if (s && Math.abs(e.clientX - s.x) + Math.abs(e.clientY - s.y) > 8) s.moved = true; } : undefined}
                onPointerUp={m.role === "assistant" ? (e) => {
                  // The separate Repeat button is inside this bubble. Letting its pointer-up
                  // reach here previously caused two simultaneous speak() calls on iPhone.
                  if (e.target && e.target.closest && e.target.closest("button")) { tapRef.current = null; return; }
                  const s = tapRef.current; tapRef.current = null; if (!s || s.moved) return;
                  const moved = Math.abs(e.clientX - s.x) + Math.abs(e.clientY - s.y);
                  if (moved < 10 && Date.now() - s.t < 500) { if (!pauseResume()) speak(m.content, char, undefined, true); }
                } : undefined}
                title={m.role === "assistant" ? "Tap to pause / resume" : undefined}
                style={{ maxWidth: "82%", padding: "11px 14px", borderRadius: 18, fontSize: 15, lineHeight: 1.45,
                whiteSpace: "pre-wrap", background: m.role === "user" ? T.green : "#fff",
                color: m.role === "user" ? "#fff" : T.ink, boxShadow: T.soft,
                cursor: m.role === "assistant" ? "pointer" : "default" }}>{m.content}</div>
              {m.role === "assistant" && (
                <button
                  onPointerDown={(e) => { e.stopPropagation(); primeAudio(); }}
                  onPointerUp={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); speak(m.content, char, undefined, true); }}
                  aria-label="Repeat this"
                  style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 5, background: "none",
                    border: "none", color: T.sub, cursor: "pointer", fontSize: 12, padding: "2px 2px" }}>
                  <RotateCcw size={13} /> Repeat
                </button>
              )}
              {meta && (
                <button onClick={() => onOpenTool && onOpenTool(m.tool)} style={{ marginTop: 8, display: "inline-flex",
                  alignItems: "center", gap: 8, background: meta.tint, color: T.ink, border: "none", borderRadius: 999,
                  padding: "9px 14px", cursor: "pointer", fontSize: 13.5, fontWeight: 600, boxShadow: T.soft }}>
                  <meta.Icon size={16} color={meta.ic} /> {meta.label} <ChevronRight size={15} color={T.sub} />
                </button>
              )}
            </div>
          );
        })}
        {busy && <div style={{ fontSize: 13, color: T.sub, paddingLeft: 4 }}>{char.name} is thinking…</div>}
        {err && <div style={{ fontSize: 13, color: "#c0392b", background: "#fdecec", borderRadius: 12, padding: "8px 12px" }}>{err}</div>}
      </div>

      {crisisActive && <CrisisInterception onDismiss={() => setCrisisActive(false)} />}

      {pendingImage && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: T.card, borderRadius: 14,
          padding: 8, boxShadow: T.soft, marginBottom: 8 }}>
          <img src={pendingImage.dataUrl} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover" }} />
          <span style={{ flex: 1, fontSize: 13, color: T.sub }}>Photo ready to send</span>
          <button onClick={() => setPendingImage(null)} aria-label="Remove photo"
            style={{ background: "none", border: "none", color: T.sub, cursor: "pointer", padding: 6 }}>
            <X size={16} />
          </button>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, paddingTop: 6 }}>
        <HoldToTalk onText={(t) => send(t)} onStart={stop} size={48} />
        <button onClick={() => imgFileRef.current && imgFileRef.current.click()} aria-label="Attach a photo" title="Attach a photo"
          style={{ width: 44, height: 44, borderRadius: "50%", border: `1px solid ${T.line}`, background: "#fff",
            display: "grid", placeItems: "center", cursor: "pointer", color: T.ink, flexShrink: 0 }}>
          <Paperclip size={18} />
        </button>
        <input ref={imgFileRef} type="file" accept="image/*" onChange={pickPhoto} style={{ display: "none" }} />
        <textarea ref={composerRef} value={input} onChange={(e) => setInput(e.target.value)} rows={1}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={pendingImage ? "Say something about the photo (optional)…" : `Message ${char.name}…`}
          style={{ flex: 1, resize: "none", borderRadius: 16, border: `1px solid ${T.line}`, padding: "12px 14px",
            fontSize: 15, lineHeight: 1.45, minHeight: 48, maxHeight: 260, overflowY: "auto", background: "#fff", color: T.ink,
            outline: "none", fontFamily: "inherit" }} />
        <button onClick={() => send(undefined, { forceFast: true })} disabled={(!input.trim() && !pendingImage) || busy}
          aria-label="Fast Reply — send this message and get a quick, direct answer" title="Fast Reply — quick, direct answer just for this message"
          style={{ height: 48, borderRadius: "50%", width: 48, border: `1px solid ${T.line}`, background: "#fff", color: T.blueDk,
            display: "grid", placeItems: "center", cursor: (input.trim() || pendingImage) ? "pointer" : "default",
            opacity: (input.trim() || pendingImage) ? 1 : 0.5, boxShadow: T.soft, flexShrink: 0 }}>
          <Zap size={18} />
        </button>
        <button onClick={() => send()} disabled={(!input.trim() && !pendingImage) || busy} aria-label="Send"
          style={{ width: 48, height: 48, borderRadius: "50%", border: "none", background: T.green, color: "#fff",
            display: "grid", placeItems: "center", cursor: (input.trim() || pendingImage) ? "pointer" : "default",
            opacity: (input.trim() || pendingImage) ? 1 : 0.5, boxShadow: T.soft, flexShrink: 0 }}>
          <Send size={18} />
        </button>
      </div>
      {speaking && (
        <button onClick={() => { voiceDebug("Interrupt pressed"); stop(); }} aria-label="Interrupt"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, margin: "10px auto 0",
            background: "#e5484d", color: "#fff", border: "none", borderRadius: 999, padding: "11px 22px",
            fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 6px 16px rgba(229,72,77,0.32)",
            animation: "rh-glow 1.4s ease-in-out infinite" }}>
          <X size={18} /> Interrupt {char.name}
        </button>
      )}
      <div style={{ background: T.card, borderRadius: 16, marginTop: 12, padding: "12px 16px",
        boxShadow: T.soft, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: "4px 10px" }}>
          <span style={{ fontSize: 11, color: T.sub }}>Tap the mic to talk</span>
          {history.length > 0 && (
            <>
              <span style={{ fontSize: 11, color: T.line }}>•</span>
              <button onClick={() => setConfirmClear(true)} style={{ background: "none", border: "none",
                color: T.sub, fontSize: 11, cursor: "pointer", padding: 0 }}>
                Clear this chat
              </button>
            </>
          )}
          {char.slug === "rex" && onReplayIntro && (
            <>
              <span style={{ fontSize: 11, color: T.line }}>•</span>
              <button onClick={onReplayIntro} style={{ background: "none", border: "none",
                color: T.sub, fontSize: 11, cursor: "pointer", padding: 0 }}>
                Watch my intro again
              </button>
            </>
          )}
        </div>
        <div style={{ fontSize: 11, color: T.sub, fontStyle: "italic" }}>You never have to walk it alone.</div>
      </div>
      {confirmClear && (
        <div style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(44,42,51,0.45)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div className="rh-in" style={{ width: "100%", maxWidth: 360, background: T.card, borderRadius: 22,
            boxShadow: T.lift, padding: "22px 20px", textAlign: "center" }}>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>Clear this conversation?</div>
            <p style={{ fontSize: 14, color: T.sub, lineHeight: 1.5, margin: "0 0 18px" }}>
              This clears your conversation with {char.name} on this screen. What the guides remember about you is
              separate — you can manage that under "What the guides remember" in your profile.
            </p>
            <button onClick={() => { stop(); setHistory([]); setConfirmClear(false); }}
              style={{ width: "100%", background: "#e5484d", color: "#fff", border: "none", borderRadius: 14,
                padding: "13px", fontSize: 15, fontWeight: 700, cursor: "pointer", marginBottom: 10 }}>
              Yes, clear it
            </button>
            <button onClick={() => setConfirmClear(false)}
              style={{ width: "100%", background: "#fff", color: T.ink, border: `1px solid ${T.line}`, borderRadius: 14,
                padding: "13px", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const CALENDLY_URL = "https://calendly.com/resiliencehubnsw";

function BookAppointment({ onBack }) {
  useEffect(() => {
    if (document.querySelector('script[src="https://assets.calendly.com/assets/external/widget.js"]')) return;
    const script = document.createElement("script");
    script.src = "https://assets.calendly.com/assets/external/widget.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  return (
    <>
      <Brand right={<BackBtn onBack={onBack} label="Program" />} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, marginBottom: 4 }}>
        <CalendarCheck size={18} color={T.greenDk} />
        <h2 style={{ fontSize: 18, margin: 0 }}>Book Intake Appointment</h2>
      </div>
      <p style={{ fontSize: 13.5, color: T.sub, margin: "0 2px 14px", lineHeight: 1.5 }}>
        Pick a time that works for you — it'll go straight onto Juan's calendar, no back and forth needed.
      </p>
      <div style={{ background: T.card, borderRadius: 20, padding: 8, boxShadow: T.soft, overflow: "hidden" }}>
        <div className="calendly-inline-widget" data-url={CALENDLY_URL} style={{ minWidth: 280, height: 700 }} />
      </div>
      <p style={{ fontSize: 12, color: T.sub, textAlign: "center", marginTop: 12 }}>
        Trouble loading? <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, color: T.greenDk, fontWeight: 700 }}>Open the booking page directly <ExternalLink size={12} /></a>.
      </p>
    </>
  );
}

function BugReport({ session, onBack }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const choosePhoto = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { setErr("Please choose an image file, such as a screenshot or photo."); return; }
    if (file.size > 8 * 1024 * 1024) { setErr("That image is too large. Please choose one smaller than 8 MB."); return; }
    setErr("");
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  };
  const removePhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(null); setPhotoPreview("");
  };
  const submit = async () => {
    const desc = description.trim();
    if (!desc || busy) return;
    if (!supabase) { setErr("Couldn't reach the server just now — try again in a moment."); return; }
    setBusy(true); setErr("");
    try {
      let screenshotPath = null;
      if (photo) {
        const userFolder = session?.user?.id || "anonymous";
        const extension = (photo.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        screenshotPath = `${userFolder}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${extension}`;
        const { error: uploadError } = await supabase.storage.from("bug-screenshots").upload(screenshotPath, photo, {
          contentType: photo.type || "image/jpeg", upsert: false,
        });
        if (uploadError) throw uploadError;
      }
      const { error } = await supabase.from("bug_reports").insert({
        name: name.trim() || null,
        description: desc,
        email: session?.user?.email || null,
        user_id: session?.user?.id || null,
        screenshot_path: screenshotPath,
      });
      if (error) throw error;
      setSent(true);
      fetch("/api/push", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toAdmins: true, title: "New bug report", body: desc.slice(0, 120), target: "adminBugReports", url: "/?open=adminBugReports" }),
      }).catch(() => {});
    } catch (e) { setErr("Couldn't send just now — have you run the bug reports SQL?"); }
    finally { setBusy(false); }
  };

  if (sent) {
    return (
      <>
        <Brand right={<BackBtn onBack={onBack} label="Settings" />} />
        <div style={{ background: T.card, borderRadius: 20, padding: 24, boxShadow: T.soft, marginTop: 20, textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#e9f5ee", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
            <CheckCircle2 size={28} color={T.greenDk} />
          </div>
          <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>Thank you so much!</div>
          <p style={{ fontSize: 14.5, color: T.sub, lineHeight: 1.55 }}>
            Your report's been sent through. We really appreciate you taking the time to help keep the app running
            smoothly and safely for everyone.
          </p>
          <div style={{ marginTop: 20 }}>
            <Btn onClick={onBack}>Back to Settings</Btn>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Brand right={<BackBtn onBack={onBack} label="Settings" />} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, marginBottom: 4 }}>
        <Flame size={18} color="#c94f4f" />
        <h2 style={{ fontSize: 18, margin: 0 }}>Report a bug</h2>
      </div>
      <p style={{ fontSize: 13.5, color: T.sub, margin: "0 2px 16px", lineHeight: 1.5 }}>
        Found something broken, glitchy, or just not working right? Tell us what happened — every report genuinely helps.
      </p>
      <div style={{ background: T.card, borderRadius: 20, padding: 18, boxShadow: T.soft }}>
        <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>Your name (optional)</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sam"
          style={{ ...inputStyle, marginBottom: 16 }} />
        <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>What happened?</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6}
          placeholder="Describe the bug or glitch — what you were doing, what went wrong, and on what screen if you remember."
          style={{ ...inputStyle, resize: "none", minHeight: 130 }} />
        <div style={{ marginTop: 16, padding: 13, borderRadius: 16, background: "#f4faf6", border: `1px solid ${T.line}` }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>Add a screenshot or photo <span style={{ color: T.sub, fontWeight: 600 }}>(optional)</span></div>
          <div style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.45, marginBottom: 10 }}>A picture can help us understand exactly what went wrong. Please avoid including private information if possible.</div>
          {!photo ? (
            <label style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#e4f2e9", color: T.greenDk, borderRadius: 12, padding: "9px 12px", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
              <Paperclip size={16} /> Choose image
              <input type="file" accept="image/*" onChange={choosePhoto} style={{ display: "none" }} />
            </label>
          ) : (
            <div style={{ position: "relative" }}>
              <img src={photoPreview} alt="Selected bug report screenshot preview" style={{ display: "block", width: "100%", maxHeight: 220, objectFit: "contain", borderRadius: 12, background: "#fff", border: `1px solid ${T.line}` }} />
              <button type="button" onClick={removePhoto} aria-label="Remove selected screenshot" style={{ position: "absolute", top: 8, right: 8, width: 30, height: 30, border: "none", borderRadius: "50%", background: "rgba(32, 47, 39, 0.78)", color: "#fff", display: "grid", placeItems: "center", cursor: "pointer" }}><X size={16} /></button>
              <div style={{ fontSize: 12, color: T.sub, marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{photo.name}</div>
            </div>
          )}
        </div>
        {err && <p style={{ fontSize: 12.5, color: "#c94f4f", marginTop: 10 }}>{err}</p>}
        <div style={{ marginTop: 16 }}>
          <Btn onClick={submit} disabled={!description.trim() || busy}>{busy ? "Sending…" : "Submit report"}</Btn>
        </div>
      </div>
    </>
  );
}

function UserFeedback({ session, onBack }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    const sender = name.trim();
    const contactEmail = email.trim();
    const message = feedback.trim();
    if (busy) return;
    if (!sender) { setErr("Please enter your name so we know who the feedback is from."); return; }
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) { setErr("Please enter a valid email address, or leave it blank."); return; }
    if (!message) { setErr("Please add your feedback before sending it."); return; }
    if (!supabase) { setErr("Couldn't reach the server just now — try again in a moment."); return; }
    setBusy(true); setErr("");
    try {
      const { error } = await supabase.from("bug_reports").insert({
        name: sender,
        email: contactEmail || null,
        description: `[User Feedback]\n\n${message}`,
        user_id: session?.user?.id || null,
      });
      if (error) throw error;
      setSent(true);
      fetch("/api/push", {
        method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
        body: JSON.stringify({ toAdmins: true, title: "New user feedback", body: `${sender}: ${message.slice(0, 110)}`, target: "adminBugReports", url: "/?open=adminBugReports" }),
      }).then(async (response) => {
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.sent) console.warn("Feedback notification was not delivered", result || response.status);
      }).catch((error) => console.warn("Feedback notification request failed", error));
    } catch (e) { setErr("Couldn't send your feedback just now — please try again shortly."); }
    finally { setBusy(false); }
  };

  if (sent) {
    return (
      <>
        <Brand right={<BackBtn onBack={onBack} label="Settings" />} />
        <div style={{ background: T.card, borderRadius: 20, padding: 24, boxShadow: T.soft, marginTop: 20, textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#e9f5ee", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
            <CheckCircle2 size={28} color={T.greenDk} />
          </div>
          <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>Thank you for your feedback!</div>
          <p style={{ fontSize: 14.5, color: T.sub, lineHeight: 1.55 }}>
            Your feedback has been sent to the Resilience Hub team. It helps us keep improving the app for everyone.
          </p>
          <div style={{ marginTop: 20 }}>
            <Btn onClick={onBack}>Back to Settings</Btn>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Brand right={<BackBtn onBack={onBack} label="Settings" />} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, marginBottom: 4 }}>
        <MessageCircle size={18} color={T.greenDk} />
        <h2 style={{ fontSize: 18, margin: 0 }}>Share feedback</h2>
      </div>
      <p style={{ fontSize: 13.5, color: T.sub, margin: "0 2px 16px", lineHeight: 1.5 }}>
        Have an idea, suggestion, or something you would like us to improve? We would love to hear it.
      </p>
      <div style={{ background: T.card, borderRadius: 20, padding: 18, boxShadow: T.soft }}>
        <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>Your name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sam" autoComplete="name"
          style={{ ...inputStyle, marginBottom: 16 }} />
        <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>Email address <span style={{ color: T.sub, fontWeight: 500 }}>(optional)</span></label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email"
          style={{ ...inputStyle, marginBottom: 16 }} />
        <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>Your feedback</label>
        <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={6}
          placeholder="Tell us what you think, what is working well, or what would make the app better."
          style={{ ...inputStyle, resize: "vertical", minHeight: 130 }} />
        {err && <p style={{ fontSize: 12.5, color: "#c94f4f", marginTop: 10 }}>{err}</p>}
        <div style={{ marginTop: 16 }}>
          <Btn onClick={submit} disabled={!name.trim() || !feedback.trim() || busy}>{busy ? "Sending…" : "Send feedback"}</Btn>
        </div>
      </div>
    </>
  );
}

/* ---------- journal ---------- */
function programSectionId(title) {
  return `program-${String(title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
}
function ProgramInfoSection({ title, children }) {
  const tones = title.includes("Join") ? ["#f6e8d9", "#bd7540"] : title.includes("touch") ? ["#e2eefb", "#3f6faf"] : title.includes("court") ? ["#eee8f7", "#7055a8"] : ["#e5f3e9", T.greenDk];
  return (
    <section id={programSectionId(title)} style={{ marginTop: 22, scrollMarginTop: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, margin: "0 2px 10px" }}>
        <div style={{ width: 9, height: 26, borderRadius: 999, background: `linear-gradient(180deg, ${tones[1]}, ${tones[0]})`, boxShadow: `0 4px 10px ${tones[1]}33` }} />
        <div style={{ fontWeight: 800, fontSize: 15.5, color: T.ink, letterSpacing: 0.1 }}>{title}</div>
      </div>
      <div style={{ paddingLeft: 0 }}>{children}</div>
    </section>
  );
}

function ProgramInfoCard({ title, children }) {
  return (
    <div style={{ position: "relative", overflow: "hidden", background: "linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(248,252,249,0.94) 70%, rgba(239,247,241,0.9) 100%)", borderRadius: 17, padding: "15px 15px 15px 17px", boxShadow: T.soft, marginBottom: 9, border: "1px solid rgba(77,159,104,0.12)" }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: "linear-gradient(180deg, #4ea067, #a8d49c)" }} />
      {title && <div style={{ fontWeight: 800, fontSize: 14, color: T.ink, marginBottom: 5 }}>{title}</div>}
      <div style={{ fontSize: 13.5, color: T.sub, lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}

const INTAKE_PACK = [
  { title: "Client Intake & Health Assessment", sub: "Your details, medical background & program goals", file: "/forms/rh-form-01-client-intake-health-assessment.pdf" },
  { title: "Informed Consent & Participation Agreement", sub: "How the program works & what's expected", file: "/forms/rh-form-02-informed-consent-participation-agreement.pdf" },
  { title: "Privacy & Confidentiality Notice", sub: "How your information is collected & protected", file: "/forms/rh-form-03-privacy-confidentiality-notice.pdf" },
  { title: "Personal Profile, Skills & Wellbeing Assessment", sub: "About you, your strengths & wellbeing", file: "/forms/rh-form-05-personal-profile-skills-wellbeing-assessment.pdf" },
  { title: "Daily Living, Budget & Independence Assessment", sub: "Everyday routine, money & independence", file: "/forms/rh-form-06-daily-living-budget-independence-assessment.pdf" },
  { title: "Consent to Share Between Medical Professionals", sub: "Sharing info with your GP & care team", file: "/forms/rh-form-10-consent-share-medical-professionals.pdf" },
];

function FounderVideoSection() {
  const videos = [
    { title: "The Story Behind The Resilience Hub", url: "/founder-videos/story-behind-resilience-hub.mp4" },
    { title: "Men’s Mental Health: Breaking the Silence", url: "/founder-videos/mens-mental-health.mp4" },
    { title: "Personalising Support: The Resilience Hub Mission", url: "/founder-videos/personalised-support.mp4" },
    { title: "Building a New Network for Success", url: "/founder-videos/building-new-network.mp4" },
    { title: "Authentic Support Through Shared Experience", url: "/founder-videos/authentic-shared-experience.mp4" },
  ];
  return (
    <div id="program-juans-founder-videos" style={{ background: "linear-gradient(135deg, #e5f5ea 0%, #f7fbf8 48%, #fff1e5 100%)", borderRadius: 22, padding: 16, boxShadow: T.soft, marginTop: 14, border: "1px solid rgba(55,160,101,0.16)", overflow: "hidden", position: "relative" }}>
      <div style={{ position: "absolute", width: 150, height: 150, borderRadius: "50%", right: -72, top: -76, background: "rgba(255,255,255,0.5)" }} />
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#ffffff", display: "grid", placeItems: "center", flexShrink: 0, overflow: "hidden", boxShadow: "0 5px 12px rgba(43,111,76,0.14)" }}>
            <img src="/guides/juan.png" alt="Juan Carroso" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 24%" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: T.greenDk }}>Juan Carroso</div>
            <div style={{ fontSize: 12.5, color: T.sub }}>The Resilience Hub Founder</div>
          </div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 800, color: T.greenDk, marginBottom: 5 }}>Where it all began — and how we built this for you.</div>
        <div style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.55, margin: "0 0 13px" }}>
          <p style={{ margin: "0 0 10px" }}>Welcome to The Resilience &amp; Recovery Program Introduction. We are proud of you for taking this first step, and we are here to support you, at your pace.</p>
          <p style={{ margin: "0 0 10px" }}>Here's the honest story: How The Resilience Hub came to be, what our program actually does, and exactly how it works for you. Real answers, real heart, straight from someone who built it all from the ground up.</p>
          <p style={{ margin: 0, fontWeight: 700, color: T.greenDk }}>You never have to walk it alone.</p>
        </div>
        <div style={{ fontSize: 11.5, color: T.sub, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase", marginBottom: 8 }}>Studio Venture interview series</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {videos.map((video, index) => (
            <a key={video.url} href={video.url} target="_blank" rel="noopener noreferrer" aria-label={`Watch ${video.title}`}
              style={{ display: "flex", alignItems: "center", gap: 11, background: index % 2 === 0 ? "linear-gradient(110deg, rgba(255,255,255,0.9), rgba(238,249,241,0.94))" : "linear-gradient(110deg, rgba(255,255,255,0.86), rgba(255,245,235,0.94))", borderRadius: 15, padding: 11, border: "1px solid rgba(55,128,82,0.14)", textDecoration: "none", color: T.ink, boxShadow: "0 4px 12px rgba(47,97,72,0.05)" }}>
              <div style={{ width: 37, height: 37, borderRadius: 11, background: index % 2 === 0 ? "linear-gradient(145deg, #3f9d68, #8acb8c)" : "linear-gradient(145deg, #c48755, #e5b17d)", display: "grid", placeItems: "center", flexShrink: 0, position: "relative" }}>
                <Play size={15} color="#fff" fill="#fff" />
                <span style={{ position: "absolute", right: -5, top: -6, minWidth: 17, height: 17, borderRadius: 9, background: T.card, color: index % 2 === 0 ? T.greenDk : "#bd7540", fontSize: 10, fontWeight: 800, display: "grid", placeItems: "center", boxShadow: "0 2px 5px rgba(40,38,47,0.14)" }}>{index + 1}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: T.ink, lineHeight: 1.3 }}>{video.title}</div>
                <div style={{ fontSize: 11, color: T.sub, marginTop: 3 }}>Juan Carroso • Studio Venture • Watch video</div>
              </div>
              <ExternalLink size={16} color={index % 2 === 0 ? T.greenDk : "#bd7540"} />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProgramInfo({ voiceOn, onBack, onMessageJuan, onBookAppointment }) {
  const juanProgramIntro = "Hi, I'm Juan, the founder of The Resilience Hub. This program is free and built around you: we listen to where you're at, shape practical support at your pace, and help connect you with the right people. If you need help at any point, use Message Juan to reach the real me, talk with one of the AI guides, or use Help Now for urgent human support.";
  const { speak: speakJuanProgramIntro, stop: stopJuanProgramIntro, prefetch: prefetchJuanProgramIntro } = useVoice(voiceOn);
  useEffect(() => {
    if (!voiceOn || !__autoVoiceOn) return undefined;
    prefetchJuanProgramIntro(juanProgramIntro, CHARS.juan);
    const timer = setTimeout(() => speakJuanProgramIntro(juanProgramIntro, CHARS.juan), 70);
    return () => { clearTimeout(timer); stopJuanProgramIntro(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceOn]);
  return (
    <>
      <Brand right={<BackBtn onBack={onBack} label="Home" />} />

      <div style={{ background: "linear-gradient(135deg, #e2f3e8 0%, #f7fcf8 47%, #fff0e3 100%)", borderRadius: 24, padding: "22px 18px 20px", boxShadow: T.soft, marginTop: 8, textAlign: "center", border: "1px solid rgba(77,159,104,0.16)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", width: 150, height: 150, borderRadius: "50%", right: -70, top: -78, background: "rgba(255,255,255,0.5)" }} />
        <div style={{ position: "relative" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,0.76)", borderRadius: 999, padding: "5px 10px", marginBottom: 13, color: T.greenDk, fontSize: 10.5, fontWeight: 800, letterSpacing: 0.45, textTransform: "uppercase" }}>
            <Heart size={13} fill={T.greenDk} /> A program built around you
          </div>
          <div style={{ width: 86, height: 64, borderRadius: 16, background: "rgba(255,255,255,0.9)", display: "grid", placeItems: "center", boxShadow: T.soft, margin: "0 auto 12px", overflow: "hidden" }}>
            <img src="/resilience-hub-logo.png" alt="Resilience Hub" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: T.greenDk, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>The Resilience Hub</div>
          <div style={{ fontWeight: 800, fontSize: 22, lineHeight: 1.25, marginBottom: 9 }}>The Resilience &amp; Recovery Program</div>
          <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 7, marginBottom: 12 }}>
            {["Free support", "Individualised", "Your pace"].map((label) => <span key={label} style={{ background: "rgba(255,255,255,0.72)", color: T.sub, borderRadius: 999, padding: "5px 9px", fontSize: 10.5, fontWeight: 700 }}>{label}</span>)}
          </div>
          <div style={{ fontSize: 13.5, color: T.sub, fontStyle: "italic" }}>&quot;You never have to walk this journey alone.&quot;</div>
        </div>
      </div>

      <FounderVideoSection />

      <ProgramInfoSection title="Welcome">
        <ProgramInfoCard title="A welcome from Juan">
          <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}><div style={{ width: 48, height: 48, borderRadius: 15, overflow: "hidden", background: "#e5f3e9", flexShrink: 0 }}><img src={CHARS.juan.img} alt="Juan Carroso" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div><div>{juanProgramIntro}</div></div>
        </ProgramInfoCard>
        <ProgramInfoCard>
          <div style={{ fontSize: 14, color: T.ink, lineHeight: 1.55, marginBottom: 14 }}>A completely free, individually tailored recovery &amp; resilience program — built around <b>you</b>, not a generic checklist.</div>
          <div style={{ background: "linear-gradient(135deg, #f5fbf6 0%, #fffaf4 100%)", borderRadius: 15, padding: 13, border: "1px solid rgba(77,159,104,0.14)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: T.greenDk, fontSize: 13.5, fontWeight: 800, marginBottom: 8 }}><BookOpen size={16} /> Inside this program</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {[
                ["Juan’s founder videos", "program-juans-founder-videos"],
                ["How it works", "program-how-it-works"],
                ["Your support team", "program-your-support-team"],
                ["For court, bail & second chances", "program-for-court-bail-second-chances"],
                ["Additional support we connect you to", "program-additional-support-we-connect-you-to"],
                ["What makes us different", "program-what-makes-us-different"],
                ["Join The Program", "program-join-the-program"],
                ["Get in touch", "program-get-in-touch"],
              ].map(([label, target], index) => (
                <a key={target} href={`#${target}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 5px", color: T.ink, textDecoration: "none", fontSize: 12.8, fontWeight: 700, borderRadius: 9 }}>
                  <span style={{ width: 22, height: 22, borderRadius: 8, display: "grid", placeItems: "center", background: index % 2 === 0 ? "#e2f2e7" : "#fff0e3", color: index % 2 === 0 ? T.greenDk : "#bd7540", fontSize: 10.5, fontWeight: 900, flexShrink: 0 }}>{index + 1}</span>
                  <span style={{ flex: 1 }}>{label}</span><ChevronRight size={15} color={T.sub} />
                </a>
              ))}
            </div>
          </div>
        </ProgramInfoCard>
      </ProgramInfoSection>

      <ProgramInfoSection title="How it works">
        <ProgramInfoCard title="Duration">8 weeks - However your individual program may be shorter or longer, depending on your needs</ProgramInfoCard>
        <ProgramInfoCard title="Cost">100% free — no fees, no fine print</ProgramInfoCard>
        <ProgramInfoCard title="Our approach">No one-size-fits-all system. Juan sits down with you, listens to your story, understands your needs, and builds the program around your goals, your pace, your life.</ProgramInfoCard>
        <ProgramInfoCard title="Support">24 hours a day, 7 days a week — you can reach Juan any time. Day or night, rain or shine. You are never alone.</ProgramInfoCard>
      </ProgramInfoSection>

      <ProgramInfoSection title="Your support team">
        <ProgramInfoCard title="Carlos Camacho — Registered Psychologist">International Golden Key Award recipient — one of Western Sydney's most respected practitioners. Provides professional assessment, guidance, and progress reports.</ProgramInfoCard>
        <ProgramInfoCard title="Dr. Carlos Robalino — General Practitioner">Fairfield Medical Centre. Holistic health care to support your physical and mental wellbeing.</ProgramInfoCard>
        <ProgramInfoCard title="Wise Employment — Employment & study support">Ready to help you find work, explore new careers, or further your studies — whatever path you choose.</ProgramInfoCard>
        <ProgramInfoCard title="Juan — Peer support & 24/7 availability">Juan walks this journey beside you. He understands because he's lived it. Available any time.</ProgramInfoCard>
      </ProgramInfoSection>

      <ProgramInfoSection title="For court, bail & second chances">
        <ProgramInfoCard title="Court reports">If you complete the program, Carlos Camacho prepares a professional, detailed progress report that carries significant weight in court. It shows you are serious about change.</ProgramInfoCard>
        <ProgramInfoCard title="Bail to us">We are working to become an approved bail destination — meaning you can be bailed directly into our program instead of custody.</ProgramInfoCard>
        <ProgramInfoCard title="Fine payment scheme">In partnership with Work and Development Orders (WDOs), we are working toward allowing program participation to count toward paying off fines — turning your progress into a fresh start.</ProgramInfoCard>
        <ProgramInfoCard title="Recovery & reentry">If you are leaving jail or trying to avoid returning — this program gives you a genuine alternative, a solid plan, and people who stand by you.</ProgramInfoCard>
      </ProgramInfoSection>

      <ProgramInfoSection title="Additional support we connect you to">
        <ProgramInfoCard title="Detox services">Juan connects you directly to the right support.</ProgramInfoCard>
        <ProgramInfoCard title="Corella Lodge">Residential recovery. Juan knows Karina who runs it, and visits fortnightly to support clients. He can help you get accepted.</ProgramInfoCard>
      </ProgramInfoSection>

      <ProgramInfoSection title="What makes us different">
        <ProgramInfoCard>
          No judgment. No conditions. No shame.<br /><br />
          We don't care why you're here — we care where you're going.<br /><br />
          For anyone struggling with mental health, substance use, or life getting too heavy.<br /><br />
          If the court sent you? That's OK. We're still here to help you succeed.<br /><br />
          You do not have to get it right the first time — we help you keep trying.
        </ProgramInfoCard>
      </ProgramInfoSection>

      <ProgramInfoSection title="Join The Program">
        <p style={{ fontSize: 13, color: T.sub, margin: "0 0 14px", lineHeight: 1.5 }}>
          Everything you need to get started: download and fill out your intake forms ahead of time, then request a
          time for your first appointment — Juan will call or text to lock it in.
        </p>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.greenDk, textTransform: "uppercase", letterSpacing: 0.4, margin: "0 0 8px" }}>
          Intake forms
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {INTAKE_PACK.map((f) => (
            <button key={f.file} onClick={() => openOrShareFile(f.file, f.title + ".pdf")}
              style={{ display: "flex", alignItems: "center", gap: 12, background: T.card, borderRadius: 14, padding: 12,
                border: "none", cursor: "pointer", textAlign: "left", width: "100%", color: T.ink, boxShadow: T.soft }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: "#e9f5ee", display: "grid",
                placeItems: "center", flexShrink: 0 }}>
                <FileText size={17} color={T.greenDk} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{f.title}</div>
                <div style={{ fontSize: 12, color: T.sub }}>{f.sub}</div>
              </div>
              <Download size={17} color={T.sub} style={{ flexShrink: 0 }} />
            </button>
          ))}
        </div>
        <div style={{ marginTop: 16 }}>
          <Btn onClick={onBookAppointment}>Book Intake Appointment</Btn>
        </div>
      </ProgramInfoSection>

      <ProgramInfoSection title="Get in touch">
        <div style={{ background: "#eaf6ef", borderRadius: 16, padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 13.5, lineHeight: 1.8 }}>
            <div>📍 42 Court Road, Fairfield 2165</div>
            <div>📞 0489 059 833 — call or text any time, 24/7</div>
          </div>
        </div>
        <p style={{ fontSize: 13, color: T.sub, margin: "0 0 14px", lineHeight: 1.5 }}>
          Want more detail, or ready to join? Reach out to Juan directly — he'll talk you through it and build the
          plan together with you. You're also welcome to call or text him directly to discuss a time for your intake
          appointment.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn onClick={onMessageJuan} style={{ flex: 1 }}>Message Juan</Btn>
          <a href="tel:0489059833" style={{ flex: 1, textDecoration: "none" }}>
            <Btn kind="outline" style={{ width: "100%" }}>Call Juan</Btn>
          </a>
        </div>
        <div style={{ textAlign: "center", fontSize: 13, color: T.greenDk, fontStyle: "italic", marginTop: 20 }}>
          You never have to walk it alone.
        </div>
      </ProgramInfoSection>
    </>
  );
}

function CarlosLibraryPage({ onBack }) {
  const english = CARLOS_BOOKS.filter((book) => book.lang === "English");
  const spanish = CARLOS_BOOKS.filter((book) => book.lang === "Spanish");
  const bookGrid = (books) => <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>{books.map((book) => <a key={book.asin} href={book.href} target="_blank" rel="noopener noreferrer" style={{ display: "block", background: T.card, borderRadius: 17, padding: 9, boxShadow: T.soft, border: `1px solid ${T.line}`, textDecoration: "none", color: T.ink }}><div style={{ aspectRatio: "0.72", borderRadius: 12, overflow: "hidden", background: "#f2f2f0", marginBottom: 9 }}><img src={`/carlos-books/${book.asin}.jpg`} alt={`${book.title} book cover`} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /></div><div style={{ fontWeight: 800, fontSize: 12.5, lineHeight: 1.28 }}>{book.title}</div><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginTop: 8, color: T.blueDk, fontSize: 11, fontWeight: 800 }}><span>View on Amazon</span><ExternalLink size={14} /></div></a>)}</div>;
  return <>
    <Brand right={<BackBtn onBack={onBack} />} />
    <div style={{ background: "linear-gradient(135deg, #e8f0fb 0%, #ffffff 58%, #f1eafa 100%)", border: `1px solid ${T.line}`, borderRadius: 24, padding: "21px 18px 19px", marginTop: 7, boxShadow: T.soft, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", right: -50, top: -65, width: 170, height: 170, borderRadius: "50%", background: "rgba(255,255,255,0.55)" }} />
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 11 }}><div style={{ width: 58, height: 58, borderRadius: 18, overflow: "hidden", background: "#dfeafa", flexShrink: 0, border: "1px solid rgba(63,111,175,0.14)" }}><img src={CHARS.carlos.img} alt="Carlos Camacho" style={{ width: "100%", height: "100%", objectFit: "contain" }} /></div><div><div style={{ color: T.blueDk, fontSize: 10, fontWeight: 900, letterSpacing: 1 }}>CARLOS CAMACHO</div><h1 style={{ margin: "4px 0 0", fontSize: 24, lineHeight: 1.1, color: T.ink }}>Further your wisdom</h1></div></div>
      <div style={{ position: "relative", marginTop: 15, background: "rgba(255,255,255,0.78)", borderRadius: 17, padding: 14 }}><div style={{ fontWeight: 900, fontSize: 15, color: T.blueDk, marginBottom: 8 }}>FURTHER YOUR WISDOM — Books by Carlos Camacho</div><p style={{ margin: 0, color: T.sub, fontSize: 13.5, lineHeight: 1.55 }}>Carlos is our lead psychologist and philosopher. He holds a Masters degree in psychology and Honours in philosophy, and has published 18 titles across practical philosophy, happiness, fiction, and children&apos;s works — in both English and Spanish. Wisdom you can read, right now.</p></div>
    </div>
    <p style={{ margin: "13px 3px 16px", color: T.sub, fontSize: 12.5, lineHeight: 1.45 }}>Tap any book to view its Amazon listing. Availability, formats, prices, and delivery options are controlled by Amazon and may change.</p>
    <SectionTitle>English</SectionTitle>
    {bookGrid(english)}
    <SectionTitle>Español</SectionTitle>
    {bookGrid(spanish)}
    <div style={{ margin: "18px 2px 28px", padding: 13, background: "#f6f4fa", border: `1px solid ${T.line}`, borderRadius: 16, color: T.sub, fontSize: 11.5, lineHeight: 1.5 }}>Book titles and cover images are shown from the supplied Amazon listings. Product details and availability may change on Amazon.</div>
  </>;
}

function ResourcesPage({ onOpenSafety, onOpenMensShed, onBack }) {
  useEffect(() => {
    // Each visit should begin at the Resources hero and table of contents,
    // rather than inheriting the scroll position from the previous screen.
    window.scrollTo({ top: 0, behavior: "auto" });
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
  }, []);
  const jump = (id) => document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  const sectionLabel = (id, Icon, title, sub, color) => <div id={id} style={{ scrollMarginTop: 18, margin: "24px 2px 9px" }}><div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15.5, fontWeight: 800 }}><span style={{ width: 30, height: 30, borderRadius: 10, background: `${color}18`, display: "grid", placeItems: "center" }}><Icon size={16} color={color} /></span>{title}</div><div style={{ fontSize: 12.5, color: T.sub, margin: "5px 0 0 38px", lineHeight: 1.4 }}>{sub}</div></div>;
  const resourceCard = ({ Icon, tint, color, eyebrow, title, children, href, phone, email, onClick, actionLabel }) => {
    const opensExternal = /^https?:\/\//i.test(href || "");
    const body = <><div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}><div style={{ width: 44, height: 44, borderRadius: 14, background: tint, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon size={22} color={color} /></div><div style={{ flex: 1, minWidth: 0 }}><div style={{ color, fontSize: 10, fontWeight: 900, letterSpacing: 0.9, textTransform: "uppercase", marginBottom: 3 }}>{eyebrow}</div><div style={{ fontWeight: 800, fontSize: 16, color: T.ink }}>{title}</div><div style={{ fontSize: 13, color: T.sub, lineHeight: 1.48, marginTop: 5 }}>{children}</div></div>{(href || onClick) && (opensExternal ? <ExternalLink size={18} color={color} style={{ flexShrink: 0, marginTop: 12 }} /> : <ChevronRight size={19} color={T.sub} style={{ flexShrink: 0, marginTop: 12 }} />)}</div>{(phone || email || actionLabel) && <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 11 }}><span style={{ padding: "7px 10px", borderRadius: 999, background: "rgba(255,255,255,0.78)", color: T.ink, fontWeight: 750, fontSize: 11.5 }}>{phone ? `Phone: ${phone}` : email ? `Email: ${email}` : actionLabel}</span></div>}</>;
    const style = { display: "block", width: "100%", textAlign: "left", background: `linear-gradient(135deg, ${tint} 0%, #fff 74%)`, border: `1px solid ${T.line}`, borderRadius: 19, padding: 14, boxShadow: T.soft, textDecoration: "none", color: T.ink, cursor: "pointer" };
    if (href) { return <a href={href} target={opensExternal ? "_blank" : undefined} rel={opensExternal ? "noopener noreferrer" : undefined} style={style}>{body}</a>; }
    return <button type="button" onClick={onClick} style={style}>{body}</button>;
  };
  const toc = [
    ["resources-immediate", "Immediate support"], ["resources-food", "Food and meals"], ["resources-housing", "Housing and essentials"], ["resources-money", "Legal, money and bills"], ["resources-recovery", "Addiction recovery"], ["resources-family", "Family, children and youth"], ["resources-health", "Health and wellbeing"], ["resources-safety", "Stay safe"],
  ];
  return (
    <>
      <Brand right={<BackBtn onBack={onBack} />} />
      <div style={{ background: "linear-gradient(135deg, #e5f5ea 0%, #f8fcf9 54%, #fff0e4 100%)", borderRadius: 24, padding: "22px 19px 20px", marginTop: 7, boxShadow: T.soft, border: `1px solid ${T.line}`, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", width: 170, height: 170, borderRadius: "50%", background: "rgba(255,255,255,0.45)", top: -95, right: -55 }} />
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 8, color: T.greenDk, fontSize: 11, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase" }}><BookOpen size={15} /> Practical support, close to home</div>
        <h1 style={{ position: "relative", fontSize: 26, lineHeight: 1.12, margin: "9px 0 7px", color: T.greenDk }}>Resources</h1>
        <div style={{ position: "relative", display: "flex", alignItems: "flex-start", gap: 7, padding: "9px 10px", margin: "0 0 10px", borderRadius: 12, background: "rgba(255,255,255,0.64)", border: "1px solid rgba(77,159,104,0.14)", color: T.sub, fontSize: 11.5, lineHeight: 1.42 }}><Shield size={15} color={T.greenDk} style={{ flexShrink: 0, marginTop: 1 }} /><span>All listed services are recommendations only. We do not run or manage them. Always check directly with each provider for current details.</span></div>
        <p style={{ position: "relative", fontSize: 13.5, color: T.sub, lineHeight: 1.55, margin: 0 }}>A clear starting place for food, housing, recovery, safety, legal help, and everyday support. Information and availability can change, so check before travelling.</p>
        <div id="resources-toc" style={{ position: "relative", scrollMarginTop: 18, marginTop: 16, padding: 13, borderRadius: 17, background: "rgba(255,255,255,0.68)", border: "1px solid rgba(77,159,104,0.14)" }}>
          <div style={{ fontWeight: 800, color: T.greenDk, fontSize: 13.5, marginBottom: 8 }}>On this page</div>
          <div style={{ display: "grid", gap: 5 }}>{toc.map(([id, label]) => <button key={id} onClick={() => jump(id)} style={{ border: "none", background: "none", padding: "4px 0", textAlign: "left", color: T.ink, fontSize: 12.5, cursor: "pointer", display: "flex", alignItems: "center", gap: 7 }}><ChevronRight size={14} color={T.green} />{label}</button>)}</div>
        </div>
      </div>

      {sectionLabel("resources-immediate", LifeBuoy, "Immediate support", "If things feel urgent or unsafe, these are the first places to reach out.", "#c94f4f")}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {resourceCard({ Icon: Phone, tint: "#fff0f0", color: "#c94f4f", eyebrow: "24/7 crisis support", title: "Lifeline", href: "tel:131114", phone: "13 11 14", children: "Crisis support and suicide prevention counselling, available 24 hours a day." })}
        {resourceCard({ Icon: Phone, tint: "#e7eefb", color: T.blueDk, eyebrow: "Emergency", title: "Police, ambulance or fire", href: "tel:000", phone: "000", children: "Call 000 if someone is in immediate danger or needs urgent medical help." })}
        {resourceCard({ Icon: Heart, tint: "#f4e3d9", color: "#b56739", eyebrow: "Mental health support", title: "Beyond Blue and MensLine Australia", href: "https://www.beyondblue.org.au/get-support", children: "Beyond Blue: 1300 22 4636. MensLine Australia: 1300 78 99 78 for men needing phone or online support." })}
      </div>

      {sectionLabel("resources-food", ShoppingBag, "Food and meals", "Food banks, community meals, food parcels, and help with groceries.", T.greenDk)}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {resourceCard({ Icon: Search, tint: "#e9f5ee", color: T.greenDk, eyebrow: "Search local services", title: "Food support near postcode 2165", href: "https://askizzy.org.au/food/2165-NSW", children: "Ask Izzy’s current local directory can help you find food banks, pantries, community meals, vouchers, and food parcels near Fairfield, Liverpool, Cabramatta, and surrounding areas." })}
        {resourceCard({ Icon: ShoppingBag, tint: "#fff4db", color: "#9a7419", eyebrow: "Miller outreach · no questions asked", title: "Community Cafe food and essentials", href: "https://www.communitycafe.org.au/our-programs/", phone: "0493 048 650", children: "Free food, clothing, household items, and essentials through the Miller Senior Citizens Centre, 29 Shropshire Street, Miller. The service is confidential and no questions are asked. Current listed hours are Monday, Wednesday, and Friday, 1:00pm–5:00pm." })}
        {resourceCard({ Icon: ExternalLink, tint: "#e8f0fb", color: T.blueDk, eyebrow: "More food-relief options", title: "Foodbank Australia — find food", href: "https://www.foodbank.org.au/find-food/", children: "Use Foodbank’s official locator when you need to look beyond the closest local listings." })}
      </div>

      {sectionLabel("resources-housing", MapPin, "Housing and essentials", "Emergency accommodation, clothing, bedding, toiletries, and practical support.", "#4e7c9e")}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {resourceCard({ Icon: MapPin, tint: "#e7eefb", color: "#4e7c9e", eyebrow: "24/7 housing advice", title: "Link2home", phone: "1800 152 152", href: "https://www.nsw.gov.au/housing-and-construction/housing-support/homelessness", children: "NSW’s statewide homelessness information and referral line for people needing emergency accommodation or housing support." })}
        {resourceCard({ Icon: MapPin, tint: "#f4e3d9", color: "#b56739", eyebrow: "Practical assistance", title: "The Salvation Army", href: "https://www.salvationarmy.org.au/need-help/", children: "Support may include emergency relief, food, clothing, material aid, and referrals. Contact the service first to check what is available locally." })}
        {resourceCard({ Icon: ShoppingBag, tint: "#f3ecd6", color: "#a47c1f", eyebrow: "Everyday essentials", title: "Ask Izzy — essentials search", href: "https://askizzy.org.au/", children: "Search for nearby services offering clothing, bedding, toiletries, showers, and other essentials." })}
      </div>

      {sectionLabel("resources-money", FileText, "Legal, money and bills", "Free legal information, income support, concessions, and help with household costs.", "#6d55b0")}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {resourceCard({ Icon: FileText, tint: "#efeaf5", color: "#6d55b0", eyebrow: "Free legal help", title: "LawAccess NSW", href: "https://www.lawaccess.nsw.gov.au/", phone: "1300 888 529", children: "Free legal information, referrals, and assistance for people in New South Wales." })}
        {resourceCard({ Icon: DollarSign, tint: "#e9f5ee", color: T.greenDk, eyebrow: "Income and concessions", title: "Services Australia", href: "https://www.servicesaustralia.gov.au/phone-us?context=64107", phone: "131 202", children: "Centrelink’s multilingual phone service can help people access information in languages other than English." })}
        {resourceCard({ Icon: DollarSign, tint: "#fff4db", color: "#9a7419", eyebrow: "Bills and household costs", title: "Good Shepherd NILS and NSW energy help", href: "https://goodshep.org.au/services/nils/", children: "Good Shepherd NILS offers no-interest loans for eligible essential needs. For energy-bill support and payment difficulties, contact your retailer or the Energy and Water Ombudsman NSW." })}
      </div>

      {sectionLabel("resources-recovery", Shield, "Addiction recovery", "Detox, treatment, counselling, aftercare, and the next step after rehab or custody.", T.blueDk)}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {resourceCard({ Icon: Shield, tint: "#e7eefb", color: T.blueDk, eyebrow: "Western Sydney public services", title: "Drug and Alcohol Health Services", href: "https://www.nsw.gov.au/departments-and-agencies/wslhd/services/drug-alcohol", phone: "02 8860 2565", children: "Western Sydney services include detoxification treatment, opioid treatment, counselling, outpatient and inpatient pathways, and specialist support. Self-referral is accepted and interpreter support is available." })}
        {resourceCard({ Icon: Heart, tint: "#f4e3d9", color: "#b56739", eyebrow: "Recovery support", title: "Odyssey House NSW", href: "https://odysseyhouse.com.au/", phone: "1800 397 739", children: "Alcohol and other drug support, including referral guidance for people looking for a recovery pathway." })}
      </div>

      {sectionLabel("resources-family", Users, "Family, children and youth", "Support for family safety, young people, carers, and children.", "#b56739")}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {resourceCard({ Icon: Shield, tint: "#f4e3d9", color: "#b56739", eyebrow: "Family and domestic violence", title: "1800RESPECT", href: "https://www.1800respect.org.au/", phone: "1800 737 732", children: "National counselling, information, and support for people affected by domestic, family, or sexual violence." })}
        {resourceCard({ Icon: Users, tint: "#e8f0fb", color: T.blueDk, eyebrow: "For young people", title: "Kids Helpline", href: "https://kidshelpline.com.au/", phone: "1800 55 1800", children: "Free, private counselling and support for children and young people up to age 25." })}
      </div>

      {sectionLabel("resources-health", Heart, "Health and wellbeing", "Low-cost health pathways, mental wellbeing support, and help finding the right service.", "#c56e68")}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {resourceCard({ Icon: Heart, tint: "#fbe1e1", color: "#c56e68", eyebrow: "Mental wellbeing", title: "Beyond Blue", href: "https://www.beyondblue.org.au/get-support", phone: "1300 22 4636", children: "Information, counselling, and support for anxiety, depression, and suicide prevention." })}
        {resourceCard({ Icon: Search, tint: "#e9f5ee", color: T.greenDk, eyebrow: "Find local help", title: "Ask Izzy — health and support search", href: "https://askizzy.org.au/", children: "Search for health, counselling, medical, and community services near your location." })}
      </div>

      {sectionLabel("resources-safety", LifeBuoy, "Stay safe", "Practical safety information and in-app support when you need it.", "#a47c1f")}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {resourceCard({ Icon: LifeBuoy, tint: "#f3ecd6", color: "#a47c1f", eyebrow: "The Resilience Hub", title: "Stay Safe", onClick: onOpenSafety, children: "Substance safety, overdose information, and support lines. Open the in-app safety guide whenever you need it.", actionLabel: "Open in-app safety guide" })}
      </div>
      <div style={{ margin: "18px 2px 0", fontSize: 11.5, color: T.sub, lineHeight: 1.5 }}>Please check each organisation’s current hours, eligibility, fees, and availability before travelling. If there is immediate danger, call <a href="tel:000" style={{ color: T.greenDk, fontWeight: 800 }}>000</a>.</div>
      <Disclaimer />
    </>
  );
}

function MensShedPage({ onBack }) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const signPhoto = "/mens-shed/south-west-sydney-mens-shed-sign.png";
  return (
    <>
      <Brand right={<BackBtn onBack={onBack} />} />
      <div style={{ background: "linear-gradient(145deg, #e7f5eb 0%, #fbfcf8 48%, #fff0d7 100%)", borderRadius: 24, overflow: "hidden", boxShadow: T.soft, marginTop: 8, border: "1px solid rgba(44,125,80,0.14)" }}>
        <div style={{ padding: "22px 18px 18px", position: "relative" }}>
          <div style={{ position: "absolute", right: -38, top: -44, width: 150, height: 150, borderRadius: "50%", background: "rgba(255,255,255,0.52)" }} />
          <div style={{ position: "relative" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, color: T.greenDk, fontSize: 11, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}><Users size={15} /> Community connection</div>
            <h1 style={{ margin: 0, fontSize: 25, lineHeight: 1.12, color: T.ink }}>South West Sydney<br />Men’s Shed</h1>
            <p style={{ margin: "10px 0 0", color: T.sub, fontSize: 14, lineHeight: 1.5 }}>A friendly place to meet, learn new skills and establish new friendships in Bonnyrigg.</p>
          </div>
        </div>
        <div style={{ padding: "0 14px 14px" }}>
          <button onClick={() => setGalleryOpen(true)} aria-label="Enlarge South West Sydney Men’s Shed photo" style={{ width: "100%", padding: 0, border: "none", borderRadius: 18, overflow: "hidden", cursor: "zoom-in", background: "#174f36", display: "block" }}>
            <img src={signPhoto} alt="South West Sydney Men’s Shed sign" style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", display: "block" }} />
          </button>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 8, padding: "0 2px" }}>
            <span style={{ fontSize: 11.5, color: T.sub }}>Tap the photo to enlarge</span>
            <span style={{ fontSize: 11.5, color: T.greenDk, fontWeight: 800 }}>South West Sydney Men’s Shed Inc.</span>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
        <a href="tel:0287860040" style={{ textDecoration: "none", color: T.ink, background: "#fff", borderRadius: 17, padding: 13, boxShadow: T.soft, display: "flex", flexDirection: "column", gap: 7 }}><Phone size={19} color={T.greenDk} /><span style={{ fontWeight: 800, fontSize: 13.5 }}>Call the shed</span><span style={{ color: T.sub, fontSize: 12 }}>02 8786 0040</span></a>
        <a href="https://maps.google.com/?daddr=-33.8925139,150.8891497" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", color: T.ink, background: "#fff", borderRadius: 17, padding: 13, boxShadow: T.soft, display: "flex", flexDirection: "column", gap: 7 }}><MapPin size={19} color="#c48755" /><span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontWeight: 800, fontSize: 13.5 }}>Get directions <ExternalLink size={14} /></span><span style={{ color: T.sub, fontSize: 12 }}>Open in Maps</span></a>
      </div>

      <div style={{ background: T.card, borderRadius: 20, padding: 17, boxShadow: T.soft, marginTop: 12 }}>
        <SectionTitle>About the shed</SectionTitle>
        <p style={{ margin: "0 0 12px", fontSize: 14, lineHeight: 1.58, color: T.ink }}>South West Sydney Men’s Shed is a non-profit community space built around mateship, practical skills and support. Come along to connect with other men, learn something new, or simply spend time in a welcoming environment.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>{["Woodwork", "Metal work", "Electrical work", "Computing", "Community barbecues"].map((x) => <span key={x} style={{ background: "#edf7ef", color: T.greenDk, borderRadius: 999, padding: "7px 10px", fontSize: 11.5, fontWeight: 700 }}>{x}</span>)}</div>
      </div>

      <div style={{ background: "linear-gradient(135deg, #fffaf0, #fff 68%)", border: "1px solid #f0dfb1", borderRadius: 20, padding: 17, boxShadow: T.soft, marginTop: 12 }}>
        <SectionTitle>Plan your visit</SectionTitle>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 11 }}><Clock size={19} color="#b17a2e" style={{ flexShrink: 0, marginTop: 2 }} /><div><div style={{ fontWeight: 800, fontSize: 14 }}>Opening hours</div><div style={{ color: T.sub, fontSize: 13.5, lineHeight: 1.5 }}>Monday, Tuesday and Wednesday<br />8:30am – 12:00pm</div></div></div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 11 }}><MapPin size={19} color="#b17a2e" style={{ flexShrink: 0, marginTop: 2 }} /><div><div style={{ fontWeight: 800, fontSize: 14 }}>Location</div><div style={{ color: T.sub, fontSize: 13.5, lineHeight: 1.5 }}>22 Hebblewhite Place<br />Bonnyrigg NSW 2177</div></div></div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}><DollarSign size={19} color="#b17a2e" style={{ flexShrink: 0, marginTop: 2 }} /><div><div style={{ fontWeight: 800, fontSize: 14 }}>Membership fees</div><div style={{ color: T.sub, fontSize: 13.5, lineHeight: 1.5 }}>Fees are not listed on the current directory page. Please contact Robert or the shed directly for current fees and joining details.</div></div></div>
      </div>

      <div style={{ background: T.card, borderRadius: 20, padding: 17, boxShadow: T.soft, marginTop: 12 }}>
        <SectionTitle>Connect with the shed</SectionTitle>
        <p style={{ margin: "0 0 12px", color: T.sub, fontSize: 13.5, lineHeight: 1.5 }}>The directory lists Robert Matysiak as the contact person. You can call the shed or visit their Facebook page before you come along.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          <a href="tel:0287860040" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: T.ink, background: "#eef7f0", borderRadius: 13, padding: "11px 12px", fontWeight: 750, fontSize: 13.5 }}><Phone size={17} color={T.greenDk} /> 02 8786 0040</a>
          <a href="https://www.facebook.com/swsmensshedbonnyrigg/" target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: T.ink, background: "#eef3fb", borderRadius: 13, padding: "11px 12px", fontWeight: 750, fontSize: 13.5 }}><ExternalLink size={17} color="#3b6fb6" /> Visit the South West Sydney Men’s Shed Facebook page</a>
          <a href="https://mensshed.org/sheds/south-west-sydney-mens-shed-inc/" target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: T.ink, background: "#f7f4ef", borderRadius: 13, padding: "11px 12px", fontWeight: 750, fontSize: 13.5 }}><ExternalLink size={17} color={T.sub} /> View the current directory listing</a>
        </div>
      </div>

      {galleryOpen && <div onClick={() => setGalleryOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 160, background: "rgba(27,39,31,0.82)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18, cursor: "zoom-out" }}><div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 620, background: "#fff", borderRadius: 20, padding: 10, boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}><img src={signPhoto} alt="South West Sydney Men’s Shed sign enlarged" style={{ width: "100%", display: "block", borderRadius: 14 }} /><button onClick={() => setGalleryOpen(false)} style={{ width: "100%", marginTop: 9, padding: 11, border: "none", borderRadius: 12, background: T.green, color: "#fff", fontWeight: 800, cursor: "pointer" }}>Close photo</button></div></div>}
    </>
  );
}

function MensGroup({ onBack }) {
  return (
    <>
      <Brand right={<BackBtn onBack={onBack} />} />
      <div style={{ background: T.card, borderRadius: 20, overflow: "hidden", boxShadow: T.soft, marginTop: 8 }}>
        <img src="/mens_group.jpg" alt="Men's Group — Liverpool Area" style={{ width: "100%", display: "block" }} />
        <div style={{ padding: 18 }}>
          <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 10 }}>💙 Men's Group — Liverpool Area</div>
          <p style={{ fontSize: 14, color: T.ink, lineHeight: 1.55, fontStyle: "italic", margin: "0 0 12px" }}>
            "A lot of men aren't lonely because they have no one around them. They're lonely because very few people actually know them."
          </p>
          <p style={{ fontSize: 14, color: T.ink, lineHeight: 1.55, margin: "0 0 14px" }}>
            That's why this group exists. No masks. No pretending we're fine. Just real men, real conversations, brotherhood, accountability, and growth.
          </p>
          <div style={{ fontSize: 13.5, color: T.sub, lineHeight: 1.8, marginBottom: 14 }}>
            <div>📅 First gathering: Wednesday, 2 September</div>
            <div>📍 Liverpool Area (exact location shared when you connect)</div>
            <div>👋 I'll be there too. — Juan</div>
          </div>
          <p style={{ fontSize: 14, color: T.ink, lineHeight: 1.5, margin: "0 0 16px" }}>
            Come be seen. Come be known. You don't have to carry it alone.
          </p>
          <Btn onClick={() => window.open("https://www.facebook.com/share/p/18g3cxQsVP/", "_blank", "noopener,noreferrer")}><span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>Visit to join <ExternalLink size={16} /></span></Btn>
        </div>
      </div>
    </>
  );
}

function JournalPinGate({ onUnlock, onBack }) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const unlock = async () => {
    if (busy) return;
    if (!/^\d{4}$/.test(pin)) { setError("Enter your four-digit Journal PIN."); return; }
    setBusy(true); setError("");
    try {
      const saved = await sget(JOURNAL_PIN_STORAGE_KEY);
      const hash = await hashJournalPin(pin);
      if (!saved?.hash || hash !== saved.hash) { setError("That PIN is not correct. Please try again."); return; }
      onUnlock();
    } catch (unlockError) { setError(unlockError?.message || "We couldn't unlock your Journal just now."); }
    finally { setBusy(false); }
  };
  return (
    <>
      <Brand right={<BackBtn onBack={onBack} />} />
      <div style={{ background: T.card, borderRadius: 20, padding: 24, boxShadow: T.soft, marginTop: 20, textAlign: "center" }}>
        <div style={{ width: 58, height: 58, borderRadius: "50%", background: "#eee9f8", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
          <Shield size={28} color="#7055a8" />
        </div>
        <div style={{ fontWeight: 800, fontSize: 19, marginBottom: 8 }}>Journal locked</div>
        <p style={{ fontSize: 14, color: T.sub, lineHeight: 1.55, margin: "0 0 18px" }}>
          Enter your four-digit PIN to open your private Journal on this device.
        </p>
        <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} onKeyDown={(e) => { if (e.key === "Enter") unlock(); }}
          inputMode="numeric" autoComplete="current-password" type="password" maxLength={4} autoFocus placeholder="4-digit PIN" aria-label="Journal PIN"
          style={{ ...inputStyle, textAlign: "center", fontSize: 20, letterSpacing: 6, marginBottom: 10 }} />
        {error && <p style={{ fontSize: 12.5, color: "#c94f4f", margin: "0 0 12px" }}>{error}</p>}
        <Btn onClick={unlock} disabled={busy || pin.length !== 4} style={{ width: "100%" }}>{busy ? "Unlocking…" : "Unlock Journal"}</Btn>
        <p style={{ fontSize: 11.5, color: T.sub, lineHeight: 1.45, margin: "16px 0 0" }}>
          This privacy lock is protected on this device and, when you are signed in, follows your account to other devices. For safety, the PIN cannot be recovered if it is forgotten.
        </p>
      </div>
    </>
  );
}

function Journal({ profile, journal, saveJournal, voiceOn, onBack }) {
  const { speak, stop, speaking } = useVoice(voiceOn);
  const [tab, setTab] = useState("journal");
  const [text, setText] = useState("");
  const [reflecting, setReflecting] = useState(false);
  const [prompt, setPrompt] = useState("What's going on today? There's no right or wrong way to do this — just jot down whatever is on your mind.");
  const journalEntries = journal.filter((e) => e.kind !== "fleeting");
  const fleetingEntries = journal.filter((e) => e.kind === "fleeting");

  useEffect(() => { speak(prompt, CHARS.lila); return () => stop(); /* eslint-disable-next-line */ }, []);

  const save = (kind = "journal") => {
    const t = text.trim(); if (!t) return;
    const entry = { id: Date.now(), ts: Date.now(), text: t, kind };
    saveJournal([entry, ...journal]); setText("");
  };

  const unpack = async () => {
    const t = text.trim(); if (!t) return;
    setReflecting(true);
    try {
      const out = await callModel({
        system: `${CHARS.lila.system}\nThe person is journaling. Read what they wrote and offer ONE short, warm reflection and ONE gentle question to help them go a little deeper. 2-3 sentences, no advice-dumping.`,
        messages: [{ role: "user", content: t }],
      });
      setPrompt(out); if (voiceOn && __autoVoiceOn) speak(out, CHARS.lila);
    } catch { setPrompt("However you said it, thanks for putting it into words. What feels most true about it right now?"); }
    finally { setReflecting(false); }
  };

  const tabButton = (key, label, Icon) => <button onClick={() => { setTab(key); setText(""); }} aria-pressed={tab === key} style={{ flex: 1, border: tab === key ? `1.5px solid ${T.green}` : `1px solid ${T.line}`, borderRadius: 13, padding: "10px 7px", background: tab === key ? "#e6f5eb" : T.card, color: tab === key ? T.greenDk : T.sub, fontSize: 11.5, fontWeight: tab === key ? 800 : 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}><Icon size={14} />{label}</button>;
  const serviceCard = (label, sub, href, Icon, accent) => <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noopener noreferrer" : undefined} style={{ display: "flex", alignItems: "center", gap: 11, background: T.card, borderRadius: 16, padding: 13, boxShadow: T.soft, textDecoration: "none", color: T.ink, borderLeft: `4px solid ${accent}` }}><div style={{ width: 38, height: 38, borderRadius: 12, background: `${accent}18`, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon size={19} color={accent} /></div><div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontSize: 14 }}>{label}</div><div style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.4 }}>{sub}</div></div><ExternalLink size={16} color={accent} /></a>;

  return (
    <>
      <Brand right={<BackBtn onBack={onBack} />} />
      <div style={{ background: "linear-gradient(135deg, #eee9f8, #f8fbf8 72%)", borderRadius: 20, padding: "15px 16px", boxShadow: T.soft, marginTop: 5 }}><div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, color: T.ink }}><Shield size={18} color="#7055a8" /> Private space</div><div style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.45, marginTop: 4 }}>Your notes stay behind your Journal PIN. Choose the kind of space you need today.</div></div>
      <div style={{ display: "flex", gap: 7, marginTop: 13 }}>{tabButton("journal", "Journal", BookOpen)}{tabButton("fleeting", "Fleeting thoughts", Sparkles)}{tabButton("services", "Help now", LifeBuoy)}</div>

      {tab !== "services" && <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 15 }}><div style={{ width: 76, flexShrink: 0 }}><Portrait src={IMG.lila} name="Lila" size={76} speaking={speaking} tint={CHARS.lila.tint} /></div><div style={{ background: T.card, borderRadius: 18, padding: "13px 15px", boxShadow: T.soft, fontSize: 14.5, lineHeight: 1.45 }}>{reflecting ? "Reading that back…" : tab === "fleeting" ? "A thought does not have to become a whole story. Get it down before it disappears." : prompt}</div></div>}

      {tab === "journal" && <><div style={{ marginTop: 16 }}><textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder="Tap the mic to speak, or type here…" style={{ ...inputStyle, resize: "none", minHeight: 150 }} /><div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}><HoldToTalk onText={(t) => setText((p) => (p ? p + " " : "") + t)} /><div style={{ flex: 1, display: "flex", gap: 8 }}><Btn kind="outline" onClick={unpack} disabled={!text.trim() || reflecting} style={{ flex: 1 }}>Help me unpack</Btn><Btn onClick={() => save("journal")} disabled={!text.trim()} style={{ flex: 1 }}>Save entry</Btn></div></div></div><EntryList title="Past entries" entries={journalEntries} /></>}
      {tab === "fleeting" && <><div style={{ marginTop: 16 }}><textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="A thought, reminder, feeling, or idea…" style={{ ...inputStyle, resize: "none", minHeight: 110 }} /><div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}><HoldToTalk onText={(t) => setText((p) => (p ? p + " " : "") + t)} /><div style={{ flex: 1 }}><Btn onClick={() => save("fleeting")} disabled={!text.trim()}>Save fleeting thought</Btn></div></div></div><EntryList title="Recent fleeting thoughts" entries={fleetingEntries} /></>}
      {tab === "services" && <><div style={{ background: "#fff4f1", border: "1px solid #f0d4cd", borderRadius: 16, padding: 13, marginTop: 15, color: T.ink, fontSize: 13, lineHeight: 1.5 }}><strong>If you are in immediate danger, call Triple Zero.</strong> These links and numbers are here for quick access. You can tap a phone number to call or open a service website for more options.</div><SectionTitle>Emergency</SectionTitle><div style={{ display: "flex", flexDirection: "column", gap: 9 }}><a href="tel:000" style={{ display: "flex", alignItems: "center", gap: 11, background: "#c94f4f", color: "#fff", borderRadius: 16, padding: 14, textDecoration: "none", boxShadow: T.soft }}><Phone size={22} /><div><div style={{ fontWeight: 800, fontSize: 16 }}>Triple Zero — 000</div><div style={{ fontSize: 12.5, opacity: 0.9 }}>Police, ambulance or fire</div></div></a></div><SectionTitle>Essential support</SectionTitle><div style={{ display: "flex", flexDirection: "column", gap: 9 }}>{serviceCard("Lifeline", "13 11 14 · 24/7 crisis support", "tel:131114", Phone, "#c94f4f")}{serviceCard("Beyond Blue", "1300 22 4636 · mental health support", "tel:1300224636", Phone, "#3f6faf")}{serviceCard("Suicide Call Back Service", "1300 659 467 · phone and online counselling", "tel:1300659467", Phone, "#7055a8")}{serviceCard("MensLine Australia", "1300 78 99 78 · support for men and families", "tel:1300789978", Phone, "#2e8578")}{serviceCard("1800RESPECT", "1800 737 732 · domestic, family and sexual violence support", "tel:1800737732", Phone, "#b56739")}{serviceCard("Healthdirect", "1800 022 222 · health advice from a registered nurse", "tel:1800022222", Phone, "#4e7c9e")}{serviceCard("Lifeline online chat", "Open Lifeline’s online support options", "https://www.lifeline.org.au/crisis-chat/", ExternalLink, "#c94f4f")}</div></>}
      {tab !== "services" && <Disclaimer />}
      {tab === "services" && <Disclaimer />}
    </>
  );
}

function EntryList({ title, entries }) {
  if (!entries.length) return <div style={{ background: T.card, borderRadius: 16, padding: 15, boxShadow: T.soft, marginTop: 18, color: T.sub, fontSize: 13.5 }}>Nothing here yet. It is okay to start small.</div>;
  return <><SectionTitle>{title}</SectionTitle><div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{entries.map((e) => <div key={e.id} style={{ background: T.card, borderRadius: 16, padding: 14, boxShadow: T.soft }}><div style={{ fontSize: 11.5, color: T.sub, marginBottom: 6 }}>{new Date(e.ts).toLocaleString()}</div><div style={{ fontSize: 14.5, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{e.text}</div></div>)}</div></>;
}
