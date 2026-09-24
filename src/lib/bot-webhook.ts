/*
 * Server-only client for the LIVKAMARKET bot Gateway (api.livkamarket.app).
 *
 * Every call is authenticated with the shared `X-Internal-Secret` header and
 * has a short timeout. Failures never throw into the caller: a Gateway outage
 * must not break payments or sign-in on the site, it only logs.
 *
 * Env:
 *   BOT_GATEWAY_URL      e.g. https://api.livkamarket.app   (no trailing slash)
 *   BOT_INTERNAL_SECRET  shared secret, same value as in the bot's .env
 */
import "server-only";

const TIMEOUT_MS = 6_000;

export const GATEWAY_PATHS = {
  orderPaid: "/api/internal/order-paid",
  validateTelegram: "/api/auth/telegram/validate",
  userProfile: (telegramId: string) => `/api/internal/users/${encodeURIComponent(telegramId)}/profile`,
} as const;

function gatewayBase(): string | null {
  const raw = (process.env.BOT_GATEWAY_URL ?? "").trim().replace(/\/+$/, "");
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(u.hostname) && !u.hostname.endsWith(".internal") && u.hostname.includes(".")) {
      console.error("[bot-gateway] BOT_GATEWAY_URL must be https://");
      return null;
    }
    return raw;
  } catch {
    console.error("[bot-gateway] BOT_GATEWAY_URL is not a valid URL");
    return null;
  }
}

export function isGatewayConfigured(): boolean {
  return gatewayBase() !== null && !!process.env.BOT_INTERNAL_SECRET;
}

async function gatewayFetch(path: string, init: { method: "GET" | "POST"; body?: unknown }) {
  const base = gatewayBase();
  const secret = process.env.BOT_INTERNAL_SECRET;
  if (!base || !secret) return null;
  try {
    const res = await fetch(`${base}${path}`, {
      method: init.method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Internal-Secret": secret,
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      /* empty or non-JSON body */
    }
    return { ok: res.ok, status: res.status, json: json as Record<string, unknown> | null };
  } catch (e) {
    console.error(`[bot-gateway] ${init.method} ${path} failed:`, e instanceof Error ? e.message : e);
    return null;
  }
}

/* ═══════════ ORDER PAID → deliver receipt + credentials into the chat ═══════════ */
export type OrderPaidPayload = {
  telegramId: string;
  orderNo: number;
  orderSecret: string;
  productSlug: string;
  productTitle: string;
  kind: string;
  totalCents: number;
  network: string;
  asset: string;
  amountCrypto: string;
  txHash: string;
  credentials: string;
  paidAt: string;
};

export async function notifyBotOrderPaid(payload: OrderPaidPayload): Promise<boolean> {
  const res = await gatewayFetch(GATEWAY_PATHS.orderPaid, { method: "POST", body: payload });
  if (!res) return false;
  if (!res.ok) {
    console.error(`[bot-gateway] order-paid #${payload.orderNo} → HTTP ${res.status}`);
    return false;
  }
  return true;
}

/* ═══════════ Telegram signature validation delegated to the bot ═══════════ */
export async function validateViaGateway(
  body: { type: "login_widget"; payload: Record<string, string> } | { type: "webapp"; initData: string }
): Promise<boolean | null> {
  const res = await gatewayFetch(GATEWAY_PATHS.validateTelegram, { method: "POST", body });
  if (!res) return null; // gateway not configured / unreachable
  return res.ok && (res.json?.valid === true || res.json?.ok === true);
}

/* ═══════════ Trial / tokens / referrals profile (bot database) ═══════════ */
export type BotProfile = {
  ipVerified: boolean;
  trialActive: boolean;
  trialKey: string | null;
  tokensUsed: number;
  tokensLimit: number;
  referralsConfirmed: number;
  referralsRequired: number;
};

const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);

export async function fetchBotProfile(telegramId: string): Promise<BotProfile | null> {
  const res = await gatewayFetch(GATEWAY_PATHS.userProfile(telegramId), { method: "GET" });
  if (!res?.ok || !res.json) return null;
  const j = res.json;
  return {
    ipVerified: j.ip_verified === true || j.ipVerified === true || j.status === "verified",
    trialActive: j.trial_active === true || j.trialActive === true,
    trialKey: typeof (j.trial_key ?? j.trialKey) === "string" ? String(j.trial_key ?? j.trialKey) : null,
    tokensUsed: num(j.tokens_used ?? j.tokensUsed),
    tokensLimit: num(j.tokens_limit ?? j.tokensLimit, 1_000_000),
    referralsConfirmed: num(j.referrals_confirmed ?? j.referralsConfirmed),
    referralsRequired: num(j.referrals_required ?? j.referralsRequired, 5),
  };
}
