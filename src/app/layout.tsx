import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Unbounded, Onest, Noto_Sans_SC } from "next/font/google";
import { getLocale } from "@/lib/locale-server";
import "./globals.css";

const display = Unbounded({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-display",
  display: "swap",
});

const body = Onest({
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

const cjk = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-sc",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#070708",
  colorScheme: "dark",
};

export const metadata: Metadata = {
  title: "LIVKAMARKET — Ваш баланс и AI-возможности",
  description:
    "Личный кошелёк для AI-подписок: пополнение баланса, подтверждение покупки и сохранённые доступы. Прозрачные комиссии и история операций.",
  icons: {
    icon: [{ url: "/logo.svg", type: "image/svg+xml" }],
    apple: "/logo.svg",
  },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${display.variable} ${body.variable} ${cjk.variable}`}>
      <body className="relative min-h-screen bg-[#0b0b10]">
        {children}
      </body>
    </html>
  );
}
