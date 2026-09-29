import "server-only";
import { randomBytes } from "node:crypto";
import { and, desc, eq, gt, gte, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  adminAudit, inventory, orders, products, sessions, tokenModels, users, wallets,
  walletEntries, walletOperations,
} from "@/db/schema";
import { adminEnsure } from "@/lib/admin-auth";
import { formatCustomerId, type SafeUser } from "@/lib/session";
import { WALLET_RULES } from "@/lib/wallet-shared";
import { validId } from "@/lib/wallet-security";
import { productTitle } from "@/lib/order-delivery";
import { seedProducts } from "@/lib/livka";
import { seedTokenModels } from "@/lib/tokens";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const PAGE_SIZE = 20;

export type AdminUserRow = {
  id: string;
  customerId: string;
  name: string;
  email: string;
  role: "user" | "admin";
  status: "active" | "banned";
  balanceCents: number;
  heldCents: number;
  ordersCount: number;
  spentCents: number;
  telegramUsername: string | null;
  createdAt: string;
  bannedAt: string | null;
  banReason: string | null;
};

export type AdminProduct = {
  id: string; slug: string; title: string; stock: number; active: boolean; priceCents: number;
  per: string; accent: string; icon: string; kind: string; soldCount: number;
};

export type AdminRevenue = {
  /** Sales + withdrawal fees, all time. */
  totalCents: number;
  salesCents: number;
  feesCents: number;
  todayCents: number;
  weekCents: number;
  monthCents: number;
  prevMonthCents: number;
  ordersCount: number;
  avgOrderCents: number;
  depositsCents: number;
  payoutsCents: number;
  daily: { date: string; salesCents: number; feesCents: number; orders: number }[];
  byProduct: { slug: string; title: string; orders: number; cents: number }[];
  recent: { orderNo: number; slug: string; title: string; buyer: string; totalCents: number; createdAt: string }[];
};

export type AdminTokenModel = { slug: string; label: string; inputPerMillionCents: number; outputPerMillionCents: number; isActive: boolean };

export type AdminDashboardData = {
  revenue: AdminRevenue;
  tokenModels: AdminTokenModel[];
  stats: { users: number; active: number; banned: number; balanceCents: number; orders: number; granted: number; productsActive: number; productsTotal: number };
  users: AdminUserRow[];
  totalUsers: number;
  page: number;
  pages: number;
  query: string;
  products: AdminProduct[];
  audit: { id: string; action: string; actor: string; actorCustomerId: string; target: string | null; targetCustomerId: string | null; details: Record<string, unknown>; createdAt: string }[];
};

