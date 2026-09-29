"use client";

import { useState } from "react";
import { ArrowRight, Eye, EyeOff, Layers, LoaderCircle, PackageCheck, PackageX, ShieldCheck, Tag, TriangleAlert } from "lucide-react";
import type { AdminProduct, AdminTokenModel } from "@/lib/admin";
import { ProductTile } from "@/components/livka/product-art";
import { WalletModal } from "@/components/livka/wallet-primitives";
import { useA } from "@/components/livka/i18n-context";
import { money, parseMoney, WALLET_RULES } from "@/lib/wallet-shared";
import { TOKEN_PRICE_PER_MILLION_CENTS } from "@/lib/tokens-shared";

type Mode = "price" | "visibility";
type Filter = "all" | "active" | "hidden";

const MAX_PRICE_CENTS = WALLET_RULES.maxBalanceCents;

export function ProductsPanel({ products, tokenModels, onChanged }: { products: AdminProduct[]; tokenModels: AdminTokenModel[]; onChanged: (message: string) => Promise<void> }) {
  const { a, t } = useA();
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<{ product: AdminProduct; mode: Mode } | null>(null);
  const active = products.filter((p) => p.active).length;
  const hidden = products.length - active;
  const list = products.filter((p) => filter === "all" || (filter === "active" ? p.active : !p.active));
  const tabs: [Filter, string, number][] = [["all", a.fAll, products.length], ["active", a.fActive, active], ["hidden", a.fHidden, hidden]];
  const name = (p: AdminProduct) => t.products[p.slug as keyof typeof t.products]?.name ?? p.title;

  return <>
    <section className="ad-stats ad-stats-3">
      <article><span className="mint"><PackageCheck /></span><div><small>{a.onSale}</small><b>{active}</b><p>{a.visibleNote}</p></div></article>
      <article><span className="rose"><PackageX /></span><div><small>{a.hiddenLbl}</small><b>{hidden}</b><p>{a.hiddenNote}</p></div></article>
      <article><span className="violet"><Layers /></span><div><small>{a.totalProducts}</small><b>{products.length}</b><p>{a.catalogNote}</p></div></article>
    </section>
    <section className="ad-card ad-products">
      <div className="ad-card-head">
        <div><span>{a.catalogEyebrow}</span><h2>{a.productsTitle} <i>{list.length}</i></h2></div>
        <div className="ad-segment" role="tablist" aria-label={a.filterAria}>
          {tabs.map(([id, label, count]) => <button key={id} role="tab" aria-selected={filter === id} className={filter === id ? "active" : ""} onClick={() => setFilter(id)}>{label}<i>{count}</i></button>)}
        </div>
      </div>
      {list.length ? <div className="ad-product-grid">{list.map((p) => <article key={p.id} className={`ad-product ${p.active ? "" : "is-hidden"}`}>
        <div className="ad-product-top">
          <ProductTile product={p} size={50} />
          <div className="ad-product-name"><b>{name(p)}</b><code>{p.slug}</code></div>
          <span className={`ad-status ${p.active ? "active" : "hidden"}`}>{p.active ? a.onSale : a.hiddenOne}</span>
        </div>
        <div className="ad-product-price">
          {p.kind === "tokens"
            ? <div><small>{a.tokenPricing}</small><b className="ad-token-rate">{a.tokenRateLine(money(TOKEN_PRICE_PER_MILLION_CENTS, true))}</b><span>{a.tokenPriceLocked}</span></div>
            : <div><small>{a.priceLbl}</small><b>{money(p.priceCents)}</b><span>{a.per[p.per] ?? p.per}</span></div>}
          <div className="ad-product-meta"><span>{a.kind[p.kind] ?? p.kind}</span>{p.kind === "tokens" ? <span>{tokenModels.map((m) => `${m.label}${m.isActive ? "" : ` (${a.tokenModelOff})`}`).join(" · ") || "—"}</span> : <span><b>{p.stock}</b> {a.stockWord}</span>}</div>
        </div>
        <div className="ad-product-actions">
          {p.kind !== "tokens" && <button onClick={() => setEditing({ product: p, mode: "price" })}><Tag size={15} />{a.changePrice}</button>}
          <button className={p.active ? "danger" : "success"} onClick={() => setEditing({ product: p, mode: "visibility" })}>{p.active ? <><EyeOff size={15} />{a.removeFromSale}</> : <><Eye size={15} />{a.enableSale}</>}</button>
        </div>
      </article>)}</div> : <div className="ad-empty"><PackageX size={28} /><b>{a.emptyProducts}</b><p>{a.emptyProductsHint}</p></div>}
    </section>
    {editing && <ProductModal product={editing.product} mode={editing.mode} onClose={() => setEditing(null)} onDone={async (text) => { setEditing(null); await onChanged(text); }} />}
  </>;
}

