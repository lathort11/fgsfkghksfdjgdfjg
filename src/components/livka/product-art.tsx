"use client";

import { Claude, Gemini, Grok, OpenAI } from "@lobehub/icons";
import type { CSSProperties, ReactNode } from "react";

/*
 * One visual language for every product.
 *
 * Every product tile uses official brand icons from @lobehub/icons:
 * - Claude API: <Claude.Avatar />
 * - Gemini:     <Gemini.Color />
 * - Grok:       <Grok />
 * - ChatGPT:    <OpenAI />
 */

type IconProps = { size?: number | string; className?: string; style?: CSSProperties };

/** Google Gemini colour mark from @lobehub/icons. */
export function GeminiLogo({ size = 56, className, style }: IconProps) {
  return <Gemini.Color size={size} className={className} style={style} />;
}

/** OpenAI mark from @lobehub/icons. */
export function OpenAILogo({ size = 56, className, style }: IconProps) {
  return <OpenAI size={size} className={className} style={style} />;
}

/** Grok mark from @lobehub/icons. */
export function GrokLogo({ size = 56, className, style }: IconProps) {
  return <Grok size={size} className={className} style={style} />;
}

const MARKS: Record<string, (p: IconProps) => ReactNode> = {
  gemini: GeminiLogo,
  api: GeminiLogo,
  chatgpt: OpenAILogo,
  grok: GrokLogo,
};

/** Official Claude avatar from @lobehub/icons — it ships its own brand colour. */
export const CLAUDE_ACCENT = Claude.colorPrimary;

/* ═══════════ Helpers ═══════════ */
export type ArtProduct = { slug: string; icon: string; kind: string; accent: string };

function alpha(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(n)) return `rgba(139, 124, 255, ${a})`;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** CSS custom properties for a product accent (used by .art / .art-tile / .btn-ink). */
export function accentVars(accent: string): CSSProperties {
  return {
    "--ac": accent,
    "--ac-08": alpha(accent, 0.08),
    "--ac-16": alpha(accent, 0.16),
    "--ac-28": alpha(accent, 0.28),
    "--ac-45": alpha(accent, 0.45),
  } as CSSProperties;
}

/* ═══════════ Components ═══════════ */

/** Glass app-icon tile with the brand mark. `size` in px. */
export function ProductTile({
  product,
  size = 40,
  className = "",
}: {
  product: ArtProduct;
  size?: number;
  className?: string;
}) {
  if (product.icon === "claude") {
    return (
      <span
        className={`art-tile art-tile-avatar ${className}`}
        style={{ ...accentVars(product.accent), "--tile": `${size}px` } as CSSProperties}
        aria-hidden="true"
      >
        <Claude.Avatar size={size} shape="square" />
      </span>
    );
  }
  const Mark = MARKS[product.icon] ?? GeminiLogo;
  return (
    <span
      className={`art-tile ${className}`}
      style={{ ...accentVars(product.accent), "--tile": `${size}px` } as CSSProperties}
      aria-hidden="true"
    >
      <Mark size={Math.round(size * 0.56)} className="art-mark" />
      {product.kind === "api" && size >= 64 && <span className="art-api">API</span>}
    </span>
  );
}

/**
 * Full product visual: accent glow + orbit rings + tile. The parent decides
 * the size (aspect-ratio / height via `className`); `children` are overlays.
 */
export function ProductArt({
  product,
  tile = 84,
  className = "",
  children,
}: {
  product: ArtProduct;
  tile?: number;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={`art ${className}`}
      style={{ ...accentVars(product.accent), "--tile": `${tile}px` } as CSSProperties}
    >
      <span className="art-rings" aria-hidden="true" />
      <ProductTile product={product} size={tile} />
      {children}
    </div>
  );
}
