# Telegram Mini App: проверка IP

Страница сайта `/miniapp` — клиент для уже существующего endpoint'а бота
`POST /miniapp/api/verify-ip` (репозиторий `LIVKA-TEAM/LIVKAMARKET-telegram-bot`).

Фронтенд **ничего не решает про IP**. Он передаёт подписанную строку
`Telegram.WebApp.initData` и показывает ответ backend. Подпись, реальный IP,
VPN/proxy/datacenter, уникальность, сохранение, статус и реферал — только backend.

## Файлы

| Файл | Что делает |
| --- | --- |
| `src/app/miniapp/page.tsx` | Маршрут `/miniapp`: метаданные (noindex), язык из cookie сайта, чтение `MINIAPP_BACKEND_URL` при каждом запросе |
| `src/components/livka/miniapp.tsx` | Клиентский экран: официальный SDK, `ready()` / `expand()`, запрос, состояния, повтор, haptic, закрытие |
| `src/lib/miniapp.ts` | Без зависимостей: URL, запрос с таймаутом, разбор HTTP/JSON → состояние |
| `src/lib/i18n.ts` | Раздел `miniapp` (ru / en / zh) |
| `scripts/test-miniapp-verify.mjs` | Тест `src/lib/miniapp.ts` на локальной заглушке backend |
| `.env.example` | Описание `MINIAPP_BACKEND_URL` |

## Что отправляется

```
POST {MINIAPP_BACKEND_URL}/miniapp/api/verify-ip
Content-Type: application/json

{"initData": "<Telegram.WebApp.initData как есть>"}
```

- В теле только `initData`: без user ID, без IP, без полей `initDataUnsafe`.
- `initDataUnsafe` не используется и даже не объявлен в типах.
- Cookies не отправляются (`credentials: "omit"`).
- Наш код не пишет initData в localStorage, cookies или конфигурацию.
  Официальный `telegram-web-app.js` сам кладёт параметры запуска в
  `sessionStorage` (`__telegram__initParams`) — это поведение SDK Telegram.
- Таймаут запроса 15 секунд.

## Переменные окружения

| Переменная | Где читается | Обязательна | Значение |
| --- | --- | --- | --- |
| `MINIAPP_BACKEND_URL` | сервер Next.js, при каждом запросе к `/miniapp` | нет | пусто → тот же домен; иначе `https://bot.example.com` |
| `DATABASE_URL` | уже было | да | для остального сайта, Mini App его не использует |

`MINIAPP_BACKEND_URL` **публичная**: браузер обращается к ней напрямую. Токен
бота и любые секреты на фронтенде не нужны и не должны появляться. Разрешён
только `https://` (`http://` — только для localhost). После изменения
перезапустите `next start`, пересборка не нужна. Если значение невалидно,
в логе сервера будет `[miniapp] ...`, а пользователь увидит
«Сервис временно недоступен» с кодом `config`.

## Вариант A: один домен (рекомендуется, CORS не нужен)

`MINIAPP_BACKEND_URL` пустая. Reverse proxy отправляет `/miniapp/api/` в бот,
всё остальное (включая страницу `/miniapp`) — в Next.js. GET `/miniapp` бота
при этом перекрывается страницей сайта — это и есть цель интеграции.

```nginx
location /miniapp/api/ {
    proxy_pass http://127.0.0.1:8080;          # backend бота
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $remote_addr;  # перезаписать, а не дописать клиентское значение
    proxy_set_header X-Forwarded-Proto $scheme;
}

location / {
    proxy_pass http://127.0.0.1:3000;          # Next.js
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

За Cloudflare реальный адрес восстанавливается через `real_ip` по диапазонам
Cloudflare (`CF-Connecting-IP`), иначе backend увидит IP Cloudflare.

## Вариант B: разные домены

`MINIAPP_BACKEND_URL=https://bot.example.com`. Запрос кросс-доменный и
вызывает preflight (из-за `Content-Type: application/json`). Backend должен
для `OPTIONS` и `POST /miniapp/api/verify-ip`, **включая ответы 4xx/5xx**,
отдавать:

```
Access-Control-Allow-Origin: https://<домен сайта>
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
Access-Control-Max-Age: 600
Vary: Origin
```

