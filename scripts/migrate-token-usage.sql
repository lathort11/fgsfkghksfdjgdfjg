-- Claude API usage log: one row per served request through the gateway.
-- The gateway (bot repo) INSERTs here and debits site_token_balances; the site
-- reads it for the customer's usage stats. Idempotent: safe to run repeatedly.
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrate-token-usage.sql
BEGIN;

CREATE TABLE IF NOT EXISTS site_token_usage (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES site_users(id) ON DELETE CASCADE,
  model_id       uuid REFERENCES site_token_models(id) ON DELETE SET NULL,
  endpoint       text NOT NULL DEFAULT 'messages',
  input_tokens   integer NOT NULL DEFAULT 0,
  output_tokens  integer NOT NULL DEFAULT 0,
  client_ip      text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS site_token_usage_user_idx
  ON site_token_usage (user_id, created_at DESC);

COMMIT;
