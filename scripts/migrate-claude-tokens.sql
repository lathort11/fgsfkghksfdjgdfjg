-- Claude API: one price of $0.30 / million, minimum 10 million tokens.
-- Run AFTER `npx drizzle-kit push` to create site_token_bank:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrate-claude-tokens.sql
-- Safe to run again: the bank balance is never reset after its creation.
BEGIN;

UPDATE products
   SET slug = 'claude-api', kind = 'tokens', icon = 'claude', accent = '#d97757',
       per_key = 'tokens', price_cents = 0, stock = 0
 WHERE slug = 'antigravity-api';

-- The legacy input/output columns remain for historical purchases, but both
-- rates must match the single fixed rate used in the application.
UPDATE site_token_models
   SET input_per_million_cents = 30, output_per_million_cents = 30
 WHERE product_id IN (SELECT id FROM products WHERE slug = 'claude-api');

-- Initial stock is 400M minus historical purchases; future checkouts decrement
-- the same row transactionally, and this migration never refills it.
INSERT INTO site_token_bank (product_id, available_tokens)
SELECT p.id,
       GREATEST(0, 400000000 - COALESCE((
         SELECT SUM(tp.input_tokens::bigint + tp.output_tokens::bigint)
         FROM site_token_purchases tp
         JOIN site_token_models tm ON tm.id = tp.model_id
         WHERE tm.product_id = p.id
       ), 0))::integer
  FROM products p
 WHERE p.slug = 'claude-api'
ON CONFLICT (product_id) DO NOTHING;

COMMIT;
