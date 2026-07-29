// Google Cloud Text-to-Speech. Uses GOOGLE_TTS_KEY (server-side only).
// Falls back to the browser voice automatically if the key is missing or a call fails.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const key = process.env.GOOGLE_TTS_KEY;
  if (!key) {
    res.status(503).json({ error: "tts_not_configured" });
    return;
  }
  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    let text = body.text;
    const voiceName = body.voiceId; // e.g. "en-AU-Neural2-B"
    if (!text || !voiceName) {
      res.status(400).json({ error: "missing_text_or_voice" });
      return;
    }
    text = String(text).slice(0, 2500);

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
    if (!r.ok || !data.audioContent) {
      res.status(r.status === 200 ? 500 : r.status).json({ error: "tts_failed" });
      return;
    }

    const buf = Buffer.from(data.audioContent, "base64");
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(buf);
  } catch (e) {
    res.status(500).json({ error: "tts_error" });
  }
}