`Access-Control-Allow-Credentials` не нужен. Если CORS не настроен, браузер
блокирует ответ, и страница покажет «Сервис временно недоступен» с кодом
`network` (проверено в Chromium). Ошибки, которые генерирует сам прокси
(502/504 без CORS-заголовков), выглядят так же.

## Реальный IP — обязательные условия

- Не проксировать запрос через Next.js (rewrites, route handlers): backend
  увидит IP сервера сайта, а доверие к IP переедет на фронтенд.
- Backend берёт IP только из заголовка своего доверенного прокси и только
  если соединение пришло от этого прокси (backend не должен быть доступен
  напрямую из интернета в обход прокси).

## Бот и Telegram

- Mini App должен открываться кнопкой типа `web_app` (inline / reply
  keyboard, menu button или Main Mini App в BotFather) с URL
  `https://<домен сайта>/miniapp`. Обычная `url`-кнопка **не передаёт**
  initData → экран «Откройте проверку из Telegram».
- Сайт должен работать по HTTPS.
- Telegram Web (web.telegram.org) открывает Mini App в iframe: не отдавайте
  `X-Frame-Options` или `frame-ancestors`, запрещающие `https://web.telegram.org`.
  Next.js по умолчанию таких заголовков не ставит.

## Ответы backend → экран

| Ответ | Экран |
| --- | --- |
| 2xx, `ok: true`, `status: "verified"` / `ip.verified` | «IP успешно подтверждён», haptic `success`, закрытие через 1.8 с |
| `ip.vpn_detected` / `vpn_detected` | «Отключите VPN или Proxy» |
| `ip.datacenter` / `datacenter` | «Используйте домашний или мобильный интернет» |
| `ip.duplicate` / `duplicate`, или голый 409 | «Этот IP уже зарегистрирован» |
| `verification.required` | «Сначала завершите регистрацию в Telegram-боте» |
| 400 | «Не удалось отправить данные проверки» |
| 401 | «Данные Telegram не прошли проверку» (открыть заново из бота) |
| 403 без известного ключа | «Доступ к проверке запрещён» |
| 404, 502, 503, 504, невалидный JSON, сеть, ошибка CORS | «Сервис временно недоступен» + код |
| 429 | «Слишком много попыток» |
| 500, `common.error` | «Не удалось выполнить проверку» |
| таймаут 15 с | «Сервер не ответил вовремя» |
| `navigator.onLine === false` | «Нет подключения к интернету» |

Приоритет: успешный payload → конкретный `message_key` → `status` → HTTP-код.
Общий `common.error` не перекрывает более точный HTTP-код (например, 401 или 503).
`ok: true` без `status: "verified"` считается ошибкой, чтобы не показать ложный успех.
Под каждой ошибкой — кнопка «Проверить снова» (кроме отсутствия initData:
там повтор бесполезен, главная кнопка — «Вернуться в Telegram»).

## Ручная проверка в Telegram

1. Разверните сайт по HTTPS и выберите вариант A или B.
2. Укажите кнопке `web_app` бота URL `https://<домен сайта>/miniapp`.
3. Откройте бота на телефоне и в Telegram Desktop, нажмите кнопку.
   Ожидается «Проверяем подключение...», затем результат.
4. Матрица: без VPN (успех, окно закрывается) · с VPN · через облачный
   сервер/прокси (datacenter) · второй аккаунт из той же сети (duplicate) ·
   незарегистрированный аккаунт · режим полёта (офлайн/таймаут).
5. Откройте `https://<домен сайта>/miniapp` в обычном браузере: должно быть
   «Откройте проверку из Telegram», запросов к backend — ноль.
6. Сетевые запросы внутри Telegram: Telegram Desktop → Settings → Advanced →
   Experimental → «Enable webview inspection»; Android — `chrome://inspect`
   при включённой отладке WebView в Telegram.

## Автотест клиента

```
node scripts/test-miniapp-verify.mjs
```

Node ≥ 22.18 (встроенное удаление типов). Реальные HTTP-запросы к локальной
заглушке: все HTTP-коды и тела из контракта, невалидный JSON, таймаут, отказ
соединения, офлайн, точная форма запроса. Заглушка не проверяет подписи и IP.
