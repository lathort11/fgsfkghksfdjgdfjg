import "server-only";
import { randomBytes } from "node:crypto";
import { and, desc, eq, gt, gte, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  adminAudit, inventory, orders, products, sessions, tokenAccounts, tokenBalances,
  tokenBank, tokenModels, tokenPurchases, tokenUsage, users, wallets,
  walletEntries, walletOperations, type DiscountRow, type NewsRow,
} from "@/db/schema";
import { adminEnsure } from "@/lib/admin-auth";
import { formatCustomerId, type SafeUser } from "@/lib/session";
import { WALLET_RULES } from "@/lib/wallet-shared";
import { validId } from "@/lib/wallet-security";
import { productTitle } from "@/lib/order-delivery";
import { seedProducts } from "@/lib/livka";
import { seedTokenModels } from "@/lib/tokens";
import { deleteInvoice } from "@/lib/crypto-pay";
import { listAllDiscounts } from "@/lib/discounts";
import { listAllNews } from "@/lib/news";

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

export type AdminTokenModel = { id: string; slug: string; label: string; inputPerMillionCents: number; outputPerMillionCents: number; isActive: boolean };

export type AdminTokenAccountRow = {
  id: string;
  userId: string;
  customerId: string;
  name: string;
  email: string;
  status: "active" | "banned";
  apiKey: string;
  isActive: boolean;
  label: string | null;
  createdAt: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  requestsCount: number;
  tokensConsumed: number;
  lastUsedAt: string | null;
};

export type AdminClaudeUsageRow = {
  id: string;
  userId: string;
  customerId: string;
  userName: string;
  endpoint: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  clientIp: string | null;
  createdAt: string;
};

export type AdminClaudeData = {
  stats: {
    totalAccounts: number;
    activeAccounts: number;
    tokensInCirculation: number;
    totalConsumed: number;
    bankAvailable: number;
    bankCap: number;
  };
  accounts: AdminTokenAccountRow[];
  models: AdminTokenModel[];
  recentUsage: AdminClaudeUsageRow[];
};

export type AdminPendingOperation = {
  id: string;
  kind: string;
  status: string;
  amountCents: number;
  feeCents: number;
  description: string;
  method: string;
  reference: string | null;
  createdAt: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  customerId: string;
};