export async function getAdminDashboard(query = "", requestedPage = 1): Promise<AdminDashboardData> {
  await seedProducts();
  await seedTokenModels();
  const mode = "live" as const;
  const page = Math.max(1, Math.min(100000, Math.trunc(requestedPage) || 1));
  const clean = query.trim().slice(0, 100);
  const numeric = Number(clean.replace(/^LVK-/i, ""));
  const filter = clean
    ? or(ilike(users.name, `%${clean}%`), ilike(users.email, `%${clean}%`), ...(Number.isSafeInteger(numeric) && numeric > 0 ? [eq(users.customerNo, numeric)] : []))
    : undefined;

  const orderAgg = db.select({
    userId: orders.userId,
    count: sql<number>`count(*)::int`.as("order_count"),
    spent: sql<number>`coalesce(sum(${orders.totalCents}), 0)::int`.as("spent"),
  }).from(orders).groupBy(orders.userId).as("order_agg");

  const [countRows, userRows, userStats, balanceStats, orderStats, productRows, auditRows, revenue] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(users).where(filter),
    db.select({
      id: users.id, customerNo: users.customerNo, name: users.name, email: users.email,
      role: users.role, status: users.status, telegramUsername: users.telegramUsername,
      createdAt: users.createdAt, bannedAt: users.bannedAt, banReason: users.banReason,
      balance: sql<number>`coalesce(${wallets.balanceCents}, 0)::int`,
      held: sql<number>`coalesce(${wallets.heldCents}, 0)::int`,
      ordersCount: sql<number>`coalesce(${orderAgg.count}, 0)::int`,
      spent: sql<number>`coalesce(${orderAgg.spent}, 0)::int`,
    }).from(users)
      .leftJoin(wallets, and(eq(wallets.userId, users.id), eq(wallets.mode, mode)))
      .leftJoin(orderAgg, eq(orderAgg.userId, users.id))
      .where(filter).orderBy(desc(users.createdAt)).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
    db.select({ total: sql<number>`count(*)::int`, active: sql<number>`count(*) filter (where ${users.status} = 'active')::int`, banned: sql<number>`count(*) filter (where ${users.status} = 'banned')::int` }).from(users),
    db.select({ balance: sql<number>`coalesce(sum(${wallets.balanceCents}), 0)::int` }).from(wallets).where(eq(wallets.mode, mode)),
    db.select({ total: sql<number>`count(*)::int`, granted: sql<number>`count(*) filter (where ${orders.networkId} = 'admin-grant')::int` }).from(orders),
    db.select().from(products).orderBy(products.sortOrder),
    db.select().from(adminAudit).orderBy(desc(adminAudit.createdAt)).limit(30),
    getAdminRevenue(),
  ]);
  const tokenRows = await db.select().from(tokenModels).orderBy(tokenModels.sortOrder);

  const ids = [...new Set(auditRows.flatMap((row) => [row.actorUserId, row.targetUserId].filter(Boolean) as string[]))];
  const names = ids.length ? await db.select({ id: users.id, name: users.name, customerNo: users.customerNo }).from(users).where(inArray(users.id, ids)) : [];
  const nameMap = new Map(names.map((row) => [row.id, row]));

  const totalUsers = countRows[0]?.count ?? 0;
  return {
    revenue,
    tokenModels: tokenRows.map((m) => ({ slug: m.slug, label: m.label, inputPerMillionCents: m.inputPerMillionCents, outputPerMillionCents: m.outputPerMillionCents, isActive: m.isActive })),
    stats: {
      users: userStats[0]?.total ?? 0, active: userStats[0]?.active ?? 0, banned: userStats[0]?.banned ?? 0,
      balanceCents: balanceStats[0]?.balance ?? 0, orders: orderStats[0]?.total ?? 0, granted: orderStats[0]?.granted ?? 0,
      productsActive: productRows.filter((p) => p.isActive).length, productsTotal: productRows.length,
    },
    users: userRows.map((row) => ({
      id: row.id, customerId: formatCustomerId(row.customerNo), name: row.name, email: row.email,
      role: row.role, status: row.status, balanceCents: row.balance, heldCents: row.held,
      ordersCount: row.ordersCount, spentCents: row.spent, telegramUsername: row.telegramUsername,
      createdAt: row.createdAt.toISOString(), bannedAt: row.bannedAt?.toISOString() ?? null, banReason: row.banReason,
    })),
    totalUsers, page, pages: Math.max(1, Math.ceil(totalUsers / PAGE_SIZE)), query: clean,
    products: productRows.map((p) => ({
      id: p.id, slug: p.slug, title: productTitle(p.slug), stock: p.stock, active: p.isActive, priceCents: p.priceCents,
      per: p.per, accent: p.accent, icon: p.icon, kind: p.kind, soldCount: p.soldCount,
    })),
    audit: auditRows.map((row) => {
      const a = nameMap.get(row.actorUserId); const t = row.targetUserId ? nameMap.get(row.targetUserId) : null;
      return { id: row.id, action: row.action, actor: a?.name ?? "—", actorCustomerId: a ? formatCustomerId(a.customerNo) : "—", target: t?.name ?? null, targetCustomerId: t ? formatCustomerId(t.customerNo) : null, details: row.details, createdAt: row.createdAt.toISOString() };
    }),
  };
}

/* ═══════════ REVENUE ═══════════ */
const DAY_MS = 86_400_000;
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Income = money the store actually earned:
 *  - sales: delivered orders with a price (admin grants are free and excluded)
 *  - fees: commission kept from completed withdrawals
 * Deposits are customer funds (a liability), so they are reported separately.
 */
