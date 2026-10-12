import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM at-rest encryption for sensitive PII (birthday, mailing
// address) - collected for Hack Club's YSWS Unified Database submission
// requirements (see 0076_ysws_submission_fields.sql) and worth protecting
// beyond what a plain Postgres column gives you. Ciphertext is prefixed
// ("gcm1:") so decryptPII can tell it apart from legacy plaintext rows saved
// before this existed - those are returned as-is instead of failing to
// decrypt, and re-encrypt themselves the next time the player hits save.
// Kept in sync with apps/server/src/crypto.ts (same PII_ENCRYPTION_KEY in
// both apps' .env) - dashboard can't import server code across apps.
const PREFIX = "gcm1:";

function getKey(): Buffer {
  const raw = process.env.PII_ENCRYPTION_KEY;
  if (!raw) throw new Error("PII_ENCRYPTION_KEY is not set");
  const key = Buffer.from(raw, "hex");
  if (key.length !== 32) {
    throw new Error("PII_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)");
  }
  return key;
}

export function encryptPII(plain: string | null | undefined): string {
  if (!plain) return "";
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

export function decryptPII(value: string | null | undefined): string {
  if (!value) return "";
  if (!value.startsWith(PREFIX)) return value; // legacy plaintext, pre-encryption
  try {
    const buf = Buffer.from(value.slice(PREFIX.length), "base64");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ciphertext = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch (err) {
    console.error("[crypto] decryptPII failed", (err as Error).message);
    return "";
  }
}
