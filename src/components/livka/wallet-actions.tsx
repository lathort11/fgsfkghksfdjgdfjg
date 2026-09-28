"use client";

import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ArrowRight, Check, CheckCheck, Clock3, Copy, ExternalLink, Info, ShieldCheck, Wallet, X, CircleCheck, ShoppingBag } from "lucide-react";
import { CryptoBadge } from "@/components/livka/icons";
import { WalletModal, WalletErrorBox, DemoNotice, SummaryRow, Busy, walletRequest, useRequestKey, errorMessage } from "@/components/livka/wallet-primitives";
import { money, parseMoney, withdrawalFee, WALLET_RULES as rules, type WalletSnapshot, type WalletOperation } from "@/lib/wallet-shared";

export type ActionResult = { ok: boolean; operation: WalletOperation; wallet: WalletSnapshot };
export const statusText: Record<string, string> = { pending: "Ожидает", processing: "В обработке", completed: "Успешно", cancelled: "Отменено", rejected: "Отклонено", expired: "Истёк срок" };
export const kindText: Record<string, string> = { deposit: "Пополнение", purchase: "Покупка", withdrawal: "Вывод средств" };

export function AmountInput({ value, onChange, label = "Сумма пополнения", id = "topup-amount" }: { value: string; onChange: (s: string) => void; label?: string; id?: string }) {
  return <div className="wk-amount-field"><label htmlFor={id}>{label}</label><div><input id={id} inputMode="decimal" autoComplete="off" value={value} onChange={(e) => onChange(e.target.value.replace(/[^\d.,\s]/g, "").slice(0, 12))} placeholder="1 000" /><span>₽</span></div></div>;
}
export function Presets({ value, onChange }: { value: string; onChange: (s: string) => void }) { return <div className="wk-presets">{[500, 1000, 3000, 5000].map((n) => <button type="button" key={n} className={parseMoney(value) === n * 100 ? "is-active" : ""} onClick={() => onChange(String(n))}>{n.toLocaleString("ru-RU")} ₽</button>)}</div>; }
export function AssetSelect({ value, onChange, id = "deposit-asset" }: { value: string; onChange: (s: string) => void; id?: string }) {
  return <div className="wk-asset-field"><label htmlFor={id}>Способ пополнения</label><div className="wk-asset-select"><CryptoBadge asset={value} className="w-8 h-8" /><select id={id} value={value} onChange={(e) => onChange(e.target.value)}>{["USDT", "TON", "BTC", "ETH"].map((coin) => <option key={coin} value={coin}>{coin} · Crypto Pay</option>)}</select><span className="wk-select-tag">CRYPTO</span></div></div>;
}

