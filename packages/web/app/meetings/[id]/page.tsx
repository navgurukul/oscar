"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Copy,
  Mail,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/contexts/AuthContext";
import {
  useMeetings,
  useUpdateMeeting,
  useDeleteMeeting,
} from "@/lib/hooks/queries/useMeetings";
import { queryKeys } from "@/lib/hooks/queries/keys";
import { Spinner } from "@/components/ui/spinner";
import { MarkdownView } from "@/components/meetings/MarkdownView";
import { MeetingNotesEditor } from "@/components/meetings/MeetingNotesEditor";
import { MeetingMetadataEditor } from "@/components/meetings/MeetingMetadataEditor";
import { DeleteMeetingDialog } from "@/components/meetings/DeleteMeetingDialog";
import { ShareDialog } from "@/components/org/ShareDialog";
import { useToast } from "@/hooks/use-toast";
import { copyMarkdownAsRichText } from "@oscar/shared";
import type {
  MeetingAttendee,
  MeetingTranscriptSegment,
  MeetingTypeHint,
  SavedMeetingRecord,
} from "@oscar/shared/types";
import {
  v2,
  v2Serif,
  V2Caps,
  V2Mono,
  V2WebHeader,
} from "@/components/v2/V2Primitives";
import { ROUTES } from "@/lib/constants";

type Tab = "notes" | "transcript" | "rough";

