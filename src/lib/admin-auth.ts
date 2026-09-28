import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { adminAudit, users, walletRateLimits } from "@/db/schema";
import { verifyPassword } from "@/lib/auth";
import { getCurrentUser, type SafeUser } from "@/lib/session";
import { checkOrigin, rateLimit, walletFailure } from "@/lib/wallet-security";

export class AdminError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}

export function adminEnsure(condition: unknown, code: string, status = 400): asserts condition {
  if (!condition) throw new AdminError(code, status);
}

export async function requireAdmin(req: Request, write = false): Promise<SafeUser> {
  if (write) checkOrigin(req);
  const user = await getCurrentUser();
  if (!user) throw new AdminError("AUTH", 401);
  await rateLimit(`admin:${user.id}`, write ? 40 : 120, 60);
  if (user.role !== "admin") {
    await db.insert(adminAudit).values({
      actorUserId: user.id,
      targetUserId: user.id,
      action: "authorization.denied",
      details: { method: req.method, path: new URL(req.url).pathname },
    }).catch(() => undefined);
    throw new AdminError("FORBIDDEN", 403);
  }
  return user;
}

const CONFIRM_MAX_FAILURES = 5;
const CONFIRM_WINDOW_SECONDS = 900;

/**
 * Step-up re-authentication for every privileged write. Only failed attempts
 * count toward the lockout, so routine work (e.g. repricing the whole catalog)
 * is not throttled, while password guessing stops after 5 misses per 15 minutes.
 */
export async function confirmAdminPassword(admin: SafeUser, value: unknown): Promise<void> {
  const key = `admin-confirm-fail:${admin.id}`;
  const [lock] = await db.select().from(walletRateLimits).where(eq(walletRateLimits.key, key)).limit(1);
  const locked = !!lock && lock.hits >= CONFIRM_MAX_FAILURES && lock.windowAt.getTime() > Date.now() - CONFIRM_WINDOW_SECONDS * 1000;
  if (locked) throw new AdminError("ADMIN_CONFIRM_LOCKED", 429);
  if (typeof value !== "string" || value.length < 1 || value.length > 256) throw new AdminError("ADMIN_PASSWORD_REQUIRED", 403);

  const [row] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, admin.id)).limit(1);
  if (!row?.passwordHash || !verifyPassword(value, row.passwordHash)) {
    await rateLimit(key, CONFIRM_MAX_FAILURES, CONFIRM_WINDOW_SECONDS).catch(() => undefined);
    throw new AdminError("ADMIN_PASSWORD_WRONG", 403);
  }
  if (lock) await db.delete(walletRateLimits).where(eq(walletRateLimits.key, key));
}

export function adminFailure(error: unknown): Response {
  if (error instanceof AdminError) return Response.json({ error: error.code }, { status: error.status });
  return walletFailure(error);
}
