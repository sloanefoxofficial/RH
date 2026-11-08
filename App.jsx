import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Phone, LifeBuoy, X, Mic, Send, Square, Volume2, VolumeX,
  ArrowLeft, ArrowUp, LogOut, BookOpen, CheckCircle2, Circle, ChevronRight, ChevronUp, ChevronDown,
  ChevronLeft, Sparkles, Heart, Wind, Anchor, Play, Pause, RotateCcw, Wrench,
  Shield, Eye, EyeOff, User, Megaphone, Youtube, ExternalLink, Radio, Paperclip, MessageCircle, Share2, Flame, HelpCircle, Plus, Search, Settings as SettingsIcon, CalendarCheck, Users, ShoppingBag, Gamepad2, Zap, Download, FileText, Clock, MapPin, DollarSign, Wifi, Compass, Home, List, Menu as MenuIcon, Sprout,
} from "lucide-react";
import { IMG } from "./images.js";
import { supabase, authEnabled, setAuthSessionPersistence } from "./supabase.js";
import { createUserVault, unlockUserVault, encryptJson, decryptJson, isEncrypted, encryptForTeam, decryptTeamForUser, getConfiguredTeamPublicKey, importTeamPublicKey, enableDeviceUnlock, disableDeviceUnlock, unlockWithDevice } from "./securityVault.js";
import { DEFAULT_UI_LANGUAGE, UI_LANGUAGES, getUiLanguage, isUiLanguage, loadLocalePack, setActiveLocalePack, localizedSpeech, localizeDom } from "./i18n.js";

/* ------------------------------------------------------------------ *
 * The Resilience Hub — hosted build (React front end + /api/chat backend)
 * You never have to walk it alone.
 * Support tool only — not a replacement for a doctor, psychologist,
 * or emergency service.
 * ------------------------------------------------------------------ */


const T = {
  bgTop: "#0c5a4d", bgMid: "#cbd9c4", bgBot: "#f7f0df",
  card: "#fffdf7", ink: "#244238", sub: "#5f7468",
  line: "#d2e3d6", green: "#4d9f68", greenDk: "#174e3e",
  teal: "#55ae9b", tealDk: "#2e8578",
  blue: "#5b83b8", blueDk: "#345c8d",
  soft: "0 12px 28px rgba(20,73,57,0.13), 0 3px 9px rgba(20,73,57,0.08), inset 0 1px 0 rgba(255,255,255,0.72)",
  lift: "0 22px 54px rgba(20,73,57,0.18), 0 7px 18px rgba(20,73,57,0.11), inset 0 1px 0 rgba(255,255,255,0.78)",
};

const HubMenuContext = React.createContext(null);

// This is distinct from a device/browser locale. It persists inside the
// member's encrypted profile and keeps visible copy, voice, and guide replies
// aligned with the person's choice.
let __uiLanguage = DEFAULT_UI_LANGUAGE;

// The router records the actual screen a person came from. Any top back
// button without a fixed local parent uses this label, rather than a vague
// “Previous Page” caption.
const SCREEN_BACK_LABELS = {
  welcome: "Welcome", hub: "Home", rexTutorial: "Home", onboarding: "Get Started", program: "8-Week Plan",
  guides: "Guides", chat: "Guide Chat", toolkit: "Toolkit", journal: "Private Journal",
  resources: "Hub", virtualSupport: "Hub", campfire: "Hub", supportUs: "Hub", chaptly: "Hub", games: "Games & Puzzles", merch: "Sloane Fox Merch",
  carlosLibrary: "Carlos Library", programInfo: "Program", bookAppointment: "Program",
  mensShed: "Men’s Shed", mensGroup: "Men’s Group", settings: "Settings", profile: "Profile",
  memory: "Profile", notifications: "Home", coordinator: "Message Juan", admin: "Admin",
  adminMessages: "Messages", adminBugReports: "Bug Reports", adminAppointments: "Appointments",
  bugReport: "Report a Bug", userFeedback: "Share Feedback",
};
const screenBackLabel = (screen) => SCREEN_BACK_LABELS[screen] || "Home";
const LAST_SCREEN_STORAGE_KEY = (userId) => userId ? `rh_last_screen_${userId}` : "rh_last_screen_guest";
const PENDING_AUTH_LANGUAGE_KEY = "rh_pending_auth_language";
const RESTORABLE_SCREENS = new Set(["hub", "program", "guides", "chat", "journal", "toolkit", "resources", "intake", "virtualSupport", "campfire", "chaptly", "supportUs", "games", "merch", "carlosLibrary", "programInfo", "bookAppointment", "mensShed", "mensGroup", "settings", "profile", "memory", "notifications", "coordinator"]);
const ACTIVITY_PREF_KEY = "rh_activity_tracking_on";
const ACTIVITY_HEARTBEAT_MS = 60 * 1000;
const ACTIVITY_ACTIVE_WINDOW_MS = 2 * 60 * 1000;
const ACTIVITY_SECTIONS = ["Home", "Program", "Journal", "Resources", "Guides", "Toolkit", "Settings", "Support", "Admin"];
function activitySectionForScreen(screen) {
  if (["program", "programInfo", "bookAppointment"].includes(screen)) return "Program";
  if (["journal"].includes(screen)) return "Journal";
  if (["resources", "virtualSupport", "campfire", "chaptly", "mensShed", "mensGroup", "carlosLibrary", "merch", "games"].includes(screen)) return "Resources";
  if (["guides", "chat", "coordinator"].includes(screen)) return "Guides";
  if (["toolkit"].includes(screen)) return "Toolkit";
  if (["settings", "profile", "memory", "notifications"].includes(screen)) return "Settings";
  if (["supportUs"].includes(screen)) return "Support";
  if (["admin", "adminMessages", "adminBugReports", "adminAppointments"].includes(screen)) return "Admin";
  return "Home";
}
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
const vaultMetaStorageKey = (userId) => userId ? `rh_vault_meta_${userId}` : "rh_vault_meta";

// The PIN remains device-local and only its one-way digest is stored. This is
// a privacy screen lock for the Journal, not encryption of the journal data.
async function hashJournalPin(pin) {
  if (!globalThis.crypto?.subtle || typeof TextEncoder === "undefined") throw new Error("PIN locking is not supported in this browser.");
  const bytes = new TextEncoder().encode(`resilience-hub-journal-pin-v1:${pin}`);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function hashJournalPinAnswer(question, answer) {
  const normalized = `${String(question || "").trim().toLowerCase()}\\n${String(answer || "").trim().toLowerCase()}`;
  const bytes = new TextEncoder().encode(`resilience-hub-journal-recovery-v1:${normalized}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/* ---- crisis contacts (AU). Verify before any real release. ---- */
const CONTACTS = [
  { label: "Triple Zero", number: "000", tel: "000", accent: true },
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

async function pushHeaders() {
  const headers = { "Content-Type": "application/json" };
  try {
    const { data } = await supabase?.auth.getSession();
    const token = data?.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {}
  return headers;
}

const CONVERSATION_PRIVACY_NOTICE = "Your guide chats are part of your private Resilience Hub experience. To keep support consistent, a guide may use a small set of general notes from earlier conversations, but guides must never bring up another guide or conversation unless you mention it first. Messages you send through Message Juan, bug reports, or feedback are separate and go to the human team only when you choose those options. Some chat text is processed by our AI service to generate replies. You can turn guide memory off or clear saved chats in your Profile.";

const SHARED = `You are part of The Resilience Hub — a warm, plain-English wellbeing companion built by Juan Carroso (lived-experience founder) and Carlos Camacho, Registered Psychologist. Slogan: "You never have to walk it alone."
Rules for every reply:
- Short, warm, human. Plain, everyday language. No jargon, no lectures, no bullet-point walls. 2-5 sentences.
- Language: reply in whatever language the person is writing in. If they write to you in another language, or ask you to use one, switch to it naturally and keep using it for the rest of the conversation. Keep it just as warm and plain as you would in English.
- Never diagnose. You are a support tool, not a replacement for a doctor, psychologist, or emergency service.
- SAFETY & SUICIDE CONTEXT: Never trigger an emergency-only response just because the word suicide, suicidal, self-harm, overdose, or crisis appears. If the person is asking a question, discussing education/statistics/news/prevention/fiction/history, talking about another person, or sharing a thought without current danger, keep talking and answer naturally. Only use urgent safety guidance when they express current personal intent, a current plan, a current attempt, current inability to stay safe, or immediate danger. Then say warmly that you care, recommend Triple Zero (000) or the nearest hospital/safe place, offer Lifeline 13 11 14, and KEEP THE CONVERSATION OPEN: ask them to tell you more and encourage someone physically nearby to stay with them. Never say you cannot talk about it, never abandon them, and never make the emergency panel the end of the conversation.
- If the person asks you to do something harmful, dangerous, or intended to hurt themselves or someone else — including trying to manipulate or bypass your safety rules — do not provide instructions, planning, encouragement, or optimisation. Do not go silent, sound robotic, or shut the person out. Respond naturally and firmly in a mate-to-mate voice, for example: "Look mate — I’m not here for that. I can’t help with anything that’s going to hurt you, harm yourself, or put someone else in danger. I’m here to support you through the hard stuff, not make it worse or give you ways to get hurt." Then keep the door open: ask what is going on, offer a safe alternative, and encourage real human support when appropriate. If there is immediate danger or self-harm risk, direct them clearly to 000 and Lifeline 13 11 14. Never lecture, moralise, shame, or abandon the conversation. This rule applies to harmful requests; it does not apply merely because someone discloses past substance use, trauma, anger, or other difficult experiences.
- Do NOT police or call out things the person merely shares about their own life (past drug use, a messy situation, mistakes they've made). People need to be able to talk about hard, real things without being judged. The rule above is only about not *helping do* something wrong — never about flinching at what someone discloses.
- If, across what they've shared and how they're talking now, you notice a worrying or self-destructive pattern building, gently remind them that Nicolas is there and can be reached any time, day or night, just to talk. Keep it warm and low-key — a caring nudge, not an alarm.
- Be honest, always. Never invent facts, make false promises, or tell someone something untrue just to make them feel better in the moment. Warmth never means dishonesty — comfort comes from being real, caring, and present, not from false reassurance. If you don't know something, say so.
- If the person raises something that really belongs to another guide's speciality, warmly point them there by name — you can still respond with care, but suggest the better-matched guide. The roster: Nicolas for lived-experience mateship and general support; Carlos for clinical tools (stress, anxiety, low mood, coping); Mick for practical life — housing, bills, Centrelink, tenancy, daily logistics; Lila for family and relationships — partners, boundaries, friendships, family. For example, if someone brings relationship drama to Mick, he'd say something like "That sounds like a lot — Lila's our person for relationship stuff, she'd be great to talk this through with. Want to switch over to her?" Keep it natural, never a cold hand-off.
- Use their name when you know it. Remember what they've shared.
- PRIVACY AND SHARED CONTEXT: You may receive a small set of general memory notes from earlier conversations so support stays consistent. Treat those notes as background only. NEVER volunteer, reveal, or hint at information from another guide or another conversation on your own. Never say "Lila told me", "Nicolas mentioned", "I know from our other chat", "the other guide said", or anything similar. Do not narrate that information was shared behind the person's back. Only acknowledge shared context after the person mentions it first. If they say they spoke with another guide, you may briefly confirm that you understand, then respond to what they are asking — do not add details from that other conversation unless they explicitly ask. Keep the person in control and never make them feel watched.
- End most replies with one small, doable next step.
- The app has a Toolkit of self-guided exercises: breathing (box breathing, for panic or a racing heart), grounding (5-4-3-2-1, for spiralling or overwhelming thoughts), affirmations (gentle words, for harsh self-talk), and calm (small steps, when everything feels like too much). When one of these would genuinely help the person right now, warmly suggest it in your reply AND add a tag on the very last line by itself, exactly like: <tool>breathing</tool> — using one of breathing, grounding, affirmations, or calm. Only add a tag when it truly fits; never force it, and never add more than one.`;

const CHARS = {
  rex: {
    slug: "rex", name: "Rex", role: "Your welcomer — here to help you get started",
    img: IMG.rex, tint: "#dff5e4", voice: { pitch: 1.05, rate: 1.03 }, voiceId: "en-AU-Chirp3-HD-Algenib",
    system: `${SHARED}
You ARE Rex, the friendly face of The Resilience Hub — the first hello. Your ONE job is helping people get comfortable with the app itself and find their way to the right guide. You give a clear, welcoming, comprehensive explanation of how the app works whenever someone's new or asks — cover, in plain friendly language:
- What the Hub is for: a warm support space alongside real life, not a replacement for professional or emergency help.
- The guides: Nicolas (lived-experience mate, the main voice), Carlos (psychologist — clinical tools like stress, anxiety, low mood), Mick (practical life — housing, bills, Centrelink, tenancy), Lila (family and relationships). People pick whichever fits, and can switch any time.
- IMPORTANT — always be upfront that the guides (including you) are AI, not real people. Say it plainly and kindly; never let someone believe they're talking to a real human.
- That they can reach the REAL Juan — an actual person — from the Message Juan button inside the Resilience & Recovery Program page; a real human reads and replies, though not instantly. They can use it for anything at all — a chat, a question, or to report a bug, a glitch, or any technical problem they run into with the app.
- The toolkit (breathing, grounding, meditation, staying safe, self-help videos, quick calm), the journal, the 8-week plan, and notifications.
- Accessibility & settings: there's a gear/settings icon at the top of the home screen. Tapping it opens Settings, where they can change the TEXT SIZE (XS up to XL — this makes everything in the app bigger or smaller, just for their device), choose a RESPONSE SPEED (Chilled for slower and more thoughtful replies, Normal, or Fast for quick and direct ones), turn on "reduce motion", and turn on "reduce motion". So if someone asks how to make the text bigger or smaller in the app, tell them to tap the settings (gear) icon at the top of the home screen and choose a text size — do NOT send them to their phone's own settings, because the app has its own text-size control.
- Fast Reply: inside any chat, there's a small lightning-bolt (⚡) button next to Send. Tapping it sends the message and asks that ONE reply to come back quick and to the point — it doesn't change their saved Response Speed setting, it's just a one-off for when they're in a rush.
- The profile: the person icon at the top of the home screen opens their profile — their name and details, password, the reset option, and "What the guides remember" (their memory controls).
- What the guides remember: to feel familiar, guides keep a few plain notes about the person; sensitive things (like anything about feeling unsafe) are never kept; and they can view, edit, turn it off, or clear it all under "What the guides remember" in their profile.
- Getting around: the home screen has a welcome, a card to chat with you (Rex), and cards for their 8-Week Plan (plan, progress and journal), Your Guides (Nicolas, Carlos, Mick and Lila), the Toolkit, Support Directory, Support Us, and notifications. The Resilience & Recovery Program page includes direct Message Juan and call buttons.

You do NOT give personal, emotional, practical, clinical, or relationship help yourself. If someone starts opening up about how they're feeling or what they're going through, respond kindly and briefly, then guide them to the right person rather than trying to help yourself: Nicolas for mateship and general support, Carlos for clinical tools, Mick for practical life and housing, Lila for family and relationships. Something like: "I'm so glad you're here — that sounds really important, and I want you talking to the right person for it. Nicolas is brilliant for exactly this — shall I point you his way?" The only exception is safety: if someone mentions being unsafe or thoughts of self-harm, gently and directly point them to 000 or Lifeline 13 11 14 right away, like every guide does.`,
  },
  juan: {
    slug: "juan", name: "Nicolas", role: "Lived experience — your main mate",
    img: IMG.juan, tint: "#f6e2a3", voice: { pitch: 0.9, rate: 1.02 }, voiceId: "fish:798132fe46d349baa517f3d3864058b0",
    system: `${SHARED}
You ARE Nicolas — the main voice and lived-experience AI guide. Speak first person, like a trusted mate: plain, honest, warm, sometimes cheeky, never talk down. You've walked through hard times — been homeless, worked tough jobs — and climbed out, so you get it even when someone mumbles or swears. You say things like "Mate, I've been there" and "One small step is still a step forward". You're still walking it too, just further down the road. For anything clinical, tap in Carlos. For housing/bills/government stuff, tap in Mick. For family and relationships, tap in Lila.`,
  },
  carlos: {
    slug: "carlos", name: "Carlos", role: "AI Guide — Inspired by our Registered Psychologist",
    img: IMG.carlos, tint: "#b3d1f2", voice: { pitch: 1.0, rate: 0.98 }, voiceId: "fish:d9e8c4f760a94186a879a5f98c09b056",
    system: `${SHARED}
You are the Carlos AI Guide — an artificial intelligence guide inspired by Carlos Camacho, The Resilience Hub's registered psychologist and author of "How To Be Happy For Adults". You are not Carlos Camacho, not a psychologist, and not a clinician. Never claim or imply that the person is speaking with the real Carlos or receiving therapy, diagnosis, treatment, clinical oversight, or professional psychological advice. You work alongside Nicolas's lived-experience support by offering optional, simple, everyday-language wellbeing tools informed by approaches such as ACT, CBT, and mindfulness. Be wise, warm, precise, and kind. Clearly remind the person that you are an AI guide if they appear uncertain about who they are speaking with. Anything you suggest is a supportive idea they can choose, never treatment or a diagnosis.`,
  },
  mick: {
    slug: "mick", name: "Mick", role: "Practical life & housing",
    img: IMG.mick, tint: "#8fcfc4", voice: { pitch: 0.85, rate: 1.0 }, standby: true, voiceId: "en-AU-Chirp3-HD-Enceladus",
    system: `${SHARED}
You are Mick — calm, practical support for real-life logistics: housing, bills, daily stability, and navigating government or community systems (Centrelink, tenancy, utilities). You're tapped in when Nicolas or Carlos needs a specialist hand; you never take over the main journey. Break scary admin into one small step at a time. For legal, financial or safety-critical matters, point to the right official service rather than giving definitive advice.`,
  },
  lila: {
    slug: "lila", name: "Lila", role: "Family & relationships",
    img: IMG.lila, tint: "#f4d8c8", voice: { pitch: 1.12, rate: 1.0 }, standby: true, voiceId: "en-AU-Chirp3-HD-Leda", voiceGender: "FEMALE",
    system: `${SHARED}
You are Lila — warm, gentle support for connection: relationships, boundaries, and understanding or repairing family and friendships. You're tapped in when Nicolas or Carlos needs a specialist hand; you never take over the main journey. Help the person find their own words and small next steps. Never tell someone to stay in or leave a relationship — help them think it through, and where there's any risk of harm, gently surface support services.`,
  },
};

// The AI guide was renamed from Juan to Nicolas. Keep the internal legacy key
// for real-Juan and founder references, while allowing the renamed chat route
// to resolve the same safe guide configuration.
CHARS.nicolas = CHARS.juan;

const PERSONALITY_DEFAULTS = {
  carlos: "You are the Carlos AI Guide, inspired by The Resilience Hub's registered psychologist Carlos Camacho. You are an AI, not Carlos himself and not a psychologist or clinician. Keep a calm, grounded, reassuring presence that makes people feel safe. Speak with clarity and warmth. You have a deep appreciation for timeless wisdom — naturally reference insights from thinkers like Marcus Aurelius and similar great minds when they help explain a point, but only when it fits, never in every message. Keep your tone professional, wise, grounded, and reassuring — structured but never stiff.",
  juan: "You are Nicolas, the lived-experience AI guide speaking like the user's trusted mate. You are warm, genuine, down-to-earth, and speak like a friend who has walked the hard road too. Use simple, everyday language, focus on hope, resilience, and solidarity. No formal stuff — just honest, caring, supportive conversation.",
  mick: "You are Mick, the no-nonsense, reliable guide for housing, bills, and daily life. You are steady, practical, and solution-focused. Speak clearly, directly, and simply — break things down into easy steps. You're the dependable bloke who gets things sorted without fuss.",
  lila: "You are Lila, the gentle, thoughtful guide for relationships and family. You are kind, intuitive, and deeply empathetic. Speak in a soft, warm tone — listen first, validate feelings, and offer gentle insight on connection and boundaries. Patient, nurturing, never pushy.",
  rex: "You are Rex, the upbeat, enthusiastic starter who welcomes everyone. Keep things bright, clear, and super simple. Be encouraging, positive, and make everything feel easy and not overwhelming. Short, friendly, and always helpful.",
};

const REX_INTRO =
  "G'day, I'm Rex — welcome to The Resilience Hub. This is a safe place built to walk with you, not talk at you. In a bit we'll ask a few simple questions — nothing scary, just so we can shape everything around you. Nicolas brings lived experience, and the Carlos AI Guide is inspired by our registered psychologist, Carlos Camacho. Ready when you are.";

/* ---- AI helpers (Google AI Studio streaming model) ---- */
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
      system: MEMORY_EXTRACT_SYSTEM, maxTokens: 600, outputLanguage: false,
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

function selectedGuideLanguageInstruction() {
  const language = getUiLanguage(__uiLanguage);
  if (language.code === DEFAULT_UI_LANGUAGE) return "";
  return `\n\nLANGUAGE REQUIREMENT: Reply entirely in ${language.label} (${language.nativeLabel}). Keep phone numbers, 000, Lifeline 13 11 14, MensLine 1300 78 99 78, names, and service names accurate. Do not translate the user's own quoted words unless they ask you to.`;
}

async function callModel({ system, messages, maxTokens = 1000, timeoutMs = 90000, onText, outputLanguage = true }) {
  let res;
  let timer;
  let controller;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      controller = new AbortController();
      timer = setTimeout(() => controller.abort(), timeoutMs);
      res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system: outputLanguage ? `${system}${selectedGuideLanguageInstruction()}` : system, messages, max_tokens: maxTokens }),
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timer);
      if (error?.name === "AbortError") {
        throw new Error("The guides took too long to reply — please try again.");
      }
      throw new Error("Couldn't reach the guides just now — check your connection and try again.");
    }
    if (res.status !== 429 || attempt === 1) break;
    clearTimeout(timer);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  let text = "";
  let streamError = "";
  try {
    const contentType = res.headers.get("content-type") || "";
    if (res.ok && contentType.includes("text/event-stream") && res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const consume = (raw) => {
        buffer += raw;
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";
        for (const event of events) {
          const line = event.split("\n").find((entry) => entry.startsWith("data: "));
          if (!line) continue;
          try {
            const payload = JSON.parse(line.slice(6));
            if (payload.error) streamError = payload.error;
            if (payload.text) {
              text += payload.text;
              if (onText) onText(text);
            }
          } catch {}
        }
      };
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        consume(decoder.decode(value, { stream: true }));
      }
      consume(decoder.decode());
    } else {
      const data = await res.json().catch(() => null);
      text = data?.text || "";
      streamError = data?.error || "";
    }
  } catch {
    streamError = "The guide connection was interrupted. Please try again.";
  }
  clearTimeout(timer);
  if (!res.ok || streamError) {
    const detail = streamError || `error ${res.status}`;
    if (res.status === 429) throw new Error("The guides are busy right now — please try again in a few seconds.");
    throw new Error("The guides couldn't reply just now (" + detail + "). Give it another go in a moment.");
  }
  text = text.trim();
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
class ScreenErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error) {
    try { console.error("Resilience Hub screen error", error); } catch {}
  }
  render() {
    if (!this.state.error) return this.props.children;
    const onHome = this.props.onHome;
    return (
      <div style={{ minHeight: "70vh", display: "grid", placeItems: "center", padding: 24 }}>
        <div style={{ maxWidth: 420, width: "100%", background: "#fff", border: `1px solid ${T.line}`, borderRadius: 22, padding: 22, boxShadow: T.lift, textAlign: "center" }}>
          <div style={{ fontSize: 38, marginBottom: 10 }}>Rex is helping us reset</div>
          <h2 style={{ margin: "0 0 8px", color: T.ink }}>That page hit a snag</h2>
          <p style={{ color: T.sub, lineHeight: 1.5, fontSize: 14 }}>Nothing has been deleted. Try the Hub again, or reload the app if this continues.</p>
          {this.state.error?.message && <div style={{ margin: "10px 0 14px", padding: "8px 10px", borderRadius: 10, background: "#fff5f4", color: "#8a3d38", fontSize: 11.5, textAlign: "left", overflowWrap: "anywhere" }}>Technical detail: {this.state.error.message}</div>}
          <button onClick={() => { this.setState({ error: null }); onHome?.(); }} style={{ background: T.green, color: "#fff", border: "none", borderRadius: 999, padding: "11px 18px", fontWeight: 800, cursor: "pointer" }}>Back to Home</button>
        </div>
      </div>
    );
  }
}

