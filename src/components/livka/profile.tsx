"use client";

import type { SessionUser } from "@/components/livka/auth";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/livka/i18n-context";
import { DICTS } from "@/lib/i18n";
import { fmtRub, hexA } from "@/components/livka/checkout";
import {
  Check, LogOut, Receipt, Sparkle, UserIcon, XIcon, Shield, KeyIcon, Wallet,
} from "@/components/livka/icons";

type MineOrder = {
  orderNo: number;
  secret: string;
  status: string;
  totalCents: number;
  assetLabel: string;
  networkLabel: string;
  amountCrypto: string;
  productSlug: string;
  credentials: string | null;
  createdAt: string;
};

const inputStyle = {
  background: "rgba(255,255,255,.04)",
  border: "1px solid var(--line)",
  color: "var(--ink)",
} as const;

export function ProfileModal({
  open,
  onClose,
  user,
  onOrders,
  onLogout,
  onUserUpdate,
}: {
  open: boolean;
  onClose: () => void;
  user: SessionUser;
  onOrders: () => void;
  onLogout: () => void;
  onUserUpdate: (u: SessionUser) => void;
}) {
  const { t, locale } = useI18n();
  const [rows, setRows] = useState<MineOrder[] | null>(null);
  const [name, setName] = useState(user.name);
  const [nameMsg, setNameMsg] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [curPass, setCurPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [passMsg, setPassMsg] = useState<string | null>(null);
  const [passOk, setPassOk] = useState(false);
  const [savingPass, setSavingPass] = useState(false);

  useEffect(() => {
    setName(user.name);
  }, [user.name]);

  useEffect(() => {
    if (!open) return;
    document.documentElement.style.overflow = "hidden";
    setCurPass("");
    setNewPass("");
    setPassMsg(null);
    setPassOk(false);
    setNameMsg(null);
    fetch("/api/order/mine")
      .then((r) => (r.ok ? r.json() : { orders: [] }))
      .then((d) => setRows(d.orders ?? []))
      .catch(() => setRows([]));
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const stats = useMemo(() => {
    const list = rows ?? [];
    return {
      total: list.length,
      delivered: list.filter((o) => o.status === "delivered").length,
      spent: list.reduce((sum, o) => sum + o.totalCents, 0),
      crypto: new Set(list.map((o) => o.assetLabel)).size,
    };
  }, [rows]);

  if (!open) return null;

  const dict = DICTS[locale];
  const dateFmt = locale === "ru" ? "ru-RU" : locale === "zh" ? "zh-CN" : "en-US";

  const saveName = async () => {
    if (name.trim().length < 2) {
      setNameMsg(t.auth.errorName);
      return;
    }
    setSavingName(true);
    setNameMsg(null);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "ERROR");
      onUserUpdate(data.user);
      setNameMsg(t.profile.saved);
    } catch {
      setNameMsg(t.auth.errorName);
    } finally {
      setSavingName(false);
    }
  };

  const savePass = async () => {
    if (newPass.length < 6) {
      setPassMsg(t.auth.errorPass);
      setPassOk(false);
      return;
    }
    setSavingPass(true);
    setPassMsg(null);
    setPassOk(false);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: curPass, newPassword: newPass }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "ERROR");
      setPassMsg(t.profile.passUpdated);
      setPassOk(true);
      setCurPass("");
      setNewPass("");
    } catch (e) {
      const code = e instanceof Error ? e.message : "ERROR";
      setPassMsg(code === "WRONG_PASSWORD" ? t.profile.wrongPass : t.auth.errorPass);
    } finally {
      setSavingPass(false);
    }
  };

  return (
    <div
      className="modal-backdrop fixed inset-0 z-[112] flex items-center justify-center p-3 sm:p-4"
      style={{ background: "rgba(5,5,11,.9)", backdropFilter: "blur(18px)" }}
      onClick={onClose}
    >
      <div
        className="modal-surface relative w-full max-w-lg p-6 sm:p-7 modal-in max-h-[92vh] overflow-y-auto"
        style={{ borderRadius: 28 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="close"
          className="absolute top-4 right-4 flex items-center justify-center w-9 h-9 rounded-full transition-colors hover:bg-white/10 z-10"
          style={{ border: "1px solid var(--line)", color: "var(--ink-2)" }}
        >
          <XIcon className="w-4 h-4" />
        </button>

        {/* header */}
        <div className="flex items-center gap-4 pr-10">
          <span
            className="flex items-center justify-center w-16 h-16 rounded-[22px] ff-d text-2xl font-black text-white shrink-0 brand-glow"
            style={{
              background: "linear-gradient(135deg,#7c5cff,#4f8cff)",
              boxShadow: "0 14px 34px -14px rgba(124,92,255,.9)",
              fontWeight: 900,
            }}
          >
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" className="w-full h-full rounded-[22px] object-cover" referrerPolicy="no-referrer" />
            ) : (
              user.name.trim().charAt(0).toUpperCase() || "U"
            )}
          </span>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--ink-3)" }}>
              {t.profile.title}
            </div>
            <div className="ff-d text-lg font-bold text-white truncate" style={{ fontWeight: 700 }}>
              {user.name}
            </div>
            <div className="text-[11px] truncate mt-0.5" style={{ color: "var(--ink-3)" }}>
              {user.telegramId
                ? `Telegram${user.telegramUsername ? ` · @${user.telegramUsername}` : ` · ID ${user.telegramId}`}`
                : user.email}
            </div>
            {user.createdAt && (
              <div className="text-[10px] mt-1" style={{ color: "var(--ink-3)" }}>
                {t.profile.memberSince}{" "}
                {new Date(user.createdAt).toLocaleDateString(dateFmt, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </div>
            )}
          </div>
        </div>

        {/* stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-6">
          <StatBox label={t.profile.orders} value={String(stats.total)} />
          <StatBox label={t.profile.delivered} value={String(stats.delivered)} accent="#2fe6a7" />
          <StatBox label={t.profile.spent} value={fmtRub(stats.spent)} big />
          <StatBox label={t.profile.crypto} value={String(stats.crypto)} accent="#9be7ff" />
        </div>

        {/* edit name */}
        <div className="mt-6">
          <SectionTitle icon={<UserIcon className="w-3.5 h-3.5" />}>{t.profile.editName}</SectionTitle>
          <div className="flex gap-2.5">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 px-4 py-3 rounded-xl text-sm outline-none focus:border-white/25 transition-colors"
              style={inputStyle}
            />
            <button
              onClick={saveName}
              disabled={savingName}
              className="btn btn-primary !py-3 !px-5 text-sm shrink-0 disabled:opacity-60"
            >
              {savingName ? "…" : t.profile.save}
            </button>
          </div>
          {nameMsg && (
            <div
              className="mt-2 text-xs flex items-center gap-1.5"
              style={{ color: nameMsg === t.profile.saved ? "#2fe6a7" : "#fb7185" }}
            >
              {nameMsg === t.profile.saved && <Check className="w-3.5 h-3.5" />}
              {nameMsg}
            </div>
          )}
        </div>

        {/* change password */}
        <div className="mt-6">
          <SectionTitle icon={<KeyIcon className="w-3.5 h-3.5" />}>{t.profile.changePass}</SectionTitle>
          <div className="grid sm:grid-cols-2 gap-2.5">
            <input
              type="password"
              value={curPass}
              onChange={(e) => setCurPass(e.target.value)}
              placeholder={t.profile.currentPass}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none focus:border-white/25 transition-colors"
              style={inputStyle}
            />
            <input
              type="password"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              placeholder={t.profile.newPass}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none focus:border-white/25 transition-colors"
              style={inputStyle}
            />
          </div>
          <button
            onClick={savePass}
            disabled={savingPass}
            className="btn btn-ghost w-full !py-3 mt-2.5 text-sm disabled:opacity-60"
          >
            <Shield className="w-4 h-4" />
            {savingPass ? "…" : t.profile.updatePass}
          </button>
          {passMsg && (
            <div
              className="mt-2 text-xs flex items-center gap-1.5"
              style={{ color: passOk ? "#2fe6a7" : "#fb7185" }}
            >
              {passOk && <Check className="w-3.5 h-3.5" />}
              {passMsg}
            </div>
          )}
        </div>

        {/* recent orders */}
        <div className="mt-6">
          <SectionTitle icon={<Receipt className="w-3.5 h-3.5" />}>{t.profile.recent}</SectionTitle>
          {rows === null ? (
            <div className="space-y-2">
              {[0, 1].map((i) => (
                <div key={i} className="h-16 rounded-2xl shimmer-line" style={{ background: "rgba(255,255,255,.03)" }} />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-xs mb-3" style={{ color: "var(--ink-3)" }}>
                {t.profile.noOrders}
              </p>
              <button
                onClick={() => {
                  onClose();
                  document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="btn btn-primary !py-2.5 text-xs"
              >
                {t.checkout.openCatalog}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {rows.slice(0, 3).map((o) => {
                const pd = dict.products[o.productSlug as keyof typeof dict.products];
                const color =
                  o.status === "delivered"
                    ? "#2fe6a7"
                    : o.status === "awaiting_payment"
                    ? "#fbbf24"
                    : "#9be7ff";
                return (
                  <div
                    key={o.secret}
                    className="flex items-center gap-3 p-3 rounded-2xl"
                    style={{ background: "rgba(255,255,255,.03)", border: "1px solid var(--line)" }}
                  >
                    <span
                      className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0"
                      style={{ background: hexA(color, 0.13), color }}
                    >
                      <Wallet className="w-4 h-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold text-white truncate">{pd?.name ?? o.productSlug}</div>
                      <div className="text-[10px] mt-0.5" style={{ color: "var(--ink-3)" }}>
                        № {o.orderNo} · {o.assetLabel} {o.amountCrypto} ·{" "}
                        {new Date(o.createdAt).toLocaleDateString(dateFmt)}
                      </div>
                    </div>
                    <span
                      className="shrink-0 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-full"
                      style={{ background: `${color}1f`, color }}
                    >
                      {t.status[o.status as keyof typeof t.status] ?? o.status}
                    </span>
                  </div>
                );
              })}
              {rows.length > 3 && (
                <button
                  onClick={onOrders}
                  className="w-full py-2.5 rounded-xl text-[11px] font-semibold transition-colors hover:bg-white/[0.07] flex items-center justify-center gap-1.5"
                  style={{ background: "rgba(255,255,255,.04)", color: "var(--ink-2)" }}
                >
                  {t.profile.viewAll}
                  <Sparkle className="w-3 h-3" style={{ color: "var(--violet)" }} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* footer actions */}
        <div className="flex flex-col sm:flex-row gap-2.5 mt-7 pt-5" style={{ borderTop: "1px solid var(--line)" }}>
          <button onClick={onOrders} className="btn btn-ghost !py-3 text-sm flex-1">
            <Receipt className="w-4 h-4" />
            {t.auth.myOrders}
          </button>
          <button
            onClick={onLogout}
            className="btn !py-3 text-sm flex-1"
            style={{ background: "rgba(244,63,94,.1)", border: "1px solid rgba(244,63,94,.22)", color: "#fb7185" }}
          >
            <LogOut className="w-4 h-4" />
            {t.auth.logout}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  accent,
  big,
}: {
  label: string;
  value: string;
  accent?: string;
  big?: boolean;
}) {
  return (
    <div
      className="px-3 py-3.5 rounded-2xl text-center"
      style={{ background: "rgba(255,255,255,.03)", border: "1px solid var(--line)" }}
    >
      <div
        className={`${big ? "text-[15px]" : "ff-d text-xl"} font-black truncate`}
        style={{ color: accent ?? "#fff", fontWeight: 900 }}
      >
        {value}
      </div>
      <div className="text-[9px] uppercase tracking-wider mt-1.5" style={{ color: "var(--ink-3)" }}>
        {label}
      </div>
    </div>
  );
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] mb-2.5"
      style={{ color: "var(--ink-3)" }}
    >
      {icon}
      {children}
    </div>
  );
}
