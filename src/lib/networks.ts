/* Client-safe: crypto network catalogue (no DB imports). */

export type Network = {
  id: string;
  asset: string;
  net: string;
  coingecko: string;
  decimals: number;
  address: string;
  fee: string;
};

export const NETWORKS: Network[] = [
  {
    id: "usdt-trc20",
    asset: "USDT",
    net: "TRC-20",
    coingecko: "tether",
    decimals: 2,
    address: process.env.CRYPTO_USDT_TRC20 ?? "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE",
    fee: "~1 USDT",
  },
  {
    id: "ton",
    asset: "TON",
    net: "TON",
    coingecko: "the-open-network",
    decimals: 3,
    address: process.env.CRYPTO_TON ?? "UQD5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f",
    fee: "~0.05 TON",
  },
  {
    id: "btc",
    asset: "BTC",
    net: "Bitcoin",
    coingecko: "bitcoin",
    decimals: 6,
    address: process.env.CRYPTO_BTC ?? "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
    fee: "~0.0001 BTC",
  },
  {
    id: "eth",
    asset: "ETH",
    net: "ERC-20",
    coingecko: "ethereum",
    decimals: 5,
    address: process.env.CRYPTO_ETH ?? "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
    fee: "~0.0004 ETH",
  },
];

export function getNetwork(id: string): Network | null {
  return NETWORKS.find((n) => n.id === id) ?? null;
}

export function promoDiscount(code: string): number {
  const p = code.trim().toUpperCase();
  if (p === "LIVKA15") return 0.15;
  if (p === "GEMINI10") return 0.1;
  if (p === "NEURAL5") return 0.05;
  return 0;
}
