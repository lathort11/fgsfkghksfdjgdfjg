import { getAdminDashboard } from "@/lib/admin";
import { adminFailure, requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    const url = new URL(req.url);
    const query = url.searchParams.get("q") ?? "";
    const page = Number(url.searchParams.get("page") ?? 1);
    const data = await getAdminDashboard(query, page);
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return adminFailure(error);
  }
}
