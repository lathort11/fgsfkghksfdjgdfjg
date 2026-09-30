import "server-only";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { discounts, adminAudit, type DiscountRow } from "@/db/schema";
import type { SafeUser } from "@/lib/session";
import { adminEnsure } from "@/lib/admin-auth";
import type { TokenDiscount } from "@/lib/tokens-shared";

export async function getActiveTokenDiscount(): Promise<TokenDiscount | null> {
  const [row] = await db
    .select()
    .from(discounts)
    .where(eq(discounts.target, "tokens"))
    .orderBy(desc(discounts.updatedAt))
    .limit(1);

  if (!row || !row.isActive) return null;

  return {
    id: row.id,
    title: row.title,
    reason: row.reason,
    originalPriceCents: row.originalPriceCents,
    discountPriceCents: row.discountPriceCents,
    percentOff: row.percentOff,
    badge: row.badge,
    isActive: row.isActive,
  };
}

export async function listAllDiscounts(): Promise<DiscountRow[]> {
  return db.select().from(discounts).orderBy(desc(discounts.createdAt));
}

export async function adminUpdateDiscount(
  actor: SafeUser,
  params: {
    id: string;
    title: string;
    reason: string;
    originalPriceCents: number;
    discountPriceCents: number;
    badge?: string;
    isActive: boolean;
  }
) {
  const { id, title, reason, originalPriceCents, discountPriceCents, badge, isActive } = params;
  adminEnsure(title.trim().length > 0, "TITLE_REQUIRED");
  adminEnsure(reason.trim().length > 0, "REASON_REQUIRED");
  adminEnsure(originalPriceCents > 0, "INVALID_ORIGINAL_PRICE");
  adminEnsure(discountPriceCents > 0, "INVALID_DISCOUNT_PRICE");

  const percentOff = Math.max(0, Math.round(((originalPriceCents - discountPriceCents) / originalPriceCents) * 100));
  const autoBadge = badge?.trim() || `🔥 ${title}`;

  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(discounts).where(eq(discounts.id, id)).for("update");
    adminEnsure(existing, "DISCOUNT_NOT_FOUND", 404);

    const [updated] = await tx
      .update(discounts)
      .set({
        title: title.trim(),
        reason: reason.trim(),
        originalPriceCents,
        discountPriceCents,
        percentOff,
        badge: autoBadge,
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(discounts.id, id))
      .returning();

    await tx.insert(adminAudit).values({
      actorUserId: actor.id,
      action: "discount.updated",
      details: {
        id,
        title,
        reason,
        originalPriceCents,
        discountPriceCents,
        percentOff,
        isActive,
      },
    });

    return updated;
  });
}

export async function adminToggleDiscount(actor: SafeUser, id: string, isActive: boolean) {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(discounts).where(eq(discounts.id, id)).for("update");
    adminEnsure(existing, "DISCOUNT_NOT_FOUND", 404);

    const [updated] = await tx
      .update(discounts)
      .set({
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(discounts.id, id))
      .returning();

    await tx.insert(adminAudit).values({
      actorUserId: actor.id,
      action: "discount.toggled",
      details: { id, slug: existing.slug, isActive },
    });

    return updated;
  });
}