export function TopUpModal({ wallet, initialAmount = "1000", initialAsset = "USDT", existing, onClose, onUpdate }: { wallet: WalletSnapshot; initialAmount?: string; initialAsset?: string; existing?: WalletOperation | null; onClose: () => void; onUpdate: (w: WalletSnapshot, done?: boolean) => void }) {
  const [value, setValue] = useState(initialAmount);
  const [asset, setAsset] = useState(initialAsset);
  const [invoice, setInvoice] = useState<WalletOperation | null>(existing ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [generation, setGeneration] = useState(0);
  const key = useRequestKey();
  const cents = parseMoney(value);
  const complete = invoice?.status === "completed";
  const demo = wallet.mode === "demo";
  const create = async () => {
    setError(null); setBusy(true);
    try {
      const input = { amountCents: cents, asset };
      const result = await walletRequest<ActionResult>("/api/wallet", { action: "deposit", ...input, idempotencyKey: key({ ...input, generation }) });
      setInvoice(result.operation); onUpdate(result.wallet);
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  const confirm = async () => {
    if (!invoice) return;
    setBusy(true); setError(null); setWaiting(false);
    try {
      const result = await walletRequest<ActionResult>("/api/wallet", { action: "confirm-deposit", operationId: invoice.id });
      setInvoice(result.operation); onUpdate(result.wallet);
      setWaiting(result.operation.status === "pending");
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  useEffect(() => {
    if (demo || !invoice || invoice.status !== "pending") return;
    const timer = setInterval(() => {
      walletRequest<ActionResult>("/api/wallet", { action: "confirm-deposit", operationId: invoice.id }).then((result) => { setInvoice(result.operation); onUpdate(result.wallet); }).catch(() => {});
    }, 15000);
    return () => clearInterval(timer);
  }, [demo, invoice?.id, invoice?.status, onUpdate]);
  return <WalletModal title={complete ? "Баланс пополнен" : "Пополнить баланс"} subtitle={complete ? "Всё готово для вашей следующей покупки." : "Один перевод — сколько угодно возможностей."} onClose={onClose}>
    {demo && <DemoNotice />}
    {complete ? <div className="wk-success"><div className="wk-success-icon"><CheckCheck size={30} /></div><div className="wk-success-amount">+{money(invoice.amountCents)}</div><p>{demo ? "Тестовые средства" : "Средства"} уже на вашем балансе.<br />Выберите продукт и подтвердите покупку.</p><button className="wk-button wk-primary wk-full" onClick={() => onUpdate(wallet, true)}>Перейти к покупкам <ArrowRight size={17} /></button></div> : !invoice ? <form onSubmit={(e) => { e.preventDefault(); void create(); }} className="wk-form">
      <AmountInput value={value} onChange={setValue} id="modal-deposit-amount" /><Presets value={value} onChange={setValue} />
      <p className="wk-field-hint">От {money(rules.minDepositCents)} до {money(rules.maxDepositCents)} за один раз</p>
      <AssetSelect value={asset} onChange={setAsset} id="modal-deposit-asset" />
      <div className="wk-summary"><SummaryRow label="Комиссия сервиса">0 ₽</SummaryRow><SummaryRow label="Будет зачислено" strong>{money(cents)}</SummaryRow></div>
      <WalletErrorBox error={error} /><button type="submit" className="wk-button wk-primary wk-full" disabled={busy || cents < rules.minDepositCents || cents > rules.maxDepositCents}>{busy ? <Busy /> : <>Продолжить <ArrowRight size={17} /></>}</button>
      <p className="wk-caption"><ShieldCheck size={13} /> {demo ? "Без списания реальных денег" : "Платёж защищён Crypto Pay. Комиссия сети — отдельно."}</p>
    </form> : <div className="wk-form">
      <div className="wk-invoice-icon"><Wallet size={30} /></div><div className="wk-invoice-amount">{money(invoice.amountCents)} <small>к зачислению</small></div>
      <div className="wk-summary"><SummaryRow label="Способ">{invoice.method}</SummaryRow><SummaryRow label="Статус"><span className={`wk-status ${invoice.status}`}>{statusText[invoice.status]}</span></SummaryRow><SummaryRow label="Комиссия сервиса">0 ₽</SummaryRow></div>
      <p className="wk-muted">{demo ? "Нажмите кнопку ниже, чтобы протестировать пополнение. Никакой криптовалюты отправлять не нужно." : "Оплатите счёт в Crypto Pay. Баланс обновится только после подтверждения платежа провайдером."}</p>
      {invoice.paymentUrl && invoice.status === "pending" && <a className="wk-button wk-primary wk-full" href={invoice.paymentUrl} target="_blank" rel="noopener noreferrer">Перейти к оплате <ExternalLink size={16} /></a>}
      <WalletErrorBox error={error} />
      {waiting && <div className="wk-info"><Clock3 size={17} /> Платёж ещё не подтверждён. Проверяем каждые 15 секунд.</div>}
      {invoice.status === "pending" ? <button className={`wk-button ${demo ? "wk-primary" : "wk-secondary"} wk-full`} disabled={busy} onClick={confirm}>{busy ? <Busy text="Проверяем…" /> : demo ? "Зачислить тестовые средства" : "Проверить платёж"}</button> : <button className="wk-button wk-secondary wk-full" onClick={() => { setInvoice(null); setError(null); setGeneration((n) => n + 1); }}>Создать новое пополнение</button>}
    </div>}
  </WalletModal>;
}

export function WithdrawModal({ wallet, onClose, onUpdate }: { wallet: WalletSnapshot; onClose: () => void; onUpdate: (w: WalletSnapshot) => void }) {
  const [value, setValue] = useState("1000");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [review, setReview] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [result, setResult] = useState<WalletOperation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = useRequestKey();
  const cents = parseMoney(value), fee = withdrawalFee(cents), net = Math.max(0, cents - fee);
  const valid = cents >= rules.minWithdrawalCents && cents <= wallet.withdrawableCents && cents <= rules.dailyWithdrawalCents && /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address.trim());
  const demo = wallet.mode === "demo";
  const send = async () => {
    setBusy(true); setError(null);
    try {
      const input = { amountCents: cents, address: address.trim(), expectedFeeCents: fee, confirmed: true };
      const res = await walletRequest<ActionResult>("/api/wallet", { action: "withdraw", ...input, password, idempotencyKey: key(input) });
      setResult(res.operation); setPassword(""); onUpdate(res.wallet);
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  return <WalletModal title={result ? "Заявка создана" : review ? "Подтвердите вывод" : "Вывести средства"} subtitle="Прозрачные условия. Никаких скрытых комиссий." onClose={onClose}>
    {demo && <DemoNotice />}
    {result ? <div className="wk-success"><div className="wk-success-icon amber"><Clock3 size={30} /></div><h3>На проверке</h3><p>{demo ? "Создана тестовая заявка. Реальные деньги не отправляются." : "Сумма зарезервирована. Поддержка проверит заявку и согласует выплату."}</p><div className="wk-summary"><SummaryRow label="Зарезервировано">{money(result.amountCents)}</SummaryRow><SummaryRow label="Комиссия">{money(result.feeCents)}</SummaryRow><SummaryRow label="К получению" strong>{money(result.amountCents - result.feeCents)}</SummaryRow></div><p className="wk-caption">Отменить заявку и вернуть резерв можно в истории.</p><button className="wk-button wk-primary wk-full" onClick={onClose}>Понятно <Check size={17} /></button></div> : <form className="wk-form" onSubmit={(e) => { e.preventDefault(); if (review) void send(); else { setReview(true); setError(null); } }}>
      {!review ? <><div className="wk-withdrawable"><span>Доступно к выводу</span><b>{money(wallet.withdrawableCents)}</b></div>
        <AmountInput value={value} onChange={setValue} label="Сумма списания" id="withdraw-amount" />
        <p className="wk-field-hint">От 1 000 ₽ · до 50 000 ₽ за 24 часа</p>
        <label className="wk-label" htmlFor="withdraw-address">Ваш кошелёк USDT <span>TRC-20</span></label><input id="withdraw-address" className="wk-input wk-mono" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="T…" maxLength={50} autoComplete="off" />
        <p className="wk-field-hint">Только ваш собственный кошелёк в сети TRON (TRC-20).</p>
        {demo && <button className="wk-text-button" type="button" onClick={() => setAddress("T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb")}>Подставить адрес для тестовой заявки</button>}
      </> : <div className="wk-review-address"><span>Получатель · USDT / TRC-20</span><code>{address}</code><button type="button" onClick={() => setReview(false)}>Изменить реквизиты</button></div>}
      <div className="wk-summary"><SummaryRow label="Списывается с баланса">{money(cents)}</SummaryRow><SummaryRow label="Комиссия · 5%, минимум 100 ₽">{money(fee)}</SummaryRow><SummaryRow label="К получению" strong>{money(net)}</SummaryRow></div>
      <div className="wk-info"><ShieldCheck size={18} /><span>{demo ? "В демо-режиме доступны тестовая заявка и её отмена. Выплата не производится." : "Вывод после проверки личности и через 24 часа после пополнения. Эквивалент в USDT согласуется поддержкой до выплаты."}</span></div>
      {!demo && wallet.verification !== "verified" && <p className="wk-field-hint">Для проверки личности <a href="https://t.me/livkamarket" target="_blank" rel="noreferrer">напишите в поддержку ↗</a>. Комиссия не заменяет AML/KYC-проверку.</p>}
      {review && <>{!demo && <><label className="wk-label" htmlFor="withdraw-password">Подтвердите паролем аккаунта</label><input className="wk-input" type="password" id="withdraw-password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></>}<label className="wk-check"><input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} /><span>Кошелёк принадлежит мне. Реквизиты и комиссию {money(fee)} подтверждаю.</span></label></>}
      <WalletErrorBox error={error} />
      <button className="wk-button wk-primary wk-full" disabled={busy || !valid || (review && (!accepted || (!demo && !password)))} type="submit">{busy ? <Busy /> : review ? <>Подтвердить вывод <ArrowUpRight size={17} /></> : <>Продолжить <ArrowRight size={17} /></>}</button>
      {cents > wallet.withdrawableCents && <p className="wk-caption">Недостаточно доступных средств для этой суммы.</p>}
    </form>}
  </WalletModal>;
}

export function OperationModal({ operation, wallet, onClose, onUpdate, onPay, onOrders }: { operation: WalletOperation; wallet: WalletSnapshot; onClose: () => void; onUpdate: (w: WalletSnapshot) => void; onPay: (op: WalletOperation) => void; onOrders: () => void }) {
  const [op, setOp] = useState(operation), [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false), [copied, setCopied] = useState(false), [confirmCancel, setConfirmCancel] = useState(false);
  const cancel = async () => {
    setBusy(true); setError(null);
    try { const r = await walletRequest<ActionResult>("/api/wallet", { action: "cancel", operationId: op.id }); setOp(r.operation); onUpdate(r.wallet); setConfirmCancel(false); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  return <WalletModal title={kindText[op.kind]} subtitle={op.description} onClose={onClose}>
    <div className="wk-operation-hero"><span className={`wk-operation-icon ${op.kind}`}>{op.kind === "deposit" ? <ArrowDownLeft /> : op.kind === "purchase" ? <ShoppingBag /> : op.kind === "adjustment" ? <Check /> : <ArrowUpRight />}</span><h3>{op.kind === "deposit" || op.kind === "adjustment" ? "+" : "−"}{money(op.amountCents)}</h3><span className={`wk-status ${op.status}`}>{statusText[op.status]}</span></div>
    <div className="wk-summary"><SummaryRow label="Дата">{new Date(op.createdAt).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</SummaryRow><SummaryRow label="Способ">{op.method}</SummaryRow>{op.kind === "withdrawal" && <><SummaryRow label="Комиссия">{money(op.feeCents)}</SummaryRow><SummaryRow label="К получению" strong>{money(op.amountCents - op.feeCents)}</SummaryRow></>}</div>
    {op.address && <div className="wk-review-address"><span>Адрес получателя</span><code>{op.address}</code></div>}
    <button className="wk-copy-id" onClick={async () => { try { await navigator.clipboard.writeText(op.id); setCopied(true); } catch { setError("Не удалось скопировать. Выделите номер вручную."); } }}><span>Операция <code>{op.id}</code></span>{copied ? <Check size={15} /> : <Copy size={15} />}</button>
    {op.reference && <p className="wk-muted wk-break">Результат проверки: {op.reference}</p>}
    <WalletErrorBox error={error} />
    {op.kind === "deposit" && op.status === "pending" && <button className="wk-button wk-primary wk-full" onClick={() => onPay(op)}>Продолжить пополнение <ArrowRight size={16} /></button>}
    {op.kind === "purchase" && <button className="wk-button wk-primary wk-full" onClick={onOrders}>Открыть мои покупки <ArrowRight size={16} /></button>}
    {op.status === "pending" && (op.kind === "withdrawal" || (op.kind === "deposit" && wallet.mode === "demo")) && <div className="wk-cancel-block">{confirmCancel ? <><p>Отменить {op.kind === "withdrawal" ? "заявку и вернуть весь резерв на баланс" : "пополнение"}?</p><div className="wk-two-buttons"><button className="wk-button wk-secondary" onClick={() => setConfirmCancel(false)}>Оставить</button><button className="wk-button wk-danger" disabled={busy} onClick={cancel}>{busy ? <Busy /> : "Да, отменить"}</button></div></> : <button className="wk-button wk-secondary wk-full" onClick={() => setConfirmCancel(true)}><X size={16} /> Отменить {op.kind === "withdrawal" ? "заявку" : "пополнение"}</button>}</div>}
  </WalletModal>;
}

export function WalletRulesModal({ onClose }: { onClose: () => void }) {
  return <WalletModal title="Всё прозрачно" subtitle="Правила кошелька и комиссии — без мелкого шрифта." onClose={onClose}>
    <div className="wk-rules-list">
      <article><span><ArrowDownLeft size={20} /></span><div><h3>Пополнение без комиссии сервиса</h3><p>От 100 до 50 000 ₽. Кошелёк учитывается в рублях. Криптовалюту принимает Crypto Pay; возможная комиссия сети показывается у провайдера. Зачисление — только после проверки платежа.</p></div></article>
      <article><span><ShoppingBag size={20} /></span><div><h3>Покупка в одно подтверждение</h3><p>Выберите продукт, проверьте итог и подтвердите списание. Доступ сохраняется в «Моих покупках». Комиссия за покупку — 0 ₽.</p></div></article>
      <article><span><ArrowUpRight size={20} /></span><div><h3>Вывод: 5%, минимум 100 ₽</h3><p>От 1 000 ₽, до 50 000 ₽ за последние 24 часа. Комиссия удерживается из указанной суммы: при выводе 5 000 ₽ к получению — 4 750 ₽. В реальном режиме — эквивалент в USDT / TRC-20, согласованный до выплаты.</p></div></article>
      <article><span><ShieldCheck size={20} /></span><div><h3>Безопасность важнее скорости</h3><p>Реальный вывод требует проверки личности, подтверждения паролем и ожидания 24 часов после пополнения. Только на собственный кошелёк. Заявка проверяется вручную; сроки зависят от результатов проверки.</p></div></article>
      <article><span><CircleCheck size={20} /></span><div><h3>Отменили — получили резерв обратно</h3><p>До начала обработки заявку можно отменить в истории. Вся сумма вместе с комиссией возвращается на баланс. Комиссия сама по себе не является защитой от отмывания денег.</p></div></article>
    </div><div className="wk-info"><Info size={18} /><span>Демо-кошелёк полностью отделён от реального: тестовые средства и доступы не имеют денежной стоимости и не выводятся.</span></div>
    <a className="wk-button wk-secondary wk-full" href="https://t.me/livkamarket" target="_blank" rel="noreferrer">Остались вопросы? Напишите нам <ExternalLink size={15} /></a>
  </WalletModal>;
}
