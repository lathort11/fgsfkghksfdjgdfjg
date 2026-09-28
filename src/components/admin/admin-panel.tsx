"use client";

import { useMemo, useState } from "react";
import {
  Activity, ArrowLeft, Ban, Box, Check, ChevronLeft, ChevronRight, CircleDollarSign,
  Copy, Eye, EyeOff, Gift, LayoutDashboard, LoaderCircle, LockKeyhole, LogOut, Menu, PackageCheck,
  Plus, Search, ShieldCheck, Sparkles, Tag, Unlock, UserRoundCheck, UsersRound, WalletCards, X,
} from "lucide-react";
import type { SafeUser } from "@/lib/session";
import type { AdminDashboardData, AdminUserRow } from "@/lib/admin";
import { money, parseMoney } from "@/lib/wallet-shared";
import { WalletModal } from "@/components/livka/wallet-primitives";
import { ProductsPanel } from "@/components/admin/admin-products";

type Tab = "overview" | "users" | "products" | "audit";
const tabTitle: Record<Tab, string> = { overview: "Обзор", users: "Пользователи", products: "Продукты", audit: "Журнал действий" };
const tabHeading: Record<Tab, string> = { overview: "Добро пожаловать", users: "Пользователи", products: "Продукты", audit: "Аудит действий" };
const tabSubtitle: Record<Tab, string> = {
  overview: "Ключевые показатели и быстрые действия — в одном месте.",
  users: "Управляйте доступом, балансами и выдачами пользователей.",
  products: "Цены и видимость товаров. Скрытый продукт нельзя купить, история заказов сохраняется.",
  audit: "Хронология административных изменений без чувствительных данных.",
};
type Action = "ban" | "unban" | "credit" | "grant-product";
const actionTitle: Record<Action, string> = {
  ban: "Заблокировать пользователя", unban: "Снять блокировку",
  credit: "Начислить баланс", "grant-product": "Выдать товар",
};
const auditLabels: Record<string, string> = {
  "user.banned": "Пользователь заблокирован", "user.unbanned": "Пользователь разблокирован",
  "balance.credited": "Баланс начислен", "product.granted": "Товар выдан",
  "authorization.denied": "Отказ в админ-доступе",
  "product.price_changed": "Цена продукта изменена", "product.enabled": "Продукт включён в продажу",
  "product.disabled": "Продукт убран из продажи",
};
const errorLabels: Record<string, string> = {
  AUTH: "Сессия истекла. Войдите снова.", FORBIDDEN: "Недостаточно прав.", REASON_REQUIRED: "Укажите причину минимум из 5 символов.",
  NOTE_REQUIRED: "Добавьте комментарий минимум из 3 символов.", INVALID_AMOUNT: "Сумма должна быть от 1 до 50 000 ₽.",
  USER_BANNED: "Сначала разблокируйте пользователя.", ADMIN_PROTECTED: "Аккаунт администратора защищён от этого действия.",
  ADMIN_PASSWORD_REQUIRED: "Введите текущий пароль администратора.", ADMIN_PASSWORD_WRONG: "Неверный пароль администратора.", ADMIN_CONFIRM_LOCKED: "Слишком много неверных паролей. Подождите 15 минут.",
  BALANCE_LIMIT: "Начисление превысит максимальный баланс.", OUT_OF_STOCK: "На складе нет свободного доступа к этому товару.",
  PRODUCT_NOT_FOUND: "Товар недоступен.", RATE_LIMIT: "Слишком много действий. Подождите минуту.",
};

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "SERVER");
  return data as T;
}

export default function AdminPanel({ initialUser, initialData }: { initialUser: SafeUser | null; initialData: AdminDashboardData | null }) {
  if (!initialUser) return <AdminLogin />;
  if (initialUser.role !== "admin") return <AccessDenied user={initialUser} />;
  if (!initialData) return <AccessDenied user={initialUser} />;
  return <Dashboard admin={initialUser} initialData={initialData} />;
}

