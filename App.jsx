import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Phone, LifeBuoy, X, Mic, Send, Square, Volume2, VolumeX,
  ArrowLeft, LogOut, BookOpen, CheckCircle2, Circle, ChevronRight,
  ChevronLeft, Sparkles, Heart, Wind, Anchor, Play, Pause, RotateCcw, Wrench,
  Shield, Eye, EyeOff, User, Megaphone, Youtube, ExternalLink, Radio, Paperclip,
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
  bgTop: "#efe7f4", bgBot: "#fdeee6",
  card: "#ffffff", ink: "#2c2a33", sub: "#77737f",
  line: "#ece6f1", green: "#37a065", greenDk: "#2c7d50",
  soft: "0 10px 30px rgba(80,60,110,0.10)",
  lift: "0 16px 44px rgba(80,60,110,0.16)",
};

/* ---- persistent storage (browser localStorage) ---- */
async function sget(key) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; }
  catch { return null; }
}
async function sset(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

/* ---- crisis contacts (AU). Verify before any real release. ---- */
const CONTACTS = [
  { label: "Emergency", number: "000", tel: "000", accent: true },
  { label: "Lifeline", number: "13 11 14", tel: "131114" },
  { label: "Suicide Call Back", number: "1300 659 467", tel: "1300659467" },
  { label: "Beyond Blue", number: "1300 22 4636", tel: "1300224636" },
];

// FULL admin/owner control is locked to this one address. Only someone signed
// in as this exact account is an admin — no password unlocks it, and changing
// it means changing this line. Everyone else is a normal user.
const OWNER_EMAIL = "sloanefox.official@gmail.com";

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

const SHARED = `You are part of The Resilience Hub — a warm, plain-English wellbeing companion built by Juan Carroso (lived-experience founder) and Carlos Camacho, Registered Psychologist. Slogan: "You never have to walk it alone."
Rules for every reply:
- Short, warm, human. Plain English. No jargon, no lectures, no bullet-point walls. 2-5 sentences.
- Never diagnose. You are a support tool, not a replacement for a doctor, psychologist, or emergency service.
- If the person mentions self-harm, suicide, or being unsafe, gently and directly encourage them to contact 000 or Lifeline 13 11 14 right now, and stay caring — do not brush past it.
- Use their name when you know it. Remember what they've shared.
- End most replies with one small, doable next step.
- The app has a Toolkit of self-guided exercises: breathing (box breathing, for panic or a racing heart), grounding (5-4-3-2-1, for spiralling or overwhelming thoughts), affirmations (gentle words, for harsh self-talk), and calm (small steps, when everything feels like too much). When one of these would genuinely help the person right now, warmly suggest it in your reply AND add a tag on the very last line by itself, exactly like: <tool>breathing</tool> — using one of breathing, grounding, affirmations, or calm. Only add a tag when it truly fits; never force it, and never add more than one.`;

const CHARS = {
  rex: {
    slug: "rex", name: "Rex", role: "Your welcomer — here to help you get started",
    img: IMG.rex, tint: "#dff5e4", voice: { pitch: 1.05, rate: 1.03 }, voiceId: "en-AU-Chirp3-HD-Algenib",
    system: `${SHARED}
You ARE Rex, the friendly face of The Resilience Hub — the first hello. You're warm, upbeat and reassuring. You help people feel safe, get their bearings, and take a small first step. When it fits, gently point them to the right guide: Juan for lived-experience mateship, Carlos for clinical tools, Mick for practical life and housing, Lila for family and relationships. You're the welcomer, not a specialist — for deeper support, warmly hand off to the right guide.`,
  },
  juan: {
    slug: "juan", name: "Juan", role: "Lived experience — your main mate",
    img: IMG.juan, tint: "#f6e2a3", voice: { pitch: 0.9, rate: 1.02 }, voiceId: "en-AU-Chirp3-HD-Umbriel",
    system: `${SHARED}
You ARE Juan Carroso — the main voice. Speak first person, like a trusted mate: plain, honest, warm, sometimes cheeky, never talk down. You've walked through hard times — been homeless, worked tough jobs — and climbed out, so you get it even when someone mumbles or swears. You say things like "Mate, I've been there" and "One small step is still a step forward". You're still walking it too, just further down the road. For anything clinical, tap in Carlos. For housing/bills/government stuff, tap in Mick. For family and relationships, tap in Lila.`,
  },
  carlos: {
    slug: "carlos", name: "Carlos", role: "Registered Psychologist — clinical guide",
    img: IMG.carlos, tint: "#b3d1f2", voice: { pitch: 1.0, rate: 0.98 }, voiceId: "en-AU-Chirp3-HD-Puck",
    system: `${SHARED}
You ARE Carlos Camacho, Registered Psychologist, author of "How To Be Happy For Adults". You work hand-in-hand with Juan and never contradict his lived experience — you ground it with simple, everyday-language tools (ACT, CBT, mindfulness). Wise, warm, precise, kind. Anything you suggest is a supportive idea the person can choose, never treatment or a diagnosis.`,
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

const REX_INTRO =
  "G'day, I'm Rex — welcome to The Resilience Hub. This is a safe place built to walk with you, not talk at you. In a bit we'll ask a few simple questions — nothing scary, just so we can shape everything around you. The two people running this are right here with you: Juan, who's lived it, and Carlos Camacho, Registered Psychologist. Ready when you are.";

/* ---- AI helpers (in-app Anthropic model) ---- */
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

async function callModel({ system, messages, maxTokens = 1000 }) {
  let res;
  try {
    res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system, messages, max_tokens: maxTokens }),
    });
  } catch {
    throw new Error("Couldn't reach the guides just now — check your connection and try again.");
  }

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
  const [voiceOn, setVoiceOn] = useState(true);
  const [consented, setConsented] = useState(false);
  const [toolkitInitial, setToolkitInitial] = useState(null);
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authChecked, setAuthChecked] = useState(!authEnabled);

  useEffect(() => {
    (async () => {
      const [p, a, pl, pr, j, c] = await Promise.all([
        sget("rh_profile"), sget("rh_answers"), sget("rh_plan"),
        sget("rh_progress"), sget("rh_journal"), sget("rh_chats"),
      ]);
      if (p) setProfile(p);
      if (a) setAnswers(a);
      if (pl) setPlan(pl);
      if (pr) setProgress(pr);
      if (j) setJournal(j);
      if (c) setChats(c);
      const consent = await sget("rh_consent");
      if (consent) setConsented(true);
      if (p?.onboardingComplete) setScreen("hub");
      else if (p?.path === "full") setScreen("onboarding");
      else setScreen("welcome");
      setReady(true);
    })();
  }, []);

  const saveProfile = useCallback((p) => { setProfile(p); sset("rh_profile", p); }, []);
  const saveAnswers = useCallback((a) => { setAnswers(a); sset("rh_answers", a); }, []);
  const savePlan = useCallback((pl) => { setPlan(pl); sset("rh_plan", pl); }, []);
  const saveProgress = useCallback((pr) => { setProgress(pr); sset("rh_progress", pr); }, []);
  const saveJournal = useCallback((j) => { setJournal(j); sset("rh_journal", j); }, []);
  const saveChats = useCallback((c) => { setChats(c); sset("rh_chats", c); }, []);

  // Keep a live ref so rapid saves build on the latest history
  const chatsRef = useRef(chats);
  chatsRef.current = chats;
  const sessionRef = useRef(session);
  sessionRef.current = session;

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

  const resetAll = async () => {
    for (const k of ["rh_profile", "rh_answers", "rh_plan", "rh_progress", "rh_journal", "rh_chats"]) {
      try { localStorage.removeItem(k); } catch {}
    }
    if (authEnabled && supabase && sessionRef.current) {
      try { await supabase.from("chat_history").delete().eq("user_id", sessionRef.current.user.id); } catch {}
    }
    setProfile(null); setAnswers({}); setPlan(null); setProgress({});
    setJournal([]); setChats({}); setScreen("welcome");
  };

  // When signed in, load the guides' remembered conversations from the account.
  useEffect(() => {
    (async () => {
      if (!authEnabled || !supabase || !session) return;
      try {
        const { data } = await supabase.from("chat_history")
          .select("character,messages").eq("user_id", session.user.id);
        if (data && data.length) {
          const merged = { ...chatsRef.current };
          for (const row of data) merged[row.character] = Array.isArray(row.messages) ? row.messages : [];
          chatsRef.current = merged;
          setChats(merged);
        }
      } catch {}
    })();
  }, [session]);

  const go = (s, ch) => { if (ch) setActiveChar(ch); setScreen(s); };
  const openTool = (k) => { setToolkitInitial(k); setScreen("toolkit"); };

  useEffect(() => {
    if (!authEnabled) return;
    let sub;
    const applyAdmin = (s) => setIsAdmin(Boolean(
      s && s.user && s.user.email && normEmail(s.user.email) === normEmail(OWNER_EMAIL)
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
          setSession(s || null);
          applyAdmin(s);
        });
        sub = r.data ? r.data.subscription : null;
      } catch {}
    })();
    return () => { try { sub && sub.unsubscribe(); } catch {} };
  }, []);

  const signOut = async () => { try { await supabase.auth.signOut(); } catch {} setIsAdmin(false); setScreen("hub"); };

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(180deg, ${T.bgTop}, ${T.bgBot})`, color: T.ink,
      fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif" }}>
      <StyleTag />
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "0 16px 132px", position: "relative" }}>
        {authEnabled && !authChecked ? (
          <div style={{ paddingTop: 120, textAlign: "center", color: T.sub }}>Loading…</div>
        ) : authEnabled && !session ? (
          <Login />
        ) : !ready ? (
          <div style={{ paddingTop: 120, textAlign: "center", color: T.sub }}>Warming up…</div>
        ) : !consented ? (
          <Consent onAgree={() => { sset("rh_consent", { agreedAt: Date.now() }); setConsented(true); }} />
        ) : screen === "welcome" ? (
          <Welcome
            voiceOn={voiceOn} setVoiceOn={setVoiceOn}
            onExplore={() => { saveProfile({ name: "friend", path: "testing", onboardingComplete: true }); go("hub"); }}
            onStart={() => { saveProfile({ name: "", path: "full", onboardingComplete: false }); go("onboarding"); }}
          />
        ) : screen === "onboarding" ? (
          <Onboarding
            profile={profile} saveProfile={saveProfile}
            answers={answers} saveAnswers={saveAnswers}
            savePlan={savePlan} voiceOn={voiceOn}
            onDone={() => go("hub")}
          />
        ) : screen === "hub" ? (
          <Hub
            profile={profile} plan={plan} progress={progress} saveProgress={saveProgress}
            journalCount={journal.length} voiceOn={voiceOn} setVoiceOn={setVoiceOn}
            onOpenChat={(slug) => go("chat", slug)}
            onOpenJournal={() => go("journal")}
            onOpenToolkit={() => { setToolkitInitial(null); go("toolkit"); }}
            onOpenNotifications={() => go("notifications")}
            onReset={resetAll}
            isAdmin={isAdmin}
            authEnabled={authEnabled}
            onOpenAdmin={() => go("admin")}
            onOpenProfile={() => go("profile")}
            onSignOut={signOut}
            session={session}
          />
        ) : screen === "chat" ? (
          <Chat
            char={CHARS[activeChar]} profile={profile} answers={answers}
            history={chats[activeChar] || []}
            setHistory={(h) => saveCharChat(activeChar, h)}
            voiceOn={voiceOn} setVoiceOn={setVoiceOn}
            onBack={() => go("hub")}
            onOpenTool={openTool}
          />
        ) : screen === "journal" ? (
          <Journal
            profile={profile} journal={journal} saveJournal={saveJournal}
            voiceOn={voiceOn} onBack={() => go("hub")}
          />
        ) : screen === "toolkit" ? (
          <Toolkit voiceOn={voiceOn} initial={toolkitInitial} onBack={() => go("hub")} />
        ) : screen === "admin" ? (
          <Admin isAdmin={isAdmin} onBack={() => go("hub")} />
        ) : screen === "profile" ? (
          <Profile session={session} onBack={() => go("hub")} />
        ) : screen === "notifications" ? (
          <Notifications session={session} onBack={() => go("hub")} />
        ) : null}
      </div>
      <CrisisBar />
    </div>
  );
}

/* ---------- shared bits ---------- */
function StyleTag() {
  return (
    <style>{`
      @keyframes rh-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
      @keyframes rh-glow { 0%,100%{box-shadow:0 0 0 0 rgba(55,160,101,0)} 50%{box-shadow:0 0 0 8px rgba(55,160,101,0.10)} }
      @keyframes rh-in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
      .rh-in{animation:rh-in .4s ease both}
      *{box-sizing:border-box}
      button{font-family:inherit}
      @media (prefers-reduced-motion: reduce){ .rh-float,.rh-in{animation:none!important} }
    `}</style>
  );
}

function Brand({ right }) {
  return (
    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 2px 8px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: 12, background: T.green, color: "#fff",
          display: "grid", placeItems: "center", fontWeight: 800, boxShadow: T.soft }}>RH</div>
        <div style={{ lineHeight: 1.1 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>The Resilience Hub</div>
          <div style={{ fontSize: 11, color: T.sub }}>You never have to walk it alone</div>
        </div>
      </div>
      {right}
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
    primary: { background: T.green, color: "#fff", boxShadow: T.soft },
    ghost: { background: "transparent", color: T.sub, height: 44, fontWeight: 500 },
    outline: { background: T.card, color: T.ink, boxShadow: T.soft },
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
    <p style={{ fontSize: 11, color: T.sub, textAlign: "center", marginTop: 18, lineHeight: 1.5 }}>
      The Resilience Hub is a support tool — it doesn't replace a doctor, psychologist, or emergency service.
      Use it alongside advice from qualified professionals.
    </p>
  );
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

function useVoice(voiceOn) {
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef(null);
  const reqRef = useRef(0);

  const stop = useCallback(() => {
    __synthEpoch++;
    try { if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel(); } catch {}
    try {
      if (audioRef.current) {
        const a = audioRef.current;
        a.onplay = null; a.onended = null; a.onerror = null; // no queued event can fire after this
        a.pause(); a.src = "";
      }
      audioRef.current = null;
    } catch {}
    setSpeaking(false);
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
        u.pitch = char?.voice?.pitch ?? 1; u.rate = char?.voice?.rate ?? 1; u.lang = "en-AU";
        u.onstart = () => { if (myEpoch === __synthEpoch) setSpeaking(true); };
        u.onend = () => { if (myEpoch === __synthEpoch) { setSpeaking(false); if (onDone) onDone(); } };
        window.speechSynthesis.speak(u);
      } catch { if (myEpoch === __synthEpoch && onDone) onDone(); }
    }, 80);
  }, []);

  const speak = useCallback(async (text, char, onDone) => {
    if (!voiceOn || !text) { if (onDone) onDone(); return; }
    stop();
    const myReq = ++reqRef.current;
    const stale = () => myReq !== reqRef.current;

    // Prefer natural voices when the guide has a voiceId; fall back to the
    // browser voice if the key isn't set, the call fails, or playback is blocked.
    if (char && char.voiceId) {
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voiceId: char.voiceId }),
        });
        if (stale()) return;      // a newer speak() superseded this
        if (res.ok) {
          const blob = await res.blob();
          if (stale()) return;
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.onplay = () => { try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch {} setSpeaking(true); };
          audio.onended = () => { if (stale()) return; setSpeaking(false); try { URL.revokeObjectURL(url); } catch {} if (onDone) onDone(); };
          audio.onerror = () => { setSpeaking(false); if (!stale()) browserSpeak(text, char, onDone); };
          try { await audio.play(); return; }
          catch { if (!stale()) browserSpeak(text, char, onDone); return; }
        }
      } catch { /* fall through to browser voice */ }
      if (stale()) return;
    }
    browserSpeak(text, char, onDone);
  }, [voiceOn, stop, browserSpeak]);

  return { speak, stop, speaking };
}

function HoldToTalk({ onText, onStart, size = 52 }) {
  const [listening, setListening] = useState(false);
  const [err, setErr] = useState(null);
  const recRef = useRef(null);
  const committedRef = useRef("");   // finalized speech accumulated across this hold
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
    r.lang = "en-AU"; r.interimResults = false; r.continuous = false;
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res && res.isFinal) {
          const seg = res[0] ? res[0].transcript.trim() : "";
          if (seg) committedRef.current = (committedRef.current + " " + seg).trim();
        }
      }
    };
    r.onerror = (e) => {
      if (e && (e.error === "not-allowed" || e.error === "service-not-allowed")) {
        setErr("Mic access is blocked — check your browser/site permissions.");
        heldRef.current = false;
      }
    };
    r.onend = () => {
      recRef.current = null;
      if (heldRef.current) { runSession(); return; } // still held — keep listening seamlessly
      setListening(false);
      const t = committedRef.current.trim();
      if (t) onText(t);
    };
    try { recRef.current = r; r.start(); setListening(true); }
    catch { /* a restart can occasionally race with the previous stop; the next onend recovers it */ }
  };

  const start = () => {
    if (!supported) { setErr("Voice input isn't supported here — please type."); return; }
    if (onStart) onStart();
    setErr(null); committedRef.current = ""; heldRef.current = true;
    runSession();
  };
  const stop = () => {
    heldRef.current = false;
    try { recRef.current && recRef.current.stop(); } catch {}
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <button
        onPointerDown={start} onPointerUp={stop} onPointerLeave={() => listening && stop()}
        aria-label="Hold to talk"
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
function BackBtn({ onBack, label = "Back" }) {
  return (
    <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, background: "none",
      border: "none", color: T.sub, cursor: "pointer", fontSize: 14 }}>
      <ArrowLeft size={16} /> {label}
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

function Toolkit({ voiceOn, initial, onBack }) {
  const [tool, setTool] = useState(initial || null);
  if (tool === "breathing") return <BreathingTool onBack={() => setTool(null)} />;
  if (tool === "grounding") return <GroundingTool onBack={() => setTool(null)} />;
  if (tool === "meditation") return <MeditationTool onBack={() => setTool(null)} />;
  if (tool === "affirmations") return <AffirmationsTool voiceOn={voiceOn} onBack={() => setTool(null)} />;
  if (tool === "calm") return <QuickCalm onBack={() => setTool(null)} />;
  return (
    <>
      <Brand right={<BackBtn onBack={onBack} label="Hub" />} />
      <SectionTitle>Toolkit</SectionTitle>
      <p style={{ fontSize: 13.5, color: T.sub, margin: "0 2px 14px", lineHeight: 1.5 }}>
        A few things that can help when anxiety shows up. There's no right way — try whatever feels doable.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {TOOLS.map((t) => (
          <button key={t.key} onClick={() => setTool(t.key)} style={{ width: "100%", display: "flex", alignItems: "center",
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
        ))}
      </div>
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
function Login() {
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
        provider: "google", options: { redirectTo: window.location.origin },
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

function Admin({ isAdmin, onBack }) {
  const [view, setView] = useState(null);       // null | "members"
  const [member, setMember] = useState(null);   // a selected member row
  if (!isAdmin) {
    return (
      <>
        <Brand right={<BackBtn onBack={onBack} label="Hub" />} />
        <div className="rh-in" style={{ background: T.card, borderRadius: 20, padding: 20, boxShadow: T.soft, marginTop: 20 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Admins only</div>
          <p style={{ fontSize: 14, color: T.sub, lineHeight: 1.5 }}>This area is limited to administrators.</p>
        </div>
      </>
    );
  }
  if (member) return <MemberDetail member={member} onBack={() => setMember(null)} />;
  if (view === "members") return <MembersDirectory onOpen={(m) => setMember(m)} onBack={() => setView(null)} />;
  return (
    <>
      <Brand right={<BackBtn onBack={onBack} label="Hub" />} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
        <Shield size={18} color={T.green} />
        <h2 style={{ fontSize: 18, margin: 0 }}>Admin</h2>
      </div>

      <SectionTitle>Members</SectionTitle>
      <button onClick={() => setView("members")} style={{ width: "100%", background: T.card, borderRadius: 20, padding: 16,
        boxShadow: T.soft, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: "#e9f5ee", display: "grid", placeItems: "center" }}>
          <User size={20} color={T.greenDk} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700 }}>Members</div>
          <div style={{ fontSize: 13, color: T.sub }}>See everyone, open a profile, add private notes</div>
        </div>
        <ChevronRight size={20} color={T.sub} />
      </button>

      <AdminSafetyPanel />
      <AdminWelcomeEditor />

      <SectionTitle>Notify members</SectionTitle>
      <AdminNotify />

      <SectionTitle>Claude admin assistant</SectionTitle>
      <p style={{ fontSize: 13, color: T.sub, margin: "0 2px 10px", lineHeight: 1.5 }}>
        Ask for help drafting content, rewording a guide's tone, or working out a fix. It gives you drafts and
        suggestions — it never edits the live app or safety wording on its own. You review and apply.
      </p>
      <AdminAssistant />
      <Disclaimer />
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

function Profile({ session, onBack }) {
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
      <Brand right={<BackBtn onBack={onBack} label="Hub" />} />
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
      <Brand right={<BackBtn onBack={onBack} label="Hub" />} />
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
      <div className="rh-in" style={{ width: "100%", maxWidth: 380, background: T.card, borderRadius: 24,
        boxShadow: T.lift, position: "relative", padding: "22px 20px 20px" }}>
        <button onClick={markAllReadAndClose} aria-label="Close"
          style={{ position: "absolute", top: 14, right: 14, width: 40, height: 40, borderRadius: "50%",
            border: "none", background: "#f3eef7", color: T.ink, cursor: "pointer",
            display: "grid", placeItems: "center" }}>
          <X size={20} />
        </button>
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
        {n.body ? <p style={{ fontSize: 14.5, lineHeight: 1.5, margin: "10px 0 0", whiteSpace: "pre-wrap" }}>{n.body}</p> : null}
        <div style={{ marginTop: 20 }}>
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
      setTitle(""); setBody(""); setStatus("Sent to all registered members."); load();
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
        This is an in-app notification (seen when someone opens the Hub) — not a push alert to their phone/browser
        when the app is closed. True push notifications are a bigger, separate build (a service worker + permission
        prompt) — ask if you'd like that next.
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
            secure AI service so they can reply. When you're signed in, the guides remember your past
            conversations so you don't have to start over each time — you can clear this any time with "Start over."
            Your journal, plan, and progress are saved on your device.
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
        <Disclaimer />
      </div>
    </>
  );
}

/* ---------- welcome (Rex) ---------- */
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
          <Btn kind="ghost" onClick={() => { stop(); onExplore(); }}>Just testing / having a look</Btn>
        </div>
        <Disclaimer />
      </div>
    </>
  );
}

function VoiceToggle({ on, set }) {
  return (
    <button onClick={() => set(!on)} aria-label={on ? "Voice on" : "Voice off"}
      style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 999, width: 38, height: 38,
        display: "grid", placeItems: "center", cursor: "pointer", color: T.ink, boxShadow: T.soft }}>
      {on ? <Volume2 size={18} /> : <VolumeX size={18} />}
    </button>
  );
}

/* ---------- onboarding (Juan guides) ---------- */
const QUESTIONS = [
  { key: "name", type: "name", q: "First up — what should we call you?" },
  { key: "mood", type: "single", q: "How have the last couple of weeks felt, overall?",
    opts: ["Pretty good", "Up and down", "Heavy going", "Really rough"] },
  { key: "sleep", type: "single", q: "How's your sleep been?",
    opts: ["Fine", "A bit patchy", "Not great", "Barely sleeping"] },
  { key: "weighing", type: "text", q: "What's weighing on you most right now? As much or as little as you like.",
    placeholder: "You can hold the mic to talk, or type…" },
  { key: "areas", type: "multi", q: "Which of these are tough at the moment? Pick any that fit.",
    opts: ["Money", "Housing", "Work / no work", "Relationships", "Family", "Health", "Feeling alone", "Alcohol or other stuff"] },
  { key: "support", type: "single", q: "Who've you got in your corner?",
    opts: ["A few solid people", "One or two", "Not really anyone", "Rather not say"] },
  { key: "strength", type: "text", q: "What's one thing that's helped you get through hard times before?",
    placeholder: "Even a small thing counts…" },
  { key: "help", type: "multi", q: "What would actually help right now?",
    opts: ["Someone to talk to", "A plan and next steps", "Practical help (bills, housing)", "Ways to calm down", "Just to be heard"] },
  { key: "safety", type: "safety", q: "One last gentle one — how safe do you feel in yourself right now?",
    opts: ["I'm okay", "Struggling but safe", "I'm not sure", "I've had thoughts of hurting myself"] },
];

function Onboarding({ profile, saveProfile, answers, saveAnswers, savePlan, voiceOn, onDone }) {
  const [i, setI] = useState(0);
  const [local, setLocal] = useState(answers || {});
  const [text, setText] = useState("");
  const [name, setName] = useState(profile?.name || "");
  const [safetyPanel, setSafetyPanel] = useState(false);
  const [building, setBuilding] = useState(false);
  const { speak, stop, speaking } = useVoice(voiceOn);
  const q = QUESTIONS[i];

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

  const advance = () => { stop(); if (i < QUESTIONS.length - 1) setI(i + 1); else finish(); };

  const finish = async () => {
    setBuilding(true);
    let plan = null;
    try {
      const sys = `${CHARS.carlos.system}\nYou are creating a gentle, personalised 8-week resilience plan from the person's setup answers. Respond with ONLY valid JSON, no markdown, in this exact shape:
{"summary": "2 warm sentences to the person about their plan", "weeks":[{"n":1,"focus":"short focus title","steps":["small step","small step"]}, ... 8 weeks]}`;
      const out = await callModel({
        system: sys, maxTokens: 1200,
        messages: [{ role: "user", content: `Their name: ${name || "friend"}. Their answers: ${JSON.stringify(local)}. Build the 8-week plan.` }],
      });
      const clean = out.split("```json").join("").split("```").join("").trim();
      plan = JSON.parse(clean);
    } catch {
      plan = fallbackPlan(name);
    }
    savePlan(plan);
    saveProfile({ ...profile, name: name.trim() || "friend", onboardingComplete: true });
    setBuilding(false);
    onDone();
  };

  if (building) {
    return (
      <>
        <Brand />
        <div style={{ paddingTop: 8, textAlign: "center" }}>
          <Portrait src={IMG.carlos} name="Carlos" size={190} speaking tint={CHARS.carlos.tint} />
          <Bubble>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, marginBottom: 4 }}>
              <Sparkles size={18} color={T.green} /> Carlos here.
            </div>
            Thanks for sharing all that. I'm putting together a plan shaped just for you — give me a moment.
          </Bubble>
        </div>
      </>
    );
  }

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
      <Brand right={<span style={{ fontSize: 12, color: T.sub }}>{i + 1} / {QUESTIONS.length}</span>} />
      <div style={{ height: 6, borderRadius: 999, background: "#eaddf0", overflow: "hidden", margin: "4px 2px 4px" }}>
        <div style={{ height: "100%", width: `${((i + 1) / QUESTIONS.length) * 100}%`, background: T.green, transition: "width .4s" }} />
      </div>
      <Portrait src={IMG.juan} name="Juan" size={168} speaking={speaking} tint={CHARS.juan.tint} />
      <Bubble>{q.q}</Bubble>

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
          <p style={{ fontSize: 11, color: T.sub, textAlign: "center", marginTop: 8 }}>Hold the mic to talk · release to add it in</p>
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

function fallbackPlan(name) {
  const weeks = [
    { n: 1, focus: "Landing gently", steps: ["Notice one good moment each day", "Say hi to Juan when you can"] },
    { n: 2, focus: "Steady footing", steps: ["Pick one small daily anchor (a walk, a cuppa)", "Jot one line in your journal"] },
    { n: 3, focus: "One thing at a time", steps: ["Name the single biggest stressor", "Break it into one tiny next step"] },
    { n: 4, focus: "Reaching out", steps: ["Message one person you trust", "Try a 2-minute breathing pause"] },
    { n: 5, focus: "Practical ground", steps: ["Tackle one admin task with Mick", "Celebrate finishing it"] },
    { n: 6, focus: "Kinder self-talk", steps: ["Catch one harsh thought", "Swap it for what you'd tell a mate"] },
    { n: 7, focus: "Connection", steps: ["Have one honest chat with Lila's help", "Set one small boundary"] },
    { n: 8, focus: "Looking back, looking forward", steps: ["List three things you got through", "Pick what to keep doing"] },
  ];
  return { summary: `Here's a gentle 8-week plan, ${name || "friend"} — small steps, at your pace. Nothing's set in stone; we adjust as we go.`, weeks };
}

/* ---------- hub / dashboard ---------- */
function Hub({ profile, plan, progress, saveProgress, journalCount, voiceOn, setVoiceOn, onOpenChat, onOpenJournal, onOpenToolkit, onOpenNotifications, onReset, isAdmin, authEnabled, onOpenAdmin, onOpenProfile, onSignOut, session }) {
  const { speak, stop, speaking } = useVoice(voiceOn);
  const [notifRefresh, setNotifRefresh] = useState(0);
  const unreadCount = useUnreadNotifications(authEnabled ? session : null, notifRefresh);
  const weeks = plan?.weeks || [];
  const doneCount = weeks.reduce((a, w) => a + (w.steps || []).filter((_, si) => progress[`w${w.n}s${si}`]).length, 0);
  const totalSteps = weeks.reduce((a, w) => a + (w.steps || []).length, 0);
  const currentWeek = Math.min(
    weeks.length || 1,
    1 + weeks.filter((w) => (w.steps || []).every((_, si) => progress[`w${w.n}s${si}`])).length
  );
  const [wk, setWk] = useState(currentWeek);
  const week = weeks.find((w) => w.n === wk);

  const nm = profile?.name && profile.name !== "friend" ? profile.name : "";
  const greetSuffix = nm ? ", " + nm : "";
  const greet = profile?.onboardingComplete && profile?.path !== "testing"
    ? `Welcome back, ${profile?.name || "friend"} — Juan here, your main mate on this. Carlos is beside me for anything clinical, and Mick and Lila are on standby for housing or relationship stuff. Who do you want to talk to?`
    : `Good to have you here${greetSuffix}. Have a look around — chat to any of us, or start a journal entry whenever you like.`;

  useEffect(() => () => stop(), [stop]);
  const toggleStep = (n, si) => { const key = `w${n}s${si}`; saveProgress({ ...progress, [key]: !progress[key] }); };

  return (
    <>
      {authEnabled && session && (
        <NotificationPopup session={session} onClosed={() => setNotifRefresh((k) => k + 1)} />
      )}
      <Brand right={
        <div style={{ display: "flex", gap: 8 }}>
          <VoiceToggle on={voiceOn} set={setVoiceOn} />
          {authEnabled && (
            <button onClick={onOpenProfile} aria-label="Your profile" title="Your profile"
              style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 999, width: 38, height: 38,
                display: "grid", placeItems: "center", cursor: "pointer", color: T.sub, boxShadow: T.soft }}>
              <User size={17} />
            </button>
          )}
          {isAdmin && (
            <button onClick={onOpenAdmin} aria-label="Admin" title="Admin"
              style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 999, width: 38, height: 38,
                display: "grid", placeItems: "center", cursor: "pointer", color: T.green, boxShadow: T.soft }}>
              <Shield size={17} />
            </button>
          )}
          <button onClick={onReset} aria-label="Start over" title="Start over"
            style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 999, width: 38, height: 38,
              display: "grid", placeItems: "center", cursor: "pointer", color: T.sub, boxShadow: T.soft }}>
            <RotateCcw size={16} />
          </button>
          {authEnabled && (
            <button onClick={onSignOut} aria-label="Sign out" title="Sign out"
              style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 999, width: 38, height: 38,
                display: "grid", placeItems: "center", cursor: "pointer", color: T.sub, boxShadow: T.soft }}>
              <LogOut size={17} />
            </button>
          )}
        </div>
      } />

      <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 6 }}>
        <div style={{ flexShrink: 0 }}>
          <Portrait src={IMG.juan} name="Juan" size={110} speaking={speaking} tint={CHARS.juan.tint} />
        </div>
        <div style={{ background: T.card, borderRadius: 20, padding: "14px 16px", boxShadow: T.soft, fontSize: 14.5, lineHeight: 1.45 }}>
          {greet}
          <button onClick={() => speak(greet, CHARS.juan)} style={{ marginTop: 8, display: "inline-flex", alignItems: "center",
            gap: 6, background: "none", border: "none", color: T.green, fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
            <Volume2 size={15} /> Hear it
          </button>
        </div>
      </div>

      {/* progress */}
      <SectionTitle>Your progress</SectionTitle>
      <div style={{ background: T.card, borderRadius: 20, padding: 16, boxShadow: T.soft }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, color: T.sub, marginBottom: 8 }}>
          <span>{totalSteps ? `${doneCount} of ${totalSteps} steps done` : "Plan ready"}</span>
          <span>Week {currentWeek} of {weeks.length || 8}</span>
        </div>
        <div style={{ height: 8, borderRadius: 999, background: "#eee2f0", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${totalSteps ? (doneCount / totalSteps) * 100 : 0}%`, background: T.green, transition: "width .4s" }} />
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 14, fontSize: 13 }}>
          <Stat label="Journal entries" value={journalCount} />
          <Stat label="Next check-in" value="This week" />
          <Stat label="Setup" value={profile?.onboardingComplete ? "Done" : "—"} />
        </div>
      </div>

      {/* plan */}
      {plan && (
        <>
          <SectionTitle>Your 8-week plan</SectionTitle>
          {plan.summary && <p style={{ fontSize: 13.5, color: T.sub, margin: "0 2px 12px", lineHeight: 1.5 }}>{plan.summary}</p>}
          <div style={{ background: T.card, borderRadius: 20, padding: 16, boxShadow: T.soft }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <button onClick={() => setWk(Math.max(1, wk - 1))} disabled={wk <= 1}
                style={navBtn(wk <= 1)}><ChevronLeft size={18} /></button>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 12, color: T.sub }}>Week {week?.n}</div>
                <div style={{ fontWeight: 700 }}>{week?.focus}</div>
              </div>
              <button onClick={() => setWk(Math.min(weeks.length, wk + 1))} disabled={wk >= weeks.length}
                style={navBtn(wk >= weeks.length)}><ChevronRight size={18} /></button>
            </div>
            {(week?.steps || []).map((s, si) => {
              const on = progress[`w${week.n}s${si}`];
              return (
                <button key={si} onClick={() => toggleStep(week.n, si)} style={{ display: "flex", gap: 10, alignItems: "flex-start",
                  width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: "9px 0",
                  fontSize: 14.5, color: on ? T.sub : T.ink }}>
                  {on ? <CheckCircle2 size={20} color={T.green} style={{ flexShrink: 0, marginTop: 1 }} />
                    : <Circle size={20} color="#cfc6da" style={{ flexShrink: 0, marginTop: 1 }} />}
                  <span style={{ textDecoration: on ? "line-through" : "none" }}>{s}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* journal */}
      <SectionTitle>Journal</SectionTitle>
      <button onClick={onOpenJournal} style={{ width: "100%", background: T.card, borderRadius: 20, padding: 16,
        boxShadow: T.soft, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: "#f3ecd6", display: "grid", placeItems: "center" }}>
          <BookOpen size={20} color="#c9a227" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700 }}>Voice-first journal</div>
          <div style={{ fontSize: 13, color: T.sub }}>Speak your thoughts — {journalCount} {journalCount === 1 ? "entry" : "entries"} so far</div>
        </div>
        <ChevronRight size={20} color={T.sub} />
      </button>

      {/* toolkit */}
      <SectionTitle>Toolkit</SectionTitle>
      <button onClick={onOpenToolkit} style={{ width: "100%", background: T.card, borderRadius: 20, padding: 16,
        boxShadow: T.soft, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: "#dceee2", display: "grid", placeItems: "center" }}>
          <Wrench size={20} color="#2c7d50" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700 }}>Calm & grounding toolkit</div>
          <div style={{ fontSize: 13, color: T.sub }}>Breathing, grounding, and words for anxious moments</div>
        </div>
        <ChevronRight size={20} color={T.sub} />
      </button>

      {/* guides */}
      <SectionTitle>Your guides</SectionTitle>
      <GuideRow char={CHARS.rex} onClick={() => onOpenChat("rex")} big />
      <GuideRow char={CHARS.juan} onClick={() => onOpenChat("juan")} big />
      <GuideRow char={CHARS.carlos} onClick={() => onOpenChat("carlos")} big />
      <div style={{ fontSize: 12, color: T.sub, textTransform: "uppercase", letterSpacing: 0.5, margin: "14px 2px 8px" }}>
        Specialist support — here when you need it
      </div>
      <GuideRow char={CHARS.mick} onClick={() => onOpenChat("mick")} />
      <GuideRow char={CHARS.lila} onClick={() => onOpenChat("lila")} />

      <SectionTitle>Notifications</SectionTitle>
      <button onClick={onOpenNotifications} style={{ width: "100%", background: T.card, borderRadius: 20, padding: 16,
        boxShadow: T.soft, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: "#eee7f6", display: "grid", placeItems: "center", position: "relative" }}>
          <Megaphone size={20} color="#7c5cc4" />
          {unreadCount > 0 && (
            <span style={{ position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 999,
              background: "#e5484d", color: "#fff", fontSize: 11, fontWeight: 700, display: "grid", placeItems: "center",
              padding: "0 4px" }}>{unreadCount}</span>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700 }}>Notifications</div>
          <div style={{ fontSize: 13, color: T.sub }}>{unreadCount > 0 ? `${unreadCount} new message${unreadCount === 1 ? "" : "s"}` : "Messages from the team"}</div>
        </div>
        <ChevronRight size={20} color={T.sub} />
      </button>

      <Disclaimer />
    </>
  );
}

