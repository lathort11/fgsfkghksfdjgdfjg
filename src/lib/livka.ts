import { db } from "@/db";
import { products, orders } from "@/db/schema";
import { eq, sql, desc, and } from "drizzle-orm";
import { newSecret, newOrderNo, randomPassword, randomApiKey } from "@/lib/auth";
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
const SEED = [
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
];

export async function seedProducts() {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(products);
  if (row?.n && row.n > 0) return;
  for (const p of SEED) {
    await db.insert(products).values(p).onConflictDoNothing();
  }
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

/* ═══════════ ORDERS ═══════════ */
export async function createOrder(input: {
  userId: string | null;
  productId: string;
  networkId: string;
  promo?: string;
}) {
  const product = await getProductById(input.productId);
  if (!product) throw new Error("PRODUCT_NOT_FOUND");
  const network = getNetwork(input.networkId);
  if (!network) throw new Error("NETWORK_NOT_FOUND");
  if (product.stock <= 0) throw new Error("OUT_OF_STOCK");

  const discount = promoDiscount(input.promo ?? "");
  const totalCents = Math.round(product.priceCents * (1 - discount));
  const rates = await getRates();
  const quote = quoteCrypto(totalCents, network, rates);

  const [order] = await db
    .insert(orders)
    .values({
      orderNo: newOrderNo(),
      secret: newSecret(),
      userId: input.userId,
      productId: product.id,
      status: "awaiting_payment",
      promo: input.promo?.trim().toUpperCase() || null,
      totalCents,
      discount: Math.round(discount * 10_000),
      networkId: network.id,
      networkLabel: network.net,
      assetLabel: network.asset,
      depositAddress: network.address,
      amountCrypto: quote.amountCrypto,
      rateUsd: quote.usd.toFixed(2),
    })
    .returning();

  return { order, product, network, quote, discount };
}

function makeCredentials(kind: string, productName: string): string {
  if (kind === "api") {
    return [
      `API_KEY = ${randomApiKey()}`,
      `ENDPOINT = https://generativelanguage.googleapis.com/v1beta`,
      `MODEL = gemini-2.0-pro`,
      `RATE_LIMIT = 2000 RPM / 4M TPM`,
    ].join("\n");
  }
  return [
    `LOGIN = livka.${randomPassword(6).toLowerCase()}@gmail.com`,
    `PASSWORD = ${randomPassword(14)}`,
    `RECOVERY_MAIL = ${randomPassword(6).toLowerCase()}.recovery@gmail.com`,
    `RECOVERY_PASSWORD = ${randomPassword(12)}`,
    `SUBSCRIPTION = ${productName}`,
  ].join("\n");
}

export async function payOrder(input: {
  userId: string | null;
  secret: string;
  txHash: string;
}) {
  const rows = await db
    .select({ order: orders, product: products })
    .from(orders)
    .innerJoin(products, eq(orders.productId, products.id))
    .where(eq(orders.secret, input.secret))
    .limit(1);

  const row = rows[0];
  if (!row) throw new Error("ORDER_NOT_FOUND");
  if (!input.userId || row.order.userId !== input.userId) throw new Error("ORDER_NOT_FOUND");
  if (row.order.status === "delivered") return { ...row, justDelivered: false };

  const credentials = makeCredentials(row.product.kind, row.product.slug);

  await db
    .update(orders)
    .set({
      status: "delivered",
      txHash: input.txHash.trim(),
      credentials,
      userId: row.order.userId ?? input.userId,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, row.order.id));

  await db
    .update(products)
    .set({
      stock: sql`greatest(${products.stock} - 1, 0)`,
      soldCount: sql`${products.soldCount} + 1`,
    })
    .where(eq(products.id, row.product.id));

  const updated = await db
    .select({ order: orders, product: products })
    .from(orders)
    .innerJoin(products, eq(orders.productId, products.id))
    .where(eq(orders.id, row.order.id))
    .limit(1);

  return { ...(updated[0] ?? row), justDelivered: true };
}

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
