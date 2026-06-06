import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { MarkdownView } from "@/components/meetings/MarkdownView";
import { CopyShareLinkButton } from "@/components/meetings/CopyShareLinkButton";
import {
  v2,
  v2Serif,
  V2Caps,
  V2Mono,
  V2Wordmark,
} from "@/components/v2/V2Primitives";

interface PageParams {
  params: Promise<{ token: string }>;
}

interface PublicMeeting {
  id: string;
  user_id: string;
  meeting_title: string;
  attendees_compact: string;
  started_at: string;
  notes_markdown: string;
}

async function fetchPublicMeeting(token: string): Promise<{
  meeting: PublicMeeting;
  author: { name: string | null; email: string | null } | null;
} | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("meetings")
    .select(
      "id, user_id, meeting_title, attendees_compact, started_at, notes_markdown, visibility, public_share_token"
    )
    .eq("public_share_token", token)
    .eq("visibility", "public")
    .maybeSingle();
  if (error || !data) return null;

  const { data: usersData } = await supabase.auth.admin.listUsers({ perPage: 200 });
  const u = usersData?.users.find((u) => u.id === data.user_id);
  const author = u
    ? {
        name:
          (u.user_metadata?.full_name as string | undefined) ??
          (u.user_metadata?.name as string | undefined) ??
          null,
        email: u.email ?? null,
      }
    : null;

  return { meeting: data as PublicMeeting, author };
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { token } = await params;
  const fetched = await fetchPublicMeeting(token);
  if (!fetched) return { title: "Oscar — Shared Meeting" };
  const { meeting } = fetched;
  const title = meeting.meeting_title || "Shared Meeting";
  const preview = (meeting.notes_markdown || "")
    .replace(/[#*_>`-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  return {
    title: `${title} · Oscar`,
    description: preview,
    openGraph: { title, description: preview, type: "article", siteName: "Oscar" },
    twitter: { card: "summary", title, description: preview },
  };
}

function formatHeader(iso: string): string {
  const d = new Date(iso);
  const wd = d.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase();
  const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric" }).toUpperCase();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${wd} · ${date} · ${time}`;
}

