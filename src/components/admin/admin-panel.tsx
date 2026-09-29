"use client";

import { useState } from "react";
import {
  Activity, ArrowLeft, Ban, Box, Check, ChevronLeft, ChevronRight, CircleDollarSign,
  Copy, Eye, EyeOff, Gift, LayoutDashboard, LoaderCircle, LockKeyhole, LogOut, Menu, PackageCheck,
  Plus, Search, ShieldCheck, Sparkles, Tag, TrendingUp, Unlock, UsersRound, WalletCards, X,
} from "lucide-react";
import type { SafeUser } from "@/lib/session";
import type { AdminDashboardData, AdminUserRow } from "@/lib/admin";
import { money, parseMoney } from "@/lib/wallet-shared";
import { WalletModal } from "@/components/livka/wallet-primitives";
import { useA } from "@/components/livka/i18n-context";
import { LangSwitch } from "@/components/livka/lang-switch";
import { ProductsPanel } from "@/components/admin/admin-products";
import { RevenuePanel } from "@/components/admin/admin-revenue";
import type { AdminDict } from "@/lib/admin-i18n";

type Tab = "overview" | "income" | "users" | "products" | "audit";
type Action = "ban" | "unban" | "credit" | "grant-product";
const TABS: Tab[] = ["overview", "income", "users", "products", "audit"];

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "SERVER");
  return data as T;
}
const codeOf = (error: unknown) => (error instanceof Error ? error.message : "SERVER");

export default function AdminPanel({ initialUser, initialData }: { initialUser: SafeUser | null; initialData: AdminDashboardData | null }) {
  if (!initialUser) return <AdminLogin />;
  if (initialUser.role !== "admin") return <AccessDenied user={initialUser} />;
  if (!initialData) return <AccessDenied user={initialUser} />;
  return <Dashboard admin={initialUser} initialData={initialData} />;
}

function AdminLogin() {
  const { a } = useA();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsRole, setNeedsRole] = useState<{ id: string; email: string } | null>(null);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(null); setNeedsRole(null);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "CREDS");
      if (data.user?.role !== "admin") { setNeedsRole({ id: data.user?.customerId ?? "LVK-??????", email: data.user?.email ?? email }); return; }
      location.reload();
    } catch (e) {
      setError(codeOf(e) === "ACCOUNT_BANNED" ? "errBanned" : codeOf(e) === "RATE_LIMIT" ? "errRate" : "errCreds");
    } finally { setBusy(false); }
  };
  return <main className="ad-gate"><LangSwitch className="ad-gate-lang" /><a className="ad-back" href="/"><ArrowLeft size={15} />{a.backToSite}</a><section className="ad-login-card"><div className="ad-login-mark"><ShieldCheck size={27} /></div><span className="ad-kicker">LIVKA CONTROL</span><h1>{a.loginTitle}</h1><p>{a.loginSub}</p>{needsRole && <div className="ad-role-hint"><UsersRound size={17} /><span>{a.roleHintA} <b>{needsRole.id}</b> {a.roleHintB}</span></div>}<form onSubmit={submit}><label htmlFor="admin-email">{a.emailLabel}</label><input id="admin-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /><label htmlFor="admin-password">{a.passwordLabel}</label><input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />{error && <div className="ad-error">{error === "errBanned" ? a.errBanned : error === "errRate" ? a.errRate : a.errCreds}</div>}<button disabled={busy} type="submit">{busy ? <><LoaderCircle className="ad-spin" size={17} />{a.checking}</> : <><LockKeyhole size={17} />{a.loginBtn}</>}</button></form><ol className="ad-steps">{a.loginSteps.map((step, i) => <li key={step}><span>0{i + 1}</span>{step}</li>)}</ol><div className="ad-secure"><ShieldCheck size={14} />{a.secure}</div></section></main>;
}

function AccessDenied({ user }: { user: SafeUser }) {
  const { a } = useA();
  const logout = async () => { await fetch("/api/auth/logout", { method: "POST" }); location.reload(); };
  return <main className="ad-gate"><LangSwitch className="ad-gate-lang" /><section className="ad-login-card"><div className="ad-login-mark danger"><LockKeyhole size={27} /></div><span className="ad-kicker">{a.deniedKicker}</span><h1>{a.deniedTitle}</h1><p>{a.deniedA} <b>{user.customerId}</b> {a.deniedB}</p><div className="ad-gate-actions"><a href="/"><ArrowLeft size={15} />{a.toSite}</a><button onClick={logout}><LogOut size={15} />{a.logout}</button></div></section></main>;
}

