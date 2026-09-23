import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createOrder } from "@/lib/livka";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "AUTH" }, { status: 401 });

  try {
    const { productId, networkId, promo } = (await req.json()) ?? {};
    if (typeof productId !== "string" || typeof networkId !== "string") {
      return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
    }

    const { order, network, quote, discount } = await createOrder({
      userId: user.id,
      productId,
      networkId,
      promo: typeof promo === "string" ? promo : undefined,
    });

    return NextResponse.json({
      ok: true,
      order: {
        id: order.id,
        orderNo: order.orderNo,
        secret: order.secret,
        status: order.status,
        totalCents: order.totalCents,
        discount,
        networkId: network.id,
        networkLabel: network.net,
        assetLabel: network.asset,
        depositAddress: network.address,
        amountCrypto: quote.amountCrypto,
        usd: quote.usd,
        rateLabel: quote.rateLabel,
        fee: network.fee,
      },
    });
  } catch (e) {
    const code = e instanceof Error ? e.message : "SERVER";
    return NextResponse.json({ error: code }, { status: 400 });
  }
}