export async function getAdminRevenue(): Promise<AdminRevenue> {
  const since = new Date(Date.now() - 60 * DAY_MS);
  const paid = and(eq(orders.status, "delivered"), gt(orders.totalCents, 0));
  const paidOut = and(eq(walletOperations.kind, "withdrawal"), eq(walletOperations.status, "completed"));
  const [salesTotal, feesTotal, deposits, payouts, salesDaily, feesDaily, byProduct, recent] = await Promise.all([
    db.select({ cents: sql<number>`coalesce(sum(${orders.totalCents}), 0)::float8`, count: sql<number>`count(*)::int` }).from(orders).where(paid),
    db.select({ cents: sql<number>`coalesce(sum(${walletOperations.feeCents}), 0)::float8` }).from(walletOperations).where(paidOut),
    db.select({ cents: sql<number>`coalesce(sum(${walletOperations.amountCents}), 0)::float8` }).from(walletOperations).where(and(eq(walletOperations.kind, "deposit"), eq(walletOperations.status, "completed"))),
    db.select({ cents: sql<number>`coalesce(sum(${walletOperations.amountCents} - ${walletOperations.feeCents}), 0)::float8` }).from(walletOperations).where(paidOut),
    db.select({
      day: sql<string>`to_char(${orders.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`,
      cents: sql<number>`coalesce(sum(${orders.totalCents}), 0)::float8`, count: sql<number>`count(*)::int`,
    }).from(orders).where(and(paid, gte(orders.createdAt, since))).groupBy(sql`1`),
    db.select({
      day: sql<string>`to_char(${walletOperations.completedAt} at time zone 'UTC', 'YYYY-MM-DD')`,
      cents: sql<number>`coalesce(sum(${walletOperations.feeCents}), 0)::float8`,
    }).from(walletOperations).where(and(paidOut, gte(walletOperations.completedAt, since))).groupBy(sql`1`),
    db.select({
      slug: products.slug, count: sql<number>`count(*)::int`, cents: sql<number>`coalesce(sum(${orders.totalCents}), 0)::float8`,
    }).from(orders).innerJoin(products, eq(orders.productId, products.id)).where(paid).groupBy(products.slug).orderBy(desc(sql`3`)).limit(10),
    db.select({ orderNo: orders.orderNo, slug: products.slug, buyer: users.name, totalCents: orders.totalCents, createdAt: orders.createdAt })
      .from(orders).innerJoin(products, eq(orders.productId, products.id)).leftJoin(users, eq(orders.userId, users.id))
      .where(paid).orderBy(desc(orders.createdAt)).limit(8),
  ]);

  const salesMap = new Map(salesDaily.map((r) => [r.day, r]));
  const feesMap = new Map(feesDaily.map((r) => [r.day, r.cents]));
  const series = Array.from({ length: 60 }, (_, i) => {
    const date = dayKey(new Date(Date.now() - (59 - i) * DAY_MS));
    return { date, salesCents: salesMap.get(date)?.cents ?? 0, feesCents: feesMap.get(date) ?? 0, orders: salesMap.get(date)?.count ?? 0 };
  });
  const sum = (rows: typeof series) => rows.reduce((total, r) => total + r.salesCents + r.feesCents, 0);
  const salesCents = salesTotal[0]?.cents ?? 0;
  const feesCents = feesTotal[0]?.cents ?? 0;
  const ordersCount = salesTotal[0]?.count ?? 0;
  return {
    totalCents: salesCents + feesCents, salesCents, feesCents,
    todayCents: sum(series.slice(-1)), weekCents: sum(series.slice(-7)), monthCents: sum(series.slice(-30)), prevMonthCents: sum(series.slice(0, 30)),
    ordersCount, avgOrderCents: ordersCount ? Math.round(salesCents / ordersCount) : 0,
    depositsCents: deposits[0]?.cents ?? 0, payoutsCents: payouts[0]?.cents ?? 0,
    daily: series.slice(-30),
    byProduct: byProduct.map((r) => ({ slug: r.slug, title: productTitle(r.slug), orders: r.count, cents: r.cents })),
    recent: recent.map((r) => ({ orderNo: r.orderNo, slug: r.slug, title: productTitle(r.slug), buyer: r.buyer ?? "—", totalCents: r.totalCents, createdAt: r.createdAt.toISOString() })),
  };
}

async function targetUser(tx: Tx, id: unknown) {
  adminEnsure(validId(id), "INVALID_USER");
  const [target] = await tx.select().from(users).where(eq(users.id, id)).for("update");
  adminEnsure(target, "USER_NOT_FOUND", 404);
  return target;
}

