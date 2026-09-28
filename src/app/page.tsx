import type { Metadata } from "next";
import WalletDashboard, { type WalletSection } from "@/components/livka/wallet-dashboard";
import { LangProvider } from "@/components/livka/i18n-context";
import { getCurrentUser } from "@/lib/session";
import { getProducts } from "@/lib/livka";
import { walletMode, walletSnapshot } from "@/lib/wallet";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Мой кошелёк — LIVKAMARKET",
  description: "Ваш баланс, AI-подписки и покупки в одном месте. Пополняйте кошелёк, подтверждайте покупки и управляйте средствами в LIVKAMARKET.",
};

export default async function HomePage({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const [products, user, params] = await Promise.all([getProducts(), getCurrentUser(), searchParams]);
  const mode = walletMode();
  const wallet = user ? await walletSnapshot(user.id) : null;
  const section: WalletSection = ["catalog", "purchases", "history"].includes(params.section ?? "") ? params.section as WalletSection : "wallet";
  return <LangProvider initial="ru"><WalletDashboard products={products} initialUser={user} initialWallet={wallet} mode={mode} initialSection={section} /></LangProvider>;
}
