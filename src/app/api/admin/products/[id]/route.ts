import { setProductActive, setProductPrice, setTokenRate } from "@/lib/admin";
import { adminEnsure, adminFailure, requireAdmin } from "@/lib/admin-auth";
import { readBody } from "@/lib/wallet-security";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(req, true);
    const [{ id }, body] = await Promise.all([context.params, readBody(req)]);
    let result: unknown;
    switch (body.action) {
      case "set-price":
        result = await setProductPrice(admin, id, body.priceCents, body.expectedPriceCents, body.note);
        break;
      case "set-active":
        result = await setProductActive(admin, id, body.active, body.note);
        break;
      case "set-token-rate":
        result = await setTokenRate(admin, id, body.modelSlug, body.pricePerMillionCents, body.note);
        break;
      default:
        adminEnsure(false, "INVALID_ACTION");
    }
    return Response.json({ ok: true, result });
  } catch (error) {
    return adminFailure(error);
  }
}
