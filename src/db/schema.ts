import {
  pgTable, uuid, text, timestamp, integer, pgEnum, boolean, jsonb,
} from "drizzle-orm/pg-core";

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
  email: text("email").notNull().unique(),
  // Nullable: users who signed in only through Telegram have no password.
  passwordHash: text("password_hash"),
  name: text("name").notNull(),
  telegramId: text("telegram_id").unique(),
  telegramUsername: text("telegram_username"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

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
