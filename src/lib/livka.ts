import { db } from "@/db";
import { products, orders } from "@/db/schema";
import { eq, sql, desc, and } from "drizzle-orm";
import { NETWORKS, getNetwork, promoDiscount, type Network } from "@/lib/networks";

export { NETWORKS, getNetwork, promoDiscount };

/* ═══════════ RATES ═══════════ */
type Rates = { rubPerUsd: number; priceRub: Record<string, number> };

const FALLBACK: Rates = {
  rubPerUsd: 92,
  priceRub: { tether: 92, "the-open-network": 500, bitcoin: 8_800_000, ethereum: 310_000 },
};

let rateCache: { at: number; rates: Rates } | null = null;

export async function getRates(): Promise<Rates> {
  if (rateCache && Date.now() - rateCache.at < 5 * 60_000) return rateCache.rates;
  try {
    const ids = NETWORKS.map((n) => n.coingecko).join(",");
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=rub,usd`,
      { signal: AbortSignal.timeout(3500), cache: "no-store" }
    );
    if (!res.ok) throw new Error("bad status");
    const data = (await res.json()) as Record<string, { rub: number; usd: number }>;
    const priceRub: Record<string, number> = {};
    let rubPerUsd = FALLBACK.rubPerUsd;
    for (const n of NETWORKS) {
      const row = data[n.coingecko];
      if (row?.rub && row.rub > 0) priceRub[n.coingecko] = row.rub;
      // 1 USDT ≈ 1 USD, so its RUB price is the RUB-per-USD rate
      if (n.coingecko === "tether" && row?.rub) rubPerUsd = row.rub;
    }
    const rates: Rates = {
      rubPerUsd: rubPerUsd || FALLBACK.rubPerUsd,
      priceRub: Object.keys(priceRub).length ? priceRub : FALLBACK.priceRub,
    };
    rateCache = { at: Date.now(), rates };
    return rates;
  } catch {
    rateCache = { at: Date.now(), rates: FALLBACK };
    return FALLBACK;
  }
}

export function quoteCrypto(totalCents: number, network: Network, rates: Rates) {
  const rub = totalCents / 100;
  const priceRub = rates.priceRub[network.coingecko] ?? FALLBACK.priceRub[network.coingecko] ?? 1;
  const raw = rub / priceRub;
  const amountCrypto = raw.toFixed(network.decimals);
  return {
    amountCrypto,
    usd: rub / rates.rubPerUsd,
    rateLabel: `1 ${network.asset} ≈ ${Math.round(priceRub).toLocaleString("ru-RU")} ₽`,
  };
}

/* ═══════════ SEED ═══════════ */
// Missing slugs are inserted on boot; existing rows (admin prices, visibility) are never overwritten.
const SEED: (typeof products.$inferInsert)[] = [
  {
    slug: "gemini-pro-18",
    priceCents: 499_000,
    per: "once",
    accent: "#5b8cff",
    icon: "gemini",
    kind: "account",
    stock: 12,
    soldCount: 1840,
    isFeatured: true,
    sortOrder: 1,
  },
  {
    slug: "antigravity-api",
    priceCents: 199_000,
    per: "monthly",
    accent: "#a164ff",
    icon: "gemini",
    kind: "api",
    stock: 40,
    soldCount: 2120,
    isFeatured: false,
    sortOrder: 2,
  },
  {
    slug: "chatgpt-pro",
    priceCents: 399_000,
    per: "monthly",
    accent: "#2fe6a7",
    icon: "chatgpt",
    kind: "account",
    stock: 23,
    soldCount: 2670,
    isFeatured: false,
    sortOrder: 3,
  },
  {
    slug: "supergrok",
    priceCents: 249_000,
    per: "monthly",
    accent: "#9be7ff",
    icon: "grok",
    kind: "account",
    stock: 17,
    soldCount: 980,
    isFeatured: false,
    sortOrder: 4,
  },
  // Team plans ship disabled: an admin reviews the price and enables them in LIVKA CONTROL.
  { slug: "chatgpt-plus-4", priceCents: 499_000, per: "monthly", accent: "#10a37f", icon: "chatgpt", kind: "account", stock: 10, soldCount: 0, isFeatured: false, isActive: false, sortOrder: 5 },
  { slug: "chatgpt-plus-8", priceCents: 899_000, per: "monthly", accent: "#10a37f", icon: "chatgpt", kind: "account", stock: 6, soldCount: 0, isFeatured: false, isActive: false, sortOrder: 6 },
  { slug: "chatgpt-pro-4", priceCents: 1_299_000, per: "monthly", accent: "#2fe6a7", icon: "chatgpt", kind: "account", stock: 6, soldCount: 0, isFeatured: false, isActive: false, sortOrder: 7 },
  { slug: "chatgpt-pro-8", priceCents: 2_299_000, per: "monthly", accent: "#2fe6a7", icon: "chatgpt", kind: "account", stock: 4, soldCount: 0, isFeatured: false, isActive: false, sortOrder: 8 },
];

export async function seedProducts() {
  const existing = await db.select({ slug: products.slug }).from(products);
  const known = new Set(existing.map((row) => row.slug));
  const missing = SEED.filter((p) => !known.has(p.slug));
  if (missing.length) await db.insert(products).values(missing).onConflictDoNothing();
}

/* ═══════════ QUERIES ═══════════ */
export async function getProducts() {
  await seedProducts();
  return db
    .select()
    .from(products)
    .where(eq(products.isActive, true))
    .orderBy(products.sortOrder);
}

export async function getProductById(id: string) {
  const rows = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getStats() {
  const [agg] = await db
    .select({ sold: sql<number>`coalesce(sum(${products.soldCount}), 0)::int` })
    .from(products);
  const [cnt] = await db.select({ n: sql<number>`count(*)::int` }).from(orders);
  return {
    totalSold: (agg?.sold ?? 0) + 3110,
    totalOrders: (cnt?.n ?? 0) + 4890,
  };
}

/* Order writes live in wallet.ts and are balance-backed transactions. */
export async function getOrderBySecret(secret: string) {
  const rows = await db
    .select({ order: orders, product: products })
    .from(orders)
    .innerJoin(products, eq(orders.productId, products.id))
    .where(eq(orders.secret, secret))
    .limit(1);
  return rows[0] ?? null;
}

export async function getUserOrders(userId: string) {
  return db
    .select({ order: orders, product: products })
    .from(orders)
    .innerJoin(products, eq(orders.productId, products.id))
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt));
}

/** Bind an anonymous / foreign order to a site user (used by the bot's /claim). */
export async function assignOrderToUser(orderId: string, userId: string) {
  await db.update(orders).set({ userId, updatedAt: new Date() }).where(eq(orders.id, orderId));
}
