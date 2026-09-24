import { NextResponse } from "next/server";
import { createSession, upsertTelegramUser } from "@/lib/session";
import { httpStatusFor, verifyLoginWidget } from "@/lib/telegram-auth";

export const dynamic = "force-dynamic";

/**
 * Telegram Login Widget callback.
 * Body: { id, first_name, last_name?, username?, photo_url?, auth_date, hash }
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "BAD_PAYLOAD" }, { status: 400 });
  }

  const res = await verifyLoginWidget(body);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: httpStatusFor(res.error) });

  try {
    const user = await upsertTelegramUser(res.user);
    await createSession(user.id);
    return NextResponse.json({ ok: true, user });
  } catch (e) {
    console.error("[auth/telegram] ", e);
    return NextResponse.json({ error: "SERVER" }, { status: 500 });
  }
}