export async function setUserBan(actor: SafeUser, targetId: unknown, banned: boolean, reasonValue: unknown) {
  const reason = typeof reasonValue === "string" ? reasonValue.trim().slice(0, 500) : "";
  if (banned) adminEnsure(reason.length >= 5, "REASON_REQUIRED");
  return db.transaction(async (tx) => {
    const target = await targetUser(tx, targetId);
    adminEnsure(target.id !== actor.id && target.role !== "admin", "ADMIN_PROTECTED", 409);
    const status = banned ? "banned" : "active";
    if (target.status === status) return { customerId: formatCustomerId(target.customerNo), status };
    await tx.update(users).set({ status, bannedAt: banned ? new Date() : null, banReason: banned ? reason : null }).where(eq(users.id, target.id));
    if (banned) await tx.delete(sessions).where(eq(sessions.userId, target.id));
    await tx.insert(adminAudit).values({ actorUserId: actor.id, targetUserId: target.id, action: banned ? "user.banned" : "user.unbanned", details: banned ? { reason } : {} });
    return { customerId: formatCustomerId(target.customerNo), status };
  });
}

export async function creditUserBalance(actor: SafeUser, targetId: unknown, amountValue: unknown, noteValue: unknown, keyValue: unknown) {
  adminEnsure(typeof amountValue === "number" && Number.isSafeInteger(amountValue) && amountValue >= 100 && amountValue <= 500_000, "INVALID_AMOUNT");
  adminEnsure(typeof keyValue === "string" && /^[0-9a-f-]{36}$/i.test(keyValue), "INVALID_REQUEST");
  const note = typeof noteValue === "string" ? noteValue.trim().slice(0, 300) : "";
  adminEnsure(note.length >= 3, "NOTE_REQUIRED");
  const mode = "live" as const;
  return db.transaction(async (tx) => {
    const target = await targetUser(tx, targetId);
    adminEnsure(target.status === "active", "USER_BANNED", 409);
    await tx.insert(wallets).values({ userId: target.id, mode }).onConflictDoNothing();
    const [wallet] = await tx.select().from(wallets).where(and(eq(wallets.userId, target.id), eq(wallets.mode, mode))).for("update");
    adminEnsure(wallet, "WALLET_NOT_FOUND", 404);
    const [existing] = await tx.select().from(walletOperations).where(and(eq(walletOperations.walletId, wallet.id), eq(walletOperations.idempotencyKey, keyValue)));
    if (existing) {
      adminEnsure(existing.kind === "adjustment" && existing.amountCents === amountValue, "IDEMPOTENCY_CONFLICT", 409);
      return { customerId: formatCustomerId(target.customerNo), balanceCents: wallet.balanceCents, operationId: existing.id };
    }
    const nextBalance = wallet.balanceCents + amountValue;
    adminEnsure(nextBalance <= WALLET_RULES.maxBalanceCents, "BALANCE_LIMIT", 409);
    const [operation] = await tx.insert(walletOperations).values({
      walletId: wallet.id, kind: "adjustment", status: "completed", amountCents: amountValue,
      feeCents: 0, idempotencyKey: keyValue, description: "Credited by administrator",
      method: "Admin panel", reference: note, completedAt: new Date(),
    }).returning();
    await tx.update(wallets).set({ balanceCents: nextBalance }).where(eq(wallets.id, wallet.id));
    await tx.insert(walletEntries).values({ walletId: wallet.id, operationId: operation.id, event: "admin_credit", deltaCents: amountValue, deltaHeldCents: 0, balanceAfterCents: nextBalance });
    await tx.insert(adminAudit).values({ actorUserId: actor.id, targetUserId: target.id, action: "balance.credited", details: { amountCents: amountValue, note, mode, operationId: operation.id } });
    return { customerId: formatCustomerId(target.customerNo), balanceCents: nextBalance, operationId: operation.id };
  });
}

