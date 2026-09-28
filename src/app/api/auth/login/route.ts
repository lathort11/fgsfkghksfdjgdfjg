import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyPassword, normalizeEmail } from "@/lib/auth";
import { createSession, toSafeUser } from "@/lib/session";
import { rateLimit, WalletError } from "@/lib/wallet-security";

export async function POST(req: Request) {
  try {
    const { email, password } = (await req.json()) ?? {};
    const cleanEmail = typeof email === "string" ? normalizeEmail(email) : "";
    const cleanPass = typeof password === "string" ? password : "";
    if (!cleanEmail || !cleanPass) return NextResponse.json({ error: "CREDS" }, { status: 400 });

    // Hash the identifier so rate-limit storage does not duplicate the e-mail.
    const loginKey = createHash("sha256").update(cleanEmail).digest("hex").slice(0, 24);
    await rateLimit(`login:${loginKey}`, 10, 900);

    const [user] = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);
    if (!user || !user.passwordHash || !verifyPassword(cleanPass, user.passwordHash)) {
      return NextResponse.json({ error: "CREDS" }, { status: 401 });
    }
    if (user.status !== "active") return NextResponse.json({ error: "ACCOUNT_BANNED" }, { status: 403 });

    await createSession(user.id);
    return NextResponse.json({ ok: true, user: toSafeUser(user) });
  } catch (error) {
    if (error instanceof WalletError && error.code === "RATE_LIMIT") {
      return NextResponse.json({ error: "RATE_LIMIT" }, { status: 429 });
    }
    return NextResponse.json({ error: "SERVER" }, { status: 500 });
  }
}
