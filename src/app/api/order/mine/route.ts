import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getUserOrders } from "@/lib/livka";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "AUTH" }, { status: 401 });

  const rows = await getUserOrders(user.id);
  return NextResponse.json({
    ok: true,
    orders: rows.map((r) => ({
      orderNo: r.order.orderNo,
      secret: r.order.secret,
      status: r.order.status,
      totalCents: r.order.totalCents,
      assetLabel: r.order.assetLabel,
      networkLabel: r.order.networkLabel,
      amountCrypto: r.order.amountCrypto,
      productSlug: r.product.slug,
      credentials: r.order.credentials,
      createdAt: r.order.createdAt,
    })),
  });
}
