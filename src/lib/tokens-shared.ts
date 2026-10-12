/* Client-safe Claude API pricing. Token counts and money use integers. */

export const TOKEN_PRODUCT_SLUG = "claude-api";
export const MILLION = 1_000_000;
export const TOKEN_PRICE_PER_MILLION_CENTS = 30; // base retail rate: $0.30 / 1M
export const TOKEN_MIN_PURCHASE = 5 * MILLION;
export const TOKEN_BANK_INITIAL = 400 * MILLION;
/** Maximum tokens one customer can hold on any one model. */
export const TOKEN_BALANCE_CAP = 400 * MILLION;
export const TOKEN_STEP = MILLION;
export const TOKEN_PRESETS = [5, 10, 25, 50, 100, 200];

export type TokenTier = {
  id: "retail" | "standard" | "wholesale";
  label: string;
  name: string;
  minTokens: number;
  maxTokens: number | null;
  ratePerMillionCents: number;
  discountPercent: number;
  badge?: string;
  isPopular?: boolean;
};

export const TOKEN_TIERS: TokenTier[] = [
  {
    id: "retail",
    label: "Start",
    name: "Retail",
    minTokens: 5 * MILLION,
    maxTokens: 10 * MILLION,
    ratePerMillionCents: 30, // $0.30 / 1M
    discountPercent: 0,
  },
  {
    id: "standard",
    label: "Standard",
    name: "Dev",
    minTokens: 10 * MILLION,
    maxTokens: 50 * MILLION,
    ratePerMillionCents: 20, // $0.20 / 1M
    discountPercent: 33,
    isPopular: true,
  },
  {
    id: "wholesale",
    label: "Bulk / Pro",
    name: "Bulk",
    minTokens: 50 * MILLION,
    maxTokens: null,
    ratePerMillionCents: 10, // $0.10 / 1M
    discountPercent: 67,
    badge: "🔥 67% OFF",
  },
];

export function getTierForTokens(tokens: number): TokenTier {
  if (tokens >= 50 * MILLION) return TOKEN_TIERS[2];
  if (tokens >= 10 * MILLION) return TOKEN_TIERS[1];
  return TOKEN_TIERS[0];
}

export function getRateForTokens(tokens: number): number {
  return getTierForTokens(tokens).ratePerMillionCents;
}

export type TokenModel = {
  slug: string;
  label: string;
  isActive: boolean;
};
/** Legacy balances may have separate input/output credits; both count toward the unified balance. */
export type TokenBalance = { modelSlug: string; inputTokens: number; outputTokens: number };
export type TokenDiscount = {
  id: string;
  title: string;
  reason: string;
  originalPriceCents: number;
  discountPriceCents: number;
  percentOff: number;
  badge: string;
  isActive: boolean;
};

export type TokenSnapshot = {
  apiKey: string | null;
  models: TokenModel[];
  balances: TokenBalance[];
  balanceCents: number;
  cap: number;
  /** Real shared inventory; null until the API has responded. */
  bankAvailableTokens: number | null;
  pricePerMillionCents: number;
  discount?: TokenDiscount | null;
  tiers: TokenTier[];
};

/** Recomputed on the server; rate depends on purchase volume. */
export function tokenCostCents(tokens: number, ratePerMillionCents?: number): number {
  const rate = ratePerMillionCents ?? getRateForTokens(tokens);
  return Math.ceil((tokens * rate) / MILLION);
}

/** Exact integer amount affordable at the tiered rates, capped by available inventory. */
export function affordableTokens(cents: number, cap: number, _overrideRate?: number): number {
  if (cents <= 0) return 0;
  if (_overrideRate) {
    return Math.max(0, Math.min(cap, Math.floor((cents * MILLION) / _overrideRate)));
  }
  // If user has >= $5 (500 cents), wholesale rate is 10 cents/1M
  if (cents >= 500) {
    return Math.max(0, Math.min(cap, Math.floor((cents * MILLION) / 10)));
  }
  // If user has >= $2 (200 cents), standard rate is 20 cents/1M
  if (cents >= 200) {
    return Math.max(0, Math.min(cap, Math.floor((cents * MILLION) / 20)));
  }
  // Otherwise retail rate 30 cents/1M
  return Math.max(0, Math.min(cap, Math.floor((cents * MILLION) / 30)));
}

export function isTokenProduct(product: { kind: string }): boolean {
  return product.kind === "tokens";
}

export function emptyTokenSnapshot(): TokenSnapshot {
  return {
    apiKey: null, models: [], balances: [], balanceCents: 0, cap: TOKEN_BALANCE_CAP,
    bankAvailableTokens: null, pricePerMillionCents: TOKEN_PRICE_PER_MILLION_CENTS,
    discount: null,
    tiers: TOKEN_TIERS,
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
