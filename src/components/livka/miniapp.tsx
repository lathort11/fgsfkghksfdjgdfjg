"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState, type ComponentType, type SVGProps } from "react";
import { useI18n } from "@/components/livka/i18n-context";
import { Check, Clock, Globe, KeyIcon, LivkaMark, Lock, Shield, Telegram, UserIcon, XIcon } from "@/components/livka/icons";
import { buildVerifyUrl, verifyIp, type VerifyResult, type VerifyState } from "@/lib/miniapp";

/* Official Telegram Mini Apps SDK. Loaded only on this route. */
const TELEGRAM_SDK_SRC = "https://telegram.org/js/telegram-web-app.js";
const SDK_TIMEOUT_MS = 10_000;
const CLOSE_DELAY_MS = 1_800;
const CLOSE_CHECK_MS = 1_500;
const APP_BG = "#070708";

/*
 * Only the parts of Telegram.WebApp used here. `initDataUnsafe` is left out on
 * purpose: nothing on this page may read an unverified user ID. The backend
 * gets the signed `initData` string and verifies it itself.
 */
type TelegramWebApp = {
  initData: string;
  ready: () => void;
  expand: () => void;
  close: () => void;
  isVersionAtLeast?: (version: string) => boolean;
  setBackgroundColor?: (color: string) => void;
  setHeaderColor?: (color: string) => void;
  HapticFeedback?: { notificationOccurred: (type: "error" | "success" | "warning") => void };
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

type View = "loading" | "no_telegram" | "no_init_data" | VerifyState;

const ICONS: Partial<Record<View, ComponentType<SVGProps<SVGSVGElement>>>> = {
  verified: Check,
  vpn: Shield,
  datacenter: Globe,
  duplicate: UserIcon,
  registration: UserIcon,
  session: KeyIcon,
  bad_request: KeyIcon,
  forbidden: Lock,
  rate_limited: Clock,
  timeout: Clock,
  offline: Clock,
  no_init_data: Telegram,
  no_telegram: Telegram,
};

function getWebApp(): TelegramWebApp | undefined {
  return typeof window === "undefined" ? undefined : window.Telegram?.WebApp;
}

function supports(tg: TelegramWebApp, version: string): boolean {
  try {
    return tg.isVersionAtLeast?.(version) === true;
  } catch {
    return false;
  }
}

function attempt(fn: () => void) {
  try {
    fn();
  } catch {
    /* Older clients or outside Telegram: the method is optional. */
  }
}

export default function MiniAppVerify({
  backendBase,
  configError,
}: {
  backendBase: string;
  configError: boolean;
}) {
  const { t } = useI18n();
  const [view, setView] = useState<View>("loading");
  const [outcome, setOutcome] = useState<VerifyResult | null>(null);
  const [closeFailed, setCloseFailed] = useState(false);
  const [hasWebApp, setHasWebApp] = useState(false);
  const booted = useRef(false);
  const inflight = useRef(false);
  const timers = useRef<number[]>([]);

  const schedule = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  useEffect(() => {
    const bag = timers;
    return () => {
      bag.current.forEach((id) => window.clearTimeout(id));
      bag.current = [];
    };
  }, []);

  const closeApp = useCallback(() => {
    const tg = getWebApp();
    if (tg) attempt(() => tg.close());
    // Still visible a moment later → closing is not available here.
    schedule(() => setCloseFailed(true), CLOSE_CHECK_MS);
  }, [schedule]);

  const verify = useCallback(async () => {
    if (inflight.current) return;
    const tg = getWebApp();
    if (!tg) {
      setView("no_telegram");
      return;
    }

    // Signed launch payload, read at call time and never stored anywhere.
    const initData = typeof tg.initData === "string" ? tg.initData : "";
    if (!initData) {
      setView("no_init_data");
      return;
    }

    setOutcome(null);
    setCloseFailed(false);

    if (configError) {
      setOutcome({
        state: "unavailable",
        httpStatus: null,
        messageKey: null,
        backendStatus: null,
        detail: "config",
        ip: null,
        referralQualified: false,
      });
      setView("unavailable");
      return;
    }

    inflight.current = true;
    setView("loading");
    try {
      const res = await verifyIp({
        url: buildVerifyUrl(backendBase),
        initData,
        isOnline: () => navigator.onLine !== false,
      });
      setOutcome(res);
      setView(res.state);

      if (res.state === "verified") {
        if (supports(tg, "6.1")) attempt(() => tg.HapticFeedback?.notificationOccurred("success"));
        schedule(closeApp, CLOSE_DELAY_MS);
      }
    } finally {
      inflight.current = false;
    }
  }, [backendBase, configError, closeApp, schedule]);

  const boot = useCallback(() => {
    if (booted.current) return;
    const tg = getWebApp();
    if (!tg) return;
    booted.current = true;
    setHasWebApp(true);

    attempt(() => tg.ready());
    attempt(() => tg.expand());
    if (supports(tg, "6.1")) attempt(() => tg.setBackgroundColor?.(APP_BG));
    if (supports(tg, "6.9")) attempt(() => tg.setHeaderColor?.(APP_BG));

    void verify();
  }, [verify]);

  useEffect(() => {
    // If the SDK never arrives (blocked, offline), stop the spinner and say why.
    const id = window.setTimeout(() => {
      if (!booted.current) setView("no_telegram");
    }, SDK_TIMEOUT_MS);
    return () => window.clearTimeout(id);
  }, []);

  const retry = () => {
    if (view === "no_telegram") {
      window.location.reload();
      return;
    }
    void verify();
  };

  const copy = t.miniapp.states[view];
  const Icon = ICONS[view] ?? XIcon;
  const busy = view === "loading";
  const ok = view === "verified";
  // Without initData a retry cannot help: the user has to reopen the Mini App
  // from the bot's WebApp button, so "back to Telegram" becomes the main action.
  const canRetry = !ok && view !== "no_init_data";
  const backIsPrimary = ok || view === "no_init_data";

  return (
    <>
      <Script
        src={TELEGRAM_SDK_SRC}
        strategy="afterInteractive"
        onReady={boot}
        onError={() => {
          if (!booted.current) setView("no_telegram");
        }}
      />

      <main className="flex min-h-[100dvh] items-center justify-center px-5 py-10">
        <section className="glass w-full max-w-sm p-7 text-center" aria-labelledby="miniapp-title">
          <div
            className="flex items-center justify-center gap-2 text-[11px] uppercase tracking-[0.2em]"
            style={{ color: "var(--ink-3)" }}
          >
            <LivkaMark className="h-4 w-4" />
            LIVKAMARKET
          </div>

          <div
            className="mx-auto mt-7 flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{
              background: ok ? "rgba(16,185,129,.14)" : busy ? "rgba(244,241,234,.06)" : "rgba(231,194,122,.12)",
              color: ok ? "#10b981" : busy ? "var(--ink)" : "#e7c27a",
            }}
          >
            {busy ? (
              <span
                className="h-7 w-7 animate-spin rounded-full border-2 border-white/15 border-t-white"
                aria-hidden="true"
              />
            ) : (
              <Icon className="h-7 w-7" />
            )}
          </div>

          <div role="status" aria-live="polite">
            <h1 id="miniapp-title" className="ff-d mt-6 text-xl leading-snug text-white">
              {copy.t}
            </h1>
            <p className="mt-3 text-[14px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
              {ok && closeFailed ? t.miniapp.closeManually : copy.d}
            </p>
          </div>

          {ok && (outcome?.ip || outcome?.referralQualified) && (
            <div
              className="mt-5 space-y-2 rounded-2xl p-4 text-left text-[13px]"
              style={{ background: "rgba(255,255,255,.03)", border: "1px solid var(--line)" }}
            >
              {outcome?.ip && (
                <div className="flex items-center justify-between gap-3">
                  <span style={{ color: "var(--ink-3)" }}>{t.miniapp.ip}</span>
                  <span className="font-mono text-white">{outcome.ip}</span>
                </div>
              )}
              {outcome?.referralQualified && (
                <div className="flex items-center gap-2" style={{ color: "#10b981" }}>
                  <Check className="h-4 w-4" />
                  {t.miniapp.referral}
                </div>
              )}
            </div>
          )}

          {!busy && (
            <div className="mt-7 flex flex-col gap-2.5">
              {canRetry && (
                <button type="button" onClick={retry} className="btn btn-primary w-full !py-3.5 text-sm">
                  {view === "no_telegram" ? t.miniapp.reload : t.miniapp.retry}
                </button>
              )}
              {(ok || hasWebApp) && (
                <button
                  type="button"
                  onClick={closeApp}
                  className={`btn w-full !py-3.5 text-sm ${backIsPrimary ? "btn-primary" : "btn-ghost"}`}
                >
                  {t.miniapp.back}
                </button>
              )}
            </div>
          )}

          {!ok && closeFailed && (
            <p className="mt-3 text-[12px]" style={{ color: "var(--ink-3)" }}>
              {t.miniapp.closeManually}
            </p>
          )}

          {!busy && !ok && outcome?.detail && (
            <p className="mt-4 font-mono text-[11px]" style={{ color: "var(--ink-3)" }}>
              {t.miniapp.code}: {outcome.detail}
            </p>
          )}

          <p className="mt-6 text-[11px] leading-relaxed" style={{ color: "var(--ink-3)" }}>
            {t.miniapp.note}
          </p>
        </section>
      </main>
    </>
  );
}
