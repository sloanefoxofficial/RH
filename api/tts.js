// Text-to-speech endpoint for the support personas.
// Nicolas/Juan and Carlos use Fish Audio cloned voices. Mick and Lila keep
// their existing Google Cloud voices. All provider keys remain server-side.
const FISH_ENDPOINT = "https://api.fish.audio/v1/tts";
const FISH_MODEL = process.env.FISH_MODEL || "s2.1-pro-free";
const FISH_KEY = process.env.FISH_API_KEY || process.env.FISH_AUDIO_API_KEY || process.env.FISH_AUDIO_KEY || "";

async function googleSynth(text, voiceName, key, languageCode = "en-AU") {
  const voice = { languageCode: languageCode || "en-AU" };
  if (!languageCode || languageCode === "en-AU") voice.name = voiceName;
  try {
    const response = await fetch(`https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${key}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input: { text }, voice, audioConfig: { audioEncoding: "MP3" } }),
    });
    const data = await response.json();
    if (!response.ok || !data.audioContent) return null;
    return Buffer.from(data.audioContent, "base64");
  } catch {
    return null;
  }
}

async function fishSynth(text, referenceId) {
  if (!FISH_KEY || !referenceId) return null;
  try {
    const response = await fetch(FISH_ENDPOINT, {
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
        mp3_bitrate: 64,
        latency: "balanced",
        chunk_length: 100,
        min_chunk_length: 50,
        condition_on_previous_chunks: false,
      }),
    });
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer.length ? buffer : null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const text = String(body.text || "").slice(0, 2500);
    const voiceId = body.voiceId;
    const languageCode = typeof body.languageCode === "string" ? body.languageCode : "en-AU";
    if (!text || !voiceId) {
      res.status(400).json({ error: "missing_text_or_voice" });
      return;
    }

    let audio = null;
    if (typeof voiceId === "string" && voiceId.startsWith("fish:")) {
      audio = await fishSynth(text, voiceId.slice(5));
      if (!audio && process.env.GOOGLE_TTS_KEY) {
        audio = await googleSynth(text, process.env.FISH_FALLBACK_VOICE || "en-AU-Chirp3-HD-Umbriel", process.env.GOOGLE_TTS_KEY, languageCode);
      }
    } else if (process.env.GOOGLE_TTS_KEY) {
      audio = await googleSynth(text, voiceId, process.env.GOOGLE_TTS_KEY, languageCode);
    }

    if (!audio) {
      res.status(502).json({ error: "tts_failed" });
      return;
    }
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(audio);
  } catch {
    res.status(500).json({ error: "tts_error" });
  }
}
