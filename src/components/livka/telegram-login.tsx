"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/livka/i18n-context";
import type { SessionUser } from "@/components/livka/auth";

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

/* ═══════════ Availability on this domain ═══════════
 * Telegram shows "Bot domain invalid" inside its iframe on any domain that is
 * not linked to the bot in @BotFather (exact match). The server checks it
 * beforehand (/api/auth/telegram/widget) and the block is only rendered where
 * sign-in can actually work. Shared by every mount; prefetched on page load
 * so the modal opens without a layout jump. */
type Availability = { available: boolean; bot: string; reason: string };

let availability: Availability | null = null;
let pending: Promise<Availability> | null = null;

export function prefetchTelegramLogin(): Promise<Availability> {
  if (availability) return Promise.resolve(availability);
  if (pending) return pending;
  pending = fetch(`/api/auth/telegram/widget?origin=${encodeURIComponent(window.location.origin)}`, { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((d: { available?: boolean; bot?: string; reason?: string }) => {
      const bot = typeof d.bot === "string" ? d.bot : "";
      const result: Availability = { available: d.available === true && !!bot, bot, reason: d.reason ?? "unknown" };
      if (!result.available) {
        console.warn(
          result.reason === "domain"
            ? `[telegram-login] "Bot domain invalid": ${window.location.hostname} is not linked to @${bot}. ` +
                `Link it in @BotFather → /setdomain (exact domain). Telegram sign-in is hidden here.`
            : `[telegram-login] Telegram sign-in is unavailable here (${result.reason}).`
        );
      }
      if (result.reason !== "busy") availability = result;
      pending = null;
      return result;
    })
    .catch(() => {
      pending = null; // retry on the next open
      return { available: false, bot: "", reason: "network" };
    });
  return pending;
}

/**
 * Official Telegram Login Widget. Telegram calls `onAuth` with the signed
 * payload; we post it to /api/auth/telegram/callback which verifies the hash
 * and opens a session. Renders nothing where Telegram would reject the domain.
 */
export function TelegramLoginButton({
  onAuth,
  onSuccess,
  onError,
}: {
  onAuth?: (user: TelegramWidgetUser) => void;
  onSuccess?: (user: SessionUser) => void;
  onError?: (message: string) => void;
}) {
  const { locale } = useI18n();
  const c = COPY[(locale as keyof typeof COPY) ?? "ru"] ?? COPY.ru;
  const box = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Availability | null>(availability);
  const handlers = useRef({ onAuth, onSuccess, onError, c });
  handlers.current = { onAuth, onSuccess, onError, c };

  useEffect(() => {
    if (status) return;
    let alive = true;
    void prefetchTelegramLogin().then((s) => {
      if (alive) setStatus(s);
    });
    return () => {
      alive = false;
    };
  }, [status]);

  const bot = status?.available ? status.bot : null;

  useEffect(() => {
    if (!bot) return;
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
    s.setAttribute("data-telegram-login", bot);
    s.setAttribute("data-size", "large");
    s.setAttribute("data-radius", "12");
    s.setAttribute("data-request-access", "write");
    s.setAttribute("data-userpic", "true");
    s.setAttribute("data-lang", locale === "zh" ? "en" : locale);
    s.setAttribute("data-onauth", "window.__livkaTelegramAuth(user)");
    // Blocked / offline: hide the block instead of leaving an empty frame.
    s.onerror = () => setStatus({ available: false, bot, reason: "script" });
    el.appendChild(s);
    return () => {
      el.innerHTML = "";
    };
  }, [bot, locale]);

  if (status && !status.available) return null;

  return (
    <div className="mb-5">
      <div
        className="flex min-h-[56px] items-center justify-center rounded-2xl p-2"
        style={{ background: "rgba(42,171,238,.08)", border: "1px solid rgba(42,171,238,.25)" }}
      >
        {!status && (
          <span className="h-10 w-56 animate-pulse rounded-xl" style={{ background: "rgba(42,171,238,.14)" }} aria-hidden="true" />
        )}
        {busy && <span className="text-sm" style={{ color: "#7dd3fc" }}>{c.wait}</span>}
        <div ref={box} className={busy || !status ? "hidden" : "flex justify-center"} />
      </div>
      <div className="mt-4 flex items-center gap-3 text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--ink-3)" }}>
        <span className="h-px flex-1" style={{ background: "var(--line)" }} />
        {c.or}
        <span className="h-px flex-1" style={{ background: "var(--line)" }} />
      </div>
    </div>
  );
}
