"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Counter, Reveal, ScrollProgress, Spot } from "@/components/livka/ui";
import { ScrambleText } from "@/components/livka/interactive";
import { useI18n } from "@/components/livka/i18n-context";
import { AccountMenu, AuthModal, type SessionUser } from "@/components/livka/auth";
import { CheckoutModal, ICONS, MyOrdersModal, fmtRub, hexA } from "@/components/livka/checkout";
import { ProfileModal } from "@/components/livka/profile";
import type { ProductRow } from "@/db/schema";
import { LOCALES, type Locale } from "@/lib/i18n";
import { plateFor, plateFocus } from "@/lib/plates";
import {
  ArrowRight, ArrowUpRight, Check, ChevronDown, Clock, GeminiMark,
  Headset, MenuIcon, Receipt, Search, Shield,
  Sparkle, Star, Telegram, UserIcon, Wallet, XIcon, Zap, Globe, LivkaMark,
} from "@/components/livka/icons";

const TELEGRAM_URL = "https://t.me/livkamarket";

/* ═══════════════ PAGE GLOW ═══════════════ */
function PageGlow() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const on = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--gx", `${e.clientX}px`);
        el.style.setProperty("--gy", `${e.clientY}px`);
      });
    };
    window.addEventListener("mousemove", on, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", on);
    };
  }, []);
  return <div ref={ref} className="page-glow" aria-hidden="true" />;
}

/* ═══════════════ WORD REVEAL ═══════════════ */
function RW({ text, delay = 0, className }: { text: string; delay?: number; className?: string }) {
  return (
    <span className={`rw ${className ?? ""}`}>
      <i style={{ animationDelay: `${delay}ms` }}>{text}</i>
    </span>
  );
}

/* ═══════════════ LANGUAGE SWITCHER ═══════════════ */
function LangSwitcher() {
  const { locale, setLocale } = useI18n();
  const idx = LOCALES.findIndex((l) => l.code === locale);
  return (
    <div
      className="relative flex items-center p-1 rounded-2xl"
      style={{ background: "rgba(255,255,255,.04)", border: "1px solid var(--line)" }}
    >
      <span
        className="absolute top-1 bottom-1 rounded-xl transition-all duration-500 lang-ind"
        style={{
          width: `calc(${100 / LOCALES.length}% - ${8 / LOCALES.length}px)`,
          left: `calc(${(idx * 100) / LOCALES.length}% + 4px)`,
          background: "linear-gradient(135deg,rgba(124,92,255,.85),rgba(79,140,255,.85))",
        }}
      />
      {LOCALES.map((l) => (
        <button
          key={l.code}
          onClick={() => setLocale(l.code as Locale)}
          title={l.label}
          className="relative z-10 px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] font-bold transition-colors"
          style={{ color: l.code === locale ? "#fff" : "var(--ink-3)" }}
        >
          {l.short}
        </button>
      ))}
    </div>
  );
}

