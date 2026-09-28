import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium, expect } from "@playwright/test";
import { eq, inArray, or } from "drizzle-orm";
import { db, pool } from "../src/db/index.ts";
import { adminAudit, orders, products, sessions, users, wallets, walletEntries, walletOperations, walletRateLimits } from "../src/db/schema.ts";

const base = process.env.TEST_BASE_URL ?? "http://localhost:3000";
let targetId = "";
let adminId = "";
let productBefore: { id: string; priceCents: number; isActive: boolean } | null = null;
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
try {
  const adminEmail = `admin-ui-${randomUUID()}@example.com`;
  const adminPassword = `Admin-${randomUUID()}!`;
  const password = `Ui-${randomUUID()}!`;
  const registration = await fetch(`${base}/api/auth/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "UI Test Client", email: `admin-target-ui-${randomUUID()}@example.com`, password }) });
  const target = await registration.json();
  assert.ok(registration.ok, JSON.stringify(target)); targetId = target.user.id;

  // The operator account is created by normal registration, then promoted manually in the DB.
  const candidateResponse = await fetch(`${base}/api/auth/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Promoted Operator UI", email: adminEmail, password: adminPassword }) });
  const candidate = await candidateResponse.json();
  assert.ok(candidateResponse.ok, JSON.stringify(candidate));
  adminId = candidate.user.id;
  assert.equal(candidate.user.role, "user");
  await db.update(users).set({ role: "admin", status: "active" }).where(eq(users.id, adminId));

  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${base}/admin`, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Вход администратора" })).toBeVisible();
  await page.getByLabel("Email администратора").fill(adminEmail);
  await page.getByLabel("Пароль", { exact: true }).fill(adminPassword);
  await page.getByRole("button", { name: "Войти в панель" }).click();
  await expect(page.getByRole("heading", { name: "Добро пожаловать" })).toBeVisible();
  await page.screenshot({ path: "artifacts/admin-overview.png", fullPage: true });

  await page.getByRole("button", { name: /Пользователи/ }).first().click();
  await page.getByPlaceholder("Имя, email или LVK-ID").fill(target.user.customerId);
  await page.getByRole("button", { name: "Найти", exact: true }).click();
  const row = page.locator(".ad-tr").filter({ hasText: target.user.customerId });
  await expect(row).toHaveCount(1);

  await row.getByTitle("Начислить баланс").click();
  await expect(page.getByRole("heading", { name: "Начислить баланс" })).toBeVisible();
  await page.getByLabel("Сумма начисления").fill("1500");
  await page.getByLabel("Основание / комментарий").fill("Начисление через UI-тест");
  await page.getByLabel("Подтверждение администратора").fill(adminPassword);
  await page.getByRole("dialog").getByRole("button", { name: /Начислить/ }).click();
  await expect(page.getByText("Баланс начислен", { exact: true })).toBeVisible();

  await row.getByTitle("Выдать товар").click();
  await page.getByLabel("Основание / комментарий").fill("Выдача через UI-тест");
  await page.getByLabel("Подтверждение администратора").fill(adminPassword);
  await page.getByRole("dialog").getByRole("button", { name: "Выдать товар" }).click();
  await expect(page.getByText("Товар выдан", { exact: true })).toBeVisible();

  await row.getByTitle("Заблокировать").click();
  await page.getByLabel("Причина блокировки").fill("Проверка блокировки через интерфейс");
  await page.getByLabel("Подтверждение администратора").fill(adminPassword);
  await page.getByRole("dialog").getByRole("button", { name: "Заблокировать" }).click();
  await expect(page.getByText("Пользователь заблокирован", { exact: true })).toBeVisible();
  await page.screenshot({ path: "artifacts/admin-users.png", fullPage: true });

  const bannedRow = page.locator(".ad-tr").filter({ hasText: target.user.customerId });
  await bannedRow.getByTitle("Разблокировать").click();
  await page.getByLabel("Подтверждение администратора").fill(adminPassword);
  await page.getByRole("dialog").getByRole("button", { name: "Разблокировать" }).click();
  await expect(page.getByText("Пользователь разблокирован", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Журнал действий", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Аудит действий" })).toBeVisible();
  await expect(page.locator(".ad-audit-list")).toContainText("Баланс начислен");
  await page.screenshot({ path: "artifacts/admin-audit.png", fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 1440);

  // Products: reprice and enable a disabled team plan through the UI (original state restored in finally).
  await fetch(base);
  const [pro8] = await db.select().from(products).where(eq(products.slug, "chatgpt-pro-8"));
  assert.ok(pro8, "chatgpt-pro-8 must be seeded");
  productBefore = { id: pro8.id, priceCents: pro8.priceCents, isActive: pro8.isActive };
  await db.update(products).set({ isActive: false, priceCents: 2_299_000 }).where(eq(products.id, pro8.id));
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Продукты/ }).click();
  await expect(page.getByRole("heading", { name: "Продукты", exact: true })).toBeVisible();
  const card = page.locator(".ad-product").filter({ hasText: "chatgpt-pro-8" });
  await expect(card).toHaveCount(1);
  await expect(card.locator(".ad-status")).toHaveText("Скрыт");
  await card.getByRole("button", { name: "Изменить цену" }).click();
  await page.getByLabel("Новая цена").fill("19990");
  await page.getByLabel("Подтверждение администратора").fill(adminPassword);
  await page.getByRole("dialog").getByRole("button", { name: "Сохранить цену" }).click();
  await expect(page.getByText(/Цена обновлена/)).toBeVisible();
  await card.getByRole("button", { name: "Включить продажу" }).click();
  await page.getByLabel("Подтверждение администратора").fill(adminPassword);
  await page.getByRole("dialog").getByRole("button", { name: "Включить", exact: true }).click();
  await expect(page.getByText("Продукт включён в продажу", { exact: true })).toBeVisible();
  await expect(card.locator(".ad-status")).toHaveText("В продаже");
  const [pro8After] = await db.select().from(products).where(eq(products.id, pro8.id));
  assert.equal(pro8After.priceCents, 1_999_000);
  assert.equal(pro8After.isActive, true);
  assert.ok((await (await fetch(base)).text()).includes("chatgpt-pro-8"), "enabled plan must render in the storefront");
  await page.screenshot({ path: "artifacts/admin-products.png", fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 1440);

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  mobile.on("pageerror", (e) => errors.push(e.message));
  await mobile.goto(`${base}/admin`, { waitUntil: "networkidle" });
  await mobile.getByLabel("Email администратора").fill(adminEmail);
  await mobile.getByLabel("Пароль", { exact: true }).fill(adminPassword);
  await mobile.getByRole("button", { name: "Войти в панель" }).click();
  await expect(mobile.getByRole("heading", { name: "Добро пожаловать" })).toBeVisible();
  await mobile.screenshot({ path: "artifacts/admin-mobile.png", fullPage: true });
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth), 390);
  await mobile.getByRole("button", { name: "Открыть меню" }).click();
  await mobile.getByRole("button", { name: /Пользователи/ }).click();
  await expect(mobile.getByRole("heading", { name: "Пользователи", exact: true })).toBeVisible();
  await mobile.getByRole("button", { name: "Открыть меню" }).click();
  await mobile.getByRole("button", { name: /Продукты/ }).click();
  await expect(mobile.getByRole("heading", { name: "Продукты", exact: true })).toBeVisible();
  // The menu slides out after navigation; wait for it to fully leave the screen.
  await expect.poll(() => mobile.locator(".ad-sidebar").evaluate((el) => el.getBoundingClientRect().right)).toBeLessThanOrEqual(1);
  await mobile.screenshot({ path: "artifacts/admin-products-mobile.png", fullPage: true });
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth), 390);
  assert.deepEqual(errors, []);
  console.log("PASS: admin login, LVK-ID search, product repricing + enabling, step-up credit, product grant, ban/unban, audit view, responsive layout, and mobile navigation. No page errors.");
} finally {
  await browser.close();
  if (targetId) {
    await db.delete(adminAudit).where(or(eq(adminAudit.actorUserId, targetId), eq(adminAudit.targetUserId, targetId)));
    const ws = await db.select({ id: wallets.id }).from(wallets).where(eq(wallets.userId, targetId));
    if (ws.length) {
      const ids = ws.map((w) => w.id);
      await db.delete(walletEntries).where(inArray(walletEntries.walletId, ids));
      await db.delete(walletOperations).where(inArray(walletOperations.walletId, ids));
      await db.delete(wallets).where(inArray(wallets.id, ids));
    }
    await db.delete(orders).where(eq(orders.userId, targetId));
    await db.delete(sessions).where(eq(sessions.userId, targetId));
    await db.delete(users).where(eq(users.id, targetId));
    await db.delete(walletRateLimits).where(inArray(walletRateLimits.key, [`admin:${targetId}`]));
  }
  if (adminId) {
    await db.delete(adminAudit).where(or(eq(adminAudit.actorUserId, adminId), eq(adminAudit.targetUserId, adminId)));
    await db.delete(sessions).where(eq(sessions.userId, adminId));
    await db.delete(walletRateLimits).where(inArray(walletRateLimits.key, [`admin:${adminId}`, `admin-confirm:${adminId}`, `login:${adminId}`]));
    await db.delete(users).where(eq(users.id, adminId));
  }
  if (productBefore) await db.update(products).set({ priceCents: productBefore.priceCents, isActive: productBefore.isActive }).where(eq(products.id, productBefore.id));
  await pool.end();
}
