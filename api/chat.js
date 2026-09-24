// Shared AI guide endpoint for the whole app.
// Gemini is the normal provider; Claude is the server-side fallback when Gemini
// is unavailable, rate-limited, or otherwise fails before a stream starts.
import { GoogleGenAI } from "@google/genai";

const MAX_IMAGES = 10;
const MAX_IMAGE_DATA_CHARS = 5_600_000;
const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
const DEFAULT_CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

function parseBody(req) {
  try {
    return typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  } catch {
    return null;
  }
}

function validateImage(source, imageState) {
  const mimeType = source?.media_type;
  const data = typeof source?.data === "string" ? source.data : "";
  if (source?.type !== "base64" || !/^image\/(jpeg|png|webp|gif)$/i.test(mimeType || "") || !data) {
    throw new Error("invalid_image_block");
  }
  imageState.count += 1;
  imageState.chars += data.length;
  if (imageState.count > MAX_IMAGES || imageState.chars > MAX_IMAGE_DATA_CHARS) {
    throw new Error("image_payload_too_large");
  }
  return { mediaType: mimeType, data };
}

function cleanMessages(rawMessages) {
  const imageState = { count: 0, chars: 0 };
  const clean = [];

  for (const message of Array.isArray(rawMessages) ? rawMessages : []) {
    if (!message || (message.role !== "user" && message.role !== "assistant")) continue;
    const role = message.role === "assistant" ? "model" : "user";
    const sourceBlocks = Array.isArray(message.content) ? message.content : [{ type: "text", text: message.content }];
    const parts = [];

    for (const block of sourceBlocks) {
      if (!block) continue;
      if (block.type === "image") {
        const image = validateImage(block.source || {}, imageState);
        parts.push({ inlineData: { mimeType: image.mediaType, data: image.data } });
      } else {
        const text = typeof block.text === "string" ? block.text.trim() : typeof block === "string" ? block.trim() : "";
        if (text) parts.push({ text });
      }
    }

    if (!parts.length) continue;
    const previous = clean[clean.length - 1];
    if (previous && previous.role === role && previous.parts.length === 1 && previous.parts[0].text && parts.length === 1 && parts[0].text) {
      previous.parts[0].text += "\n\n" + parts[0].text;
    } else {
      clean.push({ role, parts });
    }
  }

  while (clean.length && clean[0].role !== "user") clean.shift();
  return clean;
}

function cleanClaudeMessages(rawMessages) {
  const imageState = { count: 0, chars: 0 };
  const clean = [];

  for (const message of Array.isArray(rawMessages) ? rawMessages : []) {
    if (!message || (message.role !== "user" && message.role !== "assistant")) continue;
    let content;
    if (Array.isArray(message.content)) {
      const blocks = [];
      for (const block of message.content) {
        if (!block) continue;
        if (block.type === "image") {
          const image = validateImage(block.source || {}, imageState);
          blocks.push({ type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } });
        } else {
          const text = typeof block.text === "string" ? block.text.trim() : typeof block === "string" ? block.trim() : "";
          if (text) blocks.push({ type: "text", text });
        }
      }
      content = blocks;
    } else {
      const text = typeof message.content === "string" ? message.content.trim() : "";
      content = text;
    }
    if (!content || (Array.isArray(content) && !content.length)) continue;

    const previous = clean[clean.length - 1];
    if (previous && previous.role === message.role && typeof previous.content === "string" && typeof content === "string") {
      previous.content += "\n\n" + content;
    } else {
      clean.push({ role: message.role, content });
    }
  }

  while (clean.length && clean[0].role !== "user") clean.shift();
  return clean;
}

function sendEvent(res, payload) {
  try { res.write(`data: ${JSON.stringify(payload)}\n\n`); } catch {}
}

function getChunkText(chunk) {
  try {
    const parts = chunk?.candidates?.[0]?.content?.parts;
    if (Array.isArray(parts)) {
      const candidateText = parts.map((part) => typeof part?.text === "string" ? part.text : "").join("");
      if (candidateText) return candidateText;
    }
    if (typeof chunk?.text === "function") {
      const text = chunk.text();
      if (typeof text === "string" && text.trim()) return text;
    }
    if (typeof chunk?.text === "string" && chunk.text.trim()) return chunk.text;
  } catch {}
  return "";
}

function beginStream(res) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof res.flushHeaders === "function") res.flushHeaders();
}

function providerStatus(error) {
  const direct = error?.status || error?.statusCode || error?.response?.status;
  if (direct) return Number(direct) || direct;
  const match = String(error?.message || "").match(/\b(401|402|403|429|500|502|503|504)\b/);
  return match ? Number(match[1]) : null;
}

async function readProviderError(response, provider) {
  const raw = await response.text().catch(() => "");
  let message = raw;
  try {
    const data = JSON.parse(raw);
    message = data?.error?.message || data?.message || raw;
  } catch {}
  const error = new Error(`${provider} request failed (${response.status}): ${message}`);
  error.status = response.status;
  return error;
}

