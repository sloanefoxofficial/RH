const VERSION = 1;
const PBKDF2_ITERATIONS = 310000;
const te = new TextEncoder();
const td = new TextDecoder();
const DEVICE_UNLOCK_STORAGE = "rh_device_vault_unlock_v1";
const DEVICE_DB = "rh-device-vault";

function openDeviceDb() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) return reject(new Error("Device unlock is not supported in this browser."));
    const request = indexedDB.open(DEVICE_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("keys");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open device vault."));
  });
}
async function deviceKey(readOnly = false) {
  const db = await openDeviceDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("keys", readOnly ? "readonly" : "readwrite");
    const store = tx.objectStore("keys");
    const request = readOnly ? store.get("vault") : store.get("vault");
    request.onsuccess = async () => {
      try {
        if (request.result) return resolve(request.result);
        if (readOnly) return resolve(null);
        const generated = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
        store.put(generated, "vault");
        resolve(generated);
      } catch (e) { reject(e); }
    };
    request.onerror = () => reject(request.error || new Error("Could not read device vault."));
  });
}
async function rawDeviceUnlockEnvelope() {
  try { const raw = localStorage.getItem(DEVICE_UNLOCK_STORAGE); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

function bytesToB64(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(out);
}
function b64ToBytes(value) {
  const raw = atob(value);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}
function randomBytes(size) { const out = new Uint8Array(size); crypto.getRandomValues(out); return out; }
async function importAes(raw, usages = ["encrypt", "decrypt"]) { return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, usages); }
async function derivePasswordKey(secret, salt) {
  const base = await crypto.subtle.importKey("raw", te.encode(secret), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function seal(bytes, key, aad) {
  const iv = randomBytes(12);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: te.encode(aad) }, key, bytes);
  return { iv: bytesToB64(iv), ciphertext: bytesToB64(new Uint8Array(ciphertext)), aad };
}
async function open(envelope, key, aad) {
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64ToBytes(envelope.iv), additionalData: te.encode(aad) }, key, b64ToBytes(envelope.ciphertext));
  return new Uint8Array(plaintext);
}
function validateSecret(secret, label = "privacy passphrase") { if (typeof secret !== "string" || secret.trim().length < 12) throw new Error(`Your ${label} must be at least 12 characters.`); }
export function makeRecoveryKey() { return bytesToB64(randomBytes(32)).replace(/[^A-Za-z0-9]/g, "").slice(0, 40); }
async function importRsaPublic(jwk) { return crypto.subtle.importKey("jwk", jwk, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]); }
async function importRsaPrivate(jwk) { return crypto.subtle.importKey("jwk", jwk, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["decrypt"]); }
async function generateUserRecipientKey() {
  const pair = await crypto.subtle.generateKey({ name: "RSA-OAEP", modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["encrypt", "decrypt"]);
  return { publicKey: pair.publicKey, privateKey: pair.privateKey, publicJwk: await crypto.subtle.exportKey("jwk", pair.publicKey), privateJwk: await crypto.subtle.exportKey("jwk", pair.privateKey) };
}
export async function createUserVault(passphrase) {
  validateSecret(passphrase);
  const salt = randomBytes(16), recoverySalt = randomBytes(16);
  const passphraseKey = await derivePasswordKey(passphrase, salt);
  const rawDataKey = randomBytes(32), dataKey = await importAes(rawDataKey);
  const recipient = await generateUserRecipientKey();
  const recovery = makeRecoveryKey(), recoveryKey = await derivePasswordKey(recovery, recoverySalt);
  const meta = {
    v: VERSION, algorithm: "AES-256-GCM", kdf: "PBKDF2-SHA256", iterations: PBKDF2_ITERATIONS,
    salt: bytesToB64(salt), recoverySalt: bytesToB64(recoverySalt), userPublicKeyJwk: recipient.publicJwk,
    wrappedForPassphrase: await seal(rawDataKey, passphraseKey, "rh-vault-passphrase-v1"),
    wrappedForRecovery: await seal(rawDataKey, recoveryKey, "rh-vault-recovery-v1"),
    wrappedUserPrivateKey: await encryptJson(recipient.privateJwk, dataKey, "rh-user-private-key"), createdAt: Date.now(),
  };
  return { meta, rawDataKey, dataKey, userPrivateKey: recipient.privateKey, userPublicKey: recipient.publicKey, recoveryKey: recovery };
}
export async function unlockUserVault(meta, secret, recovery = false) {
  if (!meta || meta.v !== VERSION) throw new Error("Unsupported privacy-vault version.");
  validateSecret(secret, recovery ? "recovery key" : "privacy passphrase");
  const wrappingKey = await derivePasswordKey(secret, b64ToBytes(recovery ? meta.recoverySalt : meta.salt));
  const rawDataKey = await open(recovery ? meta.wrappedForRecovery : meta.wrappedForPassphrase, wrappingKey, recovery ? "rh-vault-recovery-v1" : "rh-vault-passphrase-v1");
  const dataKey = await importAes(rawDataKey);
  const privateJwk = await decryptJson(meta.wrappedUserPrivateKey, dataKey, "rh-user-private-key");
  return { rawDataKey: new Uint8Array(rawDataKey), dataKey, userPrivateKey: await importRsaPrivate(privateJwk), userPublicKey: await importRsaPublic(meta.userPublicKeyJwk) };
}
export async function encryptJson(value, dataKey, field) {
  const aad = `rh:${field}:v${VERSION}`;
  return { __rhEncrypted: true, v: VERSION, field, ...(await seal(te.encode(JSON.stringify(value)), dataKey, aad)) };
}
export async function decryptJson(value, dataKey, field) {
  if (!value || value.__rhEncrypted !== true) return value;
  return JSON.parse(td.decode(await open(value, dataKey, `rh:${field}:v${VERSION}`)));
}
export function isEncrypted(value) { return Boolean(value && value.__rhEncrypted === true && value.v === VERSION); }
export async function importTeamPublicKey(jwk) { return crypto.subtle.importKey("jwk", typeof jwk === "string" ? JSON.parse(jwk) : jwk, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]); }
export async function encryptForTeam(value, userPublicKey, teamPublicKey, field) {
  if (!userPublicKey) throw new Error("The user privacy vault is locked.");
  if (!teamPublicKey) throw new Error("The authorised team encryption key is not configured.");
  const rawContentKey = randomBytes(32), contentKey = await importAes(rawContentKey);
  const userWrappedKey = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, userPublicKey, rawContentKey);
  const teamWrappedKey = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, teamPublicKey, rawContentKey);
  return { __rhTeamEncrypted: true, v: VERSION, field, userEnvelope: await encryptJson(value, contentKey, field), userWrappedKey: bytesToB64(new Uint8Array(userWrappedKey)), teamWrappedKey: bytesToB64(new Uint8Array(teamWrappedKey)), algorithm: "AES-256-GCM+RSA-OAEP-256" };
}
export async function decryptTeamForUser(envelope, userPrivateKey) {
  if (!envelope || envelope.__rhTeamEncrypted !== true) return envelope;
  const rawContentKey = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, userPrivateKey, b64ToBytes(envelope.userWrappedKey));
  return decryptJson(envelope.userEnvelope, await importAes(new Uint8Array(rawContentKey)), envelope.field);
}
export async function enableDeviceUnlock(rawDataKey) {
  const key = await deviceKey(false);
  const envelope = await seal(rawDataKey, key, "rh-device-unlock-v1");
  localStorage.setItem(DEVICE_UNLOCK_STORAGE, JSON.stringify(envelope));
}
export async function disableDeviceUnlock() {
  try { localStorage.removeItem(DEVICE_UNLOCK_STORAGE); } catch {}
  try {
    const db = await openDeviceDb();
    await new Promise((resolve) => { const tx = db.transaction("keys", "readwrite"); tx.objectStore("keys").delete("vault"); tx.oncomplete = resolve; tx.onerror = resolve; });
  } catch {}
}
export async function unlockWithDevice(meta) {
  const envelope = await rawDeviceUnlockEnvelope();
  if (!envelope || !meta?.userPublicKeyJwk) return null;
  try {
    const key = await deviceKey(true);
    if (!key) return null;
    const rawDataKey = await open(envelope, key, "rh-device-unlock-v1");
    const dataKey = await importAes(rawDataKey);
    const privateJwk = await decryptJson(meta.wrappedUserPrivateKey, dataKey, "rh-user-private-key");
    return { rawDataKey, dataKey, userPrivateKey: await importRsaPrivate(privateJwk), userPublicKey: await importRsaPublic(meta.userPublicKeyJwk) };
  } catch { return null; }
}

export async function getConfiguredTeamPublicKey() {
  const raw = import.meta.env.VITE_RH_TEAM_PUBLIC_KEY;
  if (!raw) throw new Error("The authorised team encryption key is not configured.");
  return importTeamPublicKey(raw);
}
export const VAULT_VERSION = VERSION;
export const KDF_ITERATIONS = PBKDF2_ITERATIONS;
