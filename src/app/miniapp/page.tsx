import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import MiniAppVerify from "@/components/livka/miniapp";
import { LangProvider } from "@/components/livka/i18n-context";
import { DICTS, LOCALE_COOKIE, isLocale, type Locale } from "@/lib/i18n";
import { normalizeBackendBase } from "@/lib/miniapp";

// Read MINIAPP_BACKEND_URL at request time, not at build time.
export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#070708",
};

async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : "ru";
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: `LIVKAMARKET — ${DICTS[locale].miniapp.title}`,
    robots: { index: false, follow: false },
  };
}

export default async function MiniAppPage() {
  const locale = await getLocale();

  // Public base URL of the bot backend (the browser calls it directly).
  // Empty → same origin: the reverse proxy must route /miniapp/api/* to the
  // backend so that it sees the user's real IP. Never proxy through Next.js.
  const { base, error } = normalizeBackendBase(process.env.MINIAPP_BACKEND_URL);
  if (error) console.error(`[miniapp] ${error}`);

  return (
    <LangProvider initial={locale}>
      <MiniAppVerify backendBase={base} configError={error !== null} />
    </LangProvider>
  );
}
