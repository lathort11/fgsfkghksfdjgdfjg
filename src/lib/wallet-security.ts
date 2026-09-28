import "server-only";
import { timingSafeEqual, createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { walletRateLimits } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";

export class WalletError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}
export function ensure(condition: unknown, code: string, status = 400): asserts condition {
  if (!condition) throw new WalletError(code, status);
}
export function validId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
export function idempotency(value: unknown): string {
  ensure(validId(value), "INVALID_REQUEST");
  return value;
}
export function checkOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  ensure(origin && host, "FORBIDDEN", 403);
  let originHost: string;
  try { originHost = new URL(origin).host; } catch { throw new WalletError("FORBIDDEN", 403); }
  ensure(originHost === host, "FORBIDDEN", 403);
  ensure(req.headers.get("content-type")?.startsWith("application/json"), "INVALID_REQUEST", 415);
}
export async function rateLimit(key: string, max = 20, seconds = 60) {
  const t = walletRateLimits;
  const [row] = await db.insert(t).values({ key }).onConflictDoUpdate({
    target: t.key,
    set: {
      hits: sql`CASE WHEN ${t.windowAt} < now() - ${seconds} * interval '1 second' THEN 1 ELSE ${t.hits} + 1 END`,
      windowAt: sql`CASE WHEN ${t.windowAt} < now() - ${seconds} * interval '1 second' THEN now() ELSE ${t.windowAt} END`,
    },
  }).returning();
  ensure(row.hits <= max, "RATE_LIMIT", 429);
}
export async function walletUser(req: Request) {
  checkOrigin(req);
  const user = await getCurrentUser();
  ensure(user, "AUTH", 401);
  await rateLimit(`wallet:${user.id}`);
  return user;
}
export async function readBody(req: Request): Promise<Record<string, unknown>> {
  ensure(Number(req.headers.get("content-length") ?? 0) <= 16_384, "INVALID_REQUEST", 413);
  const text = await req.text();
  ensure(text.length <= 16_384, "INVALID_REQUEST", 413);
  try {
    const value = JSON.parse(text);
    ensure(value && typeof value === "object" && !Array.isArray(value), "INVALID_REQUEST");
    return value;
  } catch { throw new WalletError("INVALID_REQUEST"); }
}
export function walletFailure(error: unknown) {
  if (error instanceof WalletError) return Response.json({ error: error.code }, { status: error.status });
  if (error instanceof Error && ["PAYMENTS_NOT_CONFIGURED", "PAYMENT_PROVIDER_UNAVAILABLE", "INVOICE_NOT_FOUND"].includes(error.message)) {
    return Response.json({ error: error.message }, { status: 503 });
  }
  console.error("Wallet request failed", error instanceof Error ? error.name : "unknown");
  return Response.json({ error: "SERVER_ERROR" }, { status: 500 });
}
export function isTronAddress(value: string): boolean {
  if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(value)) return false;
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let n = BigInt(0);
  for (const ch of value) n = n * BigInt(58) + BigInt(alphabet.indexOf(ch));
  const hex = n.toString(16);
  const bytes = Buffer.from(hex.length % 2 ? `0${hex}` : hex, "hex");
  if (bytes.length !== 25 || bytes[0] !== 0x41) return false;
  const hash = createHash("sha256").update(createHash("sha256").update(bytes.subarray(0, 21)).digest()).digest();
  return timingSafeEqual(bytes.subarray(21), hash.subarray(0, 4));
}

export function operatorAuthorized(req: Request): boolean {
  const expected = process.env.WALLET_ADMIN_SECRET;
  if (!expected || expected.length < 32) return false;
  const received = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const hash = (v: string) => createHash("sha256").update(v).digest();
  return timingSafeEqual(hash(received), hash(expected));
}
