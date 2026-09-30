import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { news, adminAudit, type NewsRow } from "@/db/schema";
import type { SafeUser } from "@/lib/session";
import { adminEnsure } from "@/lib/admin-auth";

export async function getPublishedNews(): Promise<NewsRow[]> {
  return db
    .select()
    .from(news)
    .where(eq(news.isPublished, true))
    .orderBy(desc(news.isPinned), desc(news.createdAt));
}

export async function listAllNews(): Promise<NewsRow[]> {
  return db
    .select()
    .from(news)
    .orderBy(desc(news.isPinned), desc(news.createdAt));
}

export async function adminCreateNews(
  actor: SafeUser,
  params: {
    title: string;
    content: string;
    tag?: string;
    isPinned?: boolean;
    isPublished?: boolean;
    authorName?: string;
  }
) {
  const { title, content, tag = "Обновление", isPinned = false, isPublished = true, authorName = "Администрация" } = params;
  adminEnsure(title.trim().length > 0, "TITLE_REQUIRED");
  adminEnsure(content.trim().length > 0, "CONTENT_REQUIRED");

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(news)
      .values({
        title: title.trim(),
        content: content.trim(),
        tag: tag.trim() || "Обновление",
        isPinned: Boolean(isPinned),
        isPublished: Boolean(isPublished),
        authorName: authorName.trim() || "Администрация",
      })
      .returning();

    await tx.insert(adminAudit).values({
      actorUserId: actor.id,
      action: "news.created",
      details: { id: created.id, title: created.title, tag: created.tag },
    });

    return created;
  });
}

export async function adminUpdateNews(
  actor: SafeUser,
  params: {
    id: string;
    title: string;
    content: string;
    tag?: string;
    isPinned?: boolean;
    isPublished?: boolean;
    authorName?: string;
  }
) {
  const { id, title, content, tag = "Обновление", isPinned = false, isPublished = true, authorName = "Администрация" } = params;
  adminEnsure(title.trim().length > 0, "TITLE_REQUIRED");
  adminEnsure(content.trim().length > 0, "CONTENT_REQUIRED");

  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(news).where(eq(news.id, id)).for("update");
    adminEnsure(existing, "NEWS_NOT_FOUND", 404);

    const [updated] = await tx
      .update(news)
      .set({
        title: title.trim(),
        content: content.trim(),
        tag: tag.trim() || "Обновление",
        isPinned: Boolean(isPinned),
        isPublished: Boolean(isPublished),
        authorName: authorName.trim() || "Администрация",
        updatedAt: new Date(),
      })
      .where(eq(news.id, id))
      .returning();

    await tx.insert(adminAudit).values({
      actorUserId: actor.id,
      action: "news.updated",
      details: { id, title: updated.title },
    });

    return updated;
  });
}

export async function adminDeleteNews(actor: SafeUser, id: string) {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(news).where(eq(news.id, id)).for("update");
    adminEnsure(existing, "NEWS_NOT_FOUND", 404);

    await tx.delete(news).where(eq(news.id, id));

    await tx.insert(adminAudit).values({
      actorUserId: actor.id,
      action: "news.deleted",
      details: { id, title: existing.title },
    });

    return { ok: true };
  });
}

export async function adminToggleNewsPublish(actor: SafeUser, id: string, isPublished: boolean) {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(news).where(eq(news.id, id)).for("update");
    adminEnsure(existing, "NEWS_NOT_FOUND", 404);

    const [updated] = await tx
      .update(news)
      .set({
        isPublished,
        updatedAt: new Date(),
      })
      .where(eq(news.id, id))
      .returning();

    await tx.insert(adminAudit).values({
      actorUserId: actor.id,
      action: "news.toggled",
      details: { id, isPublished },
    });

    return updated;
  });
}
