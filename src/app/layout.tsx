import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "LIVKAMARKET — Флагманский маркет AI подписок | Gemini Pro, ChatGPT Pro, SuperGrok",
  description:
    "Премиальный доступ к топовым нейросетям. Автоматическая выдача за 2 минуты, оплата криптой (USDT, TON, BTC), гарантия замены на весь срок 18 месяцев.",
  icons: {
    icon: [
      {
        url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%237c5cff'/%3E%3Cstop offset='100%25' stop-color='%2306b6d4'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='32' height='32' rx='10' fill='%2304040a'/%3E%3Crect width='32' height='32' rx='10' fill='url(%23g)' opacity='0.25'/%3E%3Cpath d='M16 4 C17.4 10.6 19.4 12.6 26 14 C19.4 15.4 17.4 17.4 16 24 C14.6 17.4 12.6 15.4 6 14 C12.6 12.6 14.6 10.6 16 4 Z' fill='url(%23g)'/%3E%3C/svg%3E",
        type: "image/svg+xml",
      },
    ],
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
