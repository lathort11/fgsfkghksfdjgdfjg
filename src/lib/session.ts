import { cookies } from "next/headers";
import { eq, and, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users, type User } from "@/db/schema";
import { newSessionToken } from "@/lib/auth";

export const SESSION_COOKIE = "lvk_session";
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

export type SafeUser = {
  id: string;
  customerId: string;
  email: string;
  name: string;
  role: "user" | "admin";
  status: "active" | "banned";
  createdAt: string;
  telegramId: string | null;
  telegramUsername: string | null;
  avatarUrl: string | null;
  hasPassword: boolean;
};

export function formatCustomerId(customerNo: number): string {
  return `LVK-${String(customerNo).padStart(6, "0")}`;
}

const safeColumns = {
  id: users.id,
  customerNo: users.customerNo,
  email: users.email,
  name: users.name,
  role: users.role,
  status: users.status,
  createdAt: users.createdAt,
  telegramId: users.telegramId,
  telegramUsername: users.telegramUsername,
  avatarUrl: users.avatarUrl,
  passwordHash: users.passwordHash,
};

type SafeRow = Pick<
  User,
  "id" | "customerNo" | "email" | "name" | "role" | "status" | "createdAt" | "telegramId" | "telegramUsername" | "avatarUrl" | "passwordHash"
>;

export function toSafeUser(row: SafeRow): SafeUser {
  return {
    id: row.id,
    customerId: formatCustomerId(row.customerNo),
    email: row.email,
    name: row.name,
    role: row.role,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    telegramId: row.telegramId,
    telegramUsername: row.telegramUsername,
    avatarUrl: row.avatarUrl,
    hasPassword: !!row.passwordHash,
  };
}

/**
 * @param opts.crossSite true inside the Telegram Mini App: Telegram Web runs
 * the app in an iframe, where only `SameSite=None; Secure` cookies are sent.
 */
export async function createSession(userId: string, opts: { crossSite?: boolean } = {}): Promise<string> {
  const [account] = await db.select({ status: users.status }).from(users).where(eq(users.id, userId)).limit(1);
  if (!account || account.status !== "active") throw new Error("ACCOUNT_BANNED");

  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + THIRTY_DAYS);
  await db.insert(sessions).values({ token, userId, expiresAt });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: opts.crossSite ? "none" : "lax",
    path: "/",
    expires: expiresAt,
    secure: opts.crossSite ? true : process.env.NODE_ENV === "production",
  });
  return token;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.token, token));
  jar.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<SafeUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const rows = await db
    .select(safeColumns)
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date()), eq(users.status, "active")))
    .limit(1);

  return rows[0] ? toSafeUser(rows[0]) : null;
}

export async function getUserById(id: string): Promise<SafeUser | null> {
  const rows = await db.select(safeColumns).from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ? toSafeUser(rows[0]) : null;
}

export type TelegramIdentity = {
  id: string;
  firstName: string;
  lastName?: string | null;
  username?: string | null;
  photoUrl?: string | null;
};

/** Find or create a site user bound to a Telegram ID. */
export async function upsertTelegramUser(tg: TelegramIdentity): Promise<SafeUser> {
  const fullName = [tg.firstName, tg.lastName].filter(Boolean).join(" ").trim();
  const fresh: { name?: string; telegramUsername?: string; avatarUrl?: string } = {};
  if (fullName) fresh.name = fullName.slice(0, 64);
  if (tg.username) fresh.telegramUsername = tg.username;
  if (tg.photoUrl) fresh.avatarUrl = tg.photoUrl;

  const existing = await db.select(safeColumns).from(users).where(eq(users.telegramId, tg.id)).limit(1);
  if (existing[0]) {
    if (Object.keys(fresh).length === 0) return toSafeUser(existing[0]);
    const [row] = await db.update(users).set(fresh).where(eq(users.id, existing[0].id)).returning();
    return toSafeUser(row);
  }

  const [row] = await db
    .insert(users)
    .values({
      email: `telegram_${tg.id}@livkamarket.app`,
      passwordHash: null,
      telegramId: tg.id,
      name: fresh.name ?? (tg.username || `tg${tg.id}`),
      telegramUsername: fresh.telegramUsername ?? null,
      avatarUrl: fresh.avatarUrl ?? null,
    })
    .onConflictDoUpdate({ target: users.email, set: { telegramId: tg.id, ...fresh } })
    .returning();
  return toSafeUser(row);
}
