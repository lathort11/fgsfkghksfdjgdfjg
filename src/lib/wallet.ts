import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq, desc, gte, isNull, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { wallets, walletOperations as ops, walletEntries, walletAudit, inventory, products, orders, users } from "@/db/schema";
import { createInvoice, getInvoice } from "@/lib/crypto-pay";
import { ensure, idempotency, validId, rateLimit, isTronAddress } from "@/lib/wallet-security";
import { WALLET_RULES as rules, withdrawalFee, parseMoney, type WalletMode, type WalletSnapshot, type WalletOperation } from "@/lib/wallet-shared";
import { promoDiscount } from "@/lib/networks";
import { verifyPassword } from "@/lib/auth";
import { productTitle } from "@/lib/order-delivery";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Account = typeof wallets.$inferSelect;
type Op = typeof ops.$inferSelect;
export const walletMode = (): WalletMode => process.env.WALLET_MODE === "live" ? "live" : "demo";
const scope = (userId: string) => and(eq(wallets.userId, userId), eq(wallets.mode, walletMode()));

async function account(userId: string) {
  await db.insert(wallets).values({ userId, mode: walletMode() }).onConflictDoNothing();
  const [w] = await db.select().from(wallets).where(scope(userId));
  ensure(w, "WALLET_NOT_FOUND", 404);
  return w;
}
async function lock(tx: Tx, id: string) {
  const [w] = await tx.select().from(wallets).where(eq(wallets.id, id)).for("update");
  ensure(w, "WALLET_NOT_FOUND", 404);
  return w;
}
function usable(w: Account) { ensure(w.verification !== "blocked", "WALLET_BLOCKED", 403); }
function amount(value: unknown, min: number, max: number): number {
  ensure(typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max, "INVALID_AMOUNT");
  return value;
}
function serialize(op: Op): WalletOperation {
  return { id: op.id, kind: op.kind, status: op.status, amountCents: op.amountCents, feeCents: op.feeCents,
    description: op.description, method: op.method, address: op.address, paymentUrl: op.paymentUrl,
    orderId: op.orderId, reference: op.reference, createdAt: op.createdAt.toISOString(), completedAt: op.completedAt?.toISOString() ?? null };
}
async function findExisting(tx: Tx, walletId: string, key: string) {
  const [op] = await tx.select().from(ops).where(and(eq(ops.walletId, walletId), eq(ops.idempotencyKey, key)));
  return op;
}
async function immatureDeposits(tx: Tx, w: Account) {
  if (w.mode === "demo") return 0;
  const [sum] = await tx.select({ total: sql<number>`coalesce(sum(${ops.amountCents}), 0)::int` }).from(ops).where(and(
    eq(ops.walletId, w.id), eq(ops.kind, "deposit"), eq(ops.status, "completed"),
    gte(ops.completedAt, new Date(Date.now() - rules.withdrawalHoldHours * 3600_000)),
  ));
  return sum.total;
}
async function entry(tx: Tx, w: Account, operationId: string, event: string, delta: number, held = 0) {
  const balance = w.balanceCents + delta;
  ensure(balance >= 0 && w.heldCents + held >= 0, "INSUFFICIENT_BALANCE", 409);
  await tx.update(wallets).set({ balanceCents: balance, heldCents: w.heldCents + held }).where(eq(wallets.id, w.id));
  await tx.insert(walletEntries).values({ walletId: w.id, operationId, event, deltaCents: delta, deltaHeldCents: held, balanceAfterCents: balance });
}

export async function walletSnapshot(userId: string): Promise<WalletSnapshot> {
  const current = await account(userId);
  return db.transaction(async (tx) => {
    const w = await lock(tx, current.id);
    const rows = await tx.select().from(ops).where(eq(ops.walletId, w.id)).orderBy(desc(ops.createdAt)).limit(200);
    const [totals] = await tx.select({
      deposited: sql<number>`coalesce(sum(case when ${ops.kind} = 'deposit' and ${ops.status} = 'completed' then ${ops.amountCents} else 0 end), 0)::int`,
      spent: sql<number>`coalesce(sum(case when ${ops.kind} = 'purchase' and ${ops.status} = 'completed' then ${ops.amountCents} else 0 end), 0)::int`,
    }).from(ops).where(eq(ops.walletId, w.id));
    const mature = Math.max(0, w.balanceCents - await immatureDeposits(tx, w));
    return { mode: w.mode, balanceCents: w.balanceCents, heldCents: w.heldCents,
      withdrawableCents: w.verification === "blocked" ? 0 : mature,
      depositedCents: totals.deposited, spentCents: totals.spent,
      verification: w.verification, operations: rows.map(serialize) };
  });
}

