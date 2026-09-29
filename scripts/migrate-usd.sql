-- LIVKAMARKET · switch the catalogue from RUB to USD (idempotent, safe to re-run).
-- All money is stored as integer minor units (cents). Run once on existing databases:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrate-usd.sql
-- Fresh databases are seeded with USD prices automatically (src/lib/livka.ts).
BEGIN;
UPDATE products SET price_cents = CASE slug
  WHEN 'gemini-pro-18'   THEN 5500
  WHEN 'antigravity-api' THEN 2200
  WHEN 'chatgpt-pro'     THEN 4500
  WHEN 'supergrok'       THEN 2800
  WHEN 'chatgpt-plus-4'  THEN 5500
  WHEN 'chatgpt-plus-8'  THEN 9900
  WHEN 'chatgpt-pro-4'   THEN 14900
  WHEN 'chatgpt-pro-8'   THEN 25900
  ELSE price_cents END
WHERE slug IN ('gemini-pro-18','antigravity-api','chatgpt-pro','supergrok','chatgpt-plus-4','chatgpt-plus-8','chatgpt-pro-4','chatgpt-pro-8')
  AND price_cents >= 100000;  -- only rows still priced in RUB kopecks
COMMIT;