async function streamClaude({ res, apiKey, model, system, rawMessages, maxTokens }) {
  const messages = cleanClaudeMessages(rawMessages);
  if (!messages.length) throw new Error("No message to send.");
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: Number(maxTokens) || 1000,
      stream: true,
      ...(system ? { system: String(system) } : {}),
      messages,
    }),
  });
  if (!response.ok || !response.body) throw await readProviderError(response, "Claude");

  beginStream(res);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sentText = false;
  const consume = (raw) => {
    buffer += raw;
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";
    for (const event of events) {
      const line = event.split("\n").find((entry) => entry.startsWith("data: "));
      if (!line) continue;
      try {
        const payload = JSON.parse(line.slice(6));
        const text = payload?.type === "content_block_delta" && payload?.delta?.type === "text_delta" ? payload.delta.text : "";
        if (text) { sentText = true; sendEvent(res, { text }); }
      } catch {}
    }
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      consume(decoder.decode(value, { stream: true }));
    }
    consume(decoder.decode());
    if (!sentText) sendEvent(res, { error: "The reply came back empty — try sending that again." });
    sendEvent(res, { done: true });
    res.end();
  } catch {
    sendEvent(res, { error: "The guide connection was interrupted. Please try again." });
    sendEvent(res, { done: true });
    res.end();
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  const claudeKey = process.env.ANTHROPIC_API_KEY;
  if (!geminiKey && !claudeKey) {
    res.status(500).json({ error: "Server is missing both GEMINI_API_KEY and ANTHROPIC_API_KEY" });
    return;
  }

  const body = parseBody(req);
  if (!body) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  try {
    const contents = cleanMessages(body.messages);
    if (!contents.length) {
      res.status(400).json({ error: "No message to send." });
      return;
    }

    let geminiError = null;
    if (geminiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey: geminiKey });
        const config = {
          maxOutputTokens: Number(body.max_tokens) || 1000,
          thinkingConfig: { thinkingLevel: "minimal" },
          ...(body.system ? { systemInstruction: String(body.system) } : {}),
        };
        let stream;
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            stream = await ai.models.generateContentStream({ model: DEFAULT_GEMINI_MODEL, contents, config });
            break;
          } catch (error) {
            geminiError = error;
            const status = providerStatus(error);
            if (attempt === 0 && (status === 429 || status === 500 || status === 502 || status === 503 || status === 504)) {
              await new Promise((resolve) => setTimeout(resolve, status === 429 ? 900 : 350));
            } else break;
          }
        }
        if (!stream) throw geminiError || new Error("Gemini stream unavailable");

        beginStream(res);
        let sentText = false;
        try {
          for await (const chunk of stream) {
            const text = getChunkText(chunk);
            if (text) { sentText = true; sendEvent(res, { text }); }
          }
          if (!sentText) sendEvent(res, { error: "The reply came back empty — try sending that again." });
          sendEvent(res, { done: true });
          res.end();
          return;
        } catch (error) {
          // Once a Gemini stream has started, the response headers are already
          // committed. Do not attempt to splice a second provider into it.
          sendEvent(res, { error: "The guide connection was interrupted. Please try again." });
          sendEvent(res, { done: true });
          res.end();
          return;
        }
      } catch (error) {
        geminiError = error;
        console.error("Gemini unavailable; using Claude fallback", {
          message: error?.message || String(error),
          status: providerStatus(error),
          model: DEFAULT_GEMINI_MODEL,
        });
      }
    }

    if (!claudeKey) {
      const status = providerStatus(geminiError);
      if (status === 429) {
        res.setHeader("Retry-After", "2");
        res.status(429).json({ error: "The guides are busy right now. Please try again in a few seconds." });
      } else {
        res.status(502).json({ error: "The guide service is temporarily unavailable. Please try again in a moment." });
      }
      return;
    }

    try {
      await streamClaude({
        res,
        apiKey: claudeKey,
        model: DEFAULT_CLAUDE_MODEL,
        system: body.system,
        rawMessages: body.messages,
        maxTokens: body.max_tokens,
      });
    } catch (error) {
      console.error("Claude fallback failed", {
        message: error?.message || String(error),
        status: providerStatus(error),
        model: DEFAULT_CLAUDE_MODEL,
      });
      const status = providerStatus(error);
      if (status === 429) {
        res.setHeader("Retry-After", "2");
        res.status(429).json({ error: "Both guide services are busy right now. Please try again in a few seconds." });
      } else {
        res.status(502).json({ error: "The guide services are temporarily unavailable. Please try again in a moment." });
      }
    }
  } catch (error) {
    if (error?.message === "invalid_image_block" || error?.message === "image_payload_too_large") {
      res.status(413).json({ error: error.message });
      return;
    }
    console.error("Guide request failed", { message: error?.message || String(error) });
    res.status(500).json({ error: "Failed to reach the guide service." });
  }
}

export const config = { api: { bodyParser: { sizeLimit: "12mb" } } };
