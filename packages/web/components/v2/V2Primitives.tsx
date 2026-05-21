"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import type { CSSProperties, ReactNode } from "react";

const LazyOrgSwitcher = dynamic(
  () => import("@/components/org/OrgSwitcher").then((m) => m.OrgSwitcher),
  { ssr: false }
);

// ─── Token palette (terracotta direction from the v2 design exploration) ───
export const v2 = {
  cream: "#f7f4ee",
  cream2: "#efeae0",
  ink: "#1a1816",
  inkSoft: "#5a5852",
  inkFaint: "#8b8780",
  rule: "#e5e0d6",
  ruleHard: "#d8d2c4",
  accent: "#b8623d",
  accentSoft: "#e8c9b8",
  danger: "#8c2f25",
  dangerSoft: "#d6b3a8",
  night: "#0f0d0a",
  nightSoft: "#1a1714",
} as const;

export const v2Sans = "var(--font-figtree), system-ui, sans-serif";
export const v2Serif = '"EB Garamond", var(--font-eb-garamond), Georgia, serif';
export const v2Mono = '"IBM Plex Mono", var(--font-ibm-plex-mono), ui-monospace, monospace';

// Tiny inline-mono span — used inside larger sentences for codes, durations.
export function V2Mono({ children, style = {} }: { children: ReactNode; style?: CSSProperties }) {
  return <span style={{ fontFamily: v2Mono, ...style }}>{children}</span>;
}