function stripCitations(markdown: string): string {
  return markdown
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s*\[\[seg:[A-Za-z0-9._:-]+\]\]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function formatHeader(iso: string): string {
  const d = new Date(iso);
  const wd = d.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase();
  const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric" }).toUpperCase();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${wd} · ${date} · ${time}`;
}

function durationLabel(segments: MeetingTranscriptSegment[]): string {
  if (!segments.length) return "—";
  const ms =
    new Date(segments[segments.length - 1].end_time).getTime() -
    new Date(segments[0].start_time).getTime();
  if (!isFinite(ms) || ms <= 0) return "—";
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

function offsetLabel(segStart: string, baseStart: string): string {
  const ms = new Date(segStart).getTime() - new Date(baseStart).getTime();
  if (!isFinite(ms) || ms < 0) return "00:00";
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

interface ParsedSections {
  decisions: string[];
  actions: string[];
  followUps: string[];
  body: string;
  hasStructure: boolean;
}

function parseSections(markdown: string): ParsedSections {
  const lines = stripCitations(markdown).split(/\r?\n/);
  const out: ParsedSections = {
    decisions: [],
    actions: [],
    followUps: [],
    body: markdown,
    hasStructure: false,
  };
  let current: "decisions" | "actions" | "followUps" | null = null;
  let listBuf: string[] = [];

  const commitBuf = () => {
    if (!current) {
      listBuf = [];
      return;
    }
    out[current].push(...listBuf);
    listBuf = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    const headerMatch = line.match(/^#{1,6}\s+(.+?)\s*:?$/);
    if (headerMatch) {
      commitBuf();
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
    if (bullet && current) {
      listBuf.push(bullet[1].replace(/[*_`]/g, "").trim());
    }
  }
  commitBuf();

  out.hasStructure =
    out.decisions.length + out.actions.length + out.followUps.length > 0;
  return out;
}

function buildSearchHaystack(segments: MeetingTranscriptSegment[]): string {
  return segments.map((s) => s.text).join("\n").toLowerCase();
}

interface SpeakerStat {
  label: string;
  initial: string;
  durationMs: number;
}

function speakerStats(segments: MeetingTranscriptSegment[]): SpeakerStat[] {
  const acc = new Map<string, SpeakerStat>();
  for (const seg of segments) {
    const label = seg.speaker.diarization_label ?? (seg.speaker.source === "speaker" ? "Them" : "Me");
    const ms = new Date(seg.end_time).getTime() - new Date(seg.start_time).getTime();
    const prev = acc.get(label);
    if (prev) {
      prev.durationMs += isFinite(ms) ? Math.max(ms, 0) : 0;
    } else {
      acc.set(label, {
        label,
        initial: (label[0] || "·").toUpperCase(),
        durationMs: isFinite(ms) ? Math.max(ms, 0) : 0,
      });
    }
  }
  return Array.from(acc.values()).sort((a, b) => b.durationMs - a.durationMs);
}

function formatSpeakerDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export default function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!authLoading && !user) router.push(`/auth?redirectTo=/meetings/${id}`);
  }, [authLoading, user, id, router]);

  const {
    data: meetings = [],
    isLoading,
    isError,
  } = useMeetings(!authLoading && !!user);
  const updateMutation = useUpdateMeeting();
  const deleteMutation = useDeleteMeeting();

  const meeting = useMemo(() => meetings.find((m) => m.id === id) ?? null, [meetings, id]);

  const [tab, setTab] = useState<Tab>("notes");
  const [editingMetadata, setEditingMetadata] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [editingRough, setEditingRough] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [transcriptQuery, setTranscriptQuery] = useState("");

  const handleSaveMetadata = useCallback(
    async (data: {
      meetingTitle: string;
      attendeesCompact: string;
      attendeesFull: MeetingAttendee[];
      meetingTypeHint: MeetingTypeHint;
    }) => {
      if (!meeting) return;
      await updateMutation.mutateAsync({ id: meeting.id, updates: data });
      setEditingMetadata(false);
      toast({ title: "Saved", description: "Meeting details updated." });
    },
    [meeting, updateMutation, toast]
  );

  const handleSaveNotes = useCallback(
    async (value: string) => {
      if (!meeting) return;
      await updateMutation.mutateAsync({ id: meeting.id, updates: { notesMarkdown: value } });
      setEditingNotes(false);
      toast({ title: "Saved", description: "Meeting notes updated." });
    },
    [meeting, updateMutation, toast]
  );

  const handleSaveRough = useCallback(
    async (value: string) => {
      if (!meeting) return;
      await updateMutation.mutateAsync({ id: meeting.id, updates: { myNotesMarkdown: value } });
      setEditingRough(false);
      toast({ title: "Saved", description: "Personal notes updated." });
    },
    [meeting, updateMutation, toast]
  );

  const handleDelete = useCallback(async () => {
    if (!meeting) return;
    setIsDeleting(true);
    try {
      await deleteMutation.mutateAsync(meeting.id);
      toast({ title: "Deleted", description: "Meeting removed." });
      router.push(ROUTES.MEETINGS);
    } finally {
      setIsDeleting(false);
      setDeleteOpen(false);
    }
  }, [meeting, deleteMutation, toast, router]);

  const handleCopyNotes = useCallback(async () => {
    if (!meeting) return;
    await copyMarkdownAsRichText(stripCitations(meeting.notesMarkdown));
    toast({ title: "Copied!", description: "Notes copied to clipboard." });
  }, [meeting, toast]);

  const handleCopyTranscript = useCallback(async () => {
    if (!meeting) return;
    const text = meeting.transcriptSegments
      .map((seg) => `${offsetLabel(seg.start_time, meeting.transcriptSegments[0]?.start_time ?? seg.start_time)}  ${seg.speaker.diarization_label ?? (seg.speaker.source === "speaker" ? "Them" : "Me")}  —  ${seg.text}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied!", description: "Transcript copied to clipboard." });
    } catch {
      toast({ title: "Couldn't copy", variant: "destructive" });
    }
  }, [meeting, toast]);

  const handleEmailNotes = useCallback(() => {
    if (!meeting) return;
    const emails = meeting.attendeesFull
      .map((a) => a.email?.trim())
      .filter(Boolean)
      .join(",");
    const subject = encodeURIComponent(
      `Meeting Notes: ${meeting.meetingTitle || "Untitled"}`
    );
    const body = encodeURIComponent(
      `Hi,\n\nPlease find the meeting notes below.\n\n---\n\n${stripCitations(meeting.notesMarkdown || "")}\n\n---\n\nGenerated by OSCAR`
    );
    window.open(`mailto:${emails}?subject=${subject}&body=${body}`);
  }, [meeting]);

  if (authLoading || isLoading) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ background: v2.cream }}
      >
        <Spinner />
      </main>
    );
  }

  if (isError || !meeting) {
    return (
      <main
        style={{ background: v2.cream, color: v2.ink, minHeight: "100vh" }}
        className="font-figtree"
      >
        <V2WebHeader active="MINUTES" />
        <section className="px-6 md:px-14 py-20 text-center">
          <V2Caps>NOT FOUND</V2Caps>
          <h1
            className="mt-3"
            style={{
              fontFamily: v2Serif,
              fontSize: 60,
              lineHeight: 0.98,
              letterSpacing: "-0.025em",
              fontWeight: 500,
            }}
          >
            This meeting <em style={{ color: v2.accent }}>isn&rsquo;t here</em>.
          </h1>
          <p className="mt-6 text-[15px]" style={{ color: v2.inkSoft }}>
            It may have been deleted, or the link is wrong.
          </p>
          <Link
            href={ROUTES.MEETINGS}
            className="inline-flex items-center gap-2 mt-8 rounded-full px-5 py-2.5"
            style={{ background: v2.ink, color: v2.cream, fontSize: 14 }}
          >
            <ArrowLeft size={14} /> Back to Minutes
          </Link>
        </section>
      </main>
    );
  }

  const attendees = meeting.attendeesFull?.length
    ? meeting.attendeesFull.map((a) => ({
        name: a.name?.trim() || a.email?.split("@")[0] || "·",
      }))
    : (meeting.attendeesCompact || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((name) => ({ name }));

  const dur = durationLabel(meeting.transcriptSegments);
  const turnCount = meeting.transcriptSegments.length;
  const stats = speakerStats(meeting.transcriptSegments);
  const sections = parseSections(meeting.notesMarkdown);
  const headerLabel = formatHeader(meeting.startedAt);

  const transcriptQueryLower = transcriptQuery.trim().toLowerCase();
  const transcriptMatches = transcriptQueryLower
    ? meeting.transcriptSegments
        .map((seg, i) => ({ seg, i }))
        .filter(({ seg }) => seg.text.toLowerCase().includes(transcriptQueryLower))
    : null;
  const transcriptHaystackBytes = buildSearchHaystack(meeting.transcriptSegments).length;

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

      {/* Header strip */}
      <section
        className="px-6 md:px-14 pt-8 pb-5"
        style={{ borderTop: `1px solid ${v2.rule}`, borderBottom: `1px solid ${v2.rule}` }}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href={ROUTES.MEETINGS}
            className="inline-flex items-center gap-2"
            style={{ color: v2.inkFaint }}
          >
            <ArrowLeft size={14} />
            <V2Caps>BACK TO MINUTES</V2Caps>
          </Link>
          <span className="ml-auto inline-flex items-center gap-3 flex-wrap">
            <V2Mono style={{ fontSize: 12, color: v2.inkFaint }}>
              {headerLabel} · {dur} · {turnCount} TURNS · {stats.length}{" "}
              {stats.length === 1 ? "SPEAKER" : "SPEAKERS"}
            </V2Mono>
          </span>
        </div>

        <div className="mt-6 flex items-baseline gap-4 flex-wrap">
          <h1
            style={{
              fontFamily: v2Serif,
              fontSize: "clamp(36px, 5vw, 56px)",
              fontWeight: 500,
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
              maxWidth: 980,
            }}
          >
            {meeting.meetingTitle || "Untitled Meeting"}
          </h1>
          <button
            type="button"
            onClick={() => setEditingMetadata(true)}
            className="inline-flex items-center gap-1.5 text-[12px]"
            style={{ color: v2.inkFaint }}
          >
            <Pencil size={11} />
            Edit details
          </button>
        </div>

        {/* Attendee strip */}
        {attendees.length > 0 && (
          <div className="mt-5 flex items-center gap-4 flex-wrap">
            {attendees.slice(0, 8).map((a, i) => (
              <span key={i} className="flex items-center gap-2 text-[13px]" style={{ color: v2.ink }}>
                <span
                  style={{
                    display: "inline-block",
                    height: 26,
                    width: 26,
                    borderRadius: 999,
                    background: v2.cream2,
                    color: v2.ink,
                    fontFamily: v2Serif,
                    fontWeight: 500,
                    fontSize: 13,
                    textAlign: "center",
                    lineHeight: "26px",
                  }}
                >
                  {(a.name[0] || "·").toUpperCase()}
                </span>
                {a.name}
              </span>
            ))}
            {attendees.length > 8 && (
              <V2Mono style={{ fontSize: 11, color: v2.inkFaint }}>+{attendees.length - 8}</V2Mono>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex items-center gap-2 flex-wrap">
          <ShareDialog
            kind="meeting"
            id={meeting.id}
            visibility={
              meeting.visibility ?? (meeting.sharedWithOrg ? "org" : "private")
            }
            publicShareToken={meeting.publicShareToken ?? null}
            onChange={(next) => {
              queryClient.setQueryData<SavedMeetingRecord[]>(
                queryKeys.meetings,
                (prev) =>
                  prev?.map((m) =>
                    m.id === meeting.id
                      ? {
                          ...m,
                          visibility: next.visibility,
                          publicShareToken: next.public_share_token,
                          sharedWithOrg: next.visibility !== "private",
                        }
                      : m
                  ) ?? prev
              );
            }}
          />
          <button
            type="button"
            onClick={() => void handleCopyNotes()}
            className="text-[12px] rounded-full px-3.5 py-1.5 inline-flex items-center gap-1.5"
            style={{ color: v2.inkSoft, border: `1px solid ${v2.rule}` }}
          >
            <Copy size={12} /> Copy notes
          </button>
          <button
            type="button"
            onClick={handleEmailNotes}
            className="text-[12px] rounded-full px-3.5 py-1.5 inline-flex items-center gap-1.5"
            style={{ color: v2.inkSoft, border: `1px solid ${v2.rule}` }}
          >
            <Mail size={12} /> Email notes
          </button>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="text-[12px] rounded-full px-3.5 py-1.5 inline-flex items-center gap-1.5 ml-auto"
            style={{ color: v2.accent, border: `1px solid ${v2.rule}` }}
          >
            <Trash2 size={12} /> Delete
          </button>
        </div>

        {/* Tabs */}
        <div
          className="mt-7 flex items-center gap-8 flex-wrap"
          style={{ borderBottom: `1px solid ${v2.rule}`, marginBottom: -1 }}
        >
          {TABS.map((t) => {
            const active = tab === t.id;
            const label =
              t.id === "transcript" && turnCount > 0
                ? `${t.label} · ${turnCount} TURNS`
                : t.label;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                style={{
                  paddingBottom: 12,
                  borderBottom: active
                    ? `1.5px solid ${v2.accent}`
                    : "1.5px solid transparent",
                  background: "transparent",
                  cursor: "pointer",
                }}
              >
                <V2Caps color={active ? v2.accent : v2.inkSoft}>{label}</V2Caps>
              </button>
            );
          })}
        </div>
      </section>

      {/* Metadata editor */}
      {editingMetadata && (
        <section className="px-6 md:px-14 py-6" style={{ borderBottom: `1px solid ${v2.rule}` }}>
          <MeetingMetadataEditor
            title={meeting.meetingTitle}
            attendees={meeting.attendeesFull}
            typeHint={meeting.meetingTypeHint}
            onSave={handleSaveMetadata}
            onCancel={() => setEditingMetadata(false)}
          />
        </section>
      )}

      {tab === "notes" && (
        <NotesTab
          meeting={meeting}
          sections={sections}
          editing={editingNotes}
          onEditStart={() => setEditingNotes(true)}
          onEditCancel={() => setEditingNotes(false)}
          onSave={handleSaveNotes}
        />
      )}

      {tab === "transcript" && (
        <TranscriptTab
          meeting={meeting}
          stats={stats}
          query={transcriptQuery}
          onQueryChange={setTranscriptQuery}
          matches={transcriptMatches}
          totalBytes={transcriptHaystackBytes}
          onCopy={handleCopyTranscript}
          onEmail={handleEmailNotes}
        />
      )}

      {tab === "rough" && (
        <RoughTab
          meeting={meeting}
          editing={editingRough}
          onEditStart={() => setEditingRough(true)}
          onEditCancel={() => setEditingRough(false)}
          onSave={handleSaveRough}
        />
      )}

      <DeleteMeetingDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
      />
    </main>
  );
}

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "notes", label: "NOTES" },
  { id: "transcript", label: "TRANSCRIPT" },
  { id: "rough", label: "YOUR ROUGH NOTES" },
];

function NotesTab({
  meeting,
  sections,
  editing,
  onEditStart,
  onEditCancel,
  onSave,
}: {
  meeting: SavedMeetingRecord;
  sections: ParsedSections;
  editing: boolean;
  onEditStart: () => void;
  onEditCancel: () => void;
  onSave: (value: string) => Promise<void>;
}) {
  const cleaned = stripCitations(meeting.notesMarkdown || "");

  if (editing) {
    return (
      <section className="px-6 md:px-14 py-10">
        <MeetingNotesEditor value={cleaned} onSave={onSave} onCancel={onEditCancel} />
      </section>
    );
  }

  if (!cleaned) {
    return (
      <section className="px-6 md:px-14 py-16 text-center">
        <V2Caps>NOTES · NOT YET DISTILLED</V2Caps>
        <p className="mt-4 mx-auto max-w-md text-[15px] leading-relaxed" style={{ color: v2.inkSoft }}>
          Oscar didn&rsquo;t save AI notes for this meeting. You can write them by hand.
        </p>
        <button
          type="button"
          onClick={onEditStart}
          className="inline-flex items-center gap-2 mt-7 rounded-full px-5 py-2.5"
          style={{ background: v2.ink, color: v2.cream, fontSize: 14 }}
        >
          <Pencil size={12} />
          Write notes
        </button>
      </section>
    );
  }

  return (
    <section className="px-6 md:px-14 pt-9 pb-16">
      {sections.hasStructure ? (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-10">
          <div className="md:col-span-4">
            <V2Caps color={v2.accent}>
              DECISIONS · {sections.decisions.length}
            </V2Caps>
            {sections.decisions.length > 0 ? (
              <ol className="mt-5 space-y-5">
                {sections.decisions.map((d, i) => (
                  <li key={i} className="flex gap-3">
                    <V2Mono style={{ fontSize: 11, color: v2.accent }}>
                      {`0${i + 1}`.slice(-2)}
                    </V2Mono>
                    <span
                      style={{
                        fontFamily: v2Serif,
                        fontSize: 17,
                        lineHeight: 1.45,
                        color: v2.ink,
                      }}
                    >
                      {d}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 text-[13px] italic" style={{ color: v2.inkFaint }}>
                None this meeting.
              </p>
            )}
          </div>
          <div
            className="md:col-span-5"
            style={{ borderLeft: `1px solid ${v2.rule}`, paddingLeft: 30 }}
          >
            <V2Caps>ACTIONS · {sections.actions.length}</V2Caps>
            {sections.actions.length > 0 ? (
              <ul className="mt-5 space-y-4">
                {sections.actions.map((a, i) => {
                  const ownerMatch = a.match(/^([A-Z][\w'-]+)\s*[—:-]\s*(.+)$/);
                  const owner = ownerMatch?.[1];
                  const text = ownerMatch?.[2] ?? a;
                  return (
                    <li
                      key={i}
                      className="flex items-start gap-3 pb-3"
                      style={{ borderBottom: `1px solid ${v2.rule}` }}
                    >
                      <span
                        style={{
                          display: "inline-block",
                          height: 22,
                          width: 22,
                          borderRadius: 999,
                          background: v2.accentSoft,
                          color: v2.ink,
                          fontFamily: v2Serif,
                          fontSize: 11,
                          textAlign: "center",
                          lineHeight: "22px",
                          fontWeight: 500,
                          marginTop: 2,
                        }}
                      >
                        {(owner?.[0] || "·").toUpperCase()}
                      </span>
                      <div>
                        {owner && (
                          <V2Mono
                            style={{
                              fontSize: 10,
                              color: v2.inkFaint,
                              letterSpacing: "0.16em",
                            }}
                          >
                            {owner.toUpperCase()}
                          </V2Mono>
                        )}
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
            ) : (
              <p className="mt-4 text-[13px] italic" style={{ color: v2.inkFaint }}>
                None this meeting.
              </p>
            )}
          </div>
          <aside
            className="md:col-span-3"
            style={{ borderLeft: `1px solid ${v2.rule}`, paddingLeft: 30 }}
          >
            <V2Caps>FOLLOW-UPS</V2Caps>
            {sections.followUps.length > 0 ? (
              <ul
                className="mt-5 space-y-4 text-[13px] leading-relaxed"
                style={{ color: v2.inkSoft }}
              >
                {sections.followUps.map((f, i) => (
                  <li key={i}>· {f}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-[13px] italic" style={{ color: v2.inkFaint }}>
                Nothing waiting.
              </p>
            )}
            <div className="mt-10 flex items-center gap-2">
              <button
                type="button"
                onClick={onEditStart}
                className="inline-flex items-center gap-1.5 text-[12px]"
                style={{ color: v2.inkFaint }}
              >
                <Pencil size={11} />
                Edit notes
              </button>
            </div>
          </aside>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-10">
          <div className="md:col-span-9 prose prose-slate max-w-none" style={{ color: v2.ink }}>
            <MarkdownView>{cleaned}</MarkdownView>
          </div>
          <aside
            className="md:col-span-3"
            style={{ borderLeft: `1px solid ${v2.rule}`, paddingLeft: 30 }}
          >
            <V2Caps>NOTES</V2Caps>
            <p className="mt-3 text-[13px] leading-relaxed" style={{ color: v2.inkSoft }}>
              Oscar didn&rsquo;t structure these into Decisions / Actions / Follow-ups. You can edit
              the raw markdown directly.
            </p>
            <button
              type="button"
              onClick={onEditStart}
              className="inline-flex items-center gap-1.5 mt-4 text-[12px]"
              style={{ color: v2.inkFaint }}
            >
              <Pencil size={11} />
              Edit notes
            </button>
          </aside>
        </div>
      )}
    </section>
  );
}

function TranscriptTab({
  meeting,
  stats,
  query,
  onQueryChange,
  matches,
  totalBytes,
  onCopy,
  onEmail,
}: {
  meeting: SavedMeetingRecord;
  stats: SpeakerStat[];
  query: string;
  onQueryChange: (q: string) => void;
  matches: Array<{ seg: MeetingTranscriptSegment; i: number }> | null;
  totalBytes: number;
  onCopy: () => Promise<void>;
  onEmail: () => void;
}) {
  const hasSegments = meeting.transcriptSegments.length > 0;
  const baseStart = meeting.transcriptSegments[0]?.start_time;

  const visibleSegments = matches
    ? matches.map((m) => ({ ...m.seg, _index: m.i }))
    : meeting.transcriptSegments.map((seg, i) => ({ ...seg, _index: i }));

  if (!hasSegments && !meeting.transcript) {
    return (
      <section className="px-6 md:px-14 py-16 text-center">
        <V2Caps>TRANSCRIPT · NOT SAVED</V2Caps>
        <p className="mt-4 mx-auto max-w-md text-[15px] leading-relaxed" style={{ color: v2.inkSoft }}>
          No raw transcript captured. The desktop app saves these going forward.
        </p>
      </section>
    );
  }

  return (
    <section className="px-6 md:px-14 pt-7 pb-16">
      {hasSegments ? (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-10">
          <div className="md:col-span-9">
            {visibleSegments.length === 0 ? (
              <p className="py-10 text-[14px]" style={{ color: v2.inkSoft }}>
                No turns match &ldquo;{query}&rdquo;.
              </p>
            ) : (
              visibleSegments.map((seg, idx) => {
                const label =
                  seg.speaker.diarization_label ??
                  (seg.speaker.source === "speaker" ? "Them" : "Me");
                const offset = baseStart ? offsetLabel(seg.start_time, baseStart) : "";
                const isLast = idx === visibleSegments.length - 1;
                return (
                  <div
                    key={seg.id || idx}
                    className="grid grid-cols-12 gap-4 md:gap-6 py-5"
                    style={{ borderBottom: isLast ? "none" : `1px solid ${v2.rule}` }}
                  >
                    <div className="col-span-12 md:col-span-2 flex flex-col gap-1.5">
                      <V2Mono style={{ fontSize: 12, color: v2.ink }}>{offset}</V2Mono>
                      <div className="flex items-center gap-2">
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
                            fontSize: 11,
                            textAlign: "center",
                            lineHeight: "22px",
                          }}
                        >
                          {(label[0] || "·").toUpperCase()}
                        </span>
                        <V2Caps>{label.toUpperCase()}</V2Caps>
                      </div>
                    </div>
                    <div className="col-span-12 md:col-span-10">
                      <p
                        style={{
                          fontFamily: v2Serif,
                          fontSize: 18,
                          lineHeight: 1.5,
                          color: v2.ink,
                          letterSpacing: "-0.002em",
                        }}
                      >
                        {seg.text}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <aside className="md:col-span-3 md:sticky md:top-6 md:self-start">
            <div
              className="flex items-center gap-2 rounded-full"
              style={{
                border: `1px solid ${v2.rule}`,
                background: v2.cream2,
                padding: "7px 14px",
              }}
            >
              <Search size={12} style={{ color: v2.inkFaint }} />
              <input
                type="text"
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder="Search transcript"
                className="flex-1 bg-transparent outline-none"
                style={{ fontSize: 13, color: v2.ink }}
              />
              {query && (
                <V2Mono style={{ fontSize: 10, color: v2.inkFaint }}>
                  {matches?.length ?? 0}
                </V2Mono>
              )}
            </div>

            <div className="mt-7">
              <V2Caps>SPEAKERS · {stats.length}</V2Caps>
              <ul className="mt-3 space-y-2">
                {stats.map((s) => (
                  <li key={s.label} className="flex items-center gap-2.5">
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
                        fontSize: 11,
                        textAlign: "center",
                        lineHeight: "22px",
                      }}
                    >
                      {s.initial}
                    </span>
                    <span style={{ fontSize: 13, color: v2.ink }}>{s.label}</span>
                    <V2Mono
                      style={{ marginLeft: "auto", fontSize: 11, color: v2.inkFaint }}
                    >
                      {formatSpeakerDuration(s.durationMs)}
                    </V2Mono>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-7 pt-5" style={{ borderTop: `1px solid ${v2.rule}` }}>
              <button
                type="button"
                onClick={() => void onCopy()}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full"
                style={{
                  background: v2.ink,
                  color: v2.cream,
                  padding: "9px 14px",
                  fontSize: 13,
                }}
              >
                <Copy size={12} />
                Copy full transcript
              </button>
              <button
                type="button"
                onClick={onEmail}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-full"
                style={{
                  background: "transparent",
                  color: v2.inkSoft,
                  padding: "9px 14px",
                  fontSize: 13,
                  border: `1px solid ${v2.rule}`,
                }}
              >
                <Mail size={12} />
                Email notes
              </button>
              <V2Mono
                style={{
                  display: "block",
                  marginTop: 12,
                  fontSize: 10,
                  color: v2.inkFaint,
                  letterSpacing: "0.12em",
                }}
              >
                {Math.round(totalBytes / 1024)} KB · {meeting.transcriptSegments.length} TURNS
              </V2Mono>
            </div>
          </aside>
        </div>
      ) : (
        <div className="prose prose-slate max-w-none" style={{ color: v2.ink, fontFamily: v2Serif }}>
          <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, fontSize: 17 }}>
            {meeting.transcript}
          </p>
        </div>
      )}
    </section>
  );
}

function RoughTab({
  meeting,
  editing,
  onEditStart,
  onEditCancel,
  onSave,
}: {
  meeting: SavedMeetingRecord;
  editing: boolean;
  onEditStart: () => void;
  onEditCancel: () => void;
  onSave: (value: string) => Promise<void>;
}) {
  if (editing) {
    return (
      <section className="px-6 md:px-14 py-10">
        <MeetingNotesEditor
          value={meeting.myNotesMarkdown}
          onSave={onSave}
          onCancel={onEditCancel}
        />
      </section>
    );
  }

  if (!meeting.myNotesMarkdown.trim()) {
    return (
      <section className="px-6 md:px-14 py-16 text-center">
        <V2Caps>YOUR ROUGH NOTES · EMPTY</V2Caps>
        <p className="mt-4 mx-auto max-w-md text-[15px] leading-relaxed" style={{ color: v2.inkSoft }}>
          You didn&rsquo;t leave any notes during the meeting. Add some retroactively if useful.
        </p>
        <button
          type="button"
          onClick={onEditStart}
          className="inline-flex items-center gap-2 mt-7 rounded-full px-5 py-2.5"
          style={{ background: v2.ink, color: v2.cream, fontSize: 14 }}
        >
          <Pencil size={12} />
          Write notes
        </button>
      </section>
    );
  }

  return (
    <section className="px-6 md:px-14 pt-9 pb-16">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-10">
        <div className="md:col-span-9 prose prose-slate max-w-none" style={{ color: v2.ink }}>
          <MarkdownView>{meeting.myNotesMarkdown}</MarkdownView>
        </div>
        <aside
          className="md:col-span-3"
          style={{ borderLeft: `1px solid ${v2.rule}`, paddingLeft: 30 }}
        >
          <V2Caps>WRITTEN BY YOU · LIVE</V2Caps>
          <p className="mt-3 text-[13px] leading-relaxed" style={{ color: v2.inkSoft }}>
            Your own shorthand. Oscar reconciled this with the transcript when building the AI
            notes — but the raw text is yours.
          </p>
          <button
            type="button"
            onClick={onEditStart}
            className="inline-flex items-center gap-1.5 mt-4 text-[12px]"
            style={{ color: v2.inkFaint }}
          >
            <Pencil size={11} />
            Edit
          </button>
        </aside>
      </div>
    </section>
  );
}

