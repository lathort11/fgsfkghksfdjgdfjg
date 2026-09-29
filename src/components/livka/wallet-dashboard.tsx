"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowLeftRight, ArrowRight, ArrowUpRight, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, Copy, Download, Eye, EyeOff, Headphones, HelpCircle, LayoutGrid, LogOut, Menu, Plus, Search, Settings2, ShieldCheck, ShoppingBag, Sparkles, Wallet, X, Zap, CircleCheck, CircleUserRound, Send, ReceiptText, LockKeyhole } from "lucide-react";
import type { ProductRow } from "@/db/schema";
import { AuthModal, type SessionUser } from "@/components/livka/auth";
import { ProfileModal } from "@/components/livka/profile";
import { ProductTile } from "@/components/livka/product-art";
import { BalanceCheckout } from "@/components/livka/balance-checkout";
import { TokenCheckout } from "@/components/livka/token-checkout";
import { useW } from "@/components/livka/i18n-context";
import { LangSwitch } from "@/components/livka/lang-switch";
import { AmountInput, AssetSelect, Presets, TopUpModal, WithdrawModal, OperationModal, WalletRulesModal } from "@/components/livka/wallet-actions";
import { WalletModal, WalletErrorBox, Busy, walletRequest, errorMessage, opTitle, opMethod } from "@/components/livka/wallet-primitives";
import { emptyWallet, money, parseMoney, WALLET_RULES, type WalletOperation, type WalletSnapshot } from "@/lib/wallet-shared";
import { balanceOf, formatBankTokens, formatTokens, isTokenProduct, type TokenSnapshot } from "@/lib/tokens-shared";

export type WalletSection = "wallet" | "catalog" | "purchases" | "history";
const isSection = (s: string | null): s is WalletSection => !!s && ["wallet", "catalog", "purchases", "history"].includes(s);
const MIN_TOPUP = WALLET_RULES.minDepositCents / 100, MAX_TOPUP = WALLET_RULES.maxDepositCents / 100;

