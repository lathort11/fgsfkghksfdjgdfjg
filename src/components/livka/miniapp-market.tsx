"use client";

import { useState } from "react";
import { useI18n } from "@/components/livka/i18n-context";
import { Check, KeyIcon, Receipt, Sparkle, UserIcon, Wallet, XIcon } from "@/components/livka/icons";
import { fmtRub } from "@/components/livka/checkout";
import { ProductTile } from "@/components/livka/product-art";

/* ═══════════ Types shared with the Mini App shell ═══════════ */
export type MiniUser = {
  id: string;
  name: string;
  telegramId: string | null;
  telegramUsername: string | null;
  avatarUrl: string | null;
};
export type MiniBotProfile = {
  ipVerified: boolean;
  trialActive: boolean;
  trialKey: string | null;
  tokensUsed: number;
  tokensLimit: number;
  referralsConfirmed: number;
  referralsRequired: number;
};
export type MiniProduct = { id: string; slug: string; priceCents: number; per: string; kind: string; stock: number; icon: string; accent: string };
export type MiniNetwork = { id: string; asset: string; net: string };

type Haptic = (kind: "success" | "error" | "warning" | "light") => void;

const COPY = {
  ru: {
    trial: "Триал", active: "Активен", inactive: "Не активен", tokens: "токенов", key: "Триальный API-ключ",
    copy: "Скопировать ключ", copied: "Скопировано", refs: "Подтверждённые рефералы", noKey: "Ключ появится после активации триала в боте",
    noBot: "Данные триала временно недоступны. Попробуйте позже.", market: "Маркет", buy: "Купить", out: "Нет в наличии",
    network: "Сеть оплаты", create: "Создать счёт", send: "Отправьте ровно", to: "на адрес", copyAddr: "Скопировать адрес",
    tx: "Хэш транзакции (TxID)", paid: "Я оплатил", delivered: "Заказ выдан", order: "Заказ", inChat: "Данные доступа продублированы в чат с ботом.",
    notInChat: "Сохраните данные доступа — они также есть в разделе «Мои заказы» на сайте.", close: "Закрыть",
    errTx: "Введите корректный хэш транзакции", err: "Ошибка. Попробуйте ещё раз.", stock: "Осталось",
  },
  en: {
    trial: "Trial", active: "Active", inactive: "Inactive", tokens: "tokens", key: "Trial API key",
    copy: "Copy key", copied: "Copied", refs: "Confirmed referrals", noKey: "The key appears after the trial is activated in the bot",
    noBot: "Trial data is temporarily unavailable. Try again later.", market: "Market", buy: "Buy", out: "Out of stock",
    network: "Payment network", create: "Create invoice", send: "Send exactly", to: "to address", copyAddr: "Copy address",
    tx: "Transaction hash (TxID)", paid: "I have paid", delivered: "Order delivered", order: "Order", inChat: "Access details were also sent to your bot chat.",
    notInChat: "Save these access details — they are also under “My orders” on the website.", close: "Close",
    errTx: "Enter a valid transaction hash", err: "Something went wrong. Try again.", stock: "Left",
  },
  zh: {
    trial: "试用", active: "已激活", inactive: "未激活", tokens: "代币", key: "试用 API 密钥",
    copy: "复制密钥", copied: "已复制", refs: "已确认邀请", noKey: "在机器人中激活试用后显示密钥",
    noBot: "试用数据暂不可用，请稍后再试。", market: "商店", buy: "购买", out: "缺货",
    network: "支付网络", create: "创建账单", send: "请精确发送", to: "至地址", copyAddr: "复制地址",
    tx: "交易哈希 (TxID)", paid: "我已付款", delivered: "订单已交付", order: "订单", inChat: "访问信息已同步发送到机器人聊天。",
    notInChat: "请保存访问信息——网站“我的订单”中也可查看。", close: "关闭",
    errTx: "请输入有效的交易哈希", err: "出错了，请重试。", stock: "剩余",
  },
} as const;

