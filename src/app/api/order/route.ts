import { purchaseWithBalance } from "@/lib/wallet";
import { walletUser, readBody, walletFailure } from "@/lib/wallet-security";
import { deliverOrderToTelegram } from "@/lib/order-delivery";

export async function POST(req: Request) {
  try {
    const user = await walletUser(req);
    const body = await readBody(req);
    const result = await purchaseWithBalance(user.id, body);
    let sentToTelegram = false;
    if (!result.demo && result.justDelivered && user.telegramId) {
      sentToTelegram = await deliverOrderToTelegram(result, user.telegramId).catch(() => false);
    }
    return Response.json({ ok: true, demo: result.demo, order: result.order, sentToTelegram });
  } catch (error) { return walletFailure(error); }
}
