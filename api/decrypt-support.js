import { createClient } from "@supabase/supabase-js";
import { privateDecrypt, constants, createDecipheriv } from "node:crypto";

function b64(value) { return Buffer.from(value, "base64"); }
function json(value) { return typeof value === "string" ? JSON.parse(value || "{}") : value || {}; }

async function authorisedAdmin(req) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Server Supabase verification is not configured.");
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  const allowed = String(process.env.RH_ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!allowed.includes(String(data.user.email || "").toLowerCase())) return null;
  return data.user;
}

function decryptEnvelope(envelope) {
  if (!envelope || envelope.__rhTeamEncrypted !== true) throw new Error("Unsupported support ciphertext.");
  const pem = process.env.RH_TEAM_PRIVATE_KEY;
  if (!pem) throw new Error("RH_TEAM_PRIVATE_KEY is not configured.");
  const contentKey = privateDecrypt({ key: pem, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, b64(envelope.teamWrappedKey));
  const iv = b64(envelope.userEnvelope.iv);
  const tagLength = 16;
  const raw = b64(envelope.userEnvelope.ciphertext);
  const ciphertext = raw.subarray(0, raw.length - tagLength);
  const tag = raw.subarray(raw.length - tagLength);
  const decipher = createDecipheriv("aes-256-gcm", contentKey, iv);
  decipher.setAAD(Buffer.from(envelope.userEnvelope.aad || "", "utf8"));
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8"));
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
  try {
    const user = await authorisedAdmin(req);
    if (!user) { res.status(403).json({ error: "Authorised staff access required." }); return; }
    const body = json(req.body);
    const envelopes = Array.isArray(body.envelopes) ? body.envelopes : [body.envelope];
    const result = envelopes.filter(Boolean).map((envelope) => decryptEnvelope(envelope));
    res.status(200).json({ data: result });
  } catch (e) {
    const message = e?.message || "Unable to decrypt support data.";
    res.status(message.includes("configured") ? 500 : 400).json({ error: message });
  }
}
