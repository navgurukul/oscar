"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import type { CSSProperties, ReactNode } from "react";

const LazyOrgSwitcher = dynamic(
  () => import("@/components/org/OrgSwitcher").then((m) => m.OrgSwitcher),
  { ssr: false }
);

const LazyAccountMenu = dynamic(
  () => import("@/components/v2/V2AccountMenu").then((m) => m.V2AccountMenu),
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

export function V2OscarMark({
  size = 22,
  light = false,
}: {
  size?: number;
  light?: boolean;
}) {
  const ring = light ? v2.cream : v2.accent;
  const bars = light ? v2.accent : v2.ink;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="9" stroke={ring} strokeWidth="1.35" />
      <path
        d="M7.8 9.9v4.2M9.9 8.5v7M12 10.4v3.2M14.1 8.9v6.2M16.2 9.7v4.6"
        stroke={bars}
        strokeWidth="1.35"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Wordmark — terracotta voice/O glyph + serif "Oscar". Links home unless `as` overrides.
export function V2Wordmark({ light = false, href = "/" }: { light?: boolean; href?: string }) {
  const ink = light ? v2.cream : v2.ink;
  return (
    <Link href={href} className="inline-flex items-center gap-2.5 hover:opacity-80 transition-opacity">
      <V2OscarMark light={light} />
      <span
        style={{
          fontFamily: v2Serif,
          fontSize: 22,
          letterSpacing: 0,
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
export type AppHeaderTab = "TODAY" | "LIBRARY" | "MINUTES" | "TEAM" | "SETTINGS";
export type AppSubNavItem = { label: string; href: string; active?: boolean };

const APP_HEADER_TABS: Array<{ label: AppHeaderTab; href: string; matchPrefix?: string }> = [
  { label: "TODAY", href: "/" },
  { label: "LIBRARY", href: "/scribble", matchPrefix: "/scribble" },
  { label: "MINUTES", href: "/meetings", matchPrefix: "/meetings" },
  { label: "TEAM", href: "/team", matchPrefix: "/team" },
  { label: "SETTINGS", href: "/settings", matchPrefix: "/settings" },
];

function deriveActiveTab(pathname: string | null): AppHeaderTab | undefined {
  if (!pathname) return undefined;
  if (pathname === "/") return "TODAY";
  for (const tab of APP_HEADER_TABS) {
    if (!tab.matchPrefix) continue;
    if (pathname === tab.matchPrefix || pathname.startsWith(tab.matchPrefix + "/")) {
      return tab.label;
    }
  }
  return undefined;
}

// V2AppHeader — single chrome for every signed-in surface.
// Left: wordmark + workspace switcher pill (always visible).
// Center: primary nav (TODAY/LIBRARY/MINUTES/TEAM/SETTINGS).
// Right: account avatar dropdown.
// Optional sub-nav row appears below for nested contexts (e.g. /team FEED · DOCS).
export function V2AppHeader({
  active,
  subNav,
}: {
  active?: AppHeaderTab;
  subNav?: AppSubNavItem[];
}) {
  const pathname = usePathname();
  const activeLabel = active ?? deriveActiveTab(pathname);

  return (
    <header style={{ borderBottom: `1px solid ${v2.rule}` }}>
      <div className="flex items-center justify-between px-6 md:px-14 py-6">
        <div className="flex items-center gap-3 md:gap-4">
          <V2Wordmark />
          <LazyOrgSwitcher />
        </div>
        <nav className="hidden md:flex items-center gap-7 lg:gap-9">
          {APP_HEADER_TABS.map((tab) => {
            const isActive = tab.label === activeLabel;
            if (isActive) {
              return (
                <Link
                  key={tab.label}
                  href={tab.href}
                  style={{
                    fontFamily: v2Mono,
                    fontSize: 11,
                    letterSpacing: "0.18em",
                    color: v2.ink,
                    borderBottom: `1px solid ${v2.ink}`,
                    paddingBottom: 2,
                  }}
                >
                  {tab.label}
                </Link>
              );
            }
            return (
              <Link key={tab.label} href={tab.href} className="hover:opacity-80 transition-opacity">
                <V2Caps>{tab.label}</V2Caps>
              </Link>
            );
          })}
        </nav>
        <LazyAccountMenu />
      </div>
      {subNav && subNav.length > 0 && (
        <div
          className="flex items-center gap-6 px-6 md:px-14 pb-4 -mt-2"
          style={{ borderTop: `1px dashed ${v2.rule}`, paddingTop: 10 }}
        >
          {subNav.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="hover:opacity-80 transition-opacity"
              style={{
                fontFamily: v2Mono,
                fontSize: 10.5,
                letterSpacing: "0.18em",
                color: item.active ? v2.ink : v2.inkFaint,
                borderBottom: item.active ? `1px solid ${v2.ink}` : "1px solid transparent",
                paddingBottom: 2,
              }}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}

// Back-compat alias — old V2WebHeader signature; delegates to V2AppHeader.
// `links` and `right` params are now ignored (single unified chrome handles both).
export function V2WebHeader({
  active,
}: {
  active?: string;
  links?: HeaderNav[];
  right?: ReactNode;
}) {
  const tab = active
    ? (active.toUpperCase() as AppHeaderTab)
    : undefined;
  return <V2AppHeader active={tab} />;
}

// Back-compat alias — workspace/team chrome. Now identical primary chrome with
// optional FEED · DOCS sub-row when active points to a team sub-route.
// `org` param is ignored — the workspace switcher pill (always visible top-left)
// already shows the active workspace name.
export function V2TeamHeader({
  active,
}: {
  active?: "FEED" | "DOCS" | "MEMBERS" | "SETTINGS";
  org?: string;
}) {
  if (active === "FEED" || active === "DOCS") {
    return (
      <V2AppHeader
        active="TEAM"
        subNav={[
          { label: "FEED", href: "/team", active: active === "FEED" },
          { label: "DOCS", href: "/team/docs", active: active === "DOCS" },
        ]}
      />
    );
  }
  // MEMBERS/SETTINGS land on workspace settings — those live under /settings.
  return <V2AppHeader active="SETTINGS" />;
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
