import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getUserOrders } from "@/lib/livka";
import { productTitle } from "@/lib/order-delivery";

export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const expected = process.env.BOT_INTERNAL_SECRET ?? process.env.INTERNAL_SECRET ?? "";
  const got = req.headers.get("x-internal-secret") ?? "";
  if (!expected || got.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

/**
 * Called by the bot for `/orders` and the "📦 Мои заказы" menu.
 * Headers: X-Internal-Secret.
 * Returns the list of orders belonging to the user with this Telegram ID.
 */
export async function GET(
  req: Request,
  context: { params: Promise<{ telegramId: string }> }
) {
  if (!authorized(req)) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const { telegramId } = await context.params;
  if (!telegramId || !/^\d+$/.test(telegramId)) {
    return NextResponse.json({ error: "BAD_TELEGRAM_ID" }, { status: 400 });
  }

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.telegramId, telegramId))
    .limit(1);

  if (!user) {
    return NextResponse.json({ ok: true, orders: [] });
  }

  const rows = await getUserOrders(user.id);
  const orders = rows.map((r) => ({
    orderNo: r.order.orderNo,
    secret: r.order.secret,
    status: r.order.status,
    totalCents: r.order.totalCents,
    assetLabel: r.order.assetLabel,
    networkLabel: r.order.networkLabel,
    amountCrypto: r.order.amountCrypto,
    productSlug: r.product.slug,
    productTitle: productTitle(r.product.slug),
    credentials: r.order.status === "delivered" ? r.order.credentials : null,
    createdAt: r.order.createdAt.toISOString(),
  }));

  return NextResponse.json({ ok: true, orders });
}
