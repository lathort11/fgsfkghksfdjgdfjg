# ТЕХНИЧЕСКОЕ ЗАДАНИЕ (ТЗ) — ЧАСТЬ 3 (САЙТ И MINI APP)
## Проект: LIVKAMARKET Website & Telegram Mini App 2.0
### Фаза 3: Telegram Login, WebApp-витрина, доставка заказов в бота и Docker-деплой

---

## 1. ВВЕДЕНИЕ И ТЕКУЩИЙ СТАТУС ПРОЕКТА

### 1.1. Контекст
В рамках предыдущих этапов сайт `LIVKAMARKET-site` получил:
1. **Современный стек:** Next.js 16 (App Router), React 19, Tailwind CSS v4, TypeScript, Drizzle ORM (PostgreSQL).
2. **Маркетплейс AI-товаров:** Витрина моделей (Gemini 1.5/3.1, Claude 3.5 Sonnet, ChatGPT Plus, Antigravity API), система промокодов, мультивалютный крипто-биллинг (USDT TRC20, TON, BTC, ETH) с динамическим расчетом котировок CoinGecko.
3. **Модуль верификации Mini App (`/miniapp`):** Маршрут для проверки IP, Telegram SDK, тактильный отклик (haptic), 100% покрытие unit/integration тестами (29/29).
4. **Инфраструктура:** Привязан боевой домен `livkamarket.app`, открыты порты 80/443 в Azure, настроен Caddy c SSL Let's Encrypt.

### 1.2. Цель третьей фазы (Сторона Сайта)
Превратить веб-сайт и страницу Mini App в единое интерактивное приложение, бесшовно работающее как в обычном браузере, так и прямо внутри Telegram:
1. **Telegram Mini App 2.0:** Расширить страницу `/miniapp` из простой проверки IP в полноценное WebApp-приложение (каталог товаров, покупка в 1 клик, личный кабинет с показом выданного триального API-ключа и остатка токенов).
2. **Telegram Login на сайте:** Дать возможность пользователям браузера входить на `livkamarket.app` в один клик через Telegram-аккаунт без ввода паролей.
3. **Мост уведомлений о заказах:** При подтверждении крипто-оплаты отправлять защищенный вебхук в бэкенд бота для мгновенной доставки чека и доступов (`credentials`) в чат Telegram.
4. **Предотвращение коллизий в БД:** Разграничение названий таблиц в PostgreSQL (`site_users`, `site_sessions`), чтобы Drizzle ORM сайта и Alembic бота гармонично сосуществовали в единой базе `livkamarket`.
5. **Автономный Docker-деплой:** Оформить легковесный `Dockerfile` (standalone output) и запустить сайт в связке с Caddy на VPS.

---

## 2. АРХИТЕКТУРА И КЛЮЧЕВЫЕ КОМПОНЕНТЫ

```
src/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── telegram/       # [НОВОЕ] Авторизация через Telegram Login Widget
│   │   │   │   └── callback/route.ts
│   │   │   └── me/route.ts     # Расширен: возврат telegramId, триального ключа и токенов
│   │   └── order/
│   │       └── pay/route.ts    # [ДОРАБОТКА] Отправка уведомления в Bot Gateway при оплате
│   ├── miniapp/
│   │   └── page.tsx            # [ДОРАБОТКА] Двухрежимный роут: верификация vs витрина маркета
│   └── page.tsx                # Главная витрина в браузере
├── components/
│   └── livka/
│       ├── miniapp.tsx         # [ДОРАБОТКА] Полноценный UI: проверка IP + кабинет + каталог
│       ├── telegram-login.tsx  # [НОВОЕ] Виджет авторизации Telegram
│       └── auth-modal.tsx      # [ДОРАБОТКА] Кнопка «Войти через Telegram»
├── db/
│   └── schema.ts               # [ДОРАБОТКА] Таблицы site_users, site_sessions с полями Telegram
└── lib/
    ├── miniapp.ts              # Логика сетевых запросов и проверка сессий Mini App
    └── bot-webhook.ts          # [НОВОЕ] Клиент отправки уведомлений в Gateway бота
```

