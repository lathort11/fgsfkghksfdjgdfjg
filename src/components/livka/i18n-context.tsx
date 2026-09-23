"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { DICTS, LOCALE_COOKIE, type Dict, type Locale } from "@/lib/i18n";

type Ctx = {
  locale: Locale;
  t: Dict;
  setLocale: (l: Locale) => void;
};

const I18nCtx = createContext<Ctx | null>(null);

export function LangProvider({
  initial,
  children,
}: {
  initial: Locale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initial);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
      document.documentElement.lang = l;
    } catch {
      /* noop */
    }
  }, []);

  const value = useMemo<Ctx>(
    () => ({ locale, t: DICTS[locale], setLocale }),
    [locale, setLocale]
  );

  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nCtx);
  if (!ctx) throw new Error("useI18n must be used inside LangProvider");
  return ctx;
}
