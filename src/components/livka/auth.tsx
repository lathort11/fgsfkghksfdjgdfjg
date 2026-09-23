"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/livka/i18n-context";
import { Sparkle, XIcon, LogOut, Receipt, UserIcon, Lock, Check } from "@/components/livka/icons";

export type SessionUser = { id: string; email: string; name: string; createdAt?: string };

const inputStyle = {
  background: "rgba(255,255,255,.04)",
  border: "1px solid var(--line)",
  color: "var(--ink)",
} as const;

/* ═══════════ AUTH MODAL ═══════════ */
export function AuthModal({
  open,
  reason,
  onClose,
  onSuccess,
}: {
  open: boolean;
  reason?: string | null;
  onClose: () => void;
  onSuccess: (u: SessionUser) => void;
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState<"login" | "register">("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setPass("");
      document.documentElement.style.overflow = "hidden";
    } else {
      document.documentElement.style.overflow = "";
    }
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

  if (!open) return null;

  const errText = (code: string) => {
    const a = t.auth;
    if (code === "NAME") return a.errorName;
    if (code === "EMAIL") return a.errorEmail;
    if (code === "PASSWORD") return a.errorPass;
    if (code === "EXISTS") return a.errorExists;
    if (code === "CREDS") return a.errorCreds;
    return a.errorCreds;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (tab === "register" && name.trim().length < 2) {
      setError(t.auth.errorName);
      return;
    }
    if (pass.length < 6) {
      setError(t.auth.errorPass);
      return;
    }
    setLoading(true);
    try {
      const url = tab === "register" ? "/api/auth/register" : "/api/auth/login";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          tab === "register" ? { name, email, password: pass } : { email, password: pass }
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "ERROR");
      onSuccess(data.user as SessionUser);
    } catch (err) {
      setError(errText(err instanceof Error ? err.message : "ERROR"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4"
      style={{ background: "rgba(5,5,11,.88)", backdropFilter: "blur(18px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md glass p-7 sm:p-8 modal-in"
        style={{ borderRadius: 28 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="close"
          className="absolute top-4 right-4 flex items-center justify-center w-9 h-9 rounded-full transition-colors hover:bg-white/10"
          style={{ border: "1px solid var(--line)", color: "var(--ink-2)" }}
        >
          <XIcon className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <span
            className="flex items-center justify-center w-11 h-11 rounded-2xl"
            style={{ background: "linear-gradient(135deg,#7c5cff,#4f8cff)" }}
          >
            <Lock className="w-5 h-5 text-white" />
          </span>
          <div>
            <div className="ff-d text-base font-bold text-white">{t.checkout.title}</div>
            <div className="text-xs" style={{ color: "var(--ink-3)" }}>
              LIVKAMARKET
            </div>
          </div>
        </div>

        {reason && (
          <div
            className="mb-5 px-4 py-3 rounded-xl text-sm flex items-start gap-2.5"
            style={{
              background: "rgba(124,92,255,.1)",
              border: "1px solid rgba(124,92,255,.22)",
              color: "#c4b5fd",
            }}
          >
            <Sparkle className="w-4 h-4 mt-0.5 shrink-0" />
            {reason}
          </div>
        )}

        {/* tabs */}
        <div className="relative flex p-1 rounded-2xl mb-6" style={{ background: "rgba(255,255,255,.04)" }}>
          <div
            className="absolute top-1 bottom-1 rounded-xl transition-all duration-500"
            style={{
              width: "calc(50% - 4px)",
              left: tab === "register" ? 4 : "calc(50% + 0px)",
              background: "linear-gradient(135deg,rgba(124,92,255,.9),rgba(79,140,255,.9))",
              boxShadow: "0 6px 20px -8px rgba(124,92,255,.8)",
            }}
          />
          {(["register", "login"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setTab(k);
                setError(null);
              }}
              className="relative z-10 flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              style={{ color: tab === k ? "#fff" : "var(--ink-3)" }}
            >
              {k === "register" ? t.auth.register : t.auth.login}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-4">
          {tab === "register" && (
            <Field label={t.auth.name}>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.auth.namePh}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none focus:border-white/25 transition-colors"
                style={inputStyle}
              />
            </Field>
          )}

          <Field label={t.auth.email}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.auth.emailPh}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none focus:border-white/25 transition-colors"
              style={inputStyle}
            />
          </Field>

          <Field label={t.auth.password}>
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder={t.auth.passwordPh}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none focus:border-white/25 transition-colors"
              style={inputStyle}
            />
          </Field>

          {error && (
            <div
              className="text-xs px-3 py-2.5 rounded-lg"
              style={{
                background: "rgba(244,63,94,.1)",
                color: "#fb7185",
                border: "1px solid rgba(244,63,94,.2)",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full !py-3.5 text-sm disabled:opacity-60"
          >
            {loading ? "…" : tab === "register" ? t.auth.registerBtn : t.auth.loginBtn}
          </button>

          <button
            type="button"
            onClick={() => setTab(tab === "register" ? "login" : "register")}
            className="w-full text-center text-xs transition-colors hover:text-white"
            style={{ color: "var(--ink-3)" }}
          >
            {tab === "register" ? t.auth.haveAccount : t.auth.noAccount}{" "}
            <span className="font-semibold" style={{ color: "#a78bfa" }}>
              {tab === "register" ? t.auth.login : t.auth.register}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        className="block text-[11px] font-semibold uppercase tracking-[0.14em] mb-2"
        style={{ color: "var(--ink-3)" }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

/* ═══════════ ACCOUNT BUTTON + MENU ═══════════ */
export function AccountMenu({
  user,
  onOpenOrders,
  onOpenProfile,
  onLogout,
}: {
  user: SessionUser | null;
  onOpenOrders: () => void;
  onOpenProfile: () => void;
  onLogout: () => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const close = () => setOpen(false);
    if (open) {
      window.addEventListener("click", close);
      return () => window.removeEventListener("click", close);
    }
  }, [open]);

  if (!user) return null;

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-2xl transition-all hover:bg-white/[0.07]"
        style={{ border: "1px solid var(--line)", background: "rgba(255,255,255,.03)" }}
      >
        <span
          className="flex items-center justify-center w-7 h-7 rounded-xl ff-d text-[11px] font-bold text-white"
          style={{ background: "linear-gradient(135deg,#7c5cff,#4f8cff)" }}
        >
          {user.name.trim().charAt(0).toUpperCase() || "U"}
        </span>
        <span className="hidden lg:inline text-xs font-semibold text-white/90 max-w-[110px] truncate">
          {user.name.split(" ")[0]}
        </span>
      </button>

      <div
        className="absolute right-0 top-[calc(100%+10px)] w-60 glass p-2 transition-all duration-300"
        style={{
          borderRadius: 20,
          opacity: open ? 1 : 0,
          transform: open ? "translateY(0)" : "translateY(-8px)",
          pointerEvents: open ? "auto" : "none",
        }}
      >
        <div className="px-3 py-3">
          <div className="text-[11px] uppercase tracking-widest" style={{ color: "var(--ink-3)" }}>
            {t.auth.hello}
          </div>
          <div className="text-sm font-semibold text-white truncate">{user.name}</div>
          <div className="text-[11px] truncate mt-0.5" style={{ color: "var(--ink-3)" }}>
            {user.email}
          </div>
        </div>
        <div className="h-px my-1" style={{ background: "var(--line)" }} />
        <MenuItem icon={<UserIcon className="w-4 h-4" />} label={t.profile.title} onClick={onOpenProfile} />
        <MenuItem icon={<Receipt className="w-4 h-4" />} label={t.auth.myOrders} onClick={onOpenOrders} />
        <MenuItem icon={<LogOut className="w-4 h-4" />} label={t.auth.logout} onClick={onLogout} danger />
      </div>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors hover:bg-white/[0.07]"
      style={{ color: danger ? "#fb7185" : "var(--ink-2)" }}
    >
      {icon}
      {label}
    </button>
  );
}

/* ═══════════ LOGIN PROMPT BUTTON ═══════════ */
export function LoginButton({ onClick }: { onClick: () => void }) {
  const { t } = useI18n();
  return (
    <button
      onClick={onClick}
      className="btn btn-ghost !py-2.5 !px-4 text-sm"
    >
      <UserIcon className="w-4 h-4" />
      {t.auth.login}
    </button>
  );
}

/* ═══════════ SUCCESS BANNER ═══════════ */
export function AuthSuccess({ name }: { name: string }) {
  const { t } = useI18n();
  return (
    <span className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
      <Check className="w-4 h-4" />
      {t.auth.welcome}, {name}
    </span>
  );
}
