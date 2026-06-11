"use client";

import { useState } from "react";
import {
  v2,
  v2Serif,
  v2Mono,
  V2Caps,
  V2PublicHeader,
  V2Footer,
} from "@/components/v2/V2Primitives";
import {
  RELEASES,
  CHANGELOG_FILTERS,
  type ChangeKind,
  type ChangeArea,
  type Release,
} from "@/lib/changelog.data";

const GITHUB_RELEASES_URL = "https://github.com/navgurukul/oscar/releases";

// ─── ClPill ──────────────────────────────────────────────────────────────
function ClPill({ kind }: { kind: ChangeKind }) {
  const map: Record<ChangeKind, { label: string; bg: string; fg: string; bd: string }> = {
    new: { label: "NEW", bg: v2.accent, fg: v2.cream, bd: "transparent" },
    improved: { label: "IMPROVED", bg: "transparent", fg: v2.inkSoft, bd: v2.ruleHard },
    fixed: { label: "FIXED", bg: v2.cream2, fg: v2.inkFaint, bd: "transparent" },
  };
  const s = map[kind];
  return (
    <span
      style={{
        fontFamily: v2Mono,
        fontSize: 9.5,
        letterSpacing: "0.16em",
        fontWeight: 500,
        textTransform: "uppercase",
        color: s.fg,
        background: s.bg,
        border: `1px solid ${s.bd}`,
        borderRadius: 999,
        padding: "3px 8px",
        whiteSpace: "nowrap",
        lineHeight: 1,
        display: "inline-block",
      }}
    >
      {s.label}
    </span>
  );
}

// ─── ClChange ────────────────────────────────────────────────────────────
function ClChange({ kind, area, children }: { kind: ChangeKind; area: ChangeArea; children: React.ReactNode }) {
  return (
    <li
      className="flex items-start gap-4 py-3.5"
      style={{ borderTop: `1px solid ${v2.rule}` }}
    >
      <span className="shrink-0 pt-0.5" style={{ width: 78 }}>
        <ClPill kind={kind} />
      </span>
      <div className="flex-1">
        <p className="text-[14.5px] leading-relaxed" style={{ color: v2.ink }}>
          {children}
        </p>
      </div>
      <span className="shrink-0 pt-1 hidden lg:block" style={{ width: 92, textAlign: "right" }}>
        <V2Caps size={9}>{area}</V2Caps>
      </span>
    </li>
  );
}

// ─── ClFeatureVignette ───────────────────────────────────────────────────
// The Stream pill as presence — terracotta only while audio is live, and a
// "on your machine" caption that matches the real local-first behaviour.
function ClFeatureVignette() {
  return (
    <div
      className="mt-7 overflow-hidden"
      style={{ borderRadius: 14, border: `1px solid ${v2.ruleHard}`, background: v2.night }}
    >
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ borderBottom: "1px solid #2a2520" }}
      >
        <span className="rounded-full" style={{ width: 9, height: 9, background: "#3a342e" }} />
        <span className="rounded-full" style={{ width: 9, height: 9, background: "#3a342e" }} />
        <span className="rounded-full" style={{ width: 9, height: 9, background: "#3a342e" }} />
        <span
          className="ml-3"
          style={{ fontFamily: v2Mono, fontSize: 10, letterSpacing: "0.14em", color: "#7a7670" }}
        >
          STREAM · ON YOUR MACHINE
        </span>
      </div>
      <div className="px-7 py-9 flex flex-col items-center gap-6">
        <div
          className="inline-flex items-center gap-3 rounded-full"
          style={{
            background: "#1a1714",
            padding: "13px 22px",
            boxShadow: `0 14px 36px rgba(184,98,61,0.28)`,
          }}
        >
          <span
            className="inline-block rounded-full"
            style={{
              height: 8,
              width: 8,
              background: v2.accent,
              boxShadow: `0 0 14px ${v2.accent}`,
            }}
          />
          <span className="inline-flex items-end gap-0.5" style={{ height: 14 }}>
            {[3, 7, 5, 10, 4, 8, 6, 9, 5, 7].map((h, i) => (
              <span
                key={i}
                className="rounded-full"
                style={{ background: v2.accent, width: 2, height: h }}
              />
            ))}
          </span>
          <span style={{ fontFamily: v2Serif, fontSize: 12.5, color: v2.cream2 }}>
            listening · 0:08
          </span>
        </div>
        <p
          style={{
            fontFamily: v2Mono,
            fontSize: 12.5,
            lineHeight: 1.7,
            color: "#b8b2a8",
            maxWidth: 420,
            textAlign: "center",
          }}
        >
          Audio is transcribed{" "}
          <span style={{ color: v2.accentSoft }}>locally</span> — your dictation
          never leaves the desktop or reaches the web.
        </p>
      </div>
    </div>
  );
}

