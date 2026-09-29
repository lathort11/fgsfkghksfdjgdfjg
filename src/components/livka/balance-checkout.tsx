"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Check, CheckCheck, Copy, Download, Eye, EyeOff, ShieldCheck, Wallet, Tag } from "lucide-react";
import type { ProductRow } from "@/db/schema";
import { useW } from "@/components/livka/i18n-context";
import { ProductTile } from "@/components/livka/product-art";
import { WalletModal, WalletErrorBox, SummaryRow, Busy, walletRequest, errorMessage, useRequestKey } from "@/components/livka/wallet-primitives";
import { money, WALLET_RULES, type WalletSnapshot } from "@/lib/wallet-shared";
import { promoDiscount } from "@/lib/networks";

export type BalanceProduct = Pick<ProductRow, "id" | "slug" | "priceCents" | "per" | "accent" | "icon" | "kind" | "stock">;
type Purchase = { orderNo: number; secret: string; totalCents: number; credentials: string | null; status: string };

export function BalanceCheckout({ product, onClose, onOpenOrders, onTopUp, onPurchased }: { product: BalanceProduct | null; onClose: () => void; onOpenOrders: () => void; onTopUp?: (missingCents: number) => void; onPurchased?: () => void }) {
  const { w, t } = useW();
  const [wallet, setWallet] = useState<WalletSnapshot | null>(null);
  const [promo, setPromo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<Purchase | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const key = useRequestKey();
  useEffect(() => {
    if (!product) return;
    let alive = true;
    setWallet(null); setOrder(null); setPromo(""); setError(null); setRevealed(false); setCopied(false);
    walletRequest<WalletSnapshot>("/api/wallet").then((s) => { if (alive) setWallet(s); }).catch((e) => { if (alive) setError(errorMessage(e)); });
    return () => { alive = false; };
  }, [product]);
  if (!product) return null;
  const copy = t.products[product.slug as keyof typeof t.products];
  const discount = promoDiscount(promo), total = Math.round(product.priceCents * (1 - discount));
  const missing = Math.max(0, total - (wallet?.balanceCents ?? 0));
  const topUpDollars = Math.min(WALLET_RULES.maxDepositCents / 100, Math.max(WALLET_RULES.minDepositCents / 100, Math.ceil(missing / 100)));
  const buy = async () => {
    setBusy(true); setError(null);
    try {
      const input = { productId: product.id, expectedTotalCents: total, promo, confirmed: true };
      const result = await walletRequest<{ order: Purchase }>("/api/order", { ...input, idempotencyKey: key(input) });
      setOrder(result.order); onPurchased?.();
      walletRequest<WalletSnapshot>("/api/wallet").then(setWallet).catch(() => {});
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  const topUp = () => {
    if (onTopUp) onTopUp(missing);
    else window.location.assign(`/?topup=${topUpDollars}`);
  };
  return <WalletModal title={order ? w.coDoneTitle : w.coTitle} subtitle={order ? w.coDoneSub(order.orderNo) : w.coSub} onClose={onClose}>
    <div className="wk-checkout-product"><ProductTile product={product} size={58} /><div><h3>{copy?.name ?? product.slug}</h3><p>{copy?.tagline ?? t.per[product.per as keyof typeof t.per]}</p></div><span className="wk-small-badge">{product.kind === "api" ? "API" : w.subscription}</span></div>
    {order ? <div className="wk-form"><div className="wk-purchased"><CheckCheck size={21} /><div><b>{w.purchased}</b><p>{w.purchasedText}</p></div></div>
      <div className="wk-credentials"><div><span>{w.credentials}</span><button aria-label={revealed ? w.hideAccess : w.showAccess} onClick={() => setRevealed(!revealed)}>{revealed ? <EyeOff size={17} /> : <Eye size={17} />}{revealed ? w.hide : w.show}</button></div><pre>{revealed ? order.credentials : "••••••••••••••••••••••••••\n••••••••••••••••••••••••••"}</pre></div>
      <div className="wk-two-buttons"><button className="wk-button wk-secondary" onClick={async () => { try { await navigator.clipboard.writeText(order.credentials ?? ""); setCopied(true); } catch { setError("COPY_FAILED"); } }}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? w.copied : w.copy}</button><button className="wk-button wk-secondary" onClick={() => { const url = URL.createObjectURL(new Blob([`LIVKAMARKET · ${order.orderNo}\n${order.credentials ?? ""}`], { type: "text/plain;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = `livka-${order.orderNo}.txt`; a.click(); URL.revokeObjectURL(url); }}><Download size={16} />{w.save}</button></div>
      <WalletErrorBox error={error} /><button className="wk-button wk-primary wk-full" onClick={() => { onClose(); onOpenOrders(); }}>{w.myPurchases} <ArrowRight size={17} /></button>
    </div> : <div className="wk-form">
      <label className="wk-label" htmlFor="purchase-promo">{w.havePromo}</label><div className="wk-promo-input"><Tag size={16} /><input id="purchase-promo" value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase())} placeholder={w.promoPh} maxLength={40} disabled={busy} />{discount > 0 && <span>−{Math.round(discount * 100)}%</span>}</div>
      {promo && !discount && <p className="wk-field-hint">{w.promoNotFound}</p>}
      <div className="wk-summary"><SummaryRow label={w.productCost}>{money(product.priceCents)}</SummaryRow>{discount > 0 && <SummaryRow label={w.discountLbl(Math.round(discount * 100))}><span className="wk-green">−{money(product.priceCents - total)}</span></SummaryRow>}<SummaryRow label={w.purchaseFee}>{money(0)}</SummaryRow><SummaryRow label={w.totalDebit} strong>{money(total)}</SummaryRow></div>
      <div className="wk-balance-payment"><span className="wk-mini-icon"><Wallet size={20} /></span><div><b>{w.payFromBalance}</b><p>{wallet ? w.availableAmt(money(wallet.balanceCents)) : w.loadingBalance}</p></div><Check size={17} /></div>
      {wallet && (missing ? <div className="wk-info"><Wallet size={17} /><span>{w.missingA} <b>{money(missing)}</b>. {w.missingB}</span></div> : <p className="wk-caption">{w.remains(money(wallet.balanceCents - total))}</p>)}
      <WalletErrorBox error={error} />
      {wallet && missing > 0 ? <button className="wk-button wk-primary wk-full" onClick={topUp}>{w.topUp} <ArrowRight size={17} /></button> : <button className="wk-button wk-primary wk-full" disabled={busy || !wallet} onClick={buy}>{busy ? <Busy text={w.confirming} /> : <>{w.confirmPurchase(money(total))} <ArrowRight size={16} /></>}</button>}
      <p className="wk-caption"><ShieldCheck size={13} />{w.chargeNote}</p>
    </div>}
  </WalletModal>;
}
