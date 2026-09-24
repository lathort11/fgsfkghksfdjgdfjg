/*
 * Can the official Telegram Login Widget work on a given origin?
 *
 * Telegram renders "Bot domain invalid" inside its cross-origin iframe when
 * the page's domain is not the one linked to the bot (@BotFather → /setdomain).
 * The match is exact: neither the parent domain nor subdomains (www.*) pass.
 * The browser cannot read that iframe, so the server asks Telegram once per
 * origin and the site only renders the widget where sign-in can succeed.
 */
import "server-only";

const DEFAULT_BOT = "LivkaMarketbot";

/** Runtime bot username (no rebuild needed to switch to a test bot). */
export function telegramBotUsername(): string {
  const raw = (process.env.TELEGRAM_BOT_USERNAME || process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || DEFAULT_BOT)
    .trim()
    .replace(/^@/, "");
  return /^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(raw) ? raw : DEFAULT_BOT;
}

export type WidgetReason = "ok" | "domain" | "username" | "unreachable" | "busy";
export type WidgetStatus = { available: boolean; reason: WidgetReason };

const TTL: Record<WidgetReason, number> = {
  ok: 30 * 60_000,
  domain: 5 * 60_000, // re-check soon: the owner may be fixing /setdomain right now
  username: 5 * 60_000,
  unreachable: 60_000,
  busy: 0,
};

const cache = new Map<string, { at: number; status: WidgetStatus }>();
let windowStart = 0;
let windowCount = 0;
const MAX_UNCACHED_PER_MIN = 30;

export async function checkLoginWidget(bot: string, origin: string): Promise<WidgetStatus> {
  const key = `${bot.toLowerCase()}|${origin}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL[hit.status.reason]) return hit.status;

  const now = Date.now();
  if (now - windowStart > 60_000) {
    windowStart = now;
    windowCount = 0;
  }
  if (++windowCount > MAX_UNCACHED_PER_MIN) return { available: false, reason: "busy" };

  let status: WidgetStatus;
  try {
    const url = `https://oauth.telegram.org/embed/${encodeURIComponent(bot)}?origin=${encodeURIComponent(origin)}&size=large`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4_000), cache: "no-store" });
    const html = await res.text();
    if (/bot domain invalid/i.test(html)) status = { available: false, reason: "domain" };
    else if (/username invalid/i.test(html)) status = { available: false, reason: "username" };
    else if (res.ok) status = { available: true, reason: "ok" };
    else status = { available: true, reason: "unreachable" };
  } catch {
    // Telegram not reachable from the server: stay optimistic, the browser
    // may still load the widget (and hides the block if the script fails).
    status = { available: true, reason: "unreachable" };
  }

  if (cache.size > 200) cache.clear();
  cache.set(key, { at: Date.now(), status });
  return status;
}
