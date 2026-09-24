import "server-only";
import type { OrderRow, ProductRow } from "@/db/schema";
import { DICTS } from "@/lib/i18n";
import { notifyBotOrderPaid } from "@/lib/bot-webhook";

export function productTitle(slug: string): string {
  const dict = DICTS.ru.products as Record<string, { name?: string } | undefined>;
  return dict[slug]?.name ?? slug;
}

/**
 * Push a delivered order (receipt + credentials) into the buyer's Telegram
 * chat via the bot Gateway. Returns false when not delivered (no Telegram,
 * no credentials, gateway down) — the order itself stays valid on the site.
 */
export async function deliverOrderToTelegram(
  row: { order: OrderRow; product: ProductRow },
  telegramId: string | null | undefined
): Promise<boolean> {
  const { order, product } = row;
  if (!telegramId || order.status !== "delivered" || !order.credentials) return false;
  return notifyBotOrderPaid({
    telegramId,
    orderNo: order.orderNo,
    orderSecret: order.secret,
    productSlug: product.slug,
    productTitle: productTitle(product.slug),
    kind: product.kind,
    totalCents: order.totalCents,
    network: order.networkLabel,
    asset: order.assetLabel,
    amountCrypto: order.amountCrypto,
    txHash: order.txHash ?? "",
    credentials: order.credentials,
    paidAt: order.updatedAt.toISOString(),
  });
}
