"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useI18n } from "@/components/livka/i18n-context";
import type { SessionUser } from "@/components/livka/auth";

/*
 * Bottom tab bar for phones (hidden from md up via CSS).
 * Primary destinations sit in the thumb zone: 4 items, icon + short label,
 * 52px+ targets, active state from a scroll-spy, safe-area aware.
 */

const COPY = {
  ru: { home: "Главная", catalog: "Каталог", order: "Заказ", profile: "Профиль", login: "Войти", nav: "Навигация" },
  en: { home: "Home", catalog: "Catalog", order: "Order", profile: "Profile", login: "Sign in", nav: "Navigation" },
  zh: { home: "首页", catalog: "商品", order: "订单", profile: "我的", login: "登录", nav: "导航" },
} as const;

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const HomeIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" {...stroke} aria-hidden="true">
    <path d="M4 10.4 12 4l8 6.4V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1Z" />
  </svg>
);
const GridIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" {...stroke} aria-hidden="true">
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.8" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="3.25" />
  </svg>
);
const OrderIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" {...stroke} aria-hidden="true">
    <path d="M6 3.8h12v16.4l-2.4-1.5-2.4 1.5-2.4-1.5-2.4 1.5L6 20.2Z" />
    <path d="M9.2 8.6h5.6M9.2 12h5.6M9.2 15.4h3" />
  </svg>
);
const UserIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" {...stroke} aria-hidden="true">
    <circle cx="12" cy="8.3" r="3.6" />
    <path d="M4.8 19.6a7.2 7.2 0 0 1 14.4 0" />
  </svg>
);

type Spot = "top" | "catalog" | null;

function useScrollSpy(): Spot {
  const [spot, setSpot] = useState<Spot>("top");
  useEffect(() => {
    const ids = ["top", "catalog", "how", "faq"];
    const els = ids.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    if (!els.length) return;
    const visible = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0);
        // The section crossing the middle band of the screen wins.
        let best: string | null = null;
        let max = 0;
        for (const [id, r] of visible) if (r > max) [best, max] = [id, r];
        setSpot(best === "top" || best === "catalog" ? best : null);
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.01, 0.5, 1] }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return spot;
}

export function MobileTabBar({
  user,
  onLogin,
  onProfile,
  onTrack,
}: {
  user: SessionUser | null;
  onLogin: () => void;
  onProfile: () => void;
  onTrack: () => void;
}) {
  const { locale } = useI18n();
  const c = COPY[locale as keyof typeof COPY] ?? COPY.ru;
  const spot = useScrollSpy();

  const item = (key: string, label: string, icon: ReactNode, on: boolean, action: { href: string } | { onClick: () => void }) => {
    const inner = (
      <>
        <span className="tabbar-pill">{icon}</span>
        <span className="max-w-full truncate px-1">{label}</span>
      </>
    );
    return "href" in action ? (
      <a key={key} href={action.href} className={`tabbar-item ${on ? "is-on" : ""}`} aria-current={on ? "location" : undefined}>
        {inner}
      </a>
    ) : (
      <button key={key} type="button" onClick={action.onClick} className="tabbar-item">
        {inner}
      </button>
    );
  };

  const avatar = user ? (
    <span className="tabbar-avatar">
      {user.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        user.name.trim().charAt(0).toUpperCase() || "U"
      )}
    </span>
  ) : (
    <UserIcon />
  );

  return (
    <nav className="tabbar" aria-label={c.nav}>
      {item("home", c.home, <HomeIcon />, spot === "top", { href: "#top" })}
      {item("catalog", c.catalog, <GridIcon />, spot === "catalog", { href: "#catalog" })}
      {item("order", c.order, <OrderIcon />, false, { onClick: onTrack })}
      {item("me", user ? c.profile : c.login, avatar, false, { onClick: user ? onProfile : onLogin })}
    </nav>
  );
}
