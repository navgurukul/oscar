"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { meetingsService } from "@/lib/services/meetings.service";
import { useAuth } from "@/lib/contexts/AuthContext";
import { Spinner } from "@/components/ui/spinner";
import {
  Users,
  Calendar,
  ChevronDown,
  ChevronUp,
  MonitorPlay,
  Mic2,
} from "lucide-react";
import type { SavedMeetingRecord, MeetingTranscriptSegment } from "@oscar/shared/types";

// ── helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function meetingTypeBadge(hint: string) {
  const map: Record<string, { label: string; cls: string }> = {
    discovery: { label: "Discovery", cls: "bg-cyan-500/15 text-cyan-300" },
    "1on1":    { label: "1-on-1",    cls: "bg-cyan-500/15 text-cyan-300" },
    standup:   { label: "Stand-up",  cls: "bg-slate-500/15 text-slate-300" },
    general:   { label: "General",   cls: "bg-cyan-500/15 text-cyan-300" },
    auto:      { label: "Meeting",   cls: "bg-slate-500/15 text-slate-300" },
  };
  const { label, cls } = map[hint] ?? map.auto;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[0.7rem] font-medium ${cls}`}>
      {label}
    </span>
  );
}

// ── transcript segment ────────────────────────────────────────────────────────

function TranscriptSegment({ seg }: { seg: MeetingTranscriptSegment }) {
  const isSpeaker = seg.speaker.source === "speaker";
  return (
    <div className={`flex gap-3 ${isSpeaker ? "flex-row-reverse" : ""}`}>
      <div className="flex-shrink-0 mt-0.5">
        {isSpeaker ? (
          <MonitorPlay size={14} className="text-cyan-400" />
        ) : (
          <Mic2 size={14} className="text-slate-400" />
        )}
      </div>
      <p
        className={`text-sm leading-relaxed max-w-[85%] ${
          isSpeaker ? "text-right text-slate-300" : "text-slate-300"
        }`}
      >
        <span className="text-[0.65rem] text-slate-500 mr-1.5">
          {seg.speaker.diarization_label ?? (isSpeaker ? "Them" : "Me")}
        </span>
        {seg.text}
      </p>
    </div>
  );
}

// ── meeting card ──────────────────────────────────────────────────────────────

function MeetingCard({ meeting }: { meeting: SavedMeetingRecord }) {
  const [expanded, setExpanded] = useState(false);

  const hasTranscript  = meeting.transcriptSegments.length > 0;
  const hasNotes       = !!meeting.notesMarkdown?.trim();
  const hasMyNotes     = !!meeting.myNotesMarkdown?.trim();

  return (
    <article className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden transition-all duration-200 hover:border-slate-700">
      {/* Card header — always visible */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left p-5 sm:p-6 flex items-start justify-between gap-4 group hover:bg-slate-800/50 transition-colors duration-150"
        aria-expanded={expanded}
      >
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {meetingTypeBadge(meeting.meetingTypeHint)}
          </div>

          <h2 className="text-base sm:text-lg font-semibold text-white leading-snug">
            {meeting.meetingTitle || "Untitled Meeting"}
          </h2>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400">
            <span className="flex items-center gap-1.5">
              <Calendar size={13} className="flex-shrink-0" />
              {formatDate(meeting.startedAt)}
            </span>
            {meeting.attendeesCompact && (
              <span className="flex items-center gap-1.5 truncate max-w-[220px]">
                <Users size={13} className="flex-shrink-0" />
                {meeting.attendeesCompact}
              </span>
            )}
          </div>
        </div>

        <div className="flex-shrink-0 text-slate-500 group-hover:text-slate-300 transition-colors mt-1">
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {/* Expandable body */}
      {expanded && (
        <div className="border-t border-slate-800 divide-y divide-slate-800">
          {/* AI-generated meeting notes */}
          {hasNotes && (
            <section className="p-5 sm:p-6 space-y-3">
              <h3 className="text-sm font-semibold text-cyan-400">
                Meeting Notes
              </h3>
              <div className="prose prose-sm prose-invert max-w-none text-slate-300 whitespace-pre-wrap leading-relaxed">
                {meeting.notesMarkdown}
              </div>
            </section>
          )}

          {/* My personal notes */}
          {hasMyNotes && (
            <section className="p-5 sm:p-6 space-y-3">
              <h3 className="text-sm font-semibold text-slate-300">
                My Notes
              </h3>
              <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                {meeting.myNotesMarkdown}
              </div>
            </section>
          )}

          {/* Transcript segments */}
          {hasTranscript && (
            <section className="p-5 sm:p-6 space-y-3">
              <h3 className="text-sm font-semibold text-slate-300">
                Transcript
              </h3>
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {meeting.transcriptSegments.map((seg) => (
                  <TranscriptSegment key={seg.id} seg={seg} />
                ))}
              </div>
            </section>
          )}

          {/* Fallback: raw transcript text */}
          {!hasTranscript && meeting.transcript && (
            <section className="p-5 sm:p-6 space-y-3">
              <h3 className="text-sm font-semibold text-slate-300">
                Transcript
              </h3>
              <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
                {meeting.transcript}
              </p>
            </section>
          )}
        </div>
      )}
    </article>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function MeetingsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [meetings, setMeetings] = useState<SavedMeetingRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/auth");
      return;
    }

    meetingsService.getMeetings().then(({ data, error }) => {
      if (error) {
        setError("Failed to load meetings. Please try again.");
      } else {
        setMeetings(data ?? []);
      }
      setIsLoading(false);
    });
  }, [user, authLoading, router]);

  if (authLoading || isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Spinner className="text-cyan-500" />
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 pt-28 pb-24 max-w-2xl mx-auto">
      {/* Page header */}
      <div className="mb-8 space-y-1">
        <h1 className="text-3xl font-bold text-white">
          Meetings
        </h1>
        <p className="text-slate-400 text-sm">
          Meeting notes captured on the OSCAR desktop app — read-only on web.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-950/60 border border-red-800/50 text-red-300 text-sm">
          {error}
        </div>
      )}

      {meetings.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center">
            <Users size={28} className="text-slate-500" />
          </div>
          <div className="space-y-1">
            <p className="text-white font-medium">No meetings yet</p>
            <p className="text-slate-400 text-sm max-w-[280px]">
              Meetings recorded on the OSCAR desktop app will appear here automatically.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {meetings.map((m) => (
            <MeetingCard key={m.id} meeting={m} />
          ))}
        </div>
      )}
    </main>
  );
}
