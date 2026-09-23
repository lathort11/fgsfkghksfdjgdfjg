import type { Metadata } from "next";
import { cookies } from "next/headers";
import Site from "@/components/livka/site";
import { LangProvider } from "@/components/livka/i18n-context";
import { getCurrentUser } from "@/lib/session";
import { getProducts, getStats } from "@/lib/livka";
import { DICTS, LOCALE_COOKIE, isLocale, type Locale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

async function getLocale(): Promise<Locale> {
  const jar = await cookies();
  const value = jar.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : "ru";
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const d = DICTS[locale];
  return { title: d.meta.title, description: d.meta.description };
}

export default async function HomePage() {
  const [locale, products, stats, user] = await Promise.all([
    getLocale(),
    getProducts(),
    getStats(),
    getCurrentUser(),
  ]);

  return (
    <LangProvider initial={locale}>
      <Site products={products} stats={stats} initialUser={user} />
    </LangProvider>
  );
}
