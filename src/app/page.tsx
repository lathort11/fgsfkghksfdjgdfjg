import type { Metadata } from "next";
import WalletDashboard, { type WalletSection } from "@/components/livka/wallet-dashboard";
import { LangProvider } from "@/components/livka/i18n-context";
import { getCurrentUser } from "@/lib/session";
import { getProducts } from "@/lib/livka";
import { getLocale } from "@/lib/locale-server";
import { walletSnapshot } from "@/lib/wallet";
import { tokenSnapshot } from "@/lib/tokens";

export const dynamic = "force-dynamic";

const META = {
  ru: { title: "Мой кошелёк — LIVKAMARKET", description: "Ваш баланс, AI-подписки и покупки в одном месте. Пополняйте кошелёк, подтверждайте покупки и управляйте средствами в LIVKAMARKET." },
  en: { title: "My wallet — LIVKAMARKET", description: "Your balance, AI subscriptions and purchases in one place. Top up your wallet, confirm purchases and manage your funds at LIVKAMARKET." },
  zh: { title: "我的钱包 — LIVKAMARKET", description: "余额、AI 订阅和购买记录尽在一处。在 LIVKAMARKET 充值钱包、确认购买并管理资金。" },
} as const;

export async function generateMetadata(): Promise<Metadata> {
  return META[await getLocale()];
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const [products, user, params, locale] = await Promise.all([getProducts(), getCurrentUser(), searchParams, getLocale()]);
  const [wallet, tokenData] = await Promise.all([
    user ? walletSnapshot(user.id) : Promise.resolve(null),
    tokenSnapshot(user?.id ?? null),
  ]);
  const section: WalletSection = ["catalog", "purchases", "history"].includes(params.section ?? "") ? params.section as WalletSection : "wallet";
  return <LangProvider initial={locale}><WalletDashboard products={products} initialUser={user} initialWallet={wallet} initialTokens={tokenData} initialSection={section} /></LangProvider>;
}
