# LIVKAMARKET · Фаза 3 — контракт «сайт ⇄ бот»

Документ для разработчиков бота. Все серверные вызовы защищены заголовком
`X-Internal-Secret: <BOT_INTERNAL_SECRET>` (одинаковое значение в `.env` сайта и бота).

## 1. Переменные окружения сайта

| Переменная | Назначение |
|---|---|
| `DATABASE_URL` | Общая БД `livkamarket` (таблицы сайта: `site_users`, `site_sessions`, `products`, `orders`) |
| `BOT_GATEWAY_URL` | База Gateway бота для server-to-server (`http://bot:8080` в docker-сети) |
| `BOT_INTERNAL_SECRET` | Общий секрет |
| `TELEGRAM_BOT_TOKEN` | *Опционально.* Если задан — подписи Telegram проверяются локально, без Gateway |
| `TELEGRAM_BOT_USERNAME` | Username бота для Login Widget, читается в рантайме (по умолчанию `LivkaMarketbot`) |
| `MINIAPP_BACKEND_URL` | Публичный URL бэкенда для `POST /miniapp/api/verify-ip` (см. `telegram-miniapp.md`) |

## 2. Сайт → бот (Gateway должен реализовать)

### 2.1 `POST /api/auth/telegram/validate`
Используется, только если на сайте **не** задан `TELEGRAM_BOT_TOKEN`.
```json
{ "type": "login_widget", "payload": { "id": "123", "first_name": "…", "auth_date": "…", "hash": "…" } }
{ "type": "webapp", "initData": "<raw Telegram.WebApp.initData>" }
```
Ответ `200 {"valid": true}` или `401 {"valid": false}`.

### 2.2 `POST /api/internal/order-paid`
Отправляется в момент перехода заказа в `delivered` (один раз). Бот присылает пользователю
карточку с чеком и доступами.
```json
{
  "telegramId": "123456789", "orderNo": 482913, "orderSecret": "031337",
  "productSlug": "chatgpt-pro", "productTitle": "ChatGPT Pro", "kind": "account",
  "totalCents": 399000, "network": "TRC-20", "asset": "USDT", "amountCrypto": "43.37",
  "txHash": "…", "credentials": "LOGIN = …\nPASSWORD = …", "paidAt": "2026-09-24T10:00:00.000Z"
}
```
Ответ `2xx` = доставлено. Ошибка/таймаут (6 с) не ломает оплату на сайте.

### 2.3 `GET /api/internal/users/{telegramId}/profile`
Данные для кабинета в Mini App и `/api/auth/me` (поле `bot`).
```json
{
  "ip_verified": true, "trial_active": true, "trial_key": "livka-trial-ab12…",
  "tokens_used": 14200, "tokens_limit": 1000000,
  "referrals_confirmed": 3, "referrals_required": 5
}
```
`404`/ошибка → в кабинете показывается «Данные триала временно недоступны».

## 3. Бот → сайт

### 3.1 `POST https://livkamarket.app/api/internal/orders/claim` — команда `/claim <secret>`
```json
{ "secret": "031337", "telegramId": "123456789", "firstName": "Иван", "username": "ivan" }
```
Привязывает заказ к Telegram: если заказ оформлен e-mail аккаунтом без Telegram — этот Telegram ID
привязывается к аккаунту (связка), иначе заказ переносится на Telegram-аккаунт сайта (создаётся при
необходимости). Заказ, чей владелец уже связан с **другим** Telegram ID, не выдаётся (`409`).
⚠️ Секрет заказа — 6 цифр: бот обязан ограничивать частоту `/claim` (например, 5 попыток / 10 мин на пользователя).
Ответ:
```json
{ "ok": true, "sentToTelegram": true,
  "order": { "orderNo": 482913, "status": "delivered", "productTitle": "ChatGPT Pro",
             "totalCents": 399000, "network": "TRC-20", "asset": "USDT",
             "amountCrypto": "43.37", "credentials": "…" } }
```
Ошибки: `403 FORBIDDEN`, `400 BAD_PAYLOAD`, `404 ORDER_NOT_FOUND`, `409 ALREADY_CLAIMED`.
Если заказ уже оплачен, сайт дополнительно отправляет `order-paid` (п. 2.2).

## 4. Кнопки WebApp в боте

| Кнопка | URL |
|---|---|
| Шаг онбординга «Проверить IP» | `https://livkamarket.app/miniapp?mode=verify` |
| Главное меню «🛍️ LIVKAMARKET» | `https://livkamarket.app/miniapp?mode=market` |
| Без параметра | верифицированным — маркет, остальным — проверка IP |

## 5. Telegram Login на сайте
1. @BotFather → `/setdomain` → @LivkaMarketbot → `livkamarket.app`.
   Совпадение **строгое**: `www.livkamarket.app`, превью и `localhost` получают «Bot domain invalid»
   (проверено; поэтому Caddy редиректит www → apex).
2. Сайт сам спрашивает Telegram (`GET /api/auth/telegram/widget?origin=…`) и показывает кнопку
   только там, где вход реально работает. На остальных доменах блок скрыт, а в консоли браузера —
   подсказка. После `/setdomain` кнопка появляется сама (кэш проверки ≤ 5 мин).
3. Превью/стейджинг: отдельный тестовый бот с `/setdomain` = домен превью, и в окружении превью
   `TELEGRAM_BOT_USERNAME` + `TELEGRAM_BOT_TOKEN` этого бота (без пересборки).

## 6. Деплой
```bash
psql "$DATABASE_URL" -f scripts/migrate-phase3.sql   # или: docker compose run --rm site-migrate
docker compose up -d --build site
```
Миграция идемпотентна: переименовывает `users`/`sessions` сайта в `site_users`/`site_sessions`
(таблица `users` бота не затрагивается — проверяется наличие колонки `password_hash`),
добавляет `telegram_id`, `telegram_username`, `avatar_url`. `drizzle-kit push` ограничен
`tablesFilter` и никогда не удаляет таблицы бота. См. `deploy/docker-compose.yml`, `deploy/Caddyfile`.
