// Server-side speech-to-text for the Resilience Hub.
// The OpenAI key is read only from Vercel environment variables and never sent to the browser.

const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "Speech transcription is not configured yet." });
    return;
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const audio = String(body.audio || "").replace(/^data:[^;]+;base64,/, "");
    const mimeType = String(body.mimeType || "audio/webm").split(";")[0];
    if (!audio) { res.status(400).json({ error: "Missing audio." }); return; }
    const buffer = Buffer.from(audio, "base64");
    if (!buffer.length || buffer.length > MAX_AUDIO_BYTES) {
      res.status(413).json({ error: "The recording is empty or too large." });
      return;
    }
    const extension = mimeType.includes("mp4") || mimeType.includes("m4a") ? "m4a" : mimeType.includes("ogg") ? "ogg" : "webm";
    const form = new FormData();
    form.append("file", new Blob([buffer], { type: mimeType }), `resilience-hub.${extension}`);
    form.append("model", process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe");
    if (body.language) form.append("language", String(body.language).slice(0, 12));
    form.append("response_format", "json");
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    const data = await response.json();
    if (!response.ok) {
      res.status(502).json({ error: data?.error?.message || "Transcription failed." });
      return;
    }
    const text = String(data?.text || "").trim();
    if (!text) { res.status(422).json({ error: "No speech was detected." }); return; }
    res.status(200).json({ text });
  } catch {
    res.status(500).json({ error: "Unable to transcribe the recording." });
  }
}

export const config = { api: { bodyParser: { sizeLimit: "16mb" } } };

