"use client";

import { useState, useEffect, useMemo, useDeferredValue, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreVertical, Pencil, Trash2, Download, Calendar } from "lucide-react";
import { useAuth } from "@/lib/contexts/AuthContext";
import {
  useMeetings,
  useDeleteMeeting,
} from "@/lib/hooks/queries/useMeetings";
import { Spinner } from "@/components/ui/spinner";
import { MeetingSearchBar } from "@/components/meetings/MeetingSearchBar";
import { DeleteMeetingDialog } from "@/components/meetings/DeleteMeetingDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import type {
  SavedMeetingRecord,
  MeetingTypeHint,
} from "@oscar/shared/types";
import {
  v2,
  v2Serif,
  v2Mono,
  V2Caps,
  V2Mono,
  V2Source,
  V2WebHeader,
} from "@/components/v2/V2Primitives";
import { ROUTES } from "@/lib/constants";

function formatDateCap(iso: string): string {
  const d = new Date(iso);
  const wd = d.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase();
  const time = d
    .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${wd} · ${time}`;
}

function formatDuration(segments: SavedMeetingRecord["transcriptSegments"]): string {
  if (!segments.length) return "—";
  const last = segments[segments.length - 1];
  const ms = new Date(last.end_time).getTime() - new Date(segments[0].start_time).getTime();
  if (!isFinite(ms) || ms <= 0) return "—";
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h}h` : `${h}h${m}m`;
}

function attendeeList(m: SavedMeetingRecord): string[] {
  if (m.attendeesFull?.length) {
    return m.attendeesFull
      .map((a) => displayAttendeeName(a.name?.trim() || a.email || ""))
      .filter(Boolean);
  }
  return m.attendeesCompact
    ? m.attendeesCompact
        .split(",")
        .map((s) => displayAttendeeName(s.trim()))
        .filter(Boolean)
    : [];
}

function displayAttendeeName(raw: string): string {
  // Emails get the @domain stripped so the chip reads as a name, not an
  // address. Non-email strings pass through untouched.
  if (!raw) return "";
  return raw.includes("@") ? raw.split("@")[0]! : raw;
}

