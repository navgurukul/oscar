"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { scribblesService } from "@/lib/services/scribbles.service";
import type { DBScribble } from "@/lib/types/scribble.types";
import { ROUTES, UI_STRINGS } from "@/lib/constants";
import {
  v2,
  v2Serif,
  V2Caps,
  V2Mono,
  V2Wordmark,
  V2Source,
  V2WebHeader,
  V2MarketingHeader,
} from "@/components/v2/V2Primitives";

const TESTIMONIALS: Array<[string, string]> = [
  ["It's the only writing tool I open before I start writing.", "MIRA PATEL · DESIGNER"],
  ["I haven't typed a Slack message in three weeks.", "ROSHNI JHA · PM"],
  ["Oscar caught a detail in a meeting that I missed live.", "SOUVIK DEB · FOUNDER"],
];

const MODES: Array<[string, string, string, string]> = [
  [
    "01",
    "Stream",
    "Dictate into anything.",
    "Hold Ctrl + Space anywhere. Oscar types cleaned text directly into the app you're in — Slack, Notion, Cursor, Gmail, your terminal.",
  ],
  [
    "02",
    "Minutes",
    "Meeting notes, automatic.",
    "Click record before any call. Oscar captures the whole thing and writes back what mattered — decisions, actions, follow-ups.",
  ],
  [
    "03",
    "Scribble",
    "Voice notes, organized.",
    "Long-form thinking out loud. Oscar shapes your ramble into a Scribble — TL;DR, structure, the parts worth keeping.",
  ],
];

function formatDate(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.floor((nowOnly.getTime() - dateOnly.getTime()) / (1000 * 3600 * 24));
  const time = date
    .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })
    .toUpperCase();
  if (diffDays === 0) return `TODAY · ${time}`;
  if (diffDays === 1) return `YESTERDAY · ${time}`;
  return `${diffDays} DAYS AGO`;
}