function AdminLogin() {
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
      const code = e instanceof Error ? e.message : "CREDS";
      setError(code === "ACCOUNT_BANNED" ? "Аккаунт заблокирован." : code === "RATE_LIMIT" ? "Слишком много попыток. Повторите через 15 минут." : "Неверный email или пароль.");
    } finally { setBusy(false); }
  };
  return <main className="ad-gate"><a className="ad-back" href="/"><ArrowLeft size={15} />Вернуться на сайт</a><section className="ad-login-card"><div className="ad-login-mark"><ShieldCheck size={27} /></div><span className="ad-kicker">LIVKA CONTROL</span><h1>Вход администратора</h1><p>Защищённая зона управления пользователями и операциями.</p>{needsRole && <div className="ad-role-hint"><UsersRound size={17} /><span>Аккаунт <b>{needsRole.id}</b> авторизован, но роль admin не назначена. Выдайте роль в базе данных и обновите страницу.</span></div>}<form onSubmit={submit}><label htmlFor="admin-email">Email администратора</label><input id="admin-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /><label htmlFor="admin-password">Пароль</label><input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />{error && <div className="ad-error">{error}</div>}<button disabled={busy} type="submit">{busy ? <><LoaderCircle className="ad-spin" size={17} />Проверяем…</> : <><LockKeyhole size={17} />Войти в панель</>}</button></form><ol className="ad-steps"><li><span>01</span>Зарегистрируйтесь на сайте как обычный пользователь</li><li><span>02</span>Выдайте роль admin вручную в базе данных</li><li><span>03</span>Войдите здесь с тем же email и паролем</li></ol><div className="ad-secure"><ShieldCheck size={14} />Все действия администратора записываются в журнал.</div></section></main>;
}

function AccessDenied({ user }: { user: SafeUser }) {
  const logout = async () => { await fetch("/api/auth/logout", { method: "POST" }); location.reload(); };
  return <main className="ad-gate"><section className="ad-login-card"><div className="ad-login-mark danger"><LockKeyhole size={27} /></div><span className="ad-kicker">ДОСТУП ОГРАНИЧЕН</span><h1>Нет прав администратора</h1><p>Аккаунт <b>{user.customerId}</b> успешно авторизован, но не имеет роли admin.</p><div className="ad-gate-actions"><a href="/"><ArrowLeft size={15} />На сайт</a><button onClick={logout}><LogOut size={15} />Выйти</button></div></section></main>;
}

function Dashboard({ admin, initialData }: { admin: SafeUser; initialData: AdminDashboardData }) {
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
  const [amount, setAmount] = useState("1000");
  const [productId, setProductId] = useState(initialData.products.find((p) => p.active)?.id ?? "");
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());

  const load = async (q = query, page = 1) => {
    setLoading(true); setError(null);
    try { setData(await request<AdminDashboardData>(`/api/admin?q=${encodeURIComponent(q)}&page=${page}`)); }
    catch (e) { setError(message(e)); } finally { setLoading(false); }
  };
  const open = (user: AdminUserRow, next: Action) => {
    setSelected(user); setAction(next); setError(null); setReason(""); setAdminPassword(""); setAmount("1000");
    setProductId(data.products.find((p) => p.active)?.id ?? ""); setRequestKey(crypto.randomUUID());
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
      setToast(action === "ban" ? "Пользователь заблокирован" : action === "unban" ? "Пользователь разблокирован" : action === "credit" ? "Баланс начислен" : "Товар выдан");
      setAction(null); setSelected(null); await load(data.query, data.page);
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  };
  const logout = async () => { await fetch("/api/auth/logout", { method: "POST" }); location.assign("/admin"); };
  const recent = data.users.slice(0, 6);

  return <div className="ad-app">{mobile && <button className="ad-scrim" aria-label="Закрыть меню" onClick={() => setMobile(false)} />}
    <aside className={`ad-sidebar ${mobile ? "open" : ""}`}><a href="/admin" className="ad-brand"><img src="/logo.svg" alt="" /><span>LIVKA<b>CONTROL</b><small>ADMIN WORKSPACE</small></span></a><nav><span>УПРАВЛЕНИЕ</span><button className={tab === "overview" ? "active" : ""} onClick={() => { setTab("overview"); setMobile(false); }}><LayoutDashboard size={18} />Обзор</button><button className={tab === "users" ? "active" : ""} onClick={() => { setTab("users"); setMobile(false); }}><UsersRound size={18} />Пользователи<i>{data.stats.users}</i></button><button className={tab === "products" ? "active" : ""} onClick={() => { setTab("products"); setMobile(false); }}><Box size={18} />Продукты<i>{data.stats.productsActive}/{data.stats.productsTotal}</i></button><button className={tab === "audit" ? "active" : ""} onClick={() => { setTab("audit"); setMobile(false); }}><Activity size={18} />Журнал действий</button></nav><div className="ad-sidebar-bottom"><div className="ad-mode"><span />{data.mode === "demo" ? "Демонстрационный контур" : "Реальный контур"}</div><a href="/"><ArrowLeft size={16} />Вернуться на сайт</a><button onClick={logout}><LogOut size={16} />Завершить сессию</button><div className="ad-admin"><span>{admin.name[0].toUpperCase()}</span><div><b>{admin.name}</b><small>{admin.customerId}</small></div><ShieldCheck size={16} /></div></div></aside>
    <div className="ad-workspace"><header><button className="ad-menu" aria-label="Открыть меню" onClick={() => setMobile(true)}><Menu size={20} /></button><div><span>ПАНЕЛЬ УПРАВЛЕНИЯ</span><strong>{tabTitle[tab]}</strong></div><div className="ad-header-status"><span />Система работает штатно</div></header>
      <main><div className="ad-heading"><div><span className="ad-kicker">LIVKAMARKET · CONTROL CENTER</span><h1>{tabHeading[tab]}</h1><p>{tabSubtitle[tab]}</p></div>{(tab === "overview" || tab === "users") && <form className="ad-search" onSubmit={(e) => { e.preventDefault(); setTab("users"); void load(query, 1); }}><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Имя, email или LVK-ID" /><button disabled={loading}>{loading ? <LoaderCircle className="ad-spin" size={16} /> : "Найти"}</button></form>}</div>
      {error && !action && <div className="ad-error ad-page-error">{error}<button onClick={() => load(data.query, data.page)}>Повторить</button></div>}
      {tab === "overview" && <Overview data={data} users={recent} onUsers={() => setTab("users")} onAction={open} />}
      {tab === "users" && <UsersTable data={data} loading={loading} onAction={open} onPage={(page) => load(data.query, page)} />}
      {tab === "products" && <ProductsPanel products={data.products} mode={data.mode} onChanged={async (text) => { setToast(text); await load(data.query, data.page); }} />}
      {tab === "audit" && <Audit data={data} />}
      <footer><span>© 2026 LIVKAMARKET CONTROL</span><span><ShieldCheck size={13} />Доступ по роли · серверная проверка · audit trail</span></footer></main>
    </div>
    {action && selected && <ActionModal action={action} user={selected} products={data.products} reason={reason} setReason={setReason} adminPassword={adminPassword} setAdminPassword={setAdminPassword} amount={amount} setAmount={setAmount} productId={productId} setProductId={setProductId} busy={busy} error={error} onClose={() => { setAction(null); setSelected(null); setError(null); }} onConfirm={perform} />}
    {toast && <div className="ad-toast" role="status"><Check size={17} />{toast}<button aria-label="Закрыть уведомление" onClick={() => setToast(null)}><X size={14} /></button></div>}
  </div>;
}

