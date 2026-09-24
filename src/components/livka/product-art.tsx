import type { CSSProperties, ReactNode, SVGProps } from "react";

/*
 * One visual language for every product.
 *
 * The old raster banners had three different backgrounds (white, black, grey),
 * different logo sizes and crops — the main source of visual disharmony.
 * Every product visual is now the same composition — accent glow, orbit
 * rings, a glass tile and a crisp vector brand mark — and only the product
 * accent colour changes. Corners follow the concentric rule
 * (inner radius = outer radius − inset).
 */

type P = SVGProps<SVGSVGElement>;

/* ═══════════ Brand marks (vector, single colour = currentColor) ═══════════ */

/** Google Gemini sparkle — Simple Icons (CC0). */
export function GeminiLogo(p: P) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
      <path d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81" />
    </svg>
  );
}

/** OpenAI blossom — Simple Icons (CC0). */
export function OpenAILogo(p: P) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </svg>
  );
}

/** Grok — open ring cut by a tapered diagonal. */
export function GrokLogo(p: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...p}>
      <path
        d="M14.96 5.66A7 7 0 0 0 5.66 14.96M9.04 18.34A7 7 0 0 0 18.34 9.04"
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinecap="round"
      />
      <path d="M3.4 20.6 12.9 12.9 20.6 3.4 11.1 11.1Z" fill="currentColor" />
    </svg>
  );
}

const MARKS: Record<string, (p: P) => ReactNode> = {
  gemini: GeminiLogo,
  api: GeminiLogo,
  chatgpt: OpenAILogo,
  grok: GrokLogo,
};

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
  const Mark = MARKS[product.icon] ?? GeminiLogo;
  return (
    <span
      className={`art-tile ${className}`}
      style={{ ...accentVars(product.accent), "--tile": `${size}px` } as CSSProperties}
      aria-hidden="true"
    >
      <Mark className="art-mark" />
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
