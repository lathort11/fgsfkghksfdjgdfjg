import type { Metadata } from "next";
import AdminPanel from "@/components/admin/admin-panel";
import { LangProvider } from "@/components/livka/i18n-context";
import { getAdminDashboard } from "@/lib/admin";
import { getLocale } from "@/lib/locale-server";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "LIVKA CONTROL — Admin",
  description: "LIVKAMARKET admin control panel.",
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminPage() {
  const [user, locale] = await Promise.all([getCurrentUser(), getLocale()]);
  const data = user?.role === "admin" ? await getAdminDashboard() : null;
  return <LangProvider initial={locale}><AdminPanel initialUser={user} initialData={data} /></LangProvider>;
}