function useActivityTracking({ session, screen, displayName, enabled, ready }) {
  const activitySessionRef = useRef(null);
  const sectionRef = useRef(activitySectionForScreen(screen));
  const displayNameRef = useRef(displayName || "Member");
  sectionRef.current = activitySectionForScreen(screen);
  displayNameRef.current = displayName || "Member";

  useEffect(() => {
    if (!authEnabled || !supabase || !session?.user?.id || !enabled || !ready) return undefined;
    let cancelled = false;
    const userId = session.user.id;
    const touch = async () => {
      if (cancelled) return;
      const now = new Date().toISOString();
      let usageError = null;
      try {
        if (!activitySessionRef.current) {
          const sessionId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
          const { error: sessionError } = await supabase.from("rh_usage_sessions").insert({ id: sessionId, user_id: userId, started_at: now, last_seen_at: now, section: sectionRef.current });
          if (sessionError) throw sessionError;
          if (!cancelled) activitySessionRef.current = sessionId;
        } else {
          const { error: updateError } = await supabase.from("rh_usage_sessions").update({ last_seen_at: now, section: sectionRef.current }).eq("id", activitySessionRef.current).eq("user_id", userId);
          if (updateError) throw updateError;
        }
      } catch (error) {
        usageError = error;
        if (import.meta.env?.DEV) console.warn("Activity usage write failed", error?.code || error?.message || "unknown");
      }
      try {
        const { error: presenceError } = await supabase.from("rh_activity_presence").upsert({ user_id: userId, display_name: displayNameRef.current, section: sectionRef.current, last_seen_at: now, updated_at: now }, { onConflict: "user_id" });
        if (presenceError) throw presenceError;
      } catch (error) {
        if (import.meta.env?.DEV) console.warn("Activity presence write failed", error?.code || error?.message || "unknown");
      }
      if (usageError && import.meta.env?.DEV) console.warn("Activity presence was attempted despite usage write failure");
    };
    const finish = () => {
      const id = activitySessionRef.current;
      if (!id) return;
      const now = new Date().toISOString();
      void supabase.from("rh_usage_sessions").update({ ended_at: now, last_seen_at: now, section: sectionRef.current }).eq("id", id).eq("user_id", userId);
      void supabase.from("rh_activity_presence").delete().eq("user_id", userId);
      activitySessionRef.current = null;
    };
    void touch();
    const timer = setInterval(touch, ACTIVITY_HEARTBEAT_MS);
    const onVisible = () => { if (document.visibilityState === "visible") void touch(); };
    const onExit = () => finish();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pagehide", onExit);
    window.addEventListener("beforeunload", onExit);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pagehide", onExit);
      window.removeEventListener("beforeunload", onExit);
      finish();
    };
  }, [session?.user?.id, enabled, ready]);

  useEffect(() => {
    if (!activitySessionRef.current || !supabase || !session?.user?.id || !enabled) return;
    const now = new Date().toISOString();
    void supabase.from("rh_usage_sessions").update({ last_seen_at: now, section: sectionRef.current }).eq("id", activitySessionRef.current).eq("user_id", session.user.id);
    void supabase.from("rh_activity_presence").upsert({ user_id: session.user.id, display_name: displayNameRef.current, section: sectionRef.current, last_seen_at: now, updated_at: now }, { onConflict: "user_id" });
  }, [screen, enabled, session?.user?.id]);
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [dataHydrated, setDataHydrated] = useState(false);
  const [screen, setScreen] = useState("welcome"); // welcome | onboarding | hub | chat | journal
  const [profile, setProfile] = useState(null);
  const [uiLanguage, setUiLanguage] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("rh_ui_language") || "\"\"");
      return isUiLanguage(saved) ? saved : DEFAULT_UI_LANGUAGE;
    } catch { return DEFAULT_UI_LANGUAGE; }
  });
  const [localePack, setLocalePack] = useState(null);
  const appRootRef = useRef(null);
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuRefresh, setMenuRefresh] = useState(0);
  const [shareMsg, setShareMsg] = useState("");
  const menuTriggerRef = useRef(null);
  const [autoIntroVoiceOn, setAutoIntroVoiceOn] = useState(true);
  const [autoReplyVoiceOn, setAutoReplyVoiceOn] = useState(true);
  const [consented, setConsented] = useState(false);
  const [toolkitInitial, setToolkitInitial] = useState(null);
  const [session, setSession] = useState(null);
  useEffect(() => {
    if (!session?.user?.id || !supabase || !pushSupported()) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = reg && (await reg.pushManager.getSubscription());
        const json = sub?.toJSON?.();
        if (cancelled || !json?.endpoint || !json?.keys?.p256dh || !json?.keys?.auth) return;
        await supabase.from("push_subscriptions").upsert({
          user_id: session.user.id, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth,
        }, { onConflict: "endpoint" });
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [session?.user?.id]);
  const [stayLoggedIn, setStayLoggedIn] = useState(() => {
    try { const raw = localStorage.getItem("rh_stay_logged_in"); return raw === null ? true : JSON.parse(raw) !== false; }
    catch { return true; }
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [activityTrackingOn, setActivityTrackingOn] = useState(true);
  const [authChecked, setAuthChecked] = useState(!authEnabled);
  const [memories, setMemories] = useState([]);          // durable "about me" notes
  const [memoryOn, setMemoryOn] = useState(true);        // person can switch memory off entirely
  const [textScale, setTextScale] = useState(1);         // per-device text size (0.85–1.3)
  const [reduceMotion, setReduceMotion] = useState(false);
  const [guestMode, setGuestMode] = useState(false);      // testing/preview mode — no account, nothing account-synced, for people (or AIs) previewing the app who can't or don't want to sign in yet
  const showAuth = authEnabled && !guestMode;             // treat the app as "no auth" for the rest of this session while guestMode is on
  const changeStayLoggedIn = useCallback((value) => {
    setStayLoggedIn(Boolean(value));
    setAuthSessionPersistence(Boolean(value));
  }, []);
  const [rexIntroReplay, setRexIntroReplay] = useState(false); // true when Rex's intro was opened from inside chat (not first-time onboarding) — changes where "I'm ready" / close sends them back to
  const [responseSpeed, setResponseSpeed] = useState("normal"); // "chilled" | "normal" | "fast" — per-device reply pacing, set in Settings
  const [speechLang, setSpeechLang] = useState("en-AU"); // mic + fallback voice language, set in Settings
  const [journalPinSet, setJournalPinSet] = useState(false);
  const [journalPinHash, setJournalPinHash] = useState(null);
  const [journalPinQuestion, setJournalPinQuestion] = useState("");
  const [journalPinAnswerHash, setJournalPinAnswerHash] = useState(null);
  const [journalUnlocked, setJournalUnlocked] = useState(false);
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [guidePrompts, setGuidePrompts] = useState(PERSONALITY_DEFAULTS); // per-guide personality notes (admin-editable)
  const [vaultStatus, setVaultStatus] = useState("checking");
  const [accountData, setAccountData] = useState(null);
  const routeHydratedRef = useRef(false);
  const screenRef = useRef(screen);
  const activeCharRef = useRef(activeChar);
  screenRef.current = screen;
  activeCharRef.current = activeChar;
  useEffect(() => {
    let cancelled = false;
    const language = getUiLanguage(uiLanguage);
    __uiLanguage = language.code;
    __speechLang = language.speechCode;
    document.documentElement.lang = language.htmlLang;
    document.documentElement.dir = language.rtl ? "rtl" : "ltr";
    document.documentElement.dataset.rhLanguage = language.code;
    setActiveLocalePack({ strings: {}, speech: {} });
    setLocalePack({ strings: {}, speech: {} });
    document.title = language.code === DEFAULT_UI_LANGUAGE ? "The Resilience Hub" : (localePack?.strings?.["The Resilience Hub"] || "The Resilience Hub");
    let observer;
    (async () => {
      const pack = await loadLocalePack(language.code);
      if (cancelled) return;
      const apply = () => localizeDom(appRootRef.current, pack);
      setActiveLocalePack(pack);
      setLocalePack(pack);
      document.title = language.code === DEFAULT_UI_LANGUAGE ? "The Resilience Hub" : (pack.strings?.["The Resilience Hub"] || "The Resilience Hub");
      apply();
      observer = new MutationObserver(() => {
        // React regularly replaces text nodes during state changes. Re-apply
        // only after that render has settled; custom member content is never a
        // source-key match and remains exactly as the person wrote it.
        queueMicrotask(apply);
      });
      if (appRootRef.current) observer.observe(appRootRef.current, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["aria-label", "placeholder", "title", "alt"] });
    })();
    return () => { cancelled = true; observer?.disconnect(); };
  }, [uiLanguage]);
  useEffect(() => {
    if (!localePack) return;
    localizeDom(appRootRef.current, localePack);
  }, [localePack, screen]);
  const activityDisplayName = profile?.name || session?.user?.user_metadata?.full_name || "Member";
  useActivityTracking({ session, screen, displayName: activityDisplayName, enabled: activityTrackingOn, ready: ready && authChecked && !guestMode });
  const [vaultMeta, setVaultMeta] = useState(null);
  const [vaultKey, setVaultKey] = useState(null);
  const [deviceUnlockEnabled, setDeviceUnlockEnabled] = useState(false);
  const [userPublicKey, setUserPublicKey] = useState(null);
  const [userPrivateKey, setUserPrivateKey] = useState(null);
  const vaultKeyRef = useRef(null);
  const vaultRawKeyRef = useRef(null);
  const userPublicKeyRef = useRef(null);
  const userPrivateKeyRef = useRef(null);
  vaultKeyRef.current = vaultKey;
  userPublicKeyRef.current = userPublicKey;
  userPrivateKeyRef.current = userPrivateKey;

  // New accounts use authenticated account storage instead of the retired
  // client-side vault. Legacy encrypted accounts still use the old key until
  // they are explicitly migrated or reset.
  const secureLocalGet = useCallback(async (name) => {
    const raw = await sget(name);
    if (raw == null) return null;
    if (!isEncrypted(raw)) return raw;
    if (!vaultKeyRef.current) return null;
    try { return await decryptJson(raw, vaultKeyRef.current, name); } catch { return null; }
  }, []);
  const secureLocalSet = useCallback(async (name, value) => {
    await sset(name, value);
  }, []);
  const persistSensitiveCache = useCallback(async (name, value) => {
    if (authEnabled && sessionRef.current?.user?.id && !guestMode) {
      try { localStorage.removeItem(name); } catch {}
      return;
    }
    await secureLocalSet(name, value);
  }, [guestMode, secureLocalSet]);
  const migrateLocalPlaintext = useCallback(async () => {
    const keys = ["rh_profile", "rh_answers", "rh_plan", "rh_progress", "rh_journal", "rh_chats", "rh_memories"];
    for (const name of keys) {
      const raw = await sget(name);
      if (raw && !isEncrypted(raw)) {
        await secureLocalSet(name, raw);
        try { localStorage.removeItem(name); } catch {}
      }
    }
  }, [secureLocalSet]);
  const unlockPrivacyVault = useCallback(async (secret, useRecovery = false) => {
    // Keep the cryptographic step separate from account synchronisation. A
    // missing migration, offline Supabase request, or legacy local-data issue
    // must not turn a valid passphrase into a misleading "wrong passphrase"
    // error or trap the user on the locked screen.
    let unlocked;
    try {
      unlocked = await unlockUserVault(vaultMeta, secret, useRecovery);
    } catch {
      throw new Error("That passphrase or recovery key did not unlock your private data.");
    }
    setVaultKey(unlocked.dataKey); vaultKeyRef.current = unlocked.dataKey; vaultRawKeyRef.current = unlocked.rawDataKey;
    setUserPublicKey(unlocked.userPublicKey); userPublicKeyRef.current = unlocked.userPublicKey;
    setUserPrivateKey(unlocked.userPrivateKey); userPrivateKeyRef.current = unlocked.userPrivateKey;
    await sset(vaultMetaStorageKey(sessionRef.current?.user?.id), vaultMeta);
    if (authEnabled && supabase && sessionRef.current?.user?.id) {
      try {
        const { error: metaError } = await supabase.from("member_data").upsert({
          user_id: sessionRef.current.user.id,
          encryption_meta: vaultMeta,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
        if (metaError) console.warn("Vault unlocked locally; account metadata sync needs attention.", metaError);
      } catch (e) { console.warn("Vault unlocked locally; account metadata sync needs attention.", e); }
    }
    try { await migrateLocalPlaintext(); } catch (e) { console.warn("Vault unlocked; local data migration will retry later.", e); }
    setVaultStatus("unlocked");
    return true;
  }, [vaultMeta, migrateLocalPlaintext]);
  const createPrivacyVault = useCallback(async (passphrase) => {
    const created = await createUserVault(passphrase);
    setVaultMeta(created.meta); setVaultKey(created.dataKey); vaultKeyRef.current = created.dataKey; vaultRawKeyRef.current = created.rawDataKey;
    setUserPublicKey(created.userPublicKey); userPublicKeyRef.current = created.userPublicKey;
    setUserPrivateKey(created.userPrivateKey); userPrivateKeyRef.current = created.userPrivateKey;
    await sset(vaultMetaStorageKey(sessionRef.current?.user?.id), created.meta);
    if (authEnabled && supabase && sessionRef.current?.user?.id) {
      const { error: metaError } = await supabase.from("member_data").upsert({
        user_id: sessionRef.current.user.id,
        encryption_meta: created.meta,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (metaError) throw metaError;
    }
    await migrateLocalPlaintext();
    setVaultStatus("unlocked");
    return created.recoveryKey;
  }, [migrateLocalPlaintext]);

  const setDeviceUnlockPreference = useCallback(async (enabled) => {
    const next = Boolean(enabled);
    setDeviceUnlockEnabled(next);
    await sset("rh_device_unlock_enabled", next);
    if (next && vaultRawKeyRef.current) await enableDeviceUnlock(vaultRawKeyRef.current);
    if (!next) await disableDeviceUnlock();
  }, []);

  const startFreshVaultAfterLossConfirmation = useCallback(async () => {
    const uid = sessionRef.current?.user?.id;
    // This path is only exposed after the missing-metadata warning and an
    // explicit typed confirmation. It intentionally discards ciphertext that
    // cannot be decrypted, then starts a genuinely new empty vault.
    try {
      if (authEnabled && supabase && uid) {
        await supabase.from("member_data").update({ profile: null, answers: null, plan: null, progress: {}, journal: [], encryption_meta: null, updated_at: new Date().toISOString() }).eq("user_id", uid);
      }
    } catch (e) { throw new Error("We couldn't reset the unrecoverable vault just now. Nothing was changed."); }
    try { localStorage.removeItem(vaultMetaStorageKey(uid)); localStorage.removeItem("rh_vault_meta"); } catch {}
    setVaultMeta(null); setVaultKey(null); vaultKeyRef.current = null; vaultRawKeyRef.current = null;
    setUserPublicKey(null); userPublicKeyRef.current = null; setUserPrivateKey(null); userPrivateKeyRef.current = null;
    setVaultStatus("needs_setup");
  }, []);

  const exportVaultRecoveryPackage = useCallback(() => {
    if (!vaultMeta || vaultMeta.v !== 1) throw new Error("Unlock your private vault before creating a recovery package.");
    const payload = {
      format: "resilience-hub-vault-recovery",
      version: 1,
      exportedAt: new Date().toISOString(),
      userId: sessionRef.current?.user?.id || null,
      // This is wrapped metadata only. It does not contain the passphrase or raw data key.
      encryption_meta: vaultMeta,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `resilience-hub-vault-recovery-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [vaultMeta]);

  // Every internal screen starts at the top. The second reset catches pages
  // whose content finishes mounting after the route state changes.
  useEffect(() => {
    if (screen === "welcome") return;
    const reset = () => window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    reset();
    const frame = requestAnimationFrame(reset);
    return () => cancelAnimationFrame(frame);
  }, [screen]);

  // Phones can discard and recreate the PWA while it is in the background.
  // Keep only navigation state (never private content) so returning from another
  // app can restore the screen the person was using.
  useEffect(() => {
    if (!dataHydrated || !RESTORABLE_SCREENS.has(screen)) return;
    try {
      sessionStorage.setItem(LAST_SCREEN_STORAGE_KEY(session?.user?.id), JSON.stringify({
        screen,
        char: screen === "chat" ? activeChar : null,
        savedAt: Date.now(),
      }));
    } catch {}
  }, [dataHydrated, screen, activeChar, session?.user?.id]);

  useEffect(() => {
    routeHydratedRef.current = false;
  }, [session?.user?.id, vaultStatus]);

  // A normal app switch only changes visibility and keeps the route. A genuine
  // page exit (closing the tab/PWA or navigating away) clears the temporary
  // route so a fresh launch starts at the Hub.
  useEffect(() => {
    const clearRouteOnExit = (event) => {
      if (event?.persisted) return;
      try { sessionStorage.removeItem(LAST_SCREEN_STORAGE_KEY(session?.user?.id)); } catch {}
    };
    window.addEventListener("pagehide", clearRouteOnExit);
    window.addEventListener("beforeunload", clearRouteOnExit);
    return () => {
      window.removeEventListener("pagehide", clearRouteOnExit);
      window.removeEventListener("beforeunload", clearRouteOnExit);
    };
  }, [session?.user?.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (authEnabled && !session) { setVaultStatus("checking"); return; }
      try {
        const scopedKey = vaultMetaStorageKey(session?.user?.id);
        const scopedLocalMeta = await sget(scopedKey);
        const legacyLocalMeta = await sget("rh_vault_meta");
        const localMeta = scopedLocalMeta || legacyLocalMeta;
        if (!scopedLocalMeta && legacyLocalMeta?.v === 1) await sset(scopedKey, legacyLocalMeta);
        if (!authEnabled || !session || !supabase) {
          if (localMeta?.v === 1 && !cancelled) { setVaultMeta(localMeta); setVaultStatus("locked"); }
          else if (!cancelled) setVaultStatus("needs_setup");
          return;
        }

        const { data: baseData, error } = await supabase.from("member_data")
          .select("encryption_meta,profile,answers,plan,progress,journal")
          .eq("user_id", session.user.id).maybeSingle();
        if (cancelled) return;
        if (error) {
          // Fail closed only when the account itself cannot be read. Optional
          // Journal PIN columns must not turn a clean account into a vault
          // lockout when the migration has not yet been run.
          if (localMeta?.v === 1) { setVaultMeta(localMeta); setVaultStatus("locked"); }
          else setVaultStatus("account_vault_unavailable");
          return;
        }
        let data = baseData || null;
        const { data: pinData } = await supabase.from("member_data")
          .select("journal_pin_hash,journal_pin_question,journal_pin_answer_hash")
          .eq("user_id", session.user.id).maybeSingle();
        if (pinData) data = { ...(data || {}), ...pinData };

        if (data?.journal_pin_hash) { setJournalPinHash(data.journal_pin_hash); setJournalPinQuestion(data.journal_pin_question || ""); setJournalPinAnswerHash(data.journal_pin_answer_hash || null); setJournalPinSet(true); }
        setAccountData(data || null);
        const remoteMeta = data?.encryption_meta;
        // On the device where this vault was originally created, prefer its
        // account-scoped local metadata. It is the metadata that matches the
        // encrypted local cache. On a new device there is no local copy, so the
        // account record remains the source of truth.
        // For authenticated accounts, Supabase is authoritative. Old encrypted
        // values left in this browser must not turn a clean/plain account back
        // into a vault lockout after migration or browser restoration.
        const hasServerEncryptedData = ["profile", "answers", "plan", "progress", "journal"]
          .some((field) => isEncrypted(data?.[field]));
        const hasLegacyEncryptedData = hasServerEncryptedData;
        const preferredMeta = remoteMeta?.v === 1 ? remoteMeta : (hasServerEncryptedData && localMeta?.v === 1 ? localMeta : null);
        if (preferredMeta?.v === 1) {
          await sset(vaultMetaStorageKey(session.user.id), preferredMeta);
          if (!cancelled) { setVaultMeta(preferredMeta); setVaultStatus("locked"); }
          return;
        }
        if (localMeta?.v === 1 && hasLegacyEncryptedData) {
          // Older builds may have created a local vault before metadata syncing
          // existed. Let the original device unlock it, then repair the account
          // metadata through unlockPrivacyVault. A brand-new account does not
          // inherit another account's stale device metadata.
          setVaultMeta(localMeta); setVaultStatus("locked");
          return;
        }
        // No encrypted account data means this is a new/plain-mode account.
        // Do not show the old vault setup gate.
        setVaultStatus(hasLegacyEncryptedData ? "account_vault_missing" : "plain");
      } catch {
        if (!cancelled) setVaultStatus("account_vault_unavailable");
      }
    })();
    return () => { cancelled = true; };
  }, [session]);

  useEffect(() => {
    if (authChecked && vaultStatus !== "checking") setReady(true);
  }, [authChecked, vaultStatus]);

  useEffect(() => {
    if (vaultStatus !== "unlocked" && vaultStatus !== "plain") setDataHydrated(false);
  }, [vaultStatus, session]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const enabled = (await sget("rh_device_unlock_enabled")) === true;
      if (cancelled) return;
      setDeviceUnlockEnabled(enabled);
      if (!enabled || vaultStatus !== "locked" || !vaultMeta) return;
      const unlocked = await unlockWithDevice(vaultMeta);
      if (cancelled || !unlocked) return;
      setVaultKey(unlocked.dataKey); vaultKeyRef.current = unlocked.dataKey; vaultRawKeyRef.current = unlocked.rawDataKey;
      setUserPublicKey(unlocked.userPublicKey); userPublicKeyRef.current = unlocked.userPublicKey;
      setUserPrivateKey(unlocked.userPrivateKey); userPrivateKeyRef.current = unlocked.userPrivateKey;
      setVaultStatus("unlocked");
    })();
    return () => { cancelled = true; };
  }, [vaultStatus, vaultMeta]);

  useEffect(() => {
    (async () => {
      const memOn = await sget("rh_memory_on");
      if (typeof memOn === "boolean") setMemoryOn(memOn);
      const ts = await sget("rh_text_scale");
      if (typeof ts === "number" && ts >= 0.8 && ts <= 1.4) setTextScale(ts);
      const rm = await sget("rh_reduce_motion");
      if (typeof rm === "boolean") setReduceMotion(rm);
      const rs = await sget("rh_response_speed");
      if (rs === "chilled" || rs === "normal" || rs === "fast") setResponseSpeed(rs);
      const oldAuto = await sget("rh_auto_voice");
      const ai = await sget("rh_auto_intro_voice");
      const ar = await sget("rh_auto_reply_voice");
      const introOn = typeof ai === "boolean" ? ai : (typeof oldAuto === "boolean" ? oldAuto : true);
      const replyOn = typeof ar === "boolean" ? ar : (typeof oldAuto === "boolean" ? oldAuto : true);
      setAutoIntroVoiceOn(introOn); setAutoReplyVoiceOn(replyOn);
      __autoIntroVoiceOn = introOn; __autoReplyVoiceOn = replyOn;
      const savedUiLanguage = await sget("rh_ui_language");
      if (isUiLanguage(savedUiLanguage)) {
        const language = getUiLanguage(savedUiLanguage);
        setUiLanguage(language.code); setSpeechLang(language.speechCode); __speechLang = language.speechCode;
      } else {
        const sl = await sget("rh_speech_lang");
        if (sl && SPEECH_LANGS.some((l) => l.code === sl)) { setSpeechLang(sl); __speechLang = sl; }
      }
      const savedJournalPin = await sget(JOURNAL_PIN_STORAGE_KEY);
      if (savedJournalPin?.hash) setJournalPinSet(true);
      const consent = await sget("rh_consent");
      if (consent) setConsented(true);
      const tracking = await sget(ACTIVITY_PREF_KEY);
      setActivityTrackingOn(tracking !== false);
    })();
  }, []);

  useEffect(() => {
    if (vaultStatus !== "unlocked" && vaultStatus !== "plain") return;
    (async () => {
      const [p, a, pl, pr, j, c, mem] = await Promise.all([
        secureLocalGet("rh_profile"), secureLocalGet("rh_answers"), secureLocalGet("rh_plan"),
        secureLocalGet("rh_progress"), secureLocalGet("rh_journal"), secureLocalGet("rh_chats"), secureLocalGet("rh_memories"),
      ]);
      const plain = vaultStatus === "plain" ? accountData : null;
      const remoteFirst = Boolean(authEnabled && session?.user?.id && !guestMode && vaultStatus === "plain");
      const resolvedProfile = remoteFirst ? plain?.profile : (p || plain?.profile);
      const resolvedAnswers = remoteFirst ? plain?.answers : (a || plain?.answers);
      const resolvedPlan = remoteFirst ? plain?.plan : (pl || plain?.plan);
      const resolvedProgress = remoteFirst ? plain?.progress : (pr || plain?.progress);
      const resolvedJournal = remoteFirst ? plain?.journal : (j || plain?.journal);
      const resolvedChats = remoteFirst ? plain?.chats : (c || plain?.chats);
      const resolvedMemories = remoteFirst ? plain?.memories : (mem || plain?.memories);
      let pendingAuthLanguage = null;
      try {
        const pending = JSON.parse(sessionStorage.getItem(PENDING_AUTH_LANGUAGE_KEY) || "\"\"");
        pendingAuthLanguage = isUiLanguage(pending) ? pending : null;
      } catch {}
      if (resolvedProfile) {
        const hydratedProfile = pendingAuthLanguage ? { ...resolvedProfile, uiLanguage: pendingAuthLanguage } : resolvedProfile;
        setProfile(hydratedProfile);
        if (isUiLanguage(hydratedProfile.uiLanguage)) {
          const language = getUiLanguage(hydratedProfile.uiLanguage);
          setUiLanguage(language.code); setSpeechLang(language.speechCode); __speechLang = language.speechCode;
        }
        if (hydratedProfile.planPath === "short" || hydratedProfile.planPath === "full") setOnbMode(hydratedProfile.planPath);
        if (pendingAuthLanguage && pendingAuthLanguage !== resolvedProfile.uiLanguage) void syncMemberData({ profile: hydratedProfile });
      }
      if (pendingAuthLanguage) { try { sessionStorage.removeItem(PENDING_AUTH_LANGUAGE_KEY); } catch {} }
      if (resolvedAnswers) setAnswers(resolvedAnswers);
      if (resolvedPlan) setPlan(resolvedPlan);
      if (resolvedProgress) setProgress(resolvedProgress);
      if (resolvedJournal) setJournal(resolvedJournal);
      if (resolvedChats) setChats(resolvedChats);
      if (Array.isArray(resolvedMemories)) setMemories(resolvedMemories);
      if (remoteFirst) {
        for (const key of ["rh_profile", "rh_answers", "rh_plan", "rh_progress", "rh_journal", "rh_chats", "rh_memories"]) {
          try { localStorage.removeItem(key); } catch {}
        }
      }
      if (supabase) {
        try {
          const { data } = await supabase.from("game_scores").select("game,best");
          const map = {}; (data || []).forEach((r) => { map[r.game] = Number(r.best); });
          gameScoresRef.current = map; setGameScores(map);
        } catch {}
        try {
          const { data: prog } = await supabase.from("game_progress").select("game,state");
          const pm = {}; (prog || []).forEach((r) => { pm[r.game] = r.state; });
          gameProgressRef.current = pm;
        } catch {}
      }
      if (supabase) {
        try {
          const { data } = await supabase.from("guide_prompts").select("slug,notes");
          if (data?.length) { const merged = { ...PERSONALITY_DEFAULTS }; data.forEach((r) => { if (r.slug && typeof r.notes === "string") merged[r.slug] = r.notes; }); setGuidePrompts(merged); }
        } catch {}
      }
      let returnToChaptly = false;
      try {
        returnToChaptly = sessionStorage.getItem("rh_return_to_chaptly") === "1";
        if (returnToChaptly) sessionStorage.removeItem("rh_return_to_chaptly");
      } catch {}
      let savedRoute = null;
      if (!routeHydratedRef.current && !returnToChaptly) {
        try {
          const rawRoute = sessionStorage.getItem(LAST_SCREEN_STORAGE_KEY(session?.user?.id));
          const parsedRoute = rawRoute ? JSON.parse(rawRoute) : null;
          const isRecent = parsedRoute?.savedAt && Date.now() - parsedRoute.savedAt < 7 * 24 * 60 * 60 * 1000;
          if (isRecent && RESTORABLE_SCREENS.has(parsedRoute.screen)) savedRoute = parsedRoute;
        } catch {}
      }
      if (!routeHydratedRef.current) {
        if (returnToChaptly) setScreen("chaptly");
        else if (savedRoute) {
          if (savedRoute.screen === "chat" && CHARS[savedRoute.char]) setActiveChar(savedRoute.char);
          setScreen(savedRoute.screen);
        } else if (resolvedProfile?.onboardingComplete) setScreen("hub");
        else if (resolvedProfile?.path === "full") setScreen("onboarding");
        else setScreen("welcome");
        routeHydratedRef.current = true;
      }
      setDataHydrated(true);
    })();
  }, [vaultStatus, secureLocalGet, accountData]);

  // Save the local-only fields, PLUS push to the person's account when signed in,
  // so profile/plan/journal properly follow them between devices instead of only
  // ever living in this browser (this was the actual gap behind two bugs: journal
  // and plan data not surviving a device switch, and "onboarding complete" not
  // being recognised on a fresh sign-in — e.g. after a Google OAuth redirect —
  // because it was only ever checked against local storage).
  const syncMemberData = useCallback(async (patch) => {
    if (!authEnabled || !supabase || !sessionRef.current) return;
    if (vaultStatus === "unlocked" && vaultKeyRef.current) {
      const encryptedPatch = {};
      for (const [field, value] of Object.entries(patch)) encryptedPatch[field] = await encryptJson(value, vaultKeyRef.current, `member_data.${field}`);
      await supabase.from("member_data").upsert({ user_id: sessionRef.current.user.id, ...encryptedPatch, updated_at: new Date().toISOString() });
    } else {
      await supabase.from("member_data").upsert({ user_id: sessionRef.current.user.id, ...patch, encryption_meta: null, updated_at: new Date().toISOString() });
    }
  }, [vaultStatus]);
  const saveProfile = useCallback((p) => {
    setProfile((current) => {
      const requestedLanguage = isUiLanguage(p?.uiLanguage) ? p.uiLanguage : null;
      const existingLanguage = isUiLanguage(current?.uiLanguage) ? current.uiLanguage : null;
      const merged = { ...(current || {}), ...(p || {}), uiLanguage: requestedLanguage || existingLanguage || __uiLanguage };
      void persistSensitiveCache("rh_profile", merged);
      void syncMemberData({ profile: merged });
      // Onboarding stores the user's introduction in member_data.profile.name.
      // Keep the admin-facing profiles row in sync so new members do not appear
      // as "Unnamed member" in the Members directory.
      const introducedName = String(p?.name || "").trim();
      const account = sessionRef.current?.user;
      if (introducedName && authEnabled && supabase && account?.id) {
        void supabase.from("profiles").upsert({
          id: account.id,
          preferred_name: introducedName,
          updated_at: new Date().toISOString(),
        }, { onConflict: "id" });
      }
      return merged;
    });
  }, [persistSensitiveCache, syncMemberData]);
  const saveUiLanguage = useCallback((nextCode) => {
    if (!isUiLanguage(nextCode)) return;
    const language = getUiLanguage(nextCode);
    setUiLanguage(language.code); __uiLanguage = language.code;
    setSpeechLang(language.speechCode); __speechLang = language.speechCode;
    void sset("rh_ui_language", language.code);
    void sset("rh_speech_lang", language.speechCode);
    saveProfile({ uiLanguage: language.code });
  }, [saveProfile]);
  const selectAuthLanguage = useCallback((nextCode) => {
    if (!isUiLanguage(nextCode)) return;
    const language = getUiLanguage(nextCode);
    setUiLanguage(language.code); __uiLanguage = language.code;
    setSpeechLang(language.speechCode); __speechLang = language.speechCode;
    void sset("rh_ui_language", language.code);
    void sset("rh_speech_lang", language.speechCode);
    // This survives the current sign-in flow (including a Google redirect), then
    // is written to the authenticated profile once the account has loaded.
    try { sessionStorage.setItem(PENDING_AUTH_LANGUAGE_KEY, JSON.stringify(language.code)); } catch {}
  }, []);
  useEffect(() => {
    // A new account can finish onboarding before sessionRef is populated. Once
    // the account and member data are hydrated, make one reliable follow-up
    // write to the profile row used by the Admin Members directory. Signup
    // metadata is the fallback for accounts that have not reached onboarding.
    const account = session?.user;
    const metadataName = account?.user_metadata?.preferred_name || account?.user_metadata?.full_name || account?.user_metadata?.name || "";
    const profileName = String(profile?.name || "").trim();
    const introducedName = profileName && profileName.toLowerCase() !== "friend" ? profileName : String(metadataName).trim();
    if (!introducedName || !authEnabled || !supabase || !account?.id) return;
    void supabase.from("profiles").upsert({
      id: account.id,
      preferred_name: introducedName,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });
  }, [profile?.name, session?.user?.id]);
  const saveAnswers = useCallback((a) => { setAnswers(a); void persistSensitiveCache("rh_answers", a); void syncMemberData({ answers: a }); }, [persistSensitiveCache, syncMemberData]);
  const persistCampfireAccess = useCallback(async (value) => {
    if (!supabase || !sessionRef.current) return;
    const accessSpace = Number(value) === 0 ? "mens" : Number(value) === 1 ? "ladies" : null;
    if (!accessSpace) return;
    await supabase.from("campfire_access").insert({ user_id: sessionRef.current.user.id, access_space: accessSpace });
  }, []);
  useEffect(() => {
    const value = answers?.campfire_access ?? profile?.campfireAccess;
    if (session?.user?.id && (Number(value) === 0 || Number(value) === 1)) void persistCampfireAccess(value);
  }, [session?.user?.id, answers?.campfire_access, profile?.campfireAccess, persistCampfireAccess]);
  const savePlan = useCallback((pl) => {
    if (pl && !pl.startedAt) pl.startedAt = Date.now();
    const cleanProgress = {};
    setPlan(pl); void persistSensitiveCache("rh_plan", pl);
    setProgress(cleanProgress); void persistSensitiveCache("rh_progress", cleanProgress);
    void syncMemberData({ plan: pl, progress: cleanProgress });
  }, [persistSensitiveCache, syncMemberData]);
  const saveProgress = useCallback((pr) => { setProgress(pr); void persistSensitiveCache("rh_progress", pr); void syncMemberData({ progress: pr }); }, [persistSensitiveCache, syncMemberData]);
  const saveJournal = useCallback((j) => { setJournal(j); void persistSensitiveCache("rh_journal", j); void syncMemberData({ journal: j }); }, [persistSensitiveCache, syncMemberData]);
  const saveChats = useCallback((c) => { setChats(c); void persistSensitiveCache("rh_chats", c); }, [persistSensitiveCache]);

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
    void persistSensitiveCache("rh_memories", clean); sset("rh_memory_on", memoryOnRef.current);
    if (authEnabled && supabase && sessionRef.current && vaultKeyRef.current) {
      void (async () => {
        const encrypted = await encryptJson(clean, vaultKeyRef.current, "guide_memory.memories");
        await supabase.from("guide_memory").upsert({
          user_id: sessionRef.current.user.id, memories: encrypted, enabled: memoryOnRef.current,
          updated_at: new Date().toISOString(),
        });
      })();
    }
  }, [persistSensitiveCache]);

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
    void persistSensitiveCache("rh_chats", next);
    // Plain authenticated accounts do not have a vault key. They still need
    // their chat saved remotely because persistSensitiveCache intentionally
    // removes the local account cache while signed in.
    if (authEnabled && supabase && sessionRef.current) {
      void (async () => {
        const savedMessages = vaultKeyRef.current
          ? await encryptJson(messages, vaultKeyRef.current, `chat_history.${slug}`)
          : messages;
        await supabase.from("chat_history").upsert({
          user_id: sessionRef.current.user.id, character: slug, messages: savedMessages,
          updated_at: new Date().toISOString(),
        });
      })();
    }
  }, [persistSensitiveCache]);

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

  const saveSettings = useCallback(({ textScale: ts, reduceMotion: rm, responseSpeed: rs, speechLang: sl, uiLanguage: ul, autoIntroVoice: ai, autoReplyVoice: ar, activityTracking: at }) => {
    if (typeof ts === "number") { setTextScale(ts); sset("rh_text_scale", ts); }
    if (typeof rm === "boolean") { setReduceMotion(rm); sset("rh_reduce_motion", rm); }
    if (rs === "chilled" || rs === "normal" || rs === "fast") { setResponseSpeed(rs); sset("rh_response_speed", rs); }
    if (isUiLanguage(ul)) { saveUiLanguage(ul); }
    if (sl && SPEECH_LANGS.some((l) => l.code === sl)) { setSpeechLang(sl); __speechLang = sl; sset("rh_speech_lang", sl); }
    if (typeof ai === "boolean") { setAutoIntroVoiceOn(ai); __autoIntroVoiceOn = ai; sset("rh_auto_intro_voice", ai); }
    if (typeof ar === "boolean") { setAutoReplyVoiceOn(ar); __autoReplyVoiceOn = ar; sset("rh_auto_reply_voice", ar); }
    if (typeof at === "boolean") { setActivityTrackingOn(at); sset(ACTIVITY_PREF_KEY, at); }
  }, [saveUiLanguage]);

  const setJournalPin = useCallback(async (pin, question, answer) => {
    const hash = await hashJournalPin(pin);
    const answerHash = await hashJournalPinAnswer(question, answer);
    const record = { hash, question: String(question).trim(), answerHash, createdAt: Date.now() };
    await sset(JOURNAL_PIN_STORAGE_KEY, record);
    setJournalPinHash(hash); setJournalPinQuestion(record.question); setJournalPinAnswerHash(answerHash);
    setJournalPinSet(true); setJournalUnlocked(true);
    await syncMemberData({ journal_pin_hash: hash, journal_pin_question: record.question, journal_pin_answer_hash: answerHash });
  }, [syncMemberData]);

  const clearJournalPin = useCallback(async () => {
    try { localStorage.removeItem(JOURNAL_PIN_STORAGE_KEY); } catch {}
    setJournalPinSet(false); setJournalPinHash(null); setJournalPinQuestion(""); setJournalPinAnswerHash(null); setJournalUnlocked(false);
    await syncMemberData({ journal_pin_hash: null, journal_pin_question: null, journal_pin_answer_hash: null });
  }, [syncMemberData]);

  const restoreDefaultSettings = useCallback(() => {
    setTextScale(1); setReduceMotion(false); setResponseSpeed("normal"); setAutoIntroVoiceOn(true); setAutoReplyVoiceOn(true); __autoIntroVoiceOn = true; __autoReplyVoiceOn = true;
    sset("rh_text_scale", 1); sset("rh_reduce_motion", false); sset("rh_response_speed", "normal"); sset("rh_auto_intro_voice", true); sset("rh_auto_reply_voice", true);
    saveUiLanguage(DEFAULT_UI_LANGUAGE);
  }, [saveUiLanguage]);

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
  const clearLocalDeviceCache = (accountId = sessionRef.current?.user?.id) => {
    // Preserve the wrapped vault metadata. It contains no plaintext and is
    // required to unlock encrypted data after the next login. Migrate the old
    // unscoped key before clearing it, so legacy accounts are not stranded.
    try {
      const legacyMeta = localStorage.getItem("rh_vault_meta");
      if (accountId && legacyMeta) localStorage.setItem(vaultMetaStorageKey(accountId), legacyMeta);
      if (accountId) localStorage.removeItem("rh_vault_meta");
    } catch {}
    for (const k of ["rh_profile", "rh_answers", "rh_plan", "rh_progress", "rh_journal", "rh_chats", "rh_memories", "rh_memory_on", JOURNAL_PIN_STORAGE_KEY]) {
      try { localStorage.removeItem(k); } catch {}
    }
    try {
      sessionStorage.removeItem(LAST_SCREEN_STORAGE_KEY(accountId));
      sessionStorage.removeItem(LAST_SCREEN_STORAGE_KEY());
    } catch {}
    routeHydratedRef.current = false;
    setProfile(null); setAnswers({}); setPlan(null); setProgress({});
    setJournal([]); setChats({}); chatsRef.current = {};
    setMemories([]); memoriesRef.current = [];
    setVaultMeta(null); setVaultKey(null); vaultKeyRef.current = null; vaultRawKeyRef.current = null;
    setUserPublicKey(null); userPublicKeyRef.current = null; setUserPrivateKey(null); userPrivateKeyRef.current = null;
    setJournalPinSet(false); setJournalUnlocked(false);
  };

  const resetAll = async () => {
    const accountId = sessionRef.current?.user?.id;
    clearLocalDeviceCache(accountId);
    setOnbFromSignup(false); setPlanSignupLanding(false); setOnbMode("full"); setOnbReturn("hub");
    histRef.current = [];
    if (authEnabled && supabase && sessionRef.current) {
      const uid = sessionRef.current.user.id;
      try { await supabase.from("chat_history").delete().eq("user_id", uid); } catch {}
      try { await supabase.from("guide_memory").delete().eq("user_id", uid); } catch {}
      try { await supabase.from("coordinator_messages").delete().eq("user_id", uid); } catch {}
      try { await supabase.from("bug_reports").delete().eq("user_id", uid); } catch {}
      try { await supabase.from("game_progress").delete().eq("user_id", uid); } catch {}
      try { await supabase.from("push_subscriptions").delete().eq("user_id", uid); } catch {}
      try {
        const { data: files } = await supabase.storage.from("bug-screenshots").list(uid, { limit: 1000 });
        const paths = (files || []).map((f) => `${uid}/${f.name}`);
        if (paths.length) await supabase.storage.from("bug-screenshots").remove(paths);
      } catch {}
      try {
        // Reset the user's encrypted content, but retain encryption_meta so the
        // same privacy vault remains unlockable after the reset.
        await supabase.from("member_data").update({ profile: null, answers: null, plan: null, progress: {}, journal: [], updated_at: new Date().toISOString() }).eq("user_id", uid);
      } catch {}
      try {
        // Profile details live in their own public profile row, separate from
        // member_data. Clear the editable identity fields but keep the account
        // row and email association intact.
        await supabase.from("profiles").update({ preferred_name: "", pronouns: "", bio: "", avatar: "", updated_at: new Date().toISOString() }).eq("id", uid);
      } catch {}
      try {
        await supabase.from("private_contact").delete().eq("id", uid);
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
      // Vault users decrypt the rows; plain authenticated users store/read the
      // same rows as ordinary JSON. Both modes must load chat history after a
      // reload, otherwise the initial empty state can replace the visible chat.
      if (!authEnabled || !supabase || !session || !["unlocked", "plain"].includes(vaultStatus)) return;
      try {
        const { data } = await supabase.from("chat_history")
          .select("character,messages").eq("user_id", session.user.id);
        const fresh = {};
        const legacyChats = [];
        for (const row of data || []) {
          try {
            fresh[row.character] = vaultKeyRef.current
              ? await decryptJson(row.messages, vaultKeyRef.current, `chat_history.${row.character}`)
              : (Array.isArray(row.messages) ? row.messages : []);
          }
          catch { if (Array.isArray(row.messages)) { fresh[row.character] = row.messages; legacyChats.push([row.character, row.messages]); } else fresh[row.character] = []; }
        }
        // Only encrypted-vault rows that predate encryption need migration.
        for (const [character, messages] of legacyChats) if (vaultKeyRef.current) void saveCharChat(character, messages);
        chatsRef.current = fresh;
        setChats(fresh);
      } catch {}
      // Load long-term "about me" memory + on/off setting
      try {
        const { data } = await supabase.from("guide_memory")
          .select("memories,enabled").eq("user_id", session.user.id).single();
        let list = []; let legacyMemory = false;
        try { list = await decryptJson(data?.memories, vaultKeyRef.current, "guide_memory.memories"); }
        catch { if (Array.isArray(data?.memories)) { list = data.memories; legacyMemory = true; } }
        if (!Array.isArray(list)) list = [];
        if (legacyMemory) void saveMemories(list);
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
          const cloud = {}; const legacyCloud = {};
          for (const field of ["profile", "answers", "plan", "progress", "journal"]) {
            if (data[field] == null) continue;
            try { cloud[field] = await decryptJson(data[field], vaultKeyRef.current, `member_data.${field}`); }
            catch { if (!isEncrypted(data[field])) { cloud[field] = data[field]; legacyCloud[field] = data[field]; } else cloud[field] = null; }
          }
          if (Object.keys(legacyCloud).length) void syncMemberData(legacyCloud);
          if (cloud.profile) setProfile(cloud.profile);
          if (cloud.answers) setAnswers(cloud.answers);
          if (cloud.plan) setPlan(cloud.plan);
          if (cloud.progress) setProgress(cloud.progress);
          if (Array.isArray(cloud.journal)) setJournal(cloud.journal);
          if (data.journal_pin_hash) {
            await sset(JOURNAL_PIN_STORAGE_KEY, { hash: data.journal_pin_hash, createdAt: Date.now(), accountSynced: true });
            setJournalPinSet(true); setJournalUnlocked(false);
          }
          if (cloud.profile?.onboardingComplete) setScreen((s) => (s === "welcome" ? "hub" : s));
        } else {
          // No account row yet — either a brand-new member, or someone who used
          // the app before this was built and only has local data. If there's
          // local data sitting on this device, push it up once so it's not lost.
          const [lp, la, lpl, lpr, lj] = await Promise.all([
            secureLocalGet("rh_profile"), secureLocalGet("rh_answers"), secureLocalGet("rh_plan"), secureLocalGet("rh_progress"), secureLocalGet("rh_journal"),
          ]);
          if (lp || la || lpl || lpr || (lj && lj.length)) {
            await syncMemberData({ profile: lp || null, answers: la || null, plan: lpl || null, progress: lpr || {}, journal: lj || [] });
            for (const key of ["rh_profile", "rh_answers", "rh_plan", "rh_progress", "rh_journal"]) {
              try { localStorage.removeItem(key); } catch {}
            }
          }
        }
      } catch {}
    })();
  }, [session, vaultStatus, secureLocalGet, secureLocalSet, syncMemberData]);

  const histRef = useRef([]);
  const planOriginRef = useRef(false);
  const go = (s, ch) => {
    if (screen !== s) {
      histRef.current.push({ screen, char: activeChar });
      if (histRef.current.length > 30) histRef.current.shift();
    }
    __backDestinationLabel = screenBackLabel(screen);
    if (ch) setActiveChar(ch);
    setScreen(s);
  };
  const openProgram = () => {
    // The first plan welcome starts from ProgramPage's effect, which is after
    // the navigation tap. Prime iOS/Android audio and warm Carlos's exact
    // welcome while this tap still counts as a user gesture. The page effect
    // reuses the pending request/cache rather than issuing a duplicate call.
    if (voiceOn && __autoIntroVoiceOn) {
      try { primeAudio(); } catch {}
      try {
        const welcome = spokenIntro("plan", PROGRAM_WELCOME_TEXT, speechLang);
        const firstWelcomeChunk = splitForTts(welcome, 260)[0] || welcome;
        fetchTtsUrl(firstWelcomeChunk, CHARS.carlos.voiceId, speechLang, CHARS.carlos.voiceGender).catch(() => {});
      } catch {}
    }
    go("program");
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
    planOriginRef.current = false;
    __backDestinationLabel = "Home";
    setToolkitInitial(null);
    setScreen("toolkit");
  };
  const openPlanDestination = (screenName, toolKey = null) => {
    planOriginRef.current = true;
    if (toolKey) setToolkitInitial(toolKey);
    go(screenName);
  };
  const returnToPlan = () => {
    planOriginRef.current = false;
    histRef.current = [];
    setToolkitInitial(null);
    __backDestinationLabel = "Your 8-Week Plan";
    setScreen("program");
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
  const DEEP_LINK_SCREENS = ["notifications", "coordinator", "admin", "adminIntakes", "adminMessages", "adminBugReports", "adminAppointments"];
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
  const openTool = (k) => {
    setToolkitInitial(k);
    go("toolkit");
    tickToolTask(k);
  };

  const closePersistentMenu = useCallback(() => {
    setMenuOpen(false);
    setTimeout(() => menuTriggerRef.current?.focus(), 0);
  }, []);
  const shareApp = async () => {
    const url = typeof window !== "undefined" ? window.location.origin : "";
    const data = { title: "The Resilience Hub", text: "The Resilience Hub — you never have to walk it alone.", url };
    try {
      if (navigator.share) { await navigator.share(data); return; }
      await navigator.clipboard.writeText(url);
      setShareMsg("Link copied!"); setTimeout(() => setShareMsg(""), 2000);
    } catch { /* cancelled or blocked */ }
  };
  const requestCampfireChange = useCallback(async () => {
    if (!supabase || !session?.user?.id) throw new Error("Please sign in before contacting support.");
    const { error } = await supabase.from("coordinator_messages").insert({
      user_id: session.user.id,
      sender: "user",
      body: "Campfire selection change request: this member would like support to review whether their Campfire space can be changed.",
      recipient: "lisa",
      user_public_key_jwk: userPublicKey || null,
    });
    if (error) throw error;
    setMenuRefresh((key) => key + 1);
  }, [session, userPublicKey]);
  const unreadCount = useUnreadNotifications(showAuth ? session : null, menuRefresh);
  const unreadAdminMsgs = useUnreadAdminMessages(isAdmin, menuRefresh, session?.user?.email);
  const menuVisible = dataHydrated && consented && (!showAuth || Boolean(session)) && (vaultStatus === "unlocked" || vaultStatus === "plain");
  const menuButton = menuVisible ? (
    <button ref={menuTriggerRef} type="button" onClick={() => setMenuOpen(true)} aria-label="Open menu" aria-expanded={menuOpen} aria-controls="hub-main-menu"
      className="rh-menu-trigger" style={{ minHeight: 44, border: "1px solid rgba(46,133,120,0.30)", borderRadius: 15, padding: "0 13px", background: "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(225,244,236,0.94))", color: T.greenDk, boxShadow: "0 7px 18px rgba(39,101,79,0.11), inset 0 1px 0 rgba(255,255,255,0.92)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 850 }}>
      <MenuIcon size={18} strokeWidth={2.5} /><span>Menu</span><ChevronDown size={14} strokeWidth={2.5} aria-hidden="true" />
    </button>
  ) : null;
  const menuContext = { button: menuButton };

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

  const signOut = async () => { const accountId = sessionRef.current?.user?.id; try { await supabase.auth.signOut(); } catch {} clearLocalDeviceCache(accountId); setIsAdmin(false); setScreen("hub"); };

  return (
    <div ref={appRootRef} className={getUiLanguage(uiLanguage).rtl ? "rh-app-shell rh-app-rtl" : "rh-app-shell"} style={{ minHeight: "100vh", color: T.ink,
      background: "radial-gradient(110% 55% at 50% -10%, rgba(80,160,132,0.34), transparent 70%), radial-gradient(70% 42% at 8% 72%, rgba(215,232,199,0.28), transparent 72%), radial-gradient(70% 40% at 94% 82%, rgba(255,232,196,0.3), transparent 72%), linear-gradient(180deg, #06463f 0%, #0c5a4d 25%, #568a73 50%, #cbd9c4 74%, #f7f0df 100%)",
      backgroundAttachment: "fixed",
      fontFamily: "'Inter', 'Noto Sans Arabic', 'Noto Sans Devanagari', 'Noto Sans Bengali', 'Noto Sans Tamil', 'Noto Sans Malayalam', 'Noto Sans SC', 'Noto Sans TC', 'Segoe UI', system-ui, -apple-system, sans-serif" }}>
      <StyleTag />
      {reduceMotion && <style>{`*{animation:none!important;transition:none!important}`}</style>}
      <HubMenuContext.Provider value={menuContext}>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "0 16px 132px", position: "relative", zIndex: 1, zoom: textScale }}>
        {authEnabled && !authChecked ? (
          <div style={{ paddingTop: 120, textAlign: "center", color: T.sub }}>Loading…</div>
        ) : showAuth && !session ? (
          <Login stayLoggedIn={stayLoggedIn} onStayLoggedInChange={changeStayLoggedIn} uiLanguage={uiLanguage} onChangeUiLanguage={selectAuthLanguage} />
        ) : !ready ? (
          <div style={{ paddingTop: 120, textAlign: "center", color: T.sub }}>Warming up…</div>
        ) : !consented ? (
          <Consent onAgree={() => { sset("rh_consent", { agreedAt: Date.now() }); setConsented(true); }} />
        ) : vaultStatus !== "unlocked" && vaultStatus !== "plain" ? (
          <PrivacyVaultGate status={vaultStatus} onCreate={createPrivacyVault} onUnlock={unlockPrivacyVault} onStartFreshVault={startFreshVaultAfterLossConfirmation} deviceUnlockEnabled={deviceUnlockEnabled} onSetDeviceUnlock={setDeviceUnlockPreference} />
        ) : !dataHydrated ? (
          <div style={{ paddingTop: 120, textAlign: "center", color: T.sub }}>Warming up…</div>
        ) : screen === "welcome" ? (
          <Welcome
            voiceOn={voiceOn} setVoiceOn={setVoiceOn}
            onExplore={() => { saveProfile({ name: "friend", path: "testing", onboardingComplete: true }); go("hub"); }}
            onStart={() => { saveProfile({ name: "", path: "full", onboardingComplete: false }); go("planChoice"); }}
          />
        ) : screen === "intro" ? (
          <RexIntro voiceOn={voiceOn} speechLang={speechLang}
            onReady={() => { if (rexIntroReplay) { setRexIntroReplay(false); back(); } else go("planChoice"); }}
            onExit={rexIntroReplay ? () => { setRexIntroReplay(false); back(); } : null} />
        ) : screen === "rexTutorial" ? (
          <RexIntro voiceOn={voiceOn} speechLang={speechLang} standalone
            onReady={() => { histRef.current = []; __backDestinationLabel = "Home"; setScreen("hub"); }}
            onExit={() => { histRef.current = []; __backDestinationLabel = "Home"; setScreen("hub"); }} />
        ) : screen === "planChoice" ? (
          <PlanChoice voiceOn={voiceOn} speechLang={speechLang}
            onYes={() => { setOnbMode("full"); setOnbFromSignup(true); setOnbReturn("program"); saveProfile({ ...profile, planPath: "full" }); go("onboarding"); }}
            onNo={() => { setOnbMode("short"); setOnbFromSignup(true); setOnbReturn("hub"); saveProfile({ ...profile, planPath: "short" }); go("onboarding"); }} />
        ) : screen === "onboarding" ? (
          <Onboarding
            profile={profile} saveProfile={saveProfile} persistCampfireAccess={persistCampfireAccess}
            answers={answers} saveAnswers={saveAnswers}
            savePlan={savePlan} voiceOn={voiceOn} speechLang={speechLang}
            mode={onbMode}
            onBackToIntro={() => go("intro")}
            onSignOut={showAuth ? signOut : null}
            onDone={(result) => { const landing = Boolean(result?.createdPlan && onbFromSignup); setPlanSignupLanding(landing); setOnbFromSignup(false); go(result?.createdPlan ? "program" : onbReturn); }}
          />
        ) : screen === "hub" ? (
          <ScreenErrorBoundary onHome={() => setScreen("hub")}>
          <Hub
            profile={profile} plan={plan} progress={progress} saveProgress={saveProgress}
            journalCount={journal.length} voiceOn={voiceOn} setVoiceOn={setVoiceOn}
            onOpenChat={(slug) => go("chat", slug)}
            onOpenRexTutorial={() => go("rexTutorial")}
            onOpenProgram={openProgram}
            onOpenJournal={() => go("journal")}
            onOpenGuides={() => go("guides")}
            onOpenMerch={() => go("merch")}
            onOpenCarlosLibrary={() => go("carlosLibrary")}
            onOpenGames={() => go("games")}
            onOpenToolkit={() => { setToolkitInitial(null); go("toolkit"); }}
            onOpenResources={() => go("resources")}
            onOpenIntake={() => go("intake")}
            onOpenVirtualSupport={() => go("virtualSupport")}
            onOpenCampfire={() => go("campfire")}
            onOpenChaptly={() => go("chaptly")}
            onOpenSupportUs={() => go("supportUs")}
            onOpenSafety={() => openTool("safety")}
            onOpenNotifications={() => go("notifications")}
            onOpenCoordinator={() => go("coordinator")}
            onOpenMensGroup={() => go("mensGroup")}
            onOpenMensShed={() => go("mensShed")}
            onOpenAdminMessages={() => go("adminMessages")}
            onOpenProgramInfo={() => go("programInfo")}
            onOpenSettings={() => go("settings")}
            onNotificationsChanged={() => setMenuRefresh((k) => k + 1)}
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
          </ScreenErrorBoundary>
        ) : screen === "program" ? (
          <ProgramPage
            profile={profile} plan={plan} progress={progress} saveProgress={saveProgress}
            answers={answers} journalCount={journal.length} chats={chats}
            onSaveChat={saveCharChat} memories={memoryOn ? memories : []}
            onConversation={refreshMemory} voiceOn={voiceOn} setVoiceOn={setVoiceOn}
            responseSpeed={responseSpeed} speechLang={speechLang} onOpenTool={(key) => openPlanDestination("toolkit", key === "toolkit" ? null : key)} onOpenGames={() => openPlanDestination("games")}
            persona={guidePrompts.carlos ?? PERSONALITY_DEFAULTS.carlos}
            onOpenChat={(slug) => go("chat", slug)}
            onOpenJournal={() => openPlanDestination("journal")}
             onStartPlan={() => { setOnbMode("full"); setOnbFromSignup(false); setOnbReturn("program"); setPlanSignupLanding(false); go("onboarding"); }}
            isSignupLanding={planSignupLanding}
            onBack={openHubFromPlan}
          />
        ) : screen === "guides" ? (
          <GuidesPage voiceOn={voiceOn} speechLang={speechLang} onOpenChat={(slug) => go("chat", slug)} onBack={back} />
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
            responseSpeed={responseSpeed} speechLang={speechLang}
            onBack={back}
            onOpenTool={openTool}
            onReplayIntro={() => { setRexIntroReplay(true); go("intro"); }}
          />
                ) : screen === "journal" ? (
          journalPinSet && !journalUnlocked ? (
            <JournalPinGate journalPinHash={journalPinHash} onUnlock={() => setJournalUnlocked(true)} onBack={planOriginRef.current ? returnToPlan : back} />
          ) : (
            <Journal profile={profile} journal={journal} saveJournal={saveJournal} voiceOn={voiceOn}
              onBack={() => { setJournalUnlocked(false); planOriginRef.current ? returnToPlan() : back(); }} />
          )
        ) : screen === "toolkit" ? (
          <Toolkit voiceOn={voiceOn} speechLang={speechLang} initial={toolkitInitial} onUseTool={tickToolTask} onOpenJournal={() => { if (planOriginRef.current) openPlanDestination("journal"); else go("journal"); }} onOpenGames={() => go("games")} onBack={planOriginRef.current ? returnToPlan : back} />
        ) : screen === "resources" ? (
          <ResourcesPage voiceOn={voiceOn} speechLang={speechLang} onOpenSafety={() => openTool("safety")} onOpenMensShed={() => go("mensShed")} onOpenProgramInfo={() => go("programInfo")} onBack={back} />
        ) : screen === "intake" ? (
          <ProgramIntake session={session} profile={profile} onBack={back} onReturnToProgram={() => { histRef.current = []; __backDestinationLabel = "Home"; setScreen("programInfo"); setTimeout(() => document.getElementById("program-join-the-program")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80); }} />
        ) : screen === "virtualSupport" ? (
          <VirtualSupportPage onBack={back} />
        ) : screen === "campfire" ? (
          <CampfirePage onBack={back} campfireAccess={(() => {
            const answerAccess = answers?.campfire_access;
            const profileAccess = profile?.campfireAccess;
            const usable = (value) => value !== undefined && value !== null && String(value).trim() !== "";
            return usable(answerAccess) ? answerAccess : (usable(profileAccess) ? profileAccess : "");
          })()} voiceOn={voiceOn} speechLang={speechLang} />
        ) : screen === "chaptly" ? (
          <ChaptlyPage onBack={() => { histRef.current = []; __backDestinationLabel = "Home"; setScreen("hub"); }} />
        ) : screen === "supportUs" ? (
          <SupportUsPage onOpenMerch={() => go("merch")} onOpenCarlosLibrary={() => go("carlosLibrary")} onBack={back} />
        ) : screen === "adminIntakes" ? (
          isAdmin ? <AdminIntakes onBack={back} /> : <Admin isAdmin={isAdmin} guidePrompts={guidePrompts} onSaveGuidePrompt={saveGuidePrompt} onBack={back} />
        ) : screen === "admin" ? (
          <Admin isAdmin={isAdmin} guidePrompts={guidePrompts} onSaveGuidePrompt={saveGuidePrompt} onBack={back} />
        ) : screen === "profile" ? (
          <Profile session={session} profile={profile} answers={answers} saveProfile={saveProfile} saveAnswers={saveAnswers} persistCampfireAccess={persistCampfireAccess} onRequestCampfireChange={requestCampfireChange} uiLanguage={uiLanguage} onChangeUiLanguage={saveUiLanguage} onReset={resetAll} onOpenMemory={() => go("memory")} onBack={back} />
        ) : screen === "notifications" ? (
          <Notifications session={session} onBack={back} />
        ) : screen === "coordinator" ? (
          <CoordinatorChat session={session} userPublicKey={userPublicKey} userPrivateKey={userPrivateKey} onBack={back} />
        ) : screen === "adminMessages" ? (
          isAdmin ? <AdminInbox onBack={back} adminEmail={session?.user?.email} /> : <Admin isAdmin={isAdmin} guidePrompts={guidePrompts} onSaveGuidePrompt={saveGuidePrompt} onBack={back} />
        ) : screen === "adminBugReports" ? (
          isAdmin ? <AdminBugReports onBack={back} /> : <Admin isAdmin={isAdmin} guidePrompts={guidePrompts} onSaveGuidePrompt={saveGuidePrompt} onBack={back} />
        ) : screen === "adminAppointments" ? (
          isAdmin ? <AdminAppointments onBack={back} /> : <Admin isAdmin={isAdmin} guidePrompts={guidePrompts} onSaveGuidePrompt={saveGuidePrompt} onBack={back} />
        ) : screen === "mensShed" ? (
          <MensShedPage onBack={back} />
        ) : screen === "mensGroup" ? (
          <MensGroup onBack={back} />
        ) : screen === "programInfo" ? (
          <ProgramInfo voiceOn={voiceOn} speechLang={speechLang} onBack={back} onMessageJuan={() => go("coordinator")} onOpenIntake={() => go("intake")} onBookAppointment={() => go("bookAppointment")} />
        ) : screen === "bookAppointment" ? (
          <BookAppointment onBack={back} />
        ) : screen === "memory" ? (
          <MemoryManager memories={memories} memoryOn={memoryOn}
            onSave={(list, on) => saveMemories(list, on)} onBack={back} />
        ) : screen === "settings" ? (
              <Settings textScale={textScale} reduceMotion={reduceMotion} responseSpeed={responseSpeed} speechLang={speechLang} uiLanguage={uiLanguage} onChangeUiLanguage={saveUiLanguage} autoIntroVoice={autoIntroVoiceOn} autoReplyVoice={autoReplyVoiceOn} activityTrackingOn={activityTrackingOn}
              journalPinSet={journalPinSet} journalPinQuestion={journalPinQuestion} journalPinHash={journalPinHash} journalPinAnswerHash={journalPinAnswerHash} onSetJournalPin={setJournalPin} onClearJournalPin={clearJournalPin} deviceUnlockEnabled={deviceUnlockEnabled} onSetDeviceUnlock={setDeviceUnlockPreference}
            installPromptAvailable={Boolean(installPromptEvent)} isStandalone={isStandalone} onPromptInstall={promptAppInstall}
            session={session} authEnabled={showAuth} onSave={saveSettings} onRestoreDefaults={restoreDefaultSettings} onExportVaultRecovery={exportVaultRecoveryPackage} onBack={back}
             onOpenBugReport={() => go("bugReport")} onOpenFeedback={() => go("userFeedback")} />
        ) : screen === "bugReport" ? (
          <BugReport session={session} userPublicKey={userPublicKey} onBack={back} />
        ) : screen === "userFeedback" ? (
          <UserFeedback session={session} userPublicKey={userPublicKey} onBack={back} />
        ) : null}
        <GlobalJumpToTop screen={screen} />
        <CrisisBar />
      </div>
      {shareMsg && (
        <div role="status" aria-live="polite" style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 280,
          background: T.ink, color: "#fff", borderRadius: 999, padding: "10px 18px", fontSize: 13.5, boxShadow: T.lift }}>{shareMsg}</div>
      )}
      <FrostedHubMenu open={menuOpen && menuVisible} onClose={closePersistentMenu} voiceOn={voiceOn} onToggleVoice={() => setVoiceOn((value) => !value)} authEnabled={showAuth} isAdmin={isAdmin} unreadCount={unreadCount} unreadAdminMsgs={unreadAdminMsgs} onOpenNotifications={() => go("notifications")} onOpenProfile={() => go("profile")} onOpenAdmin={() => go("admin")} onOpenAdminMessages={() => go("adminMessages")} onOpenSettings={() => go("settings")} onShare={shareApp} />
      </HubMenuContext.Provider>
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
      @keyframes rh-menu-in { from{opacity:0;transform:translateX(18px) scale(.985)} to{opacity:1;transform:translateX(0) scale(1)} }
      .rh-in{animation:rh-in .4s ease both}
      .rh-frosted-menu{animation:rh-menu-in .24s cubic-bezier(.2,.8,.2,1) both}
      .rh-menu-trigger{position:relative;overflow:hidden;isolation:isolate;transition:transform .18s ease,box-shadow .18s ease,background .18s ease}
      .rh-menu-trigger::before{content:"";position:absolute;inset:0 24% 0 -30%;background:linear-gradient(105deg,transparent,rgba(255,255,255,.72),transparent);transform:translateX(-120%);transition:transform .55s ease;z-index:-1}
      .rh-menu-trigger:hover::before{transform:translateX(390%)}
      .rh-menu-trigger:focus-visible{outline:3px solid rgba(46,133,120,.38);outline-offset:3px}
      .rh-frosted-menu::before{content:"";display:block;height:4px;border-radius:999px;background:linear-gradient(90deg,#2e8578 0%,#74b89a 52%,#e9bd72 100%);opacity:.9;margin:-3px 5px 15px;box-shadow:0 2px 8px rgba(46,133,120,.18)}
      *{box-sizing:border-box}
      body{-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;letter-spacing:0.1px}
      button{font-family:inherit}
      button:focus-visible,a:focus-visible{outline:3px solid rgba(77,159,104,0.38);outline-offset:3px}
      /* very soft leaf-green texture — adds life without any harsh flashes */
      body::before{content:"";position:fixed;inset:0;pointer-events:none;z-index:0;opacity:0.42;
        background-image:radial-gradient(rgba(77,159,104,0.07) 1px, transparent 1px);background-size:24px 24px}
      @media (prefers-reduced-motion: no-preference){ button:hover,a:hover{transform:translateY(-1px)} }
      @media (prefers-reduced-motion: reduce){ .rh-float,.rh-in,.rh-frosted-menu,button:hover,a:hover{animation:none!important;transform:none!important} }
      /* Keep the Hub’s navigation cards generous and visually consistent. */
      .rh-hub-card-stack > button,.rh-hub-card-stack > a{height:108px;min-height:108px;overflow:hidden}
      .rh-guide-chat{width:100%;max-width:760px;margin:0 auto;padding-bottom:calc(128px + env(safe-area-inset-bottom))}
      .rh-guide-chat-header{display:flex;align-items:center;gap:12px;position:sticky;top:6px;z-index:20;padding:10px 12px;border:1px solid rgba(220,236,226,.95);border-radius:22px;background:rgba(255,255,255,.88);backdrop-filter:blur(18px);box-shadow:0 10px 26px rgba(47,97,72,.08)}
      .rh-guide-chat-avatar{width:48px;height:48px;border-radius:16px;overflow:hidden;flex:0 0 auto;background:#fff;box-shadow:0 4px 12px rgba(47,97,72,.12)}
      .rh-guide-chat-messages{background:rgba(255,255,255,.42);border:1px solid rgba(220,236,226,.82);border-radius:26px;padding:18px 14px;scroll-padding-bottom:150px}
      .rh-guide-chat-disclosure{display:flex;align-items:flex-start;gap:9px;margin:12px 2px 4px;padding:9px 11px;border:1px solid rgba(220,236,226,.8);border-radius:14px;background:rgba(238,246,241,.72);color:${T.sub};font-size:11.5px;line-height:1.45}
      .rh-guide-chat-bubble{max-width:min(82%,620px);padding:12px 15px;border-radius:20px;font-size:15px;line-height:1.52;white-space:pre-wrap;box-shadow:0 5px 16px rgba(47,97,72,.07)}
      .rh-guide-chat-bubble[data-role="assistant"]{border:1px solid rgba(220,236,226,.9);border-bottom-left-radius:7px;background:rgba(255,255,255,.96)}
      .rh-guide-chat-bubble[data-role="user"]{border-bottom-right-radius:7px;background:linear-gradient(135deg,#2e8578,#4d9f68);color:#fff}
      .rh-guide-chat-composer{position:sticky;bottom:calc(10px + env(safe-area-inset-bottom));z-index:25;margin-top:12px;padding:8px;border:1px solid rgba(220,236,226,.98);border-radius:25px;background:rgba(255,255,255,.94);backdrop-filter:blur(18px);box-shadow:0 14px 32px rgba(47,97,72,.16)}
      .rh-guide-chat-composer-row{display:flex;align-items:flex-end;gap:7px}
      .rh-guide-chat-input{min-width:0;flex:1;border:0!important;background:transparent!important;box-shadow:none!important;padding:11px 6px!important}
      .rh-guide-chat-input:focus{outline:none}
      .rh-guide-chat-tool{width:42px;height:42px;border-radius:50%;border:1px solid ${T.line};background:#f7fbf8;color:${T.ink};display:grid;place-items:center;cursor:pointer;flex:0 0 auto}
      .rh-guide-chat-send{width:44px;height:44px;border-radius:50%;border:0;background:linear-gradient(145deg,#2e8578,#4d9f68);color:#fff;display:grid;place-items:center;cursor:pointer;flex:0 0 auto;box-shadow:0 6px 14px rgba(46,133,120,.24)}
      .rh-guide-chat-send:disabled{opacity:.42;cursor:default;box-shadow:none}
      @media (max-width:560px){.rh-guide-chat{padding-left:0;padding-right:0}.rh-guide-chat-header{top:2px;border-radius:18px}.rh-guide-chat-messages{border-radius:22px;padding:14px 8px}.rh-guide-chat-bubble{max-width:88%;font-size:15px}.rh-guide-chat-composer{bottom:calc(8px + env(safe-area-inset-bottom));border-radius:22px}.rh-guide-chat-tool{width:40px;height:40px}.rh-guide-chat-send{width:42px;height:42px}}
    `}</style>
  );
}

function Brand({ right, inlineRight }) {
  const menu = React.useContext(HubMenuContext);
  const headerRight = inlineRight || menu?.button;
  return (
    <header style={{ padding: "14px 2px 10px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 11 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
          <div style={{ width: 48, height: 48, borderRadius: 16, background: "#ffffff", display: "grid", placeItems: "center", boxShadow: T.soft, flexShrink: 0, overflow: "hidden" }}>
            <img src="/resilience-hub-logo.png" alt="Resilience Hub" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
          <div style={{ lineHeight: 1.15, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#f7f5e9", whiteSpace: "nowrap" }}>The Resilience Hub</div>
            <div style={{ fontSize: 11.5, color: "rgba(247,245,233,0.78)", marginTop: 4, whiteSpace: "nowrap" }}>You never have to walk it alone</div>
          </div>
        </div>
        {headerRight && <div style={{ flexShrink: 0 }}>{headerRight}</div>}
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
    <div style={{ display: "flex", alignItems: "flex-start", gap: 9 }}><Heart size={18} color="#c54848" style={{ flexShrink: 0, marginTop: 2 }} /><div><div style={{ fontWeight: 800, color: "#8e3131", fontSize: 14.5 }}>You’re in charge of the next step</div><div style={{ color: T.ink, fontSize: 13, lineHeight: 1.45, marginTop: 4 }}>I’m really glad you told us. If you might act on these thoughts or are in immediate danger, call 000 now. Otherwise, you can choose a support person below, move near someone you trust, or simply tell the guide: “No, I don’t want that right now.” You do not need to say you already have support, and you will not be pressured or locked out of the conversation.</div></div></div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 11 }}>{CONTACTS.slice(0, 4).map((c) => <a key={c.label} href={`tel:${c.tel}`} onClick={stopGuideSpeechForCall} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 12, padding: "10px 8px", textDecoration: "none", background: c.accent ? "#c54848" : "#fff", color: c.accent ? "#fff" : T.ink, border: c.accent ? "none" : "1px solid #efc9c6", fontSize: 12.5, fontWeight: 800 }}><Phone size={14} /> {c.label}</a>)}</div>
    <button onClick={onDismiss} style={{ marginTop: 9, border: "1px solid #efc9c6", borderRadius: 999, background: "#fff", color: "#8e3131", fontSize: 12, fontWeight: 800, cursor: "pointer", padding: "8px 12px" }}>Not right now — stay with the conversation</button>
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
                <LifeBuoy size={16} color={T.green} /> Safety First — choose your next step
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", color: T.sub }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {CONTACTS.map((c) => (
                <a key={c.label} href={`tel:${c.tel}`} onClick={stopGuideSpeechForCall} style={{ display: "flex", alignItems: "center", gap: 8,
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
              Choosing support is a strength. You stay in control. This is not a replacement for a doctor or emergency service.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <a href="tel:000" onClick={stopGuideSpeechForCall} aria-label="Triple Zero — 000" title="Triple Zero — 000" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 44, borderRadius: 999, padding: "10px 15px", background: "linear-gradient(145deg, #d84949, #b72f3b)", border: "1px solid rgba(255,255,255,0.8)", boxShadow: "0 8px 18px rgba(160,44,54,0.28)", color: "#fff", textDecoration: "none", cursor: "pointer", fontSize: 14, fontWeight: 850 }}>
              <Phone size={16} /> Triple Zero — 000
            </a>
            <button onClick={() => setOpen(true)} aria-label="Open Safety First" title="Open Safety First" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
              minHeight: 44, borderRadius: 999, padding: "10px 18px", background: "rgba(255,255,255,0.97)", backdropFilter: "blur(6px)",
              border: `1px solid ${T.line}`, boxShadow: T.soft, cursor: "pointer", fontSize: 14, fontWeight: 600, color: T.ink }}>
              <LifeBuoy size={16} color={T.green} /> Safety First
            </button>
          </div>
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
let __autoIntroVoiceOn = true;
let __autoReplyVoiceOn = true;
let __primePromise = null;
let __lastVoiceAt = 0; // Date.now() of the last time a guide's voice actually started playing — used to only apply the iOS mic-recovery delay when it's actually needed
// Speech-to-text language — was hardcoded to "en-AU" everywhere, which is why
// typing in another language worked fine (that's the model reading text) but
// SPEAKING in one didn't: the browser's mic transcription needs to be told
// which language to actually listen for. This is read directly by every
// place that creates a SpeechRecognition session, rather than threaded as a
// prop through every screen that has a mic button.
let __speechLang = "en-AU";
const SPEECH_LANGS = [
  { code: "en-AU", label: "English (Australia)" },
  { code: "es-ES", label: "Spanish — Español" },
  { code: "es-AR", label: "Spanish — Argentina (Español argentino)" },
  { code: "es-UY", label: "Spanish — Uruguay (Español uruguayo)" },
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

// Spoken copy for automatic welcomes and introductions. The on-screen copy stays
// in English for now; only the audio follows the language selected in Settings.
const AUTO_INTRO_SPEECH = {
  "en-AU": {
    toolkit: "Welcome to the Toolkit — a collection of things that can help, whenever you need them. Take your time, look around, and choose whatever feels right today.",
    guides: "Welcome to your guides — AI guided support from a team you can turn to whenever you need it. Choose the voice that feels right for you today.",
    plan: "This is your tailor-made 8-week plan, shaped around what you told us about your life, your energy, and what you want to work towards. It grows week by week, starting gently and building practical steps at a pace that fits you. I’m here to help you understand each week, answer your questions, and help you notice your progress without pressure or judgement.",
    program: "Hi, I’m Juan, the founder of The Resilience Hub. This program is free and built around you. We listen to where you’re at, shape practical support at your pace, and connect you with the right people. If you need help, use Message Juan to reach the real me, talk with an AI guide, or use Safety First for urgent human support.",
    planChoice: "Before we go any further, would you like Carlos to put together a personalised 8-week plan for you? I’ll ask a handful of questions so he can shape it around what you’re dealing with. If you’d rather use the guides and Toolkit for now, that’s completely fine.",
    chat: "Hi, I’m your AI guide. Take your time — we can talk things through at your pace.",
    resources: "Hi, I'm Rex. The Support Directory brings together crisis help, health services, housing, food, recovery, community groups and other local support. You can browse by need or use the search box — type what you're looking for in your own words, like someone to talk to, housing or food, and I'll show you matching services. Take your time; you don't need to know a service's name first.",
    campfire: "Hi, I’m Rex. Before you enter, here are the ways you can use the Campfire: you can simply watch and listen without joining in, join the text chat, or use voice chat when you feel ready. There is also an in-app video chat feature if you’d like to connect face to face — you choose who to talk with, and they need to accept. One gentle reminder: because the Campfire you selected is connected to your access, your Campfire choice is locked in. If you need to change your Campfire selection, contact support from the Campfire selection screen in your profile. Take your time — you’re welcome to come and go as you need."
  },
  "es-ES": {
    toolkit: "Te damos la bienvenida al Kit de herramientas: una colección de recursos que pueden ayudarte cuando los necesites. Tómate tu tiempo y elige lo que te parezca adecuado hoy.",
    guides: "Te damos la bienvenida a tus guías: apoyo guiado por inteligencia artificial, disponible cuando lo necesites. Elige la voz que te resulte más cómoda hoy.",
    plan: "Este es tu plan personalizado de ocho semanas, creado a partir de lo que nos contaste sobre tu vida, tu energía y tus objetivos. Avanza semana a semana, empezando con calma y construyendo pasos prácticos a un ritmo que te encaje. Estoy aquí para ayudarte a entender cada semana, responder tus preguntas y reconocer tu progreso sin presión ni juicios.",
    program: "Hola, soy Juan, el fundador de The Resilience Hub. Este programa es gratuito y está pensado para ti. Escuchamos cómo estás, adaptamos el apoyo a tu ritmo y te conectamos con las personas adecuadas. Si necesitas ayuda, usa Mensaje a Juan para contactar conmigo, habla con una guía de inteligencia artificial o usa Ayuda ahora para recibir apoyo humano urgente.",
    planChoice: "Antes de continuar, ¿te gustaría que Carlos preparara para ti un plan personalizado de ocho semanas? Te haré unas preguntas para adaptarlo a lo que estás viviendo. Si prefieres usar primero las guías y el Kit de herramientas, también está bien.",
    chat: "Hola, soy tu guía de inteligencia artificial. Tómate tu tiempo: podemos hablar de lo que necesites a tu ritmo.",
    resources: "Hola, soy Rex. El Directorio de Apoyo reúne ayuda en crisis, servicios de salud, vivienda, comida, recuperación, grupos comunitarios y otros apoyos locales. Puedes buscar por necesidad o usar el cuadro de búsqueda: escribe lo que buscas con tus propias palabras, como alguien con quien hablar, vivienda o comida, y te mostraré los servicios que coincidan. Tómate tu tiempo; no necesitas conocer el nombre de un servicio primero.",
    campfire: "Hola, soy Rex. Antes de entrar, aquí tienes las formas en que puedes usar el Campfire: puedes simplemente mirar y escuchar sin participar, unirte al chat de texto o usar el chat de voz cuando te sientas listo. También hay una función de videochat dentro de la app si quieres conectar cara a cara: eliges con quién hablar y esa persona debe aceptar. Un recordatorio suave: como el Campfire que has seleccionado está vinculado a tu acceso, la elección queda bloqueada. Si alguna vez necesitas otro espacio, habla con Juan o contacta con el equipo de The Resilience Hub. Tómate tu tiempo: puedes entrar y salir cuando lo necesites."
  },
  "es-AR": {
    toolkit: "Bienvenido al Kit de herramientas: un conjunto de recursos que pueden ayudarte cuando los necesites. Tomate tu tiempo y elegí lo que te haga sentido hoy.",
    guides: "Bienvenido a tus guías: apoyo acompañado por inteligencia artificial, disponible cuando lo necesites. Elegí la voz que te resulte más cómoda hoy.",
    plan: "Este es tu plan personalizado de ocho semanas, armado a partir de lo que nos contaste sobre tu vida, tu energía y lo que querés alcanzar. Avanza semana a semana, empezando de forma tranquila y sumando pasos prácticos a un ritmo que te quede bien. Estoy acá para ayudarte a entender cada semana, responder tus preguntas y reconocer tus avances, sin presión ni juicios.",
    program: "Hola, soy Juan, el fundador de The Resilience Hub. Este programa es gratuito y está pensado para vos. Escuchamos en qué estás, adaptamos el apoyo a tu ritmo y te conectamos con las personas indicadas. Si necesitás ayuda, usá Mensaje a Juan para contactarme, hablá con una guía de inteligencia artificial o usá Ayuda ahora para recibir apoyo humano urgente.",
    planChoice: "Antes de seguir, ¿querés que Carlos te prepare un plan personalizado de ocho semanas? Te voy a hacer algunas preguntas para adaptarlo a lo que estás viviendo. Si preferís usar primero las guías y el Kit de herramientas, está perfecto.",
    chat: "Hola, soy tu guía de inteligencia artificial. Tomate tu tiempo: podemos hablar de lo que necesites, a tu ritmo.",
    resources: "Hola, soy Rex. El Directorio de Apoyo reúne ayuda en crisis, servicios de salud, vivienda, comida, recuperación, grupos comunitarios y otros apoyos locales. Podés buscar por necesidad o usar el cuadro de búsqueda: escribí lo que necesitás con tus propias palabras, por ejemplo alguien con quien hablar, vivienda o comida, y yo te muestro servicios que coincidan. Tomate tu tiempo; no necesitás conocer el nombre de un servicio antes.",
    campfire: "Hola, soy Rex. Antes de entrar, te cuento las formas de usar el Campfire: podés simplemente mirar y escuchar sin participar, sumarte al chat de texto o usar el chat de voz cuando te sientas listo. También hay una función de videochat dentro de la app si querés conectar cara a cara: elegís con quién hablar y esa persona debe aceptar. Un recordatorio amable: como el Campfire que seleccionaste está vinculado a tu acceso, esa elección queda bloqueada. Si alguna vez necesitás otro espacio, hablá con Juan o contactá al equipo del Hub. Tomate tu tiempo; podés entrar y salir cuando lo necesites."
  },
  "es-UY": {
    toolkit: "Bienvenido al Kit de herramientas: un conjunto de recursos que pueden ayudarte cuando los necesites. Tomate tu tiempo y elegí lo que te haga sentido hoy.",
    guides: "Bienvenido a tus guías: apoyo acompañado por inteligencia artificial, disponible cuando lo necesites. Elegí la voz que te resulte más cómoda hoy.",
    plan: "Este es tu plan personalizado de ocho semanas, armado a partir de lo que nos contaste sobre tu vida, tu energía y lo que querés alcanzar. Avanza semana a semana, empezando de forma tranquila y sumando pasos prácticos a un ritmo que te quede bien. Estoy acá para ayudarte a entender cada semana, responder tus preguntas y reconocer tus avances, sin presión ni juicios.",
    program: "Hola, soy Juan, el fundador de The Resilience Hub. Este programa es gratuito y está pensado para vos. Escuchamos en qué estás, adaptamos el apoyo a tu ritmo y te conectamos con las personas indicadas. Si necesitás ayuda, usá Mensaje a Juan para contactarme, hablá con una guía de inteligencia artificial o usá Ayuda ahora para recibir apoyo humano urgente.",
    planChoice: "Antes de seguir, ¿querés que Carlos te prepare un plan personalizado de ocho semanas? Te voy a hacer algunas preguntas para adaptarlo a lo que estás viviendo. Si preferís usar primero las guías y el Kit de herramientas, está perfecto.",
    chat: "Hola, soy tu guía de inteligencia artificial. Tomate tu tiempo: podemos hablar de lo que necesites, a tu ritmo.",
    resources: "Hola, soy Rex. El Directorio de Apoyo reúne ayuda en crisis, servicios de salud, vivienda, alimentación, recuperación, grupos comunitarios y otros apoyos locales. Podés buscar por necesidad o usar la caja de búsqueda: escribí lo que estás buscando con tus propias palabras, por ejemplo alguien con quien hablar, vivienda o comida, y te voy a mostrar servicios que coincidan. Tómate tu tiempo; no hace falta que sepas el nombre de un servicio primero.",
    campfire: "Hola, soy Rex. Antes de entrar, estas son las formas en que podés usar el Campfire: podés simplemente mirar y escuchar sin participar, sumarte al chat de texto o usar el chat de voz cuando te sientas listo. También hay una función de videochat dentro de la app si querés conectarte cara a cara: elegís con quién hablar y esa persona debe aceptar. Un recordatorio amable: como el Campfire que seleccionaste está vinculado a tu acceso, la elección queda bloqueada. Si alguna vez necesitás otro espacio, hablá con Juan o contactá al equipo del Hub. Tomate tu tiempo: podés entrar y salir cuando lo necesites."
  },
  "it-IT": {
    toolkit: "Benvenuto nel Kit di strumenti: una raccolta di risorse che possono aiutarti quando ne hai bisogno. Prenditi il tuo tempo e scegli ciò che ti sembra giusto oggi.",
    guides: "Benvenuto tra le tue guide: supporto guidato dall’intelligenza artificiale, disponibile quando ne hai bisogno. Scegli la voce che ti fa sentire più a tuo agio oggi.",
    plan: "Questo è il tuo piano personalizzato di otto settimane, costruito intorno a ciò che ci hai raccontato della tua vita, della tua energia e dei tuoi obiettivi. Cresce settimana dopo settimana, iniziando con calma e aggiungendo passi pratici al ritmo adatto a te. Sono qui per aiutarti a capire ogni settimana, rispondere alle tue domande e riconoscere i tuoi progressi senza pressione né giudizio.",
    program: "Ciao, sono Juan, il fondatore di The Resilience Hub. Questo programma è gratuito ed è costruito intorno a te. Ascoltiamo dove ti trovi, adattiamo il supporto al tuo ritmo e ti colleghiamo alle persone giuste. Se hai bisogno di aiuto, usa Messaggia Juan per contattare me, parla con una guida di intelligenza artificiale oppure usa Aiuto ora per ricevere supporto umano urgente.",
    planChoice: "Prima di continuare, vuoi che Carlos prepari per te un piano personalizzato di otto settimane? Ti farò alcune domande per adattarlo a ciò che stai vivendo. Se preferisci usare prima le guide e il Kit di strumenti, va benissimo.",
    chat: "Ciao, sono la tua guida di intelligenza artificiale. Prenditi il tuo tempo: possiamo parlare di ciò che ti serve al tuo ritmo.",
    resources: "Ciao, sono Rex. Il Support Directory raccoglie aiuto in caso di crisi, servizi sanitari, alloggi, cibo, percorsi di recupero, gruppi di comunità e altri sostegni locali. Puoi esplorare per esigenza o usare la casella di ricerca — digita ciò che cerchi con parole tue, per esempio qualcuno con cui parlare, alloggio o cibo, e ti mostrerò i servizi corrispondenti. Prenditi il tempo che ti serve; non serve conoscere prima il nome di un servizio.",
    campfire: "Ciao, sono Rex. Prima di entrare, ecco come puoi usare il Campfire: puoi semplicemente guardare e ascoltare senza partecipare, unirti alla chat testuale o usare la chat vocale quando ti senti pronto. C’è anche una funzione di videochat nell’app se vuoi connetterti faccia a faccia — tu scegli con chi parlare e l’altra persona deve accettare. Un piccolo promemoria: poiché il Campfire che hai selezionato è legato al tuo accesso, la tua scelta è bloccata. Se hai bisogno di uno spazio diverso, parla con Juan o contatta il team del Hub. Prenditi il tuo tempo — sei libero di entrare e uscire quando ne hai bisogno."
  },
  "el-GR": {
    toolkit: "Καλώς ήρθες στην Εργαλειοθήκη — μια συλλογή από πράγματα που μπορούν να σε βοηθήσουν όταν τα χρειάζεσαι. Πάρε τον χρόνο σου και διάλεξε ό,τι σου ταιριάζει σήμερα.",
    guides: "Καλώς ήρθες στους οδηγούς σου — υποστήριξη με τεχνητή νοημοσύνη από μια ομάδα στην οποία μπορείς να απευθυνθείς όποτε χρειάζεσαι. Διάλεξε τη φωνή που σου ταιριάζει σήμερα.",
    plan: "Αυτό είναι το προσωπικό σου πρόγραμμα οκτώ εβδομάδων, φτιαγμένο γύρω από όσα μας είπες για τη ζωή σου, την ενέργειά σου και τους στόχους σου. Προχωρά εβδομάδα με την εβδομάδα, ξεκινώντας ήπια και προσθέτοντας πρακτικά βήματα στον ρυθμό που σου ταιριάζει. Είμαι εδώ για να σε βοηθήσω να καταλάβεις κάθε εβδομάδα, να απαντήσω στις ερωτήσεις σου και να δεις την πρόοδό σου χωρίς πίεση ή κριτική.",
    program: "Γεια, είμαι ο Juan, ο ιδρυτής του The Resilience Hub. Αυτό το πρόγραμμα είναι δωρεάν και είναι φτιαγμένο για εσένα. Ακούμε πού βρίσκεσαι, προσαρμόζουμε την υποστήριξη στον ρυθμό σου και σε συνδέουμε με τους σωστούς ανθρώπους. Αν χρειάζεσαι βοήθεια, στείλε μήνυμα στον Juan, μίλησε με έναν οδηγό τεχνητής νοημοσύνης ή χρησιμοποίησε την Άμεση βοήθεια για επείγουσα ανθρώπινη υποστήριξη.",
    planChoice: "Πριν προχωρήσουμε, θα ήθελες ο Carlos να ετοιμάσει για εσένα ένα προσωπικό πρόγραμμα οκτώ εβδομάδων; Θα σου κάνω μερικές ερωτήσεις ώστε να το προσαρμόσει σε όσα αντιμετωπίζεις. Αν προτιμάς πρώτα τους οδηγούς και την Εργαλειοθήκη, είναι απολύτως εντάξει.",
    chat: "Γεια, είμαι ο οδηγός σου με τεχνητή νοημοσύνη. Πάρε τον χρόνο σου — μπορούμε να μιλήσουμε με τον δικό σου ρυθμό.",
    resources: "Γεια, είμαι ο Rex. Ο Κατάλογος Υποστήριξης συγκεντρώνει βοήθεια σε κρίση, υπηρεσίες υγείας, στέγαση, τρόφιμα, αποκατάσταση, κοινοτικές ομάδες και άλλη τοπική υποστήριξη. Μπορείς να ψάξεις ανάλογα με την ανάγκη ή να χρησιμοποιήσεις το πεδίο αναζήτησης — γράψε με δικά σου λόγια αυτό που ψάχνεις, π.χ. κάποιον για να μιλήσεις, στέγαση ή τρόφιμα, και θα σου δείξω αντίστοιχες υπηρεσίες. Πάρε τον χρόνο σου· δεν χρειάζεται να γνωρίζεις πρώτα το όνομα μιας υπηρεσίας.",
    campfire: "Γεια, είμαι ο Rex. Πριν μπεις, να πω τους τρόπους που μπορείς να χρησιμοποιήσεις το Campfire: μπορείς απλώς να παρακολουθείς και να ακούς χωρίς να συμμετέχεις, να μπεις στη συνομιλία με κείμενο ή να χρησιμοποιήσεις τη φωνητική συνομιλία όταν νιώσεις έτοιμος. Υπάρχει επίσης μια λειτουργία βιντεοκλήσης μέσα στην εφαρμογή αν θέλεις να συνδεθείς πρόσωπο με πρόσωπο — εσύ επιλέγεις ποιον θα μιλήσεις και ο άλλος πρέπει να αποδεχτεί. Μια απαλή υπενθύμιση: επειδή το Campfire που επέλεξες συνδέεται με την πρόσβασή σου, η επιλογή του Campfire είναι κλειδωμένη. Αν ποτέ χρειαστείς έναν άλλο χώρο, μίλησε με τον Juan ή επικοινώνησε με την ομάδα του The Resilience Hub. Πάρε τον χρόνο σου — μπορείς να έρχεσαι και να φεύγεις όποτε χρειάζεται."
  },
  "vi-VN": {
    toolkit: "Chào mừng bạn đến với Bộ công cụ — nơi có những điều có thể giúp bạn bất cứ khi nào cần. Hãy thong thả và chọn điều phù hợp với bạn hôm nay.",
    guides: "Chào mừng bạn đến với các hướng dẫn viên — sự hỗ trợ có AI, luôn sẵn sàng khi bạn cần. Hãy chọn giọng nói khiến bạn thấy thoải mái hôm nay.",
    plan: "Đây là kế hoạch tám tuần được thiết kế riêng cho bạn, dựa trên những gì bạn chia sẻ về cuộc sống, năng lượng và điều bạn muốn hướng tới. Kế hoạch tiến triển từng tuần, bắt đầu nhẹ nhàng và thêm các bước thực tế theo nhịp phù hợp với bạn. Tôi ở đây để giúp bạn hiểu từng tuần, trả lời câu hỏi và nhận ra tiến bộ của mình mà không áp lực hay phán xét.",
    program: "Xin chào, tôi là Juan, người sáng lập The Resilience Hub. Chương trình này miễn phí và được xây dựng quanh bạn. Chúng tôi lắng nghe hoàn cảnh của bạn, điều chỉnh hỗ trợ theo nhịp của bạn và kết nối bạn với đúng người. Nếu cần giúp đỡ, hãy nhắn cho Juan thật, trò chuyện với hướng dẫn viên AI hoặc dùng Help Now để nhận hỗ trợ khẩn cấp từ con người.",
    planChoice: "Trước khi tiếp tục, bạn có muốn Carlos tạo một kế hoạch tám tuần riêng cho mình không? Tôi sẽ hỏi vài câu để điều chỉnh kế hoạch theo những gì bạn đang trải qua. Nếu bạn muốn dùng các hướng dẫn viên và Bộ công cụ trước, điều đó hoàn toàn ổn.",
    chat: "Xin chào, tôi là hướng dẫn viên AI của bạn. Hãy thong thả — chúng ta có thể trò chuyện theo nhịp của bạn.",
    resources: "Chào, tôi là Rex. Support Directory gom lại các hỗ trợ địa phương như trợ giúp khủng hoảng, dịch vụ y tế, chỗ ở, thực phẩm, phục hồi, nhóm cộng đồng và những hỗ trợ khác. Bạn có thể duyệt theo nhu cầu hoặc dùng ô tìm kiếm — gõ những gì bạn cần bằng từ ngữ của mình, ví dụ như người để trò chuyện, chỗ ở hoặc thực phẩm, và tôi sẽ hiển thị những dịch vụ phù hợp. Từ từ thôi; bạn không cần phải biết tên dịch vụ trước.",
    campfire: "Chào, tôi là Rex. Trước khi bạn vào, đây là những cách bạn có thể sử dụng Campfire: bạn có thể chỉ xem và nghe mà không tham gia, tham gia trò chuyện bằng văn bản, hoặc sử dụng trò chuyện thoại khi bạn cảm thấy sẵn sàng. Ứng dụng cũng có tính năng video chat nếu bạn muốn kết nối mặt đối mặt — bạn chọn người muốn nói chuyện, và họ phải chấp nhận. Nhắc nhẹ: vì Campfire bạn chọn liên kết với quyền truy cập của bạn, lựa chọn Campfire sẽ bị khóa. Nếu bạn cần một không gian khác, hãy nói với Juan hoặc liên hệ đội ngũ The Resilience Hub. Hãy từ từ — bạn có thể ra vào tuỳ theo nhu cầu."
  },
  "zh-CN": {
    toolkit: "欢迎来到工具箱——这里有一些在你需要时可以帮助你的内容。慢慢来，选择今天对你有用的东西。",
    guides: "欢迎来到你的向导区——一组随时可以陪伴你的人工智能支持向导。请选择今天让你感觉舒服的声音。",
    plan: "这是为你量身定制的八周计划，根据你分享的生活、精力和目标来安排。计划会一周一周地发展，从轻松的步骤开始，以适合你的节奏增加实际行动。我会帮助你理解每一周、回答问题，并在没有压力或评判的情况下看见自己的进步。",
    program: "你好，我是 Juan，Resilience Hub 的创始人。这个项目完全免费，并且围绕你来安排。我们会了解你的处境，按照你的节奏提供实际支持，并帮助你联系合适的人。如果你需要帮助，可以给真实的 Juan 发消息，和人工智能向导聊天，或使用“现在需要帮助”获得紧急人工支持。",
    planChoice: "在继续之前，你想让 Carlos 为你制定一份个性化的八周计划吗？我会问几个问题，让计划贴合你正在经历的事情。如果你想先使用向导和工具箱，也完全可以。",
    chat: "你好，我是你的人工智能向导。慢慢来——我们可以按照你的节奏聊聊。",
    resources: "嗨，我是Rex。支持目录汇集了危机援助、医疗服务、住房、食物、康复、社区团体和其他本地支持。你可以按需求浏览或使用搜索框——用你自己的话输入想找的东西，比如“有人可以倾诉”、“住房”或“食物”，我会为你显示匹配的服务。慢慢来；你不需要先知道服务的具体名称。",
    campfire: "嗨，我是Rex。进入前说明一下Campfire的使用方式：你可以只是观看和倾听而不参与，加入文字聊天，或者在准备好了再使用语音聊天。如果想面对面交流，也有应用内视频聊天功能——你可以选择想要和谁通话，对方需要接受邀请。温馨提示：你所选择的Campfire与您的访问权限关联，因此该Campfire的选择将被锁定。如果你需要不同的空间，请联系Juan或Hub团队帮忙。慢慢来——你可以根据需要随时进出。"
  },
  "yue-Hant-HK": {
    toolkit: "歡迎嚟到工具箱——入面有一啲喺你需要時可以幫到你嘅嘢。慢慢嚟，揀一樣今日適合你嘅就得。",
    guides: "歡迎嚟到你嘅向導區——一班你有需要時可以搵到嘅人工智能向導。揀一把今日令你覺得舒服嘅聲音啦。",
    plan: "呢個係為你度身訂造嘅八星期計劃，按住你分享嘅生活、精力同目標去安排。計劃會一星期一星期咁發展，由輕鬆嘅步驟開始，按住你嘅節奏加入實際行動。我會幫你了解每一星期、回答問題，亦會陪你睇到自己嘅進步，唔會畀你壓力或者批判你。",
    program: "你好，我係 Juan，Resilience Hub 嘅創辦人。呢個計劃係免費，而且係圍繞你去安排。我哋會聽你而家嘅情況，按你嘅步伐提供實際支援，亦會幫你連繫合適嘅人。如果你需要幫手，可以留言畀真正嘅 Juan、同人工智能向導傾偈，或者用「即時求助」搵緊急真人支援。",
    planChoice: "繼續之前，你想唔想 Carlos 幫你整一份個人化八星期計劃？我會問幾條問題，令計劃貼合你而家面對嘅事。如果你想先用向導同工具箱，完全冇問題。",
    chat: "你好，我係你嘅人工智能向導。慢慢嚟——我哋可以按你嘅節奏傾下偈。",
    resources: "嗨，我係Rex。Support Directory集合咗危機支援、醫療服務、住屋、食物、復康、社區組織同其他本地支援。你可以按需要瀏覽，或者用搜尋格 — 用你平時講嘅字輸入你要搵嘅嘢，例如有人傾訴、住屋或食物，我會幫你顯示相符嘅服務。慢慢嚟，唔使先知嗰啲服務嘅名稱。",
    campfire: "Hi，我係 Rex。喺你入去之前，介紹一下你可以點樣使用呢個 Campfire：你可以淨係坐低睇同聽、可以加入文字聊天室，或者準備好時用語音聊天。App 內亦有視像聊天功能，如果你想面對面連繫可以用 — 你可以自己揀想同邊個傾，對方需要接受先會開始。溫馨提示：你所揀嘅 Campfire 會跟你嘅存取權綁住，所以選擇會被鎖定。如果你需要轉去另一個空間，請同 Juan 或者 The Resilience Hub 團隊講。慢慢來 — 你可以隨時出入，按你需要自由進出。"
  },
  "ar-SA": {
    toolkit: "مرحباً بك في مجموعة الأدوات — مجموعة من الأشياء التي يمكن أن تساعدك عندما تحتاج إليها. خذ وقتك واختر ما يناسبك اليوم.",
    guides: "مرحباً بك في مساحة المرشدين — دعم موجّه بالذكاء الاصطناعي من فريق يمكنك الرجوع إليه متى احتجت. اختر الصوت الذي يناسبك اليوم.",
    plan: "هذه خطتك الشخصية لثمانية أسابيع، وقد صُممت حول ما أخبرتنا به عن حياتك وطاقتك وما تريد الوصول إليه. تتقدم أسبوعاً بعد أسبوع، وتبدأ بلطف ثم تضيف خطوات عملية بالسرعة المناسبة لك. أنا هنا لأساعدك على فهم كل أسبوع، والإجابة عن أسئلتك، ورؤية تقدمك من دون ضغط أو أحكام.",
    program: "مرحباً، أنا خوان، مؤسس Resilience Hub. هذا البرنامج مجاني ومصمم حولك. نستمع إلى وضعك، ونقدم دعماً عملياً بإيقاعك، ونساعدك على التواصل مع الأشخاص المناسبين. إذا احتجت إلى مساعدة، راسل خوان الحقيقي، أو تحدث مع أحد المرشدين بالذكاء الاصطناعي، أو استخدم المساعدة الآن للدعم البشري العاجل.",
    planChoice: "قبل أن نتابع، هل تريد من كارلوس أن يضع لك خطة شخصية لثمانية أسابيع؟ سأطرح عليك بعض الأسئلة حتى تناسب ما تمر به. وإذا كنت تفضل استخدام المرشدين ومجموعة الأدوات أولاً، فهذا مقبول تماماً.",
    chat: "مرحباً، أنا مرشدك بالذكاء الاصطناعي. خذ وقتك — يمكننا التحدث بالإيقاع الذي يناسبك.",
    resources: "مرحباً، أنا ريكس. دليل الدعم يجمع المساعدة في حالات الأزمات، والخدمات الصحية، والسكن، والطعام، والتعافي، ومجموعات المجتمع وغيرها من الدعم المحلي. يمكنك التصفح حسب الحاجة أو استخدام صندوق البحث — اكتب ما تبحث عنه بكلماتك، مثل شخص للتحدث إليه، أو سكن، أو طعام، وسأعرض لك الخدمات المطابقة. خُذ وقتك؛ لا تحتاج لمعرفَة اسم الخدمة أولاً.",
    campfire: "مرحبًا، أنا Rex. قبل دخولك، إليك طرق استخدام الـCampfire: يمكنك الاكتفاء بالمشاهدة والاستماع دون المشاركة، أو الانضمام إلى دردشة نصية، أو استخدام الدردشة الصوتية عندما تشعر بأنك جاهز. هناك أيضًا ميزة مكالمة فيديو داخل التطبيق إذا رغبت في التواصل وجهًا لوجه — تختار من تتحدث معه، ويجب أن يقبل هو بالاتصال. تذكير لطيف: بما أن الـCampfire الذي اخترته مرتبط بإمكانيات وصولك، فإن اختيارك لهذه الجلسة مُغلق. إذا احتجت في أي وقت لمكان مختلف، يمكنك التحدّث مع Juan أو التواصل مع فريق The Resilience Hub. خذ وقتك — يمكنك القدوم والمغادرة حسب حاجتك."
  },
  "hi-IN": {
    toolkit: "टूलकिट में आपका स्वागत है — यहाँ ऐसी चीज़ें हैं जो ज़रूरत पड़ने पर आपकी मदद कर सकती हैं। अपना समय लें और आज जो ठीक लगे उसे चुनें।",
    guides: "आपके गाइड्स में आपका स्वागत है — यह AI आधारित सहायता है, जिसे आप जब चाहें अपना सकते हैं। आज जिस आवाज़ से आराम मिले, उसे चुनें।",
    plan: "यह आपका खास तौर पर बनाया गया आठ हफ्तों का प्लान है, जो आपकी ज़िंदगी, ऊर्जा और लक्ष्यों के बारे में आपकी बातों के आधार पर तैयार किया गया है। यह हर हफ्ते धीरे-धीरे आगे बढ़ता है और आपकी गति के अनुसार व्यावहारिक कदम जोड़ता है। मैं हर हफ्ते को समझने, सवालों के जवाब देने और बिना दबाव या आलोचना के आपकी प्रगति देखने में आपकी मदद करूँगा।",
    program: "नमस्ते, मैं Juan हूँ, The Resilience Hub का संस्थापक। यह कार्यक्रम मुफ़्त है और आपके हिसाब से बनाया गया है। हम आपकी स्थिति सुनते हैं, आपकी गति से व्यावहारिक मदद देते हैं और आपको सही लोगों से जोड़ते हैं। मदद चाहिए तो असली Juan को संदेश भेजें, किसी AI गाइड से बात करें या तुरंत मानवीय सहायता के लिए Help Now इस्तेमाल करें।",
    planChoice: "आगे बढ़ने से पहले, क्या आप चाहेंगे कि Carlos आपके लिए आठ हफ्तों का व्यक्तिगत प्लान बनाए? मैं कुछ सवाल पूछूँगा ताकि यह आपकी स्थिति के अनुसार हो। अगर आप अभी गाइड्स और टूलकिट इस्तेमाल करना चाहते हैं, तो यह भी बिल्कुल ठीक है।",
    chat: "नमस्ते, मैं आपका AI गाइड हूँ। अपना समय लें — हम आपकी गति से बात कर सकते हैं।",
    resources: "नमस्ते, मैं Rex हूँ। Support Directory में संकट सहायता (crisis help), स्वास्थ्य सेवाएँ, आवास, भोजन, रिकवरी, समुदाय समूह और अन्य स्थानीय समर्थन एक जगह मिले हैं। आप ज़रूरत के हिसाब से ब्राउज़ कर सकते हैं या सर्च बॉक्स का उपयोग करें — अपनी बातों में लिखें कि आप क्या ढूंढ रहे हैं, जैसे किसी से बात करने वाला, आवास या भोजन, और मैं आपको मिलते-जुलते सर्विस दिखाऊँगा। आराम से लें; आपको पहले से किसी सेवा का नाम जानना ज़रूरी नहीं है।",
    campfire: "नमस्ते, मैं Rex हूँ। यहाँ Campfire में शामिल होने के अपने तरीके हैं: आप बस देख और सुन सकते हैं बिना शामिल हुए, टेक्स्ट चैट में शामिल हो सकते हैं, या जब आप तैयार हों तो वॉयस चैट उपयोग कर सकते हैं। यदि आप आमने-सामने कनेक्ट करना चाहें तो इन-ऐप वीडियो चैट की भी सुविधा है — आप चुनते हैं कि किस से बात करनी है और उन्हें स्वीकार करना होगा। एक ध्यान देने योग्य बात: जिस Campfire को आपने चुना है वह आपकी पहुँच से जुड़ा है, इसलिए आपकी Campfire पसंद लॉक हो जाती है। यदि आपको कभी कोई अलग जगह चाहिए हो तो कृपया Juan से बात करें या The Resilience Hub की टीम से संपर्क करें। अपने समय ले सकते हैं — जब चाहें आकर जा सकते हैं।"
  },
  "fil-PH": {
    toolkit: "Maligayang pagdating sa Toolkit — mga bagay na makakatulong sa iyo kapag kailangan mo. Dahan-dahan lang at piliin kung ano ang bagay sa iyo ngayon.",
    guides: "Maligayang pagdating sa iyong mga guide — AI-guided support mula sa mga guide na maaari mong lapitan anumang oras. Piliin ang boses na komportable para sa iyo ngayon.",
    plan: "Ito ang iyong tailor-made na walong linggong plano, batay sa ibinahagi mo tungkol sa buhay, enerhiya, at mga gusto mong maabot. Unti-unti itong umuunlad bawat linggo, nagsisimula nang banayad at nagdadagdag ng praktikal na hakbang sa bilis na bagay sa iyo. Nandito ako para tulungan kang maintindihan ang bawat linggo, sagutin ang iyong mga tanong, at makita ang progreso mo nang walang pressure o panghuhusga.",
    program: "Kumusta, ako si Juan, ang founder ng The Resilience Hub. Libre ang programang ito at ginawa ito para sa iyo. Pakikinggan namin ang pinagdadaanan mo, magbibigay ng praktikal na suporta sa bilis mo, at tutulungan kang makipag-ugnayan sa tamang tao. Kung kailangan mo ng tulong, i-message ang totoong Juan, makipag-usap sa AI guide, o gamitin ang Help Now para sa agarang suporta ng tao.",
    planChoice: "Bago tayo magpatuloy, gusto mo bang gumawa si Carlos ng personal na walong linggong plano para sa iyo? Magtatanong ako nang kaunti para maiangkop ito sa pinagdadaanan mo. Kung gusto mo munang gamitin ang mga guide at Toolkit, ayos lang iyon.",
    chat: "Kumusta, ako ang iyong AI guide. Dahan-dahan lang — maaari tayong mag-usap sa bilis na komportable sa iyo.",
    resources: "Hi, ako si Rex. Pinagsasama ng Support Directory ang crisis help, health services, housing, food, recovery, community groups at iba pang lokal na suporta. Pwede kang mag-browse ayon sa kailangan o gamitin ang search box — i-type lang kung ano ang hinahanap mo sa sarili mong salita, tulad ng someone to talk to, housing o food, at ipapakita ko ang mga tumutugmang serbisyo. Walang madaliang kailangan; puwede kang mag-ikot at hindi mo kailangang malaman muna ang pangalan ng serbisyo.",
    campfire: "Kumusta, ako si Rex. Bago ka pumasok, narito ang mga paraan ng paggamit mo sa Campfire: maaari ka lang manood at makinig nang hindi sumasali, sumali sa text chat, o gumamit ng voice chat kapag handa ka na. Mayroon ding in-app video chat kung gusto mong makipagkita nang harap-harapan — ikaw ang pipili kung kanino makikipag-usap, at kailangan nilang tanggapin. Isang mahinahong paalala: dahil ang Campfire na pinili mo ay naka-ugnay sa iyong access, naka-lock ang iyong napiling Campfire. Kung kailangan mo ng ibang espasyo, makipag-usap kay Juan o kontakin ang team ng The Resilience Hub. Mag-take ng oras — malaya kang pumunta at umalis ayon sa kailangan mo."
  },
  "hr-HR": {
    toolkit: "Dobro došli u Alatke — zbirku stvari koje vam mogu pomoći kada ih trebate. Uzmite vremena i odaberite ono što vam danas odgovara.",
    guides: "Dobro došli među svoje vodiče — podrška uz umjetnu inteligenciju kojoj se možete obratiti kad god vam zatreba. Odaberite glas koji vam danas najviše odgovara.",
    plan: "Ovo je vaš prilagođeni plan od osam tjedana, napravljen prema onome što ste nam rekli o svom životu, energiji i ciljevima. Razvija se iz tjedna u tjedan, počinje nježno i dodaje praktične korake tempom koji vam odgovara. Ovdje sam da vam pomognem razumjeti svaki tjedan, odgovorim na pitanja i primijetite svoj napredak bez pritiska i osuđivanja.",
    program: "Pozdrav, ja sam Juan, osnivač The Resilience Hub-a. Ovaj je program besplatan i napravljen za vas. Slušamo gdje se nalazite, pružamo praktičnu podršku vašim tempom i povezujemo vas s pravim ljudima. Ako trebate pomoć, pošaljite poruku pravom Juanu, razgovarajte s AI vodičem ili upotrijebite Pomoć odmah za hitnu ljudsku podršku.",
    planChoice: "Prije nego nastavimo, želite li da Carlos za vas sastavi osobni plan od osam tjedana? Postavit ću vam nekoliko pitanja kako bi odgovarao onome kroz što prolazite. Ako zasad želite koristiti vodiče i Alatke, i to je potpuno u redu.",
    chat: "Pozdrav, ja sam vaš AI vodič. Uzmite vremena — možemo razgovarati vašim tempom.",
    resources: "Bok, ja sam Rex. Support Directory okuplja pomoć u krizi, zdravstvene usluge, smještaj, hranu, programe oporavka, zajedničke grupe i drugu lokalnu podršku. Možeš pregledavati prema potrebi ili koristiti polje za pretraživanje — upiši što tražiš svojim riječima, npr. nekoga za razgovor, smještaj ili hranu, i pokazat ću ti odgovarajuće usluge. Uzmi si vremena; ne moraš prvo znati ime neke usluge.",
    campfire: "Bok, ja sam Rex. Prije nego što uđeš, evo kako možeš koristiti Campfire: možeš jednostavno promatrati i slušati bez uključivanja, uključiti se u tekstualni chat ili koristiti glasovni chat kad se osjećaš spremno. Postoji i značajka video chata unutar aplikacije ako želiš povezati se licem u lice — ti biraš s kim ćeš razgovarati i ta osoba mora prihvatiti. Jedan blagi podsjetnik: budući da je Campfire koji si odabrao/odabrala povezan s tvojim pristupom, tvoj izbor Campfirea je zaključan. Ako ikada budeš trebala drugačiji prostor, molim te razgovaraj s Juanom ili kontaktiraj tim The Resilience Hub. Uzmi svoje vrijeme — slobodno dolazi i odlaziš kako ti treba."
  },
  "ko-KR": {
    toolkit: "도구 상자에 오신 것을 환영합니다. 필요할 때 도움이 될 수 있는 여러 가지가 있어요. 천천히 둘러보고 오늘 마음에 맞는 것을 골라 보세요.",
    guides: "가이드 공간에 오신 것을 환영합니다. 필요할 때 찾을 수 있는 AI 기반 지원팀이에요. 오늘 편안하게 느껴지는 목소리를 골라 보세요.",
    plan: "이것은 여러분의 삶과 에너지, 이루고 싶은 목표에 대해 알려주신 내용을 바탕으로 만든 맞춤형 8주 계획입니다. 매주 조금씩 나아가며, 처음에는 부드럽게 시작하고 여러분에게 맞는 속도로 실천적인 단계를 더해 갑니다. 매주 내용을 이해하고 질문에 답하며, 부담이나 판단 없이 여러분의 발전을 알아차릴 수 있도록 도와드릴게요.",
    program: "안녕하세요. 저는 The Resilience Hub의 설립자 Juan입니다. 이 프로그램은 무료이며 여러분을 중심으로 만들어졌습니다. 지금 어떤 상황인지 듣고, 여러분의 속도에 맞춰 실질적인 지원을 제공하며, 알맞은 사람들과 연결해 드립니다. 도움이 필요하면 실제 Juan에게 메시지를 보내거나 AI 가이드와 이야기하거나 긴급한 사람의 도움을 위해 Help Now를 이용하세요.",
    planChoice: "계속하기 전에 Carlos가 여러분을 위한 맞춤형 8주 계획을 만들어 드릴까요? 지금 겪고 있는 일에 맞도록 몇 가지 질문을 드릴게요. 당장은 가이드와 도구 상자만 사용하고 싶다면 그것도 괜찮습니다.",
    chat: "안녕하세요. 저는 여러분의 AI 가이드입니다. 천천히 하세요. 여러분의 속도에 맞춰 이야기할 수 있어요.",
    resources: "안녕하세요, 저는 Rex입니다. Support Directory는 위기 지원, 의료 서비스, 주거, 식료품 지원, 회복 프로그램, 지역 커뮤니티 그룹 등 지역의 다양한 도움 자원을 모아놓은 곳입니다. 필요별로 찾아보거나 검색창을 사용하실 수 있어요 — 누군가와 이야기할 사람, 주거 또는 식료품처럼 평소 말하듯 원하는 것을 입력하면 관련 서비스를 보여드릴게요. 천천히 둘러보세요; 먼저 서비스 이름을 알 필요는 없습니다.",
    campfire: "안녕하세요, 저는 Rex입니다. 입장하기 전에 Campfire를 이용하는 방법을 안내드릴게요: 참여하지 않고 그냥 보고 듣기만 하실 수 있고, 텍스트 채팅에 참여하거나 준비가 되셨을 때 음성 채팅을 이용하실 수 있습니다. 얼굴을 보고 연결하고 싶다면 앱 내 화상 채팅 기능도 있는데, 대화를 나눌 상대를 직접 선택하시면 되고 상대의 수락이 필요합니다. 한 가지 부드러운 안내 말씀 드리자면: 선택하신 Campfire는 여러분의 접근 권한과 연결되어 있어 선택이 고정됩니다. 다른 공간이 필요하시면 언제든 Juan이나 Hub 팀에 말씀해 주세요. 천천히 하세요 — 필요할 때 언제든 오고 가실 수 있습니다."
  },
  "ja-JP": {
    toolkit: "ツールキットへようこそ。必要なときに役立つものを集めています。急がずに、今日の自分に合うものを選んでください。",
    guides: "ガイドのページへようこそ。必要なときに頼れるAIガイドのサポートです。今日は安心できる声を選んでください。",
    plan: "これは、あなたが話してくれた生活、エネルギー、目指したいことをもとに作る、あなた専用の8週間プランです。毎週少しずつ進み、最初は無理なく、あなたに合うペースで実践的な一歩を加えていきます。毎週の内容を理解し、質問に答え、プレッシャーや批判なく進歩に気づけるように、ここで支えます。",
    program: "こんにちは。The Resilience Hubの創設者、Juanです。このプログラムは無料で、あなたを中心に作られています。今の状況を聞き、あなたのペースで実際的なサポートを考え、適切な人につなぎます。助けが必要なときは、本物のJuanにメッセージを送るか、AIガイドに話しかけるか、緊急の人の支援にはHelp Nowを使ってください。",
    planChoice: "先に進む前に、Carlosにあなた専用の8週間プランを作ってもらいませんか。今抱えていることに合わせるため、いくつか質問します。まずはガイドやツールキットだけ使いたい場合も、もちろん大丈夫です。",
    chat: "こんにちは。あなたのAIガイドです。急がなくて大丈夫。あなたのペースで話しましょう。",
    resources: "こんにちは、レックスです。サポートディレクトリは、危機対応、医療サービス、住まい、食料、リカバリー、コミュニティグループなどの地域の支援をまとめています。必要に応じて項目別に探せますし、検索ボックスを使っても構いません — 「話し相手」「住まい」「食べ物」のように自分の言葉で探してみてください。該当するサービスをお見せします。慌てずで大丈夫、最初にサービス名を知らなくてもOKです。",
    campfire: "こんにちは、レックスです。入る前に、Campfireの利用方法をお伝えします：見て聞くだけで参加しなくても大丈夫ですし、テキストチャットに参加することも、準備ができたらボイスチャットを使うこともできます。対面でつながりたい場合はアプリ内のビデオチャット機能もあります—話したい相手を自分で選び、その相手の承認が必要です。ひとつだけお知らせがあります：選択したCampfireはあなたのアクセスに紐づいているため、その選択は固定されます。もし別のスペースが必要なら、JuanかHubチームにご相談ください。どうぞご自分のペースで—必要なときに出入りして構いません。"
  },
  "id-ID": {
    toolkit: "Selamat datang di Toolkit — kumpulan hal yang bisa membantu saat kamu membutuhkannya. Luangkan waktu dan pilih yang terasa tepat untukmu hari ini.",
    guides: "Selamat datang di panduanmu — dukungan berbasis AI dari tim yang bisa kamu datangi kapan pun kamu butuh. Pilih suara yang terasa nyaman hari ini.",
    plan: "Ini adalah rencana delapan minggu yang dibuat khusus untukmu, berdasarkan cerita tentang hidup, energi, dan tujuanmu. Rencana ini berkembang setiap minggu, dimulai dengan lembut dan menambahkan langkah praktis sesuai ritmemu. Aku di sini untuk membantu memahami setiap minggu, menjawab pertanyaan, dan melihat kemajuanmu tanpa tekanan atau penilaian.",
    program: "Hai, aku Juan, pendiri The Resilience Hub. Program ini gratis dan dibuat untukmu. Kami mendengarkan keadaanmu, memberi dukungan praktis sesuai ritmemu, dan menghubungkanmu dengan orang yang tepat. Jika butuh bantuan, kirim pesan kepada Juan yang asli, bicara dengan panduan AI, atau gunakan Help Now untuk dukungan manusia yang mendesak.",
    planChoice: "Sebelum melanjutkan, apakah kamu ingin Carlos membuat rencana delapan minggu yang khusus untukmu? Aku akan menanyakan beberapa hal agar sesuai dengan yang sedang kamu hadapi. Jika ingin memakai panduan dan Toolkit dulu, itu juga tidak apa-apa.",
    chat: "Hai, aku panduan AI-mu. Santai saja — kita bisa berbicara dengan ritmemu.",
    resources: "Hai, saya Rex. Support Directory mengumpulkan bantuan krisis, layanan kesehatan, perumahan, makanan, pemulihan, kelompok komunitas, dan dukungan lokal lainnya. Anda bisa mencari berdasarkan kebutuhan atau pakai kotak pencarian — ketik apa yang Anda cari dengan kata-kata sendiri, misalnya seseorang untuk diajak bicara, perumahan, atau makanan, dan saya akan menunjukkan layanan yang sesuai. Ambil waktu Anda; Anda tidak perlu tahu nama layanan terlebih dulu.",
    campfire: "Hai, saya Rex. Sebelum masuk, ini cara-cara kamu bisa menggunakan Campfire: kamu bisa hanya menonton dan mendengarkan tanpa ikut, bergabung ke obrolan teks, atau menggunakan obrolan suara ketika kamu siap. Ada juga fitur obrolan video dalam aplikasi jika kamu ingin terhubung tatap muka — kamu memilih siapa yang diajak bicara, dan mereka harus menerima. Satu pengingat lembut: karena Campfire yang kamu pilih terkait dengan aksesmu, pilihan Campfire itu dikunci. Jika kamu membutuhkan ruang lain, silakan bicara dengan Juan atau hubungi tim The Resilience Hub. Ambil waktumu — kamu dipersilakan untuk datang dan pergi sesuai kebutuhan."
  },
  "th-TH": {
    toolkit: "ยินดีต้อนรับสู่ชุดเครื่องมือ ที่รวมสิ่งต่าง ๆ ซึ่งช่วยคุณได้เมื่อจำเป็น ค่อย ๆ ดูและเลือกสิ่งที่เหมาะกับคุณในวันนี้ได้เลย",
    guides: "ยินดีต้อนรับสู่ผู้แนะนำของคุณ นี่คือการสนับสนุนด้วย AI จากทีมที่คุณติดต่อได้เมื่อจำเป็น เลือกเสียงที่ทำให้คุณรู้สึกสบายในวันนี้",
    plan: "นี่คือแผนแปดสัปดาห์ที่ออกแบบเฉพาะสำหรับคุณ จากสิ่งที่คุณเล่าเกี่ยวกับชีวิต พลังงาน และเป้าหมายของคุณ แผนจะค่อย ๆ พัฒนาในแต่ละสัปดาห์ เริ่มอย่างอ่อนโยนและเพิ่มขั้นตอนที่ทำได้จริงตามจังหวะของคุณ ฉันอยู่ตรงนี้เพื่อช่วยให้คุณเข้าใจแต่ละสัปดาห์ ตอบคำถาม และมองเห็นความก้าวหน้าโดยไม่กดดันหรือตัดสิน",
    program: "สวัสดี ฉันชื่อ Juan ผู้ก่อตั้ง The Resilience Hub โปรแกรมนี้ฟรีและสร้างขึ้นเพื่อคุณ เรารับฟังสถานการณ์ของคุณ ให้การสนับสนุนที่ทำได้จริงตามจังหวะของคุณ และช่วยเชื่อมต่อคุณกับคนที่เหมาะสม หากต้องการความช่วยเหลือ ให้ส่งข้อความหา Juan ตัวจริง พูดคุยกับผู้แนะนำ AI หรือใช้ Help Now เพื่อรับการช่วยเหลือฉุกเฉินจากคนจริง",
    planChoice: "ก่อนจะไปต่อ คุณอยากให้ Carlos จัดทำแผนแปดสัปดาห์เฉพาะสำหรับคุณไหม ฉันจะถามคำถามเล็กน้อยเพื่อให้แผนเหมาะกับสิ่งที่คุณกำลังเผชิญ หากอยากใช้ผู้แนะนำและชุดเครื่องมือไปก่อน ก็ไม่เป็นไรเลย",
    chat: "สวัสดี ฉันคือผู้แนะนำ AI ของคุณ ค่อย ๆ ไปได้เลย เราคุยกันตามจังหวะของคุณได้",
    resources: "สวัสดี ฉันชื่อ Rex ไดเรกทอรีช่วยเหลือนำรวมบริการช่วยในภาวะวิกฤต บริการด้านสุขภาพ ที่พัก อาหาร การฟื้นฟู กลุ่มชุมชน และการช่วยเหลือท้องถิ่นอื่นๆ คุณสามารถเรียกดูตามความต้องการหรือใช้ช่องค้นหา — พิมพ์สิ่งที่คุณกำลังมองหาเป็นคำของคุณเอง เช่น คนให้คุยด้วย ที่พัก หรืออาหาร แล้วฉันจะแสดงบริการที่ตรงกันให้ ไม่ต้องรีบ; คุณไม่จำเป็นต้องรู้ชื่อบริการก่อนก็ได้",
    campfire: "สวัสดี ผมชื่อ Rex ก่อนเข้ามา ขอแนะนำวิธีการใช้ Campfire: คุณสามารถแค่นั่งดูและฟังโดยไม่เข้าร่วม พิมพ์คุยในแชทข้อความ หรือใช้แชทเสียงเมื่อพร้อม นอกจากนี้มีฟีเจอร์วิดีโอแชทในแอปถ้าต้องการเชื่อมต่อแบบเห็นหน้า — คุณเป็นคนเลือกว่าจะคุยกับใคร และอีกฝ่ายต้องกดยอมรับ ขอย้ำอย่างอ่อนโยน: เพราะ Campfire ที่คุณเลือกเชื่อมกับการเข้าถึงของคุณ ตัวเลือก Campfire จะถูกล็อกไว้ หากต้องการพื้นที่อื่น โปรดคุยกับ Juan หรือ ติดต่อทีม The Resilience Hub ใช้เวลาตามสบาย — คุณสามารถเข้ามาและออกได้ตามต้องการ."
  }
};
function spokenIntro(key, fallback, lang = __speechLang) {
  return localizedSpeech(key, AUTO_INTRO_SPEECH[lang]?.[key] || AUTO_INTRO_SPEECH["en-AU"][key] || fallback);
}

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
        if (ok) __audioUnlocked = true;
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
async function fetchTtsUrl(text, voiceId, languageCode = __speechLang, voiceGender = "MALE") {
  const lang = languageCode || __speechLang;
  const gender = voiceGender === "FEMALE" ? "FEMALE" : "MALE";
  const key = lang + "|" + gender + "|" + voiceId + "|" + text;
  const hit = __ttsCache.get(key);
  if (hit) return hit;
  const pending = __ttsPending.get(key);
  if (pending) return pending;
  const request = (async () => {
    let lastError;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voiceId, languageCode: lang, voiceGender: gender }),
        });
        if (!res.ok) throw new Error(`tts_failed_${res.status}`);
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
      } catch (error) {
        lastError = error;
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 300 : 900));
      }
    }
    throw lastError || new Error("tts_failed");
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

function splitForTts(text, maxChars = 260) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const sentences = clean.match(/[^.!?…]+[.!?…]+(?:["')\]]+)?|\S[^.!?…]*$/g) || [clean];
  const chunks = [];
  let cur = "";
  const pushWords = (value) => {
    const words = String(value || "").trim().split(/\s+/).filter(Boolean);
    for (const word of words) {
      const candidate = (cur ? cur + " " : "") + word;
      if (candidate.length > maxChars && cur.trim()) {
        chunks.push(cur.trim());
        cur = word;
      } else cur = candidate;
    }
  };
  for (const s0 of sentences) {
    const s = s0.trim();
    if (!s) continue;
    if (((cur ? cur + " " : "") + s).length > maxChars && cur.trim()) {
      chunks.push(cur.trim()); cur = "";
    }
    // A single long sentence is split safely at word boundaries rather than
    // sent as an oversized TTS request that can be truncated by a provider.
    if (s.length > maxChars) pushWords(s);
    else cur = (cur ? cur + " " : "") + s;
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks;
}

function stopGuideSpeechForCall() {
  try { window.dispatchEvent(new Event("rh:stop-voice")); } catch {}
}

function useVoice(voiceOn) {
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const audioRef = useRef(null);
  const reqRef = useRef(0);
  const playbackRef = useRef(0);
  const recoveryTimerRef = useRef(null);
  const manualPauseRef = useRef(false);

  const stop = useCallback(() => {
    // Invalidate pending TTS fetches as well as the audio currently attached to
    // the element. Without this generation guard, a late chunk can restart
    // after a route change, replay tap, or emergency-call stop.
    playbackRef.current += 1;
    __synthEpoch++;
    manualPauseRef.current = false;
    if (recoveryTimerRef.current) { clearTimeout(recoveryTimerRef.current); recoveryTimerRef.current = null; }
    try { if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel(); } catch {}
    try {
      if (audioRef.current) {
        const a = audioRef.current;
        a.onplay = null; a.onpause = null; a.onstalled = null; a.onwaiting = null; a.onended = null; a.onerror = null; // no queued event can fire after this
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

  // Emergency calls take priority over every guide voice request, including
  // audio that is still being fetched or queued for playback.
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const stopForCall = () => stop();
    window.addEventListener("rh:stop-voice", stopForCall);
    return () => window.removeEventListener("rh:stop-voice", stopForCall);
  }, [stop]);

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
          manualPauseRef.current = false;
          const p = a.play();
          if (p && p.catch) p.catch(() => { if (audioRef.current === a) audioRef.current = null; setPaused(false); });
          setPaused(false);
        } else { manualPauseRef.current = true; a.pause(); setPaused(true); }
        return true;
      }
      if (typeof window !== "undefined" && window.speechSynthesis && window.speechSynthesis.speaking) {
        if (window.speechSynthesis.paused) { manualPauseRef.current = false; window.speechSynthesis.resume(); setPaused(false); }
        else { manualPauseRef.current = true; window.speechSynthesis.pause(); setPaused(true); }
        return true;
      }
    } catch {}
    return false;
  }, []);

  const browserSpeak = useCallback((text, char, onDone) => {
    if (typeof window === "undefined" || !window.speechSynthesis) { if (onDone) onDone(); return; }
    const myEpoch = ++__synthEpoch;
    manualPauseRef.current = false;
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
        u.onpause = () => {
          if (myEpoch !== __synthEpoch || manualPauseRef.current) return;
          setTimeout(() => {
            if (myEpoch === __synthEpoch && !manualPauseRef.current && window.speechSynthesis?.paused) {
              try { window.speechSynthesis.resume(); } catch {}
            }
          }, 650);
        };
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
    const myPlayback = playbackRef.current;
    const stale = () => myReq !== reqRef.current || myPlayback !== playbackRef.current;

    // Prefer natural voices when the guide has a voiceId; fall back to the
    // browser voice if the key isn't set, the call fails, or playback is blocked.
    if (char && char.voiceId) {
      // Carlos’s natural voice sounds better when it can carry a few related
      // sentences in one clip. Short 260-character chunks create an audible
      // fetch/load handoff between nearly every sentence. Keep the shorter
      // chunks for the other guides so their first response still starts fast.
      const chunks = splitForTts(text, Number(char.ttsMaxChars) || (char.slug === "carlos" ? 440 : 260));
      const first = chunks[0] || text;
      // The first TTS request after a long break can include a cold serverless
      // function, provider connection, and Android audio wake-up. Do not mistake
      // that normal cold-start window for a missing Google voice.
      const firstVoiceWait = String(char.voiceId).startsWith("fish:") ? 9000 : 8000;
      try {
        // Start the first short request immediately. The remaining response no
        // longer blocks the first spoken sentence; the next chunk is warmed in
        // parallel while this one is synthesising/playing.
        // Warm every remaining chunk in parallel. Previously only the second
        // chunk was prefetched, so longer replies could pause after sentence
        // two while the following audio was still being generated.
        const chunkPromises = chunks.map(() => null);
        if (chunks.length) chunkPromises[0] = fetchTtsUrl(chunks[0], char.voiceId, __speechLang, char.voiceGender);
        const playChunk = async (index, urlPromise, retry = 0) => {
          if (stale()) return;
          const chunk = chunks[index] || text;
          // A Fish clone is natural for its English persona. In another
          // selected language the server deliberately uses Google multilingual
          // TTS instead, so browser speech is an appropriate final fallback.
          let url;
          try {
            const audioPromise = urlPromise || fetchTtsUrl(chunk, char.voiceId, __speechLang, char.voiceGender);
            if (index === 0) {
              const firstResult = await Promise.race([
                audioPromise.then((value) => ({ kind: "audio", value })),
                new Promise((resolve) => setTimeout(() => resolve({ kind: "timeout" }), firstVoiceWait)),
              ]);
              if (firstResult.kind === "timeout") {
                audioPromise.catch(() => {});
                if (!stale()) browserSpeak(text, char, onDone);
                return;
              }
              url = firstResult.value;
            } else url = await audioPromise;
          }
          catch {
            if (!stale()) {
              const continueAfterFallback = index + 1 < chunks.length
                ? () => playChunk(index + 1, chunkPromises[index + 1])
                : onDone;
              browserSpeak(chunk, char, continueAfterFallback);
            }
            return;
          }
          if (stale()) return;
          if (index + 1 < chunks.length && !chunkPromises[index + 1]) {
            chunkPromises[index + 1] = fetchTtsUrl(chunks[index + 1], char.voiceId, __speechLang, char.voiceGender);
          }
          const audio = getTtsAudio() || new Audio();
          audioRef.current = audio;
          const continueAfterChunk = index + 1 < chunks.length
            ? () => playChunk(index + 1, chunkPromises[index + 1])
            : onDone;
          const scheduleAudioRecovery = () => {
            if (recoveryTimerRef.current || manualPauseRef.current || stale() || audio.ended) return;
            // Do not interfere with the initial load/play handshake. This path is
            // only for a clip that was already making progress and then stalled.
            if (audio.currentTime <= 0.05) return;
            recoveryTimerRef.current = setTimeout(() => {
              recoveryTimerRef.current = null;
              if (stale() || manualPauseRef.current || audioRef.current !== audio || audio.ended) return;
              try {
                const retryPlay = audio.play();
                if (retryPlay?.catch) {
                  retryPlay.catch(() => {
                    if (!stale() && audioRef.current === audio && !manualPauseRef.current) {
                      browserSpeak(chunk, char, continueAfterChunk);
                    }
                  });
                }
              } catch {
                if (!stale() && audioRef.current === audio && !manualPauseRef.current) {
                  browserSpeak(chunk, char, continueAfterChunk);
                }
              }
            }, 650);
          };
          audio.onplay = () => { if (recoveryTimerRef.current) { clearTimeout(recoveryTimerRef.current); recoveryTimerRef.current = null; } manualPauseRef.current = false; try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch {} __lastVoiceAt = Date.now(); setSpeaking(true); };
          audio.onpause = scheduleAudioRecovery;
          audio.onstalled = scheduleAudioRecovery;
          audio.onwaiting = scheduleAudioRecovery;
          audio.onended = () => {
            if (recoveryTimerRef.current) { clearTimeout(recoveryTimerRef.current); recoveryTimerRef.current = null; }
            if (stale()) return;
            if (audioRef.current === audio) audioRef.current = null;
            if (index + 1 < chunks.length) {
              // Fetch the following chunk just-in-time; the prior prefetch makes
              // this normally a cache hit and keeps the transition quick.
              if (!chunkPromises[index + 1]) chunkPromises[index + 1] = fetchTtsUrl(chunks[index + 1], char.voiceId, __speechLang, char.voiceGender);
              playChunk(index + 1, chunkPromises[index + 1]);
            } else {
              setSpeaking(false);
              if (onDone) onDone();
            }
          };
          audio.onerror = () => {
            if (audioRef.current === audio) audioRef.current = null;
            if (stale()) return;
            // A transient iOS/network decode error should not turn into a
            // half-finished sentence. Retry this exact chunk once before using
            // the browser voice fallback or moving on.
            if (retry < 1) {
              setTimeout(() => { if (!stale()) playChunk(index, urlPromise, retry + 1); }, 120);
              return;
            }
            if (index + 1 < chunks.length) browserSpeak(chunk, char, continueAfterChunk);
            else { setSpeaking(false); browserSpeak(chunk, char, onDone); }
          };
          try {
            audio.src = url;
            audio.currentTime = 0;
            try { audio.load(); } catch {}
            await audio.play();
            return;
          }
          catch {
            try {
              if (!__audioUnlocked) await primeAudio();
              if (stale()) return;
              audio.src = url;
              audio.currentTime = 0;
              try { audio.load(); } catch {}
              await audio.play();
              return;
            }
            catch {
              if (!stale()) {
                const continueAfterFallback = index + 1 < chunks.length
                  ? () => playChunk(index + 1, chunkPromises[index + 1])
                  : onDone;
                browserSpeak(chunk, char, continueAfterFallback);
              }
            }
          }
        };
        await playChunk(0, chunkPromises[0]);
        return;
      } catch { /* fall through to browser voice */ }
      if (stale()) return;
    }
    browserSpeak(text, char, onDone);
  }, [voiceOn, stop, browserSpeak]);

  // Warm the cache for a line we're about to need (no playback).
  const prefetch = useCallback((text, char) => {
    if (!voiceOn || !text || !char || !char.voiceId) return;
    fetchTtsUrl(text, char.voiceId, __speechLang, char.voiceGender).catch(() => {});
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
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent || "") || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    let r;
    try { r = new SR(); } catch { setErr("Couldn't start the mic."); setListening(false); return; }
    voiceDebug("tap session created");
    // Android Chrome can replay finalized results when a continuous session is
    // auto-restarted. One recognition session per tap is more reliable than
    // trying to keep the microphone alive indefinitely; onend submits the text
    // that was captured so a long pause cannot create duplicate paragraphs.
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
      } else if (e && e.error) {
        voiceDebug("tap recognition error", e.error);
      }
    };
    r.onend = () => {
      recRef.current = null;
      // On iPhone, tapping to stop can arrive while the last phrase is still
      // interim. Keep it rather than silently submitting an empty message.
      const seg = (sessionFinal || interimText).trim();
      if (seg) committedRef.current = (committedRef.current + " " + seg).trim();
      sessionFinal = ""; interimText = "";
      if (heldRef.current && isIOS) {
        // Chain short sessions while the button remains active, but yield to
        // WebKit briefly so it can release the previous recognition instance.
        setTimeout(() => { if (heldRef.current && !recRef.current) runSession(); }, 60);
        return;
      }
      heldRef.current = false;
      clearInterval(watchdog.current);
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
    // Start inside the original tap gesture. Waiting for getUserMedia() or a
    // timeout before calling SpeechRecognition.start() can lose WebKit's user
    // activation and leave the button red but completely silent.
    runSession();
    // If the just-finished guide audio left iOS's audio session in playback mode,
    // use the microphone wake-up only as a recovery attempt after the immediate
    // start has failed. This path never delays the first recognition attempt.
    setTimeout(() => {
      if (!heldRef.current || recRef.current) return;
      wakeMic().then(() => { if (heldRef.current && !recRef.current) runSession(); });
    }, 180);
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
        onPointerDown={(event) => { event.preventDefault(); toggle(); }}
        onContextMenu={(event) => event.preventDefault()}
        aria-label={listening ? "Tap to stop and send" : "Tap to talk"}
        style={{ width: size, height: size, borderRadius: "50%", border: "none", cursor: "pointer",
          background: listening ? "#e5484d" : "#fff", color: listening ? "#fff" : T.ink,
          boxShadow: T.soft, display: "grid", placeItems: "center",
          animation: listening ? "rh-glow 1.2s ease-in-out infinite" : "none", touchAction: "none",
          userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none",
          WebkitTapHighlightColor: "transparent" }}>
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

// Map plan wording to an in-app destination. This is deliberately conservative:
// only tasks that clearly name a Hub feature receive an action link.
function taskToolKey(label) {
  const text = String(label || "");
  if (/games?\s*(?:&|and)\s*puzzles?|play one of the games/i.test(text)) return "games";
  if (/journal|fleeting thought|write or voice/i.test(text)) return "journal";
  if (/box breathing|breathing exercise|breath/i.test(text)) return "breathing";
  if (/grounding|5-4-3-2-1/i.test(text)) return "grounding";
  if (/meditation/i.test(text)) return "meditation";
  if (/affirmation|steadying words|kinder self-talk/i.test(text)) return "affirmations";
  if (/quick calm|calm tool/i.test(text)) return "calm";
  if (/open the toolkit|use the toolkit/i.test(text)) return "toolkit";
  return null;
}

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
      <div className="rh-guide-chat-header">
        <div className="rh-guide-chat-avatar" style={{ background: `radial-gradient(120% 100% at 50% 20%, #fff, ${char.tint})`, boxShadow: speaking ? `0 0 0 3px rgba(55,160,101,0.3)` : undefined }}>
          <img src={char.img} alt={char.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{char.name}</div>
            <span style={{ flexShrink: 0, borderRadius: 999, padding: "3px 7px", background: char.tint, color: T.greenDk, fontSize: 10, fontWeight: 800 }}>AI GUIDE</span>
          </div>
          <div style={{ fontSize: 12, color: T.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>{char.role}</div>
        </div>
        <button onClick={() => { setSearchOpen((v) => !v); if (searchOpen) setSearch(""); }} aria-label="Search this chat" title="Search this chat"
          style={{ background: searchOpen ? T.green : "#f7fbf8", border: `1px solid ${searchOpen ? T.green : T.line}`,
            borderRadius: 999, width: 40, height: 40, display: "grid", placeItems: "center", cursor: "pointer",
            color: searchOpen ? "#fff" : T.ink, flexShrink: 0 }}>
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
      <div className="rh-guide-chat-disclosure">
        <Shield size={15} color={T.tealDk} style={{ flexShrink: 0, marginTop: 2 }} />
        <div><strong style={{ color: T.ink }}>Private AI guide chat.</strong> {CONVERSATION_PRIVACY_NOTICE}</div>
      </div>
      <div ref={scrollRef} className="rh-guide-chat-messages" style={{ flex: 1, overflowY: "auto", display: "flex",
        flexDirection: "column", gap: 10, minHeight: 260 }}>
        {history.length === 0 && (
          <div style={{ textAlign: "center", padding: "16px 8px" }}>
            <Portrait src={char.img} name={char.name} size={140} speaking={false} tint={char.tint} />
            <p style={{ fontSize: 14, color: T.sub, margin: "12px auto", maxWidth: 280 }}>
              Say hi to {char.name}. Your conversation is private to your Resilience Hub experience, and you stay in control of what is shared with the human team.
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
              {(Array.isArray(m.images) ? m.images : (m.image ? [{ dataUrl: m.image, page: 1 }] : [])).map((page, pageIndex) => (
                <div key={page.page || pageIndex} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
                  <img src={page.dataUrl} alt={`Document page ${page.page || pageIndex + 1}`} style={{ maxWidth: "60%", maxHeight: 220, borderRadius: 14, marginBottom: 3, boxShadow: T.soft, display: "block", objectFit: "contain" }} />
                  {((m.images && m.images.length > 1) || page.page) && <span style={{ fontSize: 10.5, color: T.sub, marginBottom: 5 }}>Page {page.page || pageIndex + 1}</span>}
                </div>
              ))}
              <div data-rh-no-localize
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
                className="rh-guide-chat-bubble"
                data-role={m.role}
                style={{ cursor: m.role === "assistant" ? "pointer" : "default" }}>{m.content}</div>
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
        {streamingReply && (
          <div style={{ alignSelf: "flex-start", maxWidth: "min(82%, 620px)" }}>
            <div className="rh-guide-chat-bubble" data-role="assistant">{streamingReply}</div>
          </div>
        )}
        {busy && <div style={{ fontSize: 13, color: T.sub, paddingLeft: 4 }}>{streamingReply ? `${char.name} is replying…` : `${char.name} is thinking…`}</div>}
        {err && <div style={{ fontSize: 13, color: "#c0392b", background: "#fdecec", borderRadius: 12, padding: "8px 12px" }}>{err}</div>}
      </div>

      {crisisActive && <CrisisInterception onDismiss={() => setCrisisActive(false)} />}

      {pendingImages.length > 0 && (
        <div style={{ background: T.card, borderRadius: 14, padding: 10, boxShadow: T.soft, marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ flex: 1, fontSize: 13, color: T.sub, fontWeight: 700 }}>{pendingImages.length} page{pendingImages.length === 1 ? "" : "s"} ready to send</span>
            <span style={{ fontSize: 10.5, color: T.sub }}>Up to {GUIDE_MAX_IMAGES}</span>
            <button onClick={() => setPendingImages([])} aria-label="Remove all pages" style={{ background: "none", border: "none", color: T.sub, cursor: "pointer", padding: 4, fontSize: 11 }}>Clear</button>
          </div>
          <div style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 2 }}>
            {pendingImages.map((page, pageIndex) => (
              <div key={`${page.name}-${pageIndex}`} style={{ position: "relative", flex: "0 0 auto" }}>
                <img src={page.dataUrl} alt={`Page ${pageIndex + 1}`} style={{ width: 54, height: 54, borderRadius: 9, objectFit: "cover", border: `1px solid ${T.line}` }} />
                <span style={{ position: "absolute", left: 3, bottom: 3, background: "rgba(36,66,56,.82)", color: "#fff", borderRadius: 5, padding: "1px 4px", fontSize: 9 }}>{pageIndex + 1}</span>
                <button onClick={() => setPendingImages((prev) => prev.filter((_, i) => i !== pageIndex))} aria-label={`Remove page ${pageIndex + 1}`} style={{ position: "absolute", right: -5, top: -5, width: 19, height: 19, borderRadius: "50%", border: "1px solid #fff", background: "#c54848", color: "#fff", display: "grid", placeItems: "center", cursor: "pointer", padding: 0 }}><X size={11} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rh-guide-chat-composer">
        <div className="rh-guide-chat-composer-row">
          <HoldToTalk onText={(t) => send(t)} onStart={stop} size={42} />
          <button className="rh-guide-chat-tool" onClick={() => imgFileRef.current && imgFileRef.current.click()} aria-label={`Attach up to ${GUIDE_MAX_IMAGES} document pages`} title={`Attach up to ${GUIDE_MAX_IMAGES} document pages`}>
            <Plus size={20} />
          </button>
          <input ref={imgFileRef} type="file" accept="image/*" multiple onChange={pickPhoto} style={{ display: "none" }} />
          <textarea className="rh-guide-chat-input" ref={composerRef} value={input} onChange={(e) => setInput(e.target.value)} rows={1}
            aria-label={`Message ${char.name}. Press Enter for a new line; press Enter twice to send.`}
            onKeyDown={(e) => {
              if (e.key !== "Enter") { lastEnterAtRef.current = 0; return; }
              if (e.shiftKey || e.isComposing) { lastEnterAtRef.current = 0; return; }
              const now = Date.now();
              if (now - lastEnterAtRef.current < 500) {
                e.preventDefault();
                lastEnterAtRef.current = 0;
                send();
              } else {
                lastEnterAtRef.current = now;
              }
            }}
            placeholder={pendingImages.length ? "Say something about these pages (optional)…" : `Message ${char.name}…`}
            style={{ resize: "none", fontSize: 15, lineHeight: 1.45, minHeight: 42, maxHeight: "min(260px, calc(100dvh - 300px))", overflowY: "auto", color: T.ink, fontFamily: "inherit" }} />
          <button className="rh-guide-chat-tool" onClick={() => send(undefined, { forceFast: true })} disabled={(!input.trim() && !pendingImages.length) || busy}
            aria-label="Fast Reply — send this message and get a quick, direct answer" title="Fast Reply — quick, direct answer just for this message" style={{ color: T.blueDk }}>
            <Zap size={17} />
          </button>
          <button className="rh-guide-chat-send" onClick={() => send()} disabled={(!input.trim() && !pendingImages.length) || busy} aria-label="Send">
            <Send size={18} />
          </button>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "4px 5px 0", color: T.sub, fontSize: 10.5 }}>
          <span>Tap the mic to talk</span>
          <span>Enter twice to send</span>
        </div>
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
        <h2 style={{ fontSize: 18, margin: 0 }}>Book a 1-1 chat with Juan</h2>
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

function BugReport({ session, userPublicKey, onBack }) {
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
        screenshotPath = `${userFolder}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.rh-encrypted.json`;
        const { error: uploadError } = await supabase.storage.from("bug-screenshots").upload(screenshotPath, photo, { contentType: photo.type, upsert: false });
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
        method: "POST", headers: await pushHeaders(),
        body: JSON.stringify({ toAdmins: true, title: "New bug report", body: "A new encrypted bug report is waiting in the staff inbox.", target: "adminBugReports", url: "/?open=adminBugReports" }),
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

function UserFeedback({ session, userPublicKey, onBack }) {
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
        description: message,
        user_id: session?.user?.id || null,
      });
      if (error) throw error;
      setSent(true);
      fetch("/api/push", {
        method: "POST", headers: await pushHeaders(), keepalive: true,
        body: JSON.stringify({ toAdmins: true, title: "New user feedback", body: "A new encrypted user-feedback message is waiting in the staff inbox.", target: "adminBugReports", url: "/?open=adminBugReports" }),
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
  const [activeVideo, setActiveVideo] = useState(null);
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
            <button key={video.url} type="button" onClick={() => setActiveVideo(video)} aria-label={`Watch ${video.title}`}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, background: index % 2 === 0 ? "linear-gradient(110deg, rgba(255,255,255,0.9), rgba(238,249,241,0.94))" : "linear-gradient(110deg, rgba(255,255,255,0.86), rgba(255,245,235,0.94))", borderRadius: 15, padding: 11, border: "1px solid rgba(55,128,82,0.14)", textAlign: "left", color: T.ink, boxShadow: "0 4px 12px rgba(47,97,72,0.05)", cursor: "pointer" }}>
              <div style={{ width: 37, height: 37, borderRadius: 11, background: index % 2 === 0 ? "linear-gradient(145deg, #3f9d68, #8acb8c)" : "linear-gradient(145deg, #c48755, #e5b17d)", display: "grid", placeItems: "center", flexShrink: 0, position: "relative" }}>
                <Play size={15} color="#fff" fill="#fff" />
                <span style={{ position: "absolute", right: -5, top: -6, minWidth: 17, height: 17, borderRadius: 9, background: T.card, color: index % 2 === 0 ? T.greenDk : "#bd7540", fontSize: 10, fontWeight: 800, display: "grid", placeItems: "center", boxShadow: "0 2px 5px rgba(40,38,47,0.14)" }}>{index + 1}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: T.ink, lineHeight: 1.3 }}>{video.title}</div>
                <div style={{ fontSize: 11, color: T.sub, marginTop: 3 }}>Juan Carroso • Studio Venture • Watch video</div>
              </div>
              <ExternalLink size={16} color={index % 2 === 0 ? T.greenDk : "#bd7540"} />
            </button>
          ))}
        </div>
      </div>
      {activeVideo && (
        <div role="dialog" aria-modal="true" aria-label={activeVideo.title} onClick={() => setActiveVideo(null)}
          style={{ position: "fixed", inset: 0, zIndex: 140, background: "rgba(22,38,30,0.82)", display: "flex", alignItems: "center", justifyContent: "center", padding: 14 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, background: "#101714", borderRadius: 20, padding: 10, boxShadow: "0 18px 50px rgba(0,0,0,0.35)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#fff", padding: "2px 2px 9px" }}><div style={{ flex: 1, fontWeight: 800, fontSize: 14 }}>{activeVideo.title}</div><button type="button" onClick={() => setActiveVideo(null)} aria-label="Close video" style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.22)", background: "rgba(255,255,255,0.12)", color: "#fff", display: "grid", placeItems: "center", cursor: "pointer" }}><X size={18} /></button></div>
            <video src={activeVideo.url} controls autoPlay playsInline style={{ width: "100%", maxHeight: "72vh", display: "block", borderRadius: 13, background: "#000" }} />
          </div>
        </div>
      )}
    </div>
  );
}

function ProgramInfo({ voiceOn, speechLang, onBack, onMessageJuan, onOpenIntake, onBookAppointment }) {
  const juanProgramIntro = "Hi, I'm Juan, the founder of The Resilience Hub. This program is free and built around you: we listen to where you're at, shape practical support at your pace, and help connect you with the right people. If you need help at any point, use Message Juan to reach the real me, talk with one of the AI guides, or use Safety First for urgent human support.";
  const spokenJuanProgramIntro = spokenIntro("program", juanProgramIntro, speechLang);
  const { speak: speakJuanProgramIntro, stop: stopJuanProgramIntro, prefetch: prefetchJuanProgramIntro } = useVoice(voiceOn);
  useEffect(() => {
    if (!voiceOn || !__autoIntroVoiceOn) return undefined;
    prefetchJuanProgramIntro(spokenJuanProgramIntro, CHARS.juan);
    const timer = setTimeout(() => speakJuanProgramIntro(spokenJuanProgramIntro, CHARS.juan), 70);
    return () => { clearTimeout(timer); stopJuanProgramIntro(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceOn, speechLang]);
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
        <ProgramInfoCard title="Juan — Peer support & 24/7 availability">Juan walks this journey beside you. He understands because he's lived it. Available any time. When you're in the program, you can contact Juan any time, including when things get really hard. He'll respond as soon as he can. If you're in immediate danger, call 000 first. If you can't reach Juan, call Lifeline on 13 11 14 (24/7) or tap Safety First.</ProgramInfoCard>
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
          Everything you need to get started: complete your intake form in the app or download the forms ahead of time, then request a time for your first appointment — Juan will call or text to lock it in.
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
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 9 }}>
          <Btn onClick={onOpenIntake}>Complete Program Intake Form</Btn>
          <Btn onClick={onBookAppointment}>Book a 1-1 chat with Juan</Btn>
        </div>
      </ProgramInfoSection>

      <ProgramInfoSection title="Get in touch">
        <div style={{ background: "#eaf6ef", borderRadius: 16, padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 13.5, lineHeight: 1.8 }}>
            <div>📞 0489 059 833</div>
            <div>✉️ resiliencehubnsw@gmail.com</div>
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

function ChaptlyPage({ onBack }) {
  const openExternal = (event, href) => {
    event.preventDefault();
    try { sessionStorage.setItem("rh_return_to_chaptly", "1"); } catch {}
    window.open(href, "_blank", "noopener,noreferrer");
  };
  const storeButton = (href, label, icon, accent) => (
    <a href={href} onClick={(event) => openExternal(event, href)} target="_blank" rel="noreferrer" aria-label={`Open Chaptly on ${label}`} style={{ flex: "1 1 190px", minWidth: 0, display: "flex", alignItems: "center", gap: 11, padding: "13px 15px", borderRadius: 16, background: accent, color: "#fff", textDecoration: "none", boxShadow: "0 8px 16px rgba(62,36,38,0.14)" }}>
      {icon}<span style={{ minWidth: 0 }}><span style={{ display: "block", fontSize: 10, fontWeight: 800, letterSpacing: 0.7, opacity: 0.82 }}>DOWNLOAD ON</span><strong style={{ display: "block", fontSize: 16, lineHeight: 1.15 }}>{label}</strong></span><ExternalLink size={16} style={{ marginLeft: "auto", opacity: 0.82 }} />
    </a>
  );
  const features = [
    ["Identify and break toxic cycles", "Guided exercises help you spot manipulative behaviours, interrupt reactive cycles, and step out of unhealthy dynamics."],
    ["Emotional regulation with CBT and DBT", "Practise actionable skills for anxiety, the tug-of-war between emotions and logic, and negative self-talk."],
    ["Boundaries and self-worth", "Daily prompts help you recognise your needs, set clear boundaries without guilt, and build emotional independence."],
    ["Gentle gamified accountability", "Soft wins, progress tracking, and workbook reflection help you stay engaged with recovery between other supports."],
  ];
  return (
    <>
      <Brand right={<BackBtn onBack={onBack} label="Hub" />} />
      <main style={{ marginTop: 8, paddingBottom: 30 }}>
        <section style={{ background: "linear-gradient(135deg, #ffd8d3 0%, #ffeae5 45%, #fffaf5 100%)", border: "1px solid rgba(190,25,21,0.22)", borderRadius: 26, padding: 0, minHeight: 218, boxShadow: "0 16px 34px rgba(172,39,39,0.14)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", width: 260, height: 260, borderRadius: "50%", right: -125, top: -116, background: "rgba(255,255,255,0.42)" }} />
          <div style={{ position: "absolute", width: 170, height: 170, borderRadius: "50%", left: -92, bottom: -108, background: "rgba(190,42,38,0.11)" }} />
          <div style={{ minHeight: 218, display: "flex", alignItems: "stretch", position: "relative" }}>
            <div style={{ width: "42%", minWidth: 130, display: "flex", alignItems: "center", justifyContent: "center", padding: "4px 7px 8px", background: "linear-gradient(180deg, rgba(255,255,255,0.64), rgba(255,244,238,0.42))", borderRadius: "24px 0 0 24px", boxShadow: "inset -1px 0 rgba(255,255,255,0.46)" }}><img src="/partners/chaptly-character-transparent.png" alt="Chaptly character" style={{ width: "100%", maxWidth: 178, height: 204, objectFit: "contain", objectPosition: "center center", transform: "translateY(-5px)", filter: "drop-shadow(0 11px 10px rgba(123,0,0,0.24))" }} /></div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "18px 15px", margin: "12px 12px 12px 0", borderRadius: 20, background: "linear-gradient(145deg, #5a1015 0%, #741d22 100%)", color: "#fff", boxShadow: "0 8px 20px rgba(91,16,21,0.16)" }}><h1 style={{ margin: "7px 0 8px", fontSize: 32, lineHeight: 1, letterSpacing: -0.6 }}>Chaptly</h1><p style={{ margin: 0, maxWidth: 190, color: "rgba(255,255,255,0.95)", lineHeight: 1.48, fontSize: 13.5 }}>An AI-guided, trauma-informed recovery app for your next chapter.</p><a href="https://chaptly.app/" onClick={(event) => openExternal(event, "https://chaptly.app/")} target="_blank" rel="noreferrer" style={{ alignSelf: "center", display: "inline-flex", alignItems: "center", gap: 5, marginTop: 13, color: "#8f120f", background: "#fff8ed", borderRadius: 999, padding: "8px 11px", fontSize: 11, fontWeight: 900, textDecoration: "none" }}>Explore Chaptly <ExternalLink size={13} /></a></div>
          </div>
        </section>
        <section style={{ background: "radial-gradient(circle at 92% 8%, rgba(255,255,255,0.86) 0, rgba(255,255,255,0) 30%), linear-gradient(145deg, #f5c2c0 0%, #ffe4dc 48%, #fffaf6 100%)", border: "1px solid rgba(190,25,21,0.19)", borderTop: "5px solid #b83d44", borderRadius: 24, padding: "19px 18px 18px", marginTop: 14, boxShadow: "0 14px 30px rgba(159,44,50,0.12)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", width: 110, height: 110, borderRadius: "50%", right: -42, bottom: -48, background: "rgba(184,61,68,0.10)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 9, color: "#9d2830", fontSize: 10, fontWeight: 900, letterSpacing: 1.1, textTransform: "uppercase", position: "relative" }}><span style={{ width: 31, height: 31, borderRadius: 11, display: "grid", placeItems: "center", background: "rgba(255,255,255,0.74)", boxShadow: "0 5px 12px rgba(143,18,15,0.10)" }}><Sparkles size={16} color="#b83d44" /></span>A gentle place to begin</div>
          <h2 style={{ margin: "12px 0 12px", color: "#741d22", fontSize: 24, lineHeight: 1.08, position: "relative" }}>How Chaptly can support you</h2>
          <div style={{ background: "rgba(255,255,255,0.70)", border: "1px solid rgba(255,255,255,0.78)", borderRadius: 17, padding: "14px 14px 13px", position: "relative", boxShadow: "0 7px 18px rgba(143,18,15,0.06)" }}>
            <p style={{ margin: 0, color: "#765d5d", lineHeight: 1.62, fontSize: 14 }}>Chaptly is a trauma-informed, story-driven mobile application designed to support people recovering from toxic dynamics, abusive relationships, and severe emotional burnout. Built on evidence-based frameworks including Cognitive Behavioral Therapy (CBT) and Dialectical Behavior Therapy (DBT), and informed by Harvard research, it translates recovery principles into an accessible, self-paced 90-day experience.</p>
            <p style={{ margin: "11px 0 0", color: "#765d5d", lineHeight: 1.62, fontSize: 14 }}>Rather than feeling heavy or clinical, Chaptly turns healing into structured 8-minute daily quests with interactive tools, micro-journaling, daily quizzes, and character-led Hero chapters that reflect real-world recovery milestones.</p>
          </div>
        </section>
        <section style={{ marginTop: 14 }}><h2 style={{ margin: "0 0 10px 3px", color: "#8f120f", fontSize: 21 }}>What you can explore</h2><div style={{ display: "grid", gap: 10 }}>{features.map(([title, text], i) => <article key={title} style={{ background: i % 2 ? "#fff7f4" : "#fffdfb", border: "1px solid rgba(190,25,21,0.13)", borderRadius: 18, padding: "14px 15px", boxShadow: "0 5px 14px rgba(143,18,15,0.045)" }}><h3 style={{ margin: 0, color: "#c51d18", fontSize: 15 }}>{title}</h3><p style={{ margin: "6px 0 0", color: T.sub, lineHeight: 1.5, fontSize: 13 }}>{text}</p></article>)}</div></section>
        <section style={{ background: "linear-gradient(135deg, #ffe7e1 0%, #fff5f1 56%, #fffdfb 100%)", border: "1px solid rgba(190,25,21,0.15)", borderRadius: 22, padding: "18px", marginTop: 14 }}><h2 style={{ margin: 0, color: "#8f120f", fontSize: 20 }}>Ready to take a look?</h2><p style={{ margin: "8px 0 14px", color: T.sub, lineHeight: 1.5, fontSize: 14 }}>If Chaptly feels like it could support you, you can learn more or download it directly from your app store.</p><div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>{storeButton("https://apps.apple.com/us/app/chaptly/id6752330051", "App Store", <span style={{ fontSize: 25, lineHeight: 1 }}></span>, "#5a1015")}{storeButton("https://play.google.com/store/apps/details?id=com.chaptly.app&pcampaignid=web_share", "Google Play", <Play size={22} fill="currentColor" />, "#8f2025")}</div><a href="https://chaptly.app/" onClick={(event) => openExternal(event, "https://chaptly.app/")} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 14, color: "#8f2025", fontWeight: 800, fontSize: 13 }}>Visit chaptly.app <ExternalLink size={15} /></a></section>
        <p style={{ margin: "15px 4px 0", color: "#8c6868", fontSize: 12, lineHeight: 1.5 }}>Chaptly is an external partner service. Please review its own information, terms, and privacy practices before deciding whether it is right for you.</p>
      </main>
    </>
  );
}

