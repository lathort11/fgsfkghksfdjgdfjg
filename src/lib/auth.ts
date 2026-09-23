import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LEN).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  try {
    const expected = Buffer.from(hash, "hex");
    const actual = scryptSync(password, salt, KEY_LEN);
    if (expected.length !== actual.length) return false;
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function newSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function newSecret(): string {
  return String(randomBytes(3).readUIntBE(0, 3)).padStart(6, "0").slice(0, 6);
}

export function newOrderNo(): number {
  return 100000 + randomBytes(3).readUIntBE(0, 3) % 900000;
}

export function randomPassword(len = 14): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export function randomApiKey(): string {
  const part = () => randomBytes(12).toString("base64url").replace(/[-_]/g, "x");
  return `AIzaSy${part().slice(0, 16)}${part().slice(0, 17)}`;
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(value.trim());
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}