const navBtn = (dis) => ({ width: 36, height: 36, borderRadius: 12, border: `1px solid ${T.line}`, background: "#fff",
  display: "grid", placeItems: "center", cursor: dis ? "default" : "pointer", opacity: dis ? 0.4 : 1, color: T.ink });

function Stat({ label, value }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontWeight: 700, fontSize: 16 }}>{value}</div>
      <div style={{ color: T.sub, fontSize: 11.5 }}>{label}</div>
    </div>
  );
}

function SectionTitle({ children }) {
  return <h2 style={{ fontSize: 15, fontWeight: 700, margin: "22px 2px 10px" }}>{children}</h2>;
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
function Chat({ char, profile, answers, history, setHistory, voiceOn, setVoiceOn, onBack, onOpenTool }) {
  const { speak, stop, speaking } = useVoice(voiceOn);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const scrollRef = useRef(null);
  const spoken = useRef(new Set());
  const [pendingImage, setPendingImage] = useState(null); // { dataUrl, mediaType }
  const imgFileRef = useRef(null);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const VISIBLE_TAIL = 14; // keep the on-screen chat short; full history still saves + still informs the guide
  const hiddenCount = Math.max(0, history.length - VISIBLE_TAIL);
  const visibleHistory = showAllHistory ? history : history.slice(-VISIBLE_TAIL);

  const pickPhoto = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (!f.type || !f.type.startsWith("image/")) { setErr("Only photos are supported right now — not video or other files."); return; }
    setErr(null);
    resizeImage(f, 1280, (dataUrl) => setPendingImage({ dataUrl, mediaType: "image/jpeg" }));
    e.target.value = "";
  };

  // Hands-free voice conversation — works while the app is open on screen.
  const [handsFree, setHandsFree] = useState(false);
  const [hfListening, setHfListening] = useState(false);
  const hfRef = useRef(false); hfRef.current = handsFree;
  const hfRecRef = useRef(null);
  const hfEmpty = useRef(0);
  const sendRef = useRef(null);
  const sttSupported = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

  const stopHF = useCallback(() => {
    try { hfRecRef.current && hfRecRef.current.stop(); } catch {}
    hfRecRef.current = null; setHfListening(false);
  }, []);

  const hfListen = useCallback(() => {
    if (!hfRef.current) return;
    if (hfRecRef.current) { try { hfRecRef.current.stop(); } catch {} hfRecRef.current = null; } // never run two at once
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setHandsFree(false); hfRef.current = false; return; }
    try {
      const r = new SR(); r.lang = "en-AU"; r.interimResults = false; r.continuous = false;
      let finalText = ""; let done = false;
      r.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          if (res && res.isFinal) {
            const seg = res[0] ? res[0].transcript.trim() : "";
            if (seg) finalText = (finalText + " " + seg).trim();
          }
        }
      };
      r.onerror = () => {};
      r.onend = () => {
        setHfListening(false);
        if (done) return; done = true;
        hfRecRef.current = null;
        if (!hfRef.current) return;
        const t = finalText.trim();
        if (t) { hfEmpty.current = 0; if (sendRef.current) sendRef.current(t); }
        else {
          hfEmpty.current += 1;
          if (hfEmpty.current >= 3) { setHandsFree(false); hfRef.current = false; } // stop after a stretch of silence
          else setTimeout(() => { if (hfRef.current) hfListen(); }, 500);
        }
      };
      hfRecRef.current = r; r.start(); setHfListening(true);
    } catch { setTimeout(() => { if (hfRef.current) hfListen(); }, 800); }
  }, []);

  // Barge-in: while a guide is speaking in hands-free mode, listen lightly for
  // the person starting to talk over them, and if so, cut the guide off and
  // switch straight to listening. Works best with headphones (otherwise the
  // mic can occasionally pick up the guide's own voice on speaker devices).
  const bargeRecRef = useRef(null);
  const bargeArmTimer = useRef(null);
  const startBargeWatch = useCallback(() => {
    if (!hfRef.current) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    try {
      const r = new SR(); r.lang = "en-AU"; r.interimResults = true; r.continuous = false;
      let triggered = false;
      r.onresult = (e) => {
        if (triggered) return;
        const res = e.results && e.results[e.results.length - 1];
        const seg = res && res[0] ? res[0].transcript.trim() : "";
        // Require a couple of real words, not a stray syllable or bled-through
        // audio, so a moment of overlap can't be mistaken for someone talking.
        if (seg.split(/\s+/).filter(Boolean).length >= 2 && seg.length >= 6) {
          triggered = true;
          try { r.stop(); } catch {}
          stop();            // stop the guide's voice immediately
          hfListen();         // go straight to full listening for what they're saying
        }
      };
      r.onerror = () => {};
      r.onend = () => { bargeRecRef.current = null; };
      bargeRecRef.current = r; r.start();
    } catch {}
  }, [stop, hfListen]);
  const stopBargeWatch = useCallback(() => {
    if (bargeArmTimer.current) { clearTimeout(bargeArmTimer.current); bargeArmTimer.current = null; }
    try { bargeRecRef.current && bargeRecRef.current.stop(); } catch {}
    bargeRecRef.current = null;
  }, []);

  useEffect(() => {
    if (handsFree && speaking) {
      // Give playback a moment to settle before listening for an interruption,
      // so the very start of a reply (the highest-risk moment for any brief
      // audio overlap) can't itself be mistaken for the person talking.
      bargeArmTimer.current = setTimeout(() => { if (hfRef.current) startBargeWatch(); }, 900);
    } else {
      stopBargeWatch();
    }
    return stopBargeWatch;
  }, [handsFree, speaking, startBargeWatch, stopBargeWatch]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: 1e6, behavior: "smooth" }); }, [history, busy, showAllHistory]);
  useEffect(() => () => { stop(); stopHF(); }, [stop, stopHF]);

  const send = async (raw) => {
    const text = (raw ?? input).trim();
    const img = pendingImage;
    if ((!text && !img) || busy) return;
    stop(); // interrupt: a new message from the person always cuts the guide off
    setErr(null); setInput(""); setPendingImage(null);
    const userMsg = { role: "user", content: text || "(sent a photo)", ts: Date.now() };
    if (img) { userMsg.image = img.dataUrl; userMsg.mediaType = img.mediaType; }
    const newHist = [...history, userMsg];
    setHistory(newHist);
    setBusy(true);
    try {
      const system = char.system + contextBlock(profile, answers);
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
      const reply = await callModel({ system, messages: msgs });
      const tagRe = /<tool>\s*(breathing|grounding|meditation|affirmations|calm)\s*<\/tool>/i;
      const found = reply.match(tagRe);
      const tool = found ? found[1].toLowerCase() : null;
      const clean = reply.replace(/<tool>\s*(breathing|grounding|meditation|affirmations|calm)\s*<\/tool>/gi, "").trim();
      const withReply = [...newHist, { role: "assistant", content: clean, tool, ts: Date.now() }];
      setHistory(withReply);
      if (voiceOn) { spoken.current.add(withReply.length - 1); speak(clean, char, hfRef.current ? hfListen : undefined); }
      else if (hfRef.current) { setTimeout(() => hfListen(), 300); }
    } catch (e) {
      setErr(e.message || "Something went wrong.");
    } finally { setBusy(false); }
  };
  sendRef.current = send;

  const toggleHandsFree = () => {
    if (!sttSupported) { setErr("Hands-free needs voice input — try Chrome on Android or desktop."); return; }
    const next = !handsFree;
    setHandsFree(next); hfRef.current = next; hfEmpty.current = 0;
    if (next) { setErr(null); if (!busy && !speaking) hfListen(); }
    else { stopHF(); stop(); }
  };

  const starters = char.slug === "rex"
    ? ["What is this place?", "Who should I talk to?", "I'm new here"]
    : char.slug === "juan"
    ? ["I'm not sure where to start", "Tell me about my plan", "I'm having a rough day"]
    : char.slug === "carlos" ? ["How do I calm a racing mind?", "Explain my plan", "I feel overwhelmed"]
    : char.slug === "mick" ? ["I'm behind on a bill", "Help with housing", "Centrelink is confusing"]
    : ["A family thing is stressing me", "How do I set a boundary?", "I had an argument"];

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Brand right={
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none",
          color: T.sub, cursor: "pointer", fontSize: 14 }}><ArrowLeft size={16} /> Hub</button>
      } />

      <div style={{ display: "flex", alignItems: "center", gap: 12, background: T.card, borderRadius: 18, padding: 10,
        boxShadow: T.soft, marginTop: 4 }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, overflow: "hidden",
          background: `radial-gradient(120% 100% at 50% 20%, #fff, ${char.tint})`,
          boxShadow: speaking ? `0 0 0 3px rgba(55,160,101,0.3)` : "none" }}>
          <img src={char.img} alt={char.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700 }}>{char.name}</div>
          <div style={{ fontSize: 12.5, color: T.sub }}>{char.role}</div>
        </div>
        <VoiceToggle on={voiceOn} set={setVoiceOn} />
        {sttSupported && (
          <button onClick={toggleHandsFree} aria-label={handsFree ? "Turn off hands-free" : "Turn on hands-free"}
            title={handsFree ? "Hands-free on" : "Hands-free"}
            style={{ background: handsFree ? T.green : "#fff", border: `1px solid ${handsFree ? T.green : T.line}`,
              borderRadius: 999, width: 38, height: 38, display: "grid", placeItems: "center", cursor: "pointer",
              color: handsFree ? "#fff" : T.ink, boxShadow: T.soft,
              animation: (handsFree && (hfListening || speaking)) ? "rh-glow 1.2s ease-in-out infinite" : "none" }}>
            <Radio size={17} />
          </button>
        )}
      </div>

      {handsFree && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 8,
          fontSize: 12.5, color: T.greenDk, fontWeight: 600 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: T.green,
            animation: "rh-glow 1.2s ease-in-out infinite" }} />
          Hands-free on — {speaking ? `${char.name} is talking, just start speaking to jump in` : hfListening ? "listening…" : "getting ready…"}
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
              <div style={{ maxWidth: "82%", padding: "11px 14px", borderRadius: 18, fontSize: 15, lineHeight: 1.45,
                whiteSpace: "pre-wrap", background: m.role === "user" ? T.green : "#fff",
                color: m.role === "user" ? "#fff" : T.ink, boxShadow: T.soft }}>{m.content}</div>
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
        <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={1}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={pendingImage ? "Say something about the photo (optional)…" : `Message ${char.name}…`}
          style={{ flex: 1, resize: "none", borderRadius: 16, border: `1px solid ${T.line}`, padding: "12px 14px",
            fontSize: 15, maxHeight: 120, background: "#fff", color: T.ink, outline: "none", fontFamily: "inherit" }} />
        <button onClick={() => send()} disabled={(!input.trim() && !pendingImage) || busy} aria-label="Send"
          style={{ width: 48, height: 48, borderRadius: "50%", border: "none", background: T.green, color: "#fff",
            display: "grid", placeItems: "center", cursor: (input.trim() || pendingImage) ? "pointer" : "default",
            opacity: (input.trim() || pendingImage) ? 1 : 0.5, boxShadow: T.soft }}>
          <Send size={18} />
        </button>
      </div>
      <p style={{ fontSize: 10.5, color: T.sub, textAlign: "center", marginTop: 4 }}>Photos only for now — the guides can't watch video yet.</p>
      {speaking && <button onClick={stop} style={{ background: "none", border: "none", color: T.sub, fontSize: 12,
        cursor: "pointer", margin: "8px auto 0", display: "block" }}>Stop {char.name}'s voice</button>}
      <p style={{ fontSize: 11, color: T.sub, textAlign: "center", marginTop: 8 }}>Hold the mic to talk · You never have to walk it alone.</p>
    </div>
  );
}