function ProductModal({ product, mode, onClose, onDone }: { product: AdminProduct; mode: Mode; onClose: () => void; onDone: (text: string) => Promise<void> }) {
  const { a, t } = useA();
  const [price, setPrice] = useState(String(product.priceCents / 100));
  const [note, setNote] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enabling = !product.active;
  const cents = parseMoney(price);
  const diff = cents - product.priceCents;
  const percent = product.priceCents ? Math.round((diff / product.priceCents) * 1000) / 10 : 0;
  const priceValid = cents >= 100 && cents <= MAX_PRICE_CENTS && diff !== 0;
  const valid = password.length > 0 && (mode === "visibility" || priceValid);
  const title = t.products[product.slug as keyof typeof t.products]?.name ?? product.title;
  const per = a.per[product.per] ?? product.per;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid || busy) return;
    setBusy(true); setError(null);
    const body = mode === "price"
      ? { action: "set-price", priceCents: cents, expectedPriceCents: product.priceCents, note, adminPassword: password }
      : { action: "set-active", active: enabling, note, adminPassword: password };
    try {
      const response = await fetch(`/api/admin/products/${product.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "SERVER");
      await onDone(mode === "price" ? a.priceUpdated(money(cents)) : enabling ? a.enabledToast : a.disabledToast);
    } catch (e) {
      setError(e instanceof Error ? e.message : "SERVER");
      setBusy(false);
    }
  };

  const heading = mode === "price" ? a.changePrice : enabling ? a.enableSale : a.removeFromSale;
  return <WalletModal title={heading} subtitle={`${title} · ${product.slug}`} onClose={onClose}>
    <form onSubmit={submit}>
      <div className="ad-confirm-user">
        <ProductTile product={product} size={40} />
        <div><b>{title}</b><p>{money(product.priceCents)} · {per}</p></div>
        <span className={`ad-status ${product.active ? "active" : "hidden"}`}>{product.active ? a.onSale : a.hiddenOne}</span>
      </div>
      {mode === "price" ? <>
        <label className="ad-field">{a.newPrice}<div><input autoFocus inputMode="decimal" aria-label={a.newPrice} value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.,]/g, "").slice(0, 10))} /><span>$</span></div></label>
        <div className="ad-price-preview">
          <div>{a.nowWord}<b>{money(product.priceCents)}</b></div>
          <ArrowRight size={16} />
          <div>{a.becomes}<b>{cents ? money(cents) : "—"}</b>{diff !== 0 && cents > 0 && <span className={`chg ${diff > 0 ? "up" : "down"}`}>{diff > 0 ? "+" : ""}{percent}%</span>}</div>
        </div>
        <div className="ad-info"><ShieldCheck size={18} /><span>{a.priceInfo}</span></div>
      </> : enabling
        ? <div className="ad-info"><Eye size={18} /><span>{a.enableInfo(money(product.priceCents))}</span></div>
        : <div className="ad-warning"><TriangleAlert size={18} /><span>{a.disableWarn}</span></div>}
      <label className="ad-field">{a.comment} <em>{a.optional}</em><textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder={mode === "price" ? a.pricePh : a.visPh} /></label>
      <label className="ad-field">{a.adminConfirm}<input className="ad-password-confirm" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder={a.passPh} /></label>
      {error && <div className="ad-error" role="alert">{a.errors[error] ?? a.saveFailed}</div>}
      <div className="ad-modal-actions">
        <button type="button" className="ad-cancel" onClick={onClose}>{a.cancel}</button>
        <button type="submit" className={mode === "visibility" && !enabling ? "ad-submit danger" : "ad-submit"} disabled={!valid || busy}>
          {busy ? <><LoaderCircle className="ad-spin" size={16} />{a.saving}</> : mode === "price" ? <><Tag size={16} />{a.savePrice}</> : enabling ? <><Eye size={16} />{a.enable}</> : <><EyeOff size={16} />{a.removeFromSale}</>}
        </button>
      </div>
    </form>
  </WalletModal>;
}