export type AdminDashboardData = {
  revenue: AdminRevenue;
  tokenModels: AdminTokenModel[];
  claude: AdminClaudeData;
  stats: { users: number; active: number; banned: number; balanceCents: number; orders: number; granted: number; productsActive: number; productsTotal: number };
  users: AdminUserRow[];
  totalUsers: number;
  page: number;
  pages: number;
  query: string;
  products: AdminProduct[];
  pendingOperations: AdminPendingOperation[];
  audit: { id: string; action: string; actor: string; actorCustomerId: string; target: string | null; targetCustomerId: string | null; details: Record<string, unknown>; createdAt: string }[];
  discounts: DiscountRow[];
  news: NewsRow[];
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

  const [countRows, userRows, userStats, balanceStats, orderStats, productRows, auditRows, revenue, claude, pendingOps] = await Promise.all([
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
    getAdminClaudeData(),
    db.select({
      id: walletOperations.id,
      kind: walletOperations.kind,
      status: walletOperations.status,
      amountCents: walletOperations.amountCents,
      feeCents: walletOperations.feeCents,
      description: walletOperations.description,
      method: walletOperations.method,
      reference: walletOperations.reference,
      createdAt: walletOperations.createdAt,
      userId: wallets.userId,
      userName: users.name,
      userEmail: users.email,
      customerNo: users.customerNo,
    })
      .from(walletOperations)
      .innerJoin(wallets, eq(walletOperations.walletId, wallets.id))
      .leftJoin(users, eq(wallets.userId, users.id))
      .where(inArray(walletOperations.status, ["pending", "processing"]))
      .orderBy(desc(walletOperations.createdAt))
      .limit(30),
    listAllDiscounts(),
    listAllNews(),
  ]);
  const discountsList = (countRows as unknown as [unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown, DiscountRow[], NewsRow[]])[10] ?? [];
  const newsList = (countRows as unknown as [unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown, DiscountRow[], NewsRow[]])[11] ?? [];
  const tokenRows = await db.select().from(tokenModels).orderBy(tokenModels.sortOrder);

  const ids = [...new Set(auditRows.flatMap((row) => [row.actorUserId, row.targetUserId].filter(Boolean) as string[]))];
  const names = ids.length ? await db.select({ id: users.id, name: users.name, customerNo: users.customerNo }).from(users).where(inArray(users.id, ids)) : [];
  const nameMap = new Map(names.map((row) => [row.id, row]));

  const totalUsers = countRows[0]?.count ?? 0;
  return {
    revenue,
    tokenModels: tokenRows.map((m) => ({ id: m.id, slug: m.slug, label: m.label, inputPerMillionCents: m.inputPerMillionCents, outputPerMillionCents: m.outputPerMillionCents, isActive: m.isActive })),
    claude,
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
    pendingOperations: pendingOps.map((op) => ({
      id: op.id,
      kind: op.kind,
      status: op.status,
      amountCents: op.amountCents,
      feeCents: op.feeCents,
      description: op.description,
      method: op.method,
      reference: op.reference,
      createdAt: op.createdAt.toISOString(),
      userId: op.userId,
      userName: op.userName,
      userEmail: op.userEmail,
      customerId: op.customerNo ? formatCustomerId(op.customerNo) : "—",
    })),
    audit: auditRows.map((row) => {
      const a = nameMap.get(row.actorUserId); const t = row.targetUserId ? nameMap.get(row.targetUserId) : null;
      return { id: row.id, action: row.action, actor: a?.name ?? "—", actorCustomerId: a ? formatCustomerId(a.customerNo) : "—", target: t?.name ?? null, targetCustomerId: t ? formatCustomerId(t.customerNo) : null, details: row.details, createdAt: row.createdAt.toISOString() };
    }),
    discounts: discountsList,
    news: newsList,
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

/* ═══════════ CLAUDE API & TOKENS ═══════════ */
export async function getAdminClaudeData(): Promise<AdminClaudeData> {
  await seedTokenModels();
  const [accountsWithUsers, balancesAgg, usageAgg, models, [bankRow], recentLogs] = await Promise.all([
    db.select({
      id: tokenAccounts.id,
      userId: tokenAccounts.userId,
      apiKey: tokenAccounts.apiKey,
      isActive: tokenAccounts.isActive,
      label: tokenAccounts.label,
      createdAt: tokenAccounts.createdAt,
      name: users.name,
      email: users.email,
      customerNo: users.customerNo,
      status: users.status,
    }).from(tokenAccounts)
      .innerJoin(users, eq(tokenAccounts.userId, users.id))
      .orderBy(desc(tokenAccounts.createdAt)),

    db.select({
      userId: tokenBalances.userId,
      inputTokens: sql<number>`coalesce(sum(${tokenBalances.inputTokens}), 0)::float8`,
      outputTokens: sql<number>`coalesce(sum(${tokenBalances.outputTokens}), 0)::float8`,
      totalTokens: sql<number>`coalesce(sum(${tokenBalances.inputTokens} + ${tokenBalances.outputTokens}), 0)::float8`,
    }).from(tokenBalances).groupBy(tokenBalances.userId),

    db.select({
      userId: tokenUsage.userId,
      requestsCount: sql<number>`count(*)::int`,
      tokensConsumed: sql<number>`coalesce(sum(${tokenUsage.inputTokens} + ${tokenUsage.outputTokens}), 0)::float8`,
      lastUsedAt: sql<string>`max(${tokenUsage.createdAt})::text`,
    }).from(tokenUsage).groupBy(tokenUsage.userId),

    db.select().from(tokenModels).orderBy(tokenModels.sortOrder),
    db.select().from(tokenBank).limit(1),

    db.select({
      id: tokenUsage.id,
      userId: tokenUsage.userId,
      endpoint: tokenUsage.endpoint,
      inputTokens: tokenUsage.inputTokens,
      outputTokens: tokenUsage.outputTokens,
      clientIp: tokenUsage.clientIp,
      createdAt: tokenUsage.createdAt,
      userName: users.name,
      customerNo: users.customerNo,
    }).from(tokenUsage)
      .leftJoin(users, eq(tokenUsage.userId, users.id))
      .orderBy(desc(tokenUsage.createdAt))
      .limit(40),
  ]);

  const balanceMap = new Map(balancesAgg.map((b) => [b.userId, b]));
  const usageMap = new Map(usageAgg.map((u) => [u.userId, u]));

  const accounts: AdminTokenAccountRow[] = accountsWithUsers.map((a) => {
    const bal = balanceMap.get(a.userId);
    const usg = usageMap.get(a.userId);
    return {
      id: a.id,
      userId: a.userId,
      customerId: formatCustomerId(a.customerNo),
      name: a.name,
      email: a.email,
      status: a.status,
      apiKey: a.apiKey,
      isActive: a.isActive,
      label: a.label,
      createdAt: a.createdAt.toISOString(),
      inputTokens: Number(bal?.inputTokens ?? 0),
      outputTokens: Number(bal?.outputTokens ?? 0),
      totalTokens: Number(bal?.totalTokens ?? 0),
      requestsCount: Number(usg?.requestsCount ?? 0),
      tokensConsumed: Number(usg?.tokensConsumed ?? 0),
      lastUsedAt: usg?.lastUsedAt ? new Date(usg.lastUsedAt).toISOString() : null,
    };
  });

  const tokensInCirculation = accounts.reduce((acc, a) => acc + a.totalTokens, 0);
  const totalConsumed = accounts.reduce((acc, a) => acc + a.tokensConsumed, 0);

  return {
    stats: {
      totalAccounts: accounts.length,
      activeAccounts: accounts.filter((a) => a.isActive && a.status === "active").length,
      tokensInCirculation,
      totalConsumed,
      bankAvailable: bankRow?.availableTokens ?? 0,
      bankCap: 400_000_000,
    },
    accounts,
    models: models.map((m) => ({
      id: m.id,
      slug: m.slug,
      label: m.label,
      inputPerMillionCents: m.inputPerMillionCents,
      outputPerMillionCents: m.outputPerMillionCents,
      isActive: m.isActive,
    })),
    recentUsage: recentLogs.map((log) => ({
      id: log.id,
      userId: log.userId,
      customerId: log.customerNo ? formatCustomerId(log.customerNo) : "—",
      userName: log.userName ?? "—",
      endpoint: log.endpoint,
      inputTokens: Number(log.inputTokens),
      outputTokens: Number(log.outputTokens),
      totalTokens: Number(log.inputTokens) + Number(log.outputTokens),
      clientIp: log.clientIp,
      createdAt: log.createdAt.toISOString(),
    })),
  };
}

export async function adminIssueTokenKey(
  actor: SafeUser,
  params: { userId: string; initialTokens?: number; label?: string; note?: string; balanceMode?: "replace" | "add" }
) {
  const { userId, initialTokens = 0, label, note, balanceMode = "replace" } = params;
  adminEnsure(validId(userId), "INVALID_USER");
  return db.transaction(async (tx) => {
    const target = await targetUser(tx, userId);
    adminEnsure(target.status === "active", "USER_BANNED", 409);

    const [activeModel] = await tx.select().from(tokenModels).where(eq(tokenModels.isActive, true)).limit(1);
    adminEnsure(activeModel, "MODEL_NOT_FOUND", 404);

    const newKey = `lvk-claude-${randomBytes(24).toString("base64url")}`;
    const [existing] = await tx.select().from(tokenAccounts).where(eq(tokenAccounts.userId, target.id)).for("update");

    let accountId = "";
    if (existing) {
      await tx.update(tokenAccounts).set({
        apiKey: newKey,
        isActive: true,
        label: label ? label.trim().slice(0, 100) : existing.label,
      }).where(eq(tokenAccounts.id, existing.id));
      accountId = existing.id;
    } else {
      const [created] = await tx.insert(tokenAccounts).values({
        userId: target.id,
        apiKey: newKey,
        isActive: true,
        label: label ? label.trim().slice(0, 100) : null,
      }).returning();
      accountId = created.id;
    }

    if (initialTokens >= 0 && balanceMode === "replace") {
      await tx.insert(tokenBalances).values({
        userId: target.id,
        modelId: activeModel.id,
        outputTokens: initialTokens,
        inputTokens: 0,
      }).onConflictDoUpdate({
        target: [tokenBalances.userId, tokenBalances.modelId],
        set: {
          outputTokens: initialTokens,
          inputTokens: 0,
          updatedAt: new Date(),
        },
      });

      if (initialTokens > 0) {
        await tx.update(tokenBank).set({
          availableTokens: sql`greatest(0, ${tokenBank.availableTokens} - ${initialTokens})`,
          updatedAt: new Date(),
        }).where(eq(tokenBank.productId, activeModel.productId));
      }
    } else if (initialTokens > 0) {
      await tx.insert(tokenBalances).values({
        userId: target.id,
        modelId: activeModel.id,
        outputTokens: initialTokens,
      }).onConflictDoUpdate({
        target: [tokenBalances.userId, tokenBalances.modelId],
        set: {
          outputTokens: sql`${tokenBalances.outputTokens} + ${initialTokens}`,
          updatedAt: new Date(),
        },
      });

      await tx.update(tokenBank).set({
        availableTokens: sql`greatest(0, ${tokenBank.availableTokens} - ${initialTokens})`,
        updatedAt: new Date(),
      }).where(eq(tokenBank.productId, activeModel.productId));
    }

    await tx.insert(adminAudit).values({
      actorUserId: actor.id,
      targetUserId: target.id,
      action: "claude.key_issued",
      details: { accountId, initialTokens, balanceMode, label, ...(note ? { note } : {}) },
    });

    return { ok: true, accountId, apiKey: newKey };
  });
}

export async function adminUpdateTokenBalance(
  actor: SafeUser,
  params: { accountId: string; mode: "add" | "subtract" | "set"; amountTokens: number; note?: string }
) {
  const { accountId, mode, amountTokens, note } = params;
  adminEnsure(validId(accountId), "INVALID_ACCOUNT");
  adminEnsure(typeof amountTokens === "number" && Number.isSafeInteger(amountTokens) && amountTokens >= 0, "INVALID_AMOUNT");

  return db.transaction(async (tx) => {
    const [account] = await tx.select().from(tokenAccounts).where(eq(tokenAccounts.id, accountId)).for("update");
    adminEnsure(account, "ACCOUNT_NOT_FOUND", 404);

    const [activeModel] = await tx.select().from(tokenModels).where(eq(tokenModels.isActive, true)).limit(1);
    adminEnsure(activeModel, "MODEL_NOT_FOUND", 404);

    await tx.insert(tokenBalances).values({
      userId: account.userId,
      modelId: activeModel.id,
      outputTokens: 0,
    }).onConflictDoNothing();

    const [balance] = await tx.select().from(tokenBalances)
      .where(and(eq(tokenBalances.userId, account.userId), eq(tokenBalances.modelId, activeModel.id)))
      .for("update");
    adminEnsure(balance, "BALANCE_NOT_FOUND", 404);

    let nextOutput = balance.outputTokens;
    let nextInput = balance.inputTokens;
    if (mode === "add") {
      nextOutput += amountTokens;
    } else if (mode === "subtract") {
      const takeOut = Math.min(nextOutput, amountTokens);
      nextOutput -= takeOut;
      const rest = amountTokens - takeOut;
      nextInput = Math.max(0, nextInput - rest);
    } else if (mode === "set") {
      nextOutput = amountTokens;
      nextInput = 0;
    }

    nextOutput = Math.min(400_000_000, Math.max(0, nextOutput));
    await tx.update(tokenBalances).set({
      inputTokens: nextInput,
      outputTokens: nextOutput,
      updatedAt: new Date(),
    }).where(eq(tokenBalances.id, balance.id));

    await tx.insert(adminAudit).values({
      actorUserId: actor.id,
      targetUserId: account.userId,
      action: "claude.balance_updated",
      details: { accountId, mode, amountTokens, newOutput: nextOutput, newInput: nextInput, ...(note ? { note } : {}) },
    });

    return { ok: true, totalTokens: nextInput + nextOutput };
  });
}

export async function adminRegenerateTokenKey(actor: SafeUser, accountId: string, note?: string) {
  adminEnsure(validId(accountId), "INVALID_ACCOUNT");
  const newKey = `lvk-claude-${randomBytes(24).toString("base64url")}`;
  return db.transaction(async (tx) => {
    const [account] = await tx.select().from(tokenAccounts).where(eq(tokenAccounts.id, accountId)).for("update");
    adminEnsure(account, "ACCOUNT_NOT_FOUND", 404);

    await tx.update(tokenAccounts).set({ apiKey: newKey }).where(eq(tokenAccounts.id, accountId));
    await tx.insert(adminAudit).values({
      actorUserId: actor.id,
      targetUserId: account.userId,
      action: "claude.key_regenerated",
      details: { accountId, ...(note ? { note } : {}) },
    });

    return { ok: true, apiKey: newKey };
  });
}

export async function adminToggleTokenAccount(actor: SafeUser, accountId: string, isActive: boolean, note?: string) {
  adminEnsure(validId(accountId), "INVALID_ACCOUNT");
  return db.transaction(async (tx) => {
    const [account] = await tx.select().from(tokenAccounts).where(eq(tokenAccounts.id, accountId)).for("update");
    adminEnsure(account, "ACCOUNT_NOT_FOUND", 404);

    await tx.update(tokenAccounts).set({ isActive }).where(eq(tokenAccounts.id, accountId));
    await tx.insert(adminAudit).values({
      actorUserId: actor.id,
      targetUserId: account.userId,
      action: isActive ? "claude.key_activated" : "claude.key_suspended",
      details: { accountId, isActive, ...(note ? { note } : {}) },
    });

    return { ok: true, isActive };
  });
}

export async function adminDeleteTokenAccount(actor: SafeUser, accountId: string, note?: string, resetBalance?: boolean) {
  adminEnsure(validId(accountId), "INVALID_ACCOUNT");
  return db.transaction(async (tx) => {
    const [account] = await tx.select().from(tokenAccounts).where(eq(tokenAccounts.id, accountId)).for("update");
    adminEnsure(account, "ACCOUNT_NOT_FOUND", 404);

    if (resetBalance) {
      await tx.delete(tokenBalances).where(eq(tokenBalances.userId, account.userId));
    }

    await tx.delete(tokenAccounts).where(eq(tokenAccounts.id, accountId));
    await tx.insert(adminAudit).values({
      actorUserId: actor.id,
      targetUserId: account.userId,
      action: "claude.key_deleted",
      details: { accountId, resetBalance: Boolean(resetBalance), ...(note ? { note } : {}) },
    });

    return { ok: true };
  });
}

export async function adminUpdateTokenModelRate(
  actor: SafeUser,
  params: { modelId: string; inputRateCents: number; outputRateCents: number; isActive: boolean; note?: string }
) {
  const { modelId, inputRateCents, outputRateCents, isActive, note } = params;
  adminEnsure(validId(modelId), "INVALID_MODEL");
  adminEnsure(inputRateCents >= 0 && outputRateCents >= 0, "INVALID_PRICE");

  return db.transaction(async (tx) => {
    const [model] = await tx.select().from(tokenModels).where(eq(tokenModels.id, modelId)).for("update");
    adminEnsure(model, "MODEL_NOT_FOUND", 404);

    await tx.update(tokenModels).set({
      inputPerMillionCents: inputRateCents,
      outputPerMillionCents: outputRateCents,
      isActive,
    }).where(eq(tokenModels.id, modelId));

    await tx.insert(adminAudit).values({
      actorUserId: actor.id,
      action: "claude.model_updated",
      details: { modelId, slug: model.slug, inputRateCents, outputRateCents, isActive, ...(note ? { note } : {}) },
    });

    return { ok: true };
  });
}

export async function adminReplenishTokenBank(actor: SafeUser, addTokens: number, note?: string) {
  adminEnsure(typeof addTokens === "number" && addTokens > 0, "INVALID_AMOUNT");
  return db.transaction(async (tx) => {
    const [bank] = await tx.select().from(tokenBank).limit(1).for("update");
    adminEnsure(bank, "BANK_NOT_FOUND", 404);

    const nextAvailable = Math.min(400_000_000, bank.availableTokens + addTokens);
    await tx.update(tokenBank).set({
      availableTokens: nextAvailable,
      updatedAt: new Date(),
    }).where(eq(tokenBank.productId, bank.productId));

    await tx.insert(adminAudit).values({
      actorUserId: actor.id,
      action: "claude.bank_replenished",
      details: { added: addTokens, newAvailable: nextAvailable, ...(note ? { note } : {}) },
    });

    return { ok: true, availableTokens: nextAvailable };
  });
}

export async function adminRejectOperation(
  actor: SafeUser,
  operationIdValue: unknown,
  reasonValue?: unknown
) {
  const operationId = String(operationIdValue || "");
  adminEnsure(validId(operationId), "INVALID_OPERATION_ID");
  const reason = typeof reasonValue === "string" ? reasonValue.trim().slice(0, 500) : "admin_rejected";

  return db.transaction(async (tx) => {
    const [op] = await tx.select().from(walletOperations).where(eq(walletOperations.id, operationId)).for("update");
    adminEnsure(op, "OPERATION_NOT_FOUND", 404);
    if (op.status === "rejected") {
      return { ok: true, operation: op };
    }
    adminEnsure(["pending", "processing"].includes(op.status), "CANNOT_REJECT_COMPLETED_OPERATION", 409);

    const [w] = await tx.select().from(wallets).where(eq(wallets.id, op.walletId)).for("update");
    adminEnsure(w, "WALLET_NOT_FOUND", 404);

    if (op.kind === "withdrawal") {
      // Reversal: release held funds back to balance
      const balance = w.balanceCents + op.amountCents;
      const held = w.heldCents - op.amountCents;
      await tx.update(wallets).set({
        balanceCents: balance,
        heldCents: held,
      }).where(eq(wallets.id, w.id));
      await tx.insert(walletEntries).values({
        walletId: w.id,
        operationId: op.id,
        event: "withdrawal_reversal",
        deltaCents: op.amountCents,
        deltaHeldCents: -op.amountCents,
        balanceAfterCents: balance,
      });
    } else if (op.kind === "deposit") {
      if (op.externalId) {
        void deleteInvoice(op.externalId).catch(() => {});
      }
    }

    const [updated] = await tx.update(walletOperations).set({
      status: "rejected",
      reference: op.reference ? `${op.reference} | Отклонено: ${reason}` : `Отклонено: ${reason}`,
      completedAt: new Date(),
    }).where(eq(walletOperations.id, op.id)).returning();

    await tx.insert(adminAudit).values({
      actorUserId: actor.id,
      targetUserId: w.userId,
      action: "wallet.operation_rejected",
      details: { operationId: op.id, kind: op.kind, amountCents: op.amountCents, reason },
    });

    return { ok: true, operation: updated };
  });
}
