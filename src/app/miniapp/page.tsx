import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import MiniApp, { type MiniAppMode } from "@/components/livka/miniapp";
import { getProducts } from "@/lib/livka";
import { NETWORKS } from "@/lib/networks";
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

/* Quick Buy inside Telegram offers the two fastest networks. */
const MINIAPP_NETWORKS = ["usdt-trc20", "ton"];

function parseMode(v: string | string[] | undefined): MiniAppMode {
  const m = Array.isArray(v) ? v[0] : v;
  return m === "verify" || m === "market" ? m : "auto";
}

export default async function MiniAppPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, params] = await Promise.all([getLocale(), searchParams]);
  const mode = parseMode(params.mode);
  const products = mode === "verify" ? [] : await getProducts().catch(() => []);
  const networks = NETWORKS.filter((n) => MINIAPP_NETWORKS.includes(n.id)).map((n) => ({
    id: n.id,
    asset: n.asset,
    net: n.net,
  }));

  // Public base URL of the bot backend (the browser calls it directly).
  // Empty → same origin: the reverse proxy must route /miniapp/api/* to the
  // backend so that it sees the user's real IP. Never proxy through Next.js.
  const { base, error } = normalizeBackendBase(process.env.MINIAPP_BACKEND_URL);
  if (error) console.error(`[miniapp] ${error}`);

  return (
    <LangProvider initial={locale}>
      <MiniApp
        backendBase={base}
        configError={error !== null}
        mode={mode}
        networks={networks}
        products={products.map((p) => ({
          id: p.id,
          slug: p.slug,
          priceCents: p.priceCents,
          per: p.per,
          kind: p.kind,
          stock: p.stock,
          icon: p.icon,
          accent: p.accent,
        }))}
      />
    </LangProvider>
  );
}
