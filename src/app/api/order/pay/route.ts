import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { payOrder } from "@/lib/livka";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "AUTH" }, { status: 401 });

  try {
    const { secret, txHash } = (await req.json()) ?? {};
    if (typeof secret !== "string" || typeof txHash !== "string" || txHash.trim().length < 8) {
      return NextResponse.json({ error: "BAD_TX" }, { status: 400 });
    }

    const row = await payOrder({ userId: user.id, secret, txHash });
    return NextResponse.json({
      ok: true,
      order: {
        orderNo: row.order.orderNo,
        secret: row.order.secret,
        status: row.order.status,
        totalCents: row.order.totalCents,
        assetLabel: row.order.assetLabel,
        amountCrypto: row.order.amountCrypto,
        credentials: row.order.credentials,
        productSlug: row.product.slug,
      },
    });
  } catch (e) {
    const code = e instanceof Error ? e.message : "SERVER";
    return NextResponse.json({ error: code }, { status: 400 });
  }
}