---

## 3. ПОДРОБНЫЕ СПЕЦИФИКАЦИИ МОДУЛЕЙ

### 3.1. Telegram Mini App 2.0 (`src/components/livka/miniapp.tsx`)
Страница `/miniapp` определяет режим отображения на основе URL-параметра и контекста пользователя:

#### Режим А: «Верификация IP» (`mode === "verify"`)
* Активируется, если пользователь перешел из шага онбординга или если параметр `?mode=verify`.
* Проверяет IP через `POST /miniapp/api/verify-ip`.
* При успехе запускает виброотклик `HapticFeedback.notificationOccurred('success')` и плавно закрывает WebApp окно (`Telegram.WebApp.close()`).

#### Режим Б: «Личный кабинет и витрина» (`mode === "market"`)
* Активируется по кнопке «🛍️ LIVKAMARKET» из Главного меню бота или при открытии WebApp верифицированным пользователем.
* Автоматическая авторизация: компонент берет `window.Telegram.WebApp.initData`, отправляет на сервер сайта, и пользователь мгновенно опознается без логина и пароля.
* **Интерфейс:**
  1. **Информационная шапка пользователя:**
     - Имя и аватар пользователя Telegram (`Telegram.WebApp.initDataUnsafe.user`).
     - Плашка статуса триала: `Активен` / `Не активен`.
     - Прогресс-бар расхода токенов: например, `14 200 / 1 000 000 токенов`.
     - Блок триального ключа: `livka-trial-ab12...` с кнопкой «Скопировать ключ» (нативный `navigator.clipboard.writeText` + haptic).
     - Счетчик подтвержденных рефералов (`3 / 5`).
  2. **Каталог маркета (Quick Buy):**
     - Список топовых товаров (Gemini Pro, Claude 3.5 Sonnet, ChatGPT Plus, Antigravity API).
     - Оформление заказа прямо внутри WebApp: выбор криптосети (USDT, TON) и генерация депозитного QR-кода.
     - После оплаты данные доступа моментально отображаются на экране и дублируются в чат с ботом.

---

### 3.2. Сквозная авторизация Telegram Login (`src/app/api/auth/telegram/`)

#### 1. UI Компонент (`src/components/livka/telegram-login.tsx`):
В модальное окно входа (`auth-modal.tsx`) добавляется блок входа через Telegram:
```tsx
<TelegramLoginButton
  botUsername="LivkaMarketbot"
  onAuth={(user) => handleTelegramAuth(user)}
/>
```
Официальный виджет Telegram вызывает callback с параметрами: `id`, `first_name`, `username`, `photo_url`, `auth_date`, `hash`.

#### 2. Серверный обработчик (`/api/auth/telegram/callback/route.ts`):
* Принимает payload от виджета.
* Отправляет запрос на валидацию подписи в Gateway бота (`POST https://api.livkamarket.app/api/auth/telegram/validate`).
* При подтверждении подлинности:
  - Ищет пользователя в таблице `site_users` по `telegramId`.
  - Если пользователя нет — создает запись с `email = telegram_{id}@livkamarket.app`.
  - Создает сессионный токен в таблице `site_sessions` и выставляет HTTP-only cookie `session`.
  - Возвращает профиль пользователя.

---

### 3.3. Доставка оплаченных заказов в Telegram (`src/lib/bot-webhook.ts`)