function Overview({ data, users, onUsers, onAction }: { data: AdminDashboardData; users: AdminUserRow[]; onUsers: () => void; onAction: (u: AdminUserRow, a: Action) => void }) {
  const cards = [
    { label: "Всего пользователей", value: data.stats.users.toLocaleString("ru-RU"), note: `${data.stats.active} активных`, icon: <UsersRound />, tone: "violet" },
    { label: `Баланс · ${data.mode}`, value: money(data.stats.balanceCents), note: "сумма доступных средств", icon: <WalletCards />, tone: "mint" },
    { label: "Покупки и выдачи", value: data.stats.orders.toLocaleString("ru-RU"), note: `${data.stats.granted} выдано админом`, icon: <PackageCheck />, tone: "blue" },
    { label: "Заблокировано", value: data.stats.banned.toLocaleString("ru-RU"), note: "с отозванными сессиями", icon: <Ban />, tone: "rose" },
  ];
  return <><section className="ad-stats">{cards.map((card) => <article key={card.label}><span className={card.tone}>{card.icon}</span><div><small>{card.label}</small><b>{card.value}</b><p>{card.note}</p></div></article>)}</section><section className="ad-grid"><div className="ad-card"><div className="ad-card-head"><div><span>ПОСЛЕДНИЕ АККАУНТЫ</span><h2>Новые пользователи</h2></div><button onClick={onUsers}>Все пользователи <ChevronRight size={14} /></button></div><MiniUsers users={users} onAction={onAction} /></div><div className="ad-card ad-quick"><div className="ad-card-head"><div><span>БЫСТРЫЙ СТАРТ</span><h2>Как работать безопасно</h2></div><Sparkles size={20} /></div><ol><li><span>01</span><div><b>Найдите пользователя</b><p>Используйте точный LVK-ID — так меньше риска ошибиться.</p></div></li><li><span>02</span><div><b>Проверьте детали</b><p>Имя, email и текущий статус показываются перед действием.</p></div></li><li><span>03</span><div><b>Оставьте основание</b><p>Причина или комментарий сохраняются в журнале.</p></div></li><li><span><Check size={13} /></span><div><b>Подтвердите результат</b><p>Балансовые изменения проходят через отдельную проводку.</p></div></li></ol></div></section></>;
}

