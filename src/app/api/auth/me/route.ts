import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser, toSafeUser } from "@/lib/session";
import { fetchBotProfile } from "@/lib/bot-webhook";
import { hashPassword, verifyPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  // Trial key, token usage and referrals live in the bot's database and are
  // fetched through its Gateway. `bot` is null when unavailable.
  const bot = user?.telegramId ? await fetchBotProfile(user.telegramId) : null;
  return NextResponse.json({ user, bot });
}

export async function PATCH(req: Request) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "AUTH" }, { status: 401 });

  try {
    const { name, currentPassword, newPassword } = (await req.json()) ?? {};
    const updates: { name?: string; passwordHash?: string } = {};

    if (typeof name === "string" && name.trim().length > 0) {
      const clean = name.trim();
      if (clean.length < 2) {
        return NextResponse.json({ error: "NAME" }, { status: 400 });
      }
      updates.name = clean;
    }

    if (typeof newPassword === "string" && newPassword.length > 0) {
      if (newPassword.length < 6) {
        return NextResponse.json({ error: "PASSWORD" }, { status: 400 });
      }
      const rows = await db
        .select({ passwordHash: users.passwordHash })
        .from(users)
        .where(eq(users.id, current.id))
        .limit(1);
      const stored = rows[0]?.passwordHash;
      // Telegram-only accounts have no password yet and may set one directly.
      if (stored && (typeof currentPassword !== "string" || currentPassword.length === 0)) {
        return NextResponse.json({ error: "NEED_CURRENT" }, { status: 400 });
      }
      if (stored && !verifyPassword(currentPassword, stored)) {
        return NextResponse.json({ error: "WRONG_PASSWORD" }, { status: 403 });
      }
      updates.passwordHash = hashPassword(newPassword);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "NOTHING_TO_UPDATE" }, { status: 400 });
    }

    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, current.id))
      .returning();

    return NextResponse.json({
      ok: true,
      user: toSafeUser(updated),
    });
  } catch {
    return NextResponse.json({ error: "SERVER" }, { status: 500 });
  }
}