export default function WalletDashboard({ products, initialUser, initialWallet, initialTokens, initialSection = "wallet" }: { products: ProductRow[]; initialUser: SessionUser | null; initialWallet: WalletSnapshot | null; initialTokens: TokenSnapshot; initialSection?: WalletSection }) {
  const { w, t, locale } = useW();
  const [user, setUser] = useState(initialUser);
  const [wallet, setWallet] = useState(initialWallet ?? emptyWallet());
  const [section, setSection] = useState<WalletSection>(initialSection);
  const [mobileNav, setMobileNav] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [afterAuth, setAfterAuth] = useState<string | null>(null);
  const [quickAmount, setQuickAmount] = useState("50");
  const [asset, setAsset] = useState("USDT");
  const [topUp, setTopUp] = useState(false);
  const [resumeDeposit, setResumeDeposit] = useState<WalletOperation | null>(null);
  const [withdraw, setWithdraw] = useState(false);
  const [operation, setOperation] = useState<WalletOperation | null>(null);
  const [buying, setBuying] = useState<ProductRow | null>(null);
  const [buyingTokens, setBuyingTokens] = useState<ProductRow | null>(null);
  const [pendingProduct, setPendingProduct] = useState<ProductRow | null>(null);
  const [search, setSearch] = useState("");
  const [version, setVersion] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [tokens, setTokens] = useState<TokenSnapshot>(initialTokens);

  const navigate = (next: WalletSection) => {
    setSection(next); setMobileNav(false);
    const url = new URL(window.location.href); url.searchParams.set("section", next); url.searchParams.delete("topup");
    window.history.pushState({}, "", url); window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const refresh = useCallback(async () => {
    if (!user) { setWallet(emptyWallet()); return; }
    try { setWallet(await walletRequest<WalletSnapshot>("/api/wallet")); setLoadError(null); }
    catch (e) { setLoadError(errorMessage(e)); }
  }, [user]);
  useEffect(() => { void refresh(); }, [refresh]);
  /* Token rates are public; balances only arrive for signed-in users. */
  const loadTokens = useCallback(() => {
    walletRequest<TokenSnapshot>("/api/tokens").then(setTokens).catch(() => {});
  }, []);
  useEffect(() => { loadTokens(); }, [loadTokens, user, version]);
  useEffect(() => {
    const pop = () => { const s = new URLSearchParams(location.search).get("section"); setSection(isSection(s) ? s : "wallet"); };
    window.addEventListener("popstate", pop);
    const amount = new URLSearchParams(location.search).get("topup");
    if (amount && /^\d{1,4}$/.test(amount)) {
      setQuickAmount(String(Math.max(MIN_TOPUP, Math.min(MAX_TOPUP, Number(amount)))));
      if (initialUser) setTopUp(true); else { setAfterAuth("topup"); setAuthOpen(true); }
    }
    return () => window.removeEventListener("popstate", pop);
  }, [initialUser]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), 4500); return () => clearTimeout(timer); }, [toast]);

  const askAuth = (action: string) => { setAfterAuth(action); setAuthOpen(true); setMobileNav(false); };
  const openTopUp = () => { setResumeDeposit(null); user ? setTopUp(true) : askAuth("topup"); };
  const openWithdrawal = () => { user ? setWithdraw(true) : askAuth("withdraw"); };
  const openProduct = (p: ProductRow) => (isTokenProduct(p) ? setBuyingTokens(p) : setBuying(p));
  const buy = (p: ProductRow) => {
    if (!user) { setPendingProduct(p); askAuth("purchase"); } else openProduct(p);
  };
  const onAuth = (u: SessionUser) => {
    setUser(u); setAuthOpen(false); setToast(w.welcome(u.name.split(" ")[0]));
    if (afterAuth === "topup") setTopUp(true);
    if (afterAuth === "withdraw") setWithdraw(true);
    if (afterAuth === "profile") setProfileOpen(true);
    if (afterAuth === "purchase" && pendingProduct) { openProduct(pendingProduct); setPendingProduct(null); }
    setAfterAuth(null);
  };
  const logout = async () => {
    try { await walletRequest("/api/auth/logout", {}); setUser(null); setWallet(emptyWallet()); setProfileOpen(false); setToast(w.loggedOut); }
    catch { setToast(w.logoutFailed); }
  };
  const updated = useCallback((s: WalletSnapshot) => { setWallet(s); setLoadError(null); }, []);
  const topUpUpdated = (s: WalletSnapshot, done?: boolean) => {
    updated(s);
    if (done) {
      setTopUp(false); setResumeDeposit(null);
      if (pendingProduct) { openProduct(pendingProduct); setPendingProduct(null); }
      else navigate("catalog");
    }
  };
  const showBalance = (n: number) => hidden ? "$ ••••••" : money(n, true);
  const tokenPriceText = w.tokens.priceLine(money(tokens.pricePerMillionCents, true));
  const bankText = formatBankTokens(tokens.bankAvailableTokens, locale);
  const filteredProducts = products.filter((p) => `${t.products[p.slug as keyof typeof t.products]?.name ?? p.slug} ${p.kind}`.toLowerCase().includes(search.toLowerCase()));
  const firstName = user ? user.name.split(" ")[0] : "";

  return <div className="wk-app">
    {mobileNav && <button className="wk-nav-scrim" aria-label={w.closeMenu} onClick={() => setMobileNav(false)} />}
    <aside className={`wk-sidebar ${mobileNav ? "is-open" : ""}`}>
      <a href="/" className="wk-brand"><img src="/logo.svg" alt="" width={35} height={35} /><span>LIVKA<span>MARKET</span><small>YOUR AI. YOUR WAY.</small></span></a>
      <div className="wk-nav-group"><span className="wk-nav-label">{w.navMarket}</span><button className={`wk-nav-item ${section === "catalog" ? "active" : ""}`} onClick={() => navigate("catalog")}><LayoutGrid size={19} /><span>{w.navCatalog}</span><i>{products.length}</i></button></div>
      <div className="wk-nav-group"><span className="wk-nav-label">{w.navPersonal}</span>
        <button className={`wk-nav-item ${section === "wallet" ? "active" : ""}`} onClick={() => navigate("wallet")}><Wallet size={19} /><span>{w.navWallet}</span><span className="wk-new">NEW</span></button>
        <button className={`wk-nav-item ${section === "purchases" ? "active" : ""}`} onClick={() => navigate("purchases")}><ShoppingBag size={19} /><span>{w.navPurchases}</span></button>
        <button className={`wk-nav-item ${section === "history" ? "active" : ""}`} onClick={() => navigate("history")}><ArrowLeftRight size={19} /><span>{w.navHistory}</span></button>
        <button className="wk-nav-item" onClick={() => { if (user) { setProfileOpen(true); setMobileNav(false); } else askAuth("profile"); }}><Settings2 size={19} /><span>{w.navSettings}</span></button>
        {user?.role === "admin" && <a className="wk-nav-item wk-admin-link" href="/admin"><ShieldCheck size={19} /><span>LIVKA CONTROL</span><ArrowUpRight size={14} /></a>}
      </div>
      <div className="wk-sidebar-bottom"><div className="wk-help-card"><span className="wk-help-icon"><Headphones size={21} /></span><h3>{w.helpTitle}</h3><p>{w.helpText}</p><a href="https://t.me/livkamarket" target="_blank" rel="noreferrer">{w.helpBtn} <ArrowUpRight size={15} /></a></div>
        <button className="wk-nav-item wk-help-nav" onClick={() => { setRulesOpen(true); setMobileNav(false); }}><HelpCircle size={18} /><span>{w.helpRules}</span><ArrowUpRight size={14} /></button>
        <div className="wk-sidebar-account"><button onClick={() => user ? setProfileOpen(true) : askAuth("profile")}><span className="wk-avatar">{user ? user.name[0].toUpperCase() : <CircleUserRound size={22} />}</span><span><b>{user ? firstName : w.yourAccount}</b><small>{user ? user.customerId ?? w.personalArea : w.signInToStart}</small></span></button>{user && <button className="wk-icon-button" aria-label={w.logoutAria} onClick={logout}><LogOut size={16} /></button>}</div>
      </div>
    </aside>

    <div className="wk-workspace"><header className="wk-topbar"><div className="wk-breadcrumb"><button className="wk-icon-button wk-mobile-toggle" aria-label={w.openMenu} onClick={() => setMobileNav(true)}><Menu size={21} /></button><span className="wk-breadcrumb-parent">{w.personalArea}</span><ChevronRight size={13} /><strong>{w.sections[section]}</strong></div><div className="wk-topbar-right"><LangSwitch /><a className="wk-top-support" href="https://t.me/livkamarket" target="_blank" rel="noreferrer"><Headphones size={16} />{w.support} <ArrowUpRight size={13} /></a><button className="wk-user-button" onClick={() => user ? setProfileOpen(true) : askAuth("login")}>{user ? <span className="wk-avatar small">{user.name[0].toUpperCase()}</span> : <CircleUserRound size={18} />}<span>{user ? firstName : w.signIn}</span>{user && <ChevronDown size={13} />}</button></div></header>

      <main className="wk-main"><div className="wk-page-heading"><div><div className="wk-eyebrow"><span />{w.eyebrow}</div><h1>{section === "wallet" ? w.myWallet : w.sections[section]}</h1><p>{w.subtitles[section]}</p></div><button className="wk-button wk-secondary wk-terms-button" onClick={() => setRulesOpen(true)}><ShieldCheck size={16} />{w.terms} <ArrowUpRight size={14} /></button></div>
      {loadError && <div className="wk-loading-error"><WalletErrorBox error={loadError} /><button className="wk-button wk-secondary" onClick={refresh}>{w.retry}</button></div>}

      {section === "wallet" && <>
        <div className="wk-wallet-grid"><section className="wk-balance-card" aria-label={w.balanceAria}><div className="wk-card-orbit" aria-hidden="true" /><img className="wk-wallet-art" src="/images/wallet-3d.png" alt="" /><div className="wk-card-top"><span><span className="wk-logo-star">✦</span> LIVKA BALANCE</span><span className="wk-currency">USD</span></div><div className="wk-balance-content"><div className="wk-balance-label">{w.availableBalance}<button aria-label={hidden ? w.showBalance : w.hideBalance} onClick={() => setHidden(!hidden)}>{hidden ? <EyeOff size={16} /> : <Eye size={16} />}</button></div><div className="wk-balance-number"><span className="wk-cur-pre">$</span>{hidden ? "••••••" : (wallet.balanceCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div><p>{w.balanceTagline}</p><div className="wk-balance-actions"><button className="wk-button wk-light" onClick={openTopUp}><Plus size={18} />{w.topUp}</button><button className="wk-button wk-glass" onClick={openWithdrawal}><ArrowUpRight size={18} />{w.withdraw}</button></div></div><div className="wk-card-bottom"><span><ShieldCheck size={14} />{w.balanceProtected}</span><span className="wk-card-dots">● ● ●</span></div></section>
          <section className="wk-quick-card"><div className="wk-card-title"><h2>{w.quickTopUp}</h2><span><Zap size={16} /></span></div><form onSubmit={(e) => { e.preventDefault(); openTopUp(); }}><AmountInput value={quickAmount} onChange={setQuickAmount} id="quick-topup-amount" /><Presets value={quickAmount} onChange={setQuickAmount} /><AssetSelect value={asset} onChange={setAsset} id="quick-topup-asset" /><button className="wk-button wk-primary wk-full" disabled={parseMoney(quickAmount) < WALLET_RULES.minDepositCents || parseMoney(quickAmount) > WALLET_RULES.maxDepositCents} type="submit">{w.continue} <ArrowRight size={17} /></button><p className="wk-caption"><LockKeyhole size={12} />{w.noFee}</p></form></section>
        </div>
        <div className="wk-stats"><Stat icon={<ArrowUpRight size={19} />} color="mint" label={w.statWithdrawable} amount={showBalance(wallet.withdrawableCents)} caption={w.statWithdrawableCap} onInfo={() => setRulesOpen(true)} /><Stat icon={<Clock3 size={19} />} color="amber" label={w.statHeld} amount={showBalance(wallet.heldCents)} caption={w.statHeldCap} onInfo={() => setRulesOpen(true)} /><Stat icon={<ShoppingBag size={19} />} color="violet" label={w.statSpent} amount={showBalance(wallet.spentCents)} caption={w.statSpentCap} /></div>
        <div className="wk-history-grid"><HistoryPanel wallet={wallet} onTopUp={openTopUp} onOpen={setOperation} onExpand={() => navigate("history")} /><aside className="wk-how-card"><div className="wk-how-heading"><span className="wk-mini-icon"><Sparkles size={18} /></span><div><h2>{w.howTitle}</h2><p>{w.howSub}</p></div></div><ol>{w.steps.map((step, i) => <li key={step.title}><span>{i === 3 ? <Check size={14} /> : `0${i + 1}`}</span><div><b>{step.title}</b><p>{step.desc}</p></div></li>)}</ol><button onClick={() => navigate("catalog")}>{w.howBtn} <ArrowRight size={15} /></button></aside></div>
        <section className="wk-recommendations"><div className="wk-section-heading"><div><span className="wk-tiny-eyebrow">{w.recEyebrow}</span><h2>{w.recTitle}</h2></div><button className="wk-text-button" onClick={() => navigate("catalog")}>{w.allCatalog} <ArrowRight size={15} /></button></div><div className="wk-product-strip">{products.map((p) => <button className="wk-product-mini" key={p.id} onClick={() => buy(p)}><ProductTile product={p} size={44} /><div><h3>{t.products[p.slug as keyof typeof t.products]?.name ?? p.slug}</h3><span>{isTokenProduct(p) ? tokenPriceText : `${w.from} ${money(p.priceCents)}`}</span></div><ArrowUpRight size={17} /></button>)}</div></section>
      </>}

      {section === "history" && <HistoryPanel wallet={wallet} onTopUp={openTopUp} onOpen={setOperation} expanded />}
      {section === "catalog" && <><div className="wk-catalog-banner"><div><span className="wk-small-badge">{w.bannerBadge}</span><h2>{w.bannerT1}<br /><span>{w.bannerT2}</span></h2><p>{w.bannerText}</p><button className="wk-button wk-light" onClick={openTopUp}><Plus size={17} />{w.topUp}</button></div><div className="wk-catalog-orbit" aria-hidden="true">{products.slice(0, 3).map((p) => <ProductTile key={p.id} product={p} size={80} />)}</div></div><div className="wk-catalog-toolbar"><h2>{w.allProducts} <span>{products.length}</span></h2><label className="wk-search"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={w.searchPh} aria-label={w.searchAria} /></label></div><div className="wk-catalog-grid">{filteredProducts.map((p) => { const pd = t.products[p.slug as keyof typeof t.products]; return <article className="wk-catalog-product" key={p.id}><div className="wk-product-top"><ProductTile product={p} size={64} /><span className="wk-small-badge">{pd?.badge ?? "AI"}</span></div><h3>{pd?.name ?? p.slug}</h3><p>{pd?.tagline}</p><ul>{pd?.features.slice(0, 3).map((feature) => <li key={feature}><Check size={14} />{feature}</li>)}</ul>{isTokenProduct(p) ? (
            <div className="wk-claude-offer">
              <div className="wk-claude-offer-price"><strong>{tokenPriceText}</strong></div>
              <div className="wk-claude-offer-bank"><span className="wk-claude-stock-dot" />{w.tokens.bankLine(bankText)}</div>
              <button className="wk-button wk-secondary wk-claude-buy" onClick={() => buy(p)}>{w.buy} <ArrowRight size={17} /></button>
            </div>
          ) : (
            <div className="wk-product-price"><div><b>{money(p.priceCents)}</b><span>{t.per[p.per as keyof typeof t.per]}</span></div><button className="wk-button wk-secondary" onClick={() => buy(p)}>{w.buy} <ArrowUpRight size={16} /></button></div>
          )}</article>; })}</div>{filteredProducts.length === 0 && <div className="wk-empty"><Search size={32} /><h3>{w.nothingFound}</h3><p>{w.tryOther}</p><button className="wk-text-button" onClick={() => setSearch("")}>{w.resetSearch}</button></div>}</>}
      {section === "purchases" && <PurchasesPanel user={user} version={version} tokens={tokens} onBuyTokens={() => { const p = products.find(isTokenProduct); if (p) buy(p); }} onCatalog={() => navigate("catalog")} onLogin={() => askAuth("purchases")} />}

      <div className="wk-bottom-note"><ShieldCheck size={17} /><p><strong>{w.noteStrong}</strong> {w.noteText}</p><button onClick={() => setRulesOpen(true)}>{w.more} <ArrowUpRight size={13} /></button></div>
      <footer className="wk-footer"><span>© 2026 LIVKAMARKET</span><div><span className="wk-online-dot" />{w.footerTagline}</div><a href="https://t.me/livkamarket" target="_blank" rel="noreferrer"><Send size={13} />{w.inTelegram}</a></footer>
      </main>
    </div>

    {authOpen && <AuthModal open reason={afterAuth === "purchase" ? w.authPurchase : w.authDefault} onClose={() => { setAuthOpen(false); setAfterAuth(null); setPendingProduct(null); }} onSuccess={onAuth} />}
    {profileOpen && user && <ProfileModal open user={user} onClose={() => setProfileOpen(false)} onOrders={() => { setProfileOpen(false); navigate("purchases"); }} onLogout={logout} onUserUpdate={setUser} />}
    {topUp && user && <TopUpModal wallet={wallet} initialAmount={quickAmount} initialAsset={asset} existing={resumeDeposit} onClose={() => { setTopUp(false); setResumeDeposit(null); }} onUpdate={topUpUpdated} />}
    {withdraw && user && <WithdrawModal wallet={wallet} onClose={() => setWithdraw(false)} onUpdate={updated} />}
    {operation && <OperationModal operation={operation} wallet={wallet} onClose={() => setOperation(null)} onUpdate={updated} onPay={(op) => { setOperation(null); setResumeDeposit(op); setTopUp(true); }} onOrders={() => { setOperation(null); navigate("purchases"); }} />}
    {rulesOpen && <WalletRulesModal onClose={() => setRulesOpen(false)} />}
    {buying && <BalanceCheckout product={buying} onClose={() => setBuying(null)} onOpenOrders={() => navigate("purchases")} onTopUp={(missing) => { setPendingProduct(buying); setBuying(null); setQuickAmount(String(Math.min(MAX_TOPUP, Math.max(MIN_TOPUP, Math.ceil(missing / 100))))); setResumeDeposit(null); setTopUp(true); }} onPurchased={() => { void refresh(); setVersion((n) => n + 1); }} />}
    {buyingTokens && <TokenCheckout product={buyingTokens} onClose={() => setBuyingTokens(null)} onOpenOrders={() => navigate("purchases")} onTopUp={(missing) => { setPendingProduct(buyingTokens); setBuyingTokens(null); setQuickAmount(String(Math.min(MAX_TOPUP, Math.max(MIN_TOPUP, Math.ceil(missing / 100))))); setResumeDeposit(null); setTopUp(true); }} onPurchased={() => { void refresh(); setVersion((n) => n + 1); }} />}
    {toast && <div className="wk-toast" role="status"><CircleCheck size={18} /><span>{toast}</span><button onClick={() => setToast(null)} aria-label={w.closeWindow}><X size={15} /></button></div>}
  </div>;
}

function Stat({ icon, color, label, amount, caption, onInfo }: { icon: React.ReactNode; color: string; label: string; amount: string; caption: string; onInfo?: () => void }) {
  const { w } = useW();
  return <div className="wk-stat"><span className={`wk-stat-icon ${color}`}>{icon}</span><div><span className="wk-stat-label">{label}{onInfo && <button aria-label={w.moreAbout(label)} onClick={onInfo}><HelpCircle size={12} /></button>}</span><b>{amount}</b><small>{caption}</small></div><span className="wk-stat-decoration" /></div>;
}

function HistoryPanel({ wallet, onTopUp, onOpen, onExpand, expanded = false }: { wallet: WalletSnapshot; onTopUp: () => void; onOpen: (op: WalletOperation) => void; onExpand?: () => void; expanded?: boolean }) {
  const { w, t, intl } = useW();
  const [filter, setFilter] = useState("all"), [period, setPeriod] = useState("all"), [page, setPage] = useState(0);
  const list = useMemo(() => wallet.operations.filter((op) => (filter === "all" || op.kind === filter) && (period === "all" || new Date(op.createdAt).getTime() >= Date.now() - Number(period) * 86400_000)), [wallet.operations, filter, period]);
  const size = expanded ? 10 : 5, current = Math.min(page, Math.max(0, Math.ceil(list.length / size) - 1));
  const visible = list.slice(current * size, current * size + size);
  const exportCsv = () => {
    const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const lines = [w.csvHead, ...list.map((o) => [o.createdAt, w.kind[o.kind], opTitle(o, w, t), w.status[o.status], (o.amountCents / 100).toFixed(2), (o.feeCents / 100).toFixed(2)])];
    const url = URL.createObjectURL(new Blob(["\uFEFF" + lines.map((row) => row.map(escape).join(";")).join("\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `livka-operations-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  const filters: [string, string][] = [["all", w.fAll], ["deposit", w.fDeposit], ["purchase", w.fPurchase], ["withdrawal", w.fWithdrawal]];
  return <section className={`wk-history-card ${expanded ? "is-expanded" : ""}`}><div className="wk-history-heading"><h2>{w.historyTitle} <span>{wallet.operations.length}</span></h2><button className="wk-export" onClick={exportCsv} disabled={!list.length} aria-label={w.exportAria} title={w.exportTitle}><Download size={15} /><span>{w.exportBtn}</span></button></div>
    <div className="wk-history-toolbar"><div className="wk-tabs" role="tablist" aria-label={w.typeAria}>{filters.map(([id, label]) => <button role="tab" aria-selected={filter === id} className={filter === id ? "active" : ""} key={id} onClick={() => { setFilter(id); setPage(0); }}>{label}</button>)}</div><select aria-label={w.periodAria} value={period} onChange={(e) => { setPeriod(e.target.value); setPage(0); }}><option value="all">{w.pAll}</option><option value="30">{w.p30}</option><option value="7">{w.p7}</option></select></div>
    <div className="wk-history-columns"><span>{w.colOperation}</span><span>{w.colDate}</span><span>{w.colStatus}</span><span>{w.colAmount}</span></div>
    {!visible.length ? <div className="wk-empty"><div className="wk-empty-art"><ReceiptText size={32} strokeWidth={1.3} /><span><Plus size={13} /></span></div><h3>{wallet.operations.length ? w.emptyFiltered : w.emptyNew}</h3><p>{wallet.operations.length ? w.emptyFilteredHint : w.emptyNewHint}</p>{wallet.operations.length ? <button className="wk-text-button" onClick={() => { setFilter("all"); setPeriod("all"); }}>{w.showAllOps} <ArrowRight size={14} /></button> : <button className="wk-text-button" onClick={onTopUp}>{w.firstTopUp} <ArrowRight size={14} /></button>}</div> : <div className="wk-history-rows">{visible.map((op) => <button className="wk-history-row" key={op.id} onClick={() => onOpen(op)}><span className="wk-history-operation"><span className={`wk-operation-icon ${op.kind}`}>{op.kind === "deposit" ? <ArrowDownLeft size={17} /> : op.kind === "purchase" ? <ShoppingBag size={17} /> : op.kind === "adjustment" ? <Plus size={17} /> : <ArrowUpRight size={17} />}</span><span><b>{opTitle(op, w, t)}</b><small>{opMethod(op, w)}</small></span></span><span className="wk-history-date">{new Date(op.createdAt).toLocaleDateString(intl, { day: "numeric", month: "short" })}<small>{new Date(op.createdAt).toLocaleTimeString(intl, { hour: "2-digit", minute: "2-digit" })}</small></span><span className={`wk-status ${op.status}`}>{w.status[op.status]}</span><span className={`wk-history-amount ${(op.kind === "deposit" || op.kind === "adjustment") && op.status === "completed" ? "wk-green" : ""}`}>{op.kind === "deposit" || op.kind === "adjustment" ? "+" : "−"}{money(op.amountCents)}<ChevronRight size={13} /></span></button>)}</div>}
    <div className="wk-history-footer"><span>{list.length ? w.pageInfo(current * size + 1, Math.min((current + 1) * size, list.length), list.length) : w.allInOnePlace}</span>{list.length > size ? <div><button disabled={current === 0} aria-label={w.prevPage} onClick={() => setPage(current - 1)}><ChevronLeft size={16} /></button><button disabled={(current + 1) * size >= list.length} aria-label={w.nextPage} onClick={() => setPage(current + 1)}><ChevronRight size={16} /></button></div> : onExpand ? <button onClick={onExpand}>{w.fullHistory} <ArrowRight size={13} /></button> : <ShieldCheck size={14} />}</div>
  </section>;
}

type SavedOrder = { orderNo: number; secret: string; status: string; totalCents: number; productSlug: string; credentials: string | null; createdAt: string; networkLabel: string };
function PurchasesPanel({ user, version, tokens, onBuyTokens, onCatalog, onLogin }: { user: SessionUser | null; version: number; tokens: TokenSnapshot; onBuyTokens: () => void; onCatalog: () => void; onLogin: () => void }) {
  const { w, t, intl } = useW();
  const [rows, setRows] = useState<SavedOrder[] | null>(null), [error, setError] = useState<string | null>(null), [selected, setSelected] = useState<SavedOrder | null>(null), [copied, setCopied] = useState(false), [revealed, setRevealed] = useState(false);
  const load = useCallback(() => {
    if (!user) { setRows([]); return; }
    setError(null);
    walletRequest<{ orders: SavedOrder[] }>("/api/order/mine").then((d) => setRows(d.orders)).catch((e) => setError(errorMessage(e)));
  }, [user]);
  useEffect(() => { load(); }, [load, version]);
  if (error) return <div className="wk-history-card wk-form"><WalletErrorBox error={error} /><button className="wk-button wk-secondary" onClick={load}>{w.tryAgain}</button></div>;
  if (rows === null) return <div className="wk-empty"><Busy text={w.loadingPurchases} /></div>;
  const name = (slug: string) => t.products[slug as keyof typeof t.products]?.name ?? slug;
  const ownedTokens = tokens.models.filter((m) => { const b = balanceOf(tokens, m.slug); return b.inputTokens + b.outputTokens > 0; });
  return <>{user && (ownedTokens.length > 0 || tokens.apiKey) && <section className="wk-token-balances">
      <div className="wk-section-heading"><div><span className="wk-tiny-eyebrow">CLAUDE API</span><h2>{w.tokens.balanceTitle}</h2></div><button className="wk-text-button" onClick={onBuyTokens}>{w.tokens.buyMore} <ArrowRight size={15} /></button></div>
      <div className="wk-token-cards">{(ownedTokens.length ? ownedTokens : tokens.models.filter((m) => m.isActive)).map((m) => { const b = balanceOf(tokens, m.slug); return <article key={m.slug}><header><b>{m.label}</b>{!m.isActive && <span>{w.tokens.soon}</span>}</header><div><span>{w.tokens.currentBalance}</span><b>{formatTokens(b.inputTokens + b.outputTokens, intl)}</b></div></article>; })}</div>
      {tokens.apiKey && <div className="wk-token-key"><span>{w.tokens.apiKey}</span><code>{tokens.apiKey}</code><button onClick={async () => { try { await navigator.clipboard.writeText(tokens.apiKey ?? ""); } catch { /* noop */ } }}><Copy size={14} />{w.tokens.copyKey}</button></div>}
    </section>}
    <div className="wk-purchases-grid">{rows.length ? rows.map((order) => <article className="wk-purchase-card" key={order.secret}><div><span className="wk-mini-icon"><ShoppingBag size={22} /></span><span className="wk-small-badge">{order.status === "delivered" ? w.accessReceived : w.processingBadge}</span></div><h3>{name(order.productSlug)}</h3><p>{w.orderNo(order.orderNo)} · {new Date(order.createdAt).toLocaleDateString(intl)}</p><div className="wk-purchase-bottom"><b>{money(order.totalCents)}</b><button className="wk-button wk-secondary" onClick={() => { setSelected(order); setCopied(false); setRevealed(false); }}>{w.open} <ArrowUpRight size={15} /></button></div></article>) : <div className="wk-empty wk-empty-purchases"><div className="wk-empty-art"><ShoppingBag size={34} strokeWidth={1.3} /></div><h3>{w.purchasesEmptyTitle}</h3><p>{user ? w.purchasesEmptyUser : w.purchasesEmptyGuest}</p><button className="wk-button wk-primary" onClick={user ? onCatalog : onLogin}>{user ? w.openCatalog : w.signInAccount}<ArrowRight size={16} /></button></div>}</div>
    {selected && <WalletModal title={name(selected.productSlug)} subtitle={w.orderNo(selected.orderNo)} onClose={() => setSelected(null)}><div className="wk-credentials"><div><span>{w.credentials}</span><button onClick={() => setRevealed(!revealed)}>{revealed ? <EyeOff size={16} /> : <Eye size={16} />}{revealed ? w.hide : w.show}</button></div><pre>{revealed ? selected.credentials ?? w.notIssued : "••••••••••••••••••••••••\n••••••••••••••••••••••••"}</pre></div><button className="wk-button wk-primary wk-full" disabled={!selected.credentials} onClick={async () => { try { await navigator.clipboard.writeText(selected.credentials ?? ""); setCopied(true); } catch { setRevealed(true); } }}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? w.copied : w.copyAccess}</button></WalletModal>}
  </>;
}
