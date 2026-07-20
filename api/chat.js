// Single shared chat endpoint for the WHOLE app — every guide (Rex, Juan,
// Carlos, Mick, Lila), the plan generator, the journal helper, and the admin
// assistant all call this one function, using the one ANTHROPIC_API_KEY held
// server-side. The key is never exposed to the browser.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Server is missing ANTHROPIC_API_KEY" });
    return;
  }
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const { system, max_tokens } = body;

    // Normalise messages so a malformed history can never cause an error for
    // one guide while another works: keep only valid turns, merge consecutive
    // same-role plain-text turns, and ensure the conversation starts on a user turn.
    // Content can be a plain string OR an array of content blocks (e.g. an
    // attached photo + text) — arrays are passed through as-is for Claude's vision.
    const clean = [];
    for (const m of Array.isArray(body.messages) ? body.messages : []) {
      if (!m || (m.role !== "user" && m.role !== "assistant")) continue;
      let content;
      if (Array.isArray(m.content)) {
        if (!m.content.length) continue;
        content = m.content;
      } else {
        const t = typeof m.content === "string" ? m.content.trim() : "";
        if (!t) continue;
        content = t;
      }
      const prev = clean.length ? clean[clean.length - 1] : null;
      if (prev && prev.role === m.role && typeof prev.content === "string" && typeof content === "string") {
        prev.content += "\n\n" + content;
      } else {
        clean.push({ role: m.role, content });
      }
    }
    while (clean.length && clean[0].role !== "user") clean.shift();
    if (clean.length === 0) {
      res.status(400).json({ error: "No message to send." });
      return;
    }

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: max_tokens || 1000,
        ...(system ? { system } : {}),
        messages: clean,
      }),
    });

    const data = await r.json();
    if (!r.ok) {
      const msg = (data && data.error && data.error.message) || "Model error";
      res.status(r.status).json({ error: msg });
      return;
    }

    const text = (data.content || [])
      .filter((b) => b && b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    res.status(200).json({ text });
  } catch (e) {
    res.status(500).json({ error: "Failed to reach the model." });
  }
}
