import type { NextConfig } from "next";

/*
 * Telegram clients embed the Mini App (Telegram Web: web.telegram.org) and
 * the Login Widget (oauth.telegram.org) in iframes. Allow only Telegram as
 * a framing parent for /miniapp; everything else stays same-origin.
 */
const TELEGRAM_FRAME_ANCESTORS = "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org https://telegram.org";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/miniapp",
        headers: [{ key: "Content-Security-Policy", value: TELEGRAM_FRAME_ANCESTORS }],
      },
      {
        source: "/((?!miniapp).*)",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors 'self'" }],
      },
    ];
  },
};

export default nextConfig;
