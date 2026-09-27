# LIVKAMARKET Site

> Витрина AI-маркетплейса на Next.js 16 — каталог продуктов, оплата криптой, Telegram Mini App, Telegram Login Widget и интеграция с ботом.

[![Next.js 16](https://img.shields.io/badge/Next.js-16.2-black.svg)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19.2-61DAFB.svg)](https://react.dev/)
[![TypeScript 5.9](https://img.shields.io/badge/TypeScript-5.9-3178C6.svg)](https://www.typescriptlang.org/)
[![Tailwind CSS 4](https://img.shields.io/badge/Tailwind-4.1-38B2AC.svg)](https://tailwindcss.com/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle-0.45-C5F74F.svg)](https://orm.drizzle.team/)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED.svg)](https://docs.docker.com/)
[![License: Private](https://img.shields.io/badge/License-Private-red.svg)]()

---

## Оглавление

- [Обзор проекта](#обзор-проекта)
- [Архитектура](#архитектура)
- [Технологический стек](#технологический-стек)
- [Структура проекта](#структура-проекта)
- [Быстрый старт (локально)](#быстрый-старт-локально)
- [Конфигурация (.env)](#конфигурация-env)
- [Деплой на сервер](#деплой-на-сервер)
  - [Docker Compose (совместно с ботом)](#docker-compose-совместно-с-ботом)
  - [Standalone деплой](#standalone-деплой)
  - [Обновление на сервере](#обновление-на-сервере)
- [Git Workflow](#git-workflow)
  - [Клонирование](#клонирование)
  - [Коммиты и push](#коммиты-и-push)
  - [Полный цикл: изменение → деплой](#полный-цикл-изменение--деплой)
- [База данных](#база-данных)
  - [Схема (Drizzle ORM)](#схема-drizzle-orm)
  - [Миграции](#миграции)
  - [Shared Database](#shared-database)
- [Страницы и компоненты](#страницы-и-компоненты)
- [API Endpoints](#api-endpoints)
  - [Аутентификация](#аутентификация)
  - [Заказы](#заказы)
  - [Telegram](#telegram)
  - [Внутренние](#внутренние)
  - [Утилиты](#утилиты)
- [Оплата криптой](#оплата-криптой)
- [Telegram интеграция](#telegram-интеграция)
  - [Mini App](#mini-app)
  - [Login Widget](#login-widget)
  - [Bot Gateway](#bot-gateway)
- [Интернационализация (i18n)](#интернационализация-i18n)
- [Промокоды](#промокоды)
- [Docker](#docker)
- [Полезные команды](#полезные-команды)
- [Troubleshooting](#troubleshooting)

---

## Обзор проекта

**LIVKAMARKET Site** — витрина маркетплейса AI-подписок (Gemini Pro, ChatGPT Pro, SuperGrok, Antigravity API) с полным циклом покупки:

1. **Каталог** — карточки продуктов с ценами в рублях
2. **Регистрация/вход** — email+пароль или Telegram Login Widget
3. **Оформление заказа** — выбор продукта → сети оплаты (USDT/TON/BTC/ETH) → реалтайм котировка
4. **Оплата** — показ адреса + суммы в крипте → пользователь вводит txHash
5. **Доставка** — автоматическая выдача credentials + отправка в Telegram через бота
6. **Telegram Mini App** — IP-верификация для триала + быстрая покупка внутри Telegram

### Как связан с ботом

```
┌────────────────────┐         ┌──────────────────────────┐
│  LIVKAMARKET-site  │ ◄────── │  LIVKAMARKET-telegram-bot │
│   (Next.js 16)     │         │  (FastAPI + aiogram)      │
│                    │         │                          │
│  livkamarket.app   │         │  api.livkamarket.app     │
├────────────────────┤         ├──────────────────────────┤
│ • Витрина          │ shared  │ • Telegram Bot           │
│ • Регистрация      │   DB    │ • Security Gateway       │
│ • Заказы/оплата    │ ◄─────► │ • OmniRoute              │
│ • Mini App UI      │         │ • Mini App API (/verify)  │
│ • Profile          │ X-Internal-Secret                   │
│                    │ ──────► │ POST /internal/order-paid │
└────────────────────┘         └──────────────────────────┘
```

---

## Архитектура

```
┌──────────────────────────────────────────────────┐
│                 Caddy (Auto TLS)                  │
│  livkamarket.app         api.livkamarket.app      │
├──────────┬───────────────────────────────────────┤
│          │                                        │
│  ┌───────▼───────┐                                │
│  │  Next.js Site │  standalone (node server.js)   │
│  │  port 3000    │                                │
│  │               │                                │
│  │  Pages:       │                                │
│  │  / (витрина)  │                                │
│  │  /miniapp     │                                │
│  │               │                                │
│  │  API Routes:  │                                │
│  │  /api/auth/*  │                                │
│  │  /api/order/* │                                │
│  │  /api/qr      │                                │
│  │  /api/quote   │                                │
│  │  /api/health  │                                │
│  └───────┬───────┘                                │
│          │                                        │
│  ┌───────▼───────┐                                │
│  │  PostgreSQL   │  shared с ботом                │
│  │  livkamarket  │  site_users, products, orders  │
│  └───────────────┘                                │
└──────────────────────────────────────────────────┘
```

---

## Технологический стек

| Компонент | Технология | Версия |
|-----------|-----------|--------|
| Фреймворк | Next.js (App Router) | 16.2.6 |
| UI | React | 19.2.6 |
| Язык | TypeScript | 5.9.3 |
| Стили | Tailwind CSS | 4.1.17 |
| PostCSS | postcss | 8.5.8 |
| ORM | Drizzle ORM | 0.45.2 |
| БД драйвер | pg (node-postgres) | 8.20.0 |
| Миграции | drizzle-kit + raw SQL | 0.31.10 |
| Иконки | lucide-react | 1.48.0 |
| QR-коды | qrcode | 1.5.4 |
| Эффекты | canvas-confetti | 1.9.4 |
| Шрифты | Unbounded + Onest + Noto Sans SC | Google Fonts |
| Runtime | Node.js | 20 (Alpine) |
| Reverse Proxy | Caddy | 2 |

---

## Структура проекта

```
LIVKAMARKET-site/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── globals.css               #   Глобальные стили (Tailwind + aurora)
│   │   ├── layout.tsx                #   Root Layout (шрифты, тема, grain/vignette)
│   │   ├── page.tsx                  #   Главная страница (витрина)
│   │   ├── opengraph-image.tsx       #   OG-изображение (dynamic)
│   │   ├── miniapp/
│   │   │   └── page.tsx              #   Telegram Mini App (verify + market)
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── register/route.ts #     Регистрация (email + пароль)
│   │       │   ├── login/route.ts    #     Вход
│   │       │   ├── logout/route.ts   #     Выход
│   │       │   ├── me/route.ts       #     Текущий пользователь
│   │       │   └── telegram/
│   │       │       ├── widget/route.ts   # Telegram Login Widget
│   │       │       ├── webapp/route.ts   # Mini App initData
│   │       │       └── callback/route.ts # OAuth callback
│   │       ├── order/
│   │       │   ├── route.ts          #     Создание заказа
│   │       │   ├── check/route.ts    #     Проверка статуса
│   │       │   ├── mine/route.ts     #     Мои заказы
│   │       │   └── pay/route.ts      #     Подтверждение оплаты (txHash)
│   │       ├── internal/
│   │       │   └── orders/
│   │       │       ├── claim/route.ts     # Привязка заказа по секрету
│   │       │       └── user/[telegramId]/route.ts  # Заказы по TG ID
│   │       ├── health/route.ts       #     Health check
│   │       ├── qr/route.ts           #     Генерация QR-кода
│   │       └── quote/route.ts        #     Котировка крипты
│   │
│   ├── components/livka/             # UI-компоненты
│   │   ├── site.tsx                  #   Главная витрина (каталог + сравнение + FAQ)
│   │   ├── checkout.tsx              #   Чекаут (выбор сети → QR → txHash)
│   │   ├── auth.tsx                  #   Модалка авторизации
│   │   ├── profile.tsx               #   Профиль пользователя
│   │   ├── miniapp.tsx               #   Mini App: IP-верификация
│   │   ├── miniapp-market.tsx        #   Mini App: быстрая покупка
│   │   ├── telegram-login.tsx        #   Telegram Login Widget кнопка
│   │   ├── mobile-tabbar.tsx         #   Мобильный TabBar
│   │   ├── i18n-context.tsx          #   React Context для i18n
│   │   ├── product-art.tsx           #   SVG-арт продуктов
│   │   ├── icons.tsx                 #   SVG-иконки
│   │   ├── interactive.tsx           #   Интерактивные эффекты
│   │   ├── effects.tsx               #   Конфетти, анимации
│   │   ├── cursor.tsx                #   Кастомный курсор
│   │   └── ui.tsx                    #   Базовые UI-примитивы
│   │
│   ├── db/                           # База данных
│   │   ├── index.ts                  #   Pool + Drizzle ORM инициализация
│   │   └── schema.ts                 #   Схема: site_users, site_sessions, products, orders
│   │
│   └── lib/                          # Серверные утилиты
│       ├── auth.ts                   #   Хэширование паролей, генерация токенов/ключей
│       ├── bot-webhook.ts            #   Клиент к Bot Gateway (X-Internal-Secret)
│       ├── i18n.ts                   #   Словари ru/en/zh (~1000 строк)
│       ├── livka.ts                  #   Бизнес-логика: продукты, заказы, котировки
│       ├── miniapp.ts                #   Нормализация MINIAPP_BACKEND_URL
│       ├── networks.ts               #   Конфиг крипто-сетей (USDT/TON/BTC/ETH)
│       ├── order-delivery.ts         #   Доставка заказа в Telegram
│       ├── plates.ts                 #   UI-утилиты (форматирование цен)
│       ├── session.ts                #   Управление сессиями (cookie + DB)
│       ├── telegram-auth.ts          #   Проверка Telegram подписей
│       └── telegram-widget.ts        #   Telegram Login Widget утилиты
│
├── public/                           # Статические файлы
│   ├── logo.svg                      #   Логотип
│   ├── api.png                       #   Изображение API-продукта
│   ├── chatgpt.png                   #   ChatGPT Pro
│   ├── gemini.png                    #   Gemini Pro
│   └── grok.png                      #   SuperGrok
│
├── scripts/                          # Утилиты
│   ├── migrate-phase3.sql            #   SQL-миграция Phase 3 (site_ prefix)
│   ├── e2e-claim.mjs                 #   E2E-тест привязки заказа
│   └── test-miniapp-verify.mjs       #   Тест Mini App верификации
│
├── deploy/                           # Деплой
│   ├── Caddyfile                     #   Caddy reverse proxy
│   └── docker-compose.yml            #   Docker Compose (site + site-migrate)
│
├── docs/                             # Документация
│   ├── phase3-integration.md         #   Интеграция Phase 3
│   ├── telegram-miniapp.md           #   Telegram Mini App гайд
│   ├── telegram-miniapp.patch        #   Патч Mini App
│   ├── tz_3.md                       #   Техзадание v3
│   ├── tz_3_1.md                     #   Техзадание v3.1
│   └── tz_4.md                       #   Техзадание v4
│
├── .dockerignore
├── .env.example                      # Шаблон переменных окружения
├── Dockerfile                        # Multi-stage (deps → build → migrator → runner)
├── drizzle.config.json               # Конфиг Drizzle Kit
├── eslint.config.mjs                 # ESLint 9
├── next.config.ts                    # Next.js (standalone, CSP, iframe)
├── package.json
├── postcss.config.mjs                # PostCSS + Tailwind
├── README.md                         # ← Вы здесь
└── tsconfig.json                     # TypeScript
```

---

## Быстрый старт (локально)

### Предварительные требования

- **Node.js 20+**
- **npm** (или pnpm/yarn)
- **PostgreSQL 16** (можно через Docker)

### 1. Клонируйте репозиторий

```bash
git clone https://github.com/LIVKA-TEAM/LIVKAMARKET-site.git
cd LIVKAMARKET-site
```

### 2. Установите зависимости

```bash
npm install
```

### 3. Создайте `.env`

```bash
cp .env.example .env
```

Заполните минимально необходимое:
```env
DATABASE_URL=postgresql://livka:password@localhost:5432/livkamarket
```

### 4. Запустите БД (если нет)

```bash
# Через Docker
docker run -d --name livka-pg \
  -e POSTGRES_USER=livka \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=livkamarket \
  -p 5432:5432 \
  postgres:16-alpine
```

### 5. Примените миграции

```bash
# Phase 3 SQL (переименование таблиц)
psql "$DATABASE_URL" -f scripts/migrate-phase3.sql

# Drizzle push (создание/обновление таблиц)
npx drizzle-kit push
```

### 6. Запустите dev-сервер

```bash
npm run dev
```

Сайт доступен на **http://localhost:3000**.

---

## Конфигурация (.env)

| Переменная | Описание | Обязательна | По умолчанию |
|------------|----------|:-----------:|-------------|
| `DATABASE_URL` | PostgreSQL connection string | ✅ | - |
| `MINIAPP_BACKEND_URL` | URL бота для /miniapp IP-верификации | ❌ | пусто (same origin) |
| `BOT_GATEWAY_URL` | Серверный URL Bot Gateway | ❌ | - |
| `BOT_INTERNAL_SECRET` | Shared secret для site↔bot | ❌ | - |
| `TELEGRAM_BOT_TOKEN` | Токен бота (локальная валидация подписей) | ❌ | - |
| `TELEGRAM_BOT_USERNAME` | Username бота для Login Widget | ❌ | `LivkaMarketbot` |
| `CRYPTO_USDT_TRC20` | USDT TRC-20 адрес для оплаты | ❌ | fallback |
| `CRYPTO_TON` | TON адрес | ❌ | fallback |
| `CRYPTO_BTC` | BTC адрес | ❌ | fallback |
| `CRYPTO_ETH` | ETH (ERC-20) адрес | ❌ | fallback |

### Особенности

- `MINIAPP_BACKEND_URL` — **публичный** URL, виден браузеру. Никаких секретов! Если пусто — Mini App использует same origin
- `BOT_GATEWAY_URL` — **серверный**, site→bot. Внутри Docker: `http://gateway:8000`
- `TELEGRAM_BOT_TOKEN` — если задан, подписи проверяются локально; если нет — делегируются Bot Gateway

---

## Деплой на сервер

### Docker Compose (совместно с ботом)

Сайт поднимается как часть общего стека в `LIVKAMARKET-telegram-bot/docker-compose.yml`:

```yaml
# Фрагмент из docker-compose.yml бота:
site:
  build:
    context: ../LIVKAMARKET-site
    dockerfile: Dockerfile
  restart: unless-stopped
  environment:
    DATABASE_URL: postgres://livka:${POSTGRES_PASSWORD}@db:5432/livkamarket
    MINIAPP_BACKEND_URL: https://api.livkamarket.app
    BOT_INTERNAL_URL: http://gateway:8000
  expose:
    - "3000"
```

```bash
# На сервере — из директории бота:
cd ~/LIVKAMARKET-telegram-bot

# Миграция базы (первый раз / после обновления схемы)
docker compose run --rm site-migrate

# Запуск
docker compose up -d --build site
```

### Standalone деплой

Из `deploy/docker-compose.yml` (для отдельной инфраструктуры):

```bash
cd ~/LIVKAMARKET-site

# Создать .env
cp .env.example .env
nano .env

# Миграция
docker compose -f deploy/docker-compose.yml run --rm site-migrate

# Запуск
docker compose -f deploy/docker-compose.yml up -d site
```

### Обновление на сервере

```bash
ssh -i key.pem azureuser@SERVER_IP

# Обновить код сайта
cd ~/LIVKAMARKET-site
git pull

# Вариант 1: из стека бота
cd ~/LIVKAMARKET-telegram-bot
docker compose up -d --build site

# Вариант 2: standalone
cd ~/LIVKAMARKET-site
docker compose -f deploy/docker-compose.yml up -d --build site

# Если изменилась схема БД:
docker compose run --rm site-migrate
```

---

## Git Workflow

### Клонирование

```bash
git clone https://github.com/LIVKA-TEAM/LIVKAMARKET-site.git
cd LIVKAMARKET-site
```

### Коммиты и push

```bash
# Посмотреть изменения
git status
git diff

# Добавить и закоммитить
git add .
git commit -m "feat: новая функция в каталоге"

# Push
git push origin main

# Типы коммитов:
#   feat:     новая функциональность
#   fix:      исправление бага
#   style:    визуальные изменения (CSS, layout)
#   refactor: рефакторинг
#   docs:     документация
#   chore:    зависимости, конфиги
```

### Полный цикл: изменение → деплой

```bash
# 1. Разработка
npm run dev

# 2. Проверки
npm run typecheck    # TypeScript
npm run lint         # ESLint
npm run build        # Сборка

# 3. Коммит и push
git add .
git commit -m "feat: обновлён каталог"
git push origin main

# 4. Деплой на сервер
ssh -i key.pem azureuser@SERVER_IP \
  "cd ~/LIVKAMARKET-site && git pull && cd ~/LIVKAMARKET-telegram-bot && docker compose up -d --build site"
```

---

## База данных

### Схема (Drizzle ORM)

Файл: `src/db/schema.ts`

Все таблицы сайта имеют префикс `site_` чтобы не конфликтовать с ботом в общей БД.

| Таблица | Описание |
|---------|----------|
| `site_users` | Пользователи сайта (UUID PK, email, password_hash, telegram_id) |
| `site_sessions` | Сессии (token PK, user_id FK, expires_at) |
| `products` | Продукты каталога (slug, цена, stock, icon) |
| `orders` | Заказы (order_no, secret, статус, крипто-детали, credentials) |

### Статусы заказов

```
awaiting_payment → confirming → delivered
                 → cancelled
```

### Миграции

```bash
# 1. Phase 3 SQL (переименование site_users/site_sessions, добавление telegram_id)
psql "$DATABASE_URL" -f scripts/migrate-phase3.sql

# 2. Drizzle Kit push (создание/обновление таблиц site_*, products, orders)
npx drizzle-kit push

# В Docker (автоматически):
docker compose run --rm site-migrate
# Выполняет оба шага: SQL миграцию + drizzle-kit push
```

### Shared Database

Сайт и бот используют **одну PostgreSQL базу** (`livkamarket`):

| Владелец | Таблицы | Управление |
|----------|---------|-----------|
| Бот (Alembic) | `users`, `referrals`, `api_keys`, `request_logs`, `appeals`, `sponsored_channels` | `alembic upgrade head` |
| Сайт (Drizzle) | `site_users`, `site_sessions`, `products`, `orders` | `drizzle-kit push` + SQL |

> **Важно**: `drizzle.config.json` использует `tablesFilter: ["site_*", "products", "orders"]` — Drizzle Kit никогда не трогает таблицы бота.

---

## Страницы и компоненты

### Страницы

| Путь | Файл | Описание |
|------|------|----------|
| `/` | `src/app/page.tsx` | Главная витрина: каталог, сравнение, FAQ, как купить |
| `/miniapp` | `src/app/miniapp/page.tsx` | Telegram Mini App (verify или market режим) |

### Ключевые компоненты (`src/components/livka/`)

| Компонент | Описание |
|-----------|----------|
| `site.tsx` | Основной лейаут витрины (навбар, каталог, сравнение, FAQ) |
| `checkout.tsx` | Полный чекаут: выбор сети → QR-код → ввод txHash → доставка |
| `auth.tsx` | Модалка регистрации/входа (email + Telegram Login) |
| `profile.tsx` | Профиль: аватар, заказы, привязка Telegram, трлал-статус |
| `miniapp.tsx` | Mini App: IP-верификация через Telegram WebApp |
| `miniapp-market.tsx` | Mini App: быстрая покупка (USDT/TON) |
| `telegram-login.tsx` | Кнопка Telegram Login Widget |
| `mobile-tabbar.tsx` | Мобильный нижний TabBar |
| `product-art.tsx` | SVG-арт для карточек продуктов |
| `i18n-context.tsx` | React Context для переключения языков |

### Дизайн

- **Тёмная тема** (`#070708` фон)
- **Aurora-эффект** — анимированный градиент на фоне
- **Grain + Vignette** — текстурные оверлеи
- **Шрифты**: Unbounded (заголовки), Onest (тело), Noto Sans SC (китайский)

---

## API Endpoints

### Аутентификация

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/api/auth/register` | POST | Регистрация `{name, email, password}` |
| `/api/auth/login` | POST | Вход `{email, password}` |
| `/api/auth/logout` | POST | Выход (удаление сессии) |
| `/api/auth/me` | GET | Текущий пользователь (из cookie) |
| `/api/auth/telegram/widget` | POST | Вход через Telegram Login Widget |
| `/api/auth/telegram/webapp` | POST | Вход через Mini App initData |
| `/api/auth/telegram/callback` | GET | OAuth callback |

### Заказы

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/api/order` | POST | Создание заказа `{productId, networkId, promo?}` |
| `/api/order/pay` | POST | Подтверждение оплаты `{secret, txHash}` |
| `/api/order/check` | POST | Проверка статуса заказа |
| `/api/order/mine` | GET | Мои заказы |

### Telegram

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/api/auth/telegram/widget` | POST | Login Widget (HMAC-SHA-256) |
| `/api/auth/telegram/webapp` | POST | Mini App initData validation |

### Внутренние

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/api/internal/orders/claim` | POST | Привязка заказа по секрету (бот → сайт) |
| `/api/internal/orders/user/[telegramId]` | GET | Заказы пользователя по Telegram ID |

### Утилиты

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/api/health` | GET | Health check |
| `/api/qr` | GET | Генерация QR-кода (data URI) |
| `/api/quote` | GET | Текущие котировки криптовалют |

---

## Оплата криптой

### Поддерживаемые сети

| Сеть | Актив | Комиссия | Decimals |
|------|-------|----------|----------|
| TRC-20 | USDT | ~1 USDT | 2 |
| TON | TON | ~0.05 TON | 3 |
| Bitcoin | BTC | ~0.0001 BTC | 6 |
| ERC-20 | ETH | ~0.0004 ETH | 5 |

### Как работает оплата

1. Пользователь выбирает продукт и сеть
2. Сервер запрашивает курс с CoinGecko (`/api/v3/simple/price`)
3. Рассчитывается сумма в крипте: `цена_руб / курс_крипты_к_руб`
4. Показывается QR-код с адресом + точная сумма
5. Пользователь переводит и вводит txHash
6. `POST /api/order/pay` → статус `delivered` → credentials выдаются
7. Бот отправляет чек в Telegram (если пользователь привязан)

### Котировки

- Кэш: 5 минут
- Источник: CoinGecko API (vs_currencies: rub, usd)
- Fallback: захардкоженные курсы (если CoinGecko недоступен)

### Крипто-адреса

Задаются через env-переменные:
```env
CRYPTO_USDT_TRC20=TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE
CRYPTO_TON=UQD...
CRYPTO_BTC=bc1q...
CRYPTO_ETH=0x71C...
```

---

## Telegram интеграция

### Mini App

**Файл**: `src/app/miniapp/page.tsx`

Два режима:
- **verify** (по умолчанию) — IP-верификация для триала бота
- **market** (`/miniapp?mode=market`) — быстрая покупка (USDT/TON)

CSP: `frame-ancestors 'self' https://web.telegram.org https://*.telegram.org`

### Login Widget

**Файл**: `src/components/livka/telegram-login.tsx`

- Требует `/setdomain livkamarket.app` в @BotFather
- На `www.*`, localhost и превью — кнопка скрывается
- Подпись проверяется HMAC-SHA-256 (локально или через Gateway)

### Bot Gateway

**Файл**: `src/lib/bot-webhook.ts`

Сайт общается с ботом через серверные HTTP-запросы:

| Действие | Путь | Описание |
|----------|------|----------|
| Доставка заказа | `/api/internal/order-paid` | Отправка чека + credentials в Telegram |
| Валидация подписи | `/api/auth/telegram/validate` | Делегированная проверка Telegram Login |
| Профиль бота | `/api/internal/users/{id}/profile` | IP, триал, токены, рефералы |

Все вызовы:
- Авторизованы заголовком `X-Internal-Secret`
- Timeout: 6 секунд
- Ошибки не бросают исключения — Gateway outage не ломает сайт

---

## Интернационализация (i18n)

**Файл**: `src/lib/i18n.ts` (~1000 строк)

3 языка:

| Код | Язык | Cookie |
|-----|------|--------|
| `ru` | Русский | `lvk_lang=ru` |
| `en` | English | `lvk_lang=en` |
| `zh` | 中文 | `lvk_lang=zh` |

Переключение: кнопка в навбаре → сохраняется в cookie `lvk_lang`.

Покрытие: навигация, каталог, чекаут, профиль, FAQ, Mini App, ошибки — полностью локализованы.

---

## Промокоды

| Код | Скидка |
|-----|--------|
| `LIVKA15` | 15% |
| `GEMINI10` | 10% |
| `NEURAL5` | 5% |

Применяются при создании заказа (`promo` поле). Логика: `src/lib/networks.ts` → `promoDiscount()`.

---

## Docker

### Multi-stage Dockerfile

```
Stage 1: deps      — npm ci (node:20-alpine)
Stage 2: builder   — npm run build (Next.js standalone)
Stage 3: migrator  — psql + drizzle-kit push (для миграций)
Stage 4: runner    — node server.js (production, ~50MB)
```

### Команды

```bash
# Сборка production-образа
docker build -t livkamarket-site .

# Сборка migrator
docker build --target migrator -t livkamarket-site-migrate .

# Запуск
docker run -d -p 3000:3000 \
  -e DATABASE_URL=postgresql://livka:pass@host:5432/livkamarket \
  livkamarket-site

# Health check (встроен в Dockerfile)
wget -qO- http://127.0.0.1:3000/api/health
```

---

## Полезные команды

### Разработка

```bash
# Dev-сервер (hot reload)
npm run dev

# Production-сборка
npm run build

# Production-запуск
npm start

# Type checking
npm run typecheck

# Lint
npm run lint
```

### База данных

```bash
# Drizzle Studio (визуальный UI для БД)
npx drizzle-kit studio

# Push схемы в БД
npx drizzle-kit push

# Генерация миграций
npx drizzle-kit generate

# Применить SQL-миграцию
psql "$DATABASE_URL" -f scripts/migrate-phase3.sql

# Подключиться к БД
psql "$DATABASE_URL"
# или через Docker
docker compose exec db psql -U livka -d livkamarket

# Полезные запросы
SELECT id, slug, price_cents, stock, sold_count FROM products;
SELECT order_no, status, total_cents, network_label FROM orders ORDER BY created_at DESC LIMIT 10;
SELECT id, email, telegram_id, created_at FROM site_users;
```

### Git

```bash
# Стянуть изменения
git pull origin main

# Логи
git log --oneline -20

# Разница с remote
git log main..origin/main --oneline

# Откат файла
git checkout -- src/app/page.tsx
```

### Docker

```bash
# Логи сайта
docker compose logs -f site

# Зайти в контейнер
docker compose exec site sh

# Пересборка
docker compose up -d --build site

# Статус
docker compose ps site
```

---

## Troubleshooting

### `DATABASE_URL is required`

```bash
# Убедитесь что .env существует и содержит DATABASE_URL
cat .env | grep DATABASE_URL
```

### `npm run build` падает

```bash
# Проверьте TypeScript-ошибки
npm run typecheck

# DATABASE_URL нужен даже при сборке (для импортов)
# Dockerfile подставляет dummy: postgresql://build:build@127.0.0.1:5432/build
```

### Telegram Login: "Bot domain invalid"

```bash
# 1. В @BotFather: /setdomain → livkamarket.app (точный домен)
# 2. www.*, localhost, preview-домены НЕ поддерживаются
# 3. Кнопка скрывается автоматически на неподдерживаемых доменах
```

### Mini App не загружается в Telegram

```bash
# Проверьте CSP в next.config.ts
# /miniapp должен иметь: frame-ancestors 'self' https://web.telegram.org

# Проверьте MINIAPP_BACKEND_URL — должен быть https://
```

### Заказ не доставляется в Telegram

```bash
# 1. Проверьте BOT_GATEWAY_URL и BOT_INTERNAL_SECRET в .env
# 2. Логи сайта:
docker compose logs site | grep "bot-gateway"

# 3. Логи бота:
docker compose logs gateway | grep "internal"
```

### Котировки показывают старые цены

```bash
# Кэш котировок: 5 минут
# Если CoinGecko недоступен — используются fallback-курсы
# Проверьте доступность: curl https://api.coingecko.com/api/v3/ping
```

### Миграции не применяются

```bash
# 1. SQL миграция (Phase 3):
docker compose exec db psql -U livka -d livkamarket -f /path/to/migrate-phase3.sql

# 2. Drizzle push:
docker compose run --rm site-migrate

# 3. Проверьте таблицы:
docker compose exec db psql -U livka -d livkamarket -c "\dt site_*"
```

---

## Лицензия

Приватный репозиторий. © LIVKA TEAM, 2024–2026.