function SignedInHome({ recents, firstName }: { recents: DBScribble[]; firstName: string }) {
  return (
    <main style={{ background: v2.cream, color: v2.ink, fontFamily: "var(--font-figtree), system-ui" }}>
      <V2WebHeader active="TODAY" />

      <section className="px-6 md:px-14 pt-16 md:pt-24 pb-12">
        <V2Caps>
          {new Date()
            .toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
            .toUpperCase()}{" "}
          · WELCOME BACK
        </V2Caps>
        <h1
          className="mt-4"
          style={{
            fontFamily: v2Serif,
            fontSize: "clamp(48px, 9vw, 92px)",
            lineHeight: 0.96,
            letterSpacing: "-0.025em",
            fontWeight: 500,
            maxWidth: 920,
          }}
        >
          Hello, {firstName}.<br />
          Ready to <em style={{ fontStyle: "italic", color: v2.accent }}>listen</em>?
        </h1>
        <p className="mt-7 max-w-xl text-[16px] leading-relaxed" style={{ color: v2.inkSoft }}>
          Press record and Oscar shapes your voice into a Scribble — clean, titled, and filed
          before you finish your second sentence.
        </p>
        <div className="mt-10 flex items-center gap-6 flex-wrap">
          <Link
            href={ROUTES.RECORDING}
            className="inline-flex items-center gap-3 rounded-full px-6 py-3"
            style={{ background: v2.ink, color: v2.cream, fontSize: 14, fontWeight: 500 }}
          >
            <span className="inline-block rounded-full" style={{ height: 7, width: 7, background: v2.accent }} />
            Record a Scribble
          </Link>
          <Link href="/scribble" className="text-[14px]" style={{ color: v2.inkSoft }}>
            · or open the library
          </Link>
        </div>
      </section>

      <section className="px-6 md:px-14 pt-12 pb-24" style={{ borderTop: `1px solid ${v2.rule}` }}>
        <div className="grid grid-cols-12 gap-6 md:gap-10 mb-10">
          <div className="col-span-12 md:col-span-2">
            <V2Caps>RECENT · IN ORDER</V2Caps>
          </div>
          <div className="col-span-12 md:col-span-10 flex items-center gap-7">
            <span
              style={{ fontSize: 13, color: v2.ink, borderBottom: `1px solid ${v2.ink}`, paddingBottom: 1 }}
            >
              All
            </span>
            <Link href="/scribble" className="text-[13px]" style={{ color: v2.inkSoft }}>
              Scribble
            </Link>
            <Link href="/meetings" className="text-[13px]" style={{ color: v2.inkSoft }}>
              Minutes
            </Link>
            <Link
              href="/scribble"
              style={{ marginLeft: "auto", fontSize: 13, color: v2.accent }}
            >
              View library →
            </Link>
          </div>
        </div>

        {recents.length === 0 ? (
          <div
            className="rounded-xl py-16 px-6 text-center"
            style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}
          >
            <V2Caps color={v2.accent}>FIRST SCRIBBLE</V2Caps>
            <h3
              className="mt-3"
              style={{
                fontFamily: v2Serif,
                fontSize: 36,
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
                fontWeight: 500,
              }}
            >
              Nothing here <em style={{ color: v2.accent }}>yet</em>.
            </h3>
            <p className="mt-3 mx-auto max-w-md text-[14px] leading-relaxed" style={{ color: v2.inkSoft }}>
              Hit record below. Oscar will clean, title, and file the result.
            </p>
            <Link
              href={ROUTES.RECORDING}
              className="inline-flex items-center gap-3 mt-7 rounded-full px-5 py-2.5"
              style={{ background: v2.ink, color: v2.cream, fontSize: 14, fontWeight: 500 }}
            >
              <span className="inline-block rounded-full" style={{ height: 7, width: 7, background: v2.accent }} />
              Make your first Scribble
            </Link>
          </div>
        ) : (
          <div className="space-y-10">
            {recents.map((s) => {
              const preview = (s.edited_text || s.original_formatted_text || "").slice(0, 280);
              return (
                <Link
                  key={s.id}
                  href={`${ROUTES.SCRIBBLE}/${s.id}`}
                  className="grid grid-cols-12 gap-6 md:gap-10 group"
                >
                  <div className="col-span-12 md:col-span-2 pt-1.5">
                    <V2Mono style={{ fontSize: 13, color: v2.ink }}>
                      {formatDate(s.created_at)}
                    </V2Mono>
                    <div className="mt-1.5">
                      <V2Source name="SCRIBBLE" kind={s.folder ? s.folder.toUpperCase() : undefined} />
                    </div>
                  </div>
                  <div className="col-span-12 md:col-span-10">
                    <h3
                      style={{
                        fontFamily: v2Serif,
                        fontSize: 24,
                        lineHeight: 1.25,
                        letterSpacing: "-0.005em",
                        fontWeight: 500,
                      }}
                    >
                      {s.title || UI_STRINGS.UNTITLED_SCRIBBLE}
                    </h3>
                    <p
                      className="mt-2 text-[14px] leading-relaxed"
                      style={{ color: v2.inkSoft, maxWidth: 720 }}
                    >
                      {preview}
                      {(s.edited_text || s.original_formatted_text || "").length > 280 ? "…" : ""}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <footer
        className="px-6 md:px-14 py-10 flex items-center justify-between"
        style={{ borderTop: `1px solid ${v2.rule}` }}
      >
        <V2Caps>OSCAR · LISTENING SURFACE</V2Caps>
        <V2Caps>{recents.length} RECENT · OPEN LIBRARY →</V2Caps>
      </footer>
    </main>
  );
}

function MarketingLanding({ onStart }: { onStart: () => void }) {
  return (
    <main style={{ background: v2.cream, color: v2.ink, fontFamily: "var(--font-figtree), system-ui" }}>
      <V2MarketingHeader active="PRODUCT" />

      <section className="px-6 md:px-14 pt-20 md:pt-32 pb-20 md:pb-24 text-center">
        <V2Caps>VOICE-FIRST WRITING · FOR PEOPLE WHO TYPE TOO MUCH</V2Caps>
        <h1
          className="mt-6 mx-auto"
          style={{
            fontFamily: v2Serif,
            fontSize: "clamp(56px, 11vw, 132px)",
            lineHeight: 0.93,
            letterSpacing: "-0.035em",
            fontWeight: 500,
            maxWidth: 1100,
          }}
        >
          You talk.<br />
          Oscar <em style={{ fontStyle: "italic", color: v2.accent }}>listens</em>,<br />
          shapes it,<br />
          hands it back.
        </h1>
        <p className="mt-10 mx-auto max-w-xl text-[17px] leading-relaxed" style={{ color: v2.inkSoft }}>
          A dictation tool that knows what app you&rsquo;re in and writes the way that app deserves. Slack
          reads like Slack. Code reads like code. Letters read like letters.
        </p>
        <div className="mt-10 flex items-center justify-center gap-5 flex-wrap">
          <button
            onClick={onStart}
            className="inline-flex items-center gap-3 rounded-full px-6 py-3 text-[14px] font-medium"
            style={{ background: v2.ink, color: v2.cream }}
          >
            <span className="inline-block rounded-full" style={{ height: 7, width: 7, background: v2.accent }} />
            Try Oscar free
          </button>
          <Link href="/download" className="text-[14px]" style={{ color: v2.inkSoft }}>
            · or download the desktop app
          </Link>
        </div>

        <div
          className="mt-16 md:mt-20 inline-flex items-center gap-3 rounded-full"
          style={{
            background: v2.ink,
            color: v2.cream,
            padding: "14px 22px",
            boxShadow: "0 12px 32px rgba(184,98,61,0.18)",
          }}
        >
          <span
            className="inline-block rounded-full"
            style={{ height: 8, width: 8, background: v2.accent, boxShadow: `0 0 14px ${v2.accent}` }}
          />
          <span className="inline-flex items-end gap-0.5" style={{ height: 14 }}>
            {[3, 7, 5, 10, 4, 8, 6, 9, 5, 7, 4, 8].map((h, i) => (
              <span
                key={i}
                className="rounded-full"
                style={{ background: v2.accent, width: 2, height: h }}
              />
            ))}
          </span>
          <span style={{ fontSize: 13, color: v2.cream2 }}>· listening · 0:08</span>
        </div>
      </section>

      <section className="px-6 md:px-14 py-20 md:py-24" style={{ borderTop: `1px solid ${v2.rule}` }}>
        <V2Caps>THREE WAYS TO LISTEN</V2Caps>
        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-12">
          {MODES.map(([n, tag, title, body]) => (
            <article key={n}>
              <div className="flex items-baseline gap-3">
                <V2Mono style={{ fontSize: 12, color: v2.accent, letterSpacing: "0.16em" }}>{n}</V2Mono>
                <V2Caps>{tag.toUpperCase()}</V2Caps>
              </div>
              <h3
                className="mt-3"
                style={{
                  fontFamily: v2Serif,
                  fontSize: 36,
                  lineHeight: 1.05,
                  letterSpacing: "-0.02em",
                  fontWeight: 500,
                }}
              >
                {title}
              </h3>
              <p className="mt-4 text-[14px] leading-relaxed" style={{ color: v2.inkSoft }}>
                {body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section
        className="px-6 md:px-14 py-20 md:py-24"
        style={{ borderTop: `1px solid ${v2.rule}`, background: v2.cream2 }}
      >
        <V2Caps>WHAT PEOPLE SAY</V2Caps>
        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-12">
          {TESTIMONIALS.map(([quote, by], i) => (
            <blockquote key={i}>
              <p
                style={{
                  fontFamily: v2Serif,
                  fontSize: 24,
                  lineHeight: 1.32,
                  letterSpacing: "-0.005em",
                }}
              >
                &ldquo;{quote}&rdquo;
              </p>
              <div className="mt-4">
                <V2Caps>{by}</V2Caps>
              </div>
            </blockquote>
          ))}
        </div>
      </section>

      <section className="px-6 md:px-14 py-24 md:py-32 text-center" style={{ borderTop: `1px solid ${v2.rule}` }}>
        <h2
          style={{
            fontFamily: v2Serif,
            fontSize: "clamp(40px, 7vw, 72px)",
            lineHeight: 0.98,
            letterSpacing: "-0.025em",
            fontWeight: 500,
          }}
        >
          Try Oscar <em style={{ fontStyle: "italic", color: v2.accent }}>today</em>.
        </h2>
        <button
          onClick={onStart}
          className="mt-9 rounded-full px-7 py-3.5 text-[15px] font-medium"
          style={{ background: v2.ink, color: v2.cream }}
        >
          Get Oscar — it&rsquo;s free
        </button>
      </section>

      <footer
        className="px-6 md:px-14 py-12 flex items-center justify-between flex-wrap gap-4"
        style={{ borderTop: `1px solid ${v2.rule}` }}
      >
        <V2Wordmark />
        <div className="flex items-center gap-8">
          <Link href="/privacy"><V2Caps>PRIVACY</V2Caps></Link>
          <Link href="/terms"><V2Caps>TERMS</V2Caps></Link>
          <Link href="/refund-policy"><V2Caps>REFUNDS</V2Caps></Link>
          <V2Caps>© NAVGURUKUL · 2026</V2Caps>
        </div>
      </footer>
    </main>
  );
}

export default function Home() {
  const { session, user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [recents, setRecents] = useState<DBScribble[]>([]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await scribblesService.getScribbles();
      if (!cancelled && !error && data) setRecents(data.slice(0, 5));
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const handleStart = () => {
    if (session) router.push(ROUTES.RECORDING);
    else router.push("/auth?redirectTo=/recording");
  };

  if (session && !authLoading) {
    const firstName =
      (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0] ||
      user?.email?.split("@")[0] ||
      "there";
    return <SignedInHome recents={recents} firstName={firstName} />;
  }

  return <MarketingLanding onStart={handleStart} />;
}