function stripCitationTokens(markdown: string): string {
  return markdown
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s*\[\[[^\]\n]+\]\]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function cleanBulletText(text: string): string {
  return text
    .replace(/^\[[ xX]\]\s+/, "")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

interface ParsedSections {
  decisions: string[];
  actions: string[];
  followUps: string[];
  hasStructure: boolean;
}

function parseSections(markdown: string): ParsedSections {
  const lines = stripCitationTokens(markdown).split(/\r?\n/);
  const out: ParsedSections = {
    decisions: [],
    actions: [],
    followUps: [],
    hasStructure: false,
  };
  let current: "decisions" | "actions" | "followUps" | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    const headerMatch = line.match(/^#{1,6}\s+(.+?)\s*:?$/);
    if (headerMatch) {
      const heading = headerMatch[1].toLowerCase().replace(/[*_`]/g, "").trim();
      if (heading.startsWith("decision")) current = "decisions";
      else if (heading.startsWith("action") || heading.startsWith("next step")) current = "actions";
      else if (
        heading.startsWith("follow-up") ||
        heading.startsWith("follow up") ||
        heading.startsWith("followup")
      )
        current = "followUps";
      else current = null;
      continue;
    }
    const bullet = line.match(/^(?:[-*+]|\d+[.)])\s+(.+)$/);
    const bareTask = !bullet ? line.match(/^\[[ xX]\]\s+(.+)$/) : null;
    const captured = bullet?.[1] ?? bareTask?.[1] ?? null;
    if (captured && current) {
      const cleaned = cleanBulletText(captured);
      if (cleaned) out[current].push(cleaned);
    }
  }
  out.hasStructure =
    out.decisions.length + out.actions.length + out.followUps.length > 0;
  return out;
}

function displayAttendeeName(raw: string): string {
  if (!raw) return "";
  return raw.includes("@") ? raw.split("@")[0]! : raw;
}

function attendeeList(compact: string): string[] {
  return compact
    .split(",")
    .map((s) => displayAttendeeName(s.trim()))
    .filter(Boolean);
}

async function buildShareUrl(token: string): Promise<string> {
  const h = await headers();
  const host = h.get("host") || "oscar.samyarth.org";
  const proto = h.get("x-forwarded-proto") || "https";
  return `${proto}://${host}/m/${token}`;
}

export default async function PublicMeetingPage({ params }: PageParams) {
  const { token } = await params;
  const fetched = await fetchPublicMeeting(token);
  if (!fetched) return notFound();
  const { meeting, author } = fetched;
  const body = stripCitationTokens(meeting.notes_markdown || "");
  const authorName = author?.name ?? author?.email ?? "A teammate";
  const sections = parseSections(meeting.notes_markdown);
  const attendees = attendeeList(meeting.attendees_compact);
  const shareUrl = await buildShareUrl(token);

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
        className="flex items-center justify-between px-6 md:px-14 py-5 flex-wrap gap-3"
        style={{ borderBottom: `1px solid ${v2.rule}` }}
      >
        <V2Wordmark />
        <V2Caps>SHARED MINUTES · PUBLIC LINK</V2Caps>
        <div className="flex items-center gap-2.5">
          <CopyShareLinkButton
            url={shareUrl}
            outerStyle={{ border: `1px solid ${v2.rule}`, color: v2.inkSoft, background: "transparent" }}
          />
          <Link
            href="/"
            className="text-[12px] rounded-full px-4 py-2 font-medium"
            style={{ background: v2.ink, color: v2.cream }}
          >
            Try Oscar free
          </Link>
        </div>
      </header>

      <article className="px-6 md:px-14 py-12 md:py-14 mx-auto" style={{ maxWidth: 1080 }}>
        <V2Caps>
          SHARED BY {authorName.toUpperCase()} · {formatHeader(meeting.started_at)}
        </V2Caps>
        <h1
          className="mt-3"
          style={{
            fontFamily: v2Serif,
            fontSize: "clamp(40px, 7vw, 76px)",
            lineHeight: 0.96,
            letterSpacing: "-0.025em",
            fontWeight: 500,
          }}
        >
          {meeting.meeting_title || (
            <em style={{ fontStyle: "italic", color: v2.accent }}>Untitled Meeting</em>
          )}
        </h1>

        {attendees.length > 0 && (
          <div className="mt-9 flex items-center gap-5 flex-wrap">
            {attendees.map((name) => (
              <div key={name} className="flex items-center gap-2.5">
                <span
                  style={{
                    display: "inline-block",
                    height: 28,
                    width: 28,
                    borderRadius: 999,
                    background: v2.cream2,
                    color: v2.ink,
                    fontFamily: v2Serif,
                    fontWeight: 500,
                    fontSize: 13,
                    textAlign: "center",
                    lineHeight: "28px",
                  }}
                >
                  {(name[0] || "·").toUpperCase()}
                </span>
                <span style={{ fontSize: 13, color: v2.ink }}>{name}</span>
              </div>
            ))}
          </div>
        )}

        {sections.hasStructure ? (
          <>
            {sections.decisions.length > 0 && (
              <section className="mt-14 pt-10" style={{ borderTop: `1px solid ${v2.rule}` }}>
                <V2Caps color={v2.accent}>DECISIONS · {sections.decisions.length}</V2Caps>
                <ol className="mt-5 space-y-5 max-w-3xl">
                  {sections.decisions.map((d, i) => (
                    <li key={i} className="flex gap-4">
                      <V2Mono style={{ fontSize: 12, color: v2.accent }}>
                        {`0${i + 1}`.slice(-2)}
                      </V2Mono>
                      <span
                        style={{
                          fontFamily: v2Serif,
                          fontSize: 22,
                          lineHeight: 1.45,
                          color: v2.ink,
                          letterSpacing: "-0.005em",
                        }}
                      >
                        {d}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {sections.actions.length > 0 && (
              <section className="mt-14 pt-10" style={{ borderTop: `1px solid ${v2.rule}` }}>
                <V2Caps>ACTIONS · {sections.actions.length}</V2Caps>
                <ul className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-x-10 md:gap-x-12 gap-y-4 max-w-4xl">
                  {sections.actions.map((raw, i) => {
                    const ownerMatch = raw.match(/^([A-Z][\w'-]+)\s*[—:-]\s*(.+)$/);
                    const owner = ownerMatch?.[1];
                    const text = ownerMatch?.[2] ?? raw;
                    return (
                      <li
                        key={i}
                        className="flex items-start gap-3 pb-3"
                        style={{ borderBottom: `1px solid ${v2.rule}` }}
                      >
                        <span
                          style={{
                            display: "inline-block",
                            height: 24,
                            width: 24,
                            borderRadius: 999,
                            background: v2.accentSoft,
                            color: v2.ink,
                            fontFamily: v2Serif,
                            fontSize: 12,
                            textAlign: "center",
                            lineHeight: "24px",
                            fontWeight: 500,
                            marginTop: 2,
                          }}
                        >
                          {(owner?.[0] || "·").toUpperCase()}
                        </span>
                        <div>
                          {owner && <V2Caps>{owner.toUpperCase()}</V2Caps>}
                          <div
                            style={{
                              fontSize: 14,
                              color: v2.ink,
                              marginTop: owner ? 2 : 0,
                              lineHeight: 1.4,
                            }}
                          >
                            {text}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {sections.followUps.length > 0 && (
              <section className="mt-14 pt-10" style={{ borderTop: `1px solid ${v2.rule}` }}>
                <V2Caps>FOLLOW-UPS</V2Caps>
                <ul
                  className="mt-5 space-y-3 text-[15px] leading-relaxed max-w-2xl"
                  style={{ color: v2.ink, fontFamily: v2Serif }}
                >
                  {sections.followUps.map((f, i) => (
                    <li key={i}>· {f}</li>
                  ))}
                </ul>
              </section>
            )}
          </>
        ) : (
          <section className="mt-12 pt-10" style={{ borderTop: `1px solid ${v2.rule}` }}>
            <div className="prose prose-slate max-w-none" style={{ color: v2.ink }}>
              <MarkdownView>{body || "_No notes captured for this meeting._"}</MarkdownView>
            </div>
          </section>
        )}

        <div
          className="mt-16 md:mt-20 rounded-2xl p-8 md:p-10"
          style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}
        >
          <V2Caps color={v2.accent}>MADE WITH OSCAR</V2Caps>
          <div className="mt-3 flex items-end justify-between gap-8 flex-wrap">
            <h2
              style={{
                fontFamily: v2Serif,
                fontSize: 36,
                lineHeight: 1.0,
                letterSpacing: "-0.025em",
                fontWeight: 500,
                maxWidth: 600,
              }}
            >
              Your meetings can{" "}
              <em style={{ fontStyle: "italic", color: v2.accent }}>do this too</em>.
            </h2>
            <Link
              href="/"
              className="rounded-full px-6 py-3.5 text-[14px] font-medium whitespace-nowrap"
              style={{ background: v2.ink, color: v2.cream }}
            >
              Try Oscar free
            </Link>
          </div>
        </div>
      </article>

      <footer
        className="px-6 md:px-14 py-10 flex items-center justify-between flex-wrap gap-4"
        style={{ borderTop: `1px solid ${v2.rule}` }}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <V2Caps>SHARED FROM OSCAR</V2Caps>
          <V2Mono style={{ fontSize: 11, color: v2.inkFaint }}>{shareUrl}</V2Mono>
          <CopyShareLinkButton
            url={shareUrl}
            outerStyle={{
              border: `1px solid ${v2.rule}`,
              color: v2.inkSoft,
              background: "transparent",
            }}
          />
        </div>
        <V2Mono style={{ fontSize: 11, color: v2.accent, letterSpacing: "0.16em" }}>
          oscar.ai →
        </V2Mono>
      </footer>
    </main>
  );
}
