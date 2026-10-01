import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users, tokenAccounts, tokenBalances, tokenModels } from "@/db/schema";

export type TelegramDeliveryResult = {
  ok: boolean;
  error?: string;
  sentToTelegram: boolean;
  username?: string | null;
  telegramId?: string | null;
};

/**
 * Finds the Telegram ID for a site user:
 * 1. From site_users.telegram_id if already linked.
 * 2. Or looks up the bot's `users` table in PostgreSQL by matching username.
 */
export async function findTelegramUser(userId: string): Promise<{ telegramId: string | null; username: string | null }> {
  try {
    const [siteUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!siteUser) return { telegramId: null, username: null };

    if (siteUser.telegramId) {
      return { telegramId: siteUser.telegramId, username: siteUser.telegramUsername ?? null };
    }

    // Try finding the user in the bot's users table
    const candidates = [siteUser.telegramUsername, siteUser.name]
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0 && !s.includes(" "));

    for (const cand of candidates) {
      const clean = cand.replace(/^@/, "").trim().toLowerCase();
      if (!clean) continue;
      const res = await db.execute(sql`SELECT id, username FROM users WHERE lower(username) = lower(${clean}) LIMIT 1`);
      if (res.rows && res.rows.length > 0) {
        const row = res.rows[0] as { id: string | number; username?: string | null };
        const tgId = String(row.id);
        const tgUsername = row.username ? String(row.username) : clean;
        await db.update(users).set({ telegramId: tgId, telegramUsername: tgUsername }).where(eq(users.id, userId));
        return { telegramId: tgId, username: tgUsername };
      }
    }

    return { telegramId: null, username: null };
  } catch (e) {
    console.error("[telegram-delivery] findTelegramUser error:", e instanceof Error ? e.message : e);
    return { telegramId: null, username: null };
  }
}

/**
 * Sends a notification with the API key, Base URL and connection guide to the user in Telegram.
 */
export async function sendApiKeyToTelegram(userId: string): Promise<TelegramDeliveryResult> {
  const [account] = await db.select({ apiKey: tokenAccounts.apiKey }).from(tokenAccounts).where(eq(tokenAccounts.userId, userId)).limit(1);
  if (!account?.apiKey) {
    return { ok: false, error: "NO_API_KEY", sentToTelegram: false };
  }

  const tg = await findTelegramUser(userId);
  if (!tg.telegramId) {
    return { ok: false, error: "TELEGRAM_NOT_LINKED", sentToTelegram: false };
  }

  const balances = await db.select().from(tokenBalances).where(eq(tokenBalances.userId, userId));
  const totalTokens = balances.reduce((sum, b) => sum + (b.outputTokens ?? 0) + (b.inputTokens ?? 0), 0);

  const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
  if (!botToken) {
    console.error("[telegram-delivery] BOT_TOKEN not configured");
    return { ok: false, error: "BOT_NOT_CONFIGURED", sentToTelegram: false };
  }

  const text = [
    `🔑 <b>Ваш API-ключ Claude Opus 5.5</b>`,
    ``,
    `Поздравляем! Ваш персональный доступ к API готов к работе.`,
    ``,
    `⚡ <b>Персональный API-ключ:</b>`,
    `<code>${account.apiKey}</code>`,
    ``,
    `🌐 <b>Base URL (Эндпоинт):</b>`,
    `<code>https://api.livkamarket.app/v1</code>`,
    ``,
    `🧠 <b>Модель:</b> <code>claude-opus-5-5</code>`,
    `📊 <b>Баланс токенов:</b> <b>${totalTokens.toLocaleString("ru-RU")}</b> токенов`,
    ``,
    `🛠 <b>Быстрый старт:</b>`,
    `• <b>Cursor / Windsurf:</b> Settings → Models → Anthropic Override: укажите Base URL и API Key.`,
    `• <b>Claude Code CLI:</b>`,
    `<code>export ANTHROPIC_BASE_URL="https://api.livkamarket.app"`,
    `export ANTHROPIC_API_KEY="${account.apiKey}"</code>`,
    `• <b>Python:</b>`,
    `<code>client = anthropic.Anthropic(api_key="${account.apiKey}", base_url="https://api.livkamarket.app")</code>`,
    ``,
    `Управлять ключом, токенами и историей можно в личном кабинете на сайте:`,
    `👉 <a href="https://livkamarket.app?section=key">https://livkamarket.app?section=key</a>`,
  ].join("\n");

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: tg.telegramId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(8000),
    });

    const data = await res.json() as { ok?: boolean; description?: string };
    if (!res.ok || !data.ok) {
      console.warn(`[telegram-delivery] Telegram API failed for user ${tg.telegramId}: ${data.description}`);
      return { ok: false, error: data.description ?? "TELEGRAM_FAILED", sentToTelegram: false, username: tg.username, telegramId: tg.telegramId };
    }

    return { ok: true, sentToTelegram: true, username: tg.username, telegramId: tg.telegramId };
  } catch (err) {
    console.error("[telegram-delivery] sendMessage error:", err instanceof Error ? err.message : err);
    return { ok: false, error: "NETWORK_ERROR", sentToTelegram: false, username: tg.username, telegramId: tg.telegramId };
  }
}
