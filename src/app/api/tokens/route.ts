import { eq } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { tokenSnapshot, purchaseTokens } from "@/lib/tokens";
import { walletUser, readBody, walletFailure } from "@/lib/wallet-security";
import { deliverOrderToTelegram } from "@/lib/order-delivery";

export const dynamic = "force-dynamic";

/** Public: models and rates. Authenticated: API key, token balances and wallet balance. */
export async function GET() {
  try {
    const user = await getCurrentUser();
    return Response.json(await tokenSnapshot(user?.id ?? null), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return walletFailure(error); }
}

export async function POST(req: Request) {
  try {
    const user = await walletUser(req);
    const body = await readBody(req);
    const result = await purchaseTokens(user.id, body);
    let sentToTelegram = false;
    if (result.justDelivered && user.telegramId) {
      const [product] = await db.select().from(products).where(eq(products.id, result.order.productId)).limit(1);
      if (product) sentToTelegram = await deliverOrderToTelegram({ order: result.order, product }, user.telegramId).catch(() => false);
    }
    return Response.json({ ok: true, order: result.order, apiKey: result.apiKey, tokens: await tokenSnapshot(user.id), sentToTelegram });
  } catch (error) { return walletFailure(error); }
}
