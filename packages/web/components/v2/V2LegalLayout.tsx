"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  v2,
  v2Serif,
  v2Mono,
  V2Caps,
  V2Wordmark,
  V2Footer,
} from "@/components/v2/V2Primitives";

type Tab = "PRIVACY" | "TERMS" | "REFUNDS";

const TABS: Array<{ label: Tab; href: string }> = [
  { label: "PRIVACY", href: "/privacy" },
  { label: "TERMS", href: "/terms" },
  { label: "REFUNDS", href: "/refund-policy" },
];

export function V2LegalLayout({
  active,
  eyebrow,
  title,
  lead,
  toc,
  children,
}: {
  active: Tab;
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  toc?: string[];
  children: ReactNode;
}) {
  return (
    <main
      style={{
        background: v2.cream,
        color: v2.ink,
        minHeight: "100vh",
        fontFamily: "var(--font-figtree), system-ui",
      }}
    >
      <header
        className="flex items-center justify-between px-6 md:px-14 py-7"
        style={{ borderBottom: `1px solid ${v2.rule}` }}
      >
        <V2Wordmark />
        <nav className="flex items-center gap-6 md:gap-8">
          {TABS.map((t) =>
            t.label === active ? (
              <span
                key={t.label}
                style={{
                  fontFamily: v2Mono,
                  fontSize: 11,
                  letterSpacing: "0.18em",
                  color: v2.ink,
                  borderBottom: `1px solid ${v2.ink}`,
                  paddingBottom: 2,
                }}
              >
                {t.label}
              </span>
            ) : (
              <Link key={t.label} href={t.href} className="hover:opacity-80 transition-opacity">
                <V2Caps>{t.label}</V2Caps>
              </Link>
            )
          )}
        </nav>
      </header>

      <article
        className="mx-auto px-6 md:px-14 py-12 md:py-16 grid grid-cols-12 gap-8 md:gap-14"
        style={{ maxWidth: 1180 }}
      >
        {toc && toc.length > 0 && (
          <aside className="hidden md:block col-span-3">
            <div style={{ position: "sticky", top: 60 }}>
              <V2Caps>ON THIS PAGE</V2Caps>
              <nav className="mt-4 space-y-2.5 text-[13px]">
                {toc.map((t, i) => (
                  <a
                    key={t}
                    href={`#${t.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                    className="block hover:opacity-80"
                    style={{
                      color: i === 0 ? v2.ink : v2.inkSoft,
                      fontWeight: i === 0 ? 500 : 400,
                    }}
                  >
                    {i === 0 ? "→ " : ""}
                    {t}
                  </a>
                ))}
              </nav>
            </div>
          </aside>
        )}

        <section
          className={toc && toc.length > 0 ? "col-span-12 md:col-span-9" : "col-span-12"}
          style={{ maxWidth: 760 }}
        >
          <V2Caps>{eyebrow}</V2Caps>
          <h1
            className="mt-3"
            style={{
              fontFamily: v2Serif,
              fontSize: "clamp(44px, 7vw, 72px)",
              lineHeight: 0.96,
              letterSpacing: "-0.025em",
              fontWeight: 500,
            }}
          >
            {title}
          </h1>
          {lead && (
            <p
              className="mt-7 leading-relaxed"
              style={{
                fontFamily: v2Serif,
                fontSize: 20,
                lineHeight: 1.55,
                color: v2.ink,
              }}
            >
              {lead}
            </p>
          )}

          <div className="mt-12 space-y-12 v2-legal-body">{children}</div>
        </section>
      </article>

      <V2Footer />

      <style jsx global>{`
        .v2-legal-body h2 {
          font-family: "EB Garamond", Georgia, serif;
          font-size: 32px;
          font-weight: 500;
          letter-spacing: -0.015em;
          line-height: 1.1;
          margin-top: 32px;
          margin-bottom: 12px;
          color: #1a1816;
        }
        .v2-legal-body h3 {
          font-family: "EB Garamond", Georgia, serif;
          font-size: 22px;
          font-weight: 500;
          letter-spacing: -0.005em;
          line-height: 1.2;
          margin-top: 20px;
          margin-bottom: 8px;
          color: #1a1816;
        }
        .v2-legal-body p {
          font-size: 16px;
          line-height: 1.7;
          color: #1a1816;
          margin-bottom: 12px;
        }
        .v2-legal-body ul {
          padding-left: 0;
          list-style: none;
          margin-top: 8px;
        }
        .v2-legal-body ul li {
          padding-left: 20px;
          margin-bottom: 14px;
          position: relative;
        }
        .v2-legal-body ul li::before {
          content: "·";
          position: absolute;
          left: 4px;
          color: #b8623d;
          font-weight: 700;
        }
        .v2-legal-body aside ul li {
          padding-left: 0;
        }
        .v2-legal-body aside ul li::before {
          display: none;
        }
        .v2-legal-body a {
          color: #b8623d;
          text-decoration: underline;
        }
        .v2-legal-body section {
          padding-top: 8px;
        }
      `}</style>
    </main>
  );
}
