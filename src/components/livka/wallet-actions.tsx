"use client";

import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ArrowRight, Check, CheckCheck, Clock3, Copy, ExternalLink, Info, ShieldCheck, Wallet, X, CircleCheck, ShoppingBag } from "lucide-react";
import { CryptoBadge } from "@/components/livka/icons";
import { useW } from "@/components/livka/i18n-context";
import { WalletModal, WalletErrorBox, SummaryRow, Busy, walletRequest, useRequestKey, errorMessage, opTitle, opMethod } from "@/components/livka/wallet-primitives";
import { money, parseMoney, withdrawalFee, WALLET_RULES as rules, type WalletSnapshot, type WalletOperation } from "@/lib/wallet-shared";

export type ActionResult = { ok: boolean; operation: WalletOperation; wallet: WalletSnapshot };
const PRESETS = [10, 25, 50, 100];

export function AmountInput({ value, onChange, label, id = "topup-amount" }: { value: string; onChange: (s: string) => void; label?: string; id?: string }) {
  const { w } = useW();
  return <div className="wk-amount-field"><label htmlFor={id}>{label ?? w.amountLabel}</label><div><input id={id} inputMode="decimal" autoComplete="off" value={value} onChange={(e) => onChange(e.target.value.replace(/[^\d.,\s]/g, "").slice(0, 12))} placeholder="50" /><span>$</span></div></div>;
}
export function Presets({ value, onChange }: { value: string; onChange: (s: string) => void }) {
  return <div className="wk-presets">{PRESETS.map((n) => <button type="button" key={n} className={parseMoney(value) === n * 100 ? "is-active" : ""} onClick={() => onChange(String(n))}>${n}</button>)}</div>;
}
export function AssetSelect({ value, onChange, id = "deposit-asset" }: { value: string; onChange: (s: string) => void; id?: string }) {
  const { w } = useW();
  const getBadgeTag = (v: string) => {
    if (v === "Crypto Bot") return "CRYPTO BOT";
    return `CRYPTO BOT · ${v}`;
  };

  return (
    <div className="wk-asset-field">
      <label htmlFor={id}>{w.methodLabel}</label>
      <div className="wk-asset-select">
        <CryptoBadge asset={value} className="w-8 h-8" />
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="USDT">USDT · Tether (Crypto Bot)</option>
          <option value="TON">TON · Toncoin (Crypto Bot)</option>
          <option value="BTC">BTC · Bitcoin (Crypto Bot)</option>
          <option value="ETH">ETH · Ethereum (Crypto Bot)</option>
          <option value="LTC">LTC · Litecoin (Crypto Bot)</option>
          <option value="BNB">BNB · Binance Coin (Crypto Bot)</option>
          <option value="TRX">TRX · TRON (Crypto Bot)</option>
          <option value="USDC">USDC · USD Coin (Crypto Bot)</option>
          <option value="Crypto Bot">Crypto Bot · Любая валюта / Any crypto</option>
        </select>
        <span className="wk-select-tag">{getBadgeTag(value)}</span>
      </div>
    </div>
  );
}