function SupportUsPage({ onOpenMerch, onOpenCarlosLibrary, onBack }) {
  return (
    <>
      <Brand right={<BackBtn onBack={onBack} />} />
      <div style={{ background: "linear-gradient(135deg, #fff0f0 0%, #fffaf7 56%, #f5eaf0 100%)", borderRadius: 24, padding: "22px 19px 20px", marginTop: 7, boxShadow: T.soft, border: "1px solid rgba(201,79,79,0.16)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", width: 180, height: 180, borderRadius: "50%", right: -65, top: -82, background: "rgba(255,255,255,0.46)" }} />
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 9, color: "#b63f49", fontSize: 11, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase" }}><Heart size={16} fill="#f38a73" /> Help keep support free</div>
        <h1 style={{ position: "relative", fontSize: 28, lineHeight: 1.12, margin: "9px 0 8px", color: T.ink }}>Support Us</h1>
        <p style={{ position: "relative", margin: 0, color: T.sub, fontSize: 13.5, lineHeight: 1.55 }}>There are a few simple ways to support The Resilience Hub and the people who help make it possible. Choose whatever feels right for you — there is never any pressure.</p>
      </div>
      <a href="https://bit.ly/carloscamachopsychology" target="_blank" rel="noopener noreferrer" aria-label="Visit Carlos Camacho’s psychology website" style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 13, background: "linear-gradient(135deg, #e8f5f2 0%, #f7fbff 58%, #e8f0fb 100%)", border: "1px solid rgba(48,126,135,0.18)", borderRadius: 20, padding: 14, boxShadow: T.soft, textDecoration: "none", color: T.ink }}>
        <div style={{ width: 48, height: 48, borderRadius: 15, overflow: "hidden", background: "#d9eceb", flexShrink: 0, border: "1px solid rgba(48,126,135,0.12)" }}><img src={CHARS.carlos.img} alt="Carlos Camacho" style={{ width: "100%", height: "100%", objectFit: "contain" }} /></div>
        <div style={{ flex: 1, minWidth: 0 }}><div style={{ display: "inline-block", color: "#27727b", fontSize: 10, fontWeight: 900, letterSpacing: 1, marginBottom: 2 }}>CARLOS CAMACHO</div><div style={{ fontWeight: 800, fontSize: 16 }}>Carlos’s Psychology Website</div><div style={{ fontSize: 13, color: T.sub, lineHeight: 1.4 }}>Learn more about Carlos and his professional psychology services</div></div>
        <ExternalLink size={18} color="#27727b" />
      </a>
      <div style={{ display: "flex", flexDirection: "column", gap: 11, marginTop: 15 }}>
        <a href="https://gofund.me/4ce6afdc4" target="_blank" rel="noopener noreferrer" aria-label="Support The Resilience Hub on GoFundMe" style={{ display: "flex", alignItems: "center", gap: 12, background: "linear-gradient(135deg, #fff0f0 0%, #fff8f4 58%, #ffe7e1 100%)", border: "1px solid rgba(201,79,79,0.18)", borderRadius: 20, padding: 14, boxShadow: T.soft, textDecoration: "none", color: T.ink }}>
          <div style={{ width: 48, height: 48, borderRadius: 15, background: "linear-gradient(145deg, #e5484d, #f38a73)", display: "grid", placeItems: "center", flexShrink: 0 }}><Heart size={24} color="#fff" fill="#fff" /></div>
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ display: "inline-block", color: "#c43f45", fontSize: 10, fontWeight: 900, letterSpacing: 1, marginBottom: 2 }}>GOFUNDME</div><div style={{ fontWeight: 800, fontSize: 16 }}>Support The Resilience Hub</div><div style={{ fontSize: 13, color: T.sub, lineHeight: 1.4 }}>Help us keep support free for everyone</div></div>
          <ExternalLink size={18} color="#c94f4f" />
        </a>
        <button onClick={onOpenMerch} aria-label="Open Sloane Fox merch" style={{ width: "100%", background: "linear-gradient(135deg, #f4eef7 0%, #fff 72%)", border: "1px solid rgba(91,75,122,0.14)", borderRadius: 20, padding: 14, boxShadow: T.soft, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}>
          <img src="/merch/choose-your-edition-new.jpg" alt="Sloane Fox artwork" style={{ width: 48, height: 48, borderRadius: 15, objectFit: "cover", objectPosition: "50% 37%", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ display: "inline-block", color: "#5b4b7a", fontSize: 10, fontWeight: 900, letterSpacing: 1, marginBottom: 2 }}>SLOANE FOX</div><div style={{ fontWeight: 800, fontSize: 16 }}>Sloane Fox merch</div><div style={{ fontSize: 13, color: T.sub, lineHeight: 1.4 }}>Built Not Bought — every piece supports the Hub</div></div>
          <ChevronRight size={20} color="#5b4b7a" />
        </button>
        <button onClick={onOpenCarlosLibrary} aria-label="Open Support Carlos Camacho library" style={{ width: "100%", background: "linear-gradient(135deg, #e8f0fb 0%, #ffffff 62%, #f3eafa 100%)", border: "1px solid rgba(63,111,175,0.16)", borderRadius: 20, padding: 14, boxShadow: T.soft, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}>
          <div style={{ width: 48, height: 48, borderRadius: 15, overflow: "hidden", background: "#dfeafa", flexShrink: 0 }}><img src={CHARS.carlos.img} alt="Carlos Camacho" style={{ width: "100%", height: "100%", objectFit: "contain" }} /></div>
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ display: "inline-block", color: T.blueDk, fontSize: 10, fontWeight: 900, letterSpacing: 1, marginBottom: 2 }}>CARLOS CAMACHO</div><div style={{ fontWeight: 800, fontSize: 16 }}>Support Carlos Camacho</div><div style={{ fontSize: 13, color: T.sub, lineHeight: 1.4 }}>Explore his books on happiness, philosophy and life</div></div>
          <ChevronRight size={20} color={T.blueDk} />
        </button>
      </div>
      <p style={{ margin: "15px 3px 28px", color: T.sub, fontSize: 11.5, lineHeight: 1.5 }}>All support options are optional. The Hub remains free for the people who use it.</p>
    </>
  );
}

