"use client";

import { useState } from "react";
import {
  Calendar, Check, Edit3, Eye, EyeOff, MessageSquare, Newspaper, Pin, Plus, Trash2, X,
} from "lucide-react";
import type { NewsRow } from "@/db/schema";
import { WalletModal } from "@/components/livka/wallet-primitives";

export function AdminNewsPanel({
  news,
  onChanged,
}: {
  news: NewsRow[];
  onChanged: (text: string) => Promise<void>;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<NewsRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const togglePublish = async (item: NewsRow) => {
    setBusyId(item.id);
    try {
      const res = await fetch("/api/admin/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle-publish", id: item.id, isPublished: !item.isPublished }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "SERVER");
      await onChanged(`Новость "${item.title}": ${item.isPublished ? "скрыта" : "опубликована"}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  };

  const deleteNews = async (item: NewsRow) => {
    if (!window.confirm(`Удалить новость "${item.title}"?`)) return;
    setBusyId(item.id);
    try {
      const res = await fetch("/api/admin/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id: item.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "SERVER");
      await onChanged(`Новость "${item.title}" удалена`);
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
          <span>ЛЕНТА НОВОСТЕЙ И АНОНСОВ</span>
          <h2>Новости платформы</h2>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: "#3b82f6",
            color: "#fff",
            border: "none",
            borderRadius: "10px",
            padding: "9px 16px",
            fontWeight: 700,
            fontSize: "13px",
            cursor: "pointer",
          }}
        >
          <Plus size={16} /> Написать новость
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {news.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
            <Newspaper size={36} style={{ margin: "0 auto 12px", opacity: 0.5 }} />
            <p>Новостей пока нет. Нажмите «Написать новость», чтобы опубликовать первый анонс.</p>
          </div>
        ) : (
          news.map((item) => {
            const isBusy = busyId === item.id;
            const dateStr = new Date(item.createdAt).toLocaleDateString("ru-RU", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <article
                key={item.id}
                style={{
                  background: item.isPublished ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.2)",
                  border: item.isPinned
                    ? "1px solid rgba(59, 130, 246, 0.4)"
                    : "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "14px",
                  padding: "18px 20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  opacity: item.isPublished ? 1 : 0.6,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {item.isPinned && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "rgba(59, 130, 246, 0.15)", color: "#60a5fa", border: "1px solid rgba(59, 130, 246, 0.3)", borderRadius: "6px", padding: "2px 8px", fontSize: "11px", fontWeight: 700 }}>
                        <Pin size={11} /> Закреплено
                      </span>
                    )}
                    <span style={{ background: "rgba(245, 158, 11, 0.15)", color: "#fbbf24", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: "6px", padding: "2px 8px", fontSize: "11px", fontWeight: 700 }}>
                      {item.tag}
                    </span>
                    <span style={{ color: "#94a3b8", fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
                      <Calendar size={13} /> {dateStr}
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => togglePublish(item)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        background: item.isPublished ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
                        color: item.isPublished ? "#10b981" : "#ef4444",
                        border: `1px solid ${item.isPublished ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                        borderRadius: "16px",
                        padding: "4px 10px",
                        fontSize: "11px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {item.isPublished ? <Eye size={12} /> : <EyeOff size={12} />}
                      {item.isPublished ? "Опубликовано" : "Черновик"}
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditing(item)}
                      style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", padding: "4px" }}
                      title="Редактировать"
                    >
                      <Edit3 size={15} />
                    </button>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => deleteNews(item)}
                      style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", padding: "4px" }}
                      title="Удалить"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#fff", margin: 0 }}>{item.title}</h3>
                <p style={{ fontSize: "13px", color: "#cbd5e1", lineHeight: "1.6", whiteSpace: "pre-line", margin: 0 }}>
                  {item.content}
                </p>

                <div style={{ color: "#64748b", fontSize: "11px" }}>
                  Автор: <b>{item.authorName}</b>
                </div>
              </article>
            );
          })
        )}
      </div>

      {createOpen && (
        <NewsModal
          onClose={() => setCreateOpen(false)}
          onSaved={async (msg) => {
            setCreateOpen(false);
            await onChanged(msg);
          }}
        />
      )}

      {editing && (
        <NewsModal
          initialNews={editing}
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

function NewsModal({
  initialNews,
  onClose,
  onSaved,
}: {
  initialNews?: NewsRow;
  onClose: () => void;
  onSaved: (msg: string) => Promise<void>;
}) {
  const [title, setTitle] = useState(initialNews?.title ?? "");
  const [content, setContent] = useState(initialNews?.content ?? "");
  const [tag, setTag] = useState(initialNews?.tag ?? "Обновление");
  const [isPinned, setIsPinned] = useState(initialNews?.isPinned ?? false);
  const [isPublished, setIsPublished] = useState(initialNews?.isPublished ?? true);
  const [authorName, setAuthorName] = useState(initialNews?.authorName ?? "Администрация");
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const isEdit = !!initialNews;
      const res = await fetch("/api/admin/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: isEdit ? "update" : "create",
          ...(isEdit ? { id: initialNews.id } : {}),
          title,
          content,
          tag,
          isPinned,
          isPublished,
          authorName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "SERVER");
      await onSaved(isEdit ? `Новость "${title}" обновлена` : `Новость "${title}" создана`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <WalletModal
      title={initialNews ? "Редактирование новости" : "Создать новость"}
      subtitle={initialNews ? `Редактирование: ${initialNews.title}` : "Публикация объявления для пользователей"}
      onClose={onClose}
      wide
    >
      <form onSubmit={save} className="wk-form" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div>
          <label style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: "4px" }}>
            Заголовок новости
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Например: Запуск новых моделей Claude Opus 5.5!"
            required
            style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div>
            <label style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: "4px" }}>
              Категория / Тег
            </label>
            <select
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
            >
              <option value="Обновление">Обновление</option>
              <option value="Акция">Акция / Скидка</option>
              <option value="Новость">Новость</option>
              <option value="Важно">Важно</option>
              <option value="Техработы">Техработы</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: "4px" }}>
              Автор
            </label>
            <input
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="Администрация"
              style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
            />
          </div>
        </div>

        <div>
          <label style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: "4px" }}>
            Текст новости
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            placeholder="Подробный текст новости или анонса…"
            required
            style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", resize: "vertical" }}
          />
        </div>

        <div style={{ display: "flex", gap: "20px", marginTop: "4px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#fff", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              style={{ width: "16px", height: "16px" }}
            />
            Закрепить вверху
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#fff", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
              style={{ width: "16px", height: "16px" }}
            />
            Опубликовать сразу
          </label>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
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
            {busy ? "Сохраняем…" : initialNews ? "Сохранить изменения" : "Опубликовать"}
          </button>
        </div>
      </form>
    </WalletModal>
  );
}