const card = { background: "rgba(255,255,255,.035)", border: "1px solid var(--line)" } as const;
const nf = (n: number) => n.toLocaleString("ru-RU");

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function MiniAppMarket({
  user,
  bot,
  products,
  networks,
  haptic,
}: {
  user: MiniUser;
  bot: MiniBotProfile | null;
  products: MiniProduct[];
  networks: MiniNetwork[];
  haptic: Haptic;
}) {
  const { t, locale } = useI18n();
  const c = COPY[locale as keyof typeof COPY] ?? COPY.ru;
  const [copied, setCopied] = useState(false);
  const [buying, setBuying] = useState<MiniProduct | null>(null);

  const pct = bot && bot.tokensLimit > 0 ? Math.min(100, (bot.tokensUsed / bot.tokensLimit) * 100) : 0;
  const maskedKey = bot?.trialKey
    ? bot.trialKey.length > 18 ? `${bot.trialKey.slice(0, 15)}…${bot.trialKey.slice(-4)}` : bot.trialKey
    : null;

  return (
    <main className="mx-auto min-h-[100dvh] w-full max-w-md px-4 pb-10 pt-5">
      {/* ── User header ── */}
      <section className="rounded-3xl p-5" style={card}>
        <div className="flex items-center gap-3.5">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-xl font-black text-white"
            style={{ background: "linear-gradient(135deg,#00b4d8,#3b82f6)" }}
          >
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              user.name.charAt(0).toUpperCase() || <UserIcon className="h-6 w-6" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="ff-d truncate text-[17px] font-bold text-white">{user.name}</div>
            {user.telegramUsername && (
              <div className="truncate text-[12px]" style={{ color: "var(--ink-3)" }}>@{user.telegramUsername}</div>
            )}
          </div>
          {bot && (
            <span
              className="shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold"
              style={
                bot.trialActive
                  ? { background: "rgba(16,185,129,.14)", color: "#34d399", border: "1px solid rgba(16,185,129,.3)" }
                  : { background: "rgba(255,255,255,.05)", color: "var(--ink-3)", border: "1px solid var(--line)" }
              }
            >
              {c.trial}: {bot.trialActive ? c.active : c.inactive}
            </span>
          )}
        </div>

        {bot ? (
          <div className="mt-5 space-y-4">
            <div>
              <div className="flex items-baseline justify-between text-[12px]" style={{ color: "var(--ink-2)" }}>
                <span>
                  <b className="text-white">{nf(bot.tokensUsed)}</b> / {nf(bot.tokensLimit)} {c.tokens}
                </span>
                <span style={{ color: "var(--ink-3)" }}>{pct.toFixed(1)}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,.06)" }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, background: "linear-gradient(90deg,#00f5d4,#3b82f6)" }}
                />
              </div>
            </div>

            <div className="rounded-2xl p-3.5" style={{ background: "rgba(0,0,0,.25)", border: "1px solid var(--line)" }}>
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--ink-3)" }}>
                <KeyIcon className="h-3.5 w-3.5" /> {c.key}
              </div>
              {maskedKey ? (
                <div className="mt-2 flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate font-mono text-[13px] text-white">{maskedKey}</code>
                  <button
                    type="button"
                    className="btn btn-primary shrink-0 !px-3 !py-2 text-[12px]"
                    onClick={async () => {
                      if (await copyText(bot.trialKey!)) {
                        haptic("success");
                        setCopied(true);
                        window.setTimeout(() => setCopied(false), 1600);
                      } else haptic("error");
                    }}
                  >
                    {copied ? <><Check className="h-3.5 w-3.5" /> {c.copied}</> : c.copy}
                  </button>
                </div>
              ) : (
                <div className="mt-2 text-[12px]" style={{ color: "var(--ink-3)" }}>{c.noKey}</div>
              )}
            </div>

            <div className="flex items-center justify-between text-[13px]">
              <span style={{ color: "var(--ink-2)" }}>{c.refs}</span>
              <span className="flex items-center gap-2">
                <span className="flex gap-1">
                  {Array.from({ length: Math.max(1, Math.min(bot.referralsRequired, 10)) }).map((_, i) => (
                    <span
                      key={i}
                      className="h-2 w-2 rounded-full"
                      style={{ background: i < bot.referralsConfirmed ? "#00f5d4" : "rgba(255,255,255,.12)" }}
                    />
                  ))}
                </span>
                <b className="text-white">{bot.referralsConfirmed} / {bot.referralsRequired}</b>
              </span>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-[12px]" style={{ color: "var(--ink-3)" }}>{c.noBot}</p>
        )}
      </section>

      {/* ── Catalog ── */}
      <div className="mt-7 mb-3 flex items-center gap-2 px-1 text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--ink-3)" }}>
        <Sparkle className="h-3.5 w-3.5" /> {c.market}
      </div>
      <div className="space-y-3">
        {products.map((p) => {
          const pd = t.products[p.slug as keyof typeof t.products];
          const per = t.per[p.per as keyof typeof t.per];
          const out = p.stock <= 0;
          return (
            <div key={p.id} className="flex items-center gap-3 rounded-2xl p-3" style={card}>
              <ProductTile product={p} size={52} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold text-white">{pd?.name ?? p.slug}</div>
                <div className="truncate text-[11px]" style={{ color: "var(--ink-3)" }}>{pd?.tagline}</div>
                <div className="mt-1 text-[13px] font-bold text-white">
                  {fmtRub(p.priceCents)} <span className="text-[10px] font-normal" style={{ color: "var(--ink-3)" }}>{per}</span>
                </div>
              </div>
              <button
                type="button"
                disabled={out}
                onClick={() => {
                  haptic("light");
                  setBuying(p);
                }}
                className="btn btn-primary shrink-0 !px-4 !py-2.5 text-[12px] disabled:opacity-40"
              >
                {out ? c.out : c.buy}
              </button>
            </div>
          );
        })}
      </div>

      {buying && (
        <QuickBuy
          product={buying}
          networks={networks}
          haptic={haptic}
          c={c}
          onClose={() => setBuying(null)}
        />
      )}
    </main>
  );
}

