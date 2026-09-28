"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X, AlertCircle, LoaderCircle, ShieldCheck } from "lucide-react";

export const WALLET_ERRORS: Record<string, string> = {
  AUTH: "Войдите в аккаунт, чтобы продолжить.",
  INVALID_AMOUNT: "Проверьте сумму и допустимые лимиты.",
  INVALID_REQUEST: "Проверьте введённые данные и попробуйте ещё раз.",
  INVALID_ADDRESS: "Введите корректный адрес USDT в сети TRC-20, начинающийся с T.",
  INSUFFICIENT_BALANCE: "На балансе недостаточно средств. Пополните кошелёк.",
  WITHDRAWAL_HOLD: "После реального пополнения средства доступны для вывода через 24 часа. Покупки доступны сразу.",
  WITHDRAWAL_PENDING: "У вас уже есть заявка на вывод. Дождитесь проверки или отмените её в истории.",
  VERIFICATION_REQUIRED: "Для первого реального вывода необходимо пройти проверку у поддержки.",
  PASSWORD_REQUIRED: "Перед выводом задайте пароль в настройках аккаунта.",
  WRONG_PASSWORD: "Неверный пароль. Проверьте его и повторите попытку.",
  WALLET_BLOCKED: "Операции временно ограничены. Обратитесь в поддержку.",
  DAILY_LIMIT: "Лимит вывода за последние 24 часа — 50 000 ₽.",
  RATE_LIMIT: "Слишком много запросов. Пожалуйста, подождите и повторите попытку.",
  OUT_OF_STOCK: "Доступы закончились. Средства не списаны.",
  PRICE_CHANGED: "Цена обновилась. Закройте окно и обновите каталог перед покупкой.",
  TOO_MANY_INVOICES: "Завершите или проверьте существующие пополнения в истории (не больше 5 счетов).",
  BALANCE_LIMIT: "Достигнут лимит баланса с учётом ожидаемых пополнений.",
  PAYMENTS_NOT_CONFIGURED: "Реальные платежи ещё не подключены. Свяжитесь с поддержкой.",
  PAYMENT_PROVIDER_UNAVAILABLE: "Платёжный сервис временно недоступен. Попробуйте позже.",
  CANNOT_CANCEL: "Эту операцию уже нельзя отменить. Обновите историю.",
  IDEMPOTENCY_CONFLICT: "Параметры операции изменились. Откройте форму заново.",
  FORBIDDEN: "Запрос отклонён. Обновите страницу и попробуйте снова.",
};
export function errorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : "";
  return WALLET_ERRORS[code] ?? "Не удалось выполнить операцию. Средства не потеряны — проверьте историю и повторите запрос.";
}
export async function walletRequest<T>(url: string, body?: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "SERVER_ERROR");
  return data as T;
}
export function useRequestKey() {
  const ref = useRef({ signature: "", key: "" });
  return (payload: Record<string, unknown>) => {
    const signature = JSON.stringify(payload);
    if (ref.current.signature !== signature) ref.current = { signature, key: crypto.randomUUID() };
    return ref.current.key;
  };
}
export function WalletModal({ title, subtitle, children, onClose, wide = false }: { title: string; subtitle?: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const root = ref.current;
    root?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close.current();
      if (event.key !== "Tab" || !root) return;
      const elements = [...root.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea, [tabindex="0"]')];
      if (!elements.length) { event.preventDefault(); return; }
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === root)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === root)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.documentElement.style.overflow = overflow; document.removeEventListener("keydown", keydown); previous?.focus(); };
  }, []);
  return <div className="wk-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className={`wk-modal ${wide ? "wk-modal-wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1} ref={ref}>
      <div className="wk-modal-heading"><div><span className="wk-eyebrow">LIVKA WALLET</span><h2 id={id}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="wk-icon-button" aria-label="Закрыть окно" onClick={onClose}><X size={19} /></button></div>
      {children}
    </div>
  </div>;
}
export function WalletErrorBox({ error }: { error: string | null }) { return error ? <div className="wk-error" role="alert"><AlertCircle size={17} /><span>{error}</span></div> : null; }
export function Busy({ text = "Подождите…" }: { text?: string }) { return <><LoaderCircle size={17} className="wk-spin" />{text}</>; }
export function DemoNotice() { return <div className="wk-demo-note"><ShieldCheck size={17} /><span><b>Демонстрационный режим.</b> Только тестовые средства, без реальных переводов.</span></div>; }
export function SummaryRow({ label, children, strong = false }: { label: string; children: ReactNode; strong?: boolean }) { return <div className={`wk-summary-row ${strong ? "is-total" : ""}`}><span>{label}</span><strong>{children}</strong></div>; }
