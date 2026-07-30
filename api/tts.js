// Text-to-Speech endpoint.
//  • Juan uses a cloned Fish Audio voice.  His guide sends voiceId "fish:<model-id>",
//    which is synthesized via https://api.fish.audio/v1/tts using FISH_API_KEY.
//  • Every other guide uses Google Cloud TTS (en-AU) via GOOGLE_TTS_KEY, exactly as before.
// Graceful fallback: Fish fails -> Google (Aussie voice) -> browser voice (handled client-side).

const FISH_ENDPOINT = "https://api.fish.audio/v1/tts";
// Fish TTS engine. Free developer tier is "s2.1-pro-free". Override with FISH_MODEL if needed.
const FISH_MODEL = process.env.FISH_MODEL || "s2.1-pro-free";
// Accept a range of sensible env-var names so it matches whatever you set in Vercel.
const FISH_KEY =
  process.env.FISH_API_KEY ||
  process.env.FISH_AUDIO_KEY ||
  process.env.FISHAUDIO_API_KEY ||
  process.env.FISH_AUDIO_API_KEY ||
  process.env.FISH_TTS_KEY ||
  process.env.FISH_KEY ||
  "";
// If Fish is unavailable, fall back to this Google voice so Juan still sounds Australian.
const FISH_FALLBACK_GOOGLE_VOICE =
  process.env.FISH_FALLBACK_VOICE || "en-AU-Chirp3-HD-Umbriel";

async function googleSynth(text, voiceName, key) {
  const r = await fetch(
    `https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${key}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: "en-AU", name: voiceName },
        audioConfig: { audioEncoding: "MP3" },
      }),
    }
  );
  const data = await r.json();
  if (!r.ok || !data.audioContent) return null;
  return Buffer.from(data.audioContent, "base64");
}

async function fishSynth(text, referenceId) {
  if (!FISH_KEY) return null;
  try {
    const r = await fetch(FISH_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FISH_KEY}`,
        "Content-Type": "application/json",
        model: FISH_MODEL,
      },
      body: JSON.stringify({
        text,
        reference_id: referenceId,
        format: "mp3",
        mp3_bitrate: 128,
      }),
    });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    return buf.length ? buf : null;
  } catch (e) {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    let text = body.text;
    const voiceId = body.voiceId;
    if (!text || !voiceId) {
      res.status(400).json({ error: "missing_text_or_voice" });
      return;
    }
    text = String(text).slice(0, 2500);
    const googleKey = process.env.GOOGLE_TTS_KEY;

    // ---- Fish Audio (Juan's cloned voice): voiceId "fish:<model-id>" ----
    if (typeof voiceId === "string" && voiceId.startsWith("fish:")) {
      const referenceId = voiceId.slice(5);
      let buf = await fishSynth(text, referenceId);
      // graceful fallback so Juan still sounds Australian if Fish is down
      if (!buf && googleKey) {
        buf = await googleSynth(text, FISH_FALLBACK_GOOGLE_VOICE, googleKey);
      }
      if (!buf) {
        res.status(502).json({ error: "tts_failed" });
        return;
      }
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Cache-Control", "no-store");
      res.status(200).send(buf);
      return;
    }

    // ---- Google Cloud TTS (all other guides) ----
    if (!googleKey) {
      res.status(503).json({ error: "tts_not_configured" });
      return;
    }
    const buf = await googleSynth(text, voiceId, googleKey);
    if (!buf) {
      res.status(500).json({ error: "tts_failed" });
      return;
    }
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(buf);
  } catch (e) {
    res.status(500).json({ error: "tts_error" });
  }
}
