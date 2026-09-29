/* Client-safe wallet constants and helpers. All money is integer US cents. */
export const CURRENCY = "USD" as const;

export const WALLET_RULES = {
  minDepositCents: 500, // $5
  maxDepositCents: 50_000, // $500 per top-up
  minWithdrawalCents: 1_000, // $10
  dailyWithdrawalCents: 50_000, // $500 per 24h
  withdrawalFeeBps: 500, // 5%
  minWithdrawalFeeCents: 100, // $1
  withdrawalHoldHours: 24,
  maxBalanceCents: 1_000_000, // $10,000
} as const;

/** The wallet runs in a single real-money mode. */
export type WalletMode = "live";
export type OperationKind = "deposit" | "purchase" | "withdrawal" | "adjustment";
export type OperationStatus = "pending" | "processing" | "completed" | "cancelled" | "rejected" | "expired";
export type WalletOperation = {
  id: string;
  kind: OperationKind;
  status: OperationStatus;
  amountCents: number;
  feeCents: number;
  description: string;
  method: string;
  address: string | null;
  paymentUrl: string | null;
  orderId: string | null;
  productSlug: string | null;
  reference: string | null;
  createdAt: string;
  completedAt: string | null;
};
export type WalletSnapshot = {
  mode: WalletMode;
  balanceCents: number;
  heldCents: number;
  withdrawableCents: number;
  depositedCents: number;
  spentCents: number;
  verification: string;
  operations: WalletOperation[];
};

export function withdrawalFee(amountCents: number): number {
  return Math.max(WALLET_RULES.minWithdrawalFeeCents, Math.ceil(amountCents * WALLET_RULES.withdrawalFeeBps / 10_000));
}

/** "$55", "$5.50", "$1,234.00" — same US-dollar format in every language. */
export function money(cents: number, decimals = false): string {
  const whole = Number.isInteger(cents / 100);
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: CURRENCY,
    minimumFractionDigits: decimals || !whole ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** Parses "12", "12.5", "12,50" into cents. Returns 0 for anything invalid. */
export function parseMoney(value: string): number {
  const clean = value.replace(/\s/g, "").replace(",", ".");
  if (!/^\d{1,6}(\.\d{0,2})?$/.test(clean)) return 0;
  const [dollars, cents = ""] = clean.split(".");
  return Number(dollars) * 100 + Number(cents.padEnd(2, "0"));
}

export function emptyWallet(mode: WalletMode = "live"): WalletSnapshot {
  return { mode, balanceCents: 0, heldCents: 0, withdrawableCents: 0, depositedCents: 0, spentCents: 0, verification: "unverified", operations: [] };
}