function ProgramIntake({ session, profile, onBack, onReturnToProgram }) {
  const userId = session?.user?.id || "guest";
  const draftKey = `rh_program_intake_draft_${userId}`;
  const blank = {
    full_name: profile?.name && profile.name !== "friend" ? profile.name : "", date_of_birth: "", gender: "", address: "", phone: "", email: session?.user?.email || "", preferred_contact: "",
    emergency_primary_name: "", emergency_primary_relationship: "", emergency_primary_phone: "", emergency_secondary_name: "", emergency_secondary_relationship: "", emergency_secondary_phone: "",
    referral_source: "", wdo_participant: "", revenue_nsw_ref: "", legal_obligations: "", legal_details: "", gp_name: "", medical_clinic: "", mental_health_plan: "", medical_conditions: "", current_support_meds: "", allergies_special_care: "", housing_status: "", employment_status: "", goals: "", enjoys: [], comfortable: [], values: [], skills: [], strengths: [], problem_response: "", support_style: "", main_goal: "", wanted_to_do: [], support_needed: [], agreement: false, sharing_gp: "", sharing_clinic: "", sharing_physical: false, sharing_mental: false, sharing_meds: false, participant_name_printed: "", signature: "", signed_date: "",
  };
  const [form, setForm] = useState(() => { try { return { ...blank, ...JSON.parse(localStorage.getItem(draftKey) || "null") }; } catch { return blank; } });
  const [consent, setConsent] = useState(false);
  const [agreement, setAgreement] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => { try { localStorage.setItem(draftKey, JSON.stringify(form)); } catch {} }, [draftKey, form]);
  useEffect(() => {
    if (!supabase || !session?.user?.id) return;
    supabase.from("program_intakes").select("data,status,consent_name,signature,signed_date").eq("id", session.user.id).maybeSingle().then(({ data }) => {
      if (data?.data) { setForm((current) => ({ ...current, ...data.data, participant_name_printed: data.consent_name || current.participant_name_printed, signature: data.signature || current.signature, signed_date: data.signed_date || current.signed_date })); setAgreement(Boolean(data.data.agreement)); setConsent(Boolean(data.data.privacy_consent)); }
    }).catch(() => {});
  }, [session?.user?.id]);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const field = (label, key, options = {}) => <label style={{ display: "block", marginBottom: 12 }}><span style={{ display: "block", fontSize: 12.5, fontWeight: 800, color: T.ink, marginBottom: 5 }}>{label}{options.required ? " *" : ""}</span>{options.multiline ? <textarea value={form[key]} onChange={(e) => update(key, e.target.value)} rows={options.rows || 3} placeholder={options.placeholder || ""} style={{ ...inputStyle, resize: "vertical", minHeight: options.rows ? options.rows * 25 : 72 }} /> : <input type={options.type || "text"} value={form[key]} onChange={(e) => update(key, e.target.value)} placeholder={options.placeholder || ""} style={inputStyle} />}</label>;
  const choice = (label, key, values) => <div style={{ marginBottom: 13 }}><div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 7 }}>{label}</div><div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>{values.map((value) => <button type="button" key={value} onClick={() => update(key, form[key] === value ? "" : value)} style={{ border: `1px solid ${form[key] === value ? T.green : T.line}`, background: form[key] === value ? "#e7f5eb" : "#fff", color: form[key] === value ? T.greenDk : T.ink, borderRadius: 999, padding: "8px 10px", fontSize: 12, cursor: "pointer", fontWeight: form[key] === value ? 800 : 500 }}>{form[key] === value ? "✓ " : ""}{value}</button>)}</div></div>;
  const multiChoice = (label, key, values) => <div style={{ marginBottom: 13 }}><div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 7 }}>{label} <span style={{ color: T.sub, fontWeight: 500 }}>(choose any)</span></div><div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>{values.map((value) => { const selected = Array.isArray(form[key]) && form[key].includes(value); return <button type="button" key={value} onClick={() => update(key, selected ? form[key].filter((item) => item !== value) : [...(form[key] || []), value])} style={{ border: `1px solid ${selected ? T.green : T.line}`, background: selected ? "#e7f5eb" : "#fff", color: selected ? T.greenDk : T.ink, borderRadius: 999, padding: "8px 10px", fontSize: 12, cursor: "pointer", fontWeight: selected ? 800 : 500 }}>{selected ? "✓ " : ""}{value}</button>; })}</div></div>;
  const section = (title, children) => <section style={{ background: T.card, borderRadius: 20, padding: 16, boxShadow: T.soft, marginTop: 13 }}><h2 style={{ margin: "0 0 13px", color: T.greenDk, fontSize: 17 }}>{title}</h2>{children}</section>;
  const save = async (submit = false) => {
    setStatus("");
    if (submit && (!form.full_name.trim() || !form.date_of_birth || !form.phone.trim() || !agreement || !consent || !form.signature.trim())) { setStatus("Please complete your name, date of birth, phone, program agreement, privacy consent, and typed signature before submitting."); return; }
    setBusy(true);
    try {
      if (!supabase || !session?.user?.id) throw new Error("Please sign in before saving or submitting your intake form.");
      const payload = { id: session.user.id, data: { ...form, agreement, privacy_consent: consent }, status: submit ? "submitted" : "draft", consent_name: submit ? form.participant_name_printed : null, signature: submit ? form.signature : null, signed_date: submit ? form.signed_date : null, agreement_accepted_at: submit && agreement ? new Date().toISOString() : null, medical_sharing_consent: submit ? { gp: form.sharing_gp, clinic: form.sharing_clinic, types: form.sharing_types || [] } : null, submitted_at: submit ? new Date().toISOString() : null, updated_at: new Date().toISOString() };
      const { error } = await supabase.from("program_intakes").upsert(payload);
      if (error) throw error;
      if (submit) {
        try { localStorage.removeItem(draftKey); } catch {}
        setSubmitted(true);
        fetch("/api/push", {
          method: "POST", headers: await pushHeaders(), keepalive: true,
          body: JSON.stringify({ toAdmins: true, title: "New intake form submitted", body: "A client has submitted a new program intake form for review.", target: "adminIntakes", url: "/?open=adminIntakes" }),
        }).catch(() => {});
      } else setStatus("Draft saved. You can come back and finish it later.");
    } catch (error) { setStatus(error.message || "We couldn't save your intake form just now."); }
    finally { setBusy(false); }
  };
  if (submitted) return <>
    <Brand right={<BackBtn onBack={onBack} label="Program" />} />
    <div style={{ background: "linear-gradient(135deg, #eaf7ed 0%, #ffffff 62%, #fff5e8 100%)", border: "1px solid rgba(77,159,104,0.18)", borderRadius: 24, padding: "30px 20px 24px", boxShadow: T.soft, marginTop: 18, textAlign: "center" }}>
      <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#e5f5e8", display: "grid", placeItems: "center", margin: "0 auto 16px", boxShadow: "0 8px 18px rgba(77,159,104,0.16)" }}><CheckCircle2 size={46} color={T.greenDk} strokeWidth={2.2} /></div>
      <h1 style={{ fontSize: 23, lineHeight: 1.25, margin: "0 0 13px", color: T.ink }}>Thank you for submitting your intake form online.</h1>
      <p style={{ color: T.sub, fontSize: 14, lineHeight: 1.65, margin: 0 }}>We are thrilled to have you with us, and Juan will be in touch very soon to discuss your next steps. Alternatively, you can book your initial appointment online from the previous page.</p>
      <button type="button" onClick={onReturnToProgram} style={{ marginTop: 22, border: "none", background: "none", color: T.greenDk, textDecoration: "underline", textUnderlineOffset: 3, fontSize: 14, fontWeight: 800, cursor: "pointer" }}>Return to the program</button>
    </div>
  </>;
  return <>
    <Brand right={<BackBtn onBack={onBack} />} />
    <div style={{ background: "linear-gradient(135deg, #e5f5ea 0%, #f8fcf9 54%, #fff0e4 100%)", borderRadius: 24, padding: "21px 18px", marginTop: 7, boxShadow: T.soft, border: `1px solid ${T.line}` }}><div style={{ color: T.greenDk, fontSize: 11, fontWeight: 900, letterSpacing: 1 }}>THE RESILIENCE HUB · RH-FORM-01 v2.1</div><h1 style={{ margin: "8px 0 7px", color: T.greenDk, fontSize: 27, lineHeight: 1.12 }}>Program intake form</h1><p style={{ margin: 0, color: T.sub, fontSize: 13.5, lineHeight: 1.5 }}>This form registers you for the 8-week Recovery &amp; Resilience Program. Save a draft and finish it in your own time; you can bring extra information to your intake appointment.</p></div>
    <div style={{ background: "#fffaf0", border: "1px solid #eadfbd", borderRadius: 16, padding: 12, marginTop: 12, color: T.ink, fontSize: 12.5, lineHeight: 1.5 }}><strong>Privacy note:</strong> Your answers include personal and health information. They are stored with your account and shared with authorised Resilience Hub program staff for program delivery, record-keeping, and WDO-related reporting. This form is not an emergency service.</div>
    {section("1. Participant personal details", <>{field("Full name", "full_name", { required: true })}{field("Date of birth", "date_of_birth", { type: "date", required: true })}{choice("Gender identity", "gender", ["Male", "Female", "Non-binary", "Prefer not to say / Other"])}{field("Residential address", "address", { multiline: true, rows: 2 })}<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>{field("Phone number", "phone", { required: true })}{field("Email address", "email", { type: "email" })}</div>{choice("Preferred contact", "preferred_contact", ["Phone", "SMS", "Email"])}</>)}
    {section("2. Emergency contact information", <><div style={{ fontSize: 12, fontWeight: 800, color: T.sub, marginBottom: 8 }}>Primary contact</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>{field("Name", "emergency_primary_name")}{field("Relationship", "emergency_primary_relationship")}</div>{field("Phone", "emergency_primary_phone")}<div style={{ fontSize: 12, fontWeight: 800, color: T.sub, margin: "14px 0 8px" }}>Secondary contact (optional)</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>{field("Name", "emergency_secondary_name")}{field("Relationship", "emergency_secondary_relationship")}</div>{field("Phone", "emergency_secondary_phone")}</>)}
    {section("3. Referral & legal / WDO status", <>{choice("Referral source", "referral_source", ["Self-referral", "GP / Medical", "Legal service", "Community agency"])}{choice("WDO participant", "wdo_participant", ["Yes", "No"])}{field("Revenue NSW reference number", "revenue_nsw_ref")}{choice("Legal obligations", "legal_obligations", ["Yes", "No"])}{field("Legal details", "legal_details", { multiline: true, rows: 3, placeholder: "Pending court matters or order compliance requirements, if relevant" })}</>)}
    {section("4. Medical & clinical background", <>{<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>{field("General practitioner", "gp_name")}{field("Medical clinic", "medical_clinic")}</div>}{choice("Mental health plan", "mental_health_plan", ["Yes (Active)", "No", "Pending GP assessment"])}{field("Medical conditions", "medical_conditions", { multiline: true, rows: 3 })}{field("Current support / medications", "current_support_meds", { multiline: true, rows: 3 })}{field("Allergies / special care", "allergies_special_care", { multiline: true, rows: 3 })}</>)}
    {section("5. Current situation & program goals", <>{choice("Housing status", "housing_status", ["Stable / Renting", "Temporary / Crisis", "Unsupported / Homeless"])}{choice("Employment status", "employment_status", ["Unemployed", "Part-time / Casual", "Full-time", "Student / Trainee"])}{field("What are your main goals for the 8-week program?", "goals", { multiline: true, rows: 4, placeholder: "What would you most like support with?" })}{multiChoice("What do you enjoy doing most?", "enjoys", ["Being active / outdoors", "Creative things", "Helping people", "Quiet time", "Learning / planning"])}{multiChoice("Where do you feel most comfortable?", "comfortable", ["At home / quiet places", "Family or close friends", "One-to-one", "Outdoors / parks", "Small groups"])}{multiChoice("What matters most to you?", "values", ["Honesty & trust", "Stability & routine", "Achieving goals", "Independence & freedom", "Family & relationships", "Being respected"])}{multiChoice("Practical skills or experience", "skills", ["Building / trades", "Gardening / maintenance", "Cooking / home management", "Driving / logistics", "Tools / equipment", "Customer service", "Admin / planning"])}{multiChoice("Strengths and habits", "strengths", ["Caring for others", "Reliable / on time", "Solving problems", "Calm under pressure", "Hard worker", "Good listener", "Following instructions", "Making plans", "Determined"])}{choice("How do you usually respond to problems?", "problem_response", ["Keep it to myself", "Avoid it", "Solve it straight away", "Think it through", "Talk it out"])}{choice("How do you work best?", "support_style", ["On my own", "With clear instructions", "With others", "See clear progress", "Freedom"])}{multiChoice("What support would help most?", "support_needed", ["Check-ins", "Planning / routine", "Someone to talk to", "Finding work", "Stress management", "Clear steps"])}</>)}
    {section("6. Program agreement & expectations", <><div style={{ background: "#f3f8f4", borderRadius: 14, padding: 12, fontSize: 12.5, lineHeight: 1.55, color: T.ink }}>This is a peer-supported recovery and resilience program. It is not a substitute for medical treatment, psychological therapy, or detox. Participation includes honest communication about struggles and safety, regular check-ins, agreed appointments, daily journaling, relevant medical disclosure, and joint risk assessment for activities outside the program. Transport support is for agreed program-related purposes.</div><label style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 12.5, lineHeight: 1.45, marginTop: 13 }}><input type="checkbox" checked={agreement} onChange={(e) => setAgreement(e.target.checked)} style={{ width: 19, height: 19, accentColor: T.green, flexShrink: 0 }} />I understand the program purpose, expectations, and limits, and agree to participate honestly and safely.</label></>)}
    {section("7. Optional consent to share medical information", <><p style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.55, marginTop: 0 }}>This is separate from joining the program. You can leave it unticked and discuss it at your intake appointment. Any sharing is limited to relevant professionals involved in your care and can be withdrawn in writing.</p>{field("Primary GP", "sharing_gp")}{field("Medical clinic", "sharing_clinic")}{multiChoice("I consent to exchange of:", "sharing_types", ["Physical health information", "Mental health treatment plans and progress", "Medications or special-care requirements"])}<label style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 12.5, lineHeight: 1.45, marginTop: 3 }}><input type="checkbox" checked={form.sharing_physical} onChange={(e) => update("sharing_physical", e.target.checked)} style={{ width: 18, height: 18, accentColor: T.green, flexShrink: 0 }} />I consent to the Resilience Hub sharing relevant information with my GP and clinical professionals involved in my care.</label></>)}
    {section("8. Privacy declaration & electronic sign-off", <><p style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.55, marginTop: 0 }}>I declare that the information provided in this form is true, correct, and complete to the best of my knowledge. I consent to The Resilience Hub collecting and handling my personal and clinical information in accordance with the Privacy Act 1988 (Cth) for program delivery, record-keeping, safety, and WDO-related reporting. Information is shared only with authorised staff and clinicians, except where required by law or necessary to respond to immediate serious harm.</p>{field("Participant name (printed)", "participant_name_printed", { required: true })}{field("Typed signature", "signature", { required: true, placeholder: "Type your full name as your electronic signature" })}{field("Date", "signed_date", { type: "date" })}<label style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 12.5, lineHeight: 1.45, margin: "5px 0 14px" }}><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ width: 19, height: 19, accentColor: T.green, flexShrink: 0 }} />I have read and understand the privacy notice and consent to submit this intake form.</label></>)}
    {status && <div role="status" style={{ marginTop: 13, background: status.includes("couldn't") || status.includes("Please") ? "#fff0f0" : "#eef7ef", border: `1px solid ${status.includes("couldn't") || status.includes("Please") ? "#efcccc" : "#c8e4ce"}`, color: T.ink, borderRadius: 15, padding: 12, fontSize: 13, lineHeight: 1.45 }}>{status}</div>}
    <div style={{ display: "flex", gap: 9, marginTop: 15, marginBottom: 32 }}>
      <Btn kind="outline" onClick={() => save(false)} disabled={busy} style={{ flex: 1 }}>{busy ? "Saving…" : "Save draft"}</Btn>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Btn disabled style={{ width: "100%", background: "#e7ece8", color: T.sub, boxShadow: "none", border: `1px solid ${T.line}`, opacity: 1 }}>{busy ? "Submitting…" : "Submit intake"}</Btn>
        <div role="note" style={{ marginTop: 9, background: "linear-gradient(145deg, #fff8e7, #fffdf7)", border: "1px solid #ead9a7", borderRadius: 14, padding: "10px 11px", color: "#6d5a27", fontSize: 11.5, lineHeight: 1.45 }}>
          <strong style={{ display: "block", color: "#5d4b1c", marginBottom: 2 }}>Admissions are currently closed</strong>
          The program has active participants at the moment. You can still book a 1-1 chat with Juan to discuss your needs.
        </div>
      </div>
    </div>
  </>;
}

