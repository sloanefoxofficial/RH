// Single shared chat endpoint for the whole app. Every guide, the plan
// generator, journal helper, and admin assistant call this function.
// The Gemini key is server-side only and is never exposed to the browser.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Server is missing GEMINI_API_KEY" });
    return;
  }
  const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
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
      let parts;
      if (Array.isArray(m.content)) {
        parts = [];
        for (const block of m.content) {
          if (!block) continue;
          if (block.type === "image") {
            const source = block.source || {};
            const mediaType = source.media_type;
            const data = typeof source.data === "string" ? source.data : "";
            if (source.type !== "base64" || !/^image\/(jpeg|png|webp|gif)$/i.test(mediaType || "") || !data) throw new Error("invalid_image_block");
            imageCount += 1;
            imageDataChars += data.length;
            if (imageCount > MAX_IMAGES || imageDataChars > MAX_IMAGE_DATA_CHARS) throw new Error("image_payload_too_large");
            parts.push({ inlineData: { mimeType: mediaType, data } });
          } else if (block.type === "text" && typeof block.text === "string" && block.text.trim()) {
            parts.push({ text: block.text.trim() });
          }
        }
        if (!parts.length) continue;
      } else {
        const t = typeof m.content === "string" ? m.content.trim() : "";
        if (!t) continue;
        parts = [{ text: t }];
      }
      const role = m.role === "assistant" ? "model" : "user";
      const prev = clean.length ? clean[clean.length - 1] : null;
      if (prev && prev.role === role) prev.parts.push(...parts);
      else clean.push({ role, parts });
    }
    while (clean.length && clean[0].role !== "user") clean.shift();
    if (clean.length === 0) {
      res.status(400).json({ error: "No message to send." });
      return;
    }
    const requestBody = {
      contents: clean,
      generationConfig: { maxOutputTokens: max_tokens || 1000 },
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    };
    const models = [...new Set([model, "gemini-3.5-flash", "gemini-3.8-flash"])]
      .filter(Boolean);
    let data = null;
    let lastError = null;
    for (const candidate of models) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(candidate)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      data = await r.json();
      if (r.ok) break;
      lastError = { status: r.status, message: data?.error?.message || "Model error" };
      // Busy/limited models can be bypassed by trying the next free Flash model.
      if (![404, 429, 500, 503].includes(r.status)) break;
    }
    if (lastError && (!data?.candidates || !data.candidates.length)) {
      res.status(lastError.status).json({ error: lastError.message });
      return;
    }
    const text = (data?.candidates?.[0]?.content?.parts || [])
      .filter((part) => typeof part?.text === "string")
      .map((part) => part.text)
      .join("\n")
      .trim();
    res.status(200).json({ text });
  } catch (e) {
    if (e && (e.message === "invalid_image_block" || e.message === "image_payload_too_large")) {
      res.status(413).json({ error: e.message });
      return;
    }
    res.status(500).json({ error: "Failed to reach the model." });
  }
}
