export const WALLET_RULES = {
  minDepositCents: 10_000,
  maxDepositCents: 5_000_000,
  minWithdrawalCents: 100_000,
  dailyWithdrawalCents: 5_000_000,
  withdrawalFeeBps: 500,
  minWithdrawalFeeCents: 10_000,
  withdrawalHoldHours: 24,
  maxBalanceCents: 100_000_000,
} as const;

export type WalletMode = "demo" | "live";
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
export function money(cents: number, decimals = false): string {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", minimumFractionDigits: decimals ? 2 : 0, maximumFractionDigits: 2 }).format(cents / 100);
}
export function parseMoney(value: string): number {
  const clean = value.replace(/\s/g, "").replace(",", ".");
  if (!/^\d{1,7}(\.\d{0,2})?$/.test(clean)) return 0;
  const [rub, kopecks = ""] = clean.split(".");
  return Number(rub) * 100 + Number(kopecks.padEnd(2, "0"));
}
export function emptyWallet(mode: WalletMode): WalletSnapshot {
  return { mode, balanceCents: 0, heldCents: 0, withdrawableCents: 0, depositedCents: 0, spentCents: 0, verification: "unverified", operations: [] };
}
