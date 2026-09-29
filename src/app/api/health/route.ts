import { db } from "@/db";
import { wallets, walletEntries, walletOperations, inventory, adminAudit, users, tokenBank } from "@/db/schema";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    await Promise.all([
      db.select({ id: wallets.id }).from(wallets).limit(1),
      db.select({ id: walletOperations.id }).from(walletOperations).limit(1),
      db.select({ id: walletEntries.id }).from(walletEntries).limit(1),
      db.select({ id: inventory.id }).from(inventory).limit(1),
      db.select({ id: adminAudit.id }).from(adminAudit).limit(1),
      db.select({ customerNo: users.customerNo }).from(users).limit(1),
      db.select({ productId: tokenBank.productId }).from(tokenBank).limit(1),
    ]);
    return Response.json({ ok: true, database: "connected", wallet: "ready" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
