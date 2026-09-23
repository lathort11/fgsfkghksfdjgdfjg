"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/* ── Text scramble-on-hover ── */
export function ScrambleText({
  text,
  className,
  as: Tag = "span",
  speed = 22,
}: {
  text: string;
  className?: string;
  as?: "span" | "h1" | "h2" | "h3" | "p" | "div";
  speed?: number;
}) {
  const ref = useRef<HTMLElement>(null);
  const [display, setDisplay] = useState(text);
  const CHARS = "!<>-_\\/[]{}—=+*^?#________";

  const run = () => {
    const el = ref.current;
    if (!el) return;
    const target = text;
    let iter = 0;
    const total = target.length;
    const id = setInterval(() => {
      setDisplay(
        target
          .split("")
          .map((c, i) => {
            if (i < iter / 1.6) return target[i];
            return CHARS[Math.floor(Math.random() * CHARS.length)];
          })
          .join("")
      );
      iter += 1;
      if (iter / 1.6 >= total) {
        clearInterval(id);
        setDisplay(target);
      }
    }, speed);
  };

  const Component = Tag as "span";
  return (
    <Component
      ref={ref as React.Ref<HTMLSpanElement>}
      className={className}
      onMouseEnter={run}
      aria-label={text}
    >
      {display}
    </Component>
  );
}

/* ── Magnetic wrapper that pulls children toward cursor ── */
export function MagneticText({
  children,
  strength = 8,
  className,
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  const onMove = (e: React.MouseEvent<HTMLSpanElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const mx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    const my = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    el.style.transform = `translate(${mx * strength}px, ${my * strength}px)`;
    el.style.transition = "transform 0.15s ease-out";
  };
  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.transition = "transform 0.6s cubic-bezier(0.16,1,0.3,1)";
    el.style.transform = "translate(0,0)";
  };

  return (
    <span
      ref={ref}
      className={`inline-block ${className ?? ""}`}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      {children}
    </span>
  );
}

/* ── Panel with animated border gradient ── */
export function SpotlightPanel({
  children,
  className,
  accent = "rgba(124,92,255,0.16)",
  style,
}: {
  children: ReactNode;
  className?: string;
  accent?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
    el.style.setProperty("--tilt-x", `${((e.clientY - r.top) / r.height - 0.5) * 6}deg`);
    el.style.setProperty("--tilt-y", `${((e.clientX - r.left) / r.width - 0.5) * 6}deg`);
  };

  return (
    <div
      ref={ref}
      className={`glass spotlight ${className ?? ""}`}
      style={{
        ["--accent" as string]: accent,
        transform: "perspective(900px) rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg))",
        transition: "transform 0.4s var(--ease, ease), border-color 0.4s",
        ...style,
      }}
      onMouseMove={onMove}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.setProperty("--tilt-x", "0deg");
        el.style.setProperty("--tilt-y", "0deg");
      }}
    >
      {children}
    </div>
  );
}

/* ── Sticky section wrapper ── */
export function RevealGroup({
  children,
  className,
  stagger = 90,
}: {
  children: ReactNode[];
  className?: string;
  stagger?: number;
}) {
  return (
    <div className={className}>
      {children.map((c, i) => (
        <div
          key={i}
          className="reveal"
          style={{ transitionDelay: `${i * stagger}ms` }}
          data-reveal-child
        >
          {c}
        </div>
      ))}
    </div>
  );
}

/* ── Custom hook for scroll reveal of direct children ── */
export function useScrollReveal() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-vis");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -5% 0px" }
    );
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

/* ── Toast notification ── */
export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const show = (m: string) => setMsg(m);
  const hide = () => setMsg(null);
  return { msg, show, hide };
}
