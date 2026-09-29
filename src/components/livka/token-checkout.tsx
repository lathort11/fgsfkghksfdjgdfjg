"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight, Check, CheckCheck, Copy, Cpu, Download, Eye, EyeOff,
  Gauge, Lock, ShieldCheck, Sparkles, Wallet,
} from "lucide-react";
import { useW } from "@/components/livka/i18n-context";
import { ProductTile } from "@/components/livka/product-art";
import {
  WalletModal, WalletErrorBox, SummaryRow, Busy, walletRequest, errorMessage, useRequestKey,
} from "@/components/livka/wallet-primitives";
import { money } from "@/lib/wallet-shared";
import {
  affordableTokens, balanceOf, emptyTokenSnapshot, formatBankTokens, formatTokens, MILLION,
  parseTokens, TOKEN_BANK_INITIAL, TOKEN_MIN_PURCHASE, TOKEN_PRESETS, TOKEN_STEP,
  tokenCostCents, type TokenSnapshot,
} from "@/lib/tokens-shared";

type TokenProduct = { id: string; slug: string; icon: string; kind: string; accent: string };
type PurchaseResult = { order: { orderNo: number; credentials: string | null }; apiKey: string; tokens: TokenSnapshot };

export function TokenCheckout({ product, onClose, onOpenOrders, onTopUp, onPurchased }: {
  product: TokenProduct | null;
  onClose: () => void;
  onOpenOrders: () => void;
  onTopUp?: (missingCents: number) => void;
  onPurchased?: () => void;
}) {
  const { w, t, intl, locale } = useW();
  const copy = w.tokens;
  const [snapshot, setSnapshot] = useState<TokenSnapshot | null>(null);
  const [modelSlug, setModelSlug] = useState<string | null>(null);
  const [amountTokens, setAmountTokens] = useState(TOKEN_MIN_PURCHASE);
  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<PurchaseResult | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const key = useRequestKey();

  useEffect(() => {
    if (!product) return;
    let alive = true;
    walletRequest<TokenSnapshot>("/api/tokens").then((next) => {
      if (!alive) return;
      setSnapshot(next);
      setModelSlug((current) => current ?? next.models.find((m) => m.isActive)?.slug ?? null);
    }).catch((reason) => { if (alive) setError(errorMessage(reason)); });
    return () => { alive = false; };
  }, [product]);

  const data = snapshot ?? emptyTokenSnapshot();
  const model = data.models.find((item) => item.slug === modelSlug) ?? null;
  const owned = model ? balanceOf(data, model.slug) : null;
  const personalAvailable = Math.max(0, data.cap - (owned?.inputTokens ?? 0) - (owned?.outputTokens ?? 0));
  const bankAvailable = data.bankAvailableTokens ?? 0;
  const stockAvailable = Math.min(personalAvailable, bankAvailable);
  const rate = data.pricePerMillionCents;
  const affordable = affordableTokens(data.balanceCents, stockAvailable, rate);
  const maxTokens = Math.min(stockAvailable, affordable);
  const canChoose = !!model?.isActive && stockAvailable >= TOKEN_MIN_PURCHASE && maxTokens >= TOKEN_MIN_PURCHASE;
  const validInput = text === null || (parseTokens(text) >= TOKEN_MIN_PURCHASE && parseTokens(text) <= maxTokens);
  const cost = tokenCostCents(amountTokens, rate);
  const missing = Math.max(0, cost - data.balanceCents);
  const remaining = formatBankTokens(data.bankAvailableTokens, locale);

  const retryLoad = async () => {
    setError(null);
    try {
      const next = await walletRequest<TokenSnapshot>("/api/tokens");
      setSnapshot(next);
      setModelSlug(next.models.find((item) => item.isActive)?.slug ?? null);
    } catch (reason) {
      setError(errorMessage(reason));
    }
  };

  const chooseModel = (slug: string) => {
    setModelSlug(slug);
    setAmountTokens(TOKEN_MIN_PURCHASE);
    setText(null);
    setError(null);
  };
  const changeText = (raw: string) => {
    setText(raw);
    const parsed = parseTokens(raw);
    if (parsed >= TOKEN_MIN_PURCHASE && parsed <= maxTokens) setAmountTokens(parsed);
  };
  const chooseAmount = (count: number) => {
    setAmountTokens(Math.max(TOKEN_MIN_PURCHASE, Math.min(count, maxTokens)));
    setText(null);
  };
  const buy = async () => {
    if (!model?.isActive || busy || !validInput || amountTokens < TOKEN_MIN_PURCHASE || amountTokens > maxTokens) return;
    setBusy(true); setError(null);
    try {
      const payload = { modelSlug: model.slug, amountTokens, expectedTotalCents: cost, confirmed: true };
      const result = await walletRequest<PurchaseResult>("/api/tokens", { ...payload, idempotencyKey: key(payload) });
      setDone(result);
      setSnapshot(result.tokens);
      onPurchased?.();
    } catch (reason) {
      setError(errorMessage(reason));
      walletRequest<TokenSnapshot>("/api/tokens").then(setSnapshot).catch(() => {});
    } finally {
      setBusy(false);
    }
  };

  if (!product) return null;
  const productText = t.products[product.slug as keyof typeof t.products];
  const updatedOwned = done ? balanceOf(done.tokens, model?.slug ?? "") : null;

  return <WalletModal title={done ? copy.doneTitle : copy.title} subtitle={done ? copy.doneSub(done.order.orderNo) : copy.subtitle} onClose={onClose} wide>
    <div className="wk-checkout-product">
      <ProductTile product={product} size={58} />
      <div><h3>{productText?.name ?? product.slug}</h3><p>{productText?.tagline}</p></div>
      <span className="wk-small-badge">API</span>
    </div>

    {done ? <div className="wk-form">
      <div className="wk-purchased"><CheckCheck size={21} /><div><b>{copy.purchased}</b><p>{copy.purchasedText}</p></div></div>
      <div className="wk-summary">
        <SummaryRow label={copy.model}>{model?.label}</SummaryRow>
        <SummaryRow label={copy.currentBalance}>{formatTokens((updatedOwned?.inputTokens ?? 0) + (updatedOwned?.outputTokens ?? 0), intl)}</SummaryRow>
      </div>
      <div className="wk-credentials">
        <div><span>{copy.apiKey}</span><button aria-label={revealed ? w.hideAccess : w.showAccess} onClick={() => setRevealed(!revealed)}>{revealed ? <EyeOff size={17} /> : <Eye size={17} />}{revealed ? w.hide : w.show}</button></div>
        <pre>{revealed ? done.order.credentials ?? done.apiKey : "••••••••••••••••••••••••••\n••••••••••••••••••••••••••"}</pre>
      </div>
      <div className="wk-two-buttons">
        <button className="wk-button wk-secondary" onClick={async () => { try { await navigator.clipboard.writeText(done.apiKey); setCopied(true); } catch { setError("COPY_FAILED"); } }}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? w.copied : copy.copyKey}</button>
        <button className="wk-button wk-secondary" onClick={() => { const url = URL.createObjectURL(new Blob([done.order.credentials ?? done.apiKey], { type: "text/plain;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = `livka-claude-${done.order.orderNo}.txt`; link.click(); URL.revokeObjectURL(url); }}><Download size={16} />{w.save}</button>
      </div>
      <WalletErrorBox error={error} />
      <button className="wk-button wk-primary wk-full" onClick={() => { onClose(); onOpenOrders(); }}>{w.myPurchases} <ArrowRight size={17} /></button>
    </div> : <div className="wk-form">
      {!snapshot ? <div className="wk-empty">{!error && <Busy text={copy.loading} />}<WalletErrorBox error={error} />{error && <button className="wk-button wk-secondary" onClick={retryLoad}>{w.retry}</button>}</div> : <>
        <div className="wk-token-bank" aria-label={copy.bankLine(remaining)}>
          <div className="wk-token-bank-top">
            <span><Gauge size={15} />{copy.bankTitle}</span>
            <strong>{remaining}</strong>
          </div>
          <div className="wk-token-bank-meter" role="progressbar" aria-valuemin={0} aria-valuemax={TOKEN_BANK_INITIAL} aria-valuenow={bankAvailable} aria-label={copy.bankTitle}>
            <span style={{ width: `${Math.max(0, Math.min(100, bankAvailable / TOKEN_BANK_INITIAL * 100))}%` }} />
          </div>
          <small>{copy.bankHint}</small>
        </div>

        <div className="wk-token-models" role="group" aria-label={copy.model}>
          {data.models.map((item) => <button
            key={item.slug}
            type="button"
            className={`wk-token-model ${item.slug === modelSlug ? "is-active" : ""} ${item.isActive ? "" : "is-locked"}`}
            aria-pressed={item.slug === modelSlug}
            disabled={!item.isActive || busy}
            onClick={() => chooseModel(item.slug)}
          >
            <span className="wk-token-model-top"><Cpu size={16} /><b>{item.label}</b>{item.isActive ? <Check size={15} className="wk-token-check" /> : <span className="wk-token-soon"><Lock size={11} />{copy.soon}</span>}</span>
          </button>)}
        </div>

        <div className="wk-token-flat-rate"><Sparkles size={17} /><span>{copy.priceLine(money(data.pricePerMillionCents, true))}</span></div>
        <TokenField
          value={amountTokens}
          raw={text}
          max={maxTokens}
          rate={rate}
          disabled={!canChoose || busy}
          valid={validInput}
          onRawChange={changeText}
          onBlur={() => setText(null)}
          onChange={chooseAmount}
        />

        <div className="wk-summary">
          <SummaryRow label={copy.totalTokens}>{formatTokens(amountTokens, intl)}</SummaryRow>
          <SummaryRow label={copy.total} strong>{money(cost, true)}</SummaryRow>
        </div>
        <div className="wk-balance-payment">
          <span className="wk-mini-icon"><Wallet size={20} /></span>
          <div><b>{w.payFromBalance}</b><p>{w.availableAmt(money(data.balanceCents, true))}</p></div>
          <Check size={17} />
        </div>
        {owned && owned.inputTokens + owned.outputTokens > 0 && <div className="wk-token-meta"><span><Sparkles size={13} />{copy.ownedLine(formatTokens(owned.inputTokens + owned.outputTokens, intl))}</span></div>}
        {bankAvailable < TOKEN_MIN_PURCHASE && <div className="wk-info"><Gauge size={17} /><span>{copy.bankEmpty}</span></div>}
        {bankAvailable >= TOKEN_MIN_PURCHASE && personalAvailable < TOKEN_MIN_PURCHASE && <div className="wk-info"><Gauge size={17} /><span>{w.errors.TOKEN_CAP}</span></div>}
        {stockAvailable >= TOKEN_MIN_PURCHASE && missing > 0 && <div className="wk-info"><Wallet size={17} /><span>{w.missingA} <b>{money(missing, true)}</b>. {w.missingB}</span></div>}
        <WalletErrorBox error={error} />
        {stockAvailable >= TOKEN_MIN_PURCHASE && missing > 0
          ? <button className="wk-button wk-primary wk-full" onClick={() => onTopUp?.(missing)}>{w.topUp} <ArrowRight size={17} /></button>
          : <button className="wk-button wk-primary wk-full" disabled={!canChoose || !validInput || amountTokens > maxTokens || busy} onClick={buy}>{busy ? <Busy text={w.confirming} /> : <>{copy.buyFor(money(cost, true))} <ArrowRight size={16} /></>}</button>}
        <p className="wk-caption"><ShieldCheck size={13} />{copy.note}</p>
      </>}
    </div>}
  </WalletModal>;
}

function TokenField({ value, raw, max, rate, disabled, valid, onRawChange, onBlur, onChange }: {
  value: number;
  raw: string | null;
  max: number;
  rate: number;
  disabled: boolean;
  valid: boolean;
  onRawChange: (text: string) => void;
  onBlur: () => void;
  onChange: (value: number) => void;
}) {
  const { w, intl } = useW();
  const copy = w.tokens;
  const sliderMax = Math.max(TOKEN_MIN_PURCHASE, Math.floor(max / TOKEN_STEP) * TOKEN_STEP);
  const presets = TOKEN_PRESETS.map((n) => n * MILLION).filter((n) => n <= max);

  return <div className={`wk-token-field ${disabled ? "is-disabled" : ""}`}>
    <div className="wk-token-head">
      <label htmlFor="claude-token-amount">{copy.quantity}<small>{copy.minLine}</small></label>
      <div className="wk-token-input">
        <input
          id="claude-token-amount"
          inputMode="numeric"
          autoComplete="off"
          disabled={disabled}
          value={raw ?? value.toLocaleString(intl)}
          onChange={(event) => onRawChange(event.target.value)}
          onBlur={onBlur}
          aria-label={copy.quantity}
          aria-invalid={!valid}
        />
        <span>{copy.tokensShort}</span>
      </div>
    </div>
    <input
      className="wk-range"
      type="range"
      min={TOKEN_MIN_PURCHASE}
      max={sliderMax}
      step={TOKEN_STEP}
      value={Math.min(value, sliderMax)}
      disabled={disabled}
      aria-label={`${copy.quantity} — ${formatTokens(value, intl)}`}
      onChange={(event) => onChange(Number(event.target.value))}
      style={{ ["--fill" as string]: `${sliderMax > TOKEN_MIN_PURCHASE ? (Math.min(value, sliderMax) - TOKEN_MIN_PURCHASE) / (sliderMax - TOKEN_MIN_PURCHASE) * 100 : 0}%` }}
    />
    <div className="wk-token-foot">
      <div className="wk-token-presets">
        {presets.map((count) => <button key={count} type="button" disabled={disabled} className={value === count ? "is-active" : ""} onClick={() => onChange(count)}>{formatTokens(count, intl)}</button>)}
        {max >= TOKEN_MIN_PURCHASE && <button type="button" disabled={disabled} className={value === max ? "is-active" : ""} onClick={() => onChange(max)}>{copy.max}</button>}
      </div>
      <b>{money(tokenCostCents(value, rate), true)}</b>
    </div>
    <p className="wk-token-limit">{!valid && raw !== null && parseTokens(raw) < TOKEN_MIN_PURCHASE ? copy.minLine : copy.balanceMax(formatTokens(max, intl))}</p>
  </div>;
}
