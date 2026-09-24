import { NextResponse } from "next/server";
import { createSession, upsertTelegramUser } from "@/lib/session";
import { httpStatusFor, verifyWebAppInitData } from "@/lib/telegram-auth";
import { fetchBotProfile } from "@/lib/bot-webhook";

export const dynamic = "force-dynamic";

/**
 * Mini App auto-login. Body: { initData } — the raw signed
 * `Telegram.WebApp.initData` string. Returns the site user and the bot
 * profile (trial key, tokens, referrals; null when the Gateway is down).
 */
export async function POST(req: Request) {
  let initData: unknown;
  try {
    initData = ((await req.json()) ?? {}).initData;
  } catch {
    return NextResponse.json({ error: "BAD_PAYLOAD" }, { status: 400 });
  }

  const res = await verifyWebAppInitData(initData);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: httpStatusFor(res.error) });

  try {
    const user = await upsertTelegramUser(res.user);
    // Telegram Web embeds the Mini App in an iframe → SameSite=None cookie.
    await createSession(user.id, { crossSite: true });
    const bot = await fetchBotProfile(res.user.id);
    return NextResponse.json({ ok: true, user, bot });
  } catch (e) {
    console.error("[auth/telegram/webapp] ", e);
    return NextResponse.json({ error: "SERVER" }, { status: 500 });
  }
}
