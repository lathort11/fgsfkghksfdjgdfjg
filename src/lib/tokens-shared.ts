/* Client-safe Claude API pricing. Token counts and money use integers. */

export const TOKEN_PRODUCT_SLUG = "claude-api";
export const MILLION = 1_000_000;
/** Default $0.30 / 1M used to seed a fresh model. The live rate is stored in
 *  `site_token_models` and can be changed by an admin, so always prefer the
 *  rate carried on the snapshot (`pricePerMillionCents`). */
export const TOKEN_PRICE_PER_MILLION_CENTS = 30;
/** Guardrails for the admin-editable per-million rate (in US cents). */
export const TOKEN_RATE_MIN_CENTS = 1;
export const TOKEN_RATE_MAX_CENTS = 100_000;
export const TOKEN_MIN_PURCHASE = 10 * MILLION;
export const TOKEN_BANK_INITIAL = 400 * MILLION;
/** Maximum tokens one customer can hold on any one model. */
export const TOKEN_BALANCE_CAP = 400 * MILLION;
export const TOKEN_STEP = MILLION;
export const TOKEN_PRESETS = [10, 25, 50, 100, 200, 400];

export type TokenModel = {
  slug: string;
  label: string;
  isActive: boolean;
};
/** Legacy balances may have separate input/output credits; both count toward the unified balance. */
export type TokenBalance = { modelSlug: string; inputTokens: number; outputTokens: number };
export type TokenSnapshot = {
  apiKey: string | null;
  models: TokenModel[];
  balances: TokenBalance[];
  balanceCents: number;
  cap: number;
  /** Real shared inventory; null until the API has responded. */
  bankAvailableTokens: number | null;
  pricePerMillionCents: number;
};

/** The same price is recomputed on the server; fractional cents are rounded up.
 *  The rate is the live per-million price for the product (admin-editable). */
export function tokenCostCents(tokens: number, rateCents: number = TOKEN_PRICE_PER_MILLION_CENTS): number {
  return Math.ceil((tokens * rateCents) / MILLION);
}

/** Exact integer amount affordable at the given rate, capped by available inventory. */
export function affordableTokens(cents: number, cap: number, rateCents: number = TOKEN_PRICE_PER_MILLION_CENTS): number {
  const rate = rateCents > 0 ? rateCents : TOKEN_PRICE_PER_MILLION_CENTS;
  return Math.max(0, Math.min(cap, Math.floor((Math.max(0, cents) * MILLION) / rate)));
}

export function isTokenProduct(product: { kind: string }): boolean {
  return product.kind === "tokens";
}

export function emptyTokenSnapshot(): TokenSnapshot {
  return {
    apiKey: null, models: [], balances: [], balanceCents: 0, cap: TOKEN_BALANCE_CAP,
    bankAvailableTokens: null, pricePerMillionCents: TOKEN_PRICE_PER_MILLION_CENTS,
  };
}

export function balanceOf(snapshot: TokenSnapshot, modelSlug: string): TokenBalance {
  return snapshot.balances.find((b) => b.modelSlug === modelSlug) ?? { modelSlug, inputTokens: 0, outputTokens: 0 };
}

/** "400M", "12.5M", "750K", "9 000". */
export function formatTokens(tokens: number, locale = "en-US"): string {
  if (tokens >= MILLION) {
    const millions = tokens / MILLION;
    return `${millions.toLocaleString(locale, { maximumFractionDigits: Number.isInteger(millions) ? 0 : 2 })}M`;
  }
  if (tokens >= 1_000) {
    const thousands = tokens / 1_000;
    return `${thousands.toLocaleString(locale, { maximumFractionDigits: Number.isInteger(thousands) ? 0 : 1 })}K`;
  }
  return tokens.toLocaleString(locale);
}

/** Compact bank inventory label; truncate rather than rounding stock upwards. */
export function formatBankTokens(tokens: number | null, locale: "ru" | "en" | "zh"): string {
  if (tokens === null) return "—";
  if (tokens < MILLION) {
    return `${tokens.toLocaleString(locale === "ru" ? "ru-RU" : locale === "zh" ? "zh-CN" : "en-US")} ${locale === "ru" ? "токенов" : locale === "zh" ? "代币" : "tokens"}`;
  }
  if (locale === "zh") return `${(Math.floor(tokens / 100_000) / 1_000).toLocaleString("zh-CN", { maximumFractionDigits: 3 })}亿`;
  const millions = Math.floor(tokens / 10_000) / 100;
  return locale === "ru"
    ? `${millions.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} млн`
    : `${millions.toLocaleString("en-US", { maximumFractionDigits: 2 })}M`;
}

/** Parses "12 500 000", "12.5M", "400m" into a token count. */
export function parseTokens(value: string): number {
  const clean = value.trim().toLowerCase().replace(/[\s,\u00a0]/g, "");
  const match = /^(\d+(?:\.\d+)?)(m|k)?$/.exec(clean);
  if (!match) return 0;
  const amount = Number(match[1]) * (match[2] === "m" ? MILLION : match[2] === "k" ? 1_000 : 1);
  if (!Number.isSafeInteger(amount) || amount < 0) return 0;
  return amount;
}
