import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function deriveKey(secret: string, salt: Buffer): Buffer {
  return scryptSync(secret, salt, KEY_LENGTH);
}

export function encryptApiKey(
  plaintext: string,
  sessionSecret: string,
  sessionId: string,
): string {
  const salt = randomBytes(16);
  const key = deriveKey(sessionSecret, salt);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([salt, iv, tag, encrypted]);
  return `${sessionId}.${payload.toString("base64url")}`;
}

export function decryptApiKey(
  ciphertext: string,
  sessionSecret: string,
): string {
  const [, encoded] = ciphertext.split(".");
  if (!encoded) {
    throw new Error("Invalid encrypted API key format");
  }
  const payload = Buffer.from(encoded, "base64url");
  const salt = payload.subarray(0, 16);
  const iv = payload.subarray(16, 16 + IV_LENGTH);
  const tag = payload.subarray(16 + IV_LENGTH, 16 + IV_LENGTH + TAG_LENGTH);
  const encrypted = payload.subarray(16 + IV_LENGTH + TAG_LENGTH);
  const key = deriveKey(sessionSecret, salt);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