// All-caps mono label. Section eyebrows, source pills, timeline taglines.
export function V2Caps({
  children,
  color = v2.inkFaint,
  size = 10,
  className,
}: {
  children: ReactNode;
  color?: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={className}
      style={{
        fontFamily: v2Mono,
        fontSize: size,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

// Source pill — timeline meta line.
export function V2Source({ name, kind }: { name: string; kind?: string }) {
  return (
    <div
      style={{
        fontFamily: v2Mono,
        fontSize: 10,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: v2.inkFaint,
      }}
    >
      {name}
      {kind ? <> · {kind}</> : null}
    </div>
  );
}

// Wordmark — circle glyph + serif "Oscar". Links home unless `as` overrides.
export function V2Wordmark({ light = false, href = "/" }: { light?: boolean; href?: string }) {
  const ink = light ? v2.cream : v2.ink;
  return (
    <Link href={href} className="inline-flex items-center gap-2.5 hover:opacity-80 transition-opacity">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="10.5" stroke={ink} strokeWidth="1.2" />
        <path
          d="M7.5 12c0-1.6.8-2.5 1.8-2.5M9.3 14.5c-1 0-1.8-1-1.8-2.4M12 8.5v7M14.8 10v4M17.5 11.2v1.8"
          stroke={ink}
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
      <span
        style={{
          fontFamily: v2Serif,
          fontSize: 22,
          letterSpacing: "-0.005em",
          fontWeight: 500,
          color: ink,
        }}
      >
        Oscar
      </span>
    </Link>
  );
}

export function V2Avatar({
  size = 32,
  initial = "S",
  color = v2.accent,
}: {
  size?: number;
  initial?: string;
  color?: string;
}) {
  return (
    <div
      className="inline-flex items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: color,
        color: v2.cream,
        fontFamily: v2Serif,
        fontSize: size * 0.45,
        fontWeight: 500,
      }}
    >
      {initial}
    </div>
  );
}

type HeaderNav = { label: string; href: string };

// Editorial top nav used on signed-in app surfaces.
export function V2WebHeader({
  active,
  links,
  right,
}: {
  active?: string;
  links?: HeaderNav[];
  right?: ReactNode;
}) {
  const pathname = usePathname();
  const defaultLinks: HeaderNav[] = [
    { label: "TODAY", href: "/" },
    { label: "LIBRARY", href: "/scribble" },
    { label: "MINUTES", href: "/meetings" },
    { label: "TEAM", href: "/team" },
    { label: "SETTINGS", href: "/settings" },
  ];
  const navLinks = links ?? defaultLinks;
  const activeLabel = (active ?? navLinks.find((l) => l.href === pathname)?.label ?? "").toUpperCase();

  return (
    <header
      className="flex items-center justify-between px-6 md:px-14 py-6"
      style={{ borderBottom: `1px solid ${v2.rule}` }}
    >
      <V2Wordmark />
      <nav className="hidden md:flex items-center gap-7 lg:gap-9">
        {navLinks.map((link) => {
          const isActive = link.label.toUpperCase() === activeLabel;
          if (isActive) {
            return (
              <Link
                key={link.label}
                href={link.href}
                style={{
                  fontFamily: v2Mono,
                  fontSize: 11,
                  letterSpacing: "0.18em",
                  color: v2.ink,
                  borderBottom: `1px solid ${v2.ink}`,
                  paddingBottom: 2,
                }}
              >
                {link.label.toUpperCase()}
              </Link>
            );
          }
          return (
            <Link key={link.label} href={link.href} className="hover:opacity-80 transition-opacity">
              <V2Caps>{link.label.toUpperCase()}</V2Caps>
            </Link>
          );
        })}
      </nav>
      <div className="flex items-center gap-3">
        <LazyOrgSwitcher />
        {right}
      </div>
    </header>
  );
}

// Team workspace top nav.
export function V2TeamHeader({
  active,
  org = "Workspace",
}: {
  active?: "FEED" | "DOCS" | "MEMBERS" | "SETTINGS";
  org?: string;
}) {
  const items: Array<{ label: "FEED" | "DOCS" | "MEMBERS" | "SETTINGS"; href: string }> = [
    { label: "FEED", href: "/team" },
    { label: "DOCS", href: "/team/docs" },
    { label: "MEMBERS", href: "/settings/organization?tab=members" },
    { label: "SETTINGS", href: "/settings/organization" },
  ];
  return (
    <header
      className="flex items-center justify-between px-6 md:px-14 py-6"
      style={{ borderBottom: `1px solid ${v2.rule}` }}
    >
      <div className="flex items-center gap-6">
        <V2Wordmark />
        <div
          className="flex items-center gap-2.5 rounded-full pl-2 pr-3 py-1"
          style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}
        >
          <div
            style={{
              height: 22,
              width: 22,
              borderRadius: 5,
              background: v2.accent,
              color: v2.cream,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: v2Serif,
              fontWeight: 500,
              fontSize: 12,
            }}
          >
            {org.charAt(0).toUpperCase()}
          </div>
          <span style={{ fontSize: 13, color: v2.ink, fontWeight: 500 }}>{org}</span>
        </div>
      </div>
      <nav className="hidden md:flex items-center gap-8">
        {items.map((item) =>
          item.label === active ? (
            <Link
              key={item.label}
              href={item.href}
              style={{
                fontFamily: v2Mono,
                fontSize: 11,
                letterSpacing: "0.18em",
                color: v2.ink,
                borderBottom: `1px solid ${v2.ink}`,
                paddingBottom: 2,
              }}
            >
              {item.label}
            </Link>
          ) : (
            <Link key={item.label} href={item.href} className="hover:opacity-80 transition-opacity">
              <V2Caps>{item.label}</V2Caps>
            </Link>
          )
        )}
      </nav>
    </header>
  );
}

// Public-marketing top nav (no app links, "Get Oscar" CTA).
export function V2MarketingHeader({
  active,
  ctaLabel = "Get Oscar",
  ctaHref = "/auth",
}: {
  active?: "PRODUCT" | "PRICING" | "BLOG" | "SIGN IN";
  ctaLabel?: string;
  ctaHref?: string;
}) {
  const items: Array<{ label: "PRODUCT" | "PRICING" | "BLOG" | "SIGN IN"; href: string }> = [
    { label: "PRODUCT", href: "/" },
    { label: "PRICING", href: "/pricing" },
    { label: "BLOG", href: "/" },
    { label: "SIGN IN", href: "/auth" },
  ];
  return (
    <header className="flex items-center justify-between px-6 md:px-14 py-7">
      <V2Wordmark />
      <nav className="hidden md:flex items-center gap-9">
        {items.map((item) => {
          const isActive = active === item.label;
          return (
            <Link key={item.label} href={item.href} className="hover:opacity-80 transition-opacity">
              {isActive ? (
                <span
                  style={{
                    fontFamily: v2Mono,
                    fontSize: 11,
                    letterSpacing: "0.18em",
                    color: v2.ink,
                    borderBottom: `1px solid ${v2.ink}`,
                    paddingBottom: 2,
                  }}
                >
                  {item.label}
                </span>
              ) : (
                <V2Caps>{item.label}</V2Caps>
              )}
            </Link>
          );
        })}
      </nav>
      <Link
        href={ctaHref}
        className="rounded-full px-5 py-2.5 text-[13px] font-medium"
        style={{ background: v2.ink, color: v2.cream }}
      >
        {ctaLabel}
      </Link>
    </header>
  );
}