export async function createDeposit(userId: string, body: Record<string, unknown>) {
  const cents = amount(body.amountCents, rules.minDepositCents, rules.maxDepositCents);
  const key = idempotency(body.idempotencyKey);
  const asset = typeof body.asset === "string" ? body.asset : "USDT";
  ensure(["USDT", "TON", "BTC", "ETH"].includes(asset), "INVALID_METHOD");
  const current = await account(userId);
  return db.transaction(async (tx) => {
    const w = await lock(tx, current.id); usable(w);
    const prior = await findExisting(tx, w.id, key);
    if (prior) {
      ensure(prior.kind === "deposit" && prior.amountCents === cents && prior.method === asset, "IDEMPOTENCY_CONFLICT", 409);
      return serialize(prior);
    }
    const pending = await tx.select({ total: sql<number>`coalesce(sum(${ops.amountCents}), 0)::int`, count: sql<number>`count(*)::int` }).from(ops).where(and(eq(ops.walletId, w.id), eq(ops.kind, "deposit"), eq(ops.status, "pending")));
    ensure(pending[0].count < 5, "TOO_MANY_INVOICES", 409);
    ensure(w.balanceCents + w.heldCents + pending[0].total + cents <= rules.maxBalanceCents, "BALANCE_LIMIT", 409);
    const [op] = await tx.insert(ops).values({ walletId: w.id, kind: "deposit", amountCents: cents, idempotencyKey: key, description: "Пополнение баланса", method: asset }).returning();
    if (w.mode === "live") {
      const invoice = await createInvoice(op.id, cents, asset);
      ensure(invoice.currency_type === "fiat" && invoice.fiat === "RUB" && parseMoney(invoice.amount) === cents && invoice.payload === op.id, "INVALID_INVOICE", 502);
      const url = invoice.bot_invoice_url;
      ensure(typeof url === "string" && url.startsWith("https://"), "INVALID_INVOICE", 502);
      const [updated] = await tx.update(ops).set({ externalId: String(invoice.invoice_id), paymentUrl: url }).where(eq(ops.id, op.id)).returning();
      return serialize(updated);
    }
    return serialize(op);
  });
}

export async function confirmDeposit(operationId: string, userId?: string) {
  ensure(validId(operationId), "INVALID_REQUEST");
  const [initial] = await db.select({ op: ops, wallet: wallets }).from(ops).innerJoin(wallets, eq(ops.walletId, wallets.id)).where(eq(ops.id, operationId));
  ensure(initial && initial.op.kind === "deposit", "NOT_FOUND", 404);
  if (userId) ensure(initial.wallet.userId === userId && initial.wallet.mode === walletMode(), "NOT_FOUND", 404);
  else ensure(initial.wallet.mode === "live", "FORBIDDEN", 403);
  if (initial.op.status === "completed") return serialize(initial.op);
  let expired = false;
  if (initial.wallet.mode === "live") {
    ensure(initial.op.externalId, "INVALID_INVOICE", 409);
    const invoice = await getInvoice(initial.op.externalId);
    ensure(invoice.currency_type === "fiat" && invoice.fiat === "RUB" && parseMoney(invoice.amount) === initial.op.amountCents && invoice.payload === initial.op.id, "PAYMENT_MISMATCH", 409);
    expired = invoice.status === "expired";
    if (invoice.status !== "paid" && !expired) return serialize(initial.op);
  }
  return db.transaction(async (tx) => {
    const w = await lock(tx, initial.wallet.id);
    const [op] = await tx.select().from(ops).where(eq(ops.id, operationId)).for("update");
    if (op.status === "completed") return serialize(op);
    ensure(op.status === "pending", "INVALID_STATE", 409);
    if (expired) {
      const [updated] = await tx.update(ops).set({ status: "expired" }).where(eq(ops.id, op.id)).returning();
      return serialize(updated);
    }
    await entry(tx, w, op.id, "deposit_credit", op.amountCents);
    const [updated] = await tx.update(ops).set({ status: "completed", completedAt: new Date() }).where(eq(ops.id, op.id)).returning();
    await tx.insert(walletAudit).values({ actor: userId ?? "crypto-pay", action: "deposit.confirmed", walletId: w.id, details: { operationId: op.id, mode: w.mode, amountCents: op.amountCents } });
    return serialize(updated);
  });
}

