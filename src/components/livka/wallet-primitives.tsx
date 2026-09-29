"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X, AlertCircle, LoaderCircle } from "lucide-react";
import { useW } from "@/components/livka/i18n-context";
import type { Dict } from "@/lib/i18n";
import type { WalletDict } from "@/lib/wallet-i18n";
import type { WalletOperation } from "@/lib/wallet-shared";

/** Errors are kept as machine codes and translated at render time, so switching language updates them too. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "";
}
export async function walletRequest<T>(url: string, body?: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "SERVER_ERROR");
  return data as T;
}
export function useRequestKey() {
  const ref = useRef({ signature: "", key: "" });
  return (payload: Record<string, unknown>) => {
    const signature = JSON.stringify(payload);
    if (ref.current.signature !== signature) ref.current = { signature, key: crypto.randomUUID() };
    return ref.current.key;
  };
}

/** Localised title of a wallet operation (purchases use the translated product name). */
export function opTitle(op: WalletOperation, w: WalletDict, t: Dict): string {
  if (op.kind === "purchase") {
    const name = op.productSlug ? t.products[op.productSlug as keyof typeof t.products]?.name : undefined;
    return name ?? op.description;
  }
  return w.opDesc[op.kind] ?? op.description;
}
export function opMethod(op: WalletOperation, w: WalletDict): string {
  return w.opMethod[op.kind] ?? op.method;
}

export function WalletModal({ title, subtitle, children, onClose, wide = false }: { title: string; subtitle?: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const { w } = useW();
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const root = ref.current;
    root?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close.current();
      if (event.key !== "Tab" || !root) return;
      const elements = [...root.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea, [tabindex="0"]')];
      if (!elements.length) { event.preventDefault(); return; }
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === root)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === root)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.documentElement.style.overflow = overflow; document.removeEventListener("keydown", keydown); previous?.focus(); };
  }, []);
  return <div className="wk-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className={`wk-modal ${wide ? "wk-modal-wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1} ref={ref}>
      <div className="wk-modal-heading"><div><span className="wk-eyebrow">LIVKA WALLET</span><h2 id={id}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="wk-icon-button" aria-label={w.closeWindow} onClick={onClose}><X size={19} /></button></div>
      {children}
    </div>
  </div>;
}
export function WalletErrorBox({ error }: { error: string | null }) {
  const { w } = useW();
  return error ? <div className="wk-error" role="alert"><AlertCircle size={17} /><span>{w.errors[error] ?? w.errorDefault}</span></div> : null;
}
export function Busy({ text }: { text?: string }) {
  const { w } = useW();
  return <><LoaderCircle size={17} className="wk-spin" />{text ?? w.busy}</>;
}
export function SummaryRow({ label, children, strong = false }: { label: string; children: ReactNode; strong?: boolean }) { return <div className={`wk-summary-row ${strong ? "is-total" : ""}`}><span>{label}</span><strong>{children}</strong></div>; }
