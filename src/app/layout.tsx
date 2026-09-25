import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Unbounded, Onest, Noto_Sans_SC } from "next/font/google";
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
  title: "LIVKAMARKET — Флагманский маркет AI подписок | Gemini Pro, ChatGPT Pro, SuperGrok",
  description:
    "Премиальный доступ к топовым нейросетям. Автоматическая выдача за 2 минуты, оплата криптой (USDT, TON, BTC), гарантия замены на весь срок 18 месяцев.",
  icons: {
    icon: [{ url: "/logo.svg", type: "image/svg+xml" }],
    apple: "/logo.svg",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className={`${display.variable} ${body.variable} ${cjk.variable}`}>
      <body className="relative min-h-screen bg-[#070708]">
        <div className="aurora" aria-hidden="true">
          <span />
        </div>
        <div className="relative z-10">{children}</div>
        <div className="vignette" aria-hidden="true" />
        <div className="grain" aria-hidden="true" />
      </body>
    </html>
  );
}
