import "server-only";
import { randomBytes } from "node:crypto";
import { and, asc, eq, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  orders, products, tokenAccounts, tokenBank, tokenBalances,
  tokenModels, tokenPurchases, wallets, walletEntries, walletOperations as ops,
} from "@/db/schema";
import { ensure, idempotency } from "@/lib/wallet-security";
import {
  TOKEN_BALANCE_CAP, TOKEN_BANK_INITIAL, TOKEN_MIN_PURCHASE,
  TOKEN_PRICE_PER_MILLION_CENTS, TOKEN_PRODUCT_SLUG, tokenCostCents, type TokenSnapshot,
} from "@/lib/tokens-shared";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Both models share one fixed $0.30 per million rate. Opus 5 starts disabled. */
const MODEL_SEED = [
  { slug: "opus-5", label: "Claude Opus 5", inputPerMillionCents: TOKEN_PRICE_PER_MILLION_CENTS, outputPerMillionCents: TOKEN_PRICE_PER_MILLION_CENTS, isActive: false, sortOrder: 1 },
  { slug: "opus-5-5", label: "Claude Opus 5.5", inputPerMillionCents: TOKEN_PRICE_PER_MILLION_CENTS, outputPerMillionCents: TOKEN_PRICE_PER_MILLION_CENTS, isActive: true, sortOrder: 2 },
];

async function tokenProduct() {
  const [product] = await db.select().from(products).where(eq(products.slug, TOKEN_PRODUCT_SLUG)).limit(1);
  return product ?? null;
}

/** Missing models are inserted; visibility is never reset. Old split rates are normalized. */
export async function seedTokenModels() {
  const product = await tokenProduct();
  if (!product) return null;
  const existing = await db.select({ slug: tokenModels.slug }).from(tokenModels).where(eq(tokenModels.productId, product.id));
  const known = new Set(existing.map((row) => row.slug));
  const missing = MODEL_SEED.filter((m) => !known.has(m.slug)).map((m) => ({ ...m, productId: product.id }));
  if (missing.length) await db.insert(tokenModels).values(missing).onConflictDoNothing();
  await db.update(tokenModels).set({
    inputPerMillionCents: TOKEN_PRICE_PER_MILLION_CENTS,
    outputPerMillionCents: TOKEN_PRICE_PER_MILLION_CENTS,
  }).where(and(
    eq(tokenModels.productId, product.id),
    or(ne(tokenModels.inputPerMillionCents, TOKEN_PRICE_PER_MILLION_CENTS), ne(tokenModels.outputPerMillionCents, TOKEN_PRICE_PER_MILLION_CENTS)),
  ));
  return product;
}

/** Seed once from any historic paid token orders, without replenishing on reload. */
async function ensureTokenBank(productId: string) {
  const [existing] = await db.select().from(tokenBank).where(eq(tokenBank.productId, productId)).limit(1);
  if (existing) return existing;
  const [historic] = await db.select({
    sold: sql<number>`coalesce(sum(${tokenPurchases.inputTokens} + ${tokenPurchases.outputTokens}), 0)::float8`,
  }).from(tokenPurchases)
    .innerJoin(tokenModels, eq(tokenPurchases.modelId, tokenModels.id))
    .where(eq(tokenModels.productId, productId));
  await db.insert(tokenBank).values({
    productId,
    availableTokens: Math.max(0, TOKEN_BANK_INITIAL - (historic?.sold ?? 0)),
  }).onConflictDoNothing();
  const [bank] = await db.select().from(tokenBank).where(eq(tokenBank.productId, productId)).limit(1);
  return bank;
}

export async function listTokenModels() {
  await seedTokenModels();
  return db.select().from(tokenModels).orderBy(asc(tokenModels.sortOrder));
}

