import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyPassword, normalizeEmail } from "@/lib/auth";
import { createSession, toSafeUser } from "@/lib/session";

export async function POST(req: Request) {
  try {
    const { email, password } = (await req.json()) ?? {};
    const cleanEmail = typeof email === "string" ? normalizeEmail(email) : "";
    const cleanPass = typeof password === "string" ? password : "";

    if (!cleanEmail || !cleanPass) {
      return NextResponse.json({ error: "CREDS" }, { status: 400 });
    }

    const rows = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);
    const user = rows[0];
    if (!user || !user.passwordHash || !verifyPassword(cleanPass, user.passwordHash)) {
      return NextResponse.json({ error: "CREDS" }, { status: 401 });
    }

    await createSession(user.id);
    return NextResponse.json({
      ok: true,
      user: toSafeUser(user),
    });
  } catch {
    return NextResponse.json({ error: "SERVER" }, { status: 500 });
  }
}
