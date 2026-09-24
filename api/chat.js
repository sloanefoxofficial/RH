// Shared AI guide endpoint for the whole app.
// Uses Google's official @google/genai SDK with streaming enabled.
// The API key remains server-side in Vercel and is never sent to the browser.
import { GoogleGenAI } from "@google/genai";

const MAX_IMAGES = 10;
const MAX_IMAGE_DATA_CHARS = 5_600_000;
const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

function parseBody(req) {
  try {
    return typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  } catch {
    return null;
  }
}

function cleanMessages(rawMessages) {
  let imageCount = 0;
  let imageDataChars = 0;
  const clean = [];

  for (const message of Array.isArray(rawMessages) ? rawMessages : []) {
    if (!message || (message.role !== "user" && message.role !== "assistant")) continue;
    const role = message.role === "assistant" ? "model" : "user";
    const sourceBlocks = Array.isArray(message.content) ? message.content : [{ type: "text", text: message.content }];
    const parts = [];

    for (const block of sourceBlocks) {
      if (!block) continue;
      if (block.type === "image") {
        const source = block.source || {};
        const mimeType = source.media_type;
        const data = typeof source.data === "string" ? source.data : "";
        if (source.type !== "base64" || !/^image\/(jpeg|png|webp|gif)$/i.test(mimeType || "") || !data) {
          throw new Error("invalid_image_block");
        }
        imageCount += 1;
        imageDataChars += data.length;
        if (imageCount > MAX_IMAGES || imageDataChars > MAX_IMAGE_DATA_CHARS) {
          throw new Error("image_payload_too_large");
        }
        parts.push({ inlineData: { mimeType, data } });
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

function sendEvent(res, payload) {
  try {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  } catch {
    // The client may have gone away; the stream loop will end naturally.
  }
}

function beginStream(res) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof res.flushHeaders === "function") res.flushHeaders();
}

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

    const ai = new GoogleGenAI({ apiKey });
    const config = {
      maxOutputTokens: Number(body.max_tokens) || 1000,
      ...(body.system ? { systemInstruction: String(body.system) } : {}),
    };

    let stream;
    let lastError;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        stream = await ai.models.generateContentStream({ model: DEFAULT_MODEL, contents, config });
        break;
      } catch (error) {
        lastError = error;
        if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    if (!stream) throw lastError || new Error("Gemini stream unavailable");

    beginStream(res);
    let sentText = false;
    try {
      for await (const chunk of stream) {
        const text = typeof chunk?.text === "string" ? chunk.text : "";
        if (text) {
          sentText = true;
          sendEvent(res, { text });
        }
      }
      if (!sentText) sendEvent(res, { error: "The reply came back empty — try sending that again." });
      sendEvent(res, { done: true });
      res.end();
    } catch {
      sendEvent(res, { error: "The guide connection was interrupted. Please try again." });
      sendEvent(res, { done: true });
      res.end();
    }
  } catch (error) {
    const message = error?.message || "Failed to reach Google AI Studio.";
    if (message === "invalid_image_block" || message === "image_payload_too_large") {
      res.status(413).json({ error: message });
      return;
    }
    res.status(502).json({ error: "The guides are temporarily unavailable. Please try again in a moment." });
  }
}

export const config = { api: { bodyParser: { sizeLimit: "12mb" } } };
