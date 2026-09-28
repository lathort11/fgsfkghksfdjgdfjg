"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowDownToLine, ArrowLeftRight, ArrowRight, ArrowUpRight, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, Copy, Download, Eye, EyeOff, Headphones, HelpCircle, LayoutGrid, LogOut, Menu, Plus, Search, Settings2, ShieldCheck, ShoppingBag, Sparkles, Wallet, X, Zap, CircleCheck, CircleUserRound, Send, ReceiptText, LockKeyhole } from "lucide-react";
import type { ProductRow } from "@/db/schema";
import { AuthModal, type SessionUser } from "@/components/livka/auth";
import { ProfileModal } from "@/components/livka/profile";
import { ProductTile } from "@/components/livka/product-art";
import { BalanceCheckout } from "@/components/livka/balance-checkout";
import { useI18n } from "@/components/livka/i18n-context";
import { AmountInput, AssetSelect, Presets, TopUpModal, WithdrawModal, OperationModal, WalletRulesModal, statusText, kindText } from "@/components/livka/wallet-actions";
import { WalletModal, WalletErrorBox, Busy, walletRequest, errorMessage } from "@/components/livka/wallet-primitives";
import { emptyWallet, money, parseMoney, WALLET_RULES, type WalletMode, type WalletOperation, type WalletSnapshot } from "@/lib/wallet-shared";

export type WalletSection = "wallet" | "catalog" | "purchases" | "history";
const labels: Record<WalletSection, string> = { wallet: "Кошелёк", catalog: "Каталог продуктов", purchases: "Мои покупки", history: "История операций" };
const subtitles: Record<WalletSection, string> = { wallet: "Управляйте балансом. Открывайте больше возможностей.", catalog: "Лучшие AI-инструменты. Одна покупка — и вы в деле.", purchases: "Ваши подписки, ключи и новые возможности — в одном месте.", history: "Каждое пополнение, покупка и вывод. Всё под контролем." };
const isSection = (s: string | null): s is WalletSection => !!s && ["wallet", "catalog", "purchases", "history"].includes(s);

