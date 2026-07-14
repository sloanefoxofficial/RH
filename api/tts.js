export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    res.status(503).json({ error: "tts_not_configured" });
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
    const model = process.env.ELEVENLABS_MODEL || "eleven_flash_v2_5";

    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": key,
        "content-type": "application/json",
        accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: model,
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });

    if (!r.ok) {
      res.status(r.status).json({ error: "tts_failed" });
      return;
    }

    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(buf);
  } catch (e) {
    res.status(500).json({ error: "tts_error" });
  }
}
