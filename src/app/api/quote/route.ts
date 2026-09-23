import { NextResponse } from "next/server";
import { getProductById, quoteCrypto, getRates } from "@/lib/livka";
import { getNetwork, promoDiscount } from "@/lib/networks";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { productId, networkId, promo } = (await req.json()) ?? {};
    if (typeof productId !== "string" || typeof networkId !== "string") {
      return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
    }
    const product = await getProductById(productId);
    const network = getNetwork(networkId);
    if (!product || !network) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    const discount = promoDiscount(typeof promo === "string" ? promo : "");
    const totalCents = Math.round(product.priceCents * (1 - discount));
    const rates = await getRates();
    const quote = quoteCrypto(totalCents, network, rates);

    return NextResponse.json({
      ok: true,
      totalCents,
      discount,
      amountCrypto: quote.amountCrypto,
      rateLabel: quote.rateLabel,
      usd: quote.usd,
      fee: network.fee,
      assetLabel: network.asset,
      networkLabel: network.net,
      lockedUntil: Date.now() + 15 * 60_000,
    });
  } catch {
    return NextResponse.json({ error: "SERVER" }, { status: 500 });
  }
}
