"use client";

import { LOCALES, type Locale } from "@/lib/i18n";
import { useI18n } from "@/components/livka/i18n-context";

/** Compact RU / EN / 中文 segmented control shared by the site and admin panel. */
export function LangSwitch({ className = "" }: { className?: string }) {
  const { locale, setLocale } = useI18n();
  return (
    <div className={`lvk-lang ${className}`} role="group" aria-label="Language">
      {LOCALES.map((l) => (
        <button
          key={l.code}
          type="button"
          title={l.label}
          aria-pressed={l.code === locale}
          className={l.code === locale ? "active" : ""}
          onClick={() => setLocale(l.code as Locale)}
        >
          {l.short}
        </button>
      ))}
    </div>
  );
}
