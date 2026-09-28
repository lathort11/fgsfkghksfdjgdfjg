"use client";

import { useState } from "react";
import { ArrowRight, Eye, EyeOff, Layers, LoaderCircle, PackageCheck, PackageX, ShieldCheck, Tag, TriangleAlert } from "lucide-react";
import type { AdminProduct } from "@/lib/admin";
import { ProductTile } from "@/components/livka/product-art";
import { WalletModal } from "@/components/livka/wallet-primitives";
import { money, parseMoney } from "@/lib/wallet-shared";

type Mode = "price" | "visibility";
type Filter = "all" | "active" | "hidden";

const PER: Record<string, string> = { once: "разово · на весь срок", monthly: "за 30 дней" };
const KIND: Record<string, string> = { account: "Аккаунт", api: "API-ключ" };
const MAX_PRICE_CENTS = 100_000_000;
const ERRORS: Record<string, string> = {
  AUTH: "Сессия истекла. Войдите снова.",
  FORBIDDEN: "Недостаточно прав.",
  ADMIN_PASSWORD_REQUIRED: "Введите текущий пароль администратора.",
  ADMIN_PASSWORD_WRONG: "Неверный пароль администратора.",
  ADMIN_CONFIRM_LOCKED: "Слишком много неверных паролей. Подождите 15 минут.",
  INVALID_PRICE: "Цена должна быть от 1 до 1 000 000 ₽.",
  PRICE_UNCHANGED: "Новая цена совпадает с текущей.",
  PRODUCT_CHANGED: "Продукт только что изменил другой администратор. Закройте окно — данные обновятся.",
  PRODUCT_NOT_FOUND: "Продукт не найден.",
  RATE_LIMIT: "Слишком много действий. Подождите минуту.",
};

export function ProductsPanel({ products, mode, onChanged }: { products: AdminProduct[]; mode: "demo" | "live"; onChanged: (message: string) => Promise<void> }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<{ product: AdminProduct; mode: Mode } | null>(null);
  const active = products.filter((p) => p.active).length;
  const hidden = products.length - active;
  const list = products.filter((p) => filter === "all" || (filter === "active" ? p.active : !p.active));
  const tabs: [Filter, string, number][] = [["all", "Все", products.length], ["active", "В продаже", active], ["hidden", "Скрытые", hidden]];

  return <>
    <section className="ad-stats ad-stats-3">
      <article><span className="mint"><PackageCheck /></span><div><small>В продаже</small><b>{active}</b><p>видны в каталоге и Mini App</p></div></article>
      <article><span className="rose"><PackageX /></span><div><small>Скрыто</small><b>{hidden}</b><p>купить нельзя, история цела</p></div></article>
      <article><span className="violet"><Layers /></span><div><small>Всего продуктов</small><b>{products.length}</b><p>{mode === "demo" ? "демонстрационный контур" : "реальный контур"}</p></div></article>
    </section>
    <section className="ad-card ad-products">
      <div className="ad-card-head">
        <div><span>КАТАЛОГ МАГАЗИНА</span><h2>Продукты <i>{list.length}</i></h2></div>
        <div className="ad-segment" role="tablist" aria-label="Фильтр продуктов">
          {tabs.map(([id, label, count]) => <button key={id} role="tab" aria-selected={filter === id} className={filter === id ? "active" : ""} onClick={() => setFilter(id)}>{label}<i>{count}</i></button>)}
        </div>
      </div>
      {list.length ? <div className="ad-product-grid">{list.map((p) => <article key={p.id} className={`ad-product ${p.active ? "" : "is-hidden"}`}>
        <div className="ad-product-top">
          <ProductTile product={p} size={50} />
          <div className="ad-product-name"><b>{p.title}</b><code>{p.slug}</code></div>
          <span className={`ad-status ${p.active ? "active" : "hidden"}`}>{p.active ? "В продаже" : "Скрыт"}</span>
        </div>
        <div className="ad-product-price">
          <div><small>Цена</small><b>{money(p.priceCents)}</b><span>{PER[p.per] ?? p.per}</span></div>
          <div className="ad-product-meta"><span>{KIND[p.kind] ?? p.kind}</span><span><b>{p.stock}</b> на складе</span></div>
        </div>
        <div className="ad-product-actions">
          <button onClick={() => setEditing({ product: p, mode: "price" })}><Tag size={15} />Изменить цену</button>
          <button className={p.active ? "danger" : "success"} onClick={() => setEditing({ product: p, mode: "visibility" })}>{p.active ? <><EyeOff size={15} />Убрать из продажи</> : <><Eye size={15} />Включить продажу</>}</button>
        </div>
      </article>)}</div> : <div className="ad-empty"><PackageX size={28} /><b>Здесь пока пусто</b><p>В этой категории нет продуктов.</p></div>}
    </section>
    {editing && <ProductModal product={editing.product} mode={editing.mode} onClose={() => setEditing(null)} onDone={async (text) => { setEditing(null); await onChanged(text); }} />}
  </>;
}

