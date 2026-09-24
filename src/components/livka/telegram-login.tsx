"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/livka/i18n-context";
import type { SessionUser } from "@/components/livka/auth";

/** Public bot username for the official Telegram Login Widget. */
export const TELEGRAM_BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "LivkaMarketbot";
const WIDGET_SRC = "https://telegram.org/js/telegram-widget.js?22";

export type TelegramWidgetUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

declare global {
  interface Window {
    __livkaTelegramAuth?: (user: TelegramWidgetUser) => void;
  }
}

const COPY = {
  ru: { or: "или по e-mail", fail: "Не удалось войти через Telegram. Попробуйте ещё раз.", off: "Вход через Telegram временно недоступен.", wait: "Входим…" },
  en: { or: "or with e-mail", fail: "Telegram sign-in failed. Please try again.", off: "Telegram sign-in is temporarily unavailable.", wait: "Signing in…" },
  zh: { or: "或使用邮箱", fail: "Telegram 登录失败，请重试。", off: "Telegram 登录暂不可用。", wait: "正在登录…" },
} as const;

/**
 * Official Telegram Login Widget. Telegram calls `onAuth` with the signed
 * payload; we post it to /api/auth/telegram/callback which verifies the hash
 * and opens a session. The widget only renders on the domain linked to the
 * bot via @BotFather → /setdomain (livkamarket.app).
 */
export function TelegramLoginButton({
  botUsername = TELEGRAM_BOT_USERNAME,
  onAuth,
  onSuccess,
  onError,
}: {
  botUsername?: string;
  onAuth?: (user: TelegramWidgetUser) => void;
  onSuccess?: (user: SessionUser) => void;
  onError?: (message: string) => void;
}) {
  const { locale } = useI18n();
  const c = COPY[(locale as keyof typeof COPY) ?? "ru"] ?? COPY.ru;
  const box = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const handlers = useRef({ onAuth, onSuccess, onError, c });
  handlers.current = { onAuth, onSuccess, onError, c };

  useEffect(() => {
    window.__livkaTelegramAuth = async (user) => {
      const h = handlers.current;
      h.onAuth?.(user);
      setBusy(true);
      try {
        const res = await fetch("/api/auth/telegram/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(user),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.user) {
          h.onError?.(data.error === "NOT_CONFIGURED" ? h.c.off : h.c.fail);
          return;
        }
        h.onSuccess?.(data.user as SessionUser);
      } catch {
        h.onError?.(h.c.fail);
      } finally {
        setBusy(false);
      }
    };

    const el = box.current;
    if (!el) return;
    el.innerHTML = "";
    const s = document.createElement("script");
    s.src = WIDGET_SRC;
    s.async = true;
    s.setAttribute("data-telegram-login", botUsername);
    s.setAttribute("data-size", "large");
    s.setAttribute("data-radius", "12");
    s.setAttribute("data-request-access", "write");
    s.setAttribute("data-userpic", "true");
    s.setAttribute("data-lang", locale === "zh" ? "en" : locale);
    s.setAttribute("data-onauth", "window.__livkaTelegramAuth(user)");
    el.appendChild(s);
    return () => {
      el.innerHTML = "";
    };
  }, [botUsername, locale]);

  return (
    <div className="mb-5">
      <div
        className="flex min-h-[48px] items-center justify-center rounded-2xl p-2"
        style={{ background: "rgba(42,171,238,.08)", border: "1px solid rgba(42,171,238,.25)" }}
      >
        {busy && <span className="text-sm" style={{ color: "#7dd3fc" }}>{c.wait}</span>}
        <div ref={box} className={busy ? "hidden" : "flex justify-center"} />
      </div>
      <div className="mt-4 flex items-center gap-3 text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--ink-3)" }}>
        <span className="h-px flex-1" style={{ background: "var(--line)" }} />
        {c.or}
        <span className="h-px flex-1" style={{ background: "var(--line)" }} />
      </div>
    </div>
  );
}