function ResourcesPage({ voiceOn, speechLang, onOpenSafety, onOpenMensShed, onOpenProgramInfo, onBack }) {
  const [resourceQuery, setResourceQuery] = useState("");
  const [tocOpen, setTocOpen] = useState(false);
  const resourcesWelcome = "Hi, I'm Rex. The Support Directory brings together crisis help, health services, housing, food, recovery, community groups and other local support. You can browse by need or use the search box — type what you're looking for in your own words, like someone to talk to, housing or food, and I'll show you matching services. Take your time; you don't need to know a service's name first.";
  const spokenResourcesWelcome = spokenIntro("resources", resourcesWelcome, speechLang);
  const { speak: speakResourcesWelcome, stop: stopResourcesWelcome, speaking: resourcesSpeaking, prefetch: prefetchResourcesWelcome } = useVoice(voiceOn);
  const searchAliases = {
    crisis: ["lifeline", "emergency", "suicide", "unsafe", "urgent", "danger", "safety", "safe haven", "safehaven", "peer support"],
    safe: ["safe haven", "safehaven", "crisis", "suicidal", "distress", "peer support", "quiet space"],
    haven: ["safe haven", "safehaven", "crisis", "suicidal", "distress", "peer support", "quiet space"],
    emergency: ["crisis", "000", "ambulance", "police", "fire", "urgent", "danger"],
    doctor: ["gp", "medical", "health", "telehealth", "nurse", "clinic", "hospital"],
    gp: ["doctor", "medical", "health", "telehealth", "clinic"],
    medical: ["doctor", "gp", "health", "telehealth", "nurse", "clinic"],
    counselling: ["counseling", "therapy", "mental", "psychologist", "support", "wellbeing"],
    counseling: ["counselling", "therapy", "mental", "psychologist", "support", "wellbeing"],
    mental: ["counselling", "counseling", "psychologist", "wellbeing", "anxiety", "depression"],
    housing: ["homeless", "accommodation", "shelter", "rent", "tenancy", "clothing", "essentials"],
    homeless: ["housing", "accommodation", "shelter", "rent", "tenancy"],
    food: ["meals", "groceries", "pantry", "voucher", "foodbank"],
    money: ["bills", "financial", "finance", "legal", "debt", "income", "centrelink"],
    bills: ["money", "financial", "finance", "debt", "income", "legal"],
    addiction: ["alcohol", "drug", "rehab", "detox", "recovery", "substance", "overdose"],
    alcohol: ["addiction", "drug", "rehab", "detox", "recovery", "substance"],
    drugs: ["addiction", "alcohol", "rehab", "detox", "recovery", "substance"],
    family: ["children", "youth", "carer", "domestic", "relationship", "parenting"],
    children: ["family", "youth", "kids", "parenting", "carer"],
    youth: ["young", "children", "kids", "family"],
    grief: ["bereavement", "child loss", "loss", "parent", "family"],
    bereavement: ["grief", "child loss", "loss", "parent", "family"],
    workplace: ["job", "employment", "leave", "parent", "bereavement"],
    training: ["asist", "safetalk", "suicide intervention", "mental health", "workshops", "facilitation", "diversity", "inclusion"],
    diversity: ["inclusion", "training", "workshops", "facilitation", "community"],
    facilitation: ["training", "workshops", "group", "meeting", "diversity"],
    suicide: ["asist", "safetalk", "suicide intervention", "mental health", "training"],
    community: ["connection", "group", "mateship", "social", "support"],
    local: ["fairfield", "liverpool", "western", "sydney", "bonnyrigg", "villawood", "nsw"],
    talk: ["counselling", "counseling", "chat", "phone", "mensline", "lifeline", "support"],
    someone: ["talk", "counselling", "counseling", "chat", "connection", "support"],
    lonely: ["connection", "community", "group", "mateship", "support"],
    rent: ["housing", "homeless", "accommodation", "tenancy", "money", "bills"],
  };
  const ignoredSearchWords = new Set(["a", "an", "and", "for", "find", "get", "help", "i", "in", "me", "near", "of", "the", "to", "with"]);
  const hasSearch = resourceQuery.trim().length > 0;
  let matchedAny = false;
  useEffect(() => {
    // Each visit should begin at the Resources hero and table of contents,
    // rather than inheriting the scroll position from the previous screen.
    window.scrollTo({ top: 0, behavior: "auto" });
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
  }, []);
  useEffect(() => {
    if (!voiceOn || !__autoIntroVoiceOn) return undefined;
    prefetchResourcesWelcome(spokenResourcesWelcome, CHARS.rex);
    const timer = setTimeout(() => speakResourcesWelcome(spokenResourcesWelcome, CHARS.rex), 70);
    return () => { clearTimeout(timer); stopResourcesWelcome(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceOn, speechLang, spokenResourcesWelcome]);
  const jump = (id) => document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  // Directory headings are landmarks, not destinations. Keep them visually
  // light and structurally distinct from the full-width interactive service cards.
  const sectionLabel = (id, Icon, title, sub, color) => hasSearch ? null : (
    <section id={id} aria-labelledby={`${id}-title`} style={{ scrollMarginTop: 18, margin: "30px -2px 10px", padding: "15px 15px 14px 16px", borderLeft: `3px solid ${color}`, borderBottom: "1px solid rgba(205,239,219,0.28)", borderRadius: "0 0 14px 0", background: "linear-gradient(135deg, #155c54 0%, #0e433d 100%)", boxShadow: "none" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, color: "#cdebdc", fontSize: 10, fontWeight: 900, letterSpacing: 1.05, textTransform: "uppercase" }}><Icon size={14} color="#cdebdc" aria-hidden="true" /><span>Support directory section</span></div>
      <h2 id={`${id}-title`} style={{ margin: "6px 0 5px", color: "#fffaf0", fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 500, fontSize: 25, lineHeight: 1.05, letterSpacing: -0.35 }}>{title}</h2>
      <p style={{ fontSize: 12.5, color: "#d9eee2", margin: 0, lineHeight: 1.46, maxWidth: 520 }}>{sub}</p>
    </section>
  );
  const resourceCard = ({ Icon, image, imageAlt, tint, color, eyebrow, title, children, href, phone, email, socialUrl, socialLabel, onClick, actionLabel }) => {
    const searchableText = `${eyebrow} ${title} ${children} ${phone || ""} ${email || ""}`.toLowerCase();
    const searchWords = resourceQuery.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word && !ignoredSearchWords.has(word));
    const matches = !hasSearch || searchWords.length === 0 || searchWords.some((word) => searchableText.includes(word) || (searchAliases[word] || []).some((alias) => searchableText.includes(alias)));
    if (!matches) return null;
    matchedAny = true;
    const opensExternal = /^https?:\/\//i.test(href || "");
    const body = <><div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}><div style={{ width: 44, height: 44, borderRadius: 14, background: tint, display: "grid", placeItems: "center", overflow: "hidden", flexShrink: 0, padding: image ? 4 : 0 }}>{image ? <img src={image} alt={imageAlt || title} style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: 10 }} /> : <Icon size={22} color={color} />}</div><div style={{ flex: 1, minWidth: 0 }}><div style={{ color, fontSize: 10, fontWeight: 900, letterSpacing: 0.9, textTransform: "uppercase", marginBottom: 3 }}>{eyebrow}</div><div style={{ fontWeight: 800, fontSize: 16, color: T.ink }}>{title}</div><div style={{ fontSize: 13, color: T.sub, lineHeight: 1.48, marginTop: 5 }}>{children}</div></div>{(href || onClick) && (opensExternal ? <ExternalLink size={18} color={color} style={{ flexShrink: 0, marginTop: 12 }} /> : <ChevronRight size={19} color={T.sub} style={{ flexShrink: 0, marginTop: 12 }} />)}</div>{(phone || email || actionLabel) && <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 11 }}><>{phone && <a href={`tel:${phone.replace(/[^0-9+]/g, "")}`} onClick={(event) => event.stopPropagation()} style={{ padding: "7px 10px", borderRadius: 999, background: "rgba(255,255,255,0.78)", color: T.ink, fontWeight: 750, fontSize: 11.5, textDecoration: "none" }}>Call {phone}</a>}{email && <a href={`mailto:${email}`} onClick={(event) => event.stopPropagation()} style={{ padding: "7px 10px", borderRadius: 999, background: "rgba(255,255,255,0.78)", color: T.ink, fontWeight: 750, fontSize: 11.5, textDecoration: "none" }}>Email {email}</a>}{socialUrl && <a href={socialUrl} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()} style={{ padding: "7px 10px", borderRadius: 999, background: "rgba(255,255,255,0.78)", color: T.ink, fontWeight: 750, fontSize: 11.5, textDecoration: "none" }}>{socialLabel || "Social profile"}</a>}{actionLabel && !phone && !email && !socialUrl && <span style={{ padding: "7px 10px", borderRadius: 999, background: "rgba(255,255,255,0.78)", color: T.ink, fontWeight: 750, fontSize: 11.5 }}>{actionLabel}</span>}</></div>}</>;

    const style = { display: "block", width: "100%", textAlign: "left", background: `linear-gradient(135deg, ${tint} 0%, #fff 74%)`, border: `1px solid ${T.line}`, borderRadius: 19, padding: 14, boxShadow: T.soft, textDecoration: "none", color: T.ink, cursor: "pointer" };
    if (href) { return <a href={href} target={opensExternal ? "_blank" : undefined} rel={opensExternal ? "noopener noreferrer" : undefined} style={style}>{body}</a>; }
    return <button type="button" onClick={onClick} style={style}>{body}</button>;
  };
  const toc = [
    ["resources-juan", "Juan’s program"], ["resources-immediate", "Immediate support"], ["resources-virtual", "Support from home"], ["resources-community", "Connection"], ["resources-food", "Food and meals"], ["resources-housing", "Housing"], ["resources-money", "Money and bills"], ["resources-recovery", "Recovery"], ["resources-wellbeing", "Wellbeing"], ["resources-family", "Family and youth"], ["resources-health", "Health"], ["resources-safety", "Stay safe"],
  ];
  const quickSearches = [
    ["crisis", "I need urgent help", LifeBuoy, "#c94f4f"],
    ["talk", "Someone to talk to", MessageCircle, "#28736f"],
    ["housing", "A place to live", Home, "#4e7c9e"],
    ["food", "Food or essentials", ShoppingBag, "#9a7419"],
  ];
  return (
    <>
      <Brand right={<BackBtn onBack={onBack} />} />
      <div style={{ background: "linear-gradient(135deg, #dff4e8 0%, #f6fbf7 48%, #ffe8d7 100%)", borderRadius: 26, padding: "22px 18px 18px", marginTop: 7, boxShadow: "0 12px 28px rgba(37,78,54,0.10)", border: `1px solid ${T.line}`, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", width: 190, height: 190, borderRadius: "50%", background: "rgba(255,255,255,0.48)", top: -105, right: -60 }} />
        <div style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 7, color: T.greenDk, fontSize: 10.5, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase", background: "rgba(255,255,255,0.7)", borderRadius: 999, padding: "7px 10px" }}><Compass size={14} /> Start where you are</div>
        <h1 style={{ position: "relative", fontSize: 29, lineHeight: 1.08, margin: "12px 0 7px", color: T.greenDk }}>Find your next step</h1>
        <p style={{ position: "relative", fontSize: 14, color: T.sub, lineHeight: 1.5, margin: 0, maxWidth: 460 }}>Search by what you need today — or choose a starting point below. You do not need to know the name of a service first.</p>
        <div style={{ position: "relative", marginTop: 15 }}>
          <label htmlFor="resource-directory-search" style={{ display: "block", fontSize: 12.5, fontWeight: 850, color: T.greenDk, marginBottom: 6 }}>What would help right now?</label>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <Search size={18} color={T.sub} style={{ position: "absolute", left: 13, pointerEvents: "none" }} />
            <input id="resource-directory-search" type="search" value={resourceQuery} onChange={(event) => setResourceQuery(event.target.value)} placeholder="Try “someone to talk to”, housing, food…" aria-describedby="resource-search-hint" style={{ width: "100%", boxSizing: "border-box", border: `2px solid rgba(77,159,104,0.24)`, borderRadius: 15, padding: "12px 42px 12px 40px", background: "rgba(255,255,255,0.94)", color: T.ink, fontSize: 14, outline: "none", boxShadow: "0 5px 14px rgba(37,78,54,0.08)" }} />
            {hasSearch && <button type="button" onClick={() => setResourceQuery("")} aria-label="Clear resource search" style={{ position: "absolute", right: 9, width: 30, height: 30, border: "none", borderRadius: 999, background: "#edf5ef", color: T.greenDk, display: "grid", placeItems: "center", cursor: "pointer" }}><X size={15} /></button>}
          </div>
          <div id="resource-search-hint" style={{ marginTop: 6, color: T.sub, fontSize: 11.5 }}>Matches service names, descriptions, and related words. One matching idea is enough.</div>
        </div>
        <div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 7, marginTop: 12 }}>
          {quickSearches.map(([query, label, Icon, color]) => <button key={query} type="button" onClick={() => setResourceQuery(query)} style={{ display: "flex", alignItems: "center", gap: 7, minHeight: 42, border: `1px solid ${color}33`, borderRadius: 13, padding: "8px 9px", background: "rgba(255,255,255,0.7)", color: T.ink, textAlign: "left", fontSize: 11.5, fontWeight: 800, cursor: "pointer" }}><span style={{ width: 27, height: 27, borderRadius: 9, display: "grid", placeItems: "center", background: `${color}1b`, flexShrink: 0 }}><Icon size={15} color={color} /></span>{label}</button>)}
        </div>
        <div id="resources-toc" style={{ position: "relative", scrollMarginTop: 18, marginTop: 14, borderRadius: 16, background: "rgba(255,255,255,0.72)", border: "1px solid rgba(77,159,104,0.14)", overflow: "hidden" }}>
          <button type="button" onClick={() => setTocOpen((open) => !open)} aria-expanded={tocOpen} aria-controls="resources-toc-list" style={{ width: "100%", border: "none", background: "transparent", padding: "12px 13px", display: "flex", alignItems: "center", gap: 9, color: T.greenDk, cursor: "pointer", textAlign: "left" }}><span style={{ width: 31, height: 31, borderRadius: 10, background: "#e4f2e9", display: "grid", placeItems: "center" }}><List size={17} color={T.greenDk} /></span><span style={{ flex: 1 }}><strong style={{ display: "block", fontSize: 13.5 }}>Browse by need</strong><span style={{ display: "block", color: T.sub, fontSize: 11.5, marginTop: 2 }}>Jump straight to the kind of support you want</span></span><ChevronDown size={18} style={{ transform: tocOpen ? "rotate(180deg)" : "none", transition: "transform .18s ease" }} /></button>
          {tocOpen && <div id="resources-toc-list" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 7, padding: "0 10px 11px" }}>{toc.map(([id, label], index) => <button key={id} type="button" onClick={() => jump(id)} style={{ border: `1px solid ${index === 0 ? "#b9ddc3" : T.line}`, background: index === 0 ? "#edf8f0" : "rgba(255,255,255,0.76)", borderRadius: 11, padding: "9px 8px", textAlign: "left", color: T.ink, fontSize: 11.5, fontWeight: 750, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}><ChevronRight size={14} color={index === 0 ? T.greenDk : T.sub} />{label}</button>)}</div>}
        </div>
      </div>

      <section aria-labelledby="resources-rex-welcome" style={{ display: "flex", alignItems: "flex-start", gap: 12, marginTop: 12, padding: 14, borderRadius: 20, background: "linear-gradient(135deg, #e8f7f3 0%, #ffffff 58%, #fff4e5 100%)", border: "1px solid rgba(47,128,124,0.22)", boxShadow: T.soft }}>
        <Portrait src={CHARS.rex.img} name="Rex" size={58} speaking={resourcesSpeaking} tint={CHARS.rex.tint} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}><span style={{ fontSize: 10, fontWeight: 900, letterSpacing: 0.9, textTransform: "uppercase", color: "#28736f" }}>Rex · A quick guide</span>{resourcesSpeaking && <span aria-live="polite" style={{ fontSize: 10.5, color: "#28736f" }}>Speaking…</span>}</div>
          <h2 id="resources-rex-welcome" style={{ margin: "4px 0 5px", color: T.greenDk, fontSize: 16, lineHeight: 1.2 }}>Not sure where to start?</h2>
          <p style={{ margin: 0, color: T.ink, fontSize: 13, lineHeight: 1.48 }}>{resourcesWelcome}</p>
          <button type="button" onClick={() => speakResourcesWelcome(spokenResourcesWelcome, CHARS.rex)} aria-label="Hear Rex explain the Support Directory again" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, border: "1px solid rgba(47,128,124,0.28)", borderRadius: 999, padding: "8px 11px", background: "rgba(255,255,255,0.78)", color: "#28736f", fontSize: 11.5, fontWeight: 800, cursor: "pointer" }}><Volume2 size={14} aria-hidden="true" /> Hear Rex again</button>
        </div>
      </section>

    <div id="resources-juan" style={{ scrollMarginTop: 18, marginTop: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {resourceCard({ Icon: Users, tint: "#e2f3e8", color: T.greenDk, eyebrow: "The Resilience Hub · Western Sydney", title: "Juan’s free 8-week in-person support program", onClick: onOpenProgramInfo, actionLabel: "Learn about the program", children: "Practical, person-to-person support for men across Fairfield, Liverpool, Western Sydney and beyond — with lived experience, steady check-ins, and help finding your next step." })}
        {resourceCard({ Icon: Heart, image: "/community/tarn-lee-training.jpg", imageAlt: "Tarn Lee Training", tint: "#fbe5ef", color: "#a33d70", eyebrow: "Mental health and suicide intervention training", title: "Tarn Lee Training", href: "https://www.tarnialeetraining.com/", children: "Practical, trauma-informed training and facilitation that helps build safer, more inclusive communities — from ASIST and SafeTALK to workshops, diversity training, and group facilitation.", actionLabel: "Visit Tarn Lee Training" })}
        {resourceCard({ Icon: ExternalLink, image: "/community/pestguard-sydney.png", imageAlt: "PestGuard Sydney service vehicle", tint: "#e8f4e8", color: "#3d8049", eyebrow: "Compassionate local service", title: "PestGuard Sydney", href: "https://pestguardsydney.net.au/", phone: "0450 105 702", socialUrl: "https://www.instagram.com/pestguard_sydney/", socialLabel: "Instagram: @pestguard_sydney", children: <>Compassionate pest control — no judgment, just help. Jean-Pierre sees the person behind every home and treats everyone with dignity and respect. Servicing Narellan &amp; South-West Sydney.</> })}
      </div>
    </div>

      {sectionLabel("resources-immediate", LifeBuoy, "Immediate support", "If things feel urgent or unsafe, these are the first places to reach out.", "#c94f4f")}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {resourceCard({ Icon: Phone, image: "/community/lifeline-logo.png", imageAlt: "Lifeline Australia logo", tint: "#fff0f0", color: "#1769aa", eyebrow: "24/7 crisis support", title: "Lifeline", href: "https://www.lifeline.org.au/", phone: "13 11 14", children: "Australia-wide crisis support and suicide prevention services, available 24 hours a day by phone, text, and online chat." })}
        {resourceCard({ Icon: LifeBuoy, tint: "#e4f2ec", color: "#17656b", eyebrow: "Free, no appointment needed", title: "NSW Safe Haven", href: "https://www.health.nsw.gov.au/towardszerosuicides/Pages/safe-haven.aspx", children: "A calm, culturally sensitive place to talk with suicide-prevention peer workers when you are experiencing distress or suicidal thoughts. Find a Safe Haven near you across NSW." })}
        {resourceCard({ Icon: Phone, tint: "#e7eefb", color: T.blueDk, eyebrow: "Emergency", title: "Police, ambulance or fire", href: "tel:000", phone: "000", children: "Call 000 if someone is in immediate danger or needs urgent medical help." })}
        {resourceCard({ Icon: Heart, tint: "#f4e3d9", color: "#b56739", eyebrow: "Mental health support", title: "Beyond Blue and MensLine Australia", href: "https://www.beyondblue.org.au/get-support", children: "Beyond Blue: 1300 22 4636. MensLine Australia: 1300 78 99 78 for men needing phone or online support." })}
      </div>

      {sectionLabel("resources-virtual", Wifi, "Virtual Support — From Home", "Talk, connect, or get support from your couch. Digital chat, a Zoom group, a phone call, or in-person support — whatever feels right.", "#2f807c")}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {resourceCard({ Icon: Users, tint: "#e8f4f3", color: "#28736f", eyebrow: "Online men’s groups", title: "The Complete Men Foundation", href: "https://completemen.org.au/online-mens-groups", children: "Free weekly online men’s support circles via Zoom for men across Australia. A space to talk about isolation, relationships, depression, and everyday life without judgement." })}
        {resourceCard({ Icon: Wifi, tint: "#eaf0fb", color: T.blueDk, eyebrow: "Online anxiety support", title: "WayAhead Men’s Online Anxiety Support Group", href: "https://wayahead.org.au", children: "A NSW-based online group for men managing anxiety, stress, and overwhelm. Visit the website for current meeting details and registration information." })}
        {resourceCard({ Icon: Phone, tint: "#e7f5eb", color: T.greenDk, eyebrow: "24/7 men’s counselling", title: "MensLine Australia", href: "https://mensline.org.au", phone: "1300 789 978", children: "Free telephone and online counselling for men and families, including support with personal crisis, relationship breakdown, and emotional wellbeing." })}
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
        {resourceCard({ Icon: MapPin, image: "/community/salvation-army-shield.jpg", imageAlt: "The Salvation Army shield", tint: "#fff0f0", color: "#c6283b", eyebrow: "Find local support", title: "The Salvation Army", href: "https://www.salvationarmy.org.au/find-us/", phone: "13 72 58", children: "Find local Salvation Army services and practical support. Their Australian services include assistance delivered with dignity and without discrimination." })}
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

      {sectionLabel("resources-community", Users, "Community and connection", "Places to find belonging, practical support, and people who understand.", T.greenDk)}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {resourceCard({ Icon: MessageCircle, tint: "#e8f0fb", color: T.blueDk, eyebrow: "Community group", title: "Resilience Hub group", href: "https://www.facebook.com/share/g/1Edkyyez1t/", children: "Join the Resilience Hub Facebook group for conversation, encouragement, and connection with the wider community." })}
        {resourceCard({ Icon: BookOpen, tint: "#e9f5ee", color: T.greenDk, eyebrow: "The Resilience Hub", title: "The Resilience Hub website", href: "https://resiliencehubnsw.com.au", children: "Meet the team, learn more about the Hub, and find ways to stay connected beyond the app." })}
        {resourceCard({ Icon: Users, image: "/community/salvation-army-shield.jpg", imageAlt: "The Salvation Army shield", tint: "#fff0f0", color: "#b6263a", eyebrow: "Villawood community", title: "Urana St Community Centre", href: "https://www.facebook.com/Uranastreet/", children: "Local community information, updates, and ways to connect through the Villawood Salvos." })}
        {resourceCard({ Icon: Shield, tint: "#fff2e4", color: "#b56e35", eyebrow: "Addiction recovery support", title: "Link Foundation", href: "https://linkfoundationaod.org.au/", children: "Free counselling and recovery support for people and families affected by alcohol and other drug use." })}
        {resourceCard({ Icon: Users, tint: "#e8f5ec", color: T.greenDk, eyebrow: "Community connection · Bonnyrigg", title: "South West Sydney Men’s Shed", onClick: onOpenMensShed, children: "Mateship, practical skills, and a welcoming place to connect. Open the listing for location and current fees.", actionLabel: "Open Men’s Shed information" })}
        {resourceCard({ Icon: Users, image: "/community/rebuilt-mens-group.jpg", imageAlt: "Rebuilt Men’s Group — Good men, real conversations, genuine growth", tint: "#fff0d4", color: "#9a641b", eyebrow: "Community connection · Ed.Square", title: "Rebuilt Men’s Group", href: "https://www.facebook.com/events/edsquare-town-centre/rebuilt-mens-group/1035497656177606/", children: "A judgement-free men’s group for real conversations, accountability, personal growth, and brotherhood. The next gathering is Wednesday 7 October at 6pm at Max Brenner, Ed.Square.", actionLabel: "Open the Facebook event" })}
        {resourceCard({ Icon: MessageCircle, tint: "#fffaf0", color: "#336f52", eyebrow: "Safe conversation", title: "The Men’s Table", href: "https://www.themenstable.org", children: "A place for men to share honestly, listen, and build meaningful connection." })}
        {resourceCard({ Icon: Heart, image: "/community/fairfield-city-leisure-centres-logo.png", imageAlt: "Fairfield City Leisure Centres logo", tint: "#e8f0fb", color: "#197aa8", eyebrow: "Local health and wellbeing", title: "Fairfield Leisure Centre", href: "https://www.fairfieldcityleisurecentres.com.au/", children: "Affordable local options including gym, group fitness, pools, Learn to Swim, and Aquatopia across Fairfield City." })}
      </div>

      {sectionLabel("resources-family", Users, "Family, children and youth", "Support for family safety, young people, carers, and children.", "#b56739")}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {resourceCard({ Icon: Heart, image: "/community/lumina-project.png", imageAlt: "The Lumina Project logo", tint: "#e3f0ed", color: "#17656b", eyebrow: "Bereavement and workplace support", title: "The Lumina Project", href: "https://theluminaproject.org.au/index.html", children: "No parent should have to choose between grieving their child and keeping their job." })}
        {resourceCard({ Icon: Shield, tint: "#f4e3d9", color: "#b56739", eyebrow: "Family and domestic violence", title: "1800RESPECT", href: "https://www.1800respect.org.au/", phone: "1800 737 732", children: "National counselling, information, and support for people affected by domestic, family, or sexual violence." })}
        {resourceCard({ Icon: Users, tint: "#e8f0fb", color: T.blueDk, eyebrow: "For young people", title: "Kids Helpline", href: "https://kidshelpline.com.au/", phone: "1800 55 1800", children: "Free, private counselling and support for children and young people up to age 25." })}
      </div>

      {sectionLabel("resources-health", Heart, "Health and wellbeing", "Low-cost health pathways, mental wellbeing support, and help finding the right service.", "#c56e68")}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {resourceCard({ Icon: Heart, tint: "#fbe1e1", color: "#c56e68", eyebrow: "Mental wellbeing", title: "Beyond Blue", href: "https://www.beyondblue.org.au/get-support", phone: "1300 22 4636", children: "Information, counselling, and support for anxiety, depression, and suicide prevention." })}
        {resourceCard({ Icon: Heart, image: "/community/awareness-services.jpg", imageAlt: "Awareness Services logo", tint: "#e5f4fb", color: "#087fb5", eyebrow: "Holistic wellbeing", title: "Awareness Services", href: "https://awareness-services.com/", children: "General information, reflection prompts, and resources supporting mental, financial, and physical wellbeing. Visit the website to explore Awareness Services and its available pathways." })}
        {resourceCard({ Icon: Search, tint: "#e9f5ee", color: T.greenDk, eyebrow: "Find local help", title: "Ask Izzy — health and support search", href: "https://askizzy.org.au/", children: "Search for health, counselling, medical, and community services near your location." })}
      </div>

      {sectionLabel("resources-safety", LifeBuoy, "Stay safe", "Practical safety information and in-app support when you need it.", "#a47c1f")}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {resourceCard({ Icon: LifeBuoy, tint: "#f3ecd6", color: "#a47c1f", eyebrow: "The Resilience Hub", title: "Stay Safe", onClick: onOpenSafety, children: "Substance safety, overdose information, and support lines. Open the in-app safety guide whenever you need it.", actionLabel: "Open in-app safety guide" })}
      </div>
      {hasSearch && !matchedAny && <div role="status" style={{ margin: "20px 0 4px", padding: "18px 15px", borderRadius: 17, background: "#fffaf0", border: "1px solid #eadfbd", color: T.ink, textAlign: "center", lineHeight: 1.5 }}><div style={{ fontWeight: 800 }}>No exact matches yet</div><div style={{ color: T.sub, fontSize: 13, marginTop: 4 }}>Try a broader word such as <strong>support</strong>, <strong>health</strong>, <strong>housing</strong>, or <strong>community</strong>.</div></div>}
      <div style={{ margin: "18px 2px 0", fontSize: 11.5, color: T.sub, lineHeight: 1.5 }}>Please check each organisation’s current hours, eligibility, fees, and availability before travelling. If there is immediate danger, call <a href="tel:000" style={{ color: T.greenDk, fontWeight: 800 }}>000</a>.</div>
      <Disclaimer />
    </>
  );
}

