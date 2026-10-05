// Text-to-speech endpoint for the support personas.
// Nicolas/Juan and Carlos use Fish Audio cloned voices. Mick and Lila keep
// their existing Google Cloud voices. All provider keys remain server-side.
const FISH_ENDPOINT = "https://api.fish.audio/v1/tts";
const FISH_MODEL = process.env.FISH_MODEL || "s2.1-pro-free";
const FISH_KEY = process.env.FISH_API_KEY || process.env.FISH_AUDIO_API_KEY || process.env.FISH_AUDIO_KEY || "";

async function googleSynth(text, voiceName, key, languageCode = "en-AU", voiceGender = "MALE") {
  const voice = { languageCode: languageCode || "en-AU" };
  // Keep the established male guide feel by default, while respecting Lila's
  // dedicated female voice in both Guides and Journal. A named English persona
  // voice is retained for English; Google chooses a matching locale voice for
  // every other selected app language.
  const requestedGender = voiceGender === "FEMALE" ? "FEMALE" : "MALE";
  if (languageCode && languageCode !== "en-AU") voice.ssmlGender = requestedGender;
  if (!languageCode || languageCode === "en-AU") voice.name = voiceName;
  try {
    const response = await fetch(`https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${key}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input: { text }, voice, audioConfig: { audioEncoding: "MP3" } }),
    });
    const data = await response.json();
    if (!response.ok || !data.audioContent) {
      // Some Google locales expose no separately gendered voice. Preserve
      // language accuracy in that case rather than failing into browser speech.
      if (voice.ssmlGender) {
        const fallback = await fetch(`https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${key}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ input: { text }, voice: { languageCode: languageCode || "en-AU" }, audioConfig: { audioEncoding: "MP3" } }),
        });
        const fallbackData = await fallback.json();
        if (fallback.ok && fallbackData.audioContent) return Buffer.from(fallbackData.audioContent, "base64");
      }
      return null;
    }
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
        // Fish Audio currently supports "balanced" and "normal" here;
        // "low" makes the request fail and silently triggers the generic
        // Google/browser fallback for the cloned guide voices.
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
    const voiceGender = body.voiceGender === "FEMALE" ? "FEMALE" : "MALE";
    if (!text || !voiceId) {
      res.status(400).json({ error: "missing_text_or_voice" });
      return;
    }

    let audio = null;
    // The cloned Fish voices are used for the English personas. For every
    // other selected app language, route through Google Cloud TTS with only a
    // locale code so it selects a voice that can actually pronounce that
    // writing system instead of attempting an English voice clone.
    const useFishVoice = typeof voiceId === "string" && voiceId.startsWith("fish:") && /^en(?:-|$)/i.test(languageCode || "en-AU");
    if (useFishVoice) {
      audio = await fishSynth(text, voiceId.slice(5));
      if (!audio && process.env.GOOGLE_TTS_KEY) {
        audio = await googleSynth(text, process.env.FISH_FALLBACK_VOICE || "en-AU-Chirp3-HD-Umbriel", process.env.GOOGLE_TTS_KEY, languageCode, voiceGender);
      }
    } else {
      if (process.env.GOOGLE_TTS_KEY) {
        audio = await googleSynth(text, voiceId, process.env.GOOGLE_TTS_KEY, languageCode, voiceGender);
      }
      // Cloud TTS does not publish every language represented in the Hub (for
      // example, some Persian/Dari variants). Fish's current model supports a
      // broader multilingual set, so give the existing male guide clone a
      // chance before the client has to fall back to a device/browser voice.
      if (!audio && typeof voiceId === "string" && voiceId.startsWith("fish:")) {
        audio = await fishSynth(text, voiceId.slice(5));
      }
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
