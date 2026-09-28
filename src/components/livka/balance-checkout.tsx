"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Check, CheckCheck, Copy, Download, Eye, EyeOff, ShieldCheck, Wallet, Tag } from "lucide-react";
import type { ProductRow } from "@/db/schema";
import { useI18n } from "@/components/livka/i18n-context";
import { ProductTile } from "@/components/livka/product-art";
import { WalletModal, WalletErrorBox, DemoNotice, SummaryRow, Busy, walletRequest, errorMessage, useRequestKey } from "@/components/livka/wallet-primitives";
import { money, type WalletSnapshot } from "@/lib/wallet-shared";
import { promoDiscount } from "@/lib/networks";

export type BalanceProduct = Pick<ProductRow, "id" | "slug" | "priceCents" | "per" | "accent" | "icon" | "kind" | "stock">;
type Purchase = { orderNo: number; secret: string; totalCents: number; credentials: string | null; status: string };

export function BalanceCheckout({ product, onClose, onOpenOrders, onTopUp, onPurchased }: { product: BalanceProduct | null; onClose: () => void; onOpenOrders: () => void; onTopUp?: (missingCents: number) => void; onPurchased?: () => void }) {
  const { t } = useI18n();
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
    walletRequest<WalletSnapshot>("/api/wallet").then((w) => { if (alive) setWallet(w); }).catch((e) => { if (alive) setError(errorMessage(e)); });
    return () => { alive = false; };
  }, [product]);
  if (!product) return null;
  const copy = t.products[product.slug as keyof typeof t.products];
  const discount = promoDiscount(promo), total = Math.round(product.priceCents * (1 - discount));
  const missing = Math.max(0, total - (wallet?.balanceCents ?? 0));
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
    else window.location.assign(`/?topup=${Math.max(100, Math.ceil(missing / 100))}`);
  };
  return <WalletModal title={order ? "Доступ уже у вас" : "Подтвердите покупку"} subtitle={order ? `Заказ № ${order.orderNo} · успешно оплачен с баланса` : "Проверьте детали. Больше никаких переводов."} onClose={onClose}>
    {wallet?.mode === "demo" && <DemoNotice />}
    <div className="wk-checkout-product"><ProductTile product={product} size={58} /><div><h3>{copy?.name ?? product.slug}</h3><p>{copy?.tagline ?? t.per[product.per as keyof typeof t.per]}</p></div><span className="wk-small-badge">{product.kind === "api" ? "API" : "ПОДПИСКА"}</span></div>
    {order ? <div className="wk-form"><div className="wk-purchased"><CheckCheck size={21} /><div><b>Покупка подтверждена</b><p>Доступ сохранён в разделе «Мои покупки».</p></div></div>
      <div className="wk-credentials"><div><span>ДАННЫЕ ДОСТУПА</span><button aria-label={revealed ? "Скрыть доступ" : "Показать доступ"} onClick={() => setRevealed(!revealed)}>{revealed ? <EyeOff size={17} /> : <Eye size={17} />}{revealed ? "Скрыть" : "Показать"}</button></div><pre>{revealed ? order.credentials : "••••••••••••••••••••••••••\n••••••••••••••••••••••••••"}</pre></div>
      <div className="wk-two-buttons"><button className="wk-button wk-secondary" onClick={async () => { try { await navigator.clipboard.writeText(order.credentials ?? ""); setCopied(true); } catch { setError("Не удалось скопировать. Откройте доступ и выделите текст."); } }}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "Скопировано" : "Копировать"}</button><button className="wk-button wk-secondary" onClick={() => { const url = URL.createObjectURL(new Blob([`LIVKAMARKET · ${order.orderNo}\n${order.credentials ?? ""}`], { type: "text/plain;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = `livka-${order.orderNo}.txt`; a.click(); URL.revokeObjectURL(url); }}><Download size={16} />Сохранить</button></div>
      <WalletErrorBox error={error} /><button className="wk-button wk-primary wk-full" onClick={() => { onClose(); onOpenOrders(); }}>Мои покупки <ArrowRight size={17} /></button>
    </div> : <div className="wk-form">
      <label className="wk-label" htmlFor="purchase-promo">Есть промокод?</label><div className="wk-promo-input"><Tag size={16} /><input id="purchase-promo" value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase())} placeholder="Введите промокод" maxLength={40} disabled={busy} />{discount > 0 && <span>−{Math.round(discount * 100)}%</span>}</div>
      {promo && !discount && <p className="wk-field-hint">Промокод не найден. Цена без скидки.</p>}
      <div className="wk-summary"><SummaryRow label="Стоимость продукта">{money(product.priceCents)}</SummaryRow>{discount > 0 && <SummaryRow label={`Скидка ${Math.round(discount * 100)}%`}><span className="wk-green">−{money(product.priceCents - total)}</span></SummaryRow>}<SummaryRow label="Комиссия за покупку">0 ₽</SummaryRow><SummaryRow label="Итого к списанию" strong>{money(total)}</SummaryRow></div>
      <div className="wk-balance-payment"><span className="wk-mini-icon"><Wallet size={20} /></span><div><b>Оплата с баланса</b><p>{wallet ? `Доступно ${money(wallet.balanceCents)}` : "Загружаем баланс…"}</p></div><Check size={17} /></div>
      {wallet && (missing ? <div className="wk-info"><Wallet size={17} /><span>Не хватает <b>{money(missing)}</b>. Пополните баланс и вернитесь к покупке.</span></div> : <p className="wk-caption">После покупки останется {money(wallet.balanceCents - total)}</p>)}
      <WalletErrorBox error={error} />
      {wallet && missing > 0 ? <button className="wk-button wk-primary wk-full" onClick={topUp}>Пополнить баланс <ArrowRight size={17} /></button> : <button className="wk-button wk-primary wk-full" disabled={busy || !wallet} onClick={buy}>{busy ? <Busy text="Подтверждаем…" /> : <>Подтвердить покупку · {money(total)} <ArrowRight size={16} /></>}</button>}
      <p className="wk-caption"><ShieldCheck size={13} />Средства спишутся только после вашего подтверждения</p>
    </div>}
  </WalletModal>;
}
