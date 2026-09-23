import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword, isEmail, normalizeEmail } from "@/lib/auth";
import { createSession } from "@/lib/session";

export async function POST(req: Request) {
  try {
    const { name, email, password } = (await req.json()) ?? {};
    const cleanName = typeof name === "string" ? name.trim() : "";
    const cleanEmail = typeof email === "string" ? normalizeEmail(email) : "";
    const cleanPass = typeof password === "string" ? password : "";

    if (cleanName.length < 2) {
      return NextResponse.json({ error: "NAME" }, { status: 400 });
    }
    if (!isEmail(cleanEmail)) {
      return NextResponse.json({ error: "EMAIL" }, { status: 400 });
    }
    if (cleanPass.length < 6) {
      return NextResponse.json({ error: "PASSWORD" }, { status: 400 });
    }

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, cleanEmail))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({ error: "EXISTS" }, { status: 409 });
    }

    const [user] = await db
      .insert(users)
      .values({ name: cleanName, email: cleanEmail, passwordHash: hashPassword(cleanPass) })
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        createdAt: users.createdAt,
      });

    await createSession(user.id);
    return NextResponse.json({
      ok: true,
      user: { ...user, createdAt: user.createdAt.toISOString() },
    });
  } catch {
    return NextResponse.json({ error: "SERVER" }, { status: 500 });
  }
}