function Dashboard({ admin, initialData }: { admin: SafeUser; initialData: AdminDashboardData }) {
  const { a } = useA();
  const [data, setData] = useState(initialData);
  const [tab, setTab] = useState<Tab>("overview");
  const [query, setQuery] = useState(initialData.query);
  const [mobile, setMobile] = useState(false);
  const [selected, setSelected] = useState<AdminUserRow | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [amount, setAmount] = useState("50");
  const [productId, setProductId] = useState(initialData.products.find((p) => p.active && p.kind !== "tokens")?.id ?? "");
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const errText = (code: string | null) => (code ? a.errors[code] ?? a.errorDefault : null);

  const load = async (q = query, page = 1) => {
    setLoading(true); setError(null);
    try { setData(await request<AdminDashboardData>(`/api/admin?q=${encodeURIComponent(q)}&page=${page}`)); }
    catch (e) { setError(codeOf(e)); } finally { setLoading(false); }
  };
  const open = (user: AdminUserRow, next: Action) => {
    setSelected(user); setAction(next); setError(null); setReason(""); setAdminPassword(""); setAmount("50");
    setProductId(data.products.find((p) => p.active && p.kind !== "tokens")?.id ?? ""); setRequestKey(crypto.randomUUID());
  };
  const perform = async () => {
    if (!selected || !action) return;
    setBusy(true); setError(null);
    const body: Record<string, unknown> = { action, adminPassword };
    if (action === "ban") body.reason = reason;
    if (action === "credit") { body.amountCents = parseMoney(amount); body.note = reason; body.idempotencyKey = requestKey; }
    if (action === "grant-product") { body.productId = productId; body.note = reason; }
    try {
      await request(`/api/admin/users/${selected.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      setToast(a.toast[action]);
      setAction(null); setSelected(null); await load(data.query, data.page);
    } catch (e) { setError(codeOf(e)); } finally { setBusy(false); }
  };
  const logout = async () => { await fetch("/api/auth/logout", { method: "POST" }); location.assign("/admin"); };
  const recent = data.users.slice(0, 6);
  const go = (next: Tab) => { setTab(next); setMobile(false); };
  const icons: Record<Tab, React.ReactNode> = { overview: <LayoutDashboard size={18} />, income: <TrendingUp size={18} />, users: <UsersRound size={18} />, products: <Box size={18} />, audit: <Activity size={18} /> };
  const badge: Partial<Record<Tab, string>> = { users: String(data.stats.users), products: `${data.stats.productsActive}/${data.stats.productsTotal}` };

  return <div className="ad-app">{mobile && <button className="ad-scrim" aria-label={a.closeMenu} onClick={() => setMobile(false)} />}
    <aside className={`ad-sidebar ${mobile ? "open" : ""}`}><a href="/admin" className="ad-brand"><img src="/logo.svg" alt="" /><span>LIVKA<b>CONTROL</b><small>ADMIN WORKSPACE</small></span></a><nav><span>{a.navLabel}</span>{TABS.map((id) => <button key={id} className={tab === id ? "active" : ""} onClick={() => go(id)}>{icons[id]}{a.tab[id]}{badge[id] && <i>{badge[id]}</i>}</button>)}</nav><div className="ad-sidebar-bottom"><div className="ad-mode"><span />{a.liveMode}</div><a href="/"><ArrowLeft size={16} />{a.backToSite}</a><button onClick={logout}><LogOut size={16} />{a.endSession}</button><div className="ad-admin"><span>{admin.name[0].toUpperCase()}</span><div><b>{admin.name}</b><small>{admin.customerId}</small></div><ShieldCheck size={16} /></div></div></aside>
    <div className="ad-workspace"><header><button className="ad-menu" aria-label={a.openMenu} onClick={() => setMobile(true)}><Menu size={20} /></button><div><span>{a.panelLabel}</span><strong>{a.tab[tab]}</strong></div><div className="ad-header-right"><LangSwitch /><div className="ad-header-status"><span />{a.systemOk}</div></div></header>
      <main><div className="ad-heading"><div><span className="ad-kicker">LIVKAMARKET · CONTROL CENTER</span><h1>{a.heading[tab]}</h1><p>{a.subtitle[tab]}</p></div>{(tab === "overview" || tab === "users") && <form className="ad-search" onSubmit={(e) => { e.preventDefault(); setTab("users"); void load(query, 1); }}><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={a.searchPh} /><button disabled={loading}>{loading ? <LoaderCircle className="ad-spin" size={16} /> : a.find}</button></form>}</div>
      {error && !action && <div className="ad-error ad-page-error">{errText(error)}<button onClick={() => load(data.query, data.page)}>{a.retry}</button></div>}
      {tab === "overview" && <Overview data={data} users={recent} onUsers={() => setTab("users")} onIncome={() => setTab("income")} onAction={open} />}
      {tab === "income" && <RevenuePanel revenue={data.revenue} />}
      {tab === "users" && <UsersTable data={data} loading={loading} onAction={open} onPage={(page) => load(data.query, page)} />}
      {tab === "products" && <ProductsPanel products={data.products} tokenModels={data.tokenModels} onChanged={async (text) => { setToast(text); await load(data.query, data.page); }} />}
      {tab === "audit" && <Audit data={data} />}
      <footer><span>© 2026 LIVKAMARKET CONTROL</span><span><ShieldCheck size={13} />{a.footerRight}</span></footer></main>
    </div>
    {action && selected && <ActionModal action={action} user={selected} products={data.products} reason={reason} setReason={setReason} adminPassword={adminPassword} setAdminPassword={setAdminPassword} amount={amount} setAmount={setAmount} productId={productId} setProductId={setProductId} busy={busy} error={errText(error)} onClose={() => { setAction(null); setSelected(null); setError(null); }} onConfirm={perform} />}
    {toast && <div className="ad-toast" role="status"><Check size={17} />{toast}<button aria-label={a.closeToast} onClick={() => setToast(null)}><X size={14} /></button></div>}
  </div>;
}

function Overview({ data, users, onUsers, onIncome, onAction }: { data: AdminDashboardData; users: AdminUserRow[]; onUsers: () => void; onIncome: () => void; onAction: (u: AdminUserRow, a: Action) => void }) {
  const { a, intl } = useA();
  const cards = [
    { label: a.cIncome, value: money(data.revenue.totalCents, true), note: a.cIncomeNote(money(data.revenue.monthCents, true)), icon: <CircleDollarSign />, tone: "amber", onClick: onIncome },
    { label: a.cUsers, value: data.stats.users.toLocaleString(intl), note: a.activeN(data.stats.active), icon: <UsersRound />, tone: "violet" },
    { label: a.cBalance, value: money(data.stats.balanceCents, true), note: a.cBalanceNote, icon: <WalletCards />, tone: "mint" },
    { label: a.cOrders, value: data.stats.orders.toLocaleString(intl), note: a.grantedN(data.stats.granted), icon: <PackageCheck />, tone: "blue" },
    { label: a.cBanned, value: data.stats.banned.toLocaleString(intl), note: a.cBannedNote, icon: <Ban />, tone: "rose" },
  ];
  return <><section className="ad-stats ad-stats-5">{cards.map((card) => <article key={card.label} className={card.onClick ? "clickable" : ""} onClick={card.onClick}><span className={card.tone}>{card.icon}</span><div><small>{card.label}</small><b>{card.value}</b><p>{card.note}</p></div></article>)}</section><section className="ad-grid"><div className="ad-card"><div className="ad-card-head"><div><span>{a.recentEyebrow}</span><h2>{a.newUsers}</h2></div><button onClick={onUsers}>{a.allUsers} <ChevronRight size={14} /></button></div><MiniUsers users={users} onAction={onAction} /></div><div className="ad-card ad-quick"><div className="ad-card-head"><div><span>{a.quickEyebrow}</span><h2>{a.quickTitle}</h2></div><Sparkles size={20} /></div><ol>{a.quick.map((step, i) => <li key={step.t}><span>{i === 3 ? <Check size={13} /> : `0${i + 1}`}</span><div><b>{step.t}</b><p>{step.p}</p></div></li>)}</ol></div></section></>;
}

function StatusPill({ status, tag = "span" }: { status: "active" | "banned"; tag?: "span" | "i" }) {
  const { a } = useA();
  const Tag = tag;
  return <Tag className={`ad-status ${status}`}>{status === "active" ? a.sActive : a.sBanned}</Tag>;
}

function MiniUsers({ users, onAction }: { users: AdminUserRow[]; onAction: (u: AdminUserRow, a: Action) => void }) {
  const { a } = useA();
  if (!users.length) return <div className="ad-empty">{a.noUsers}</div>;
  return <div className="ad-mini-users">{users.map((u) => <div key={u.id}><UserIdentity user={u} /><StatusPill status={u.status} /><b>{money(u.balanceCents)}</b><button title={a.creditTitle} onClick={() => onAction(u, "credit")}><Plus size={15} /></button></div>)}</div>;
}

function UsersTable({ data, loading, onAction, onPage }: { data: AdminDashboardData; loading: boolean; onAction: (u: AdminUserRow, a: Action) => void; onPage: (p: number) => void }) {
  const { a, intl } = useA();
  return <section className={`ad-card ad-users ${loading ? "loading" : ""}`}><div className="ad-card-head"><div><span>{a.usersEyebrow}</span><h2>{data.query ? a.results(data.query) : a.allUsers} <i>{data.totalUsers}</i></h2></div></div><div className="ad-table"><div className="ad-tr ad-th">{a.cols.map((c) => <span key={c}>{c}</span>)}</div>{data.users.map((user) => <div className="ad-tr" key={user.id}><UserIdentity user={user} /><span><StatusPill status={user.status} tag="i" />{user.role === "admin" && <i className="ad-role">ADMIN</i>}</span><span className="ad-money"><b>{money(user.balanceCents)}</b>{user.heldCents > 0 && <small>{a.heldNote(money(user.heldCents))}</small>}</span><span><b>{user.ordersCount}</b><small>{a.spentNote(money(user.spentCents))}</small></span><span className="ad-date">{new Date(user.createdAt).toLocaleDateString(intl, { day: "2-digit", month: "short", year: "numeric" })}</span><span className="ad-actions"><button title={a.creditTitle} disabled={user.status === "banned"} onClick={() => onAction(user, "credit")}><CircleDollarSign size={16} /></button><button title={a.grantTitle} disabled={user.status === "banned"} onClick={() => onAction(user, "grant-product")}><Gift size={16} /></button>{user.role !== "admin" && (user.status === "active" ? <button className="danger" title={a.banTitle} onClick={() => onAction(user, "ban")}><Ban size={16} /></button> : <button className="success" title={a.unbanTitle} onClick={() => onAction(user, "unban")}><Unlock size={16} /></button>)}</span></div>)}</div>{!data.users.length && <div className="ad-empty"><Search size={28} /><b>{a.nothingFound}</b><p>{a.nothingHint}</p></div>}<div className="ad-pagination"><span>{a.pageOf(data.page, data.pages)}</span><div><button aria-label={a.prev} disabled={data.page <= 1 || loading} onClick={() => onPage(data.page - 1)}><ChevronLeft size={17} /></button><button aria-label={a.next} disabled={data.page >= data.pages || loading} onClick={() => onPage(data.page + 1)}><ChevronRight size={17} /></button></div></div></section>;
}

function UserIdentity({ user }: { user: AdminUserRow }) {
  const [copied, setCopied] = useState(false);
  return <span className="ad-user"><span className="ad-avatar">{user.name[0]?.toUpperCase()}</span><span><b>{user.name}</b><small>{user.email}</small><button onClick={async () => { await navigator.clipboard.writeText(user.customerId); setCopied(true); setTimeout(() => setCopied(false), 1200); }}>{user.customerId}{copied ? <Check size={11} /> : <Copy size={11} />}</button></span></span>;
}

function Audit({ data }: { data: AdminDashboardData }) {
  const { a, t, intl } = useA();
  return <section className="ad-card ad-audit"><div className="ad-card-head"><div><span>{a.auditEyebrow}</span><h2>{a.auditTitle}</h2></div><ShieldCheck size={19} /></div>{data.audit.length ? <div className="ad-audit-list">{data.audit.map((item) => <article key={item.id}><span className={`ad-audit-icon ${auditTone(item.action)}`}>{auditIcon(item.action)}</span><div><h3>{a.auditLabels[item.action] ?? item.action}</h3><p><b>{item.actor}</b> · {item.actorCustomerId}{item.target && <> → <b>{item.target}</b> · {item.targetCustomerId}</>}</p><small>{auditDetails(item.details, a, t)}</small></div><time>{new Date(item.createdAt).toLocaleString(intl, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</time></article>)}</div> : <div className="ad-empty"><Activity size={28} /><b>{a.auditEmpty}</b><p>{a.auditEmptyHint}</p></div>}</section>;
}

function ActionModal(props: { action: Action; user: AdminUserRow; products: AdminDashboardData["products"]; reason: string; setReason: (s: string) => void; adminPassword: string; setAdminPassword: (s: string) => void; amount: string; setAmount: (s: string) => void; productId: string; setProductId: (s: string) => void; busy: boolean; error: string | null; onClose: () => void; onConfirm: () => void }) {
  const { a, t } = useA();
  const { action, user, products, reason, setReason, adminPassword, setAdminPassword, amount, setAmount, productId, setProductId, busy, error, onClose, onConfirm } = props;
  const cents = parseMoney(amount);
  const actionValid = action === "unban" || action === "ban" && reason.trim().length >= 5 || action === "credit" && cents >= 100 && cents <= 500_000 && reason.trim().length >= 3 || action === "grant-product" && !!productId && reason.trim().length >= 3;
  const valid = actionValid && adminPassword.length > 0;
  return <WalletModal title={a.action[action]} subtitle={`${user.name} · ${user.customerId}`} onClose={onClose}><div className="ad-confirm-user"><span className="ad-avatar">{user.name[0]?.toUpperCase()}</span><div><b>{user.name}</b><p>{user.email}</p></div><StatusPill status={user.status} /></div>{action === "ban" && <div className="ad-warning"><Ban size={18} /><span>{a.banWarn}</span></div>}{action === "unban" && <div className="ad-info"><Unlock size={18} /><span>{a.unbanInfo}</span></div>}{action === "credit" && <><label className="ad-field">{a.creditAmount}<div><input autoFocus inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, "").slice(0, 10))} /><span>$</span></div></label><div className="ad-credit-summary"><span>{a.currentBalance} <b>{money(user.balanceCents)}</b></span><span>{a.afterCredit} <b>{money(user.balanceCents + cents)}</b></span></div></>}{action === "grant-product" && <label className="ad-field">{a.productLbl}<select value={productId} onChange={(e) => setProductId(e.target.value)}>{products.filter((p) => p.active && p.kind !== "tokens").map((p) => <option key={p.id} value={p.id}>{t.products[p.slug as keyof typeof t.products]?.name ?? p.title} · {a.inStock(p.stock)}</option>)}</select></label>}{action !== "unban" && <label className="ad-field">{action === "ban" ? a.banReason : a.note}<textarea autoFocus={action !== "credit"} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder={action === "ban" ? a.banPh : a.notePh} /></label>}<label className="ad-field">{a.adminConfirm}<input className="ad-password-confirm" type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} autoComplete="current-password" placeholder={a.passPh} /></label><div className="ad-modal-note"><ShieldCheck size={15} />{a.modalNote}</div>{error && <div className="ad-error">{error}</div>}<div className="ad-modal-actions"><button className="ad-cancel" onClick={onClose}>{a.cancel}</button><button className={action === "ban" ? "ad-submit danger" : "ad-submit"} onClick={onConfirm} disabled={!valid || busy}>{busy ? <><LoaderCircle className="ad-spin" size={16} />{a.working}</> : action === "ban" ? <><Ban size={16} />{a.doBan}</> : action === "unban" ? <><Unlock size={16} />{a.doUnban}</> : action === "credit" ? <><Plus size={16} />{a.doCredit(money(cents))}</> : <><Gift size={16} />{a.doGrant}</>}</button></div></WalletModal>;
}

function auditIcon(action: string) {
  if (action === "balance.credited") return <CircleDollarSign />;
  if (action === "product.granted") return <Gift />;
  if (action === "product.price_changed") return <Tag />;
  if (action === "product.enabled") return <Eye />;
  if (action === "product.disabled") return <EyeOff />;
  if (action === "user.banned") return <Ban />;
  if (action === "user.unbanned") return <Unlock />;
  return <Activity />;
}
function auditTone(action: string) {
  if (action === "user.banned" || action === "authorization.denied" || action === "product.disabled") return "danger";
  if (action === "user.unbanned" || action === "product.enabled") return "success";
  return "";
}
function auditDetails(details: Record<string, unknown>, a: AdminDict, t: { products: Record<string, { name?: string } | undefined> }) {
  const note = typeof details.note === "string" && details.note ? ` · ${details.note}` : "";
  const slug = typeof details.productSlug === "string" ? details.productSlug : "";
  const title = t.products[slug]?.name ?? String(details.productTitle ?? slug);
  if (typeof details.reason === "string") return `${a.reasonPrefix}${details.reason}`;
  if (typeof details.amountCents === "number") return `${money(details.amountCents)} · ${String(details.note ?? a.creditWord)}`;
  if (typeof details.oldPriceCents === "number" && typeof details.newPriceCents === "number") return `${title}: ${money(details.oldPriceCents)} → ${money(details.newPriceCents)}${note}`;
  if (typeof details.orderNo === "number") return `${title} · ${a.orderWord(details.orderNo)}`;
  if (typeof details.priceCents === "number" && title) return `${title} · ${money(details.priceCents)}${note}`;
  if (typeof details.path === "string") return `${details.method} ${details.path}`;
  return a.systemRecord;
}
