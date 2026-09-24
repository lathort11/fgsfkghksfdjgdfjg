/*
 * Telegram Mini App → LIVKAMARKET bot backend: IP verification client.
 *
 * The frontend decides nothing about the IP. It forwards the raw, signed
 * Telegram WebApp `initData` string and renders whatever the backend answers.
 * The backend validates the initData signature, reads the real client IP from
 * its trusted reverse proxy, runs the VPN / proxy / datacenter / uniqueness
 * checks, stores the IP, updates the status and qualifies referrals.
 *
 * Keep this module dependency-free: it is imported by the Mini App page and by
 * scripts/test-miniapp-verify.mjs (plain Node, type stripping).
 */

export const VERIFY_PATH = "/miniapp/api/verify-ip";
export const VERIFY_TIMEOUT_MS = 15_000;

export type VerifyState =
  | "verified"
  | "vpn"
  | "datacenter"
  | "duplicate"
  | "registration"
  | "session"
  | "bad_request"
  | "forbidden"
  | "rate_limited"
  | "unavailable"
  | "timeout"
  | "offline"
  | "error";

export type VerifyResult = {
  state: VerifyState;
  httpStatus: number | null;
  messageKey: string | null;
  backendStatus: string | null;
  /** Short technical code for support (e.g. "HTTP 404 · invalid_json"). */
  detail: string | null;
  /** IP as determined by the backend. Display only, never sent anywhere. */
  ip: string | null;
  referralQualified: boolean;
};

/* Only the keys / statuses documented for the backend contract. */
const BY_MESSAGE_KEY: Record<string, VerifyState> = {
  "ip.verified": "verified",
  "ip.vpn_detected": "vpn",
  "ip.datacenter": "datacenter",
  "ip.duplicate": "duplicate",
  "verification.required": "registration",
  "common.error": "error",
};

const BY_STATUS: Record<string, VerifyState> = {
  verified: "verified",
  vpn_detected: "vpn",
  datacenter: "datacenter",
  duplicate: "duplicate",
  error: "error",
};

function byHttpStatus(status: number): VerifyState | null {
  if (status === 400) return "bad_request";
  if (status === 401) return "session";
  if (status === 403) return "forbidden";
  if (status === 404) return "unavailable";
  if (status === 409) return "duplicate";
  if (status === 429) return "rate_limited";
  if (status === 502 || status === 503 || status === 504) return "unavailable";
  if (status >= 500) return "error";
  return null;
}

type JsonObject = Record<string, unknown>;

function parseObject(raw: string): { body: JsonObject | null; invalidJson: boolean } {
  if (raw.trim() === "") return { body: null, invalidJson: false };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { body: parsed as JsonObject, invalidJson: false };
    }
    return { body: null, invalidJson: true };
  } catch {
    return { body: null, invalidJson: true };
  }
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function result(state: VerifyState, partial: Partial<VerifyResult> = {}): VerifyResult {
  return {
    state,
    httpStatus: null,
    messageKey: null,
    backendStatus: null,
    detail: null,
    ip: null,
    referralQualified: false,
    ...partial,
  };
}

/**
 * Map an HTTP status + raw response text to a UI state.
 * Priority: success payload → specific message_key / status → HTTP status.
 * A generic "common.error" / "error" never hides a more specific HTTP status.
 */
export function classifyResponse(httpStatus: number, rawBody: string): VerifyResult {
  const { body, invalidJson } = parseObject(rawBody);
  const messageKey = str(body?.message_key);
  const backendStatus = str(body?.status);
  const is2xx = httpStatus >= 200 && httpStatus < 300;
  const code = `HTTP ${httpStatus}${invalidJson ? " · invalid_json" : ""}`;
  const base = { httpStatus, messageKey, backendStatus };

  const fromBody =
    (messageKey ? BY_MESSAGE_KEY[messageKey] : undefined) ??
    (backendStatus ? BY_STATUS[backendStatus] : undefined) ??
    null;

  if (body && body.ok === true) {
    if (is2xx && fromBody === "verified") {
      return result("verified", {
        ...base,
        ip: str(body.ip),
        referralQualified: body.referral_qualified === true,
      });
    }
    // ok:true without the documented success payload: never show a false success.
    return result("error", { ...base, detail: `${code} · unexpected_payload` });
  }

  if (fromBody && fromBody !== "verified" && fromBody !== "error") {
    return result(fromBody, { ...base, detail: code });
  }

  const fromHttp = byHttpStatus(httpStatus);
  if (fromHttp) return result(fromHttp, { ...base, detail: code });
  if (invalidJson) return result("unavailable", { ...base, detail: code });
  return result("error", { ...base, detail: code });
}

/** "" → same origin (reverse proxy routes /miniapp/api/* to the backend). */
export function buildVerifyUrl(backendBase: string): string {
  return `${backendBase.trim().replace(/\/+$/, "")}${VERIFY_PATH}`;
}

/**
 * Validate MINIAPP_BACKEND_URL. It is public (the browser calls it directly),
 * so it must never contain credentials. HTTPS is required because Telegram
 * serves Mini Apps over HTTPS and browsers block mixed content.
 */
export function normalizeBackendBase(raw: string | undefined): { base: string; error: string | null } {
  const value = (raw ?? "").trim();
  if (!value) return { base: "", error: null };

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { base: "", error: "MINIAPP_BACKEND_URL is not an absolute URL" };
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) {
    return { base: "", error: "MINIAPP_BACKEND_URL must use https://" };
  }
  if (url.username || url.password) {
    return { base: "", error: "MINIAPP_BACKEND_URL must not contain credentials" };
  }
  if (url.search || url.hash) {
    return { base: "", error: "MINIAPP_BACKEND_URL must not contain a query or hash" };
  }
  return { base: `${url.origin}${url.pathname.replace(/\/+$/, "")}`, error: null };
}

/**
 * POST { initData } to the backend. The body contains nothing else: no user
 * ID, no IP, no fields from initDataUnsafe. Cookies are not sent.
 */
export async function verifyIp(options: {
  url: string;
  initData: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  isOnline?: () => boolean;
}): Promise<VerifyResult> {
  const doFetch = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? VERIFY_TIMEOUT_MS);

  try {
    const response = await doFetch(options.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData: options.initData }),
      credentials: "omit",
      signal: controller.signal,
    });
    const text = await response.text();
    return classifyResponse(response.status, text);
  } catch {
    if (timedOut) return result("timeout", { detail: "timeout" });
    const online = options.isOnline ? options.isOnline() : true;
    if (!online) return result("offline", { detail: "offline" });
    return result("unavailable", { detail: "network" });
  } finally {
    clearTimeout(timer);
  }
}