// ─── ClRelease ───────────────────────────────────────────────────────────
function ClRelease({ release, areaFilter }: { release: Release; areaFilter: ChangeArea | null }) {
  const changes = areaFilter
    ? release.changes.filter((c) => c.area === areaFilter)
    : release.changes;

  if (changes.length === 0) return null;

  return (
    <article className="grid grid-cols-12 gap-x-6 md:gap-x-10">
      {/* left rail */}
      <div className="hidden md:block md:col-span-3">
        <div className="sticky" style={{ top: 40 }}>
          <V2Caps size={10}>{release.date}</V2Caps>
          <div className="mt-2 flex items-baseline gap-2.5">
            <h3
              style={{
                fontFamily: v2Serif,
                fontSize: 30,
                lineHeight: 1,
                letterSpacing: "-0.02em",
                fontWeight: 500,
                color: v2.ink,
              }}
            >
              {release.version}
            </h3>
          </div>
          <div className="mt-3">
            <V2Caps size={9} color={v2.accent}>
              {release.tag}
            </V2Caps>
          </div>
        </div>
      </div>

      {/* content column */}
      <div
        className="col-span-12 md:col-span-9 relative pb-16 md:pb-20"
        style={{ borderLeft: `1px solid ${v2.rule}`, paddingLeft: 28 }}
      >
        {/* node dot */}
        <span
          className="absolute rounded-full"
          style={{
            left: -6,
            top: 6,
            width: 11,
            height: 11,
            background: release.featured ? v2.accent : v2.cream,
            border: `2px solid ${release.featured ? v2.accent : v2.ruleHard}`,
            boxShadow: release.featured ? `0 0 0 4px ${v2.accentSoft}` : "none",
          }}
        />

        {/* mobile version + date */}
        <div className="md:hidden mb-4">
          <div className="flex items-baseline gap-3">
            <span
              style={{
                fontFamily: v2Serif,
                fontSize: 24,
                lineHeight: 1,
                letterSpacing: "-0.02em",
                fontWeight: 500,
                color: v2.ink,
              }}
            >
              {release.version}
            </span>
            <V2Caps size={9} color={v2.accent}>
              {release.tag}
            </V2Caps>
          </div>
          <div className="mt-1">
            <V2Caps size={9}>{release.date}</V2Caps>
          </div>
        </div>

        <h2
          style={{
            fontFamily: v2Serif,
            fontSize: release.featured ? 40 : 28,
            lineHeight: 1.04,
            letterSpacing: "-0.025em",
            fontWeight: 500,
            color: v2.ink,
            maxWidth: 640,
          }}
        >
          {release.title}
        </h2>
        {release.lede && (
          <p
            className="mt-5 text-[16px] leading-relaxed"
            style={{ color: v2.inkSoft, maxWidth: 560 }}
          >
            {release.lede}
          </p>
        )}
        {release.vignette && <ClFeatureVignette />}
        <ul className="mt-8">
          {changes.map((c, i) => (
            <ClChange key={i} kind={c.kind} area={c.area}>
              {c.text}
            </ClChange>
          ))}
        </ul>
      </div>
    </article>
  );
}