function countSection(markdown: string, sectionNames: string[]): number {
  if (!markdown) return 0;
  const lines = markdown.split(/\r?\n/);
  let inSection = false;
  let count = 0;
  for (const raw of lines) {
    const line = raw.trim();
    const headerMatch = line.match(/^#{1,6}\s+(.+?)\s*:?$/);
    if (headerMatch) {
      const heading = headerMatch[1].toLowerCase().replace(/[*_`]/g, "").trim();
      inSection = sectionNames.some((n) => heading.startsWith(n));
      continue;
    }
    if (!inSection) continue;
    if (/^[-*+]\s+/.test(line) || /^\d+[.)]\s+/.test(line)) count += 1;
  }
  return count;
}

function previewLine(markdown: string): string {
  if (!markdown) return "";
  const flat = markdown
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s*\[\[[^\]\n]+\]\]/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\d+[.)]\s+/gm, "")
    .replace(/^\[[ xX]\]\s+/gm, "")
    .replace(/\[[ xX]\]\s+/g, "")
    .replace(/[*_`>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return flat.length > 260 ? `${flat.slice(0, 260)}…` : flat;
}

export default function MeetingsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && !user) router.push("/auth?redirectTo=/meetings");
  }, [user, authLoading, router]);

  const {
    data: meetings = [],
    isLoading: meetingsLoading,
    isError,
  } = useMeetings(!authLoading && !!user);
  const deleteMutation = useDeleteMeeting();

  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery);
  const [typeFilter, setTypeFilter] = useState<MeetingTypeHint | "all">("all");
  const [deleteTarget, setDeleteTarget] = useState<SavedMeetingRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredMeetings = useMemo(() => {
    let result = meetings;
    if (typeFilter !== "all") result = result.filter((m) => m.meetingTypeHint === typeFilter);
    if (deferredSearch.trim()) {
      const q = deferredSearch.toLowerCase();
      result = result.filter(
        (m) =>
          m.meetingTitle.toLowerCase().includes(q) ||
          m.attendeesCompact.toLowerCase().includes(q) ||
          m.notesMarkdown.toLowerCase().includes(q) ||
          m.myNotesMarkdown.toLowerCase().includes(q)
      );
    }
    return result;
  }, [meetings, typeFilter, deferredSearch]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast({ title: "Deleted", description: "Meeting removed." });
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget, deleteMutation, toast]);

  if (authLoading || meetingsLoading) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ background: v2.cream }}
      >
        <Spinner />
      </main>
    );
  }

  const hasMeetings = meetings.length > 0;
  const weekCount = meetings.filter((m) => {
    const ms = Date.now() - new Date(m.startedAt).getTime();
    return ms <= 7 * 24 * 60 * 60 * 1000;
  }).length;

  return (
    <main
      style={{
        background: v2.cream,
        color: v2.ink,
        minHeight: "100vh",
        fontFamily: "var(--font-figtree), system-ui",
      }}
    >
      <V2WebHeader active="MINUTES" />

      <section className="px-6 md:px-14 pt-16 md:pt-20 pb-10 md:pb-12">
        <V2Caps>
          {hasMeetings ? (
            <>
              MINUTES · {weekCount} MEETING{weekCount === 1 ? "" : "S"} THIS WEEK
            </>
          ) : (
            <>MINUTES · NOTHING SAVED YET</>
          )}
        </V2Caps>
        <h1
          className="mt-3"
          style={{
            fontFamily: v2Serif,
            fontSize: "clamp(48px, 9vw, 84px)",
            lineHeight: 0.96,
            letterSpacing: "-0.025em",
            fontWeight: 500,
            maxWidth: 920,
          }}
        >
          {hasMeetings ? (
            <>
              What was <em style={{ fontStyle: "italic", color: v2.accent }}>decided</em>,
              <br />
              in order.
            </>
          ) : (
            <>
              What was <em style={{ fontStyle: "italic", color: v2.accent }}>said</em>,
              <br />
              then <em style={{ fontStyle: "italic", color: v2.accent }}>decided</em>.
            </>
          )}
        </h1>
        <p className="mt-7 max-w-xl text-[16px] leading-relaxed" style={{ color: v2.inkSoft }}>
          {hasMeetings
            ? "Oscar listens to your meetings and writes back what mattered — decisions, actions, follow-ups. Publish the whole thing or just the parts that move work forward."
            : "Recording happens on the desktop app — it needs your system audio. Once you save a meeting there, it shows up here to read, share, and revisit."}
        </p>
      </section>

      <section className="px-6 md:px-14 pb-20" style={{ borderTop: `1px solid ${v2.rule}` }}>
        {isError && (
          <div
            className="mt-8 px-4 py-3 rounded-lg text-[13px]"
            style={{
              background: "rgba(184,98,61,0.08)",
              border: `1px solid ${v2.accent}`,
              color: v2.accent,
            }}
          >
            Failed to load meetings. Please refresh.
          </div>
        )}

        {!hasMeetings ? (
          <MinutesEmptyState />
        ) : (
          <>
            <div className="mt-8 mb-8">
              <MeetingSearchBar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                typeFilter={typeFilter}
                onTypeChange={setTypeFilter}
              />
            </div>

            {filteredMeetings.length === 0 ? (
              <div className="py-16 text-center text-[14px]" style={{ color: v2.inkSoft }}>
                No meetings match this search.
              </div>
            ) : (
              <div>
                {filteredMeetings.map((m) => (
                  <MeetingRow
                    key={m.id}
                    meeting={m}
                    onRequestDelete={() => setDeleteTarget(m)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <DeleteMeetingDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
      />
    </main>
  );
}

function MeetingRow({
  meeting,
  onRequestDelete,
}: {
  meeting: SavedMeetingRecord;
  onRequestDelete: () => void;
}) {
  const attendees = attendeeList(meeting);
  const decisions = countSection(meeting.notesMarkdown, ["decision"]);
  const actions = countSection(meeting.notesMarkdown, ["action"]);
  const followUps = countSection(meeting.notesMarkdown, ["follow-up", "follow up", "followup"]);
  const dur = formatDuration(meeting.transcriptSegments);
  const summary = previewLine(meeting.notesMarkdown) || previewLine(meeting.myNotesMarkdown);

  return (
    <article
      className="grid grid-cols-12 gap-6 md:gap-10 py-10"
      style={{ borderBottom: `1px solid ${v2.rule}` }}
    >
      <div className="col-span-12 md:col-span-2">
        <V2Mono style={{ fontSize: 13, color: v2.ink, letterSpacing: "0.02em" }}>
          {formatDateCap(meeting.startedAt)}
        </V2Mono>
        <div className="mt-1.5">
          <V2Source name="MINUTES" kind={dur} />
        </div>
        <div className="mt-6 space-y-1.5">
          <CountRow label="Decisions" value={decisions} accent />
          <CountRow label="Actions" value={actions} />
          <CountRow label="Attendees" value={attendees.length} />
          {followUps > 0 && <CountRow label="Follow-ups" value={followUps} />}
        </div>
      </div>

      <Link
        href={`${ROUTES.MEETINGS}/${meeting.id}`}
        className="col-span-12 md:col-span-9 group"
      >
        <h2
          style={{
            fontFamily: v2Serif,
            fontSize: 30,
            lineHeight: 1.12,
            letterSpacing: "-0.015em",
            fontWeight: 500,
            maxWidth: 760,
          }}
        >
          {meeting.meetingTitle || "Untitled Meeting"}
        </h2>
        {summary && (
          <p
            className="mt-3.5 text-[15px] leading-relaxed"
            style={{ color: v2.inkSoft, maxWidth: 720 }}
          >
            {summary}
          </p>
        )}
        <div className="mt-5 flex items-center gap-5 flex-wrap">
          {attendees.slice(0, 5).map((name, j) => (
            <span
              key={j}
              className="flex items-center gap-2 text-[12px]"
              style={{ color: v2.inkSoft }}
            >
              <span
                style={{
                  display: "inline-block",
                  height: 22,
                  width: 22,
                  borderRadius: 999,
                  background: v2.cream2,
                  color: v2.ink,
                  fontFamily: v2Serif,
                  fontWeight: 500,
                  fontSize: 12,
                  textAlign: "center",
                  lineHeight: "22px",
                }}
              >
                {(name[0] || "·").toUpperCase()}
              </span>
              {name}
            </span>
          ))}
          {attendees.length > 5 && (
            <V2Mono style={{ fontSize: 11, color: v2.inkFaint }}>+{attendees.length - 5}</V2Mono>
          )}
          <span
            style={{ marginLeft: "auto", fontSize: 13, color: v2.accent }}
            className="group-hover:opacity-100 opacity-80 transition-opacity"
          >
            Continue →
          </span>
        </div>
      </Link>

      <div className="col-span-12 md:col-span-1 flex md:justify-end items-start">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="p-1.5 rounded-full"
              style={{ color: v2.inkFaint }}
              aria-label="Meeting actions"
            >
              <MoreVertical size={16} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            style={{ background: v2.cream, border: `1px solid ${v2.rule}`, color: v2.ink }}
          >
            <DropdownMenuItem asChild className="cursor-pointer" style={{ color: v2.ink }}>
              <Link href={`${ROUTES.MEETINGS}/${meeting.id}`}>
                <Pencil size={14} className="mr-2" />
                Open & edit
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onRequestDelete}
              className="cursor-pointer"
              style={{ color: v2.accent }}
            >
              <Trash2 size={14} className="mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  );
}

function CountRow({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between"
      style={{ fontSize: 11, color: v2.inkSoft }}
    >
      <span>{label}</span>
      <span
        style={{
          fontFamily: v2Mono,
          fontSize: 11,
          letterSpacing: "0.04em",
          color: accent && value > 0 ? v2.accent : v2.inkFaint,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function MinutesEmptyState() {
  return (
    <div className="pt-12 md:pt-14">
      <div
        className="rounded-2xl flex items-center gap-5 md:gap-6 p-5 md:p-6 max-w-3xl flex-wrap md:flex-nowrap"
        style={{ border: `1px solid ${v2.rule}`, background: v2.cream2 }}
      >
        <div
          className="rounded-xl flex items-center justify-center shrink-0"
          style={{ width: 60, height: 60, background: v2.cream, border: `1px solid ${v2.rule}` }}
        >
          <Download size={24} style={{ color: v2.ink }} />
        </div>
        <div className="flex-1 min-w-[220px]">
          <V2Caps>REQUIRED · 2 MIN</V2Caps>
          <div
            className="mt-1.5"
            style={{
              fontFamily: v2Serif,
              fontSize: 22,
              fontWeight: 500,
              color: v2.ink,
              letterSpacing: "-0.005em",
            }}
          >
            Get the desktop app
          </div>
          <div className="text-[13.5px] mt-1" style={{ color: v2.inkSoft }}>
            Oscar for Mac &amp; Windows captures meeting audio (system + mic), labels speakers, and saves the distillation here.
          </div>
        </div>
        <Link
          href={ROUTES.DOWNLOAD}
          className="rounded-full whitespace-nowrap"
          style={{
            background: v2.accent,
            color: v2.cream,
            padding: "10px 20px",
            fontSize: 13.5,
            fontWeight: 500,
          }}
        >
          Download →
        </Link>
      </div>

      <div
        className="mt-4 max-w-3xl flex items-center gap-3 text-[12.5px]"
        style={{ color: v2.inkFaint }}
      >
        <Calendar size={12} style={{ color: v2.inkFaint }} />
        <span>
          Once installed, connect Google Calendar in the desktop app to one-tap-record any meeting.
        </span>
      </div>

      <div className="mt-14 md:mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10 max-w-4xl">
        {STEPS.map((s) => (
          <div key={s.n} style={{ borderTop: `1px solid ${v2.ruleHard}`, paddingTop: 18 }}>
            <V2Mono style={{ fontSize: 12, color: v2.accent, letterSpacing: "0.16em" }}>
              {s.n}
            </V2Mono>
            <div
              className="mt-2"
              style={{
                fontFamily: v2Serif,
                fontSize: 22,
                fontWeight: 500,
                color: v2.ink,
                letterSpacing: "-0.01em",
              }}
            >
              {s.t}
            </div>
            <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: v2.inkSoft }}>
              {s.d}
            </p>
          </div>
        ))}
      </div>

      <div
        className="mt-16 pt-8 flex items-center justify-between flex-wrap gap-4"
        style={{ borderTop: `1px solid ${v2.rule}` }}
      >
        <V2Caps>OSCAR · MINUTES · FIRST-RUN</V2Caps>
        <V2Caps>RECORDING LIVES ON DESKTOP · WEB IS FOR READ &amp; SHARE</V2Caps>
      </div>
    </div>
  );
}

const STEPS: Array<{ n: string; t: string; d: string }> = [
  {
    n: "01",
    t: "Record on desktop",
    d: "The desktop app captures system audio + mic and labels each speaker as they talk.",
  },
  {
    n: "02",
    t: "Oscar distills",
    d: "When you stop, Oscar reconciles your rough notes with the transcript — decisions, actions, follow-ups.",
  },
  {
    n: "03",
    t: "Read & share on the web",
    d: "The minutes show up here to revisit, search, share with a public link, or email to the room.",
  },
];
