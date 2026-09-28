import { eq } from "drizzle-orm";
import { db } from "@/db";
import { walletOperations } from "@/db/schema";
import { verifyPaymentSignature } from "@/lib/crypto-pay";
import { confirmDeposit } from "@/lib/wallet";
import { ensure, walletFailure } from "@/lib/wallet-security";

export async function POST(req: Request) {
  try {
    ensure(Number(req.headers.get("content-length") ?? 0) <= 65536, "INVALID_REQUEST", 413);
    const raw = await req.text();
    ensure(raw.length <= 65536, "INVALID_REQUEST", 413);
    ensure(verifyPaymentSignature(raw, req.headers.get("crypto-pay-api-signature")), "FORBIDDEN", 403);
    let body;
    try { body = JSON.parse(raw); } catch { return Response.json({ error: "INVALID_REQUEST" }, { status: 400 }); }
    const time = Date.parse(body.request_date);
    ensure(Number.isFinite(time) && time <= Date.now() + 60_000 && time >= Date.now() - 86400_000, "EXPIRED_WEBHOOK", 400);
    if (body.update_type !== "invoice_paid") return Response.json({ ok: true });
    ensure(Number.isSafeInteger(body.payload?.invoice_id), "INVALID_INVOICE");
    const [op] = await db.select({ id: walletOperations.id }).from(walletOperations).where(eq(walletOperations.externalId, String(body.payload.invoice_id)));
    ensure(op, "INVOICE_NOT_FOUND", 404);
    // Signature alone is not sufficient: confirmDeposit verifies with getInvoices.
    await confirmDeposit(op.id);
    return Response.json({ ok: true });
  } catch (error) { return walletFailure(error); }
}
