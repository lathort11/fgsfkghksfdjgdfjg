"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/livka/i18n-context";
import type { ProductRow } from "@/db/schema";
import { NETWORKS } from "@/lib/networks";
import { DICTS } from "@/lib/i18n";
import { ProductTile } from "@/components/livka/product-art";
import {
  ApiMark, Check, Copy, CryptoBadge, GeminiMark, GrokMark, OpenAiMark,
  Sparkle, XIcon, Zap, ArrowRight,
} from "@/components/livka/icons";

export const ICONS = {
  gemini: GeminiMark,
  api: ApiMark,
  chatgpt: OpenAiMark,
  grok: GrokMark,
} as const;

export const fmtRub = (cents: number) =>
  `${Math.round(cents / 100).toLocaleString("ru-RU")} ₽`;

export function hexA(hex: string, a: number) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

type CreatedOrder = {
  orderNo: number;
  secret: string;
  status: string;
  totalCents: number;
  discount: number;
  networkId: string;
  networkLabel: string;
  assetLabel: string;
  depositAddress: string;
  amountCrypto: string;
  usd: number;
  rateLabel: string;
  fee: string;
  credentials?: string | null;
};

/* ═══════════ CHECKOUT ═══════════ */
export function CheckoutModal({
  product,
  onClose,
  onOpenOrders,
}: {
  product: ProductRow | null;
  onClose: () => void;
  onOpenOrders: () => void;
}) {
  const { t, locale } = useI18n();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [networkId, setNetworkId] = useState("usdt-trc20");
  const [promo, setPromo] = useState("");
  const [order, setOrder] = useState<CreatedOrder | null>(null);
  const [tx, setTx] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [quote, setQuote] = useState<{
    amountCrypto: string;
    rateLabel: string;
    fee: string;
    assetLabel: string;
    lockedUntil: number;
  } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (product) {
      setStep(1);
      setOrder(null);
      setTx("");
      setError(null);
      setPromo("");
      setRevealed(false);
      setQuote(null);
      document.documentElement.style.overflow = "hidden";
    } else {
      document.documentElement.style.overflow = "";
    }
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [product]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      /* noop */
    }
  };

  const dict = DICTS[locale];
  const pdict = product ? dict.products[product.slug as keyof typeof dict.products] : null;
  const accent = product?.accent ?? "#7c5cff";

  const discount = useMemo(() => {
    const p = promo.trim().toUpperCase();
    return p === "LIVKA15" ? 0.15 : p === "GEMINI10" ? 0.1 : p === "NEURAL5" ? 0.05 : 0;
  }, [promo]);

  const totalCents = product ? Math.round(product.priceCents * (1 - discount)) : 0;
  const network = NETWORKS.find((n) => n.id === networkId) ?? NETWORKS[0];

  useEffect(() => {
    if (!product || step !== 1) return;
    const ac = new AbortController();
    const timer = setTimeout(() => {
      fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, networkId, promo }),
        signal: ac.signal,
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.ok) setQuote(d);
        })
        .catch(() => {});
    }, 280);
    return () => {
      clearTimeout(timer);
      ac.abort();
    };
  }, [product, networkId, promo, step]);

  useEffect(() => {
    if (!quote) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [quote]);

  const lockLeft = quote ? Math.max(0, Math.ceil((quote.lockedUntil - now) / 1000)) : 0;
  const lockLabel = `${String(Math.floor(lockLeft / 60)).padStart(2, "0")}:${String(lockLeft % 60).padStart(2, "0")}`;

  if (!product) return null;

  const create = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, networkId, promo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "ERROR");
      setOrder(data.order as CreatedOrder);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ERROR");
    } finally {
      setLoading(false);
    }
  };

  const pay = async () => {
    if (tx.trim().length < 8) {
      setError(t.checkout.txPh);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/order/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: order?.secret, txHash: tx }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "ERROR");
      setOrder((prev) => (prev ? { ...prev, credentials: data.order?.credentials ?? null } : prev));
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ERROR");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[105] flex justify-end"
      style={{ background: "rgba(5,5,8,.72)" }}
      onClick={onClose}
    >
      <div
        className="drawer-panel relative w-full max-w-[440px] overflow-y-auto p-6 sm:p-7"
        style={{ background: "#0c0c0f", borderLeft: "1px solid var(--line)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="close"
          className="absolute top-4 right-4 flex items-center justify-center w-9 h-9 rounded-full transition-colors hover:bg-white/10 z-10"
          style={{ border: "1px solid var(--line)", color: "var(--ink-2)" }}
        >
          <XIcon className="w-4 h-4" />
        </button>

        {/* header */}
        <div className="flex items-center gap-3 mb-5 pr-10">
          <ProductTile product={product} size={56} />
          <div className="min-w-0">
            <div className="ff-d text-base font-bold text-white truncate">{pdict?.name}</div>
            <div className="text-xs truncate" style={{ color: "var(--ink-3)" }}>
              {pdict?.tagline}
            </div>
          </div>
        </div>

        {/* stepper */}
        <div className="flex items-center gap-2 mb-6">
          {([1, 2, 3] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div
                className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider transition-colors"
                style={{ color: step >= s ? accent : "var(--ink-3)" }}
              >
                <span
                  className="flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-black transition-all"
                  style={{
                    background: step > s ? accent : step === s ? hexA(accent, 0.18) : "rgba(255,255,255,.05)",
                    color: step > s ? "#05050b" : step === s ? accent : "var(--ink-3)",
                  }}
                >
                  {step > s ? "✓" : s}
                </span>
                <span className="hidden sm:inline">
                  {s === 1 ? t.checkout.step1 : s === 2 ? t.checkout.step2 : t.checkout.step3}
                </span>
              </div>
              {i < 2 && (
                <span
                  className="flex-1 h-px transition-colors duration-500"
                  style={{ background: step > s ? accent : "var(--line)" }}
                />
              )}
            </div>
          ))}
        </div>

        {/* STEP 1 — network */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] mb-3" style={{ color: "var(--ink-3)" }}>
                {t.checkout.choose}
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {NETWORKS.map((n) => {
                  const active = n.id === networkId;
                  return (
                    <button
                      key={n.id}
                      onClick={() => setNetworkId(n.id)}
                      className="relative flex items-center gap-3 p-3 rounded-2xl text-left transition-all duration-300 netcard"
                      style={{
                        border: `1px solid ${active ? hexA(accent, 0.55) : "var(--line)"}`,
                        background: active ? hexA(accent, 0.09) : "rgba(255,255,255,.025)",
                      }}
                    >
                      <CryptoBadge asset={n.asset} className="w-8 h-8 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-white leading-tight">{n.asset}</div>
                        <div className="text-[10px] truncate" style={{ color: "var(--ink-3)" }}>
                          {n.net}
                        </div>
                      </div>
                      {active && (
                        <span
                          className="absolute top-2 right-2 flex items-center justify-center w-4 h-4 rounded-full"
                          style={{ background: accent, color: "#05050b" }}
                        >
                          <Check className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] mb-2" style={{ color: "var(--ink-3)" }}>
                {t.checkout.promo}
              </label>
              <input
                value={promo}
                onChange={(e) => setPromo(e.target.value.toUpperCase())}
                placeholder={t.checkout.promoPh}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none focus:border-white/25 transition-colors uppercase"
                style={{ background: "rgba(255,255,255,.04)", border: "1px solid var(--line)", color: "var(--ink)" }}
              />
            </div>

            <div
              className="p-4 rounded-2xl space-y-2.5"
              style={{ background: "rgba(255,255,255,.03)", border: "1px solid var(--line)" }}
            >
              <Row label={t.checkout.total} value={fmtRub(product.priceCents)} muted={discount > 0} strike={discount > 0} />
              {discount > 0 && (
                <Row
                  label={`${t.checkout.promo} · −${Math.round(discount * 100)}%`}
                  value={`−${fmtRub(product.priceCents - totalCents)}`}
                  accent={accent}
                />
              )}
              {quote && (
                <div className="flex items-center justify-between text-[12px]">
                  <span style={{ color: "var(--ink-3)" }}>{quote.assetLabel}</span>
                  <span className="font-mono text-white">{quote.amountCrypto}</span>
                </div>
              )}
              <div className="h-px" style={{ background: "var(--line)" }} />
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white">{t.checkout.total}</span>
                <div className="text-right">
                  <div className="ff-d text-2xl font-black" style={{ color: accent, fontWeight: 900 }}>
                    {fmtRub(totalCents)}
                  </div>
                  {quote && (
                    <div className="mt-1 font-mono text-[11px]" style={{ color: "var(--ink-3)" }}>
                      {lockLabel} · {quote.rateLabel}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {error && <ErrorBox text={error} />}

            <button
              onClick={create}
              disabled={loading}
              className="btn w-full !py-3.5 text-sm text-white disabled:opacity-60"
              style={{
                background: `linear-gradient(135deg,${accent},${accent}bb)`,
                boxShadow: `0 14px 34px -14px ${hexA(accent, 0.7)}`,
              }}
            >
              {loading ? "…" : t.checkout.continue}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 2 — pay */}
        {step === 2 && order && (
          <div className="space-y-5">
            <div
              className="px-4 py-3 rounded-2xl text-xs leading-relaxed flex gap-2.5"
              style={{ background: hexA(accent, 0.07), border: `1px solid ${hexA(accent, 0.2)}`, color: "var(--ink-2)" }}
            >
              <Sparkle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: accent }} />
              {t.checkout.payHint}
            </div>

            <div className="grid sm:grid-cols-[132px_1fr] gap-4 items-start">
              {/* QR */}
              <div
                className="p-3 rounded-2xl mx-auto sm:mx-0"
                style={{ background: "rgba(255,255,255,.06)", border: "1px solid var(--line)" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/qr?text=${encodeURIComponent(order.depositAddress)}`}
                  alt="QR"
                  width={112}
                  height={112}
                  className="w-[112px] h-[112px] block"
                />
                <div className="text-[9px] text-center mt-2" style={{ color: "var(--ink-3)" }}>
                  {t.checkout.qrHint}
                </div>
              </div>

              <div className="space-y-2.5 min-w-0">
                <CopyBox
                  label={`${order.assetLabel} · ${order.networkLabel}`}
                  value={order.amountCrypto}
                  onCopy={() => copy(order.amountCrypto, "amount")}
                  copied={copied === "amount"}
                  big
                  accent={accent}
                />
                <CopyBox
                  label={t.checkout.address}
                  value={order.depositAddress}
                  onCopy={() => copy(order.depositAddress, "addr")}
                  copied={copied === "addr"}
                  mono
                />
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px]" style={{ color: "var(--ink-3)" }}>
                  <span>{order.rateLabel}</span>
                  <span>{t.checkout.fee}: {order.fee}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] mb-2" style={{ color: "var(--ink-3)" }}>
                {t.checkout.txLabel}
              </label>
              <input
                value={tx}
                onChange={(e) => setTx(e.target.value)}
                placeholder={t.checkout.txPh}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none focus:border-white/25 transition-colors font-mono"
                style={{ background: "rgba(255,255,255,.04)", border: "1px solid var(--line)", color: "var(--ink)" }}
              />
            </div>

            {error && <ErrorBox text={error} />}

            <div className="flex gap-2.5">
              <button onClick={() => setStep(1)} className="btn btn-ghost !py-3.5 text-sm flex-1">
                {t.checkout.back}
              </button>
              <button
                onClick={pay}
                disabled={loading}
                className="btn !py-3.5 text-sm text-white flex-[1.6] disabled:opacity-60"
                style={{ background: accent }}
              >
                {loading ? t.checkout.processing : t.checkout.iPaid}
                {!loading && <Zap className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {step === 3 && order && (
          <div className="space-y-5">
            <div className="text-center">
              <div
                className="mx-auto flex items-center justify-center w-14 h-14 rounded-2xl success-pop"
                style={{ background: "rgba(16,185,129,.14)", color: "#10b981" }}
              >
                <Check className="w-7 h-7" />
              </div>
              <h3 className="ff-d mt-4 text-xl font-black text-white">{t.status.delivered}</h3>
              <p className="mt-1 text-xs" style={{ color: "var(--ink-3)" }}>
                {t.checkout.orderNo} № {order.orderNo}
              </p>
            </div>

            <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,.03)", border: "1px solid var(--line)" }}>
              <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--ink-3)" }}>
                {t.track.order}
              </div>
              <div className="mt-1 flex items-center justify-between gap-3">
                <span className="ff-d text-3xl tracking-[0.28em] text-white">{order.secret}</span>
                <button onClick={() => copy(order.secret, "secret")} className="btn btn-ghost !py-2 !px-3 text-xs">
                  <Copy className="w-3.5 h-3.5" />
                  {copied === "secret" ? t.checkout.copied : t.checkout.copy}
                </button>
              </div>
              <p className="mt-2 text-[12px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
                {t.checkout.saveCreds}
              </p>
            </div>

            <div className="rounded-2xl p-4" style={{ background: "rgba(0,0,0,.35)", border: `1px solid ${hexA(accent, 0.28)}` }}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--ink-3)" }}>
                  {t.checkout.credentials}
                </span>
                <button
                  onClick={() => setRevealed((v) => !v)}
                  className="text-[11px] font-semibold"
                  style={{ color: accent }}
                >
                  {revealed ? (locale === "en" ? "Hide" : locale === "zh" ? "隐藏" : "Скрыть") : locale === "en" ? "Show" : locale === "zh" ? "显示" : "Показать"}
                </button>
              </div>
              <pre
                className="m-0 whitespace-pre-wrap font-mono text-[12px] leading-relaxed"
                style={{ color: revealed ? "#d7efe4" : "transparent", textShadow: revealed ? "none" : "0 0 8px rgba(215,239,228,.9)" }}
              >
                {order.credentials ?? "—"}
              </pre>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <button onClick={() => copy(order.credentials ?? "", "creds")} className="btn btn-ghost !py-3 text-sm flex-1">
                <Copy className="w-4 h-4" />
                {copied === "creds" ? t.checkout.copied : t.checkout.copy}
              </button>
              <button
                onClick={() => {
                  const blob = new Blob(
                    [JSON.stringify({ orderNo: order.orderNo, secret: order.secret, credentials: order.credentials }, null, 2)],
                    { type: "application/json" }
                  );
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `livka-${order.orderNo}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="btn btn-ghost !py-3 text-sm flex-1"
              >
                JSON
              </button>
              <button
                onClick={() => {
                  onClose();
                  onOpenOrders();
                }}
                className="btn btn-primary !py-3 text-sm flex-1"
              >
                {t.auth.myOrders}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, muted, strike, accent }: { label: string; value: string; muted?: boolean; strike?: boolean; accent?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span style={{ color: "var(--ink-3)" }}>{label}</span>
      <span className={strike ? "line-through" : ""} style={{ color: accent ?? (muted ? "var(--ink-3)" : "#fff") }}>
        {value}
      </span>
    </div>
  );
}

function ErrorBox({ text }: { text: string }) {
  return (
    <div className="text-sm px-4 py-3 rounded-xl" style={{ background: "rgba(244,63,94,.08)", border: "1px solid rgba(244,63,94,.22)", color: "#fb7185" }}>
      {text}
    </div>
  );
}

function CopyBox({
  label, value, onCopy, copied, big, accent, mono,
}: {
  label: string; value: string; onCopy: () => void; copied: boolean; big?: boolean; accent?: string; mono?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onCopy}
      className="w-full text-left px-3.5 py-3 rounded-xl"
      style={{ background: "rgba(255,255,255,.04)", border: "1px solid var(--line)" }}
    >
      <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--ink-3)" }}>{label}</div>
      <div className={`mt-1 flex items-center justify-between gap-2 ${mono ? "font-mono text-[11px] break-all" : ""}`}>
        <span className={big ? "ff-d text-xl font-black" : "text-sm font-semibold"} style={{ color: accent ?? "#fff" }}>{value}</span>
        <Copy className="w-3.5 h-3.5 shrink-0" style={{ color: copied ? "#10b981" : "var(--ink-3)" }} />
      </div>
    </button>
  );
}

type MineOrder = {
  orderNo: number;
  secret: string;
  status: string;
  totalCents: number;
  assetLabel: string;
  networkLabel: string;
  amountCrypto: string;
  productSlug: string;
  credentials: string | null;
  createdAt: string;
};

export function MyOrdersModal({
  open, onClose, onOpenCatalog,
}: {
  open: boolean;
  onClose: () => void;
  onOpenCatalog: () => void;
}) {
  const { t } = useI18n();
  const [rows, setRows] = useState<MineOrder[] | null>(null);
  const [show, setShow] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    document.documentElement.style.overflow = "hidden";
    fetch("/api/order/mine")
      .then((r) => (r.ok ? r.json() : { orders: [] }))
      .then((d) => setRows(d.orders ?? []))
      .catch(() => setRows([]));
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[106] flex justify-end" style={{ background: "rgba(5,5,8,.72)" }} onClick={onClose}>
      <div className="drawer-panel w-full max-w-md overflow-y-auto p-6" style={{ background: "#0d0d10" }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h3 className="ff-d text-lg text-white">{t.checkout.myOrdersTitle}</h3>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full" style={{ border: "1px solid var(--line)" }}>
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        {rows === null ? (
          <p className="text-sm" style={{ color: "var(--ink-3)" }}>…</p>
        ) : rows.length === 0 ? (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: "var(--ink-2)" }}>{t.checkout.emptyOrders}</p>
            <button onClick={onOpenCatalog} className="btn btn-primary text-sm">{t.catalog.buy}</button>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <div key={r.secret} className="rounded-2xl p-4" style={{ border: "1px solid var(--line)" }}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-white">№ {r.orderNo}</span>
                  <span className="text-[11px]" style={{ color: "var(--ink-3)" }}>{t.status[r.status as keyof typeof t.status] ?? r.status}</span>
                </div>
                <div className="mt-1 text-[12px]" style={{ color: "var(--ink-2)" }}>
                  {t.products[r.productSlug as keyof typeof t.products]?.name ?? r.productSlug} · {fmtRub(r.totalCents)}
                </div>
                <div className="mt-2 font-mono text-[12px] tracking-[0.2em] text-white">{r.secret}</div>
                {r.credentials && (
                  <button onClick={() => setShow(show === r.secret ? null : r.secret)} className="mt-2 text-[12px]" style={{ color: "#c9c2ff" }}>
                    {t.checkout.credentials}
                  </button>
                )}
                {show === r.secret && r.credentials && (
                  <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px]" style={{ color: "#d7efe4" }}>{r.credentials}</pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
