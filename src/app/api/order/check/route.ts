import { NextResponse } from "next/server";
import { getOrderBySecret } from "@/lib/livka";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret") ?? "";
  if (!/^\d{6}$/.test(secret)) {
    return NextResponse.json({ error: "BAD_CODE" }, { status: 400 });
  }

  const row = await getOrderBySecret(secret);
  if (!row) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    orderNo: row.order.orderNo,
    status: row.order.status,
    productSlug: row.product.slug,
    totalCents: row.order.totalCents,
    assetLabel: row.order.assetLabel,
    amountCrypto: row.order.amountCrypto,
    txHash: row.order.txHash,
    credentials: row.order.status === "delivered" ? row.order.credentials : null,
    createdAt: row.order.createdAt,
  });
}
