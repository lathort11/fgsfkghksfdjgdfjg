import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type CryptoInvoice = {
  invoice_id: number;
  status: "active" | "paid" | "expired";
  currency_type: string;
  fiat?: string;
  amount: string;
  payload?: string;
  bot_invoice_url: string;
  mini_app_invoice_url?: string;
  paid_at?: string;
};

async function call<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const token = process.env.CRYPTO_PAY_API_TOKEN;
  if (!token) throw new Error("PAYMENTS_NOT_CONFIGURED");
  // Only the production endpoint is permitted for the real-money wallet.
  const response = await fetch(`https://pay.crypt.bot/api/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Crypto-Pay-API-Token": token },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  const data = await response.json() as { ok: boolean; result: T };
  if (!response.ok || !data.ok) throw new Error("PAYMENT_PROVIDER_UNAVAILABLE");
  return data.result;
}

export function createInvoice(id: string, amountCents: number, asset?: string) {
  const body: Record<string, unknown> = {
    currency_type: "fiat",
    fiat: "USD",
    amount: (amountCents / 100).toFixed(2),
    description: "LIVKAMARKET balance top-up",
    payload: id,
    allow_comments: false,
    allow_anonymous: false,
    expires_in: 600, // 10 minutes limit
  };
  if (asset && asset !== "Crypto Bot" && asset !== "crypto_bot" && asset !== "Crypto Pay") {
    body.accepted_assets = asset;
  } else {
    body.accepted_assets = "USDT,TON,BTC,ETH,LTC,BNB,TRX,USDC";
  }
  return call<CryptoInvoice>("createInvoice", body);
}

export async function deleteInvoice(id: number | string): Promise<boolean> {
  try {
    const invoiceId = Number(id);
    if (!Number.isSafeInteger(invoiceId)) return false;
    return await call<boolean>("deleteInvoice", { invoice_id: invoiceId });
  } catch {
    return false;
  }
}

export async function getInvoice(id: string): Promise<CryptoInvoice> {
  const result = await call<{ items: CryptoInvoice[] }>("getInvoices", { invoice_ids: id });
  const invoice = result.items.find((item) => String(item.invoice_id) === id);
  if (!invoice) throw new Error("INVOICE_NOT_FOUND");
  return invoice;
}

export function verifyPaymentSignature(raw: string, signature: string | null): boolean {
  const token = process.env.CRYPTO_PAY_API_TOKEN;
  if (!token || !signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const key = createHash("sha256").update(token).digest();
  const expected = createHmac("sha256", key).update(raw).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