export default function WalletDashboard({ products, initialUser, initialWallet, mode, initialSection = "wallet" }: { products: ProductRow[]; initialUser: SessionUser | null; initialWallet: WalletSnapshot | null; mode: WalletMode; initialSection?: WalletSection }) {
  const { t } = useI18n();
  const [user, setUser] = useState(initialUser);
  const [wallet, setWallet] = useState(initialWallet ?? emptyWallet(mode));
  const [section, setSection] = useState<WalletSection>(initialSection);
  const [mobileNav, setMobileNav] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [afterAuth, setAfterAuth] = useState<string | null>(null);
  const [quickAmount, setQuickAmount] = useState("1000");
  const [asset, setAsset] = useState("USDT");
  const [topUp, setTopUp] = useState(false);
  const [resumeDeposit, setResumeDeposit] = useState<WalletOperation | null>(null);
  const [withdraw, setWithdraw] = useState(false);
  const [operation, setOperation] = useState<WalletOperation | null>(null);
  const [buying, setBuying] = useState<ProductRow | null>(null);
  const [pendingProduct, setPendingProduct] = useState<ProductRow | null>(null);
  const [search, setSearch] = useState("");
  const [version, setVersion] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const navigate = (next: WalletSection) => {
    setSection(next); setMobileNav(false);
    const url = new URL(window.location.href); url.searchParams.set("section", next); url.searchParams.delete("topup");
    window.history.pushState({}, "", url); window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const refresh = useCallback(async () => {
    if (!user) { setWallet(emptyWallet(mode)); return; }
    try { setWallet(await walletRequest<WalletSnapshot>("/api/wallet")); setLoadError(null); }
    catch (e) { setLoadError(errorMessage(e)); }
  }, [user, mode]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const pop = () => { const s = new URLSearchParams(location.search).get("section"); setSection(isSection(s) ? s : "wallet"); };
    window.addEventListener("popstate", pop);
    const amount = new URLSearchParams(location.search).get("topup");
    if (amount && /^\d{1,5}$/.test(amount)) {
      setQuickAmount(String(Math.max(100, Math.min(50000, Number(amount)))));
      if (initialUser) setTopUp(true); else { setAfterAuth("topup"); setAuthOpen(true); }
    }
    return () => window.removeEventListener("popstate", pop);
  }, [initialUser]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), 4500); return () => clearTimeout(timer); }, [toast]);

  const askAuth = (action: string) => { setAfterAuth(action); setAuthOpen(true); setMobileNav(false); };
  const openTopUp = () => { setResumeDeposit(null); user ? setTopUp(true) : askAuth("topup"); };
  const openWithdrawal = () => { user ? setWithdraw(true) : askAuth("withdraw"); };
  const buy = (p: ProductRow) => {
    if (!user) { setPendingProduct(p); askAuth("purchase"); } else setBuying(p);
  };
  const onAuth = (u: SessionUser) => {
    setUser(u); setAuthOpen(false); setToast(`Добро пожаловать, ${u.name.split(" ")[0]}!`);
    if (afterAuth === "topup") setTopUp(true);
    if (afterAuth === "withdraw") setWithdraw(true);
    if (afterAuth === "profile") setProfileOpen(true);
    if (afterAuth === "purchase" && pendingProduct) { setBuying(pendingProduct); setPendingProduct(null); }
    setAfterAuth(null);
  };
  const logout = async () => {
    try { await walletRequest("/api/auth/logout", {}); setUser(null); setWallet(emptyWallet(mode)); setProfileOpen(false); setToast("Вы вышли из аккаунта"); }
    catch { setToast("Не удалось выйти. Попробуйте ещё раз."); }
  };
  const updated = useCallback((w: WalletSnapshot) => { setWallet(w); setLoadError(null); }, []);
  const topUpUpdated = (w: WalletSnapshot, done?: boolean) => {
    updated(w);
    if (done) {
      setTopUp(false); setResumeDeposit(null);
      if (pendingProduct) { setBuying(pendingProduct); setPendingProduct(null); }
      else navigate("catalog");
    }
  };
  const showBalance = (n: number, decimals = false) => hidden ? "•••••• ₽" : money(n, decimals);
  const filteredProducts = products.filter((p) => `${t.products[p.slug as keyof typeof t.products]?.name ?? p.slug} ${p.kind}`.toLowerCase().includes(search.toLowerCase()));

  return <div className="wk-app">
    {mobileNav && <button className="wk-nav-scrim" aria-label="Закрыть меню" onClick={() => setMobileNav(false)} />}
    <aside className={`wk-sidebar ${mobileNav ? "is-open" : ""}`}>
      <a href="/" className="wk-brand"><img src="/logo.svg" alt="" width={35} height={35} /><span>LIVKA<span>MARKET</span><small>YOUR AI. YOUR WAY.</small></span></a>
      <div className="wk-nav-group"><span className="wk-nav-label">МАРКЕТПЛЕЙС</span><button className={`wk-nav-item ${section === "catalog" ? "active" : ""}`} onClick={() => navigate("catalog")}><LayoutGrid size={19} /><span>Каталог</span><i>{products.length}</i></button></div>
      <div className="wk-nav-group"><span className="wk-nav-label">ЛИЧНЫЙ КАБИНЕТ</span>
        <button className={`wk-nav-item ${section === "wallet" ? "active" : ""}`} onClick={() => navigate("wallet")}><Wallet size={19} /><span>Кошелёк</span><span className="wk-new">NEW</span></button>
        <button className={`wk-nav-item ${section === "purchases" ? "active" : ""}`} onClick={() => navigate("purchases")}><ShoppingBag size={19} /><span>Мои покупки</span></button>
        <button className={`wk-nav-item ${section === "history" ? "active" : ""}`} onClick={() => navigate("history")}><ArrowLeftRight size={19} /><span>История операций</span></button>
        <button className="wk-nav-item" onClick={() => { if (user) { setProfileOpen(true); setMobileNav(false); } else askAuth("profile"); }}><Settings2 size={19} /><span>Настройки</span></button>
        {user?.role === "admin" && <a className="wk-nav-item wk-admin-link" href="/admin"><ShieldCheck size={19} /><span>LIVKA CONTROL</span><ArrowUpRight size={14} /></a>}
      </div>
      <div className="wk-sidebar-bottom"><div className="wk-help-card"><span className="wk-help-icon"><Headphones size={21} /></span><h3>Мы рядом, если что</h3><p>Поможем с покупкой,<br />балансом и всем остальным.</p><a href="https://t.me/livkamarket" target="_blank" rel="noreferrer">Написать в поддержку <ArrowUpRight size={15} /></a></div>
        <button className="wk-nav-item wk-help-nav" onClick={() => { setRulesOpen(true); setMobileNav(false); }}><HelpCircle size={18} /><span>Помощь и правила</span><ArrowUpRight size={14} /></button>
        <div className="wk-sidebar-account"><button onClick={() => user ? setProfileOpen(true) : askAuth("profile")}><span className="wk-avatar">{user ? user.name[0].toUpperCase() : <CircleUserRound size={22} />}</span><span><b>{user ? user.name.split(" ")[0] : "Ваш аккаунт"}</b><small>{user ? user.customerId ?? "Личный кабинет" : "Войдите, чтобы начать"}</small></span></button>{user && <button className="wk-icon-button" aria-label="Выйти из аккаунта" onClick={logout}><LogOut size={16} /></button>}</div>
      </div>
    </aside>

    <div className="wk-workspace"><header className="wk-topbar"><div className="wk-breadcrumb"><button className="wk-icon-button wk-mobile-toggle" aria-label="Открыть меню" onClick={() => setMobileNav(true)}><Menu size={21} /></button><span className="wk-breadcrumb-parent">Личный кабинет</span><ChevronRight size={13} /><strong>{labels[section]}</strong></div><div className="wk-topbar-right">{mode === "demo" && <button className="wk-mode-badge" onClick={() => setRulesOpen(true)}><span />Демо-режим</button>}<a className="wk-top-support" href="https://t.me/livkamarket" target="_blank" rel="noreferrer"><Headphones size={16} />Поддержка <ArrowUpRight size={13} /></a><button className="wk-user-button" onClick={() => user ? setProfileOpen(true) : askAuth("login")}>{user ? <span className="wk-avatar small">{user.name[0].toUpperCase()}</span> : <CircleUserRound size={18} />}<span>{user ? user.name.split(" ")[0] : "Войти"}</span>{user && <ChevronDown size={13} />}</button></div></header>

      <main className="wk-main"><div className="wk-page-heading"><div><div className="wk-eyebrow"><span />ВАШЕ ПРОСТРАНСТВО ВОЗМОЖНОСТЕЙ</div><h1>{section === "wallet" ? "Мой кошелёк" : labels[section]}</h1><p>{subtitles[section]}</p></div><button className="wk-button wk-secondary wk-terms-button" onClick={() => setRulesOpen(true)}><ShieldCheck size={16} />Условия и комиссии <ArrowUpRight size={14} /></button></div>
      {loadError && <div className="wk-loading-error"><WalletErrorBox error={loadError} /><button className="wk-button wk-secondary" onClick={refresh}>Повторить</button></div>}

      {section === "wallet" && <>
        <div className="wk-wallet-grid"><section className="wk-balance-card" aria-label="Ваш баланс"><div className="wk-card-orbit" aria-hidden="true" /><img className="wk-wallet-art" src="/images/wallet-3d.png" alt="" /><div className="wk-card-top"><span><span className="wk-logo-star">✦</span> LIVKA BALANCE</span><span className="wk-currency">RUB</span></div><div className="wk-balance-content"><div className="wk-balance-label">Доступный баланс<button aria-label={hidden ? "Показать баланс" : "Скрыть баланс"} onClick={() => setHidden(!hidden)}>{hidden ? <EyeOff size={16} /> : <Eye size={16} />}</button></div><div className="wk-balance-number">{hidden ? "••••••" : (wallet.balanceCents / 100).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<span>₽</span></div><p>Ваш следующий большой шаг начинается здесь.</p><div className="wk-balance-actions"><button className="wk-button wk-light" onClick={openTopUp}><Plus size={18} />Пополнить баланс</button><button className="wk-button wk-glass" onClick={openWithdrawal}><ArrowUpRight size={18} />Вывести</button></div></div><div className="wk-card-bottom"><span><ShieldCheck size={14} />{mode === "demo" ? "Тестовые средства · без реальных переводов" : "Ваш баланс под защитой"}</span><span className="wk-card-dots">● ● ●</span></div></section>
          <section className="wk-quick-card"><div className="wk-card-title"><h2>Быстрое пополнение</h2><span><Zap size={16} /></span></div><form onSubmit={(e) => { e.preventDefault(); openTopUp(); }}><AmountInput value={quickAmount} onChange={setQuickAmount} id="quick-topup-amount" /><Presets value={quickAmount} onChange={setQuickAmount} /><AssetSelect value={asset} onChange={setAsset} id="quick-topup-asset" /><button className="wk-button wk-primary wk-full" disabled={parseMoney(quickAmount) < WALLET_RULES.minDepositCents || parseMoney(quickAmount) > WALLET_RULES.maxDepositCents} type="submit">Продолжить <ArrowRight size={17} /></button><p className="wk-caption"><LockKeyhole size={12} />0% комиссии за пополнение</p></form></section>
        </div>
        <div className="wk-stats"><Stat icon={<ArrowUpRight size={19} />} color="mint" label="Доступно к выводу" amount={showBalance(wallet.withdrawableCents)} caption="После проверки заявки" onInfo={() => setRulesOpen(true)} /><Stat icon={<Clock3 size={19} />} color="amber" label="В обработке" amount={showBalance(wallet.heldCents)} caption="Зарезервировано для вывода" onInfo={() => setRulesOpen(true)} /><Stat icon={<ShoppingBag size={19} />} color="violet" label="Потрачено на покупки" amount={showBalance(wallet.spentCents)} caption="За всё время" /></div>
        <div className="wk-history-grid"><HistoryPanel wallet={wallet} onTopUp={openTopUp} onOpen={setOperation} onExpand={() => navigate("history")} /><aside className="wk-how-card"><div className="wk-how-heading"><span className="wk-mini-icon"><Sparkles size={18} /></span><div><h2>Покупать стало проще</h2><p>Четыре шага. Без лишнего.</p></div></div><ol>{[{ title: "Пополните баланс", desc: "Один раз, удобным способом" }, { title: "Выберите продукт", desc: "Найдите свой AI-инструмент" }, { title: "Подтвердите покупку", desc: "Оплата с баланса в один клик" }, { title: "Заберите доступ", desc: "Он уже в ваших покупках" }].map((step, i) => <li key={step.title}><span>{i === 3 ? <Check size={14} /> : `0${i + 1}`}</span><div><b>{step.title}</b><p>{step.desc}</p></div></li>)}</ol><button onClick={() => navigate("catalog")}>Найти что-то для себя <ArrowRight size={15} /></button></aside></div>
        <section className="wk-recommendations"><div className="wk-section-heading"><div><span className="wk-tiny-eyebrow">ВОЗМОЖНОСТИ БЕЗ ГРАНИЦ</span><h2>Ваш следующий AI-апгрейд</h2></div><button className="wk-text-button" onClick={() => navigate("catalog")}>Весь каталог <ArrowRight size={15} /></button></div><div className="wk-product-strip">{products.map((p) => <button className="wk-product-mini" key={p.id} onClick={() => buy(p)}><ProductTile product={p} size={44} /><div><h3>{t.products[p.slug as keyof typeof t.products]?.name ?? p.slug}</h3><span>от {money(p.priceCents)}</span></div><ArrowUpRight size={17} /></button>)}</div></section>
      </>}

      {section === "history" && <HistoryPanel wallet={wallet} onTopUp={openTopUp} onOpen={setOperation} expanded />}
      {section === "catalog" && <><div className="wk-catalog-banner"><div><span className="wk-small-badge">МЕНЬШЕ РУТИНЫ. БОЛЬШЕ ВОЗМОЖНОСТЕЙ.</span><h2>Инструменты для ваших<br /><span>больших идей.</span></h2><p>Пополните баланс. Выберите свой AI. Начните создавать.</p><button className="wk-button wk-light" onClick={openTopUp}><Plus size={17} />Пополнить баланс</button></div><div className="wk-catalog-orbit" aria-hidden="true">{products.slice(0, 3).map((p) => <ProductTile key={p.id} product={p} size={80} />)}</div></div><div className="wk-catalog-toolbar"><h2>Все продукты <span>{products.length}</span></h2><label className="wk-search"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Найти AI-инструмент…" aria-label="Поиск в каталоге" /></label></div><div className="wk-catalog-grid">{filteredProducts.map((p) => { const pd = t.products[p.slug as keyof typeof t.products]; return <article className="wk-catalog-product" key={p.id}><div className="wk-product-top"><ProductTile product={p} size={64} /><span className="wk-small-badge">{pd?.badge ?? "AI"}</span></div><h3>{pd?.name ?? p.slug}</h3><p>{pd?.tagline}</p><ul>{pd?.features.slice(0, 3).map((feature) => <li key={feature}><Check size={14} />{feature}</li>)}</ul><div className="wk-product-price"><div><b>{money(p.priceCents)}</b><span>{t.per[p.per as keyof typeof t.per]}</span></div><button className="wk-button wk-secondary" onClick={() => buy(p)}>Купить <ArrowUpRight size={16} /></button></div></article>; })}</div>{filteredProducts.length === 0 && <div className="wk-empty"><Search size={32} /><h3>Ничего не найдено</h3><p>Попробуйте другое название продукта.</p><button className="wk-text-button" onClick={() => setSearch("")}>Сбросить поиск</button></div>}</>}
      {section === "purchases" && <PurchasesPanel user={user} version={version} onCatalog={() => navigate("catalog")} onLogin={() => askAuth("purchases")} />}

      <div className="wk-bottom-note"><ShieldCheck size={17} /><p><strong>Всё под вашим контролем.</strong> Сумма и комиссия всегда видны до подтверждения.</p><button onClick={() => setRulesOpen(true)}>Подробнее <ArrowUpRight size={13} /></button></div>
      <footer className="wk-footer"><span>© 2026 LIVKAMARKET</span><div><span className="wk-online-dot" />Создавайте больше. Мы позаботимся об остальном.</div><a href="https://t.me/livkamarket" target="_blank" rel="noreferrer"><Send size={13} />Мы в Telegram</a></footer>
      </main>
    </div>

    {authOpen && <AuthModal open reason={afterAuth === "purchase" ? "Войдите, чтобы купить продукт с личного баланса." : "Ваш баланс и покупки будут надёжно сохранены в аккаунте."} onClose={() => { setAuthOpen(false); setAfterAuth(null); setPendingProduct(null); }} onSuccess={onAuth} />}
    {profileOpen && user && <ProfileModal open user={user} onClose={() => setProfileOpen(false)} onOrders={() => { setProfileOpen(false); navigate("purchases"); }} onLogout={logout} onUserUpdate={setUser} />}
    {topUp && user && <TopUpModal wallet={wallet} initialAmount={quickAmount} initialAsset={asset} existing={resumeDeposit} onClose={() => { setTopUp(false); setResumeDeposit(null); }} onUpdate={topUpUpdated} />}
    {withdraw && user && <WithdrawModal wallet={wallet} onClose={() => setWithdraw(false)} onUpdate={updated} />}
    {operation && <OperationModal operation={operation} wallet={wallet} onClose={() => setOperation(null)} onUpdate={updated} onPay={(op) => { setOperation(null); setResumeDeposit(op); setTopUp(true); }} onOrders={() => { setOperation(null); navigate("purchases"); }} />}
    {rulesOpen && <WalletRulesModal onClose={() => setRulesOpen(false)} />}
    {buying && <BalanceCheckout product={buying} onClose={() => setBuying(null)} onOpenOrders={() => navigate("purchases")} onTopUp={(missing) => { setPendingProduct(buying); setBuying(null); setQuickAmount(String(Math.max(100, Math.ceil(missing / 100)))); setResumeDeposit(null); setTopUp(true); }} onPurchased={() => { void refresh(); setVersion((n) => n + 1); }} />}
    {toast && <div className="wk-toast" role="status"><CircleCheck size={18} /><span>{toast}</span><button onClick={() => setToast(null)} aria-label="Закрыть уведомление"><X size={15} /></button></div>}
  </div>;
}

function Stat({ icon, color, label, amount, caption, onInfo }: { icon: React.ReactNode; color: string; label: string; amount: string; caption: string; onInfo?: () => void }) {
  return <div className="wk-stat"><span className={`wk-stat-icon ${color}`}>{icon}</span><div><span className="wk-stat-label">{label}{onInfo && <button aria-label={`Подробнее: ${label}`} onClick={onInfo}><HelpCircle size={12} /></button>}</span><b>{amount}</b><small>{caption}</small></div><span className="wk-stat-decoration" /></div>;
}

function HistoryPanel({ wallet, onTopUp, onOpen, onExpand, expanded = false }: { wallet: WalletSnapshot; onTopUp: () => void; onOpen: (op: WalletOperation) => void; onExpand?: () => void; expanded?: boolean }) {
  const [filter, setFilter] = useState("all"), [period, setPeriod] = useState("all"), [page, setPage] = useState(0);
  const list = useMemo(() => wallet.operations.filter((op) => (filter === "all" || op.kind === filter) && (period === "all" || new Date(op.createdAt).getTime() >= Date.now() - Number(period) * 86400_000)), [wallet.operations, filter, period]);
  const size = expanded ? 10 : 5, current = Math.min(page, Math.max(0, Math.ceil(list.length / size) - 1));
  const visible = list.slice(current * size, current * size + size);
  const exportCsv = () => {
    const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const lines = [["Дата", "Операция", "Описание", "Статус", "Сумма RUB", "Комиссия RUB"], ...list.map((o) => [o.createdAt, kindText[o.kind], o.description, statusText[o.status], (o.amountCents / 100).toFixed(2), (o.feeCents / 100).toFixed(2)])];
    const url = URL.createObjectURL(new Blob(["\uFEFF" + lines.map((row) => row.map(escape).join(";")).join("\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `livka-operations-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  return <section className={`wk-history-card ${expanded ? "is-expanded" : ""}`}><div className="wk-history-heading"><h2>История операций <span>{wallet.operations.length}</span></h2><button className="wk-export" onClick={exportCsv} disabled={!list.length} aria-label="Скачать историю в CSV" title="Скачать CSV"><Download size={15} /><span>Выгрузить</span></button></div>
    <div className="wk-history-toolbar"><div className="wk-tabs" role="tablist" aria-label="Тип операций">{[["all", "Все операции"], ["deposit", "Пополнения"], ["purchase", "Покупки"], ["withdrawal", "Выводы"]].map(([id, label]) => <button role="tab" aria-selected={filter === id} className={filter === id ? "active" : ""} key={id} onClick={() => { setFilter(id); setPage(0); }}>{label}</button>)}</div><select aria-label="Период операций" value={period} onChange={(e) => { setPeriod(e.target.value); setPage(0); }}><option value="all">Всё время</option><option value="30">30 дней</option><option value="7">7 дней</option></select></div>
    <div className="wk-history-columns"><span>Операция</span><span>Дата</span><span>Статус</span><span>Сумма</span></div>
    {!visible.length ? <div className="wk-empty"><div className="wk-empty-art"><ReceiptText size={32} strokeWidth={1.3} /><span><Plus size={13} /></span></div><h3>{wallet.operations.length ? "Таких операций пока нет" : "Здесь начинается ваша история"}</h3><p>{wallet.operations.length ? "Измените тип или период, чтобы увидеть другие операции." : "Пополните баланс — и первая операция появится здесь."}</p>{wallet.operations.length ? <button className="wk-text-button" onClick={() => { setFilter("all"); setPeriod("all"); }}>Показать все операции <ArrowRight size={14} /></button> : <button className="wk-text-button" onClick={onTopUp}>Сделать первое пополнение <ArrowRight size={14} /></button>}</div> : <div className="wk-history-rows">{visible.map((op) => <button className="wk-history-row" key={op.id} onClick={() => onOpen(op)}><span className="wk-history-operation"><span className={`wk-operation-icon ${op.kind}`}>{op.kind === "deposit" ? <ArrowDownLeft size={17} /> : op.kind === "purchase" ? <ShoppingBag size={17} /> : op.kind === "adjustment" ? <Plus size={17} /> : <ArrowUpRight size={17} />}</span><span><b>{op.description}</b><small>{op.method}</small></span></span><span className="wk-history-date">{new Date(op.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}<small>{new Date(op.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</small></span><span className={`wk-status ${op.status}`}>{statusText[op.status]}</span><span className={`wk-history-amount ${(op.kind === "deposit" || op.kind === "adjustment") && op.status === "completed" ? "wk-green" : ""}`}>{op.kind === "deposit" || op.kind === "adjustment" ? "+" : "−"}{money(op.amountCents)}<ChevronRight size={13} /></span></button>)}</div>}
    <div className="wk-history-footer"><span>{list.length ? `${current * size + 1}–${Math.min((current + 1) * size, list.length)} из ${list.length} операций` : "Все ваши операции — в одном месте"}</span>{list.length > size ? <div><button disabled={current === 0} aria-label="Предыдущая страница" onClick={() => setPage(current - 1)}><ChevronLeft size={16} /></button><button disabled={(current + 1) * size >= list.length} aria-label="Следующая страница" onClick={() => setPage(current + 1)}><ChevronRight size={16} /></button></div> : onExpand ? <button onClick={onExpand}>Вся история <ArrowRight size={13} /></button> : <ShieldCheck size={14} />}</div>
  </section>;
}

type SavedOrder = { orderNo: number; secret: string; status: string; totalCents: number; productSlug: string; credentials: string | null; createdAt: string; networkLabel: string };
function PurchasesPanel({ user, version, onCatalog, onLogin }: { user: SessionUser | null; version: number; onCatalog: () => void; onLogin: () => void }) {
  const { t } = useI18n();
  const [rows, setRows] = useState<SavedOrder[] | null>(null), [error, setError] = useState<string | null>(null), [selected, setSelected] = useState<SavedOrder | null>(null), [copied, setCopied] = useState(false), [revealed, setRevealed] = useState(false);
  const load = useCallback(() => {
    if (!user) { setRows([]); return; }
    setError(null);
    walletRequest<{ orders: SavedOrder[] }>("/api/order/mine").then((d) => setRows(d.orders)).catch((e) => setError(errorMessage(e)));
  }, [user]);
  useEffect(() => { load(); }, [load, version]);
  if (error) return <div className="wk-history-card wk-form"><WalletErrorBox error={error} /><button className="wk-button wk-secondary" onClick={load}>Попробовать снова</button></div>;
  if (rows === null) return <div className="wk-empty"><Busy text="Загружаем покупки…" /></div>;
  return <><div className="wk-purchases-grid">{rows.length ? rows.map((order) => <article className="wk-purchase-card" key={order.secret}><div><span className="wk-mini-icon"><ShoppingBag size={22} /></span><span className="wk-small-badge">{order.status === "delivered" ? "ДОСТУП ПОЛУЧЕН" : "ОБРАБАТЫВАЕТСЯ"}</span></div><h3>{t.products[order.productSlug as keyof typeof t.products]?.name ?? order.productSlug}</h3><p>Заказ № {order.orderNo} · {new Date(order.createdAt).toLocaleDateString("ru-RU")}</p><div className="wk-purchase-bottom"><b>{money(order.totalCents)}</b><button className="wk-button wk-secondary" onClick={() => { setSelected(order); setCopied(false); setRevealed(false); }}>Открыть <ArrowUpRight size={15} /></button></div></article>) : <div className="wk-empty wk-empty-purchases"><div className="wk-empty-art"><ShoppingBag size={34} strokeWidth={1.3} /></div><h3>Всё лучшее ещё впереди</h3><p>{user ? "Выберите AI-инструмент и оплатите его с баланса. Ваш доступ будет сохранён здесь." : "Войдите в аккаунт, чтобы сохранять покупки и управлять доступами."}</p><button className="wk-button wk-primary" onClick={user ? onCatalog : onLogin}>{user ? "Открыть каталог" : "Войти в аккаунт"}<ArrowRight size={16} /></button></div>}</div>
    {selected && <WalletModal title={t.products[selected.productSlug as keyof typeof t.products]?.name ?? selected.productSlug} subtitle={`Заказ № ${selected.orderNo} · ${selected.networkLabel}`} onClose={() => setSelected(null)}><div className="wk-credentials"><div><span>ДАННЫЕ ДОСТУПА</span><button onClick={() => setRevealed(!revealed)}>{revealed ? <EyeOff size={16} /> : <Eye size={16} />}{revealed ? "Скрыть" : "Показать"}</button></div><pre>{revealed ? selected.credentials ?? "Доступ ещё не выдан" : "••••••••••••••••••••••••\n••••••••••••••••••••••••"}</pre></div><button className="wk-button wk-primary wk-full" disabled={!selected.credentials} onClick={async () => { try { await navigator.clipboard.writeText(selected.credentials ?? ""); setCopied(true); } catch { setRevealed(true); } }}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "Скопировано" : "Скопировать доступ"}</button></WalletModal>}
  </>;
}