export async function grantProduct(actor: SafeUser, targetId: unknown, productId: unknown, noteValue: unknown) {
  adminEnsure(validId(productId), "INVALID_PRODUCT");
  const note = typeof noteValue === "string" ? noteValue.trim().slice(0, 300) : "";
  adminEnsure(note.length >= 3, "NOTE_REQUIRED");
  return db.transaction(async (tx) => {
    const target = await targetUser(tx, targetId);
    adminEnsure(target.status === "active", "USER_BANNED", 409);
    const [product] = await tx.select().from(products).where(eq(products.id, productId)).for("update");
    adminEnsure(product?.isActive, "PRODUCT_NOT_FOUND", 404);
    // Token products have no inventory: they are credited through the token API.
    adminEnsure(product.kind !== "tokens", "TOKEN_PRODUCT", 409);
    const [stock] = await tx.select().from(inventory).where(and(eq(inventory.productId, product.id), isNull(inventory.orderId))).limit(1).for("update", { skipLocked: true });
    adminEnsure(stock, "OUT_OF_STOCK", 409);
    const [order] = await tx.insert(orders).values({
      orderNo: sql`nextval('site_order_number')::int`, secret: randomBytes(16).toString("hex"),
      userId: target.id, productId: product.id, status: "delivered", totalCents: 0, discount: 0,
      networkId: "admin-grant", networkLabel: "Granted by administrator", assetLabel: "GIFT",
      depositAddress: "", amountCrypto: "0", credentials: stock.credentials,
    }).returning();
    await tx.update(inventory).set({ orderId: order.id }).where(eq(inventory.id, stock.id));
    await tx.update(products).set({ stock: sql`greatest(${products.stock} - 1, 0)`, soldCount: sql`${products.soldCount} + 1` }).where(eq(products.id, product.id));
    await tx.insert(adminAudit).values({ actorUserId: actor.id, targetUserId: target.id, action: "product.granted", details: { productId: product.id, productSlug: product.slug, orderId: order.id, orderNo: order.orderNo, note } });
    return { customerId: formatCustomerId(target.customerNo), orderNo: order.orderNo, product: productTitle(product.slug) };
  });
}

/* ═══════════ PRODUCTS ═══════════ */
async function lockProduct(tx: Tx, id: unknown) {
  adminEnsure(validId(id), "INVALID_PRODUCT");
  const [product] = await tx.select().from(products).where(eq(products.id, id)).for("update");
  adminEnsure(product, "PRODUCT_NOT_FOUND", 404);
  return product;
}

function cleanNote(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 300) : "";
}

/**
 * Optimistic concurrency: the edit applies only to the price the admin saw,
 * so two admins cannot silently overwrite each other. Checkout locks the same
 * row and re-checks `expectedTotalCents`, so buyers never pay a stale price.
 */
export async function setProductPrice(actor: SafeUser, productId: unknown, priceValue: unknown, expectedValue: unknown, noteValue: unknown) {
  // Token products are priced per model in `site_token_models`, not here.
  adminEnsure(typeof priceValue === "number" && Number.isSafeInteger(priceValue) && priceValue >= 100 && priceValue <= WALLET_RULES.maxBalanceCents, "INVALID_PRICE");
  adminEnsure(typeof expectedValue === "number" && Number.isSafeInteger(expectedValue), "INVALID_REQUEST");
  const note = cleanNote(noteValue);
  return db.transaction(async (tx) => {
    const product = await lockProduct(tx, productId);
    adminEnsure(product.kind !== "tokens", "TOKEN_PRODUCT", 409);
    adminEnsure(product.priceCents === expectedValue, "PRODUCT_CHANGED", 409);
    adminEnsure(product.priceCents !== priceValue, "PRICE_UNCHANGED", 409);
    await tx.update(products).set({ priceCents: priceValue }).where(eq(products.id, product.id));
    await tx.insert(adminAudit).values({
      actorUserId: actor.id,
      action: "product.price_changed",
      details: { productId: product.id, productSlug: product.slug, productTitle: productTitle(product.slug), oldPriceCents: product.priceCents, newPriceCents: priceValue, ...(note ? { note } : {}) },
    });
    return { product: productTitle(product.slug), priceCents: priceValue };
  });
}

/** Soft removal: a hidden product leaves the catalog and checkout; orders keep their history. */
export async function setProductActive(actor: SafeUser, productId: unknown, activeValue: unknown, noteValue: unknown) {
  adminEnsure(typeof activeValue === "boolean", "INVALID_REQUEST");
  const note = cleanNote(noteValue);
  return db.transaction(async (tx) => {
    const product = await lockProduct(tx, productId);
    if (product.isActive === activeValue) return { product: productTitle(product.slug), active: activeValue };
    await tx.update(products).set({ isActive: activeValue }).where(eq(products.id, product.id));
    await tx.insert(adminAudit).values({
      actorUserId: actor.id,
      action: activeValue ? "product.enabled" : "product.disabled",
      details: { productId: product.id, productSlug: product.slug, productTitle: productTitle(product.slug), priceCents: product.priceCents, ...(note ? { note } : {}) },
    });
    return { product: productTitle(product.slug), active: activeValue };
  });
}
