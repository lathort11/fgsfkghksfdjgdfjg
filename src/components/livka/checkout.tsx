"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/livka/i18n-context";
import { ApiMark, GeminiMark, GrokMark, OpenAiMark, XIcon } from "@/components/livka/icons";
export { BalanceCheckout as CheckoutModal } from "@/components/livka/balance-checkout";
export const ICONS = { gemini: GeminiMark, api: ApiMark, chatgpt: OpenAiMark, grok: GrokMark } as const;
export const fmtUsd = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: Number.isInteger(cents / 100) ? 0 : 2, maximumFractionDigits: 2 }).format(cents / 100);
export function hexA(hex: string, a: number) {
  const h = hex.replace("#", "");
  return `rgba(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}, ${a})`;
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
    <div className="modal-backdrop fixed inset-0 z-[106] flex justify-end" style={{ background: "rgba(5,5,8,.72)" }} onClick={onClose}>
      <div className="drawer-surface drawer-panel w-full max-w-md overflow-y-auto p-6" style={{ background: "#0d0d10" }} onClick={(e) => e.stopPropagation()}>
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
                  {t.products[r.productSlug as keyof typeof t.products]?.name ?? r.productSlug} · {fmtUsd(r.totalCents)}
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
