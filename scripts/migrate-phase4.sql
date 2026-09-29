-- LIVKAMARKET site · Phase 4 migration (idempotent): wallet + admin panel.
-- Explicit SQL instead of `drizzle-kit push`: push prompts interactively about
-- the bot's sequences in the shared DB and cannot run without a TTY.
-- Touches only site_* objects. Mirrors src/db/schema.ts.
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrate-phase4.sql

BEGIN;

-- site_users: public id, roles, bans
ALTER TABLE site_users ADD COLUMN IF NOT EXISTS customer_no serial NOT NULL;
ALTER TABLE site_users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user';
ALTER TABLE site_users ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE site_users ADD COLUMN IF NOT EXISTS banned_at timestamptz;
ALTER TABLE site_users ADD COLUMN IF NOT EXISTS ban_reason text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.site_users'::regclass AND conname = 'site_users_customer_no_unique') THEN
    ALTER TABLE site_users ADD CONSTRAINT site_users_customer_no_unique UNIQUE (customer_no);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.site_users'::regclass AND conname = 'site_user_role_valid') THEN
    ALTER TABLE site_users ADD CONSTRAINT site_user_role_valid CHECK (role IN ('user', 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.site_users'::regclass AND conname = 'site_user_status_valid') THEN
    ALTER TABLE site_users ADD CONSTRAINT site_user_status_valid CHECK (status IN ('active', 'banned'));
  END IF;
END $$;

CREATE SEQUENCE IF NOT EXISTS site_order_number START WITH 1000000;

CREATE TABLE IF NOT EXISTS site_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES site_users(id) ON DELETE RESTRICT,
  mode text NOT NULL,
  balance_cents integer NOT NULL DEFAULT 0,
  held_cents integer NOT NULL DEFAULT 0,
  verification text NOT NULL DEFAULT 'unverified',
  verification_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_wallet_balance_nonnegative CHECK (balance_cents >= 0 AND balance_cents <= 100000000),
  CONSTRAINT site_wallet_held_nonnegative CHECK (held_cents >= 0),
  CONSTRAINT site_wallet_mode_valid CHECK (mode IN ('demo', 'live'))
);
CREATE UNIQUE INDEX IF NOT EXISTS site_wallet_user_mode ON site_wallets (user_id, mode);

CREATE TABLE IF NOT EXISTS site_wallet_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES site_wallets(id),
  kind text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  amount_cents integer NOT NULL,
  fee_cents integer NOT NULL DEFAULT 0,
  idempotency_key text NOT NULL,
  description text NOT NULL,
  method text NOT NULL,
  address text,
  external_id text UNIQUE,
  payment_url text,
  reference text,
  order_id uuid REFERENCES orders(id),
  product_id uuid REFERENCES products(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT site_wallet_operation_amount CHECK (amount_cents > 0 AND fee_cents >= 0 AND fee_cents < amount_cents)
);
CREATE UNIQUE INDEX IF NOT EXISTS site_wallet_idempotency ON site_wallet_operations (wallet_id, idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS site_wallet_unique_payout_reference ON site_wallet_operations (reference)
  WHERE kind = 'withdrawal' AND status = 'completed';
CREATE INDEX IF NOT EXISTS site_wallet_history ON site_wallet_operations (wallet_id, created_at);

CREATE TABLE IF NOT EXISTS site_wallet_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES site_wallets(id),
  operation_id uuid NOT NULL REFERENCES site_wallet_operations(id),
  event text NOT NULL,
  delta_cents integer NOT NULL,
  delta_held_cents integer NOT NULL DEFAULT 0,
  balance_after_cents integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS site_wallet_entry_once ON site_wallet_entries (operation_id, event);

CREATE TABLE IF NOT EXISTS site_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id),
  credentials text NOT NULL,
  order_id uuid UNIQUE REFERENCES orders(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS site_inventory_available ON site_inventory (product_id, order_id);

CREATE TABLE IF NOT EXISTS site_wallet_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor text NOT NULL,
  action text NOT NULL,
  wallet_id uuid REFERENCES site_wallets(id),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS site_admin_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL REFERENCES site_users(id) ON DELETE RESTRICT,
  target_user_id uuid REFERENCES site_users(id) ON DELETE RESTRICT,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS site_admin_audit_created ON site_admin_audit (created_at);
CREATE INDEX IF NOT EXISTS site_admin_audit_target ON site_admin_audit (target_user_id, created_at);

CREATE TABLE IF NOT EXISTS site_wallet_rate_limits (
  key text PRIMARY KEY,
  hits integer NOT NULL DEFAULT 1,
  window_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