function MiniUsers({ users, onAction }: { users: AdminUserRow[]; onAction: (u: AdminUserRow, a: Action) => void }) {
  if (!users.length) return <div className="ad-empty">Пользователей пока нет.</div>;
  return <div className="ad-mini-users">{users.map((u) => <div key={u.id}><UserIdentity user={u} /><span className={`ad-status ${u.status}`}>{u.status === "active" ? "Активен" : "Заблокирован"}</span><b>{money(u.balanceCents)}</b><button title="Начислить баланс" onClick={() => onAction(u, "credit")}><Plus size={15} /></button></div>)}</div>;
}

function UsersTable({ data, loading, onAction, onPage }: { data: AdminDashboardData; loading: boolean; onAction: (u: AdminUserRow, a: Action) => void; onPage: (p: number) => void }) {
  return <section className={`ad-card ad-users ${loading ? "loading" : ""}`}><div className="ad-card-head"><div><span>БАЗА ПОЛЬЗОВАТЕЛЕЙ</span><h2>{data.query ? `Результаты: «${data.query}»` : "Все пользователи"} <i>{data.totalUsers}</i></h2></div></div><div className="ad-table"><div className="ad-tr ad-th"><span>Пользователь</span><span>Статус</span><span>Баланс</span><span>Покупки</span><span>Регистрация</span><span>Действия</span></div>{data.users.map((user) => <div className="ad-tr" key={user.id}><UserIdentity user={user} /><span><i className={`ad-status ${user.status}`}>{user.status === "active" ? "Активен" : "Заблокирован"}</i>{user.role === "admin" && <i className="ad-role">ADMIN</i>}</span><span className="ad-money"><b>{money(user.balanceCents)}</b>{user.heldCents > 0 && <small>{money(user.heldCents)} в резерве</small>}</span><span><b>{user.ordersCount}</b><small>{money(user.spentCents)} потрачено</small></span><span className="ad-date">{new Date(user.createdAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" })}</span><span className="ad-actions"><button title="Начислить баланс" disabled={user.status === "banned"} onClick={() => onAction(user, "credit")}><CircleDollarSign size={16} /></button><button title="Выдать товар" disabled={user.status === "banned"} onClick={() => onAction(user, "grant-product")}><Gift size={16} /></button>{user.role !== "admin" && (user.status === "active" ? <button className="danger" title="Заблокировать" onClick={() => onAction(user, "ban")}><Ban size={16} /></button> : <button className="success" title="Разблокировать" onClick={() => onAction(user, "unban")}><Unlock size={16} /></button>)}</span></div>)}</div>{!data.users.length && <div className="ad-empty"><Search size={28} /><b>Ничего не найдено</b><p>Проверьте имя, email или публичный ID.</p></div>}<div className="ad-pagination"><span>Страница {data.page} из {data.pages}</span><div><button disabled={data.page <= 1 || loading} onClick={() => onPage(data.page - 1)}><ChevronLeft size={17} /></button><button disabled={data.page >= data.pages || loading} onClick={() => onPage(data.page + 1)}><ChevronRight size={17} /></button></div></div></section>;
}

function UserIdentity({ user }: { user: AdminUserRow }) {
  const [copied, setCopied] = useState(false);
  return <span className="ad-user"><span className="ad-avatar">{user.name[0]?.toUpperCase()}</span><span><b>{user.name}</b><small>{user.email}</small><button onClick={async () => { await navigator.clipboard.writeText(user.customerId); setCopied(true); setTimeout(() => setCopied(false), 1200); }}>{user.customerId}{copied ? <Check size={11} /> : <Copy size={11} />}</button></span></span>;
}

function Audit({ data }: { data: AdminDashboardData }) {
  return <section className="ad-card ad-audit"><div className="ad-card-head"><div><span>APPEND-ONLY ЖУРНАЛ</span><h2>Последние административные действия</h2></div><ShieldCheck size={19} /></div>{data.audit.length ? <div className="ad-audit-list">{data.audit.map((item) => <article key={item.id}><span className={`ad-audit-icon ${auditTone(item.action)}`}>{auditIcon(item.action)}</span><div><h3>{auditLabels[item.action] ?? item.action}</h3><p><b>{item.actor}</b> · {item.actorCustomerId}{item.target && <> → <b>{item.target}</b> · {item.targetCustomerId}</>}</p><small>{auditDetails(item.details)}</small></div><time>{new Date(item.createdAt).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</time></article>)}</div> : <div className="ad-empty"><Activity size={28} /><b>Журнал пока пуст</b><p>Здесь появятся бан, разбан, начисления и выдачи.</p></div>}</section>;
}

function ActionModal(props: { action: Action; user: AdminUserRow; products: AdminDashboardData["products"]; reason: string; setReason: (s: string) => void; adminPassword: string; setAdminPassword: (s: string) => void; amount: string; setAmount: (s: string) => void; productId: string; setProductId: (s: string) => void; busy: boolean; error: string | null; onClose: () => void; onConfirm: () => void }) {
  const { action, user, products, reason, setReason, adminPassword, setAdminPassword, amount, setAmount, productId, setProductId, busy, error, onClose, onConfirm } = props;
  const cents = parseMoney(amount);
  const actionValid = action === "unban" || action === "ban" && reason.trim().length >= 5 || action === "credit" && cents >= 100 && cents <= 5_000_000 && reason.trim().length >= 3 || action === "grant-product" && !!productId && reason.trim().length >= 3;
  const valid = actionValid && adminPassword.length > 0;
  return <WalletModal title={actionTitle[action]} subtitle={`${user.name} · ${user.customerId}`} onClose={onClose}><div className="ad-confirm-user"><span className="ad-avatar">{user.name[0]?.toUpperCase()}</span><div><b>{user.name}</b><p>{user.email}</p></div><span className={`ad-status ${user.status}`}>{user.status === "active" ? "Активен" : "Заблокирован"}</span></div>{action === "ban" && <div className="ad-warning"><Ban size={18} /><span>Все активные сессии пользователя будут немедленно отозваны. Баланс и покупки сохранятся.</span></div>}{action === "unban" && <div className="ad-info"><Unlock size={18} /><span>Пользователь снова сможет войти. Старые сессии не восстановятся.</span></div>}{action === "credit" && <><label className="ad-field">Сумма начисления<div><input autoFocus inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, "").slice(0, 10))} /><span>₽</span></div></label><div className="ad-credit-summary"><span>Текущий баланс <b>{money(user.balanceCents)}</b></span><span>После начисления <b>{money(user.balanceCents + cents)}</b></span></div></>}{action === "grant-product" && <label className="ad-field">Товар<select value={productId} onChange={(e) => setProductId(e.target.value)}>{products.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.title} · {p.stock} на складе</option>)}</select></label>}{action !== "unban" && <label className="ad-field">{action === "ban" ? "Причина блокировки" : "Основание / комментарий"}<textarea autoFocus={action !== "credit"} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder={action === "ban" ? "Например: нарушение правил площадки" : "Например: компенсация по обращению #…"} /></label>}<label className="ad-field">Подтверждение администратора<input className="ad-password-confirm" type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} autoComplete="current-password" placeholder="Ваш текущий пароль" /></label><div className="ad-modal-note"><ShieldCheck size={15} />Действие будет записано от имени {user.customerId === "" ? "администратора" : "текущего администратора"}.</div>{error && <div className="ad-error">{error}</div>}<div className="ad-modal-actions"><button className="ad-cancel" onClick={onClose}>Отмена</button><button className={action === "ban" ? "ad-submit danger" : "ad-submit"} onClick={onConfirm} disabled={!valid || busy}>{busy ? <><LoaderCircle className="ad-spin" size={16} />Выполняем…</> : action === "ban" ? <><Ban size={16} />Заблокировать</> : action === "unban" ? <><Unlock size={16} />Разблокировать</> : action === "credit" ? <><Plus size={16} />Начислить {money(cents)}</> : <><Gift size={16} />Выдать товар</>}</button></div></WalletModal>;
}

function message(error: unknown) { const code = error instanceof Error ? error.message : "SERVER"; return errorLabels[code] ?? "Не удалось выполнить действие. Обновите данные и попробуйте снова."; }
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
function auditDetails(details: Record<string, unknown>) {
  const note = typeof details.note === "string" && details.note ? ` · ${details.note}` : "";
  const title = String(details.productTitle ?? details.productSlug ?? "");
  if (typeof details.reason === "string") return `Причина: ${details.reason}`;
  if (typeof details.amountCents === "number") return `${money(details.amountCents)} · ${String(details.note ?? "начисление")}`;
  if (typeof details.oldPriceCents === "number" && typeof details.newPriceCents === "number") return `${title}: ${money(details.oldPriceCents)} → ${money(details.newPriceCents)}${note}`;
  if (typeof details.orderNo === "number") return `${title} · заказ № ${details.orderNo}`;
  if (typeof details.priceCents === "number" && title) return `${title} · ${money(details.priceCents)}${note}`;
  if (typeof details.path === "string") return `${details.method} ${details.path}`;
  return "Системная запись";
}