#### Интеграция в процесс оплаты (`src/app/api/order/pay/route.ts`):
Когда статус заказа переходит в `delivered`:
```typescript
import { notifyBotOrderPaid } from "@/lib/bot-webhook";

// После генерации credentials:
if (order.userId) {
  const user = await getUserById(order.userId);
  if (user?.telegramId) {
    await notifyBotOrderPaid({
      telegramId: user.telegramId,
      orderNo: order.orderNo,
      productTitle: product.title,
      kind: product.kind,
      totalCents: order.totalCents,
      network: order.networkLabel,
      txHash: input.txHash,
      credentials: credentials,
    });
  }
}
```
* **Безопасность:** Запрос подписывается секретным заголовком `X-Internal-Secret = process.env.BOT_INTERNAL_SECRET`.
* **Результат для клиента:** Покупатель не потеряет купленный аккаунт или ключ — даже если он случайно закрыл вкладку браузера, бот бережно сохранит все реквизиты в истории сообщений Telegram.

---

### 3.4. Доработки схемы базы данных (`src/db/schema.ts`)
Для исключения конфликта имен с таблицами бота (`users`) в общей базе данных `livkamarket`, таблицы сайта в Drizzle ORM именуются с явным префиксом `site_`:
```typescript
export const users = pgTable("site_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"), // nullable для пользователей только из Telegram
  name: text("name").notNull(),
  telegramId: text("telegram_id").unique(),       // [НОВОЕ]
  telegramUsername: text("telegram_username"),   // [НОВОЕ]
  avatarUrl: text("avatar_url"),                 // [НОВОЕ]
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("site_sessions", {
  token: text("token").primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

---

## 4. СБОРКА И РАЗВЕРТЫВАНИЕ В DOCKER

### 4.1. Оптимизация Next.js (`next.config.ts`)
Включение режима автономной сборки для минимизации размера контейнера:
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
};

export default nextConfig;
```

### 4.2. Многоэтапный `Dockerfile`
```dockerfile
# 1. Зависимости
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# 2. Сборка
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# 3. Легковесный продакшн-образ
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
ENV PORT 3000
CMD ["node", "server.js"]
```
* **Размер и скорость:** Итоговый образ весит менее 120 МБ, запускается за 0.5 секунды и потребляет всего ~80 МБ оперативной памяти.

---

## 5. ПЛАН ВЕРИФИКАЦИИ И ПРИЕМКИ ТЗ-3 (САЙТ)

| № | Тест-кейс | Ожидаемый результат |
|---|-----------|---------------------|
| 1 | Запуск автономного билда `npm run build` | Сборка компилируется без ошибок TypeScript и ESLint |
| 2 | Открытие `https://livkamarket.app/miniapp` вне Telegram | Экран-заглушка: «Откройте проверку из Telegram-бота» |
| 3 | Открытие кнопки «🛍️ LIVKAMARKET» внутри Telegram | Открывается WebApp с каталогом, балансом токенов и триальным ключом |
| 4 | Вход на сайте через Telegram Login Widget | Создается сессия, в профиле отображается имя и аватарка из Telegram |
| 5 | Оплата тестового заказа на сайте | В Telegram-чат покупателя мгновенно падает карточка с логином/паролем |
| 6 | Привязка анонимного заказа через `/claim <secret>` | Заказ связывается с Telegram ID, данные заказа отправляются в ЛС бота |
| 7 | Работа под общим Caddy на VPS | Домены `livkamarket.app` и `api.livkamarket.app` стабильно работают по HTTPS без блокировок iframe |

---

## 6. ПОРЯДОК РЕАЛИЗАЦИИ
1. **Шаг 1:** Обновление схемы Drizzle ORM (`site_users`, `telegramId`, `avatarUrl`) и применение к PostgreSQL.
2. **Шаг 2:** Реализация клиента `bot-webhook.ts` и отправка событий при оплате в `api/order/pay`.
3. **Шаг 3:** Интеграция Telegram Login кнопки и API-обработчика `/api/auth/telegram/callback`.
4. **Шаг 4:** Доработка интерфейса `/miniapp` (показ триального ключа, токенов и маркета).
5. **Шаг 5:** Создание `Dockerfile` и подключение сервиса `site` в `docker-compose.yml` на сервере.
