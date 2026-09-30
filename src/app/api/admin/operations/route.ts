import { adminRejectOperation } from "@/lib/admin";
import { adminEnsure, adminFailure, requireAdmin } from "@/lib/admin-auth";
import { readBody } from "@/lib/wallet-security";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin(req, true);
    const raw = await readBody(req);
    const action = String(raw.action ?? "");

    switch (action) {
      case "reject": {
        const operationId = String(raw.operationId ?? "").trim();
        adminEnsure(operationId.length > 0, "OPERATION_ID_REQUIRED");
        const reason = typeof raw.reason === "string" ? raw.reason.trim() : undefined;
        const result = await adminRejectOperation(admin, operationId, reason);
        return Response.json(result);
      }
      default:
        adminEnsure(false, "INVALID_ACTION");
    }
  } catch (error) {
    return adminFailure(error);
  }
}
