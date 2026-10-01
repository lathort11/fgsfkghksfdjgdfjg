import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { sendApiKeyToTelegram } from "@/lib/telegram-key-delivery";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "AUTH" }, { status: 401 });
    }

    const result = await sendApiKeyToTelegram(user.id);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/tokens/send-telegram] error:", err);
    return NextResponse.json({ error: "SERVER_ERROR", sentToTelegram: false }, { status: 500 });
  }
}
