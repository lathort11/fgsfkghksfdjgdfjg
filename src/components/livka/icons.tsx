"use client";

import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;

/** 24px grid, 2px live area, 1.5 stroke, round caps. Mono only. */
const ink: P = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

/* ═══════════ LIVKA CRYSTAL — octahedron, no fill gradient ═══════════ */
export function LivkaMark(p: P) {
  return (
    <svg {...ink} {...p}>
      <path d="M12 3.1 19.4 9.2 12 20.9 4.6 9.2Z" />
      <path d="M4.6 9.2h14.8" />
      <path d="M12 3.1 8.4 9.2 12 20.9" />
      <path d="M12 3.1 15.6 9.2 12 20.9" />
    </svg>
  );
}

/** Twin Meridian — two ellipses, one optical node */
export function GeminiMark(p: P) {
  return (
    <svg {...ink} {...p}>
      <ellipse cx="12" cy="12" rx="8.1" ry="3.15" transform="rotate(-28 12 12)" />
      <ellipse cx="12" cy="12" rx="8.1" ry="3.15" transform="rotate(28 12 12)" />
      <circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Recursive Monolith — hexagon + inward spiral */
export function OpenAiMark(p: P) {
  return (
    <svg {...ink} {...p}>
      <path d="M12 4.1 18.8 8.05v7.9L12 19.9 5.2 15.95v-7.9Z" />
      <path d="M12 7.1c3.3 0 4.5 2.1 4.5 4.4 0 2.7-2 4 4-4s-3.4 4-5.5 4c-1.7 0-2.6-1.1-2.6-2.5 0-1.2.8-2 2-2 .9 0 1.5.6 1.5 1.4" />
    </svg>
  );
}

/** Kinetic Vector — two 45° parallels and a counter stroke */
export function GrokMark(p: P) {
  return (
    <svg {...ink} {...p}>
      <path d="M6.1 16.7 16.7 6.1" />
      <path d="M8.5 18.7 19.1 8.1" />
      <path d="M16.2 14.4 13.1 17.5" />
    </svg>
  );
}

/** Floating Apex — open triangle, levitating vector above the base */
export function ApiMark(p: P) {
  return (
    <svg {...ink} {...p}>
      <path d="M7.1 18.5 12 5.6 16.9 18.5" />
      <path d="M9.7 14.7h4.6" />
    </svg>
  );
}

export const Sparkle = LivkaMark;

export const Zap = (p: P) => (
  <svg {...ink} {...p}>
    <path d="M13 2.6 5.6 13.1h6.1L10.3 21.4 18.6 10.7h-6.1Z" />
  </svg>
);

export const Shield = (p: P) => (
  <svg {...ink} {...p}>
    <path d="M12 3.1 19.4 6.2v6.3c0 4.2-3 7.4-7.4 8.6-4.4-1.2-7.4-4.4-7.4-8.6V6.2Z" />
    <path d="m8.7 12.1 2.2 2.2 4.5-4.7" />
  </svg>
);

export const Wallet = (p: P) => (
  <svg {...ink} {...p}>
    <rect x="3.4" y="6.3" width="17.2" height="12.2" rx="2.2" />
    <path d="M3.4 9.4h17.2" />
    <circle cx="16.3" cy="13.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);

export const Headset = (p: P) => (
  <svg {...ink} {...p}>
    <path d="M4.6 13.4V11.6A7.4 7.4 0 0 1 12 4.2a7.4 7.4 0 0 1 7.4 7.4v1.8" />
    <rect x="3.3" y="13.1" width="4" height="6.4" rx="1.5" />
    <rect x="16.7" y="13.1" width="4" height="6.4" rx="1.5" />
  </svg>
);

export const KeyIcon = (p: P) => (
  <svg {...ink} {...p}>
    <circle cx="8.1" cy="8.1" r="3.3" />
    <path d="m10.5 10.5 9.4 9.4M16.6 16.6l2.5-2.5M14.2 14.2l1.7-1.7" />
  </svg>
);

export const Star = (p: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="m12 2.5 2.3 5.9 6.4.5-4.9 4.1 1.5 6.2L12 16.4 6.7 19.2l1.5-6.2L3.3 8.9l6.4-.5Z" />
  </svg>
);

export const Check = (p: P) => (
  <svg {...ink} strokeWidth={1.8} {...p}>
    <path d="m5 12.2 4.3 4.3L19 7.4" />
  </svg>
);

export const ChevronDown = (p: P) => (
  <svg {...ink} {...p}>
    <path d="m6 9.2 6 6 6-6" />
  </svg>
);

export const ArrowRight = (p: P) => (
  <svg {...ink} {...p}>
    <path d="M4.2 12h15.4M14.4 6.6 20.2 12l-5.8 5.4" />
  </svg>
);

export const ArrowUpRight = (p: P) => (
  <svg {...ink} {...p}>
    <path d="M7 17 17 7M9.6 7H17v7.4" />
  </svg>
);

export const Telegram = (p: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M20.6 4.4 3.6 11.1c-.7.27-.68 1.2.04 1.43l4.05 1.28 1.5 4.8c.21.68 1.05.84 1.5.29l2.12-2.46 3.82 2.8c.66.48 1.57.11 1.72-.7L21.4 5.3c.16-.84-.27-1.25-.8-.9ZM8.5 13.15l8.3-5.2c.27-.17.56.12.36.36l-6.75 6.35-.28 2.75z" />
  </svg>
);

export const MenuIcon = (p: P) => (
  <svg {...ink} {...p}>
    <path d="M4.5 7.2h15M4.5 12h15M4.5 16.8h10.2" />
  </svg>
);

export const XIcon = (p: P) => (
  <svg {...ink} {...p}>
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
);

export const Clock = (p: P) => (
  <svg {...ink} {...p}>
    <circle cx="12" cy="12" r="8.1" />
    <path d="M12 7.7V12l3.1 2.1" />
  </svg>
);

export const Search = (p: P) => (
  <svg {...ink} {...p}>
    <circle cx="11" cy="11" r="6.3" />
    <path d="m16.1 16.1 3.9 3.9" />
  </svg>
);

export const Copy = (p: P) => (
  <svg {...ink} {...p}>
    <rect x="8.6" y="8.6" width="10.8" height="10.8" rx="2.1" />
    <path d="M15.1 8.6V6.7A2.5 2.5 0 0 0 12.6 4.2H6.7A2.5 2.5 0 0 0 4.2 6.7v5.9a2.5 2.5 0 0 0 2.5 2.5h1.9" />
  </svg>
);

export const UserIcon = (p: P) => (
  <svg {...ink} {...p}>
    <circle cx="12" cy="8.1" r="3.3" />
    <path d="M5.2 19.1a6.8 6.8 0 0 1 13.6 0" />
  </svg>
);

export const LogOut = (p: P) => (
  <svg {...ink} {...p}>
    <path d="M14.4 5.2H18a1.8 1.8 0 0 1 1.8 1.8v10a1.8 1.8 0 0 1-1.8 1.8h-3.6" />
    <path d="m10 8.2-3.8 3.8L10 15.8M6.2 12h9.6" />
  </svg>
);

export const Globe = (p: P) => (
  <svg {...ink} {...p}>
    <circle cx="12" cy="12" r="8.1" />
    <path d="M3.9 12h16.2M12 3.9c2.3 2.7 2.3 13.5 0 16.2M12 3.9C9.7 6.6 9.7 17.4 12 20.1" />
  </svg>
);

export const Lock = (p: P) => (
  <svg {...ink} {...p}>
    <rect x="5.1" y="10.6" width="13.8" height="9" rx="2.1" />
    <path d="M8.2 10.6V7.8a3.8 3.8 0 0 1 7.6 0v2.8" />
  </svg>
);

export const Receipt = (p: P) => (
  <svg {...ink} {...p}>
    <path d="M7.1 3.6h9.8v16.6l-2.45-1.5-2.45 1.5-2.45-1.5-2.45 1.5Z" />
    <path d="M9.4 8.2h5.2M9.4 11.8h5.2" />
  </svg>
);

export function UsdtMark(p: P) {
  return (
    <svg viewBox="0 0 32 32" {...p}>
      <circle cx="16" cy="16" r="16" fill="#26a17b" />
      <path fill="#fff" d="M17.3 14.1v8.2h-2.6v-8.2H9.4v-2.4h13.2v2.4z" />
      <path fill="#fff" d="M16 7.5c-3.3 0-6 .7-6 1.55S12.7 10.6 16 10.6s6-.7 6-1.55S19.3 7.5 16 7.5Z" />
    </svg>
  );
}

export function BtcMark(p: P) {
  return (
    <svg viewBox="0 0 32 32" {...p}>
      <circle cx="16" cy="16" r="16" fill="#f7931a" />
      <path
        fill="#fff"
        d="M20.3 14.2c.3-1.8-1.1-2.7-3-3.3l.6-2.4-1.5-.4-.6 2.3c-.4-.1-.8-.2-1.2-.3l.6-2.3-1.5-.4-.6 2.4c-.3-.1-.6-.1-.9-.2l-2-.5-.4 1.6s1.1.3 1.1.3c.6.1.7.5.7.8l-.7 2.7c0 .1.1.1.1.1h-.1l-1 3.9c-.1.2-.3.5-.7.4 0 0-1.1-.3-1.1-.3l-.7 1.6 1.9.5c.4.1.7.2 1.1.3l-.6 2.4 1.5.4.6-2.4c.4.1.8.2 1.2.3l-.6 2.3 1.5.4.6-2.4c2.4.5 4.3.3 5.1-1.9.6-1.8 0-2.8-1.4-3.5 1-.2 1.7-1 1.9-2.3Zm-3.5 4.9c-.4 1.8-3.4.9-4.4.7l.8-3.1c1 .2 4.1.7 3.6 2.4Zm.4-5c-.4 1.6-2.9 1-3.7.8l.7-2.8c.8.2 3.5.6 3 2Z"
      />
    </svg>
  );
}

export function EthMark(p: P) {
  return (
    <svg viewBox="0 0 32 32" {...p}>
      <circle cx="16" cy="16" r="16" fill="#627eea" />
      <path fill="#fff" fillOpacity=".75" d="M16 5.4v7.8l6.6 2.9Z" />
      <path fill="#fff" d="M16 5.4 9.4 16.1 16 13.2Z" />
      <path fill="#fff" fillOpacity=".75" d="M16 21.7v5.1l6.6-9.2Z" />
      <path fill="#fff" d="M16 26.8v-5.1l-6.6-4.1Z" />
      <path fill="#fff" fillOpacity=".45" d="m16 20.1 6.6-4 6.6 2.9-6.6-2.9Z" />
      <path fill="#fff" fillOpacity=".8" d="M9.4 16.1 16 20.1v-6.9Z" />
    </svg>
  );
}

export function TonMark(p: P) {
  return (
    <svg viewBox="0 0 32 32" {...p}>
      <circle cx="16" cy="16" r="16" fill="#0098ea" />
      <path fill="#fff" d="M9.2 9.4h13.6L16 24.2 9.2 9.4Zm6.1 2.2-4.6 2.3 4.6 8.2 4.6-8.2-4.6-2.3Z" />
    </svg>
  );
}

export function CryptoBadge({ asset, ...rest }: P & { asset: string }) {
  if (asset === "USDT") return <UsdtMark {...rest} />;
  if (asset === "BTC") return <BtcMark {...rest} />;
  if (asset === "ETH") return <EthMark {...rest} />;
  if (asset === "TON") return <TonMark {...rest} />;
  return <LivkaMark {...rest} />;
}
