/*
 * Telegram identity verification (server-only).
 *
 * Two sources are supported, in this order:
 *   1. Local HMAC check with TELEGRAM_BOT_TOKEN (fast, no network).
 *   2. Delegation to the bot Gateway `POST /api/auth/telegram/validate`
 *      (when the site must not hold the bot token).
 *
 * Login Widget: https://core.telegram.org/widgets/login#checking-authorization
 * Mini App:     https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { validateViaGateway } from "@/lib/bot-webhook";
import type { TelegramIdentity } from "@/lib/session";

const MAX_AGE_SEC = 24 * 60 * 60;

export type VerifyError = "NOT_CONFIGURED" | "BAD_SIGNATURE" | "EXPIRED" | "BAD_PAYLOAD";
type Verified = { ok: true; user: TelegramIdentity } | { ok: false; error: VerifyError };

function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

function fresh(authDate: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  return Number.isFinite(authDate) && authDate > 0 && now - authDate <= MAX_AGE_SEC && authDate - now < 300;
}

/* ═══════════ Login Widget ═══════════ */
const WIDGET_FIELDS = ["id", "first_name", "last_name", "username", "photo_url", "auth_date", "hash"] as const;

export async function verifyLoginWidget(raw: unknown): Promise<Verified> {
  if (!raw || typeof raw !== "object") return { ok: false, error: "BAD_PAYLOAD" };
  const src = raw as Record<string, unknown>;
  const data: Record<string, string> = {};
  for (const k of WIDGET_FIELDS) {
    const v = src[k];
    if (v !== undefined && v !== null && v !== "") data[k] = String(v);
  }
  if (!data.id || !data.hash || !data.auth_date || !/^\d+$/.test(data.id)) return { ok: false, error: "BAD_PAYLOAD" };
  if (!fresh(Number(data.auth_date))) return { ok: false, error: "EXPIRED" };

  const token = process.env.TELEGRAM_BOT_TOKEN;
  let valid: boolean | null;
  if (token) {
    const check = Object.keys(data)
      .filter((k) => k !== "hash")
      .sort()
      .map((k) => `${k}=${data[k]}`)
      .join("\n");
    const secret = createHash("sha256").update(token).digest();
    valid = safeEqualHex(createHmac("sha256", secret).update(check).digest("hex"), data.hash);
  } else {
    valid = await validateViaGateway({ type: "login_widget", payload: data });
  }
  if (valid === null) return { ok: false, error: "NOT_CONFIGURED" };
  if (!valid) return { ok: false, error: "BAD_SIGNATURE" };

  return {
    ok: true,
    user: {
      id: data.id,
      firstName: data.first_name ?? "",
      lastName: data.last_name ?? null,
      username: data.username ?? null,
      photoUrl: data.photo_url ?? null,
    },
  };
}

/* ═══════════ Mini App initData ═══════════ */
export async function verifyWebAppInitData(initData: unknown): Promise<Verified> {
  if (typeof initData !== "string" || initData.length === 0 || initData.length > 4096) {
    return { ok: false, error: "BAD_PAYLOAD" };
  }
  const params = new URLSearchParams(initData);
  const hash = params.get("hash") ?? "";
  const authDate = Number(params.get("auth_date"));
  const userJson = params.get("user");
  if (!hash || !userJson) return { ok: false, error: "BAD_PAYLOAD" };
  if (!fresh(authDate)) return { ok: false, error: "EXPIRED" };

  const token = process.env.TELEGRAM_BOT_TOKEN;
  let valid: boolean | null;
  if (token) {
    const check = [...params.entries()]
      .filter(([k]) => k !== "hash")
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join("\n");
    const secret = createHmac("sha256", "WebAppData").update(token).digest();
    valid = safeEqualHex(createHmac("sha256", secret).update(check).digest("hex"), hash);
  } else {
    valid = await validateViaGateway({ type: "webapp", initData });
  }
  if (valid === null) return { ok: false, error: "NOT_CONFIGURED" };
  if (!valid) return { ok: false, error: "BAD_SIGNATURE" };

  try {
    const u = JSON.parse(userJson) as {
      id?: number;
      first_name?: string;
      last_name?: string;
      username?: string;
      photo_url?: string;
    };
    if (typeof u.id !== "number") return { ok: false, error: "BAD_PAYLOAD" };
    return {
      ok: true,
      user: {
        id: String(u.id),
        firstName: u.first_name ?? "",
        lastName: u.last_name ?? null,
        username: u.username ?? null,
        photoUrl: u.photo_url ?? null,
      },
    };
  } catch {
    return { ok: false, error: "BAD_PAYLOAD" };
  }
}

export function httpStatusFor(error: VerifyError): number {
  if (error === "NOT_CONFIGURED") return 503;
  if (error === "BAD_PAYLOAD") return 400;
  return 401;
}
