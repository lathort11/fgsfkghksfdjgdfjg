import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, inArray, or } from "drizzle-orm";
import { db, pool } from "../src/db/index.ts";
import { adminAudit, orders, products, sessions, users, wallets, walletEntries, walletOperations, walletRateLimits } from "../src/db/schema.ts";

const base = process.env.TEST_BASE_URL ?? "http://localhost:3000";
let targetId = "";
let adminId = "";
let managedOriginal: { id: string; priceCents: number; isActive: boolean } | null = null;

async function api(path: string, cookie = "", body?: Record<string, unknown>) {
  const response = await fetch(`${base}${path}`, {
    method: body ? "POST" : "GET",
    headers: { ...(body ? { "Content-Type": "application/json", Origin: base } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  return { status: response.status, data, cookie: response.headers.get("set-cookie")?.split(";")[0] ?? "" };
}

try {
  const adminPassword = `Admin-${randomUUID()}!`;
  const userPassword = `User-${randomUUID()}!`;

  // Step 1 — both accounts start as ordinary self-service registrations.
  const registration = await api("/api/auth/register", "", { name: "Admin Test User", email: `admin-target-${randomUUID()}@example.com`, password: userPassword });
  assert.ok([200, 201].includes(registration.status), JSON.stringify(registration.data));
  targetId = registration.data.user.id;
  assert.match(registration.data.user.customerId, /^LVK-\d{6,}$/);
  assert.equal(registration.data.user.role, "user");
  const targetEmail = registration.data.user.email;

  const candidate = await api("/api/auth/register", "", { name: "Promoted Operator", email: `admin-promoted-${randomUUID()}@example.com`, password: adminPassword });
  assert.ok([200, 201].includes(candidate.status), JSON.stringify(candidate.data));
  adminId = candidate.data.user.id;
  assert.equal(candidate.data.user.role, "user", "registration must never grant the admin role");

  // Step 2 — the role is granted manually in the database, exactly as an operator does.
  await db.update(users).set({ role: "admin", status: "active" }).where(eq(users.id, adminId));
  const [promoted] = await db.select({ role: users.role, email: users.email }).from(users).where(eq(users.id, adminId));
  assert.equal(promoted.role, "admin");

  // A session created before the promotion keeps working only for ordinary pages.
  const denied = await api("/api/admin", registration.cookie);
  assert.equal(denied.status, 403, "ordinary user must not access admin API");

  // Step 3 — the promoted account signs in with its own credentials.
  const login = await api("/api/auth/login", "", { email: candidate.data.user.email, password: adminPassword });
  assert.equal(login.status, 200, JSON.stringify(login.data));
  assert.equal(login.data.user.role, "admin");
  assert.notEqual(login.data.user.customerId, registration.data.user.customerId);
  const adminCookie = login.cookie;

  let dashboard = await api(`/api/admin?q=${registration.data.user.customerId}`, adminCookie);
  assert.equal(dashboard.status, 200, JSON.stringify(dashboard.data));
  assert.equal(dashboard.data.users.length, 1);
  assert.equal(dashboard.data.users[0].id, targetId);
  assert.ok(!JSON.stringify(dashboard.data).includes("passwordHash"));
  assert.ok(!JSON.stringify(dashboard.data).includes("credentials"));

  const creditBody = { action: "credit", amountCents: 125_000, note: "Тестовое начисление #QA", idempotencyKey: randomUUID(), adminPassword };
  const wrongPassword = await api(`/api/admin/users/${targetId}`, adminCookie, { ...creditBody, adminPassword: "wrong" });
  assert.equal(wrongPassword.status, 403);
  const [credit1, credit2] = await Promise.all([
    api(`/api/admin/users/${targetId}`, adminCookie, creditBody),
    api(`/api/admin/users/${targetId}`, adminCookie, creditBody),
  ]);
  assert.equal(credit1.status, 200, JSON.stringify(credit1.data));
  assert.equal(credit2.status, 200, JSON.stringify(credit2.data));
  const wallet = await api("/api/wallet", registration.cookie);
  assert.equal(wallet.data.balanceCents, 125_000, "idempotent admin credit must apply once");
  assert.equal(wallet.data.operations[0].kind, "adjustment");

  dashboard = await api("/api/admin", adminCookie);
  const product = dashboard.data.products[0];
  assert.ok(product?.id);
  const grant = await api(`/api/admin/users/${targetId}`, adminCookie, { action: "grant-product", productId: product.id, note: "Подарок по тесту #QA", adminPassword });
  assert.equal(grant.status, 200, JSON.stringify(grant.data));
  const mine = await api("/api/order/mine", registration.cookie);
  assert.equal(mine.data.orders.length, 1);
  assert.match(mine.data.orders[0].credentials, /ДЕМОНСТРАЦИОННЫЙ ДОСТУП/);

  const selfBan = await api(`/api/admin/users/${adminId}`, adminCookie, { action: "ban", reason: "self ban attempt", adminPassword });
  assert.equal(selfBan.status, 409);
  const ban = await api(`/api/admin/users/${targetId}`, adminCookie, { action: "ban", reason: "Автоматический тест блокировки", adminPassword });
  assert.equal(ban.status, 200, JSON.stringify(ban.data));
  assert.equal((await api("/api/wallet", registration.cookie)).status, 401, "ban must revoke active session");
  assert.equal((await api("/api/auth/login", "", { email: targetEmail, password: userPassword })).status, 403, "banned user must not log in");

  const unban = await api(`/api/admin/users/${targetId}`, adminCookie, { action: "unban", adminPassword });
  assert.equal(unban.status, 200, JSON.stringify(unban.data));
  const relogin = await api("/api/auth/login", "", { email: targetEmail, password: userPassword });
  assert.equal(relogin.status, 200, JSON.stringify(relogin.data));
  const userCookie = relogin.cookie;

  dashboard = await api(`/api/admin?q=${registration.data.user.customerId}`, adminCookie);
  assert.equal(dashboard.data.users[0].status, "active");
  assert.equal(dashboard.data.users[0].balanceCents, 125_000);
  assert.equal(dashboard.data.users[0].ordersCount, 1);
  const audit = await api("/api/admin", adminCookie);
  const actions = audit.data.audit.filter((row: { targetCustomerId: string }) => row.targetCustomerId === registration.data.user.customerId).map((row: { action: string }) => row.action);
  for (const expected of ["authorization.denied", "balance.credited", "product.granted", "user.banned", "user.unbanned"]) assert.ok(actions.includes(expected), `missing audit ${expected}`);
  assert.ok(!JSON.stringify(audit.data.audit).includes(adminPassword));
  assert.ok(!JSON.stringify(audit.data.audit).includes("ДЕМОНСТРАЦИОННЫЙ ДОСТУП"));

  // Product management: team plans exist; price and visibility are enforced end to end.
  dashboard = await api("/api/admin", adminCookie);
  for (const slug of ["chatgpt-plus-4", "chatgpt-plus-8", "chatgpt-pro-4", "chatgpt-pro-8"]) {
    assert.ok(dashboard.data.products.some((p: { slug: string }) => p.slug === slug), `missing product ${slug}`);
  }
  const managed = dashboard.data.products.find((p: { slug: string }) => p.slug === "chatgpt-plus-4");
  const [stored] = await db.select().from(products).where(eq(products.id, managed.id));
  managedOriginal = { id: stored.id, priceCents: stored.priceCents, isActive: stored.isActive };
  await db.update(products).set({ isActive: false }).where(eq(products.id, stored.id)); // known starting state
  const productUrl = `/api/admin/products/${stored.id}`;
  const oldPrice = stored.priceCents;
  const newPrice = 123_400;
  const storefront = async () => (await fetch(base)).text();
  const buy = (expectedTotalCents: number) => api("/api/order", userCookie, { productId: stored.id, expectedTotalCents, confirmed: true, idempotencyKey: randomUUID() });
  assert.ok(!(await storefront()).includes("chatgpt-plus-4"), "hidden product must not render in the storefront");
  assert.equal((await buy(oldPrice)).status, 404, "hidden product must not be purchasable");
  assert.equal((await api(productUrl, userCookie, { action: "set-active", active: true, adminPassword: userPassword })).status, 403, "ordinary user must not manage products");
  assert.equal((await api(productUrl, adminCookie, { action: "set-active", active: true, adminPassword: "wrong" })).status, 403);
  const enable = await api(productUrl, adminCookie, { action: "set-active", active: true, note: "QA включение", adminPassword });
  assert.equal(enable.status, 200, JSON.stringify(enable.data));
  assert.ok((await storefront()).includes("chatgpt-plus-4"), "enabled product must render in the storefront");
  assert.equal((await api(productUrl, adminCookie, { action: "set-price", priceCents: newPrice, expectedPriceCents: oldPrice + 1, adminPassword })).status, 409, "stale edits must be rejected");
  assert.equal((await api(productUrl, adminCookie, { action: "set-price", priceCents: 50, expectedPriceCents: oldPrice, adminPassword })).status, 400);
  assert.equal((await api(productUrl, adminCookie, { action: "set-price", priceCents: oldPrice, expectedPriceCents: oldPrice, adminPassword })).status, 409);
  const reprice = await api(productUrl, adminCookie, { action: "set-price", priceCents: newPrice, expectedPriceCents: oldPrice, note: "QA цена", adminPassword });
  assert.equal(reprice.status, 200, JSON.stringify(reprice.data));
  assert.equal((await buy(oldPrice)).status, 409, "a buyer holding the old price must re-confirm");
  const bought = await buy(newPrice);
  assert.equal(bought.status, 200, JSON.stringify(bought.data));
  assert.equal((await api("/api/wallet", userCookie)).data.balanceCents, 125_000 - newPrice);
  const disable = await api(productUrl, adminCookie, { action: "set-active", active: false, note: "QA скрытие", adminPassword });
  assert.equal(disable.status, 200, JSON.stringify(disable.data));
  assert.equal((await buy(newPrice)).status, 404, "re-hidden product must not be purchasable");
  const productAudit = (await api("/api/admin", adminCookie)).data.audit.map((row: { action: string }) => row.action);
  for (const expected of ["product.enabled", "product.price_changed", "product.disabled"]) assert.ok(productAudit.includes(expected), `missing audit ${expected}`);

  // Role revocation must close panel access on the next request.
  await db.update(users).set({ role: "user" }).where(eq(users.id, adminId));
  assert.equal((await api("/api/admin", adminCookie)).status, 403, "revoked admin must lose panel access");
  console.log("PASS: register → manual DB promotion → panel login, product visibility + repricing with stale-price protection, deny-by-default, role checks, step-up password, idempotent credit, product grant, admin protection, session revocation, banned login rejection, unban, safe output, audit trail, and role revocation.");
} finally {
  for (const id of [targetId, adminId].filter(Boolean)) {
    await db.delete(adminAudit).where(or(eq(adminAudit.actorUserId, id), eq(adminAudit.targetUserId, id)));
    const ws = await db.select({ id: wallets.id }).from(wallets).where(eq(wallets.userId, id));
    if (ws.length) {
      const ids = ws.map((w) => w.id);
      await db.delete(walletEntries).where(inArray(walletEntries.walletId, ids));
      await db.delete(walletOperations).where(inArray(walletOperations.walletId, ids));
      await db.delete(wallets).where(inArray(wallets.id, ids));
    }
    await db.delete(orders).where(eq(orders.userId, id));
    await db.delete(sessions).where(eq(sessions.userId, id));
    await db.delete(walletRateLimits).where(inArray(walletRateLimits.key, [`admin:${id}`, `admin-confirm-fail:${id}`, `withdraw-auth:${id}`]));
    await db.delete(users).where(eq(users.id, id));
  }
  if (managedOriginal) await db.update(products).set({ priceCents: managedOriginal.priceCents, isActive: managedOriginal.isActive }).where(eq(products.id, managedOriginal.id));
  await pool.end();
}
