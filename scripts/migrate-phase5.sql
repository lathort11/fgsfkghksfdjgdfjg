-- LIVKAMARKET site · Phase 5 migration (idempotent): Claude API token products.
-- Explicit CREATE TABLE (drizzle-kit push needs a TTY and is not used in Docker).
-- Mirrors the token_* tables in src/db/schema.ts. Touches only site_token_* objects.
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrate-phase5.sql

BEGIN;

CREATE TABLE IF NOT EXISTS site_token_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  input_per_million_cents integer NOT NULL,
  output_per_million_cents integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_token_rate_positive CHECK (input_per_million_cents >= 0 AND output_per_million_cents >= 0)
);

CREATE TABLE IF NOT EXISTS site_token_bank (
  product_id uuid PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  available_tokens integer NOT NULL DEFAULT 400000000,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_token_bank_available_valid CHECK (available_tokens >= 0 AND available_tokens <= 400000000)
);

CREATE TABLE IF NOT EXISTS site_token_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES site_users(id) ON DELETE CASCADE,
  api_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS site_token_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES site_users(id) ON DELETE CASCADE,
  model_id uuid NOT NULL REFERENCES site_token_models(id) ON DELETE CASCADE,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_token_balance_cap CHECK (input_tokens >= 0 AND output_tokens >= 0 AND input_tokens + output_tokens <= 400000000)
);
CREATE UNIQUE INDEX IF NOT EXISTS site_token_balance_user_model ON site_token_balances (user_id, model_id);

CREATE TABLE IF NOT EXISTS site_token_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES site_users(id) ON DELETE CASCADE,
  model_id uuid NOT NULL REFERENCES site_token_models(id),
  input_tokens integer NOT NULL,
  output_tokens integer NOT NULL,
  total_cents integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS site_token_purchase_user ON site_token_purchases (user_id, created_at);

COMMIT;
