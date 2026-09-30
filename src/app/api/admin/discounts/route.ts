import {
  adminToggleDiscount,
  adminUpdateDiscount,
  listAllDiscounts,
} from "@/lib/discounts";
import { adminEnsure, adminFailure, requireAdmin } from "@/lib/admin-auth";
import { readBody } from "@/lib/wallet-security";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireAdmin(req, false);
    const data = await listAllDiscounts();
    return Response.json({ ok: true, discounts: data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return adminFailure(error);
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin(req, true);
    const raw = await readBody(req);
    const action = String(raw.action ?? "");
    let result: unknown;

    switch (action) {
      case "update": {
        const id = String(raw.id ?? "").trim();
        adminEnsure(id.length > 0, "ID_REQUIRED");
        const title = String(raw.title ?? "").trim();
        const reason = String(raw.reason ?? "").trim();
        const originalPriceCents = Math.max(1, Math.trunc(Number(raw.originalPriceCents ?? 30)));
        const discountPriceCents = Math.max(1, Math.trunc(Number(raw.discountPriceCents ?? 10)));
        const badge = typeof raw.badge === "string" ? raw.badge.trim() : undefined;
        const isActive = Boolean(raw.isActive);
        result = await adminUpdateDiscount(admin, {
          id,
          title,
          reason,
          originalPriceCents,
          discountPriceCents,
          badge,
          isActive,
        });
        break;
      }

      case "toggle": {
        const id = String(raw.id ?? "").trim();
        adminEnsure(id.length > 0, "ID_REQUIRED");
        const isActive = Boolean(raw.isActive);
        result = await adminToggleDiscount(admin, id, isActive);
        break;
      }

      default:
        adminEnsure(false, "INVALID_ACTION");
    }

    return Response.json({ ok: true, result });
  } catch (error) {
    return adminFailure(error);
  }
}
