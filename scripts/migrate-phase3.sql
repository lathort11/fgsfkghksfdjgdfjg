-- LIVKAMARKET site · Phase 3 migration (idempotent).
-- Renames the site's auth tables to the `site_` prefix so they can coexist
-- with the bot's Alembic-managed `users` table in the shared database, and
-- adds the Telegram identity columns. Existing rows and foreign keys are kept.
--
-- Run BEFORE `npx drizzle-kit push` on a database created by phases 1–2:
--   psql "$DATABASE_URL" -f scripts/migrate-phase3.sql

BEGIN;

DO $$
BEGIN
  -- Only rename the old site table (identified by its password_hash column),
  -- never the bot's own `users` table.
  IF to_regclass('public.site_users') IS NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'password_hash'
     ) THEN
    ALTER TABLE users RENAME TO site_users;
  END IF;

  IF to_regclass('public.site_sessions') IS NULL
     AND to_regclass('public.sessions') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'sessions' AND column_name = 'token'
     ) THEN
    ALTER TABLE sessions RENAME TO site_sessions;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.site_users') IS NOT NULL THEN
    ALTER TABLE site_users ALTER COLUMN password_hash DROP NOT NULL;
    ALTER TABLE site_users ADD COLUMN IF NOT EXISTS telegram_id text;
    ALTER TABLE site_users ADD COLUMN IF NOT EXISTS telegram_username text;
    ALTER TABLE site_users ADD COLUMN IF NOT EXISTS avatar_url text;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_users_telegram_id_unique') THEN
      ALTER TABLE site_users ADD CONSTRAINT site_users_telegram_id_unique UNIQUE (telegram_id);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_email_unique') THEN
      ALTER TABLE site_users RENAME CONSTRAINT users_email_unique TO site_users_email_unique;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_pkey') THEN
      ALTER TABLE site_users RENAME CONSTRAINT users_pkey TO site_users_pkey;
    END IF;
  END IF;

  IF to_regclass('public.site_sessions') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sessions_pkey') THEN
      ALTER TABLE site_sessions RENAME CONSTRAINT sessions_pkey TO site_sessions_pkey;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sessions_user_id_users_id_fk') THEN
      ALTER TABLE site_sessions DROP CONSTRAINT sessions_user_id_users_id_fk;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_sessions_user_id_site_users_id_fk') THEN
      ALTER TABLE site_sessions ADD CONSTRAINT site_sessions_user_id_site_users_id_fk
        FOREIGN KEY (user_id) REFERENCES site_users(id) ON DELETE CASCADE;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_user_id_users_id_fk') THEN
    ALTER TABLE orders DROP CONSTRAINT orders_user_id_users_id_fk;
    ALTER TABLE orders ADD CONSTRAINT orders_user_id_site_users_id_fk
      FOREIGN KEY (user_id) REFERENCES site_users(id) ON DELETE SET NULL;
  END IF;
END $$;

COMMIT;
