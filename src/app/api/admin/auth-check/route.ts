import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Endpoint for Caddy forward_auth check.
 * Used to protect /omniroute/* at the reverse-proxy level.
 * Only authenticated users with role="admin" and status="active" are permitted.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.status !== "active" || user.role !== "admin") {
      return new NextResponse("Unauthorized: Admin access required", {
        status: 401,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    return new NextResponse("OK", {
      status: 200,
      headers: {
        "x-admin-id": user.id,
        "x-admin-customer": user.customerId,
        "x-admin-email": user.email,
      },
    });
  } catch {
    return new NextResponse("Forbidden", {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
