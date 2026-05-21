import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { MarkdownView } from "@/components/meetings/MarkdownView";
import {
  v2,
  v2Serif,
  V2Caps,
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

function formatDate(iso: string) {
  return new Date(iso)
    .toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    .toUpperCase();
}

function stripCitationTokens(markdown: string): string {
  return markdown
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s*\[\[seg:[A-Za-z0-9._:-]+\]\]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

export default async function PublicMeetingPage({ params }: PageParams) {
  const { token } = await params;
  const fetched = await fetchPublicMeeting(token);
  if (!fetched) return notFound();
  const { meeting, author } = fetched;
  const body = stripCitationTokens(meeting.notes_markdown || "");
  const authorName = author?.name ?? author?.email ?? "A teammate";

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
        className="flex items-center justify-between px-6 md:px-14 py-5"
        style={{ borderBottom: `1px solid ${v2.rule}` }}
      >
        <V2Wordmark />
        <V2Caps>SHARED MINUTES · PUBLIC LINK</V2Caps>
        <Link
          href="/"
          className="text-[12px] rounded-full px-4 py-2 font-medium"
          style={{ background: v2.ink, color: v2.cream }}
        >
          Try Oscar free
        </Link>
      </header>

      <article className="px-6 md:px-14 py-12 md:py-14 mx-auto" style={{ maxWidth: 1080 }}>
        <V2Caps>
          SHARED BY {authorName.toUpperCase()} · {formatDate(meeting.started_at)}
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

        {meeting.attendees_compact && (
          <p className="mt-7 text-[15px] leading-relaxed" style={{ color: v2.inkSoft }}>
            {meeting.attendees_compact}
          </p>
        )}

        <section
          className="mt-12 pt-10"
          style={{ borderTop: `1px solid ${v2.rule}` }}
        >
          <div className="prose prose-slate max-w-none" style={{ color: v2.ink }}>
            <MarkdownView>{body || "_No notes captured for this meeting._"}</MarkdownView>
          </div>
        </section>

        <div
          className="mt-16 rounded-2xl p-8 md:p-10"
          style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}
        >
          <V2Caps color={v2.accent}>MADE WITH OSCAR</V2Caps>
          <div className="mt-3 flex items-end justify-between gap-8 flex-wrap">
            <h2
              style={{
                fontFamily: v2Serif,
                fontSize: 32,
                lineHeight: 1.0,
                letterSpacing: "-0.025em",
                fontWeight: 500,
                maxWidth: 600,
              }}
            >
              Your meetings can <em style={{ fontStyle: "italic", color: v2.accent }}>do this too</em>.
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
        className="px-6 md:px-14 py-10 flex items-center justify-between"
        style={{ borderTop: `1px solid ${v2.rule}` }}
      >
        <V2Caps>SHARED FROM OSCAR</V2Caps>
        <Link href="/" className="text-[12px]" style={{ color: v2.accent }}>
          oscar.ai →
        </Link>
      </footer>
    </main>
  );
}