function CampfirePage({ onBack, campfireAccess = "", voiceOn = false, speechLang = "en-AU" }) {
  const campfireRexWelcome = spokenIntro("campfire", "Hi, I’m Rex. Before you enter, here are the ways you can use the Campfire: you can simply watch and listen without joining in, join the text chat, or use voice chat when you feel ready. There is also an in-app video chat feature if you’d like to connect face to face — you choose who to talk with, and they need to accept. One gentle reminder: because the Campfire you selected is connected to your access, your Campfire choice is locked in. If you need to change your Campfire selection, contact support from the Campfire selection screen in your profile. Take your time — you’re welcome to come and go as you need.", speechLang);
  const { speak: speakCampfireRex, stop: stopCampfireRex, speaking: campfireRexSpeaking, prefetch: prefetchCampfireRex } = useVoice(voiceOn);
  useEffect(() => {
    if (!voiceOn || !__autoIntroVoiceOn) return undefined;
    prefetchCampfireRex(campfireRexWelcome, CHARS.rex);
    const timer = setTimeout(() => speakCampfireRex(campfireRexWelcome, CHARS.rex), 70);
    return () => { clearTimeout(timer); stopCampfireRex(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceOn, speechLang, campfireRexWelcome]);
  const access = String(campfireAccess || "");
  const normalizedAccess = access.trim().toLowerCase();
  const allowedFire = access === "0" || normalizedAccess === "mens" || normalizedAccess === "men" || access.startsWith("Men’s") || access.startsWith("Men's") ? "mens"
    : access === "1" || normalizedAccess === "ladies" || normalizedAccess === "ladies'" || normalizedAccess === "women" || access.startsWith("Ladies’") || access.startsWith("Ladies'") ? "ladies" : null;
  const enterCampfire = () => {
    try { sessionStorage.setItem("rh_campfire_access", allowedFire || ""); } catch {}
    window.location.href = `/campfire.html?v=20260928-voice-retry1&space=${encodeURIComponent(allowedFire || "")}`;
  };
  return <>
    <Brand right={<BackBtn onBack={onBack} />} />
    <div style={{ background: "radial-gradient(circle at 50% 0%, #604022 0%, #2a1a10 48%, #140d09 100%)", color: "#e9d9c0", borderRadius: 25, padding: "24px 18px 22px", marginTop: 7, boxShadow: "0 14px 30px rgba(42,26,16,0.24)", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", width: 190, height: 190, borderRadius: "50%", right: -72, top: -82, background: "rgba(232,112,58,0.13)" }} />
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 8, color: "#f0a16b", fontSize: 11, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase" }}><Flame size={17} /> A place to sit with it</div>
      <h1 style={{ position: "relative", margin: "10px 0 9px", fontFamily: "Georgia, serif", fontWeight: 500, fontSize: 30, lineHeight: 1.1, color: "#f4e6d1" }}>The Virtual Campfire</h1>
      <p style={{ position: "relative", margin: 0, color: "#c8b79d", fontSize: 14, lineHeight: 1.58 }}>A quiet, anonymous place for men to connect, talk straight, listen, or simply sit near other people when the day feels too heavy.</p>
    </div>
    <section aria-labelledby="campfire-rex-welcome" style={{ display: "flex", alignItems: "flex-start", gap: 12, marginTop: 12, padding: 14, borderRadius: 20, background: "linear-gradient(135deg, #e8f7f3 0%, #ffffff 58%, #fff4e5 100%)", border: "1px solid rgba(47,128,124,0.22)", boxShadow: T.soft }}>
      <Portrait src={CHARS.rex.img} name="Rex" size={58} speaking={campfireRexSpeaking} tint={CHARS.rex.tint} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}><span style={{ fontSize: 10, fontWeight: 900, letterSpacing: 0.9, textTransform: "uppercase", color: "#28736f" }}>Rex · A quick guide</span>{campfireRexSpeaking && <span aria-live="polite" style={{ fontSize: 10.5, color: "#28736f" }}>Speaking…</span>}</div>
        <h2 id="campfire-rex-welcome" style={{ margin: "4px 0 5px", color: T.greenDk, fontSize: 16, lineHeight: 1.2 }}>Hi, I’m Rex — before you enter</h2>
        <p style={{ margin: 0, color: T.ink, fontSize: 13, lineHeight: 1.48 }}>Choose how you want to take part: you can simply watch, join the text chat, use voice chat, or connect through the in-app video chat feature. For video chat, choose someone to talk with and they’ll need to accept.</p>
        <p style={{ margin: "8px 0 0", color: T.ink, fontSize: 13, lineHeight: 1.48 }}>Just a gentle reminder: your Campfire selection is linked to your access and is locked in. If you need to change your Campfire selection, contact support from the Campfire selection screen in your profile.</p>
        <button type="button" onClick={() => speakCampfireRex(campfireRexWelcome, CHARS.rex)} aria-label="Hear Rex explain the Campfire again" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, border: "1px solid rgba(47,128,124,0.28)", borderRadius: 999, padding: "8px 11px", background: "rgba(255,255,255,0.78)", color: "#28736f", fontSize: 11.5, fontWeight: 800, cursor: "pointer" }}><Volume2 size={14} aria-hidden="true" /> Hear Rex explain the Campfire again</button>
      </div>
    </section>
    <div style={{ marginTop: 14, background: "linear-gradient(135deg, #fff8ee 0%, #fff 75%)", border: "1px solid #ead8c7", borderRadius: 20, padding: 16, boxShadow: T.soft }}>
      <div style={{ color: "#a9511f", fontSize: 10, fontWeight: 900, letterSpacing: 0.9, textTransform: "uppercase" }}>Why it’s here</div>
      <h2 style={{ margin: "5px 0 8px", fontSize: 20, color: T.ink }}>Men’s mental health needs somewhere real to land.</h2>
      <p style={{ margin: 0, color: T.sub, fontSize: 13.5, lineHeight: 1.58 }}>Isolation can make a hard day feel impossible. The Campfire is designed to make connection easier: no fixing, no advice, no pressure to perform, and no requirement to speak. You can use a nickname or stay anonymous, choose an avatar or no image, and leave whenever you need.</p>
    </div>
    <div style={{ margin: "20px 0 10px", fontSize: 20, fontWeight: 900, color: T.greenDk }}>What to expect</div>
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      {["Sit quietly or talk straight — both are welcome.", "Men’s Fire is built for blokes, with a Ladies’ Fire and Common Fire also available.", "Use voice or text, at your own pace. No real name is needed.", "The Campfire is peer connection, not counselling or emergency care.", "If someone is in immediate danger, call Triple Zero (000) or use the Hub’s crisis support options."] .map((item, index) => <div key={item} style={{ display: "flex", gap: 10, alignItems: "flex-start", background: index === 4 ? "#fff0f0" : "#fff", border: `1px solid ${index === 4 ? "#f0d1d1" : T.line}`, borderRadius: 15, padding: "11px 12px", color: index === 4 ? "#a53f42" : T.sub, fontSize: 13, lineHeight: 1.45 }}><span style={{ color: index === 4 ? "#c94f4f" : "#a9511f", fontWeight: 900 }}>{index === 4 ? "!" : "•"}</span><span>{item}</span></div>)}
    </div>
    <button onClick={enterCampfire} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, marginTop: 18, padding: "14px 18px", border: 0, borderRadius: 999, background: "linear-gradient(135deg, #e8703a, #a9511f)", color: "#fff8ed", fontWeight: 900, cursor: "pointer", boxShadow: "0 9px 18px rgba(169,81,31,0.22)" }}><Flame size={19} /> {allowedFire ? "Enter your Campfire space" : "Check my Campfire access"} <ChevronRight size={16} /></button>
    <p style={{ margin: "11px 4px 0", color: T.sub, fontSize: 11.5, lineHeight: 1.45, textAlign: "center" }}>You can come and go as you please. The Campfire does not replace professional or emergency support.</p>
    <div style={{ height: 28 }} />
  </>;
}

