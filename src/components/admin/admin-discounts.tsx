"use client";

import { useState } from "react";
import {
  Check, Edit3, Flame, LoaderCircle, Percent, Plus, Power, ShieldCheck, Sparkles, Tag, X,
} from "lucide-react";
import type { DiscountRow } from "@/db/schema";
import { money } from "@/lib/wallet-shared";
import { WalletModal } from "@/components/livka/wallet-primitives";

export function AdminDiscountsPanel({
  discounts,
  onChanged,
}: {
  discounts: DiscountRow[];
  onChanged: (text: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState<DiscountRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const toggleDiscount = async (disc: DiscountRow) => {
    setBusyId(disc.id);
    try {
      const res = await fetch("/api/admin/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle", id: disc.id, isActive: !disc.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "SERVER");
      await onChanged(`Скидка "${disc.title}": ${disc.isActive ? "отключена" : "активирована"}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="ad-card" style={{ padding: "24px" }}>
      <div className="ad-card-head" style={{ marginBottom: "20px" }}>
        <div>
          <span>УПРАВЛЕНИЕ ЦЕНАМИ И АКЦИЯМИ</span>
          <h2>Скидки и спецпредложения</h2>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "18px" }}>
        {discounts.map((disc) => {
          const isBusy = busyId === disc.id;
          return (
            <article
              key={disc.id}
              style={{
                background: disc.isActive
                  ? "linear-gradient(145deg, rgba(245, 158, 11, 0.08), rgba(239, 68, 68, 0.05))"
                  : "rgba(255, 255, 255, 0.02)",
                border: disc.isActive ? "1px solid rgba(245, 158, 11, 0.35)" : "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "16px",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
                position: "relative",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span
                  style={{
                    background: disc.isActive ? "#f59e0b" : "#475569",
                    color: "#fff",
                    fontWeight: 800,
                    fontSize: "11px",
                    padding: "3px 10px",
                    borderRadius: "20px",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  {disc.target === "tokens" ? "Токены Claude API" : disc.target}
                </span>

                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => toggleDiscount(disc)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    background: disc.isActive ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                    color: disc.isActive ? "#10b981" : "#ef4444",
                    border: `1px solid ${disc.isActive ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                    borderRadius: "20px",
                    padding: "4px 12px",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <Power size={13} />
                  {disc.isActive ? "Активна" : "Отключена"}
                </button>
              </div>

              <div>
                <h3 style={{ fontSize: "17px", fontWeight: 700, margin: "0 0 4px 0", color: "#fff" }}>{disc.title}</h3>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#f59e0b", fontSize: "13px" }}>
                  <Sparkles size={14} />
                  <b>В честь чего:</b> {disc.reason}
                </div>
              </div>

              <div
                style={{
                  background: "rgba(0,0,0,0.25)",
                  padding: "12px 14px",
                  borderRadius: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <small style={{ color: "#94a3b8", display: "block", fontSize: "11px" }}>БАЗОВАЯ ЦЕНА</small>
                  <s style={{ fontSize: "15px", color: "#ef4444", fontWeight: 700 }}>
                    {money(disc.originalPriceCents, true)}
                  </s>
                </div>

                <div style={{ fontSize: "18px", color: "#94a3b8" }}>→</div>

                <div>
                  <small style={{ color: "#94a3b8", display: "block", fontSize: "11px" }}>ЦЕНА СО СКИДКОЙ</small>
                  <b style={{ fontSize: "19px", color: "#10b981", fontWeight: 800 }}>
                    {money(disc.discountPriceCents, true)}
                  </b>
                  <span style={{ fontSize: "12px", color: "#94a3b8", marginLeft: "4px" }}>/ 1M</span>
                </div>

                <div
                  style={{
                    background: "rgba(239, 68, 68, 0.15)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    color: "#f87171",
                    fontWeight: 800,
                    fontSize: "12px",
                    padding: "4px 8px",
                    borderRadius: "8px",
                  }}
                >
                  -{disc.percentOff}%
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditing(disc)}
                style={{
                  marginTop: "auto",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "10px",
                  color: "#cbd5e1",
                  padding: "9px 14px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Edit3 size={14} /> Настроить цену и акцию
              </button>
            </article>
          );
        })}
      </div>

      {editing && (
        <EditDiscountModal
          discount={editing}
          onClose={() => setEditing(null)}
          onSaved={async (msg) => {
            setEditing(null);
            await onChanged(msg);
          }}
        />
      )}
    </div>
  );
}

function EditDiscountModal({
  discount,
  onClose,
  onSaved,
}: {
  discount: DiscountRow;
  onClose: () => void;
  onSaved: (msg: string) => Promise<void>;
}) {
  const [title, setTitle] = useState(discount.title);
  const [reason, setReason] = useState(discount.reason);
  const [origCents, setOrigCents] = useState(discount.originalPriceCents);
  const [discCents, setDiscCents] = useState(discount.discountPriceCents);
  const [badge, setBadge] = useState(discount.badge);
  const [isActive, setIsActive] = useState(discount.isActive);
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/admin/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          id: discount.id,
          title,
          reason,
          originalPriceCents: origCents,
          discountPriceCents: discCents,
          badge,
          isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "SERVER");
      await onSaved(`Скидка "${title}" сохранена`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <WalletModal title="Настройка скидки и цен" subtitle={`Редактирование тарифа: ${discount.slug}`} onClose={onClose}>
      <form onSubmit={save} className="wk-form" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div>
          <label style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: "4px" }}>
            Название акции
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
          />
        </div>

        <div>
          <label style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: "4px" }}>
            В честь чего (повод / описание акции)
          </label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="В честь открытия"
            required
            style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div>
            <label style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: "4px" }}>
              Базовая цена ($ за 1M)
            </label>
            <input
              type="number"
              step="0.01"
              value={(origCents / 100).toFixed(2)}
              onChange={(e) => setOrigCents(Math.max(1, Math.round(parseFloat(e.target.value || "0") * 100)))}
              required
              style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
            />
          </div>

          <div>
            <label style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: "4px" }}>
              Цена со скидкой ($ за 1M)
            </label>
            <input
              type="number"
              step="0.01"
              value={(discCents / 100).toFixed(2)}
              onChange={(e) => setDiscCents(Math.max(1, Math.round(parseFloat(e.target.value || "0") * 100)))}
              required
              style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
            />
          </div>
        </div>

        <div>
          <label style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: "4px" }}>
            Текст бейджа
          </label>
          <input
            value={badge}
            onChange={(e) => setBadge(e.target.value)}
            placeholder="🔥 Скидка в честь открытия"
            style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "4px" }}>
          <input
            id="disc-active"
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            style={{ width: "18px", height: "18px", cursor: "pointer" }}
          />
          <label htmlFor="disc-active" style={{ fontSize: "14px", color: "#fff", cursor: "pointer" }}>
            Скидка активна (применяется для покупателей)
          </label>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: "10px 18px", borderRadius: "8px", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", cursor: "pointer" }}
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={busy}
            style={{ padding: "10px 22px", borderRadius: "8px", background: "#3b82f6", border: "none", color: "#fff", fontWeight: 700, cursor: "pointer" }}
          >
            {busy ? "Сохраняем…" : "Сохранить изменения"}
          </button>
        </div>
      </form>
    </WalletModal>
  );
}
