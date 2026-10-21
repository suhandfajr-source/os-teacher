import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Derives a deterministic 256-bit encryption key from secret.
 * Falls back to BETTER_AUTH_SECRET or a static dev fallback.
 */
function getDerivedKey(): Buffer {
  const secret =
    process.env.ENCRYPTION_KEY ||
    process.env.BETTER_AUTH_SECRET ||
    "klassa-default-dev-secret-key-32b-length-req";
  return createHash("sha256").update(secret).digest();
}

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // bytes for GCM

export interface EncryptedPayload {
  iv: string; // hex
  tag: string; // hex
  data: string; // hex
}

/**
 * Encrypts a plaintext string (e.g. raw API Key) using AES-256-GCM.
 */
export function encryptSecret(plainText: string): string {
  if (!plainText) return "";
  const key = getDerivedKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");

  // Format: "enc:v1:<iv>:<tag>:<encryptedHex>"
  return `enc:v1:${iv.toString("hex")}:${tag}:${encrypted}`;
}

/**
 * Decrypts an encrypted string created by `encryptSecret`.
 * Returns plaintext or null if decryption fails.
 */
export function decryptSecret(encryptedPayload: string | null | undefined): string | null {
  if (!encryptedPayload) return null;
  if (!encryptedPayload.startsWith("enc:v1:")) {
    // If plaintext or legacy unencrypted string
    return encryptedPayload;
  }

  try {
    const parts = encryptedPayload.split(":");
    if (parts.length !== 5) return null;

    const [, , ivHex, tagHex, dataHex] = parts;
    const key = getDerivedKey();
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(dataHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    console.error("[crypto] Failed to decrypt secret payload:", err);
    return null;
  }
}

/**
 * Redacts an API key for safe UI display (e.g., "AIzaSyD...••••••••e9Xz").
 */
export function maskApiKey(key: string | null | undefined): string {
  if (!key) return "";
  const trimmed = key.trim();
  if (trimmed.length <= 8) {
    return "••••••••";
  }
  const prefix = trimmed.slice(0, 6);
  const suffix = trimmed.slice(-4);
  return `${prefix}••••••••${suffix}`;
}
