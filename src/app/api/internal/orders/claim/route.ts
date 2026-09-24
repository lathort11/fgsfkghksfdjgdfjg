import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getOrderBySecret, assignOrderToUser } from "@/lib/livka";
import { getUserById, upsertTelegramUser } from "@/lib/session";
import { deliverOrderToTelegram, productTitle } from "@/lib/order-delivery";

export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const expected = process.env.BOT_INTERNAL_SECRET ?? process.env.INTERNAL_SECRET ?? "";
  const got = req.headers.get("x-internal-secret") ?? "";
  if (!expected || got.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

/**
 * Called by the bot for `/claim <secret>`.
 * Headers: X-Internal-Secret. Body: { secret, telegramId, firstName?, username? }
 * Links the order to the Telegram user's site account and returns the order
 * (credentials included when delivered); also pushes it via order-paid.
 */
export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = ((await req.json()) ?? {}) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "BAD_PAYLOAD" }, { status: 400 });
  }
  const secret = typeof body.secret === "string" ? body.secret.trim() : "";
  const telegramId = body.telegramId != null ? String(body.telegramId) : "";
  if (!/^\d{6}$/.test(secret) || !/^\d+$/.test(telegramId)) {
    return NextResponse.json({ error: "BAD_PAYLOAD" }, { status: 400 });
  }

  const row = await getOrderBySecret(secret);
  if (!row) return NextResponse.json({ error: "ORDER_NOT_FOUND" }, { status: 404 });

  const tgUser = {
    id: telegramId,
    firstName: typeof body.firstName === "string" ? body.firstName : "",
    username: typeof body.username === "string" ? body.username : null,
  };

  // Ownership rules (checked before anything is written):
  //  · owner already bound to this Telegram ID   → just deliver
  //  · owner bound to another Telegram ID        → 409
  //  · owner is an e-mail account without Telegram:
  //      Telegram ID not used by any site account → link it to the owner
  //      otherwise                                → move the order to it
  //  · no owner                                  → Telegram account takes it
  const owner = row.order.userId ? await getUserById(row.order.userId) : null;
  if (owner?.telegramId && owner.telegramId !== telegramId) {
    return NextResponse.json({ error: "ALREADY_CLAIMED" }, { status: 409 });
  }
  if (!owner?.telegramId) {
    const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.telegramId, telegramId)).limit(1);
    if (owner && !taken) {
      await db
        .update(users)
        .set({ telegramId, ...(tgUser.username ? { telegramUsername: tgUser.username } : {}) })
        .where(eq(users.id, owner.id));
    } else {
      const user = await upsertTelegramUser(tgUser);
      await assignOrderToUser(row.order.id, user.id);
    }
  }

  const delivered = row.order.status === "delivered";
  const sentToTelegram = delivered ? await deliverOrderToTelegram(row, telegramId) : false;

  return NextResponse.json({
    ok: true,
    sentToTelegram,
    order: {
      orderNo: row.order.orderNo,
      status: row.order.status,
      productSlug: row.product.slug,
      productTitle: productTitle(row.product.slug),
      totalCents: row.order.totalCents,
      network: row.order.networkLabel,
      asset: row.order.assetLabel,
      amountCrypto: row.order.amountCrypto,
      credentials: delivered ? row.order.credentials : null,
    },
  });
}
