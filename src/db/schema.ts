import {
  pgTable, uuid, text, timestamp, integer, pgEnum, boolean, jsonb, uniqueIndex, index, check, pgSequence, serial,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const orderStatusEnum = pgEnum("order_status", [
  "awaiting_payment",
  "confirming",
  "delivered",
  "cancelled",
]);

/*
 * Site tables use the explicit `site_` prefix so they never collide with the
 * bot's own tables (`users`, …managed by Alembic) in the shared `livkamarket`
 * PostgreSQL database.
 */
export const users = pgTable("site_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Public support identifier. Internal APIs continue using the UUID above.
  customerNo: serial("customer_no").notNull().unique(),
  email: text("email").notNull().unique(),
  // Nullable: users who signed in only through Telegram have no password.
  passwordHash: text("password_hash"),
  name: text("name").notNull(),
  role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
  status: text("status", { enum: ["active", "banned"] }).notNull().default("active"),
  bannedAt: timestamp("banned_at", { withTimezone: true }),
  banReason: text("ban_reason"),
  telegramId: text("telegram_id").unique(),
  telegramUsername: text("telegram_username"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check("site_user_role_valid", sql`${t.role} IN ('user', 'admin')`),
  check("site_user_status_valid", sql`${t.status} IN ('active', 'banned')`),
]);

export const sessions = pgTable("site_sessions", {
  token: text("token").primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  priceCents: integer("price_cents").notNull(),
  per: text("per_key").notNull(),
  accent: text("accent").notNull(),
  icon: text("icon").notNull(),
  kind: text("kind").notNull().default("account"),
  stock: integer("stock").notNull().default(0),
  soldCount: integer("sold_count").notNull().default(0),
  isFeatured: boolean("is_featured").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderNo: integer("order_no").notNull().unique(),
  secret: text("secret").notNull().unique(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  status: orderStatusEnum("status").notNull().default("awaiting_payment"),
  promo: text("promo"),
  totalCents: integer("total_cents").notNull(),
  discount: integer("discount_bps").notNull().default(0),
  networkId: text("network_id").notNull(),
  networkLabel: text("network_label").notNull(),
  assetLabel: text("asset_label").notNull(),
  depositAddress: text("deposit_address").notNull(),
  amountCrypto: text("amount_crypto").notNull(),
  rateUsd: text("rate_usd").notNull().default(""),
  txHash: text("tx_hash"),
  credentials: text("credentials"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type ProductRow = typeof products.$inferSelect;
export type OrderRow = typeof orders.$inferSelect;

/* One real-money wallet per user. Money is integer US cents.
 * The `mode` column is kept for backwards compatibility (the DB check still
 * allows legacy 'demo' rows) but the app only ever reads and writes 'live'. */
export const wallets = pgTable("site_wallets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  mode: text("mode", { enum: ["live"] }).notNull().default("live"),
  balanceCents: integer("balance_cents").notNull().default(0),
  heldCents: integer("held_cents").notNull().default(0),
  verification: text("verification", { enum: ["unverified", "verified", "blocked"] }).notNull().default("unverified"),
  verificationReference: text("verification_reference"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("site_wallet_user_mode").on(t.userId, t.mode),
  check("site_wallet_balance_nonnegative", sql`${t.balanceCents} >= 0 AND ${t.balanceCents} <= 100000000`),
  check("site_wallet_held_nonnegative", sql`${t.heldCents} >= 0`),
  check("site_wallet_mode_valid", sql`${t.mode} IN ('demo', 'live')`),
]);

export const walletOperations = pgTable("site_wallet_operations", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletId: uuid("wallet_id").notNull().references(() => wallets.id),
  kind: text("kind", { enum: ["deposit", "purchase", "withdrawal", "adjustment"] }).notNull(),
  status: text("status", { enum: ["pending", "processing", "completed", "cancelled", "rejected", "expired"] }).notNull().default("pending"),
  amountCents: integer("amount_cents").notNull(),
  feeCents: integer("fee_cents").notNull().default(0),
  idempotencyKey: text("idempotency_key").notNull(),
  description: text("description").notNull(),
  method: text("method").notNull(),
  address: text("address"),
  externalId: text("external_id").unique(),
  paymentUrl: text("payment_url"),
  reference: text("reference"),
  orderId: uuid("order_id").references(() => orders.id),
  productId: uuid("product_id").references(() => products.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (t) => [
  uniqueIndex("site_wallet_idempotency").on(t.walletId, t.idempotencyKey),
  uniqueIndex("site_wallet_unique_payout_reference").on(t.reference).where(sql`${t.kind} = 'withdrawal' AND ${t.status} = 'completed'`),
  index("site_wallet_history").on(t.walletId, t.createdAt),
  check("site_wallet_operation_amount", sql`${t.amountCents} > 0 AND ${t.feeCents} >= 0 AND ${t.feeCents} < ${t.amountCents}`),
]);

/* Append-only journal: cancellation writes a reversal, never erases a debit. */
export const walletEntries = pgTable("site_wallet_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletId: uuid("wallet_id").notNull().references(() => wallets.id),
  operationId: uuid("operation_id").notNull().references(() => walletOperations.id),
  event: text("event").notNull(),
  deltaCents: integer("delta_cents").notNull(),
  deltaHeldCents: integer("delta_held_cents").notNull().default(0),
  balanceAfterCents: integer("balance_after_cents").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("site_wallet_entry_once").on(t.operationId, t.event)]);

export const inventory = pgTable("site_inventory", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id").notNull().references(() => products.id),
  credentials: text("credentials").notNull(),
  orderId: uuid("order_id").unique().references(() => orders.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("site_inventory_available").on(t.productId, t.orderId)]);

export const walletAudit = pgTable("site_wallet_audit", {
  id: uuid("id").primaryKey().defaultRandom(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  walletId: uuid("wallet_id").references(() => wallets.id),
  details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adminAudit = pgTable("site_admin_audit", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorUserId: uuid("actor_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  targetUserId: uuid("target_user_id").references(() => users.id, { onDelete: "restrict" }),
  action: text("action").notNull(),
  details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("site_admin_audit_created").on(t.createdAt),
  index("site_admin_audit_target").on(t.targetUserId, t.createdAt),
]);

export const walletOrderNumber = pgSequence("site_order_number", { startWith: 1000000 });

export const walletRateLimits = pgTable("site_wallet_rate_limits", {
  key: text("key").primaryKey(),
  hits: integer("hits").notNull().default(1),
  windowAt: timestamp("window_at", { withTimezone: true }).notNull().defaultNow(),
});


/* ═══════════ TOKEN PRODUCTS (Claude API) ═══════════
 * Token products are not sold at a fixed price: the buyer picks a model and
 * an amount of input/output tokens, and the price is computed from the rates
 * below. Rates are integer US cents per 1,000,000 tokens. */
export const tokenModels = pgTable("site_token_models", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  slug: text("slug").notNull().unique(),
  label: text("label").notNull(),
  inputPerMillionCents: integer("input_per_million_cents").notNull(),
  outputPerMillionCents: integer("output_per_million_cents").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check("site_token_rate_positive", sql`${t.inputPerMillionCents} >= 0 AND ${t.outputPerMillionCents} >= 0`),
]);

/** Shared pool for Claude API. Purchases lock this row before reserving tokens. */
export const tokenBank = pgTable("site_token_bank", {
  productId: uuid("product_id").primaryKey().references(() => products.id, { onDelete: "cascade" }),
  availableTokens: integer("available_tokens").notNull().default(400_000_000),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check("site_token_bank_available_valid", sql`${t.availableTokens} >= 0 AND ${t.availableTokens} <= 400000000`),
]);

/** One API key per user, reused by every model. */
export const tokenAccounts = pgTable("site_token_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  apiKey: text("api_key").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Remaining tokens per user and model. Hard-capped at 400M per model. */
export const tokenBalances = pgTable("site_token_balances", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  modelId: uuid("model_id").notNull().references(() => tokenModels.id, { onDelete: "cascade" }),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("site_token_balance_user_model").on(t.userId, t.modelId),
  check("site_token_balance_cap", sql`${t.inputTokens} >= 0 AND ${t.outputTokens} >= 0 AND ${t.inputTokens} + ${t.outputTokens} <= 400000000`),
]);

/** Append-only history of token purchases (one row per paid order). */
export const tokenPurchases = pgTable("site_token_purchases", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().unique().references(() => orders.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  modelId: uuid("model_id").notNull().references(() => tokenModels.id),
  inputTokens: integer("input_tokens").notNull(),
  outputTokens: integer("output_tokens").notNull(),
  totalCents: integer("total_cents").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("site_token_purchase_user").on(t.userId, t.createdAt)]);

export type TokenModelRow = typeof tokenModels.$inferSelect;
