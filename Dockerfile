# syntax=docker/dockerfile:1
# LIVKAMARKET site — multi-stage build (Next.js standalone output).
#   docker build -t livkamarket-site .
#   docker build --target migrator -t livkamarket-site-migrate .

# 1. Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci

# 2. Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# The public bot username is inlined into the client bundle at build time.
ARG NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=LivkaMarketbot
ENV NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=$NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
# DATABASE_URL is only checked at import time; the real one comes at runtime.
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
RUN npm run build

# 3. One-shot schema migration (site_* tables only, never the bot's tables)
FROM node:20-alpine AS migrator
WORKDIR /app
RUN apk add --no-cache postgresql-client
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src/db ./src/db
COPY scripts/migrate-phase3.sql ./scripts/migrate-phase3.sql
CMD ["sh", "-c", "psql \"$DATABASE_URL\" -v ON_ERROR_STOP=1 -f scripts/migrate-phase3.sql && npx drizzle-kit push --force --dialect=postgresql --schema=./src/db/schema.ts --url=\"$DATABASE_URL\" --tablesFilter='site_*' --tablesFilter=products --tablesFilter=orders"]

# 4. Lightweight production image
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server.js"]
