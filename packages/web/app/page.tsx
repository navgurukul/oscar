"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { scribblesService } from "@/lib/services/scribbles.service";
import { meetingsService } from "@/lib/services/meetings.service";
import type { DBScribble } from "@/lib/types/scribble.types";
import type { SavedMeetingRecord } from "@oscar/shared/types";
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

type FilterKey = "all" | "minutes" | "scribbles";

type FeedEvent =
  | {
      kind: "scribble";
      id: string;
      timestamp: string;
      title: string;
      body: string;
      folder: string | null;
      href: string;
    }
  | {
      kind: "minutes";
      id: string;
      timestamp: string;
      title: string;
      body: string;
      meta: string;
      href: string;
    };

function formatTime24(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function meetingPreview(m: SavedMeetingRecord): string {
  const source =
    m.notesMarkdown || m.myNotesMarkdown || m.transcript || "Meeting captured.";
  const flat = source.replace(/[#>*_`]+/g, " ").replace(/\s+/g, " ").trim();
  return flat.length > 260 ? `${flat.slice(0, 260).trim()}…` : flat;
}

function meetingMeta(m: SavedMeetingRecord): string {
  const parts: string[] = [];
  const attendees = m.attendeesCompact?.trim() || "";
  const count = attendees ? attendees.split(",").filter(Boolean).length : 0;
  if (count > 0) parts.push(`${count} ${count === 1 ? "ATTENDEE" : "ATTENDEES"}`);
  if (m.meetingTypeHint && m.meetingTypeHint !== "general") {
    parts.push(m.meetingTypeHint.toUpperCase());
  }
  return parts.join(" · ");
}

function scribblePreview(s: DBScribble): string {
  const text = s.edited_text || s.original_formatted_text || "";
  return text.length > 280 ? `${text.slice(0, 280).trim()}…` : text;
}

function SignedInHome({
  scribbles,
  meetings,
  firstName,
}: {
  scribbles: DBScribble[];
  meetings: SavedMeetingRecord[];
  firstName: string;
}) {
  const [filter, setFilter] = useState<FilterKey>("all");

  const events: FeedEvent[] = useMemo(() => {
    const scribbleEvents: FeedEvent[] = scribbles
      .filter((s) => isToday(s.created_at))
      .map((s) => ({
        kind: "scribble" as const,
        id: s.id,
        timestamp: s.created_at,
        title: s.title || UI_STRINGS.UNTITLED_SCRIBBLE,
        body: scribblePreview(s),
        folder: s.folder,
        href: `${ROUTES.SCRIBBLE}/${s.id}`,
      }));
    const meetingEvents: FeedEvent[] = meetings
      .filter((m) => isToday(m.startedAt))
      .map((m) => ({
        kind: "minutes" as const,
        id: m.id,
        timestamp: m.startedAt,
        title: m.meetingTitle || "Untitled Meeting",
        body: meetingPreview(m),
        meta: meetingMeta(m),
        href: `${ROUTES.MEETINGS}/${m.id}`,
      }));
    return [...scribbleEvents, ...meetingEvents].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [scribbles, meetings]);

  const visible = useMemo(() => {
    if (filter === "all") return events;
    if (filter === "minutes") return events.filter((e) => e.kind === "minutes");
    return events.filter((e) => e.kind === "scribble");
  }, [events, filter]);

  const counts = useMemo(() => {
    const m = events.filter((e) => e.kind === "minutes").length;
    const s = events.filter((e) => e.kind === "scribble").length;
    return { minutes: m, scribbles: s, all: events.length };
  }, [events]);

  const heroLine = useMemo(() => {
    if (events.length === 0) {
      return `Welcome back, ${firstName}. Live dictation lives on the desktop — what you save shows up here.`;
    }
    const bits: string[] = [];
    if (counts.minutes > 0) {
      bits.push(`${counts.minutes} ${counts.minutes === 1 ? "Minute" : "Minutes"}`);
    }
    if (counts.scribbles > 0) {
      bits.push(`${counts.scribbles} ${counts.scribbles === 1 ? "Scribble" : "Scribbles"}`);
    }
    return `${bits.join(" and ")} saved today. Live dictation lives on the desktop — what you save shows up here.`;
  }, [events.length, counts, firstName]);

  return (
    <main style={{ background: v2.cream, color: v2.ink, fontFamily: "var(--font-figtree), system-ui" }}>
      <V2WebHeader active="TODAY" />

      <section className="px-6 md:px-14 pt-16 md:pt-20 pb-10 md:pb-12">
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
          What you <em style={{ fontStyle: "italic", color: v2.accent }}>kept</em>
          <br />
          today.
        </h1>
        <p className="mt-7 max-w-xl text-[16px] leading-relaxed" style={{ color: v2.inkSoft }}>
          {heroLine}
        </p>
        <div className="mt-10 flex items-center gap-6 flex-wrap">
          <Link
            href={ROUTES.RECORDING}
            className="inline-flex items-center gap-3 rounded-full px-6 py-3"
            style={{ background: v2.ink, color: v2.cream, fontSize: 14, fontWeight: 500 }}
          >
            <span
              className="inline-block rounded-full"
              style={{ height: 7, width: 7, background: v2.accent }}
            />
            Record a Scribble
          </Link>
          <Link href={ROUTES.MEETINGS} className="text-[14px]" style={{ color: v2.inkSoft }}>
            · or open Minutes
          </Link>
        </div>
      </section>

      <section
        className="px-6 md:px-14 pt-10 md:pt-12 pb-20 md:pb-24"
        style={{ borderTop: `1px solid ${v2.rule}` }}
      >
        <div className="grid grid-cols-12 gap-6 md:gap-10 mb-10 md:mb-12">
          <div className="col-span-12 md:col-span-2">
            <V2Caps>RECENT · IN ORDER</V2Caps>
          </div>
          <div className="col-span-12 md:col-span-10 flex items-center gap-7 flex-wrap">
            <V2Caps>FILTER</V2Caps>
            <FilterChip
              label="All"
              active={filter === "all"}
              count={counts.all}
              onClick={() => setFilter("all")}
            />
            <FilterChip
              label="Minutes"
              active={filter === "minutes"}
              count={counts.minutes}
              onClick={() => setFilter("minutes")}
            />
            <FilterChip
              label="Scribbles"
              active={filter === "scribbles"}
              count={counts.scribbles}
              onClick={() => setFilter("scribbles")}
            />
            <Link
              href={ROUTES.SCRIBBLE}
              style={{ marginLeft: "auto", fontSize: 13, color: v2.accent }}
            >
              Open library →
            </Link>
          </div>
        </div>

        {visible.length === 0 ? (
          <EmptyTodayState filter={filter} hasAny={events.length > 0} firstName={firstName} />
        ) : (
          <div className="space-y-10 md:space-y-12">
            {visible.map((e) => (
              <FeedRow key={`${e.kind}:${e.id}`} event={e} />
            ))}
          </div>
        )}
      </section>

      <footer
        className="px-6 md:px-14 py-10 flex items-center justify-between flex-wrap gap-4"
        style={{ borderTop: `1px solid ${v2.rule}` }}
      >
        <V2Caps>OSCAR · LISTENING SURFACE</V2Caps>
        <V2Caps>
          {events.length} SAVED TODAY · {scribbles.length} IN LIBRARY
        </V2Caps>
      </footer>
    </main>
  );
}

function FilterChip({
  label,
  active,
  count,
  onClick,
}: {
  label: string;
  active: boolean;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5"
      style={{
        fontSize: 13,
        color: active ? v2.ink : v2.inkSoft,
        borderBottom: active ? `1px solid ${v2.ink}` : "1px solid transparent",
        paddingBottom: 1,
        background: "transparent",
      }}
    >
      <span>{label}</span>
      <V2Mono style={{ fontSize: 10, color: v2.inkFaint, letterSpacing: "0.14em" }}>
        {count}
      </V2Mono>
    </button>
  );
}

function FeedRow({ event }: { event: FeedEvent }) {
  const time = formatTime24(event.timestamp);
  const isMinutes = event.kind === "minutes";
  const sourceName = isMinutes
    ? "MINUTES"
    : event.folder
      ? event.folder.toUpperCase()
      : "SCRIBBLE";
  const sourceKind = isMinutes ? event.meta || undefined : undefined;
  return (
    <Link href={event.href} className="grid grid-cols-12 gap-6 md:gap-10 group">
      <div className="col-span-12 md:col-span-2 pt-1.5">
        <V2Mono style={{ fontSize: 14, color: v2.ink, letterSpacing: "0.02em" }}>
          {time}
        </V2Mono>
        <div className="mt-1.5">
          <V2Source name={sourceName} kind={sourceKind} />
        </div>
      </div>
      <div className="col-span-12 md:col-span-10">
        <h3
          style={{
            fontFamily: v2Serif,
            fontSize: 26,
            lineHeight: 1.2,
            color: v2.ink,
            letterSpacing: "-0.01em",
            fontWeight: 500,
          }}
        >
          {event.title}
        </h3>
        <p
          className="mt-2"
          style={{
            fontFamily: v2Serif,
            fontSize: 18,
            lineHeight: 1.45,
            color: v2.inkSoft,
            letterSpacing: "-0.002em",
            maxWidth: 760,
            textWrap: "pretty",
          }}
        >
          {event.body}
        </p>
        {isMinutes && (
          <div
            className="mt-4 flex items-start gap-4 pt-4"
            style={{ borderTop: `1px solid ${v2.rule}` }}
          >
            <V2Caps color={v2.accent}>OSCAR ↓</V2Caps>
            <p
              className="text-[13px] leading-relaxed"
              style={{ color: v2.inkSoft, maxWidth: 640 }}
            >
              Decisions, actions, and follow-ups distilled.
            </p>
            <span style={{ marginLeft: "auto", fontSize: 12, color: v2.accent }}>Open →</span>
          </div>
        )}
      </div>
    </Link>
  );
}

function EmptyTodayState({
  filter,
  hasAny,
  firstName,
}: {
  filter: FilterKey;
  hasAny: boolean;
  firstName: string;
}) {
  if (hasAny && filter !== "all") {
    return (
      <div className="py-12 md:py-16 text-center">
        <V2Caps>NOTHING IN THIS FILTER · YET</V2Caps>
        <p className="mt-4 text-[15px]" style={{ color: v2.inkSoft }}>
          Try the other tabs above — today still has things in it.
        </p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-12 gap-6 md:gap-10">
      <div className="col-span-12 md:col-span-2 pt-1.5">
        <V2Mono style={{ fontSize: 14, color: v2.inkFaint, letterSpacing: "0.02em" }}>
          --:--
        </V2Mono>
        <div className="mt-1.5">
          <V2Source name="WAITING" kind="" />
        </div>
      </div>
      <div className="col-span-12 md:col-span-10">
        <h3
          style={{
            fontFamily: v2Serif,
            fontSize: 36,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            fontWeight: 500,
          }}
        >
          Today is <em style={{ fontStyle: "italic", color: v2.accent }}>quiet</em>, {firstName}.
        </h3>
        <p className="mt-3 text-[15px] leading-relaxed" style={{ color: v2.inkSoft, maxWidth: 640 }}>
          Nothing saved yet — and that&rsquo;s fine. Record a Scribble below, or capture a meeting
          in Minutes. The spine fills in as you go.
        </p>
        <div className="mt-7 flex items-center gap-5 flex-wrap">
          <Link
            href={ROUTES.RECORDING}
            className="inline-flex items-center gap-3 rounded-full px-5 py-2.5"
            style={{ background: v2.ink, color: v2.cream, fontSize: 14, fontWeight: 500 }}
          >
            <span
              className="inline-block rounded-full"
              style={{ height: 7, width: 7, background: v2.accent }}
            />
            Record a Scribble
          </Link>
          <Link href={ROUTES.MEETINGS} className="text-[14px]" style={{ color: v2.inkSoft }}>
            · or open Minutes
          </Link>
        </div>
      </div>
    </div>
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
          <Link
            href="/download"
            className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-[14px] font-medium transition-colors duration-200"
            style={{ background: "transparent", color: v2.ink, border: `1px solid ${v2.ruleHard}` }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = v2.ink;
              e.currentTarget.style.background = v2.cream2;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = v2.ruleHard;
              e.currentTarget.style.background = "transparent";
            }}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={{ display: "block" }}
            >
              <path d="M12 3v12" />
              <path d="m7 11 5 5 5-5" />
              <path d="M5 21h14" />
            </svg>
            Download desktop app
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
        <div className="mt-9 flex items-center justify-center gap-4 flex-wrap">
          <button
            onClick={onStart}
            className="rounded-full px-7 py-3.5 text-[15px] font-medium"
            style={{ background: v2.ink, color: v2.cream }}
          >
            Get Oscar — it&rsquo;s free
          </button>
          <Link
            href="/download"
            className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-[15px] font-medium transition-colors duration-200"
            style={{ background: "transparent", color: v2.ink, border: `1px solid ${v2.ruleHard}` }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = v2.ink;
              e.currentTarget.style.background = v2.cream2;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = v2.ruleHard;
              e.currentTarget.style.background = "transparent";
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={{ display: "block" }}
            >
              <path d="M12 3v12" />
              <path d="m7 11 5 5 5-5" />
              <path d="M5 21h14" />
            </svg>
            Download desktop app
          </Link>
        </div>
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
          <V2Caps>© SAMYAK ARTH SERVICES PRIVATE LIMITED · 2026</V2Caps>
        </div>
      </footer>
    </main>
  );
}

export default function Home() {
  const { session, user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [scribbles, setScribbles] = useState<DBScribble[]>([]);
  const [meetings, setMeetings] = useState<SavedMeetingRecord[]>([]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      const [scribblesResult, meetingsResult] = await Promise.all([
        scribblesService.getScribbles(),
        meetingsService.getMeetings(),
      ]);
      if (cancelled) return;
      if (!scribblesResult.error && scribblesResult.data) setScribbles(scribblesResult.data);
      if (!meetingsResult.error && meetingsResult.data) setMeetings(meetingsResult.data);
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
    return <SignedInHome scribbles={scribbles} meetings={meetings} firstName={firstName} />;
  }

  return <MarketingLanding onStart={handleStart} />;
}
