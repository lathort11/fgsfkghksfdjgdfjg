import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { wallets, walletOperations, walletAudit, inventory, products } from "@/db/schema";
import { reviewWithdrawal } from "@/lib/wallet";
import { ensure, operatorAuthorized, readBody, validId, walletFailure, rateLimit } from "@/lib/wallet-security";

export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    ensure(operatorAuthorized(req), "FORBIDDEN", 403);
    const queue = await db.select({ operation: walletOperations, userId: wallets.userId, verification: wallets.verification }).from(walletOperations).innerJoin(wallets, eq(walletOperations.walletId, wallets.id)).where(and(eq(wallets.mode, "live"), eq(walletOperations.kind, "withdrawal"), inArray(walletOperations.status, ["pending", "processing"]))).limit(200);
    return Response.json({ queue }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return walletFailure(error); }
}
export async function POST(req: Request) {
  try {
    ensure(operatorAuthorized(req), "FORBIDDEN", 403);
    await rateLimit("wallet:operator", 100);
    const body = await readBody(req);
    const actor = typeof body.actor === "string" ? body.actor.trim().slice(0, 100) : "";
    ensure(actor.length >= 3, "OPERATOR_REQUIRED");
    if (body.action === "review-withdrawal") {
      return Response.json({ ok: true, operation: await reviewWithdrawal(body, actor) });
    }
    if (body.action === "verify-wallet") {
      ensure(validId(body.walletId), "INVALID_REQUEST");
      ensure(body.status === "verified" || body.status === "blocked" || body.status === "unverified", "INVALID_REQUEST");
      ensure(typeof body.reference === "string" && body.reference.length >= 8, "REVIEW_REFERENCE_REQUIRED");
      const walletId = body.walletId, verification = body.status, reference = body.reference.slice(0, 500);
      await db.transaction(async (tx) => {
        const [w] = await tx.select().from(wallets).where(eq(wallets.id, walletId)).for("update");
        ensure(w?.mode === "live", "NOT_FOUND", 404);
        await tx.update(wallets).set({ verification, verificationReference: reference }).where(eq(wallets.id, walletId));
        await tx.insert(walletAudit).values({ actor, action: `wallet.${verification}`, walletId, details: { reference } });
      });
      return Response.json({ ok: true });
    }
    if (body.action === "inventory-add") {
      ensure(validId(body.productId) && typeof body.credentials === "string" && body.credentials.length > 10 && body.credentials.length <= 8000, "INVALID_REQUEST");
      const productId = body.productId, credentials = body.credentials;
      await db.transaction(async (tx) => {
        const [p] = await tx.select().from(products).where(eq(products.id, productId)).for("update");
        ensure(p, "NOT_FOUND", 404);
        await tx.insert(inventory).values({ productId, credentials });
        const [n] = await tx.select({ count: sql<number>`count(*)::int` }).from(inventory).where(and(eq(inventory.productId, productId), isNull(inventory.orderId)));
        await tx.update(products).set({ stock: n.count }).where(eq(products.id, productId));
        await tx.insert(walletAudit).values({ actor, action: "inventory.added", details: { productId } });
      });
      return Response.json({ ok: true });
    }
    ensure(false, "INVALID_REQUEST");
  } catch (error) { return walletFailure(error); }
}