/* ═══════════ Quick Buy sheet: network → invoice + QR → tx hash → credentials ═══════════ */
type Invoice = { secret: string; orderNo: number; amountCrypto: string; assetLabel: string; depositAddress: string; networkLabel: string; totalCents: number };
type Delivered = { orderNo: number; credentials: string | null; sentToTelegram: boolean };

function QuickBuy({
  product,
  networks,
  haptic,
  c,
  onClose,
}: {
  product: MiniProduct;
  networks: MiniNetwork[];
  haptic: Haptic;
  c: (typeof COPY)[keyof typeof COPY];
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [networkId, setNetworkId] = useState(networks[0]?.id ?? "");
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [tx, setTx] = useState("");
  const [done, setDone] = useState<Delivered | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = t.products[product.slug as keyof typeof t.products]?.name ?? product.slug;

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ productId: product.id, networkId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.order) throw new Error(data.error ?? "ERR");
      setInvoice(data.order as Invoice);
      haptic("success");
    } catch {
      setError(c.err);
      haptic("error");
    } finally {
      setBusy(false);
    }
  };

  const pay = async () => {
    if (!invoice) return;
    if (tx.trim().length < 8) {
      setError(c.errTx);
      haptic("warning");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/order/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ secret: invoice.secret, txHash: tx.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.order) throw new Error(data.error ?? "ERR");
      setDone({ orderNo: data.order.orderNo, credentials: data.order.credentials, sentToTelegram: !!data.sentToTelegram });
      haptic("success");
    } catch (e) {
      setError(e instanceof Error && e.message === "BAD_TX" ? c.errTx : c.err);
      haptic("error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,.6)" }} onClick={onClose}>
      <div
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl p-5 pb-8"
        style={{ background: "#0d0f16", borderTop: "1px solid var(--line-2)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-[16px] font-bold text-white">{name}</div>
            <div className="text-[13px]" style={{ color: "var(--ink-2)" }}>{fmtRub(invoice?.totalCents ?? product.priceCents)}</div>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl" style={card} aria-label={c.close}>
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        {done ? (
          <div className="mt-5">
            <div className="flex items-center gap-2 text-[15px] font-semibold" style={{ color: "#34d399" }}>
              <Check className="h-5 w-5" /> {c.delivered} · {c.order} #{done.orderNo}
            </div>
            {done.credentials && (
              <pre className="mt-3 whitespace-pre-wrap break-all rounded-2xl p-4 font-mono text-[12px] text-white" style={{ background: "rgba(0,0,0,.35)", border: "1px solid var(--line)" }}>
                {done.credentials}
              </pre>
            )}
            <p className="mt-3 text-[12px]" style={{ color: "var(--ink-3)" }}>{done.sentToTelegram ? c.inChat : c.notInChat}</p>
            <button type="button" onClick={onClose} className="btn btn-primary mt-5 w-full !py-3.5 text-sm">{c.close}</button>
          </div>
        ) : !invoice ? (
          <div className="mt-5">
            <div className="mb-2 text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--ink-3)" }}>{c.network}</div>
            <div className="grid grid-cols-2 gap-2">
              {networks.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    setNetworkId(n.id);
                    haptic("light");
                  }}
                  className="rounded-2xl p-3 text-left transition-colors"
                  style={{
                    background: networkId === n.id ? "rgba(0,180,216,.12)" : "rgba(255,255,255,.03)",
                    border: `1px solid ${networkId === n.id ? "rgba(0,245,212,.5)" : "var(--line)"}`,
                  }}
                >
                  <div className="text-[14px] font-bold text-white">{n.asset}</div>
                  <div className="text-[11px]" style={{ color: "var(--ink-3)" }}>{n.net}</div>
                </button>
              ))}
            </div>
            {error && <p className="mt-3 text-[12px]" style={{ color: "#fb7185" }}>{error}</p>}
            <button type="button" disabled={busy || !networkId} onClick={create} className="btn btn-primary mt-5 w-full !py-3.5 text-sm disabled:opacity-60">
              <Wallet className="h-4 w-4" /> {busy ? "…" : c.create}
            </button>
          </div>
        ) : (
          <div className="mt-5">
            <div className="text-[12px]" style={{ color: "var(--ink-3)" }}>{c.send}</div>
            <div className="ff-d text-2xl font-black text-white">
              {invoice.amountCrypto} {invoice.assetLabel}
            </div>
            <div className="mt-1 text-[11px]" style={{ color: "var(--ink-3)" }}>{invoice.networkLabel} · {c.order} #{invoice.orderNo}</div>

            <div className="mx-auto mt-4 w-44 rounded-2xl bg-black p-3" style={{ border: "1px solid var(--line)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/qr?text=${encodeURIComponent(invoice.depositAddress)}`} alt="QR" className="h-full w-full" />
            </div>

            <div className="mt-4 text-[12px]" style={{ color: "var(--ink-3)" }}>{c.to}</div>
            <button
              type="button"
              onClick={async () => haptic((await copyText(invoice.depositAddress)) ? "success" : "error")}
              className="mt-1 w-full break-all rounded-xl p-3 text-left font-mono text-[12px] text-white"
              style={card}
              title={c.copyAddr}
            >
              {invoice.depositAddress}
              <span className="mt-1 block font-sans text-[11px]" style={{ color: "#00f5d4" }}>{c.copyAddr}</span>
            </button>

            <label className="mt-4 block text-[12px]" style={{ color: "var(--ink-3)" }}>
              <span className="flex items-center gap-1.5"><Receipt className="h-3.5 w-3.5" /> {c.tx}</span>
              <input
                value={tx}
                onChange={(e) => setTx(e.target.value)}
                placeholder="0x… / hash"
                className="mt-1.5 w-full rounded-xl px-3.5 py-3 font-mono text-[13px] text-white outline-none"
                style={{ background: "rgba(255,255,255,.04)", border: "1px solid var(--line)" }}
              />
            </label>
            {error && <p className="mt-3 text-[12px]" style={{ color: "#fb7185" }}>{error}</p>}
            <button type="button" disabled={busy} onClick={pay} className="btn btn-primary mt-5 w-full !py-3.5 text-sm disabled:opacity-60">
              {busy ? "…" : c.paid}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