/* ═══════════════ NAVBAR ═══════════════ */
function Navbar({
  user,
  onLogin,
  onOrders,
  onProfile,
  onLogout,
  onTrack,
}: {
  user: SessionUser | null;
  onLogin: () => void;
  onOrders: () => void;
  onProfile: () => void;
  onLogout: () => void;
  onTrack: () => void;
}) {
  const { t } = useI18n();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", on, { passive: true });
    on();
    return () => window.removeEventListener("scroll", on);
  }, []);

  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  const nav = [
    { href: "#catalog", label: t.nav.catalog },
    { href: "#how", label: t.nav.how },
    { href: "#faq", label: t.nav.faq },
  ];

  return (
    <header className={`nav-shell fixed top-0 left-0 right-0 z-50 ${scrolled ? "is-scrolled" : ""}`}>
      <div
        className="overflow-hidden transition-all duration-500"
        style={{ maxHeight: scrolled ? 0 : 34, opacity: scrolled ? 0 : 1 }}
      >
        <div
          className="flex items-center justify-center px-4 py-2 text-[11px] tracking-[0.16em] uppercase"
          style={{ color: "#d9d2c8" }}
        >
          {t.bar}
        </div>
      </div>

      <nav className="max-w-7xl mx-auto flex items-center justify-between gap-3 h-[64px] px-3 sm:px-6 lg:px-8">
        <a href="#top" className="flex items-center gap-2.5 group shrink-0">
          <span
            className="flex items-center justify-center w-9 h-9 rounded-2xl"
            style={{ background: "#17171c", border: "1px solid var(--line-2)" }}
          >
            <LivkaMark className="w-[18px] h-[18px]" />
          </span>
          <span className="ff-d text-[13px] sm:text-base text-white" style={{ fontWeight: 800 }}>
            LIVKA<span className="grad-main">MARKET</span>
          </span>
        </a>

        <div className="hidden lg:flex items-center gap-0.5">
          {nav.map((l) => (
            <a key={l.href} href={l.href} className="navlink">
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="hidden sm:block">
            <LangSwitcher />
          </div>
          {user ? (
            <AccountMenu
              user={user}
              onOpenOrders={onOrders}
              onOpenProfile={onProfile}
              onLogout={onLogout}
            />
          ) : (
            <button onClick={onLogin} className="btn btn-ghost !py-2.5 !px-3.5 text-sm hidden sm:inline-flex">
              <UserIcon className="w-4 h-4" />
              {t.auth.login}
            </button>
          )}
          <button onClick={onTrack} className="btn btn-ghost !py-2.5 !px-3 text-sm hidden md:inline-flex">
            <Search className="w-4 h-4" />
            {t.track.chip}
          </button>
          <a href="#catalog" className="btn btn-primary !py-2.5 !px-4 text-sm hidden md:inline-flex">
            {t.catalog.buy}
          </a>
          <button
            className="lg:hidden flex items-center justify-center w-10 h-10 rounded-xl shrink-0"
            style={{ border: "1px solid var(--line)", background: "rgba(255,255,255,.04)", color: "var(--ink-2)" }}
            onClick={() => setOpen(!open)}
            aria-label="menu"
          >
            {open ? <XIcon className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      <div
        className="lg:hidden fixed inset-x-0 top-0 bottom-0 -z-10 flex flex-col items-center justify-center gap-5 transition-all duration-300 px-6"
        style={{
          background: "rgba(5,5,11,.97)",
          backdropFilter: "blur(28px)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
        }}
      >
        <div className="sm:hidden mb-2">
          <LangSwitcher />
        </div>
        {nav.map((l) => (
          <a
            key={l.href}
            href={l.href}
            onClick={() => setOpen(false)}
            className="ff-d text-xl sm:text-2xl text-white/90 uppercase text-center"
            style={{ fontWeight: 700 }}
          >
            {l.label}
          </a>
        ))}
        <div className="flex flex-col gap-3 mt-4 w-64">
          <a href="#catalog" onClick={() => setOpen(false)} className="btn btn-primary w-full">
            {t.catalog.buy}
          </a>
          <button
            onClick={() => {
              setOpen(false);
              onTrack();
            }}
            className="btn btn-ghost w-full"
          >
            <Search className="w-4 h-4" /> {t.track.chip}
          </button>
          {user ? (
            <>
              <button
                onClick={() => {
                  setOpen(false);
                  onProfile();
                }}
                className="btn btn-ghost w-full"
              >
                <UserIcon className="w-4 h-4" /> {t.profile.title}
              </button>
              <button
                onClick={() => {
                  setOpen(false);
                  onOrders();
                }}
                className="btn btn-ghost w-full"
              >
                <Receipt className="w-4 h-4" /> {t.auth.myOrders}
              </button>
              <button
                onClick={() => {
                  setOpen(false);
                  onLogout();
                }}
                className="btn btn-ghost w-full"
              >
                {t.auth.logout}
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                setOpen(false);
                onLogin();
              }}
              className="btn btn-ghost w-full"
            >
              <UserIcon className="w-4 h-4" /> {t.auth.login}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

/* ═══════════════ HERO ═══════════════ */
function Hero({ products }: { products: ProductRow[] }) {
  const { t } = useI18n();
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || products.length < 2) return;
    const id = setInterval(() => setIdx((v) => v + 1), 4600);
    return () => clearInterval(id);
  }, [paused, products.length]);

  const active = products.length ? products[idx % products.length] : null;
  const activeCopy = active ? t.products[active.slug as keyof typeof t.products] : null;

  return (
    <section id="top" className="relative flex items-center pt-32 sm:pt-36 pb-16 lg:min-h-screen lg:pb-24 overflow-hidden">
      <div className="hero-grid" aria-hidden="true" />
      <div className="hero-beams" aria-hidden="true" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-[1.05fr_0.95fr] gap-14 items-center w-full">
        <div>
          <Reveal>
            <span className="chip">
              <span className="relative flex w-2 h-2">
                <span className="pulse-dot absolute w-2 h-2 rounded-full bg-emerald-400" />
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              </span>
              {t.hero.badge}
            </span>
          </Reveal>

          <h1 className="d1 mt-7">
            <RW text={t.hero.t1} delay={80} />
            <br />
            <span className="grad-main">
              <RW text={t.hero.t2} delay={220} />
            </span>
            <br />
            <span style={{ color: "var(--ink)" }}>
              <RW text={t.hero.t3} delay={360} />
            </span>
          </h1>

          <Reveal delay={420}>
            <p className="mt-7 max-w-xl text-sm sm:text-base leading-relaxed" style={{ color: "var(--ink-2)" }}>
              {t.hero.sub}
            </p>
          </Reveal>

          <Reveal delay={500}>
            <div className="mt-9 flex flex-wrap items-center gap-3 sm:gap-4">
              <a href="#catalog" className="btn btn-primary text-sm sm:text-base !px-7 sm:!px-8 !py-4">
                {t.hero.cta1}
                <ArrowRight className="w-4 h-4" />
              </a>
              <a href={TELEGRAM_URL} target="_blank" rel="noreferrer" className="btn btn-ghost text-sm sm:text-base !px-6 !py-4">
                <Telegram className="w-4 h-4 text-sky-300" />
                {t.hero.cta2}
              </a>
            </div>
          </Reveal>

          <Reveal delay={580}>
            <div className="mt-10 flex flex-wrap gap-2 text-[12px]" style={{ color: "var(--ink-2)" }}>
              {[t.hero.nets, t.hero.quote, t.hero.secret].map((fact) => (
                <span key={fact} className="rounded-full px-3 py-1.5" style={{ border: "1px solid var(--line)" }}>
                  {fact}
                </span>
              ))}
            </div>
          </Reveal>
        </div>

        <div className="relative">
          {active && (
            <a href="#catalog" className="stage block" key={active.slug}>
              <img src={plateFor(active.slug)} alt={activeCopy?.name ?? ""} style={{ objectPosition: plateFocus(active.slug) }} />
              <div className="stage-veil" />
              <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-4 p-5 sm:p-6">
                <div className="min-w-0">
                  <div className="ff-d truncate text-[15px] font-bold text-white">{activeCopy?.name}</div>
                  <div className="truncate text-[12px] text-white/70">{activeCopy?.tagline}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="ff-d text-2xl font-black text-white">{fmtRub(active.priceCents)}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/55">{t.hero.inStock}</div>
                </div>
              </div>
            </a>
          )}

          <div className="mt-3 grid grid-cols-4 gap-2">
            {products.map((p, i) => {
              const on = !!active && p.id === active.id;
              const name = t.products[p.slug as keyof typeof t.products]?.name ?? p.slug;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setIdx(i);
                    setPaused(true);
                  }}
                  className={`stage-thumb ${on ? "is-on" : ""}`}
                  aria-label={name}
                  aria-pressed={on}
                >
                  <img src={plateFor(p.slug)} alt="" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════ MARQUEE ═══════════════ */
function Marquee() {
  const { t, locale } = useI18n();
  const items = [
    ...t.ticker.items,
    t.bar,
  ];
  const row = (
    <>
      {items.map((m, i) => (
        <span key={`${m}-${i}`} className="flex items-center gap-8 pr-8">
          <span
            className="ff-d text-base sm:text-xl uppercase tracking-wide whitespace-nowrap"
            style={{ fontWeight: 700, color: "rgba(245,245,250,.42)" }}
          >
            {m}
          </span>
          <Sparkle className="w-4 h-4 shrink-0" style={{ color: "rgba(124,92,255,.65)" }} />
        </span>
      ))}
    </>
  );
  return (
    <div className="relative py-5 border-y overflow-hidden" style={{ borderColor: "var(--line)" }} key={locale}>
      <div className="marquee">
        <div className="marquee__track">
          {row}
          <span aria-hidden="true" className="flex items-center">
            {row}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════ STATS ═══════════════ */
function Stats({ stats }: { stats: { totalSold: number; totalOrders: number } }) {
  const { t } = useI18n();
  const items = [
    { value: <Counter to={stats.totalSold} suffix="+" className="grad-main" />, label: t.stats.sold },
    { value: <Counter to={stats.totalOrders} suffix="+" className="grad-main" />, label: t.stats.orders },
    { value: <Counter to={2} prefix="~ " suffix={t.stats.min} className="grad-main" />, label: t.stats.avg },
    { value: <span className="grad-main">24/7</span>, label: t.stats.support },
  ];
  return (
    <section className="border-y" style={{ borderColor: "var(--line)" }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14 grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-8">
        {items.map((s) => (
          <div key={s.label}>
            <div className="ff-d text-3xl sm:text-4xl" style={{ fontWeight: 800 }}>
              {s.value}
            </div>
            <div className="mt-2 text-[12px] sm:text-[13px]" style={{ color: "var(--ink-3)" }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ═══════════════ CATALOG ═══════════════ */
function Catalog({
  products,
  onBuy,
}: {
  products: ProductRow[];
  onBuy: (p: ProductRow) => void;
}) {
  const { t } = useI18n();
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return products;
    return products.filter((p) => {
      const pd = t.products[p.slug as keyof typeof t.products];
      if (!pd) return false;
      return (
        pd.name.toLowerCase().includes(s) ||
        pd.tagline.toLowerCase().includes(s) ||
        pd.description.toLowerCase().includes(s)
      );
    });
  }, [q, products, t]);

  return (
    <section id="catalog" className="relative py-20 sm:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
          <div>
            <Reveal>
              <span className="chip">
                <Sparkle className="w-3 h-3" style={{ color: "var(--violet)" }} /> {t.catalog.chip}
              </span>
            </Reveal>
            <Reveal delay={80}>
              <h2 className="d2 mt-5">
                {t.catalog.t1}
                <br />
                <span className="grad-main">{t.catalog.t2}</span>
              </h2>
            </Reveal>
          </div>
          <Reveal delay={150}>
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-3)" }} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t.catalog.search}
                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-colors focus:border-white/25"
                style={{ background: "rgba(255,255,255,.04)", border: "1px solid var(--line)", color: "var(--ink)" }}
              />
            </div>
          </Reveal>
        </div>

        <div className="grid md:grid-cols-2 gap-5 lg:gap-6">
          {filtered.map((p, i) => {
            const pd = t.products[p.slug as keyof typeof t.products];
            if (!pd) return null;
            const accent = p.accent;
            const low = p.stock <= 15;
            return (
              <Reveal key={p.id} delay={i * 70}>
                <article className="pcard flex h-full flex-col overflow-hidden">
                  <div className="plate aspect-[16/10]">
                    <img src={plateFor(p.slug)} alt={pd.name} style={{ objectPosition: plateFocus(p.slug) }} />
                  </div>

                  <div className="flex flex-1 flex-col p-5 sm:p-6">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: accent }}>
                      {pd.badge}
                    </div>
                    <h3 className="ff-d mt-2 text-xl text-white" style={{ fontWeight: 700 }}>
                      {pd.name}
                    </h3>
                    <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
                      {pd.description}
                    </p>

                    <div className="mt-5 flex items-baseline gap-2">
                      <span className="ff-d text-3xl text-white" style={{ fontWeight: 800 }}>
                        {fmtRub(p.priceCents)}
                      </span>
                      <span className="text-[12px]" style={{ color: "var(--ink-3)" }}>
                        {t.per[p.per as keyof typeof t.per]}
                      </span>
                    </div>

                    <ul className="mt-4 flex-1 space-y-2">
                      {pd.features.map((f) => (
                        <li key={f} className="flex items-start gap-2.5 text-[13px]" style={{ color: "var(--ink-2)" }}>
                          <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: accent }} />
                          {f}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-5 flex items-center justify-between text-[11px]" style={{ color: "var(--ink-3)" }}>
                      <span>
                        {p.soldCount.toLocaleString("ru-RU")} {t.catalog.sold}
                      </span>
                      <span style={{ color: low ? "#e7c27a" : "var(--ink-3)" }}>
                        {t.catalog.left} {p.stock} {t.catalog.pieces}
                      </span>
                    </div>

                    <button
                      onClick={() => onBuy(p)}
                      className="btn mt-5 w-full !py-3.5 text-sm text-white"
                      style={{ background: accent }}
                    >
                      {t.catalog.buy}
                      <ArrowUpRight className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <p className="text-center py-12 text-sm" style={{ color: "var(--ink-3)" }}>
            {t.catalog.empty}
          </p>
        )}
      </div>
    </section>
  );
}

/* ═══════════════ COMPARE ═══════════════ */
function Compare({ products, onBuy }: { products: ProductRow[]; onBuy: (p: ProductRow) => void }) {
  const { t } = useI18n();
  const cols = ["gemini-pro-18", "antigravity-api", "chatgpt-pro", "supergrok"] as const;
  const colKeys = ["gemini", "api", "chatgpt", "grok"] as const;

  return (
    <section id="compare" className="py-20 sm:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <Reveal>
            <span className="chip">
              <Sparkle className="w-3 h-3" style={{ color: "var(--ice)" }} /> {t.compare.chip}
            </span>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="d2 mt-5">
              {t.compare.t1} <span className="grad-main">{t.compare.t2}</span>
            </h2>
          </Reveal>
          <Reveal delay={150}>
            <p className="mt-4 max-w-md mx-auto text-sm" style={{ color: "var(--ink-2)" }}>
              {t.compare.sub}
            </p>
          </Reveal>
        </div>

        <Reveal delay={180}>
          <div className="glass overflow-hidden" style={{ borderRadius: 24 }}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse">
                <thead>
                  <tr>
                    <th className="p-4 text-left text-[10px] uppercase tracking-widest" style={{ color: "var(--ink-3)" }}>
                      {t.compare.head.label}
                    </th>
                    {cols.map((slug, i) => {
                      const p = products.find((x) => x.slug === slug);
                      const Icon = p ? ICONS[p.icon as keyof typeof ICONS] : GeminiMark;
                      const accent = p?.accent ?? "#7c5cff";
                      return (
                        <th key={slug} className="p-4">
                          <div className="flex flex-col items-center gap-2">
                            <span className="relative h-12 w-16 overflow-hidden rounded-xl">
                              <img src={plateFor(slug)} alt="" className="h-full w-full object-cover" />
                              <span
                                className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-md bg-black/55"
                                style={{ color: accent }}
                              >
                                <Icon className="h-3 w-3" />
                              </span>
                            </span>
                            <span className="ff-d text-[11px] sm:text-xs text-white text-center" style={{ fontWeight: 700 }}>
                              {t.compare.head[colKeys[i]]}
                            </span>
                            <button
                              onClick={() => p && onBuy(p)}
                              className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full transition-all hover:brightness-125"
                              style={{ background: hexA(accent, 0.14), color: accent, border: `1px solid ${hexA(accent, 0.3)}` }}
                            >
                              {fmtRub(p?.priceCents ?? 0)}
                            </button>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {t.compare.rows.map((row, ri) => (
                    <tr key={row.label} style={{ borderTop: "1px solid var(--line)" }}>
                      <td
                        className="p-4 text-[11px] font-semibold uppercase tracking-wider"
                        style={{ color: "var(--ink-3)", background: ri % 2 ? "rgba(255,255,255,.012)" : "transparent" }}
                      >
                        {row.label}
                      </td>
                      {colKeys.map((k) => (
                        <td
                          key={k}
                          className="p-4 text-center text-[12px] sm:text-[13px]"
                          style={{ color: "var(--ink-2)", background: ri % 2 ? "rgba(255,255,255,.012)" : "transparent" }}
                        >
                          {row[k]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ═══════════════ HOW ═══════════════ */
function How() {
  const { t } = useI18n();
  const icons = [Wallet, Search, Zap, Check];
  return (
    <section id="how" className="py-20 sm:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-12">
          <div>
            <Reveal>
              <span className="chip">
                <Clock className="w-3.5 h-3.5" style={{ color: "var(--mint)" }} /> {t.how.chip}
              </span>
            </Reveal>
            <Reveal delay={80}>
              <h2 className="d2 mt-5">
                {t.how.t1}
                <br />
                <span className="grad-main">{t.how.t2}</span>
              </h2>
            </Reveal>
          </div>
          <Reveal delay={150}>
            <p className="max-w-sm text-sm leading-relaxed" style={{ color: "var(--ink-3)" }}>
              {t.how.sub}
            </p>
          </Reveal>
        </div>

        <div className="relative grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          <div
            aria-hidden="true"
            className="hidden lg:block absolute top-[52px] left-[12%] right-[12%] h-px"
            style={{
              background:
                "linear-gradient(90deg,transparent,rgba(124,92,255,.5),rgba(79,140,255,.5),rgba(47,230,167,.5),transparent)",
            }}
          />
          {t.how.steps.map((s, i) => {
            const Icon = icons[i];
            return (
              <Reveal key={s.t} delay={i * 95}>
                <Spot className="glass p-6 h-full" accent="rgba(124,92,255,0.13)">
                  <div className="relative z-10 flex items-center justify-between">
                    <span
                      className="flex items-center justify-center w-11 h-11 rounded-2xl"
                      style={{
                        background: "rgba(124,92,255,.12)",
                        border: "1px solid rgba(124,92,255,.22)",
                        color: "#a78bfa",
                      }}
                    >
                      <Icon className="w-5 h-5" />
                    </span>
                    <span className="ghost-num !text-3xl">{`0${i + 1}`}</span>
                  </div>
                  <h3 className="relative z-10 mt-4 text-[15px] font-bold text-white">{s.t}</h3>
                  <p className="relative z-10 mt-2 text-[13px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
                    {s.d}
                  </p>
                </Spot>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════ WHY ═══════════════ */
function Why() {
  const { t } = useI18n();
  const icons = [Wallet, Zap, Shield, Receipt, Search, Headset];
  return (
    <section id="why" className="py-20 sm:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <Reveal>
            <span className="chip">
              <Shield className="w-3.5 h-3.5" style={{ color: "var(--blue)" }} /> {t.why.chip}
            </span>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="d2 mt-5">
              {t.why.t1}
              <br />
              <span className="grad-main">{t.why.t2}</span>
            </h2>
          </Reveal>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {t.why.items.map((f, i) => {
            const Icon = icons[i];
            return (
              <Reveal key={f.t} delay={i * 70}>
                <Spot className="glass p-6 h-full flex gap-4" accent="rgba(79,140,255,0.13)">
                  <span
                    className="icon-tile relative z-10 shrink-0"
                    style={{
                      background: "rgba(124,92,255,.1)",
                      border: "1px solid rgba(124,92,255,.2)",
                      color: "#a78bfa",
                    }}
                  >
                    <Icon className="w-5 h-5" />
                  </span>
                  <div className="relative z-10">
                    <h3 className="text-[15px] font-bold text-white">{f.t}</h3>
                    <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
                      {f.d}
                    </p>
                  </div>
                </Spot>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════ REVIEWS ═══════════════ */
function Reviews() {
  const { t } = useI18n();
  return (
    <section className="py-20 sm:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <Reveal>
            <span className="chip">
              <Star className="w-3.5 h-3.5 text-amber-400" /> {t.reviews.chip}
            </span>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="d2 mt-5">
              {t.reviews.t1} <span className="grad-main">{t.reviews.t2}</span>
            </h2>
          </Reveal>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {t.reviews.items.map((r, i) => (
            <Reveal key={r.name} delay={i * 75}>
              <Spot className="glass p-6 h-full flex flex-col" accent="rgba(47,230,167,0.11)">
                <div className="relative z-10 flex items-center gap-1 mb-3">
                  {[0, 1, 2, 3, 4].map((j) => (
                    <Star key={j} className="w-3.5 h-3.5 text-amber-400" />
                  ))}
                </div>
                <p className="relative z-10 text-[13px] leading-relaxed flex-1" style={{ color: "var(--ink-2)" }}>
                  «{r.text}»
                </p>
                <div className="relative z-10 mt-5 flex items-center gap-3">
                  <span
                    className="flex items-center justify-center w-9 h-9 rounded-full ff-d text-xs font-bold text-white"
                    style={{ background: "linear-gradient(135deg,#7c5cff,#4f8cff)" }}
                  >
                    {r.name.charAt(0)}
                  </span>
                  <div>
                    <div className="text-[13px] font-semibold text-white">{r.name}</div>
                    <div className="text-[11px]" style={{ color: "var(--ink-3)" }}>
                      {r.role}
                    </div>
                  </div>
                </div>
              </Spot>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════ TRACK ORDER ═══════════════ */
function TrackOrder() {
  const { t } = useI18n();
  const [secret, setSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<Record<string, unknown> | null>(null);

  const check = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(secret)) {
      setErr(t.track.badCode);
      return;
    }
    setLoading(true);
    setErr(null);
    setRes(null);
    try {
      const r = await fetch(`/api/order/check?secret=${encodeURIComponent(secret)}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "NOT_FOUND");
      setRes(d);
    } catch {
      setErr(t.track.notFound);
    } finally {
      setLoading(false);
    }
  };

  const status = res?.status as string | undefined;
  const statusColor: Record<string, string> = {
    awaiting_payment: "#fbbf24",
    confirming: "#9be7ff",
    delivered: "#2fe6a7",
    cancelled: "#fb7185",
  };

  return (
    <section id="track" className="py-20 sm:py-28">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <Reveal>
            <span className="chip">
              <Search className="w-3.5 h-3.5" style={{ color: "var(--ice)" }} /> {t.track.chip}
            </span>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="d2 mt-5">
              {t.track.t1}
              <br />
              <span className="grad-main">{t.track.t2}</span>
            </h2>
          </Reveal>
          <Reveal delay={140}>
            <p className="mt-4 text-sm" style={{ color: "var(--ink-3)" }}>
              {t.track.sub}
            </p>
          </Reveal>
        </div>

        <Reveal delay={170}>
          <Spot className="glass p-6 sm:p-8" accent="rgba(155,231,255,0.11)">
            <form onSubmit={check} className="relative z-10 flex flex-col sm:flex-row gap-3">
              <input
                value={secret}
                onChange={(e) => setSecret(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder={t.track.placeholder}
                inputMode="numeric"
                className="ff-d flex-1 px-5 py-4 rounded-xl text-lg sm:text-xl tracking-[0.35em] text-center outline-none focus:border-white/25 transition-colors"
                style={{ background: "rgba(255,255,255,.04)", border: "1px solid var(--line)", color: "var(--ink)" }}
              />
              <button type="submit" disabled={loading} className="btn btn-primary !py-4 px-8 text-sm disabled:opacity-60">
                {loading ? t.track.checking : t.track.button}
              </button>
            </form>

            {err && (
              <div
                className="relative z-10 mt-4 text-sm px-4 py-3 rounded-xl"
                style={{ background: "rgba(244,63,94,.08)", border: "1px solid rgba(244,63,94,.2)", color: "#fb7185" }}
              >
                {err}
              </div>
            )}

            {res && (
              <div className="relative z-10 mt-5 grid sm:grid-cols-2 gap-3">
                <Info label={t.track.order} value={`№ ${res.orderNo}`} />
                <Info
                  label={t.track.status}
                  value={t.status[status as keyof typeof t.status] ?? (status ?? "")}
                  color={statusColor[status ?? ""] ?? "#a78bfa"}
                />
                <Info
                  label={t.track.product}
                  value={
                    t.products[(res.productSlug as string) as keyof typeof t.products]?.name ??
                    (res.productSlug as string)
                  }
                />
                <Info
                  label={t.track.amount}
                  value={`${fmtRub(res.totalCents as number)} · ${res.assetLabel} ${res.amountCrypto}`}
                />
                {res.credentials ? (
                  <div className="sm:col-span-2">
                    <div className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "var(--ink-3)" }}>
                      {t.track.credentials}
                    </div>
                    <pre
                      className="m-0 p-3.5 rounded-xl text-[11px] leading-relaxed whitespace-pre-wrap font-mono overflow-x-auto"
                      style={{ background: "rgba(0,0,0,.35)", color: "#d1fae5", border: "1px solid var(--line)" }}
                    >
                      {res.credentials as string}
                    </pre>
                  </div>
                ) : res.txHash ? (
                  <Info label={t.track.tx} value={String(res.txHash)} mono />
                ) : null}
              </div>
            )}
          </Spot>
        </Reveal>
      </div>
    </section>
  );
}

function Info({ label, value, color, mono }: { label: string; value: string; color?: string; mono?: boolean }) {
  return (
    <div className="px-4 py-3 rounded-xl" style={{ background: "rgba(255,255,255,.03)", border: "1px solid var(--line)" }}>
      <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "var(--ink-3)" }}>
        {label}
      </div>
      <div
        className={`${mono ? "font-mono text-[11px] break-all" : "ff-d"} text-sm font-bold`}
        style={{ color: color ?? "#fff", fontWeight: 700 }}
      >
        {value}
      </div>
    </div>
  );
}

/* ═══════════════ FAQ ═══════════════ */
function Faq() {
  const { t } = useI18n();
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="py-20 sm:py-28">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <Reveal>
            <span className="chip">
              <Sparkle className="w-3 h-3" style={{ color: "var(--pink)" }} /> {t.faq.chip}
            </span>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="d2 mt-5">
              {t.faq.t1} <span className="grad-main">{t.faq.t2}</span>
            </h2>
          </Reveal>
        </div>
        <Reveal delay={140}>
          <div className="space-y-3">
            {t.faq.items.map((f, i) => {
              const isOpen = open === i;
              return (
                <div key={f.q} className="glass overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between gap-5 px-5 sm:px-6 py-5 text-left"
                    onClick={() => setOpen(isOpen ? -1 : i)}
                    aria-expanded={isOpen}
                  >
                    <span className="text-[13px] sm:text-[15px] font-semibold text-white/95">{f.q}</span>
                    <span
                      className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full border transition-transform duration-500"
                      style={{
                        borderColor: isOpen ? "rgba(124,92,255,.5)" : "var(--line-2)",
                        background: isOpen ? "rgba(124,92,255,.15)" : "transparent",
                        transform: isOpen ? "rotate(180deg)" : "none",
                      }}
                    >
                      <ChevronDown className="w-4 h-4" style={{ color: isOpen ? "#a78bfa" : "var(--ink-3)" }} />
                    </span>
                  </button>
                  <div className={`faq-panel ${isOpen ? "open" : ""}`}>
                    <div>
                      <p className="px-5 sm:px-6 pb-5 text-[13px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
                        {f.a}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ═══════════════ CTA + FOOTER ═══════════════ */
function Cta() {
  const { t } = useI18n();
  return (
    <section className="relative py-20 sm:py-28 overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[680px] h-[440px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(ellipse, rgba(124,92,255,.17), transparent 65%)", filter: "blur(50px)" }}
      />
      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <Reveal>
          <h2 className="d2">
            {t.cta.t1}
            <br />
            <span className="grad-main">{t.cta.t2}</span>
          </h2>
        </Reveal>
        <Reveal delay={110}>
          <p className="mt-5 text-sm sm:text-base max-w-lg mx-auto" style={{ color: "var(--ink-2)" }}>
            {t.cta.sub}
          </p>
        </Reveal>
        <Reveal delay={200}>
          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <a href="#catalog" className="btn btn-primary text-sm sm:text-base !px-8 !py-4">
              {t.cta.b1}
              <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href={TELEGRAM_URL}
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost text-sm sm:text-base !px-7 !py-4"
            >
              <Telegram className="w-4 h-4 text-sky-300" />
              {t.cta.b2}
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function StickyBuy({ product, onBuy }: { product?: ProductRow; onBuy: (p: ProductRow) => void }) {
  const { t } = useI18n();
  if (!product) return null;
  const name = t.products[product.slug as keyof typeof t.products]?.name ?? product.slug;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t p-3 md:hidden" style={{ background: "rgba(12,12,15,.94)", borderColor: "var(--line)", backdropFilter: "blur(16px)" }}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-white">{name}</div>
          <div className="ff-d text-sm text-white/80">{fmtRub(product.priceCents)}</div>
        </div>
        <button onClick={() => onBuy(product)} className="btn btn-primary !py-3 !px-5 text-sm shrink-0">
          {t.catalog.buy}
        </button>
      </div>
    </div>
  );
}

function Footer() {
  const { t } = useI18n();
  const nav = [
    { href: "#catalog", label: t.nav.catalog },
    { href: "#compare", label: t.nav.compare },
    { href: "#how", label: t.nav.how },
    { href: "#why", label: t.nav.why },
    { href: "#track", label: t.track.chip },
    { href: "#top", label: t.footer.top },
  ];
  return (
    <footer className="relative pt-14 pb-8 overflow-hidden border-t" style={{ borderColor: "var(--line)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-[1.3fr_0.8fr_0.9fr] gap-9 pb-12">
          <div>
            <a href="#top" className="flex items-center gap-2.5">
              <span
                className="flex items-center justify-center w-10 h-10 rounded-2xl"
                style={{ background: "#17171c", border: "1px solid var(--line-2)" }}
              >
                <Sparkle className="w-5 h-5 text-white" />
              </span>
              <span className="ff-d text-base text-white" style={{ fontWeight: 800 }}>
                LIVKA<span className="grad-main">MARKET</span>
              </span>
            </a>
            <p className="mt-4 max-w-xs text-[13px] leading-relaxed" style={{ color: "var(--ink-3)" }}>
              {t.footer.about}
            </p>
            <div className="mt-4 flex items-center gap-3">
              {LOCALES.map((l) => (
                <span key={l.code} className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--ink-3)" }}>
                  <Globe className="w-3 h-3" /> {l.label}
                </span>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] mb-4" style={{ color: "var(--ink-3)" }}>
              {t.footer.nav}
            </div>
            <ul className="space-y-2.5 text-[13px]">
              {nav.map((l) => (
                <li key={l.href}>
                  <a href={l.href} className="transition-colors hover:text-white" style={{ color: "var(--ink-2)" }}>
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] mb-4" style={{ color: "var(--ink-3)" }}>
              {t.footer.contact}
            </div>
            <a
              href={TELEGRAM_URL}
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost !py-3 !px-5 text-[13px] w-full sm:w-auto"
            >
              <Telegram className="w-4 h-4 text-sky-300" /> @livkamarket
            </a>
            <div className="mt-4 flex items-center gap-2 text-[11px]" style={{ color: "var(--ink-3)" }}>
              <span className="relative flex w-2 h-2">
                <span className="pulse-dot absolute w-2 h-2 rounded-full bg-emerald-400" />
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              </span>
              {t.footer.online}
            </div>
          </div>
        </div>

        <div className="relative select-none py-5 overflow-hidden" aria-hidden="true">
          <div className="bigword text-center w-full">LIVKAMARKET</div>
          <div
            className="absolute inset-x-0 bottom-0 h-1/2"
            style={{ background: "linear-gradient(180deg, transparent, var(--bg))" }}
          />
        </div>

        <div
          className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6 border-t text-[11px]"
          style={{ borderColor: "var(--line)", color: "var(--ink-3)" }}
        >
          <span className="max-w-xl text-center sm:text-left leading-relaxed">
            {t.footer.rights} LIVKAMARKET не аффилирован с OpenAI, Google и xAI.
          </span>
          <span className="flex items-center gap-1.5">
            {t.footer.made} <Sparkle className="w-3 h-3" style={{ color: "var(--violet)" }} />
          </span>
        </div>
      </div>
    </footer>
  );
}

/* ═══════════════ LIVE TICKER ═══════════════ */
function LiveTicker({ products }: { products: ProductRow[] }) {
  const { t } = useI18n();
  const [i, setI] = useState(0);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const first = setTimeout(() => setShow(true), 2600);
    const loop = setInterval(() => {
      setShow(false);
      setTimeout(() => {
        setI((v) => v + 1);
        setShow(true);
      }, 500);
    }, 6200);
    return () => {
      clearTimeout(first);
      clearInterval(loop);
    };
  }, []);

  const p = products.length ? products[i % products.length] : null;
  if (!p) return null;
  const Icon = ICONS[p.icon as keyof typeof ICONS];

  return (
    <div
      className="fixed left-3 sm:left-5 bottom-3 sm:bottom-5 z-40 transition-all duration-500 pointer-events-none"
      style={{ opacity: show ? 1 : 0, transform: show ? "translateY(0)" : "translateY(14px)" }}
    >
      <div className="glass px-3.5 py-2.5 flex items-center gap-3" style={{ borderRadius: 18 }}>
        <span
          className="flex items-center justify-center w-8 h-8 rounded-xl shrink-0"
          style={{ background: hexA(p.accent, 0.14), color: p.accent }}
        >
          <Icon className="w-4 h-4" />
        </span>
        <div>
          <div className="text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-3)" }}>
            {t.ticker.title}
          </div>
          <div className="text-[12px] font-semibold text-white">
            {t.products[p.slug as keyof typeof t.products]?.name} · {fmtRub(p.priceCents)}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════ SITE ═══════════════ */
export default function Site({
  products,
  stats,
  initialUser,
}: {
  products: ProductRow[];
  stats: { totalSold: number; totalOrders: number };
  initialUser: SessionUser | null;
}) {
  const { t } = useI18n();
  const [user, setUser] = useState<SessionUser | null>(initialUser);
  const [authOpen, setAuthOpen] = useState(false);
  const [authReason, setAuthReason] = useState<string | null>(null);
  const [pending, setPending] = useState<ProductRow | null>(null);
  const [checkout, setCheckout] = useState<ProductRow | null>(null);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [trackOpen, setTrackOpen] = useState(false);

  const openAuth = (reason?: string) => {
    setAuthReason(reason ?? null);
    setAuthOpen(true);
  };

  const handleBuy = (p: ProductRow) => {
    if (!user) {
      setPending(p);
      openAuth(t.auth.needLogin);
      return;
    }
    setCheckout(p);
  };

  const onAuthSuccess = (u: SessionUser) => {
    setUser(u);
    setAuthOpen(false);
    if (pending) {
      setCheckout(pending);
      setPending(null);
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  };

  return (
    <main>
      <ScrollProgress />
      <PageGlow />
      <Navbar
        user={user}
        onLogin={() => openAuth()}
        onOrders={() => setOrdersOpen(true)}
        onProfile={() => setProfileOpen(true)}
        onLogout={logout}
        onTrack={() => {
          document.getElementById("track-modal")?.setAttribute("data-open", "1");
          setTrackOpen(true);
        }}
      />
      <Hero products={products} />
      <Catalog products={products} onBuy={handleBuy} />
      <How />
      <Faq />
      <Cta />
      <Footer />
      <StickyBuy product={products[0]} onBuy={handleBuy} />

      <AuthModal
        open={authOpen}
        reason={authReason}
        onClose={() => {
          setAuthOpen(false);
          setPending(null);
        }}
        onSuccess={onAuthSuccess}
      />
      <CheckoutModal
        product={checkout}
        onClose={() => setCheckout(null)}
        onOpenOrders={() => setOrdersOpen(true)}
      />
      <ProfileModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        user={user ?? { id: "", email: "", name: "" }}
        onOrders={() => {
          setProfileOpen(false);
          setOrdersOpen(true);
        }}
        onLogout={async () => {
          setProfileOpen(false);
          await logout();
        }}
        onUserUpdate={(u) => setUser(u)}
      />
      <MyOrdersModal
        open={ordersOpen}
        onClose={() => setOrdersOpen(false)}
        onOpenCatalog={() => {
          setOrdersOpen(false);
          document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth" });
        }}
      />
      {trackOpen && (
        <div className="fixed inset-0 z-[104] overflow-y-auto" style={{ background: "rgba(5,5,8,.78)" }} onClick={() => setTrackOpen(false)}>
          <div className="mx-auto max-w-3xl px-4 py-16" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex justify-end">
              <button onClick={() => setTrackOpen(false)} className="btn btn-ghost !py-2 !px-3 text-sm">
                <XIcon className="h-4 w-4" />
              </button>
            </div>
            <TrackOrder />
          </div>
        </div>
      )}
    </main>
  );
}