/* ---------- journal ---------- */
function Journal({ profile, journal, saveJournal, voiceOn, onBack }) {
  const { speak, stop, speaking } = useVoice(voiceOn);
  const [text, setText] = useState("");
  const [reflecting, setReflecting] = useState(false);
  const [prompt, setPrompt] = useState("What's on your mind today? There's no right way to do this — just start.");

  useEffect(() => { speak(prompt, CHARS.lila); return () => stop(); /* eslint-disable-next-line */ }, []);

  const save = () => {
    const t = text.trim(); if (!t) return;
    const entry = { id: Date.now(), ts: Date.now(), text: t };
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
      setPrompt(out); if (voiceOn) speak(out, CHARS.lila);
    } catch { setPrompt("However you said it, thanks for putting it into words. What feels most true about it right now?"); }
    finally { setReflecting(false); }
  };

  return (
    <>
      <Brand right={
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none",
          color: T.sub, cursor: "pointer", fontSize: 14 }}><ArrowLeft size={16} /> Hub</button>
      } />
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 4 }}>
        <div style={{ width: 84, flexShrink: 0 }}>
          <Portrait src={IMG.lila} name="Lila" size={84} speaking={speaking} tint={CHARS.lila.tint} />
        </div>
        <div style={{ background: T.card, borderRadius: 18, padding: "13px 15px", boxShadow: T.soft, fontSize: 14.5, lineHeight: 1.45 }}>
          {reflecting ? "Reading that back…" : prompt}
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder="Hold the mic to speak, or type here…"
          style={{ ...inputStyle, resize: "none", minHeight: 150 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
          <HoldToTalk onText={(t) => setText((p) => (p ? p + " " : "") + t)} />
          <div style={{ flex: 1, display: "flex", gap: 8 }}>
            <Btn kind="outline" onClick={unpack} disabled={!text.trim() || reflecting} style={{ flex: 1 }}>Help me unpack</Btn>
            <Btn onClick={save} disabled={!text.trim()} style={{ flex: 1 }}>Save entry</Btn>
          </div>
        </div>
      </div>

      {journal.length > 0 && (
        <>
          <SectionTitle>Past entries</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {journal.map((e) => (
              <div key={e.id} style={{ background: T.card, borderRadius: 16, padding: 14, boxShadow: T.soft }}>
                <div style={{ fontSize: 11.5, color: T.sub, marginBottom: 6 }}>{new Date(e.ts).toLocaleString()}</div>
                <div style={{ fontSize: 14.5, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{e.text}</div>
              </div>
            ))}
          </div>
        </>
      )}
      <Disclaimer />
    </>
  );
}
