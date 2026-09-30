-- Migration: Discounts management & News system
-- Idempotent: safe to execute multiple times.
BEGIN;

CREATE TABLE IF NOT EXISTS site_discounts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target                text NOT NULL DEFAULT 'tokens',
  slug                  text NOT NULL UNIQUE,
  title                 text NOT NULL,
  reason                text NOT NULL DEFAULT 'В честь открытия',
  discount_type         text NOT NULL DEFAULT 'fixed_price',
  original_price_cents  integer NOT NULL DEFAULT 30,
  discount_price_cents  integer NOT NULL DEFAULT 10,
  percent_off           integer NOT NULL DEFAULT 67,
  badge                 text NOT NULL DEFAULT '🔥 Скидка в честь открытия',
  is_active             boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Seed default token opening promo if not existing
INSERT INTO site_discounts (
  target, slug, title, reason, discount_type,
  original_price_cents, discount_price_cents, percent_off, badge, is_active
)
VALUES (
  'tokens',
  'opening-promo',
  'Скидка в честь открытия',
  'В честь открытия',
  'fixed_price',
  30,
  10,
  67,
  '🔥 Скидка в честь открытия',
  true
)
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS site_news (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  content       text NOT NULL,
  tag           text NOT NULL DEFAULT 'Обновление',
  is_pinned     boolean NOT NULL DEFAULT false,
  is_published  boolean NOT NULL DEFAULT true,
  author_name   text NOT NULL DEFAULT 'Администрация',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS site_news_published_idx
  ON site_news (is_published, is_pinned DESC, created_at DESC);

-- Seed initial welcome news announcement if empty
INSERT INTO site_news (title, content, tag, is_pinned, is_published, author_name)
SELECT
  'Грандиозное открытие LIVKAMARKET! 🚀',
  'Добро пожаловать в LIVKAMARKET — платформу доступа к нейросетям Claude Opus 5.5, API токенам и премиум аккаунтам. В честь нашего запуска действует акция: токены Claude API доступны всего по $0.10 за 1M токенов вместо $0.30! Пополняйте баланс удобным способом и подключайте Claude API напрямую.',
  'Акция',
  true,
  true,
  'Администрация'
WHERE NOT EXISTS (SELECT 1 FROM site_news LIMIT 1);

COMMIT;
