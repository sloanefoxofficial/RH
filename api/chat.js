// Single shared chat endpoint for the whole app. Every guide, the plan
// generator, journal helper, and admin assistant call this function.
// The OpenAI key is server-side only and is never exposed to the browser.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Server is missing OPENAI_API_KEY" });
    return;
  }
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const { system, max_tokens } = body;
    const MAX_IMAGES = 10;
    const MAX_IMAGE_DATA_CHARS = 5_600_000;
    let imageCount = 0;
    let imageDataChars = 0;
    const clean = [];
    for (const m of Array.isArray(body.messages) ? body.messages : []) {
      if (!m || (m.role !== "user" && m.role !== "assistant")) continue;
      let content;
      if (Array.isArray(m.content)) {
        if (!m.content.length) continue;
        content = m.content.map((block) => {
          if (!block || block.type !== "image") return block;
          const source = block.source || {};
          const mediaType = source.media_type;
          const data = typeof source.data === "string" ? source.data : "";
          if (source.type !== "base64" || !/^image\/(jpeg|png|webp|gif)$/i.test(mediaType || "") || !data) throw new Error("invalid_image_block");
          imageCount += 1;
          imageDataChars += data.length;
          if (imageCount > MAX_IMAGES || imageDataChars > MAX_IMAGE_DATA_CHARS) throw new Error("image_payload_too_large");
          return { type: "image_url", image_url: { url: `data:${mediaType};base64,${data}` } };
        });
      } else {
        const t = typeof m.content === "string" ? m.content.trim() : "";
        if (!t) continue;
        content = t;
      }
      const prev = clean.length ? clean[clean.length - 1] : null;
      if (prev && prev.role === m.role && typeof prev.content === "string" && typeof content === "string") prev.content += "\n\n" + content;
      else clean.push({ role: m.role, content });
    }
    while (clean.length && clean[0].role !== "user") clean.shift();
    if (clean.length === 0) {
      res.status(400).json({ error: "No message to send." });
      return;
    }
    const messages = system ? [{ role: "system", content: system }, ...clean] : clean;
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, max_tokens: max_tokens || 1000, messages }),
    });
    const data = await r.json();
    if (!r.ok) {
      const msg = (data && data.error && data.error.message) || "Model error";
      res.status(r.status).json({ error: msg });
      return;
    }
    const text = data?.choices?.[0]?.message?.content;
    res.status(200).json({ text: typeof text === "string" ? text.trim() : "" });
  } catch (e) {
    if (e && (e.message === "invalid_image_block" || e.message === "image_payload_too_large")) {
      res.status(413).json({ error: e.message });
      return;
    }
    res.status(500).json({ error: "Failed to reach the model." });
  }
}