function VirtualSupportPage({ onBack }) {
  const supportCard = ({ Icon, title, eyebrow, text, href, phone, color = "#2f807c", tint = "#e8f4f3" }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ display: "block", textDecoration: "none", color: T.ink, background: `linear-gradient(135deg, ${tint} 0%, #fff 78%)`, border: `1px solid ${color}22`, borderRadius: 19, padding: 14, boxShadow: T.soft }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}><div style={{ width: 44, height: 44, borderRadius: 14, background: `${color}18`, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon size={22} color={color} /></div><div style={{ flex: 1 }}><div style={{ color, fontSize: 10, fontWeight: 900, letterSpacing: 0.9, textTransform: "uppercase" }}>{eyebrow}</div><div style={{ fontWeight: 800, fontSize: 16, marginTop: 3 }}>{title}</div><div style={{ fontSize: 13, color: T.sub, lineHeight: 1.48, marginTop: 5 }}>{text}</div>{phone && <div style={{ display: "inline-block", marginTop: 10, padding: "7px 10px", borderRadius: 999, background: "rgba(255,255,255,0.78)", fontSize: 11.5, fontWeight: 800 }}>Phone: {phone}</div>}</div><ExternalLink size={18} color={color} style={{ flexShrink: 0, marginTop: 12 }} /></div>
    </a>
  );
  return <>
    <Brand right={<BackBtn onBack={onBack} />} />
    <div style={{ background: "linear-gradient(145deg, #e4f4f2 0%, #fbfdf9 55%, #e9effb 100%)", border: "1px solid rgba(47,128,124,0.16)", borderRadius: 24, padding: "22px 18px 20px", marginTop: 7, boxShadow: T.soft, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", width: 180, height: 180, borderRadius: "50%", right: -65, top: -85, background: "rgba(255,255,255,0.52)" }} />
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 9, color: "#28736f", fontSize: 11, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase" }}><Wifi size={16} /> Virtual support</div>
      <h1 style={{ position: "relative", margin: "9px 0 8px", fontSize: 28, lineHeight: 1.12, color: T.ink }}>From home, on your terms</h1>
      <p style={{ position: "relative", margin: 0, color: T.sub, fontSize: 13.5, lineHeight: 1.55 }}>Talk, connect, or get support from your couch. No travel needed, no pressure to explain everything at once — choose the kind of contact that feels manageable today.</p>
    </div>
    <div style={{ marginTop: 14, background: "#fff8f2", border: "1px solid #f0dfcf", borderRadius: 19, padding: 15 }}>
      <div style={{ color: "#a65f36", fontSize: 10, fontWeight: 900, letterSpacing: 0.9, textTransform: "uppercase" }}>Why this matters</div>
      <div style={{ fontWeight: 850, fontSize: 18, marginTop: 4 }}>Men deserve support before things reach breaking point.</div>
      <p style={{ margin: "8px 0 0", color: T.sub, fontSize: 13, lineHeight: 1.52 }}>Australian Bureau of Statistics data recorded 3,326 deaths by suicide in 2024 after preliminary revision. The age-standardised rate was 18.4 per 100,000 for males and 5.6 for females. These figures describe a national pattern, not any individual person’s risk, and recent figures may be revised as coronial information is updated.</p>
      <p style={{ margin: "9px 0 0", color: T.sub, fontSize: 11.5, lineHeight: 1.45 }}>Sources: <a href="https://www.abs.gov.au/statistics/health/causes-death/intentional-self-harm-suicide-deaths/latest-release" target="_blank" rel="noopener noreferrer" style={{ color: "#a65f36", fontWeight: 800 }}>Australian Bureau of Statistics</a> and <a href="https://www.aihw.gov.au/suicide-self-harm-monitoring/overview/summary" target="_blank" rel="noopener noreferrer" style={{ color: "#a65f36", fontWeight: 800 }}>AIHW</a>.</p>
    </div>
    <div style={{ margin: "22px 0 11px", fontSize: 20, fontWeight: 900, color: T.greenDk }}>Talk, connect, or reach out</div>
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {supportCard({ Icon: Users, eyebrow: "Online men’s groups", title: "The Complete Men Foundation", href: "https://completemen.org.au/online-mens-groups", text: "Free weekly online men’s support circles via Zoom for men across Australia — a safe, judgement-free place to talk isolation, relationships, depression, and everyday life." })}
      {supportCard({ Icon: Wifi, eyebrow: "Online anxiety support", title: "WayAhead Men’s Online Anxiety Support Group", href: "https://wayahead.org.au", color: T.blueDk, tint: "#eaf0fb", text: "A NSW-based online group for men managing anxiety, stress, and overwhelm. Check the website for current meeting details." })}
      {supportCard({ Icon: Phone, eyebrow: "24/7 men’s counselling", title: "MensLine Australia", href: "https://mensline.org.au", phone: "1300 789 978", color: T.greenDk, tint: "#e7f5eb", text: "Free telephone and online counselling for men and families, including support with personal crisis, relationship breakdown, and emotional wellbeing." })}
    </div>
    <div style={{ marginTop: 18, background: "#fff0f0", border: "1px solid #f0d1d1", borderRadius: 19, padding: 15 }}>
      <div style={{ fontWeight: 850, fontSize: 16, color: "#a53f42" }}>If you feel unsafe right now</div>
      <p style={{ margin: "7px 0 10px", color: T.sub, fontSize: 13, lineHeight: 1.5 }}>Call <a href="tel:000" style={{ color: "#a53f42", fontWeight: 900 }}>000</a> if there is immediate danger. You can also call <a href="tel:131114" style={{ color: "#a53f42", fontWeight: 900 }}>Lifeline on 13 11 14</a>. If calling feels hard, move closer to another person and ask them to stay with you while you reach out.</p>
      <div style={{ fontSize: 11.5, color: T.sub, lineHeight: 1.45 }}>These services are independent organisations. Check their current availability directly. This page is support information, not a replacement for emergency or clinical care.</div>
    </div>
    <div style={{ height: 28 }} />
  </>;
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

function JournalPinGate({ journalPinHash = null, onUnlock, onBack }) {
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
      const expected = saved?.hash || journalPinHash;
      if (!expected || hash !== expected) { setError("That PIN is not correct. Please try again."); return; }
      if (!saved?.hash && journalPinHash) await sset(JOURNAL_PIN_STORAGE_KEY, { hash: journalPinHash, question: "", createdAt: Date.now(), accountSynced: true });
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
      setPrompt(out); if (voiceOn && __autoReplyVoiceOn) speak(out, CHARS.lila);
    } catch { setPrompt("However you said it, thanks for putting it into words. What feels most true about it right now?"); }
    finally { setReflecting(false); }
  };

  const tabButton = (key, label, Icon) => <button onClick={() => { setTab(key); setText(""); }} aria-pressed={tab === key} style={{ flex: 1, border: tab === key ? `1.5px solid ${T.green}` : `1px solid ${T.line}`, borderRadius: 13, padding: "10px 7px", background: tab === key ? "#e6f5eb" : T.card, color: tab === key ? T.greenDk : T.sub, fontSize: 11.5, fontWeight: tab === key ? 800 : 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}><Icon size={14} />{label}</button>;
  const serviceCard = (label, sub, href, Icon, accent) => <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noopener noreferrer" : undefined} style={{ display: "flex", alignItems: "center", gap: 11, background: T.card, borderRadius: 16, padding: 13, boxShadow: T.soft, textDecoration: "none", color: T.ink, borderLeft: `4px solid ${accent}` }}><div style={{ width: 38, height: 38, borderRadius: 12, background: `${accent}18`, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon size={19} color={accent} /></div><div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontSize: 14 }}>{label}</div><div style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.4 }}>{sub}</div></div><ExternalLink size={16} color={accent} /></a>;

  return (
    <>
      <Brand right={<BackBtn onBack={onBack} />} />
      <div style={{ background: "linear-gradient(135deg, #eee9f8, #f8fbf8 72%)", borderRadius: 20, padding: "15px 16px", boxShadow: T.soft, marginTop: 5 }}><div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, color: T.ink }}><Shield size={18} color="#7055a8" /> Private space</div><div style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.45, marginTop: 4 }}>Your notes stay behind your Journal PIN. Choose the kind of space you need today.</div></div>
      <div style={{ display: "flex", gap: 7, marginTop: 13 }}>{tabButton("journal", "Journal", BookOpen)}{tabButton("fleeting", "Fleeting thoughts", Sparkles)}{tabButton("services", "Safety First", LifeBuoy)}</div>

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
  return <><SectionTitle>{title}</SectionTitle><div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{entries.map((e) => <div key={e.id} data-rh-no-localize style={{ background: T.card, borderRadius: 16, padding: 14, boxShadow: T.soft }}><div style={{ fontSize: 11.5, color: T.sub, marginBottom: 6 }}>{new Date(e.ts).toLocaleString("en-AU")}</div><div style={{ fontSize: 14.5, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{e.text}</div></div>)}</div></>;
}