export function TopUpModal({
  wallet,
  initialAmount = "50",
  initialAsset = "Crypto Bot",
  existing,
  onClose,
  onUpdate,
}: {
  wallet: WalletSnapshot;
  initialAmount?: string;
  initialAsset?: string;
  existing?: WalletOperation | null;
  onClose: () => void;
  onUpdate: (w: WalletSnapshot, done?: boolean) => void;
}) {
  const { w } = useW();
  const [value, setValue] = useState(initialAmount);
  const [asset, setAsset] = useState(initialAsset);
  const [invoice, setInvoice] = useState<WalletOperation | null>(existing ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const key = useRequestKey();
  const cents = parseMoney(value);
  const complete = invoice?.status === "completed";
  const rejected = invoice?.status === "rejected" || invoice?.status === "cancelled" || invoice?.status === "expired";

  const getSecondsLeft = (createdStr?: string) => {
    if (!createdStr) return 600;
    const elapsed = Math.floor((Date.now() - new Date(createdStr).getTime()) / 1000);
    return Math.max(0, 600 - elapsed);
  };
  const [secondsLeft, setSecondsLeft] = useState(() => (invoice ? getSecondsLeft(invoice.createdAt) : 600));

  const create = async () => {
    setError(null);
    setBusy(true);
    setConfirmCancel(false);
    try {
      const input = { amountCents: cents, asset };
      const result = await walletRequest<ActionResult>("/api/wallet", { action: "deposit", ...input, idempotencyKey: key({ ...input, generation }) });
      setInvoice(result.operation);
      setSecondsLeft(600);
      onUpdate(result.wallet);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!invoice) return;
    setBusy(true);
    setError(null);
    setWaiting(false);
    try {
      const result = await walletRequest<ActionResult>("/api/wallet", { action: "confirm-deposit", operationId: invoice.id });
      setInvoice(result.operation);
      onUpdate(result.wallet);
      setWaiting(result.operation.status === "pending");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!invoice) return;
    setBusy(true);
    setError(null);
    try {
      const result = await walletRequest<ActionResult>("/api/wallet", { action: "cancel", operationId: invoice.id });
      setInvoice(result.operation);
      onUpdate(result.wallet);
      setConfirmCancel(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  // 10-minute timer countdown
  useEffect(() => {
    if (!invoice || invoice.status !== "pending") return;
    setSecondsLeft(getSecondsLeft(invoice.createdAt));

    const countdown = setInterval(() => {
      const remaining = getSecondsLeft(invoice.createdAt);
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        clearInterval(countdown);
        // Automatically expire invoice as rejected
        walletRequest<ActionResult>("/api/wallet", { action: "cancel", operationId: invoice.id })
          .then((res) => {
            setInvoice(res.operation);
            onUpdate(res.wallet);
          })
          .catch(() => {
            setInvoice((prev) => (prev ? { ...prev, status: "rejected" } : null));
          });
      }
    }, 1000);

    return () => clearInterval(countdown);
  }, [invoice?.id, invoice?.status, invoice?.createdAt, onUpdate]);

  // Periodic status poll
  useEffect(() => {
    if (!invoice || invoice.status !== "pending") return;
    const timer = setInterval(() => {
      walletRequest<ActionResult>("/api/wallet", { action: "confirm-deposit", operationId: invoice.id })
        .then((result) => {
          setInvoice(result.operation);
          onUpdate(result.wallet);
        })
        .catch(() => {});
    }, 15000);
    return () => clearInterval(timer);
  }, [invoice?.id, invoice?.status, onUpdate]);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <WalletModal title={complete ? w.topUpDoneTitle : w.topUpTitle} subtitle={complete ? w.topUpDoneSub : w.topUpSub} onClose={onClose}>
      {complete ? (
        <div className="wk-success">
          <div className="wk-success-icon"><CheckCheck size={30} /></div>
          <div className="wk-success-amount">+{money(invoice.amountCents)}</div>
          <p>{w.fundsArrived}<br />{w.fundsNext}</p>
          <button className="wk-button wk-primary wk-full" onClick={() => onUpdate(wallet, true)}>
            {w.goShopping} <ArrowRight size={17} />
          </button>
        </div>
      ) : !invoice ? (
        <form onSubmit={(e) => { e.preventDefault(); void create(); }} className="wk-form">
          <AmountInput value={value} onChange={setValue} id="modal-deposit-amount" />
          <Presets value={value} onChange={setValue} />
          <p className="wk-field-hint">{w.rangeHint(money(rules.minDepositCents), money(rules.maxDepositCents))}</p>
          <AssetSelect value={asset} onChange={setAsset} id="modal-deposit-asset" />
          <div className="wk-summary">
            <SummaryRow label={w.serviceFee}>{money(0)}</SummaryRow>
            <SummaryRow label={w.willCredit} strong>{money(cents)}</SummaryRow>
          </div>
          <WalletErrorBox error={error} />
          <button type="submit" className="wk-button wk-primary wk-full" disabled={busy || cents < rules.minDepositCents || cents > rules.maxDepositCents}>
            {busy ? <Busy /> : <>{w.continue} <ArrowRight size={17} /></>}
          </button>
          <p className="wk-caption"><ShieldCheck size={13} /> {w.secured}</p>
        </form>
      ) : (
        <div className="wk-form">
          <div className="wk-invoice-icon"><Wallet size={30} /></div>
          <div className="wk-invoice-amount">{money(invoice.amountCents)} <small>{w.willCredit}</small></div>
          <div className="wk-summary">
            <SummaryRow label={w.methodLabel}>{invoice.method}</SummaryRow>
            <SummaryRow label={w.colStatus}>
              <span className={`wk-status ${invoice.status}`}>{w.status[invoice.status]}</span>
            </SummaryRow>
            <SummaryRow label={w.serviceFee}>{money(0)}</SummaryRow>
          </div>

          {invoice.status === "pending" && secondsLeft > 0 && (
            <div className={`wk-timer-box ${secondsLeft < 120 ? "urgent" : ""}`}>
              <Clock3 size={18} />
              <div className="wk-timer-content">
                <span>{w.payInvoiceTimer}</span>
                <b className="wk-mono">{mm}:{ss}</b>
              </div>
            </div>
          )}

          {rejected && (
            <div className="wk-error">
              <X size={17} />
              <span>{w.invoiceExpiredNotice}</span>
            </div>
          )}

          {invoice.status === "pending" && secondsLeft > 0 ? (
            <>
              <p className="wk-muted">{w.payInvoiceHint}</p>
              {invoice.paymentUrl && (
                <a className="wk-button wk-primary wk-full" href={invoice.paymentUrl} target="_blank" rel="noopener noreferrer">
                  {w.goPay} <ExternalLink size={16} />
                </a>
              )}
              <WalletErrorBox error={error} />
              {waiting && <div className="wk-info"><Clock3 size={17} /> {w.waitingCheck}</div>}
              <div className="wk-two-buttons">
                <button className="wk-button wk-secondary" disabled={busy} onClick={confirm}>
                  {busy ? <Busy text={w.checking} /> : w.checkPayment}
                </button>
                <button className="wk-button wk-danger" disabled={busy} onClick={() => setConfirmCancel(true)}>
                  {w.rejectInvoice}
                </button>
              </div>
              {confirmCancel && (
                <div className="wk-cancel-block">
                  <p>{w.rejectInvoiceConfirm}</p>
                  <div className="wk-two-buttons">
                    <button className="wk-button wk-secondary" onClick={() => setConfirmCancel(false)}>{w.keep}</button>
                    <button className="wk-button wk-danger" disabled={busy} onClick={cancel}>{busy ? <Busy /> : w.decline}</button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <button
              className="wk-button wk-secondary wk-full"
              onClick={() => {
                setInvoice(null);
                setError(null);
                setConfirmCancel(false);
                setGeneration((n) => n + 1);
              }}
            >
              {w.newTopUp}
            </button>
          )}
        </div>
      )}
    </WalletModal>
  );
}

export function WithdrawModal({ wallet, onClose, onUpdate }: { wallet: WalletSnapshot; onClose: () => void; onUpdate: (w: WalletSnapshot) => void }) {
  const { w } = useW();
  const [value, setValue] = useState("50");
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
  const send = async () => {
    setBusy(true); setError(null);
    try {
      const input = { amountCents: cents, address: address.trim(), expectedFeeCents: fee, confirmed: true };
      const res = await walletRequest<ActionResult>("/api/wallet", { action: "withdraw", ...input, password, idempotencyKey: key(input) });
      setResult(res.operation); setPassword(""); onUpdate(res.wallet);
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  return <WalletModal title={result ? w.wDone : review ? w.wReview : w.wTitle} subtitle={w.wSub} onClose={onClose}>
    {result ? <div className="wk-success"><div className="wk-success-icon amber"><Clock3 size={30} /></div><h3>{w.onReview}</h3><p>{w.wDoneText}</p><div className="wk-summary"><SummaryRow label={w.reserved}>{money(result.amountCents)}</SummaryRow><SummaryRow label={w.feeRow}>{money(result.feeCents)}</SummaryRow><SummaryRow label={w.youReceive} strong>{money(result.amountCents - result.feeCents)}</SummaryRow></div><p className="wk-caption">{w.cancelHint}</p><button className="wk-button wk-primary wk-full" onClick={onClose}>{w.understood} <Check size={17} /></button></div> : <form className="wk-form" onSubmit={(e) => { e.preventDefault(); if (review) void send(); else { setReview(true); setError(null); } }}>
      {!review ? <><div className="wk-withdrawable"><span>{w.availableToWithdraw}</span><b>{money(wallet.withdrawableCents)}</b></div>
        <AmountInput value={value} onChange={setValue} label={w.debitLabel} id="withdraw-amount" />
        <p className="wk-field-hint">{w.limitsHint(money(rules.minWithdrawalCents), money(rules.dailyWithdrawalCents))}</p>
        <label className="wk-label" htmlFor="withdraw-address">{w.usdtWallet} <span>TRC-20</span></label><input id="withdraw-address" className="wk-input wk-mono" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="T…" maxLength={50} autoComplete="off" />
        <p className="wk-field-hint">{w.ownWalletHint}</p>
      </> : <div className="wk-review-address"><span>{w.recipient}</span><code>{address}</code><button type="button" onClick={() => setReview(false)}>{w.changeDetails}</button></div>}
      <div className="wk-summary"><SummaryRow label={w.debited}>{money(cents)}</SummaryRow><SummaryRow label={w.feeLine(money(rules.minWithdrawalFeeCents))}>{money(fee)}</SummaryRow><SummaryRow label={w.youReceive} strong>{money(net)}</SummaryRow></div>
      <div className="wk-info"><ShieldCheck size={18} /><span>{w.withdrawInfo}</span></div>
      {wallet.verification !== "verified" && <p className="wk-field-hint">{w.verifyPre} <a href="https://t.me/livkamarket" target="_blank" rel="noreferrer">{w.verifyLink}</a>. {w.verifyPost}</p>}
      {review && <><label className="wk-label" htmlFor="withdraw-password">{w.confirmPassword}</label><input className="wk-input" type="password" id="withdraw-password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /><label className="wk-check"><input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} /><span>{w.acceptCheck(money(fee))}</span></label></>}
      <WalletErrorBox error={error} />
      <button className="wk-button wk-primary wk-full" disabled={busy || !valid || (review && (!accepted || !password))} type="submit">{busy ? <Busy /> : review ? <>{w.confirmWithdraw} <ArrowUpRight size={17} /></> : <>{w.continue} <ArrowRight size={17} /></>}</button>
      {cents > wallet.withdrawableCents && <p className="wk-caption">{w.insufficient}</p>}
    </form>}
  </WalletModal>;
}

export function OperationModal({ operation, onClose, onUpdate, onPay, onOrders }: { operation: WalletOperation; wallet: WalletSnapshot; onClose: () => void; onUpdate: (w: WalletSnapshot) => void; onPay: (op: WalletOperation) => void; onOrders: () => void }) {
  const { w, t, intl } = useW();
  const [op, setOp] = useState(operation), [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false), [copied, setCopied] = useState(false), [confirmCancel, setConfirmCancel] = useState(false);
  const cancel = async () => {
    setBusy(true); setError(null);
    try { const r = await walletRequest<ActionResult>("/api/wallet", { action: "cancel", operationId: op.id }); setOp(r.operation); onUpdate(r.wallet); setConfirmCancel(false); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  return <WalletModal title={w.kind[op.kind]} subtitle={opTitle(op, w, t)} onClose={onClose}>
    <div className="wk-operation-hero"><span className={`wk-operation-icon ${op.kind}`}>{op.kind === "deposit" ? <ArrowDownLeft /> : op.kind === "purchase" ? <ShoppingBag /> : op.kind === "adjustment" ? <Check /> : <ArrowUpRight />}</span><h3>{op.kind === "deposit" || op.kind === "adjustment" ? "+" : "−"}{money(op.amountCents)}</h3><span className={`wk-status ${op.status}`}>{w.status[op.status]}</span></div>
    <div className="wk-summary"><SummaryRow label={w.dateRow}>{new Date(op.createdAt).toLocaleString(intl, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</SummaryRow><SummaryRow label={w.methodLabel}>{opMethod(op, w)}</SummaryRow>{op.kind === "withdrawal" && <><SummaryRow label={w.feeRow}>{money(op.feeCents)}</SummaryRow><SummaryRow label={w.youReceive} strong>{money(op.amountCents - op.feeCents)}</SummaryRow></>}</div>
    {op.address && <div className="wk-review-address"><span>{w.recipientAddr}</span><code>{op.address}</code></div>}
    <button className="wk-copy-id" onClick={async () => { try { await navigator.clipboard.writeText(op.id); setCopied(true); } catch { setError("COPY_FAILED"); } }}><span>{w.operationWord} <code>{op.id}</code></span>{copied ? <Check size={15} /> : <Copy size={15} />}</button>
    {op.reference && <p className="wk-muted wk-break">{w.reviewResult} {op.reference}</p>}
    <WalletErrorBox error={error} />
    {op.kind === "deposit" && op.status === "pending" && (
      <div className="wk-cancel-block">
        <button className="wk-button wk-primary wk-full" style={{ marginBottom: 10 }} onClick={() => onPay(op)}>
          {w.continueTopUp} <ArrowRight size={16} />
        </button>
        {confirmCancel ? (
          <>
            <p>{w.rejectInvoiceConfirm}</p>
            <div className="wk-two-buttons">
              <button className="wk-button wk-secondary" onClick={() => setConfirmCancel(false)}>{w.keep}</button>
              <button className="wk-button wk-danger" disabled={busy} onClick={cancel}>{busy ? <Busy /> : w.decline}</button>
            </div>
          </>
        ) : (
          <button className="wk-button wk-danger wk-full" onClick={() => setConfirmCancel(true)}>
            <X size={16} /> {w.rejectInvoice}
          </button>
        )}
      </div>
    )}
    {op.kind === "purchase" && <button className="wk-button wk-primary wk-full" onClick={onOrders}>{w.openPurchases} <ArrowRight size={16} /></button>}
    {op.status === "pending" && op.kind === "withdrawal" && <div className="wk-cancel-block">{confirmCancel ? <><p>{w.cancelQ}</p><div className="wk-two-buttons"><button className="wk-button wk-secondary" onClick={() => setConfirmCancel(false)}>{w.keep}</button><button className="wk-button wk-danger" disabled={busy} onClick={cancel}>{busy ? <Busy /> : w.yesCancel}</button></div></> : <button className="wk-button wk-secondary wk-full" onClick={() => setConfirmCancel(true)}><X size={16} /> {w.cancelRequest}</button>}</div>}
  </WalletModal>;
}

const RULE_ICONS = [ArrowDownLeft, ShoppingBag, ArrowUpRight, ShieldCheck, CircleCheck];
export function WalletRulesModal({ onClose }: { onClose: () => void }) {
  const { w } = useW();
  return <WalletModal title={w.rulesTitle} subtitle={w.rulesSub} onClose={onClose}>
    <div className="wk-rules-list">
      {w.rules.map((rule, i) => { const Icon = RULE_ICONS[i]; return <article key={rule.h}><span><Icon size={20} /></span><div><h3>{rule.h}</h3><p>{rule.p}</p></div></article>; })}
    </div><div className="wk-info"><Info size={18} /><span>{w.rulesInfo}</span></div>
    <a className="wk-button wk-secondary wk-full" href="https://t.me/livkamarket" target="_blank" rel="noreferrer">{w.rulesQuestions} <ExternalLink size={15} /></a>
  </WalletModal>;
}