export async function tokenSnapshot(userId: string | null): Promise<TokenSnapshot> {
  const product = await seedTokenModels();
  const models = product
    ? await db.select().from(tokenModels).where(eq(tokenModels.productId, product.id)).orderBy(asc(tokenModels.sortOrder))
    : [];
  const bank = product ? await ensureTokenBank(product.id) : null;
  const common = {
    models: models.map((m) => ({ slug: m.slug, label: m.label, isActive: m.isActive })),
    cap: TOKEN_BALANCE_CAP,
    bankAvailableTokens: bank?.availableTokens ?? null,
    pricePerMillionCents: TOKEN_PRICE_PER_MILLION_CENTS,
  };
  if (!userId) return { ...common, apiKey: null, balances: [], balanceCents: 0 };
  const bySlug = new Map(models.map((m) => [m.id, m.slug]));
  const [account, balances, wallet] = await Promise.all([
    db.select({ apiKey: tokenAccounts.apiKey }).from(tokenAccounts).where(eq(tokenAccounts.userId, userId)).limit(1),
    db.select().from(tokenBalances).where(eq(tokenBalances.userId, userId)),
    db.select({ balanceCents: wallets.balanceCents }).from(wallets).where(and(eq(wallets.userId, userId), eq(wallets.mode, "live"))).limit(1),
  ]);
  return {
    ...common,
    apiKey: account[0]?.apiKey ?? null,
    balances: balances.flatMap((balance) => {
      const slug = bySlug.get(balance.modelId);
      return slug ? [{ modelSlug: slug, inputTokens: balance.inputTokens, outputTokens: balance.outputTokens }] : [];
    }),
    balanceCents: wallet[0]?.balanceCents ?? 0,
  };
}

function tokenAmount(value: unknown): number {
  ensure(typeof value === "number" && Number.isSafeInteger(value) && value >= TOKEN_MIN_PURCHASE, "MIN_TOKENS");
  ensure(value <= TOKEN_BALANCE_CAP, "TOKEN_CAP");
  return value;
}

async function apiKeyFor(tx: Tx, userId: string): Promise<string> {
  const [existing] = await tx.select().from(tokenAccounts).where(eq(tokenAccounts.userId, userId)).limit(1);
  if (existing) return existing.apiKey;
  const key = `lvk-claude-${randomBytes(24).toString("base64url")}`;
  const [created] = await tx.insert(tokenAccounts).values({ userId, apiKey: key }).onConflictDoNothing().returning();
  if (created) return created.apiKey;
  const [row] = await tx.select().from(tokenAccounts).where(eq(tokenAccounts.userId, userId)).limit(1);
  return row.apiKey;
}

/**
 * The wallet, shared bank, order, ledger and user's token balance update in a
 * single transaction. A lock on the bank row prevents concurrent overselling.
 */