export async function purchaseWithBalance(userId: string, body: Record<string, unknown>) {
  ensure(body.confirmed === true && validId(body.productId), "CONFIRM_REQUIRED");
  const productId = body.productId;
  const key = idempotency(body.idempotencyKey);
  const expected = amount(body.expectedTotalCents, 1, rules.maxBalanceCents);
  const promo = typeof body.promo === "string" ? body.promo.trim().toUpperCase().slice(0, 40) : "";
  const current = await account(userId);
  return db.transaction(async (tx) => {
    const w = await lock(tx, current.id); usable(w);
    const prior = await findExisting(tx, w.id, key);
    if (prior) {
      ensure(prior.kind === "purchase" && prior.productId === productId && prior.amountCents === expected && prior.orderId, "IDEMPOTENCY_CONFLICT", 409);
      const [order] = await tx.select().from(orders).where(eq(orders.id, prior.orderId));
      const [product] = await tx.select().from(products).where(eq(products.id, productId));
      return { order, product, justDelivered: false, demo: w.mode === "demo" };
    }
    const [product] = await tx.select().from(products).where(eq(products.id, productId)).for("update");
    ensure(product?.isActive, "PRODUCT_NOT_FOUND", 404);
    const discount = promoDiscount(promo);
    const price = Math.round(product.priceCents * (1 - discount));
    ensure(price === expected, "PRICE_CHANGED", 409);
    ensure(w.balanceCents >= price, "INSUFFICIENT_BALANCE", 409);
    let stock: typeof inventory.$inferSelect | undefined;
    if (w.mode === "live") {
      [stock] = await tx.select().from(inventory).where(and(eq(inventory.productId, product.id), isNull(inventory.orderId))).limit(1).for("update", { skipLocked: true });
      ensure(stock, "OUT_OF_STOCK", 409);
    }
    const title = productTitle(product.slug);
    const credentials = stock?.credentials ?? `ДЕМОНСТРАЦИОННЫЙ ДОСТУП\nПродукт: ${title}\nДемо-код: DEMO-${randomBytes(8).toString("hex").toUpperCase()}\nЭто тестовая покупка. Код не активирует реальную подписку.`;
    const [order] = await tx.insert(orders).values({
      orderNo: sql`nextval('site_order_number')::int`, secret: randomBytes(16).toString("hex"), userId, productId: product.id,
      status: "delivered", totalCents: price, discount: Math.round(discount * 10_000), promo: promo || null,
      networkId: `balance-${w.mode}`, networkLabel: w.mode === "demo" ? "Демо-баланс" : "Баланс кошелька", assetLabel: "RUB",
      depositAddress: "", amountCrypto: (price / 100).toFixed(2), credentials,
    }).returning();
    if (stock) {
      await tx.update(inventory).set({ orderId: order.id }).where(eq(inventory.id, stock.id));
      await tx.update(products).set({ stock: sql`greatest(${products.stock} - 1, 0)`, soldCount: sql`${products.soldCount} + 1` }).where(eq(products.id, product.id));
    }
    const [op] = await tx.insert(ops).values({ walletId: w.id, kind: "purchase", status: "completed", amountCents: price,
      description: title, method: "Баланс", idempotencyKey: key, orderId: order.id, productId: product.id, completedAt: new Date() }).returning();
    await entry(tx, w, op.id, "purchase_debit", -price);
    return { order, product, justDelivered: true, demo: w.mode === "demo" };
  });
}

