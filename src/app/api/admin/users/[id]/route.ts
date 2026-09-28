import { creditUserBalance, grantProduct, setUserBan } from "@/lib/admin";
import { adminEnsure, adminFailure, confirmAdminPassword, requireAdmin } from "@/lib/admin-auth";
import { readBody } from "@/lib/wallet-security";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(req, true);
    const [{ id }, body] = await Promise.all([context.params, readBody(req)]);
    await confirmAdminPassword(admin, body.adminPassword);
    let result: unknown;
    switch (body.action) {
      case "ban":
        result = await setUserBan(admin, id, true, body.reason);
        break;
      case "unban":
        result = await setUserBan(admin, id, false, "");
        break;
      case "credit":
        result = await creditUserBalance(admin, id, body.amountCents, body.note, body.idempotencyKey);
        break;
      case "grant-product":
        result = await grantProduct(admin, id, body.productId, body.note);
        break;
      default:
        adminEnsure(false, "INVALID_ACTION");
    }
    return Response.json({ ok: true, result });
  } catch (error) {
    return adminFailure(error);
  }
}
