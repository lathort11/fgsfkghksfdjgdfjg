import { setProductActive, setProductPrice } from "@/lib/admin";
import { adminEnsure, adminFailure, confirmAdminPassword, requireAdmin } from "@/lib/admin-auth";
import { readBody } from "@/lib/wallet-security";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(req, true);
    const [{ id }, body] = await Promise.all([context.params, readBody(req)]);
    // Re-authenticate before any branch so a new action can never skip the step-up check.
    await confirmAdminPassword(admin, body.adminPassword);
    let result: unknown;
    switch (body.action) {
      case "set-price":
        result = await setProductPrice(admin, id, body.priceCents, body.expectedPriceCents, body.note);
        break;
      case "set-active":
        result = await setProductActive(admin, id, body.active, body.note);
        break;
      default:
        adminEnsure(false, "INVALID_ACTION");
    }
    return Response.json({ ok: true, result });
  } catch (error) {
    return adminFailure(error);
  }
}