export async function purchaseTokens(userId: string, body: Record<string, unknown>) {
  ensure(body.confirmed === true, "CONFIRM_REQUIRED");
  const modelSlug = typeof body.modelSlug === "string" ? body.modelSlug.slice(0, 60) : "";
  const amountTokens = tokenAmount(body.amountTokens);
  const expected = typeof body.expectedTotalCents === "number" ? body.expectedTotalCents : -1;
  const key = idempotency(body.idempotencyKey);

  const product = await seedTokenModels();
  ensure(product?.isActive, "PRODUCT_NOT_FOUND", 404);
  await ensureTokenBank(product.id);
  await db.insert(wallets).values({ userId, mode: "live" }).onConflictDoNothing();

  return db.transaction(async (tx) => {
    const [wallet] = await tx.select().from(wallets).where(and(eq(wallets.userId, userId), eq(wallets.mode, "live"))).for("update");
    ensure(wallet, "WALLET_NOT_FOUND", 404);
    ensure(wallet.verification !== "blocked", "WALLET_BLOCKED", 403);

    const [prior] = await tx.select().from(ops).where(and(eq(ops.walletId, wallet.id), eq(ops.idempotencyKey, key)));
    if (prior) {
      const [purchased] = prior.orderId ? await tx.select({
        amount: sql<number>`${tokenPurchases.inputTokens} + ${tokenPurchases.outputTokens}`,
        modelSlug: tokenModels.slug,
      }).from(tokenPurchases).innerJoin(tokenModels, eq(tokenPurchases.modelId, tokenModels.id))
        .where(eq(tokenPurchases.orderId, prior.orderId)).limit(1) : [];
      ensure(prior.kind === "purchase" && prior.amountCents === expected && purchased?.amount === amountTokens && purchased.modelSlug === modelSlug, "IDEMPOTENCY_CONFLICT", 409);
      const [order] = await tx.select().from(orders).where(eq(orders.id, prior.orderId!));
      return { order, apiKey: await apiKeyFor(tx, userId), justDelivered: false };
    }

    const [currentProduct] = await tx.select().from(products).where(eq(products.id, product.id)).for("update");
    ensure(currentProduct?.isActive, "PRODUCT_NOT_FOUND", 404);
    const [model] = await tx.select().from(tokenModels).where(eq(tokenModels.slug, modelSlug)).for("share");
    ensure(model?.productId === product.id, "MODEL_NOT_FOUND", 404);
    ensure(model.isActive, "MODEL_DISABLED", 409);

    const cost = tokenCostCents(amountTokens);
    ensure(cost === expected, "PRICE_CHANGED", 409);
    ensure(wallet.balanceCents >= cost, "INSUFFICIENT_BALANCE", 409);

    const [stock] = await tx.select().from(tokenBank).where(eq(tokenBank.productId, product.id)).for("update");
    ensure(stock && stock.availableTokens >= amountTokens, "TOKEN_STOCK", 409);

    await tx.insert(tokenBalances).values({ userId, modelId: model.id }).onConflictDoNothing();
    const [balance] = await tx.select().from(tokenBalances)
      .where(and(eq(tokenBalances.userId, userId), eq(tokenBalances.modelId, model.id))).for("update");
    const nextInput = balance.inputTokens; // historical credits remain valid
    const nextOutput = balance.outputTokens + amountTokens;
    ensure(nextInput + nextOutput <= TOKEN_BALANCE_CAP, "TOKEN_CAP", 409);

    const apiKey = await apiKeyFor(tx, userId);
    const credentials = [
      "LIVKAMARKET · Claude API",
      `Model: claude-opus-5-5`,
      `API key: ${apiKey}`,
      "",
      "Endpoint (Anthropic): https://api.livkamarket.app/v1/messages",
      "Endpoint (OpenAI):    https://api.livkamarket.app/v1/chat/completions",
      "Header: x-api-key: <key>   or   Authorization: Bearer <key>",
      "",
      `Purchased: ${amountTokens.toLocaleString("en-US")} tokens`,
      `Token balance: ${(nextInput + nextOutput).toLocaleString("en-US")} tokens`,
    ].join("\n");

    const [order] = await tx.insert(orders).values({
      orderNo: sql`nextval('site_order_number')::int`, secret: randomBytes(16).toString("hex"),
      userId, productId: model.productId, status: "delivered", totalCents: cost, discount: 0,
      networkId: "balance", networkLabel: "Wallet balance", assetLabel: "USD",
      depositAddress: "", amountCrypto: (cost / 100).toFixed(2), credentials,
    }).returning();

    const [operation] = await tx.insert(ops).values({
      walletId: wallet.id, kind: "purchase", status: "completed", amountCents: cost,
      description: `${model.label} · tokens`, method: "Balance", idempotencyKey: key,
      orderId: order.id, productId: model.productId, completedAt: new Date(),
    }).returning();

    const nextBalance = wallet.balanceCents - cost;
    await tx.update(wallets).set({ balanceCents: nextBalance }).where(eq(wallets.id, wallet.id));
    await tx.insert(walletEntries).values({
      walletId: wallet.id, operationId: operation.id, event: "purchase_debit",
      deltaCents: -cost, deltaHeldCents: 0, balanceAfterCents: nextBalance,
    });
    await tx.update(tokenBalances).set({ outputTokens: nextOutput, updatedAt: new Date() }).where(eq(tokenBalances.id, balance.id));
    await tx.update(tokenBank).set({ availableTokens: stock.availableTokens - amountTokens, updatedAt: new Date() })
      .where(eq(tokenBank.productId, product.id));
    await tx.insert(tokenPurchases).values({
      orderId: order.id, userId, modelId: model.id, inputTokens: 0, outputTokens: amountTokens, totalCents: cost,
    });
    await tx.update(products).set({ soldCount: sql`${products.soldCount} + 1` }).where(eq(products.id, model.productId));

    return { order, apiKey, justDelivered: true };
  });
}
