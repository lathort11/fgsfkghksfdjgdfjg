"use client";

import { useEffect, useState } from "react";
import { Calendar, Flame, Newspaper, Pin, Sparkles, Tag, X } from "lucide-react";
import type { NewsRow } from "@/db/schema";
import { WalletModal } from "@/components/livka/wallet-primitives";
import { useW } from "@/components/livka/i18n-context";

export function UserNewsModal({ onClose }: { onClose: () => void }) {
  const { w, intl } = useW();
  const [items, setItems] = useState<NewsRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/news")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && Array.isArray(data.news)) {
          setItems(data.news);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <WalletModal
      title={w.newsModal.title}
      subtitle={w.newsModal.subtitle}
      onClose={onClose}
      wide
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "14px", maxHeight: "65vh", overflowY: "auto", paddingRight: "4px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "30px", color: "#94a3b8" }}>
            {w.newsModal.loading}
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px", color: "#94a3b8" }}>
            <Newspaper size={32} style={{ margin: "0 auto 10px", opacity: 0.5 }} />
            <p>{w.newsModal.emptyText}</p>
          </div>
        ) : (
          items.map((item) => {
            const dateStr = new Date(item.createdAt).toLocaleDateString(intl, {
              day: "numeric",
              month: "short",
              year: "numeric",
            });

            return (
              <article
                key={item.id}
                style={{
                  background: item.isPinned
                    ? "linear-gradient(145deg, rgba(59, 130, 246, 0.08), rgba(245, 158, 11, 0.06))"
                    : "rgba(255, 255, 255, 0.03)",
                  border: item.isPinned
                    ? "1px solid rgba(59, 130, 246, 0.35)"
                    : "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "14px",
                  padding: "18px 20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {item.isPinned && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "rgba(59, 130, 246, 0.2)", color: "#60a5fa", border: "1px solid rgba(59, 130, 246, 0.4)", borderRadius: "6px", padding: "2px 8px", fontSize: "11px", fontWeight: 700 }}>
                        <Pin size={11} /> {w.newsModal.pinned}
                      </span>
                    )}
                    <span style={{ background: "rgba(245, 158, 11, 0.15)", color: "#fbbf24", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: "6px", padding: "2px 8px", fontSize: "11px", fontWeight: 700 }}>
                      {item.tag}
                    </span>
                  </div>

                  <span style={{ color: "#94a3b8", fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
                    <Calendar size={13} /> {dateStr}
                  </span>
                </div>

                <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#fff", margin: 0 }}>
                  {item.title}
                </h3>

                <p style={{ fontSize: "13px", color: "#cbd5e1", lineHeight: "1.6", whiteSpace: "pre-line", margin: 0 }}>
                  {item.content}
                </p>

                <div style={{ color: "#64748b", fontSize: "11px", marginTop: "2px" }}>
                  {item.authorName}
                </div>
              </article>
            );
          })
        )}
      </div>
    </WalletModal>
  );
}
