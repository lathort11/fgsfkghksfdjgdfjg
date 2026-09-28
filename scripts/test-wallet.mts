import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, pool } from "../src/db/index.ts";
import { products, users, sessions, wallets, orders, walletEntries, walletOperations, walletAudit, walletRateLimits } from "../src/db/schema.ts";

const base = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const created: string[] = [];
async function api(path: string, cookie = "", body?: Record<string, unknown>, origin = base) {
  const response = await fetch(`${base}${path}`, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", Origin: origin, ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  return { status: response.status, data, cookie: response.headers.get("set-cookie")?.split(";")[0] ?? "" };
}
async function register(label: string) {
  const result = await api("/api/auth/register", "", { name: `Wallet QA ${label}`, email: `wallet-test-${randomUUID()}@example.com`, password: `QA-${randomUUID()}` });
  assert.ok(result.status === 200 || result.status === 201, JSON.stringify(result.data));
  created.push(result.data.user.id);
  assert.ok(result.cookie);
  return result;
}
try {
  assert.equal((await api("/api/health")).status, 200);
  assert.equal((await api("/api/wallet")).status, 401);
  const a = await register("A"), b = await register("B");
  const cookie = a.cookie;
  let snap = await api("/api/wallet", cookie);
  assert.equal(snap.data.mode, "demo", "Safety: tests must only run in demo mode");
  assert.equal(snap.data.balanceCents, 0);
  assert.equal((await api("/api/wallet", cookie, { action: "deposit", amountCents: -100, idempotencyKey: randomUUID() })).status, 400);
  const deposit = { action: "deposit", amountCents: 1_000_000, asset: "USDT", idempotencyKey: randomUUID() };
  const [d1, d2] = await Promise.all([api("/api/wallet", cookie, deposit), api("/api/wallet", cookie, deposit)]);
  assert.equal(d1.status, 200, JSON.stringify(d1.data)); assert.equal(d2.status, 200);
  assert.equal(d1.data.operation.id, d2.data.operation.id);
  assert.equal((await api("/api/wallet", cookie, { ...deposit, amountCents: 900_000 })).status, 409);
  const confirm = { action: "confirm-deposit", operationId: d1.data.operation.id };
  const credits = await Promise.all([api("/api/wallet", cookie, confirm), api("/api/wallet", cookie, confirm)]);
  assert.ok(credits.every((r) => r.status === 200), JSON.stringify(credits));
  snap = await api("/api/wallet", cookie);
  assert.equal(snap.data.balanceCents, 1_000_000, "Deposit must credit exactly once");
  assert.equal((await api("/api/wallet", b.cookie, confirm)).status, 404, "Cross-account confirmation must fail");
  assert.equal((await api("/api/wallet/webhook", "", { update_type: "invoice_paid" })).status, 403);
  assert.equal((await api("/api/order/pay", cookie, { secret: "123456", txHash: "invented-tx" })).status, 410);
  const [chat] = await db.select().from(products).where(eq(products.slug, "chatgpt-pro"));
  const [gemini] = await db.select().from(products).where(eq(products.slug, "gemini-pro-18"));
  assert.ok(chat && gemini);
  const purchase = { productId: chat.id, expectedTotalCents: chat.priceCents, confirmed: true, idempotencyKey: randomUUID() };
  assert.equal((await api("/api/order", cookie, purchase, "https://attacker.invalid")).status, 403);
  assert.equal((await api("/api/order", cookie, { ...purchase, expectedTotalCents: 1 })).status, 409);
  const bought = await Promise.all([api("/api/order", cookie, purchase), api("/api/order", cookie, purchase)]);
  assert.ok(bought.every((r) => r.status === 200), JSON.stringify(bought));
  assert.equal(bought[0].data.order.id, bought[1].data.order.id, "Purchase replay must return the same order");
  assert.match(bought[0].data.order.credentials, /ДЕМОНСТРАЦИОННЫЙ/);
  assert.equal((await api("/api/wallet", cookie)).data.balanceCents, 1_000_000 - chat.priceCents);
  const competing = await Promise.all([1, 2].map(() => api("/api/order", cookie, { productId: gemini.id, expectedTotalCents: gemini.priceCents, confirmed: true, idempotencyKey: randomUUID() })));
  assert.equal(competing.filter((r) => r.status === 200).length, 1, JSON.stringify(competing));
  assert.equal(competing.filter((r) => r.data.error === "INSUFFICIENT_BALANCE").length, 1);
  const balance = 1_000_000 - chat.priceCents - gemini.priceCents;
  assert.ok(balance >= 100_000);
  const withdraw = { action: "withdraw", amountCents: 100_000, expectedFeeCents: 10_000, address: "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb", confirmed: true, idempotencyKey: randomUUID() };
  assert.equal((await api("/api/wallet", cookie, { ...withdraw, expectedFeeCents: 0 })).status, 400);
  const [w1, w2] = await Promise.all([api("/api/wallet", cookie, withdraw), api("/api/wallet", cookie, withdraw)]);
  assert.equal(w1.status, 200, JSON.stringify(w1.data)); assert.equal(w2.status, 200);
  assert.equal(w1.data.operation.id, w2.data.operation.id);
  assert.equal(w1.data.operation.feeCents, 10_000);
  assert.equal(w1.data.wallet.heldCents, 100_000); assert.equal(w1.data.wallet.balanceCents, balance - 100_000);
  assert.equal((await api("/api/wallet", b.cookie, { action: "cancel", operationId: w1.data.operation.id })).status, 404);
  const cancelled = await Promise.all([1, 2].map(() => api("/api/wallet", cookie, { action: "cancel", operationId: w1.data.operation.id })));
  assert.ok(cancelled.every((r) => r.status === 200), JSON.stringify(cancelled));
  snap = await api("/api/wallet", cookie);
  assert.equal(snap.data.balanceCents, balance); assert.equal(snap.data.heldCents, 0);
  assert.equal(snap.data.depositedCents, 1_000_000);
  assert.equal(snap.data.spentCents, chat.priceCents + gemini.priceCents);
  assert.equal((await api("/api/wallet", b.cookie)).data.balanceCents, 0);
  const [w] = await db.select().from(wallets).where(and(eq(wallets.userId, a.data.user.id), eq(wallets.mode, "demo")));
  const [ledger] = await db.select({ total: sql<number>`sum(${walletEntries.deltaCents})::int`, held: sql<number>`sum(${walletEntries.deltaHeldCents})::int`, count: sql<number>`count(*)::int` }).from(walletEntries).where(eq(walletEntries.walletId, w.id));
  assert.equal(ledger.total, w.balanceCents); assert.equal(ledger.held, w.heldCents); assert.equal(ledger.count, 5);
  const mine = await api("/api/order/mine", cookie);
  assert.equal(mine.data.orders.length, 2);
  console.log("PASS: auth, strict amounts, idempotent deposit, payment verification boundary, owner isolation, origin protection, price tamper rejection, concurrent purchases, insufficient funds, fee enforcement, withdrawal reservation, replay-safe cancellation, persisted order credentials, and ledger reconciliation.");
} finally {
  for (const id of created) {
    const ws = await db.select({ id: wallets.id }).from(wallets).where(eq(wallets.userId, id));
    if (ws.length) {
      const ids = ws.map((w) => w.id);
      await db.delete(walletEntries).where(inArray(walletEntries.walletId, ids));
      await db.delete(walletAudit).where(inArray(walletAudit.walletId, ids));
      await db.delete(walletOperations).where(inArray(walletOperations.walletId, ids));
      await db.delete(wallets).where(inArray(wallets.id, ids));
    }
    await db.delete(orders).where(eq(orders.userId, id));
    await db.delete(sessions).where(eq(sessions.userId, id));
    await db.delete(walletRateLimits).where(inArray(walletRateLimits.key, [`wallet:${id}`, `withdraw-auth:${id}`]));
    await db.delete(users).where(eq(users.id, id));
  }
  await pool.end();
}
