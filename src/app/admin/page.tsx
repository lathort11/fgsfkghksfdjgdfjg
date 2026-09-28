import type { Metadata } from "next";
import AdminPanel from "@/components/admin/admin-panel";
import { getAdminDashboard } from "@/lib/admin";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "LIVKA CONTROL — Админ-панель",
  description: "Защищённая панель управления LIVKAMARKET.",
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminPage() {
  const user = await getCurrentUser();
  const data = user?.role === "admin" ? await getAdminDashboard() : null;
  return <AdminPanel initialUser={user} initialData={data} />;
}