export async function requestWithdrawal(userId: string, body: Record<string, unknown>) {
  const cents = amount(body.amountCents, rules.minWithdrawalCents, rules.dailyWithdrawalCents);
  const key = idempotency(body.idempotencyKey);
  const fee = withdrawalFee(cents);
  ensure(body.confirmed === true && body.expectedFeeCents === fee, "CONFIRM_REQUIRED");
  const address = typeof body.address === "string" ? body.address.trim() : "";
  ensure(isTronAddress(address), "INVALID_ADDRESS");
  const current = await account(userId);
  if (current.mode === "live") {
    await rateLimit(`withdraw-auth:${userId}`, 5, 900);
    const [u] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, userId));
    ensure(u?.hash, "PASSWORD_REQUIRED", 403);
    ensure(typeof body.password === "string" && body.password.length <= 256 && verifyPassword(body.password, u.hash), "WRONG_PASSWORD", 403);
  }
  return db.transaction(async (tx) => {
    const w = await lock(tx, current.id); usable(w);
    const prior = await findExisting(tx, w.id, key);
    if (prior) {
      ensure(prior.kind === "withdrawal" && prior.amountCents === cents && prior.address === address, "IDEMPOTENCY_CONFLICT", 409);
      return serialize(prior);
    }
    if (w.mode === "live") ensure(w.verification === "verified", "VERIFICATION_REQUIRED", 403);
    ensure(w.balanceCents >= cents, "INSUFFICIENT_BALANCE", 409);
    ensure(w.balanceCents - await immatureDeposits(tx, w) >= cents, "WITHDRAWAL_HOLD", 409);
    const [pending] = await tx.select({ id: ops.id }).from(ops).where(and(eq(ops.walletId, w.id), eq(ops.kind, "withdrawal"), inArray(ops.status, ["pending", "processing"]))).limit(1);
    ensure(!pending, "WITHDRAWAL_PENDING", 409);
    const [daily] = await tx.select({ total: sql<number>`coalesce(sum(${ops.amountCents}), 0)::int` }).from(ops).where(and(eq(ops.walletId, w.id), eq(ops.kind, "withdrawal"), inArray(ops.status, ["pending", "processing", "completed"]), gte(ops.createdAt, new Date(Date.now() - 86400_000))));
    ensure(daily.total + cents <= rules.dailyWithdrawalCents, "DAILY_LIMIT", 409);
    const [op] = await tx.insert(ops).values({ walletId: w.id, kind: "withdrawal", amountCents: cents, feeCents: fee, description: "Вывод на кошелёк", method: "USDT · TRC-20", address, idempotencyKey: key }).returning();
    await entry(tx, w, op.id, "withdrawal_reserve", -cents, cents);
    await tx.insert(walletAudit).values({ actor: userId, action: "withdrawal.requested", walletId: w.id, details: { operationId: op.id, amountCents: cents, feeCents: fee } });
    return serialize(op);
  });
}

export async function cancelOperation(userId: string, operationId: string) {
  ensure(validId(operationId), "INVALID_REQUEST");
  const current = await account(userId);
  return db.transaction(async (tx) => {
    const w = await lock(tx, current.id);
    const [op] = await tx.select().from(ops).where(and(eq(ops.id, operationId), eq(ops.walletId, w.id))).for("update");
    ensure(op, "NOT_FOUND", 404);
    if (op.status === "cancelled") return serialize(op);
    ensure(op.status === "pending", "CANNOT_CANCEL", 409);
    // Live invoices may already be paid at the provider; never discard them locally.
    ensure(op.kind === "withdrawal" || (op.kind === "deposit" && w.mode === "demo"), "CANNOT_CANCEL", 409);
    if (op.kind === "withdrawal") await entry(tx, w, op.id, "withdrawal_reversal", op.amountCents, -op.amountCents);
    const [updated] = await tx.update(ops).set({ status: "cancelled", completedAt: new Date() }).where(eq(ops.id, op.id)).returning();
    return serialize(updated);
  });
}

export async function reviewWithdrawal(body: Record<string, unknown>, actor: string) {
  ensure(validId(body.operationId), "INVALID_REQUEST");
  const [initial] = await db.select().from(ops).where(eq(ops.id, body.operationId));
  ensure(initial?.kind === "withdrawal", "NOT_FOUND", 404);
  ensure(["processing", "completed", "rejected"].includes(String(body.status)), "INVALID_REQUEST");
  const status = body.status as "processing" | "completed" | "rejected";
  const rawReference = typeof body.reference === "string" ? body.reference.trim().slice(0, 500) : "";
  const reference = status === "completed" ? rawReference.toLowerCase() : rawReference;
  ensure(reference.length >= 8, "REVIEW_REFERENCE_REQUIRED");
  return db.transaction(async (tx) => {
    const w = await lock(tx, initial.walletId);
    ensure(w.mode === "live", "DEMO_NO_REAL_PAYOUT", 409);
    const [op] = await tx.select().from(ops).where(eq(ops.id, initial.id)).for("update");
    if (op.status === status) return serialize(op);
    ensure(["pending", "processing"].includes(op.status), "INVALID_STATE", 409);
    if (status !== "rejected") ensure(w.verification === "verified", "VERIFICATION_REQUIRED", 403);
    if (status === "completed") {
      ensure(op.status === "processing" && /^[a-f0-9]{64}$/i.test(reference), "PAYOUT_PROOF_REQUIRED", 409);
      await entry(tx, w, op.id, "withdrawal_paid", 0, -op.amountCents);
    } else if (status === "rejected") {
      await entry(tx, w, op.id, "withdrawal_reversal", op.amountCents, -op.amountCents);
    }
    const [updated] = await tx.update(ops).set({ status, reference, completedAt: status === "processing" ? null : new Date() }).where(eq(ops.id, op.id)).returning();
    await tx.insert(walletAudit).values({ actor, action: `withdrawal.${status}`, walletId: w.id, details: { operationId: op.id, reference } });
    return serialize(updated);
  });
}