// ═══ PAGE ═════════════════════════════════════════════════════════════════
export default function ChangelogPage() {
  const [filterLabel, setFilterLabel] = useState("All");
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const areaFilter =
    CHANGELOG_FILTERS.find((f) => f.label === filterLabel)?.area ?? null;

  const visibleReleases = RELEASES.filter((r) =>
    areaFilter ? r.changes.some((c) => c.area === areaFilter) : true,
  );

  function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    if (email.trim()) setSubscribed(true);
  }

  return (
    <main style={{ background: v2.cream, color: v2.ink, minHeight: "100vh" }}>
      <V2PublicHeader active="CHANGELOG" />

      {/* hero */}
      <section
        className="px-6 md:px-14 pt-20 md:pt-24 pb-14 md:pb-16"
        style={{ borderTop: `1px solid ${v2.rule}` }}
      >
        <div className="grid grid-cols-12 gap-6 md:gap-x-10 items-end">
          <div className="col-span-12 md:col-span-8">
            <V2Caps>CHANGELOG · EVERY UPDATE, NEWEST FIRST</V2Caps>
            <h1
              className="mt-5"
              style={{
                fontFamily: v2Serif,
                fontSize: "clamp(52px, 8vw, 92px)",
                lineHeight: 0.94,
                letterSpacing: "-0.035em",
                fontWeight: 500,
                maxWidth: 760,
              }}
            >
              What&rsquo;s{" "}
              <em style={{ fontStyle: "italic", color: v2.accent }}>new</em>
              <br />
              in Oscar.
            </h1>
            <p
              className="mt-7 text-[16px] md:text-[17px] leading-relaxed"
              style={{ color: v2.inkSoft, maxWidth: 480 }}
            >
              Every shipped change to Stream, Minutes, Scribble, and the workspace
              — the small fixes and the big swings.
            </p>
          </div>

          <div className="col-span-12 md:col-span-4 flex flex-col items-start md:items-end gap-4 md:pb-2">
            {subscribed ? (
              <p className="text-[13px]" style={{ color: v2.inkSoft }}>
                <span style={{ color: v2.accent }}>✓</span>&nbsp; You&rsquo;re subscribed.
              </p>
            ) : (
              <form onSubmit={handleSubscribe} className="flex items-center gap-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@work.com"
                  className="rounded-full text-[13px] outline-none"
                  style={{
                    background: v2.cream,
                    border: `1px solid ${v2.ruleHard}`,
                    padding: "11px 16px",
                    width: 190,
                    color: v2.ink,
                    fontFamily: "inherit",
                  }}
                />
                <button
                  type="submit"
                  className="rounded-full px-5 py-2.5 text-[13px] font-medium whitespace-nowrap"
                  style={{ background: v2.ink, color: v2.cream }}
                >
                  Subscribe
                </button>
              </form>
            )}
            <a
              href={GITHUB_RELEASES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2"
              style={{ color: v2.inkFaint }}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <circle cx="3" cy="13" r="1.6" fill={v2.inkFaint} />
                <path
                  d="M2 8.5a5.5 5.5 0 0 1 5.5 5.5M2 4a10 10 0 0 1 10 10"
                  stroke={v2.inkFaint}
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
              <V2Caps size={9}>ALL RELEASES</V2Caps>
            </a>
          </div>
        </div>

        {/* filter chips */}
        <div className="mt-10 md:mt-12 flex items-center gap-2 md:gap-2.5 flex-wrap">
          {CHANGELOG_FILTERS.map(({ label }) => {
            const active = filterLabel === label;
            return (
              <button
                key={label}
                onClick={() => setFilterLabel(label)}
                className="rounded-full text-[12.5px] font-medium transition-colors"
                style={{
                  padding: "7px 15px",
                  background: active ? v2.ink : "transparent",
                  color: active ? v2.cream : v2.inkSoft,
                  border: `1px solid ${active ? v2.ink : v2.ruleHard}`,
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </section>

      {/* timeline */}
      <section
        className="px-6 md:px-14 pt-14 md:pt-16 pb-8"
        style={{ borderTop: `1px solid ${v2.rule}` }}
      >
        <div className="space-y-0">
          {visibleReleases.map((r) => (
            <ClRelease key={r.version} release={r} areaFilter={areaFilter} />
          ))}

          {visibleReleases.length === 0 && (
            <div className="grid grid-cols-12 gap-x-6 md:gap-x-10">
              <div className="hidden md:block md:col-span-3" />
              <div
                className="col-span-12 md:col-span-9 pb-20"
                style={{ borderLeft: `1px solid ${v2.rule}`, paddingLeft: 28 }}
              >
                <p
                  style={{
                    fontFamily: v2Serif,
                    fontSize: 18,
                    color: v2.inkFaint,
                    fontStyle: "italic",
                  }}
                >
                  No updates in this category yet.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* tail — older history lives on GitHub */}
        <div className="grid grid-cols-12 gap-x-6 md:gap-x-10">
          <div className="hidden md:block md:col-span-3" />
          <div
            className="col-span-12 md:col-span-9 relative pb-4"
            style={{ borderLeft: `1px solid ${v2.rule}`, paddingLeft: 28 }}
          >
            <span
              className="absolute rounded-full"
              style={{ left: -5, top: 6, width: 9, height: 9, background: v2.ruleHard }}
            />
            <p
              style={{
                fontFamily: v2Serif,
                fontSize: 18,
                lineHeight: 1.6,
                color: v2.inkFaint,
                fontStyle: "italic",
              }}
            >
              Earlier builds &mdash;{" "}
              <a
                href={GITHUB_RELEASES_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: v2.accent, fontStyle: "normal" }}
              >
                see the full release history on GitHub
              </a>
              .
            </p>
          </div>
        </div>
      </section>

      {/* footer */}
      <V2Footer />
    </main>
  );
}