function ProductModal({ product, mode, onClose, onDone }: { product: AdminProduct; mode: Mode; onClose: () => void; onDone: (text: string) => Promise<void> }) {
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
      await onDone(mode === "price" ? `Цена обновлена: ${money(cents)}` : enabling ? "Продукт включён в продажу" : "Продукт убран из продажи");
    } catch (e) {
      const code = e instanceof Error ? e.message : "SERVER";
      setError(ERRORS[code] ?? "Не удалось сохранить изменения. Попробуйте ещё раз.");
      setBusy(false);
    }
  };

  const title = mode === "price" ? "Изменить цену" : enabling ? "Включить продажу" : "Убрать из продажи";
  return <WalletModal title={title} subtitle={`${product.title} · ${product.slug}`} onClose={onClose}>
    <form onSubmit={submit}>
      <div className="ad-confirm-user">
        <ProductTile product={product} size={40} />
        <div><b>{product.title}</b><p>{money(product.priceCents)} · {PER[product.per] ?? product.per}</p></div>
        <span className={`ad-status ${product.active ? "active" : "hidden"}`}>{product.active ? "В продаже" : "Скрыт"}</span>
      </div>
      {mode === "price" ? <>
        <label className="ad-field">Новая цена<div><input autoFocus inputMode="decimal" aria-label="Новая цена" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.,]/g, "").slice(0, 10))} /><span>₽</span></div></label>
        <div className="ad-price-preview">
          <div>Сейчас<b>{money(product.priceCents)}</b></div>
          <ArrowRight size={16} />
          <div>Станет<b>{cents ? money(cents) : "—"}</b>{diff !== 0 && cents > 0 && <span className={`chg ${diff > 0 ? "up" : "down"}`}>{diff > 0 ? "+" : ""}{percent}%</span>}</div>
        </div>
        <div className="ad-info"><ShieldCheck size={18} /><span>Покупатель с открытым окном оплаты увидит новую цену и подтвердит покупку заново — старая цена не спишется.</span></div>
      </> : enabling
        ? <div className="ad-info"><Eye size={18} /><span>Продукт появится в каталоге и Mini App и станет доступен для покупки по цене {money(product.priceCents)}. Проверьте цену перед включением.</span></div>
        : <div className="ad-warning"><TriangleAlert size={18} /><span>Продукт исчезнет из каталога и Mini App, купить его будет нельзя. Выданные доступы и история заказов сохранятся.</span></div>}
      <label className="ad-field">Комментарий <em>необязательно</em><textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder={mode === "price" ? "Например: новая закупочная цена" : "Например: временно нет в наличии"} /></label>
      <label className="ad-field">Подтверждение администратора<input className="ad-password-confirm" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="Ваш текущий пароль" /></label>
      {error && <div className="ad-error" role="alert">{error}</div>}
      <div className="ad-modal-actions">
        <button type="button" className="ad-cancel" onClick={onClose}>Отмена</button>
        <button type="submit" className={mode === "visibility" && !enabling ? "ad-submit danger" : "ad-submit"} disabled={!valid || busy}>
          {busy ? <><LoaderCircle className="ad-spin" size={16} />Сохраняем…</> : mode === "price" ? <><Tag size={16} />Сохранить цену</> : enabling ? <><Eye size={16} />Включить</> : <><EyeOff size={16} />Убрать из продажи</>}
        </button>
      </div>
    </form>
  </WalletModal>;
}
