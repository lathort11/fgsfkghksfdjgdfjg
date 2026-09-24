import { NextResponse } from "next/server";
import { checkLoginWidget, telegramBotUsername } from "@/lib/telegram-widget";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/telegram/widget?origin=https://livkamarket.app
 * → { available, reason, bot }. `reason: "domain"` means Telegram would show
 * "Bot domain invalid" on that origin (fix: @BotFather → /setdomain).
 */
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("origin") ?? "";
  let origin: string;
  try {
    const u = new URL(raw);
    if ((u.protocol !== "https:" && u.protocol !== "http:") || raw.length > 200) throw new Error("bad");
    origin = u.origin;
  } catch {
    return NextResponse.json({ error: "BAD_ORIGIN" }, { status: 400 });
  }

  const bot = telegramBotUsername();
  const status = await checkLoginWidget(bot, origin);
  return NextResponse.json({ bot, ...status }, { headers: { "Cache-Control": "no-store" } });
}
