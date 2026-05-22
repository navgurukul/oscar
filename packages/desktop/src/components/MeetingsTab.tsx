import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { buildMeetingContextPack, copyMarkdownAsRichText } from "@oscar/shared";
import { aiService } from "../services/ai.service";
import {
  FileText,
  Users,
  Mic,
  Square,
  Copy,
  Check,
  RotateCcw,
  ChevronLeft,
  Loader2,
  Mail,
  CalendarDays,
  Play,
  X,
  Trash2,
  History,
  RefreshCw,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "../lib/utils";
import {
  MarkdownNotesView,
  markdownPreview,
  stripEvidenceComments,
} from "./MarkdownNotesView";
import type {
  EnhancedMeetingNoteRequest,
  MeetingAttendee,
  MeetingCalendarContext,
  MeetingTranscriptSegment,
  MeetingTypeHint,
  SavedMeetingRecord,
} from "../types/meeting.types";
import {
  buildLabeledTranscript,
  groupSegmentsIntoTurns,
  resolveSpeakerLabels,
  type SpeakerLabels,
  type TranscriptTurn,
} from "../lib/transcript-utils";

const GOOGLE_CALENDAR_LOGO_URL =
  "https://cdn.brandfetch.io/id6O2oGzv-/theme/dark/idMX2_OMSc.svg?c=1bxid64Mup7aczewSAYMX&t=1755572706253";
const FIGTREE_FONT_STYLE = { fontFamily: '"Figtree", -apple-system, sans-serif' } as const;
const GARAMOND_FONT_STYLE = { fontFamily: '"EB Garamond", Georgia, serif' } as const;
const MEETINGS_TAB_CLASS_NAME = "flex flex-1 flex-col overflow-y-auto px-12 pt-10 pb-[120px] bg-cream";
const MEETINGS_CONTAINER_CLASS_NAME = "mx-auto w-full max-w-[720px]";
const MEETINGS_TITLE_CLASS_NAME = "mb-3 text-left font-serif font-medium tracking-[-0.02em] text-ink text-[36px] leading-[1.05]";
const MEETINGS_SUBTITLE_CLASS_NAME = "mb-7 text-sm leading-6 text-ink-soft";
const SECTION_HEADER_CLASS_NAME = "mb-3 flex items-center gap-[7px] font-mono text-[10px] tracking-[0.18em] uppercase text-ink-faint";
const CALENDAR_EMPTY_CLASS_NAME = "flex flex-col items-center gap-2 px-0 py-3 text-center";
const PARTICIPANT_PILLS_CLASS_NAME = "flex min-h-8 flex-wrap items-center gap-1.5 py-1";
const PARTICIPANT_PILL_CLASS_NAME = "inline-flex max-w-[220px] items-center gap-1 rounded-[20px] border border-cream-300 bg-cream-200 px-2 py-[3px] pl-2.5 text-xs leading-[1.3] text-ink-soft";
const PARTICIPANT_PILL_TEXT_CLASS_NAME = "truncate";
const PARTICIPANT_PILL_REMOVE_CLASS_NAME = "flex size-4 shrink-0 items-center justify-center rounded-full p-0 text-ink-faint transition-colors hover:bg-cream-300 hover:text-ink";
const RESULT_TABS_CLASS_NAME = "mb-4 flex border-b border-cream-300";
const RESULT_TAB_CLASS_NAME = "mb-[-1px] inline-flex items-center gap-1.5 border-b-2 border-transparent bg-transparent px-4 py-2.5 text-[0.8125rem] font-medium text-ink-faint transition-colors hover:text-ink-soft";
const FOOTER_BUTTON_CLASS_NAME = "inline-flex items-center gap-1.5 rounded-lg border border-cream-300 bg-cream-50 px-3.5 py-[7px] text-[0.8125rem] font-medium text-ink-soft transition-colors hover:border-cream-400 hover:bg-cream-200";

export type CalendarReconnectResult = "refreshed" | "needs_reconnect" | "retry_later";
export type MinutesTranscriptionStatus =
  | "idle"
  | "recording"
  | "transcribing"
  | "finalizing"
  | "notes";

type Phase = "select" | "recording" | "processing" | "result" | "view_saved";

interface CalendarEvent {
  title: string;
  start_time: string;
  end_time: string;
  start_at: string;
  end_at: string;
  attendees: MeetingAttendee[];
  organizer_email: string;
  calendar_name: string;
}

interface MeetingsTabProps {
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  recordingTime: number;
  transcript: string;
  transcriptSegments: MeetingTranscriptSegment[];
  meetingStartedAt: string;
  onClearTranscript: () => void;
  systemAudioWarning?: string;
  googleCalendarToken: string;
  onConnectCalendar: () => void;
  onCalendarTokenInvalid: () => Promise<CalendarReconnectResult>;
  savedMeetings: SavedMeetingRecord[];
  vocabularyTerms?: string[];
  onSaveMeeting: (meeting: SavedMeetingRecord) => void;
  onDeleteMeeting: (id: string) => void;
  minutesTranscriptionStatus: MinutesTranscriptionStatus;
  minutesSegmentQueue: number;
  minutesSegmentsCompleted: number;
  minutesSegmentsTotal: number;
  hostName: string;
  hostEmail: string;
}

const MEETING_TYPE_OPTIONS: Array<{
  value: MeetingTypeHint;
  label: string;
}> = [
  { value: "auto", label: "Auto" },
  { value: "discovery", label: "Discovery" },
  { value: "1on1", label: "1:1" },
  { value: "standup", label: "Standup" },
  { value: "general", label: "General" },
];

function attendeeLabel(attendee: MeetingAttendee): string {
  return attendee.name || attendee.email || "Unknown attendee";
}

function parseAttendeeInput(value: string): MeetingAttendee {
  const trimmed = value.trim();
  const bracketEmailMatch = trimmed.match(/^(.*?)\s*<([^>]+)>$/);
  if (bracketEmailMatch) {
    const name = bracketEmailMatch[1].trim() || bracketEmailMatch[2].trim();
    return { name, email: bracketEmailMatch[2].trim() };
  }

  const plainEmail = trimmed.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  if (plainEmail) {
    return { name: trimmed, email: trimmed };
  }

  return { name: trimmed, email: "" };
}

function buildAttendeesCompact(attendees: MeetingAttendee[]): string {
  const labels = attendees.map(attendeeLabel).filter(Boolean);
  if (labels.length === 0) return "";
  if (labels.length <= 2) return labels.join(", ");
  return `${labels[0]}, ${labels[1]} +${labels.length - 2}`;
}

function getEventTimestamp(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isEventOngoing(event: CalendarEvent, currentTime: number): boolean {
  const start = getEventTimestamp(event.start_at);
  const end = getEventTimestamp(event.end_at);
  return start <= currentTime && end >= currentTime;
}

function getEventDayLabel(event: CalendarEvent, currentTime: number): string {
  const start = new Date(event.start_at);
  if (Number.isNaN(start.getTime())) return "Upcoming";

  const now = new Date(currentTime);
  if (isSameCalendarDay(start, now)) return "Today";

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (isSameCalendarDay(start, tomorrow)) return "Tomorrow";

  return start.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatEventTimeRange(event: CalendarEvent): string {
  const start = new Date(event.start_at);
  const end = new Date(event.end_at);

  if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
    return `${start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} - ${end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  }

  return `${event.start_time} - ${event.end_time}`;
}

function groupEventsByDay(
  events: CalendarEvent[],
  currentTime: number,
): Array<{ key: string; label: string; events: CalendarEvent[] }> {
  const groups = new Map<string, { label: string; events: CalendarEvent[] }>();
  for (const event of events) {
    const live = isEventOngoing(event, currentTime);
    const label = live ? "Ongoing" : getEventDayLabel(event, currentTime);
    const key = label;
    if (!groups.has(key)) {
      groups.set(key, { label, events: [] });
    }
    groups.get(key)!.events.push(event);
  }
  return Array.from(groups.entries()).map(([key, value]) => ({ key, ...value }));
}

function buildMeetingLocalDatetime(dateValue: string): string {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

function buildCalendarContext(
  event: CalendarEvent | null,
): MeetingCalendarContext | null {
  if (!event) return null;
  return {
    scheduled_start_time: event.start_at,
    scheduled_end_time: event.end_at,
    organizer_email: event.organizer_email,
    event_title: event.title,
  };
}

function buildFallbackTranscriptSegments(
  transcript: string,
  startedAt: string,
): MeetingTranscriptSegment[] {
  const text = transcript.trim();
  if (!text) return [];

  const start = Date.parse(startedAt);
  const startTime = Number.isFinite(start) ? start : Date.now();

  return [
    {
      id: "seg-fallback-0-microphone",
      speaker: { source: "microphone" },
      text,
      start_time: new Date(startTime).toISOString(),
      end_time: new Date(Math.max(Date.now(), startTime + 1)).toISOString(),
    },
  ];
}

function getScribblesLoadingLabel(
  status: MinutesTranscriptionStatus,
  transcript: string,
  completed: number,
  total: number,
  queue: number,
): string {
  if (status === "finalizing") {
    const normalizedTotal = Math.max(total, completed + queue);
    if (normalizedTotal > 0) {
      return `Finalizing transcript (${completed}/${normalizedTotal} segments complete)…`;
    }
    return "Finalizing transcript…";
  }

  if (status === "transcribing") {
    const normalizedTotal = Math.max(total, completed + queue);
    if (normalizedTotal > 0) {
      return `Transcribing segment ${Math.min(completed + 1, normalizedTotal)} of ${normalizedTotal}…`;
    }
    return "Transcribing audio…";
  }

  if (!transcript.trim()) {
    return "Transcribing audio…";
  }

  return "Generating enhanced notes…";
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function MeetingTypePicker({
  value,
  onChange,
}: {
  value: MeetingTypeHint;
  onChange: (value: MeetingTypeHint) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {MEETING_TYPE_OPTIONS.map((option) => (
        <button
          key={option.value}
          className={cn(
            "rounded-full px-2 py-0.5 text-[0.6875rem] font-medium transition-colors",
            value === option.value
              ? "bg-cyan-50 text-cyan-600"
              : "text-slate-400 hover:bg-slate-100 hover:text-slate-500",
          )}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function CalendarConnectCard({
  title,
  hint,
  buttonLabel,
  onClick,
  warning = false,
}: {
  title: string;
  hint: string;
  buttonLabel: string;
  onClick: () => void;
  warning?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex w-full items-center justify-between gap-3.5 rounded-[14px] border border-slate-200 bg-white px-3.5 py-3 max-md:flex-col max-md:items-start",
        warning && "border-orange-300 bg-[#fffaf3]",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <div
          className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] border border-slate-200 bg-slate-50"
          aria-hidden="true"
        >
          <img className="h-[18px] w-[18px] object-contain" src={GOOGLE_CALENDAR_LOGO_URL} alt="" />
        </div>
        <div className="flex min-w-0 flex-col gap-0.5 text-left">
          <p className="m-0 text-sm font-semibold text-slate-800">{title}</p>
          <p className="m-0 text-[0.7625rem] leading-[1.45] text-slate-500">{hint}</p>
        </div>
      </div>
      <button
        className="shrink-0 rounded-lg bg-cyan-500 px-[18px] py-2 text-[0.8125rem] font-semibold text-slate-900 transition-colors hover:bg-cyan-400 active:bg-cyan-600 max-md:w-full"
        onClick={onClick}
        type="button"
      >
        {buttonLabel}
      </button>
    </div>
  );
}

function CalendarEventRow({
  event,
  onUse,
  isLive,
}: {
  event: CalendarEvent;
  onUse: (event: CalendarEvent) => void;
  isLive?: boolean;
}) {
  const attendeeLabel =
    event.attendees.length === 1
      ? "1 attendee"
      : `${event.attendees.length} attendees`;

  return (
    <button
      className="group grid grid-cols-12 gap-4 items-baseline w-full text-left py-4 border-b border-cream-300 last:border-b-0 bg-transparent border-l-0 border-r-0 border-t-0 cursor-pointer transition-colors hover:bg-cream-50"
      onClick={() => onUse(event)}
      type="button"
    >
      <div className="col-span-3">
        <span className="font-mono text-[12px] text-ink tracking-[0.02em]">
          {formatEventTimeRange(event)}
        </span>
        <div className="mt-1 font-mono text-[10px] tracking-[0.16em] uppercase text-ink-faint">
          {isLive ? (
            <span className="text-terracotta">● LIVE · {attendeeLabel.toUpperCase()}</span>
          ) : (
            attendeeLabel.toUpperCase()
          )}
        </div>
      </div>
      <div className="col-span-7 min-w-0">
        <h3 className="font-serif text-[17px] font-medium text-ink leading-[1.2] tracking-[-0.005em] truncate">
          {event.title}
        </h3>
      </div>
      <div className="col-span-2 text-right">
        <span className="inline-flex items-center gap-1 font-mono text-[11px] tracking-[0.16em] uppercase text-terracotta">
          <Play size={9} fill="currentColor" />
          record →
        </span>
      </div>
    </button>
  );
}

export function MeetingsTab({
  isRecording,
  onStartRecording,
  onStopRecording,
  recordingTime,
  transcript,
  transcriptSegments,
  meetingStartedAt,
  onClearTranscript,
  systemAudioWarning,
  googleCalendarToken,
  onConnectCalendar,
  onCalendarTokenInvalid,
  savedMeetings,
  vocabularyTerms = [],
  onSaveMeeting,
  onDeleteMeeting,
  minutesTranscriptionStatus,
  minutesSegmentQueue,
  minutesSegmentsCompleted,
  minutesSegmentsTotal,
  hostName,
  hostEmail,
}: MeetingsTabProps) {
  const [meetingTypeHint, setMeetingTypeHint] = useState<MeetingTypeHint>("auto");
  const [meetingTitle, setMeetingTitle] = useState("");
  const [attendees, setAttendees] = useState<MeetingAttendee[]>([]);
  const [participantInput, setParticipantInput] = useState("");
  const [manualNotes, setManualNotes] = useState("");
  const [selectedCalendarEvent, setSelectedCalendarEvent] =
    useState<CalendarEvent | null>(null);
  const [phase, setPhase] = useState<Phase>("select");
  const [result, setResult] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [resultTab, setResultTab] = useState<"notes" | "transcript">("notes");
  const [viewingSaved, setViewingSaved] = useState<SavedMeetingRecord | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState("");
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [showAttendeeEditor, setShowAttendeeEditor] = useState(false);
  const [calendarError, setCalendarError] =
    useState<"needs_reconnect" | "fetch_error" | null>(null);
  const [calendarErrorMsg, setCalendarErrorMsg] = useState("");
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const lastCalendarFetchRef = useRef<string>("");
  const liveTranscriptScrollRef = useRef<HTMLDivElement>(null);

  const liveSpeakerLabels = useMemo<SpeakerLabels>(
    () => resolveSpeakerLabels(attendees, hostName, hostEmail),
    [attendees, hostName, hostEmail],
  );

  const savedSpeakerLabels = useMemo<SpeakerLabels>(
    () =>
      viewingSaved
        ? resolveSpeakerLabels(viewingSaved.attendeesFull, hostName, hostEmail)
        : liveSpeakerLabels,
    [viewingSaved, hostName, hostEmail, liveSpeakerLabels],
  );

  useEffect(() => {
    if (phase === "recording" && liveTranscriptScrollRef.current) {
      liveTranscriptScrollRef.current.scrollTop = liveTranscriptScrollRef.current.scrollHeight;
    }
  }, [transcript, phase]);

  const addAttendee = (value: string) => {
    const parsed = parseAttendeeInput(value);
    const normalized = attendeeLabel(parsed).toLowerCase();
    if (
      normalized &&
      !attendees.some(
        (attendee) => attendeeLabel(attendee).toLowerCase() === normalized,
      )
    ) {
      setAttendees((prev) => [...prev, parsed]);
    }
    setParticipantInput("");
  };

  const removeAttendee = (index: number) => {
    setAttendees((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleParticipantKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (
      (event.key === "Enter" || event.key === "," || event.key === "Tab") &&
      participantInput.trim()
    ) {
      event.preventDefault();
      addAttendee(participantInput);
      return;
    }

    if (
      event.key === "Backspace" &&
      !participantInput &&
      attendees.length > 0
    ) {
      setAttendees((prev) => prev.slice(0, -1));
    }
  };

  const handleParticipantBlur = () => {
    if (participantInput.trim()) {
      addAttendee(participantInput);
    }
  };

  const fetchCalendarEvents = useCallback(
    (options?: { force?: boolean }) => {
      if (!googleCalendarToken) {
        setCalendarEvents([]);
        setCalendarError(null);
        lastCalendarFetchRef.current = "";
        return;
      }

      const now = new Date();
      const dateKey = now.toISOString().slice(0, 10);
      const cacheKey = `${googleCalendarToken.slice(0, 16)}:${dateKey}`;
      if (
        !options?.force &&
        cacheKey === lastCalendarFetchRef.current &&
        calendarEvents.length > 0
      ) {
        return;
      }

      setCalendarLoading(true);
      setCalendarError(null);
      const timeMin = new Date(now);
      timeMin.setHours(0, 0, 0, 0);
      const timeMax = new Date(now);
      timeMax.setDate(timeMax.getDate() + 14);
      timeMax.setHours(23, 59, 59, 999);

      invoke<CalendarEvent[]>("get_calendar_events", {
        token: googleCalendarToken,
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
      })
        .then((events) => {
          setCalendarEvents(events);
          setCalendarError(null);
          lastCalendarFetchRef.current = cacheKey;
        })
        .catch(async (invokeError: unknown) => {
          const message = String(invokeError);
          if (message.includes("NEEDS_RECONNECT")) {
            setCalendarErrorMsg("");
            const recoveryState = await onCalendarTokenInvalid();
            if (recoveryState === "refreshed") {
              setCalendarError(null);
            } else if (recoveryState === "retry_later") {
              setCalendarError("fetch_error");
              setCalendarErrorMsg(
                "Calendar access is being refreshed in the background. Please try again in a moment.",
              );
            } else {
              setCalendarError("needs_reconnect");
            }
          } else {
            console.warn("[meetings] calendar fetch failed:", invokeError);
            setCalendarError("fetch_error");
            setCalendarErrorMsg(message.replace(/^Error:\s*/i, "").slice(0, 200));
          }
        })
        .finally(() => setCalendarLoading(false));
    },
    [calendarEvents.length, googleCalendarToken, onCalendarTokenInvalid],
  );

  useEffect(() => {
    fetchCalendarEvents();
  }, [fetchCalendarEvents]);

  useEffect(() => {
    const id = setInterval(() => setCurrentTime(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const hasTranscriptInput =
    transcriptSegments.length > 0 || transcript.trim().length > 0;

  const attachContextPack = useCallback(
    (request: EnhancedMeetingNoteRequest): EnhancedMeetingNoteRequest => {
      try {
        return {
          ...request,
          context_pack: buildMeetingContextPack(request, {
            vocabulary: vocabularyTerms,
          }),
        };
      } catch (contextError) {
        console.warn("[minutes] context pack build failed:", contextError);
        return request;
      }
    },
    [vocabularyTerms],
  );

  const buildNoteRequest = useCallback((): EnhancedMeetingNoteRequest => {
    const title =
      meetingTitle.trim() ||
      selectedCalendarEvent?.title ||
      "Untitled Meeting";
    const attendeesCompact = buildAttendeesCompact(attendees);
    const startedAt =
      selectedCalendarEvent?.start_at ||
      meetingStartedAt ||
      new Date().toISOString();
    const effectiveTranscriptSegments =
      transcriptSegments.length > 0
        ? transcriptSegments
        : buildFallbackTranscriptSegments(transcript, startedAt);

    return attachContextPack({
      meeting_title: title,
      meeting_local_datetime: buildMeetingLocalDatetime(startedAt),
      attendees_compact: attendeesCompact,
      attendees_full: attendees,
      calendar_context: buildCalendarContext(selectedCalendarEvent),
      my_notes_markdown: manualNotes.trim(),
      transcript_segments: effectiveTranscriptSegments,
      meeting_type_hint: meetingTypeHint,
    });
  }, [
    attachContextPack,
    attendees,
    manualNotes,
    meetingStartedAt,
    meetingTitle,
    meetingTypeHint,
    selectedCalendarEvent,
    transcript,
    transcriptSegments,
  ]);

  const handleRegenerateSaved = useCallback(
    async (saved: SavedMeetingRecord) => {
      if (regenerating) return;
      setRegenerateError("");
      setRegenerating(true);
      try {
        const request = attachContextPack({
          meeting_title: saved.meetingTitle,
          meeting_local_datetime: saved.meetingLocalDatetime,
          attendees_compact: saved.attendeesCompact,
          attendees_full: saved.attendeesFull,
          calendar_context: saved.calendarContext,
          my_notes_markdown: saved.myNotesMarkdown,
          transcript_segments:
            saved.transcriptSegments.length > 0
              ? saved.transcriptSegments
              : buildFallbackTranscriptSegments(saved.transcript, saved.startedAt),
          meeting_type_hint: saved.meetingTypeHint,
        });
        const newMarkdown = await aiService.generateEnhancedMeetingNote(request);
        const updated: SavedMeetingRecord = {
          ...saved,
          notesMarkdown: newMarkdown,
        };
        onSaveMeeting(updated);
        setViewingSaved(updated);
      } catch (err) {
        setRegenerateError(
          err instanceof Error ? err.message : String(err),
        );
      } finally {
        setRegenerating(false);
      }
    },
    [attachContextPack, onSaveMeeting, regenerating],
  );

  const processTranscript = useCallback(async () => {
    if (!hasTranscriptInput && !manualNotes.trim()) return;

    setStreaming(true);
    setResult("");
    setError("");

    try {
      const processed = await aiService.generateEnhancedMeetingNote(
        buildNoteRequest(),
      );
      setResult(processed);
      setPhase("result");
    } catch (processingError) {
      setError(
        processingError instanceof Error
          ? processingError.message
          : String(processingError),
      );
      setPhase("result");
    } finally {
      setStreaming(false);
    }
  }, [buildNoteRequest, hasTranscriptInput, manualNotes]);

  useEffect(() => {
    if (
      phase === "processing" &&
      minutesTranscriptionStatus === "notes" &&
      (hasTranscriptInput || manualNotes.trim())
    ) {
      void processTranscript();
    }
  }, [
    manualNotes,
    minutesTranscriptionStatus,
    phase,
    processTranscript,
    hasTranscriptInput,
    transcriptSegments.length,
  ]);

  const savedMeetingIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (phase !== "result" || streaming || !result || error || savedMeetingIdRef.current) {
      return;
    }

    const request = buildNoteRequest();
    const now = new Date().toISOString();
    const meetingId = `meeting_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    savedMeetingIdRef.current = meetingId;

    const labeledTranscript =
      request.transcript_segments.length > 0
        ? buildLabeledTranscript(request.transcript_segments, liveSpeakerLabels)
        : transcript;

    onSaveMeeting({
      id: meetingId,
      startedAt:
        selectedCalendarEvent?.start_at ||
        meetingStartedAt ||
        now,
      meetingTitle: request.meeting_title,
      meetingLocalDatetime: request.meeting_local_datetime,
      attendeesCompact: request.attendees_compact,
      attendeesFull: request.attendees_full,
      calendarContext: request.calendar_context,
      meetingTypeHint: request.meeting_type_hint,
      transcript: labeledTranscript,
      transcriptSegments: request.transcript_segments,
      myNotesMarkdown: request.my_notes_markdown,
      notesMarkdown: result,
      createdAt: now,
    });
  }, [
    buildNoteRequest,
    error,
    liveSpeakerLabels,
    meetingStartedAt,
    onSaveMeeting,
    phase,
    result,
    selectedCalendarEvent,
    streaming,
    transcript,
    transcriptSegments,
  ]);

  const startFromEvent = (event: CalendarEvent) => {
    setMeetingTitle(event.title);
    setAttendees(event.attendees.filter((attendee) => attendeeLabel(attendee)));
    setParticipantInput("");
    setSelectedCalendarEvent(event);
    setMeetingTypeHint("auto");
    setPhase("recording");
    setResult("");
    setError("");
    setManualNotes("");
    setResultTab("notes");
    savedMeetingIdRef.current = null;
  };

  const handleStopRecording = () => {
    onStopRecording();
    setResultTab("notes");
    setPhase("processing");
  };

  const handleCopy = async (markdown: string) => {
    await copyMarkdownAsRichText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2_000);
  };

  const handleShareByEmail = async ({
    subjectTitle,
    attendeesFull,
    markdown,
  }: {
    subjectTitle: string;
    attendeesFull: MeetingAttendee[];
    markdown: string;
  }) => {
    const emails = attendeesFull
      .map((attendee) => attendee.email.trim())
      .filter(Boolean)
      .join(",");
    const subject = encodeURIComponent(`Meeting Notes: ${subjectTitle || "Meeting"}`);
    const body = encodeURIComponent(
      `Hi,\n\nPlease find the meeting notes below.\n\n---\n\n${stripEvidenceComments(markdown)}\n\n---\n\nGenerated by OSCAR`,
    );
    await openUrl(
      emails ? `mailto:${emails}?subject=${subject}&body=${body}` : `mailto:?subject=${subject}&body=${body}`,
    );
  };

  const resetDraftState = () => {
    setMeetingTypeHint("auto");
    setMeetingTitle("");
    setAttendees([]);
    setParticipantInput("");
    setShowAttendeeEditor(false);
    setManualNotes("");
    setSelectedCalendarEvent(null);
    setResult("");
    setError("");
    setStreaming(false);
    setResultTab("notes");
    onClearTranscript();
    savedMeetingIdRef.current = null;
  };

  const handleNewMeeting = () => {
    resetDraftState();
    setViewingSaved(null);
    setPhase("select");
  };

  const handleBack = () => {
    if (isRecording) {
      onStopRecording();
    }
    resetDraftState();
    setPhase("select");
  };

  const currentRequest = buildNoteRequest();
  const hasEmailableParticipants = attendees.some((attendee) => Boolean(attendee.email.trim()));
  const nextCalendarEvents = calendarEvents
    .filter((event) => getEventTimestamp(event.end_at) >= currentTime)
    .sort((a, b) => getEventTimestamp(a.start_at) - getEventTimestamp(b.start_at))
    .slice(0, 5);

  const systemAudioNotice = systemAudioWarning ? (
    <div className="mb-4 rounded-xl border border-orange-300 bg-orange-50 px-3.5 py-3 text-[0.9rem] leading-[1.5] text-orange-800">
      {systemAudioWarning}
    </div>
  ) : null;

  if (phase === "select") {
    return (
      <div className={MEETINGS_TAB_CLASS_NAME}>
        <div className={MEETINGS_CONTAINER_CLASS_NAME}>
          <div className="mb-7 pb-6 border-b border-cream-300">
            <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-faint">
              MINUTES · {savedMeetings?.length ?? 0} SAVED
            </span>
            <h1 className={MEETINGS_TITLE_CLASS_NAME} style={GARAMOND_FONT_STYLE}>
              What was <em className="italic text-terracotta">decided</em>.
            </h1>
            <p className="text-sm leading-6 text-ink-soft max-w-[480px]">
              Record once, keep your rough notes, and let Minutes turn the meeting into a clean structured summary.
            </p>
          </div>

          {systemAudioNotice}

          <div className="mb-2">
            <div className={SECTION_HEADER_CLASS_NAME}>
              <CalendarDays size={14} />
              <span>Coming up</span>
              {calendarLoading && <Loader2 size={12} className="animate-spin" />}
              {googleCalendarToken && (
                <button
                  type="button"
                  onClick={() => fetchCalendarEvents({ force: true })}
                  disabled={calendarLoading}
                  className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Refresh upcoming meetings"
                  title="Refresh"
                >
                  <RefreshCw
                    size={12}
                    className={calendarLoading ? "animate-spin" : ""}
                  />
                </button>
              )}
            </div>

            {!googleCalendarToken && !calendarLoading && (
              <div className={CALENDAR_EMPTY_CLASS_NAME}>
                <CalendarConnectCard
                  title="Connect Google Calendar"
                  hint="Keep your next meetings synced inside Minutes and jump into recording in one click."
                  buttonLabel="Connect Calendar"
                  onClick={onConnectCalendar}
                />
              </div>
            )}

            {calendarError === "needs_reconnect" && (
              <div className={CALENDAR_EMPTY_CLASS_NAME}>
                <CalendarConnectCard
                  title="Reconnect Google Calendar"
                  hint="Your calendar access expired. Reconnect once and OSCAR will keep upcoming meetings ready here."
                  buttonLabel="Reconnect"
                  onClick={onConnectCalendar}
                  warning
                />
              </div>
            )}

            {calendarError === "fetch_error" && (
              <div className={CALENDAR_EMPTY_CLASS_NAME}>
                <p className="m-0 text-sm font-medium text-slate-500">Couldn't load events</p>
                <p className="m-0 max-w-[300px] text-[0.8125rem] leading-[1.45] text-slate-400">
                  {calendarErrorMsg.includes("not been used") || calendarErrorMsg.includes("disabled")
                    ? "Enable the Google Calendar API in Cloud Console."
                    : calendarErrorMsg.includes("403") || calendarErrorMsg.includes("PERMISSION_DENIED")
                    ? "Permission denied — check Calendar API & OAuth scopes."
                    : calendarErrorMsg || "Check your internet connection."}
                </p>
                <button
                  className="mt-2 rounded-lg bg-cyan-500 px-[18px] py-2 text-[0.8125rem] font-semibold text-slate-900 transition-colors hover:bg-cyan-400 active:bg-cyan-600"
                  onClick={onConnectCalendar}
                  type="button"
                >
                  Reconnect
                </button>
              </div>
            )}

            {googleCalendarToken && !calendarError && !calendarLoading && (
              nextCalendarEvents.length === 0 ? (
                <div className={CALENDAR_EMPTY_CLASS_NAME}>
                  <p className="m-0 max-w-[300px] text-[0.8125rem] leading-[1.45] text-slate-400">No upcoming meetings on your calendar.</p>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22 }}
                >
                  {groupEventsByDay(nextCalendarEvents, currentTime).map((group) => (
                    <div key={group.key} className="mb-2">
                      <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-faint py-2">
                        {group.label}
                      </div>
                      {group.events.map((event, index) => (
                        <CalendarEventRow
                          key={`${event.title}-${event.start_at}-${index}`}
                          event={event}
                          onUse={startFromEvent}
                          isLive={isEventOngoing(event, currentTime)}
                        />
                      ))}
                    </div>
                  ))}
                </motion.div>
              )
            )}
          </div>

          {savedMeetings.length > 0 && (
            <div className="mt-9">
              <div className={SECTION_HEADER_CLASS_NAME}>
                <History size={11} />
                <span>Previous meetings · {savedMeetings.length}</span>
              </div>
              <div className="flex flex-col">
                {savedMeetings
                  .slice()
                  .sort(
                    (left, right) =>
                      new Date(right.startedAt).getTime() -
                      new Date(left.startedAt).getTime(),
                  )
                  .map((meeting) => {
                    const startDate = new Date(meeting.startedAt);
                    const dateMono = `${startDate
                      .toLocaleDateString(undefined, { weekday: "short" })
                      .toUpperCase()} · ${startDate.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}`;
                    const monthDay = startDate.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    });
                    return (
                      <button
                        key={meeting.id}
                        className="group grid grid-cols-12 gap-4 items-baseline w-full text-left py-5 border-b border-cream-300 bg-transparent border-l-0 border-r-0 border-t-0 cursor-pointer transition-colors hover:bg-cream-50"
                        onClick={() => {
                          setViewingSaved(meeting);
                          setResultTab("notes");
                          setPhase("view_saved");
                        }}
                        type="button"
                      >
                        <div className="col-span-3">
                          <span className="font-mono text-[12px] text-ink tracking-[0.02em]">
                            {dateMono}
                          </span>
                          <div className="mt-1 font-mono text-[10px] tracking-[0.16em] uppercase text-ink-faint">
                            MINUTES · {monthDay.toUpperCase()}
                          </div>
                        </div>
                        <div className="col-span-7 min-w-0">
                          <h3 className="font-serif text-[18px] font-medium text-ink leading-[1.2] tracking-[-0.005em]">
                            {meeting.meetingTitle}
                          </h3>
                          {meeting.attendeesCompact && (
                            <div className="mt-1 text-[12px] text-ink-soft leading-relaxed truncate">
                              {meeting.attendeesCompact}
                            </div>
                          )}
                          {meeting.notesMarkdown && (
                            <p className="mt-1 text-[12px] text-ink-faint leading-relaxed truncate">
                              {markdownPreview(meeting.notesMarkdown)}
                            </p>
                          )}
                        </div>
                        <div className="col-span-2 text-right">
                          <span className="font-mono text-[11px] tracking-[0.16em] uppercase text-terracotta opacity-0 group-hover:opacity-100 transition-opacity">
                            continue →
                          </span>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (phase === "view_saved" && viewingSaved) {
    return (
      <div className={MEETINGS_TAB_CLASS_NAME}>
        <div className={MEETINGS_CONTAINER_CLASS_NAME}>
          <button
            className="mb-4 inline-flex items-center gap-1 rounded-md bg-transparent px-2 py-1 pl-1 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            onClick={() => {
              setPhase("select");
              setViewingSaved(null);
            }}
            type="button"
          >
            <ChevronLeft size={16} /> Back
          </button>

          {systemAudioNotice}

          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h1 className={cn(MEETINGS_TITLE_CLASS_NAME, "mb-0")} style={GARAMOND_FONT_STYLE}>
                {viewingSaved.meetingTitle}
              </h1>
              <p className={cn(MEETINGS_SUBTITLE_CLASS_NAME, "mb-0")}>
                {viewingSaved.meetingLocalDatetime}
              </p>
            </div>
            <button
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cream-300 bg-transparent text-ink-faint transition-colors hover:border-[#8c2f25] hover:text-[#8c2f25] cursor-pointer"
              onClick={() => {
                onDeleteMeeting(viewingSaved.id);
                setPhase("select");
                setViewingSaved(null);
              }}
              title="Delete meeting"
              type="button"
            >
              <Trash2 size={14} />
            </button>
          </div>

          {viewingSaved.attendeesFull.length > 0 && (
            <div className={cn(PARTICIPANT_PILLS_CLASS_NAME, "mb-3")}>
              {viewingSaved.attendeesFull.map((attendee, index) => (
                <span key={`${attendeeLabel(attendee)}-${index}`} className={PARTICIPANT_PILL_CLASS_NAME}>
                  <span className={PARTICIPANT_PILL_TEXT_CLASS_NAME}>{attendeeLabel(attendee)}</span>
                </span>
              ))}
            </div>
          )}

          <div className={RESULT_TABS_CLASS_NAME}>
            <button
              className={cn(RESULT_TAB_CLASS_NAME, resultTab === "notes" && "border-b-terracotta text-terracotta")}
              onClick={() => setResultTab("notes")}
              type="button"
            >
              <FileText size={13} />
              Notes
            </button>
            <button
              className={cn(RESULT_TAB_CLASS_NAME, resultTab === "transcript" && "border-b-terracotta text-terracotta")}
              onClick={() => setResultTab("transcript")}
              type="button"
            >
              <Mic size={13} />
              Transcript
            </button>
          </div>

          {resultTab === "notes" && (
            <div>
              <div className="max-h-[460px] overflow-y-auto py-2 pr-1">
                <MarkdownNotesView markdown={viewingSaved.notesMarkdown} />
              </div>
              <div className="flex flex-col gap-2 border-t border-cream-300 pt-4 mt-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    className="inline-flex items-center gap-1.5 rounded-full bg-ink text-cream px-4 py-2 text-[12px] font-medium border-none cursor-pointer transition-opacity hover:opacity-90"
                    onClick={() => void handleCopy(viewingSaved.notesMarkdown)}
                    type="button"
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                  <button
                    className="inline-flex items-center gap-1.5 rounded-full border border-cream-300 bg-transparent text-ink-soft px-4 py-2 text-[12px] font-medium cursor-pointer transition-colors hover:text-ink hover:border-cream-400"
                    onClick={() =>
                      void handleShareByEmail({
                        subjectTitle: viewingSaved.meetingTitle,
                        attendeesFull: viewingSaved.attendeesFull,
                        markdown: viewingSaved.notesMarkdown,
                      })
                    }
                    type="button"
                  >
                    <Mail size={12} /> Email
                  </button>
                  <button
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border border-cream-300 bg-transparent text-ink-soft px-4 py-2 text-[12px] font-medium cursor-pointer transition-colors hover:text-ink hover:border-cream-400",
                      regenerating && "cursor-not-allowed opacity-60",
                    )}
                    onClick={() => void handleRegenerateSaved(viewingSaved)}
                    disabled={
                      regenerating ||
                      (viewingSaved.transcriptSegments.length === 0 &&
                        !viewingSaved.myNotesMarkdown.trim())
                    }
                    type="button"
                    title="Re-run the AI to regenerate notes from the transcript"
                  >
                    {regenerating ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <RefreshCw size={12} />
                    )}
                    {regenerating ? "Regenerating…" : "Regenerate"}
                  </button>
                </div>
                {regenerateError && (
                  <p className="m-0 text-[12px] text-[#8c2f25]">
                    {regenerateError}
                  </p>
                )}
              </div>
            </div>
          )}

          {resultTab === "transcript" && (
            <div className="p-0">
              <TranscriptView
                segments={viewingSaved.transcriptSegments}
                fallbackText={viewingSaved.transcript}
                labels={savedSpeakerLabels}
                emptyMessage="No transcript available."
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (phase === "recording") {
    const attendeeSummary = attendees.length > 0
      ? attendees.length <= 2
        ? attendees.map(attendeeLabel).join(", ")
        : `${attendeeLabel(attendees[0])}, ${attendeeLabel(attendees[1])} +${attendees.length - 2}`
      : null;

    return (
      <div className={cn(MEETINGS_TAB_CLASS_NAME, "relative pb-[160px]")}>
        <div className={MEETINGS_CONTAINER_CLASS_NAME}>
          {/* ── Compact header: back + title + meta ─────────────────────── */}
          <div className="mb-4 flex items-start gap-2">
            <button
              className="mt-0.5 inline-flex shrink-0 items-center justify-center rounded-md bg-transparent p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              onClick={handleBack}
              type="button"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="min-w-0 flex-1">
              <input
                className="w-full border-0 bg-transparent px-0 py-0 text-[1.05rem] font-semibold text-slate-800 outline-none placeholder:text-slate-400"
                type="text"
                placeholder="Meeting title"
                value={meetingTitle}
                onChange={(event) => setMeetingTitle(event.target.value)}
                style={FIGTREE_FONT_STYLE}
              />
              {/* Collapsed meta line: attendee count + meeting type */}
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[0.75rem] text-slate-400">
                {attendeeSummary && (
                  <button
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-600"
                    onClick={() => setShowAttendeeEditor((v) => !v)}
                    type="button"
                  >
                    <Users size={10} />
                    <span>{attendeeSummary}</span>
                  </button>
                )}
                {!attendeeSummary && (
                  <button
                    className="inline-flex items-center gap-1 text-slate-400 transition-colors hover:text-slate-500"
                    onClick={() => setShowAttendeeEditor((v) => !v)}
                    type="button"
                  >
                    <Users size={10} />
                    <span>Add participants</span>
                  </button>
                )}
                <MeetingTypePicker value={meetingTypeHint} onChange={setMeetingTypeHint} />
              </div>
            </div>
          </div>

          {/* ── Expandable attendee editor ──────────────────────────────── */}
          {showAttendeeEditor && (
            <motion.div
              className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.15 }}
            >
              <div className={cn(PARTICIPANT_PILLS_CLASS_NAME, "gap-1")}>
                {attendees.map((attendee, index) => (
                  <span key={`${attendeeLabel(attendee)}-${index}`} className={PARTICIPANT_PILL_CLASS_NAME}>
                    <span className={PARTICIPANT_PILL_TEXT_CLASS_NAME}>{attendeeLabel(attendee)}</span>
                    <button className={PARTICIPANT_PILL_REMOVE_CLASS_NAME} onClick={() => removeAttendee(index)} type="button">
                      <X size={10} />
                    </button>
                  </span>
                ))}
                <input
                  className="min-w-[100px] flex-1 border-0 bg-transparent px-0.5 py-0.5 text-[0.8125rem] text-slate-700 outline-none placeholder:text-slate-400"
                  type="text"
                  placeholder={attendees.length === 0 ? "Name or email, press Enter" : "Add more..."}
                  value={participantInput}
                  onChange={(event) => setParticipantInput(event.target.value)}
                  onKeyDown={handleParticipantKeyDown}
                  onBlur={handleParticipantBlur}
                  autoFocus
                  style={FIGTREE_FONT_STYLE}
                />
              </div>
            </motion.div>
          )}

          {systemAudioNotice}

          {/* ── Notes area (primary focus) ──────────────────────────────── */}
          <textarea
            className="min-h-[160px] w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-[1.65] text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-300"
            placeholder="Jot down key points, action items, or anything worth remembering..."
            value={manualNotes}
            onChange={(event) => setManualNotes(event.target.value)}
            rows={6}
          />

          {/* ── Live transcript (visible only while recording) ──────────── */}
          {isRecording && (
            <div className="mt-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-[0.75rem] font-medium text-slate-400">
                <Mic size={11} />
                <span>Live transcript</span>
                {minutesTranscriptionStatus === "transcribing" && (
                  <span className="inline-flex items-center gap-1 text-cyan-500">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-500 animate-pulse" />
                  </span>
                )}
              </div>
              <div
                ref={liveTranscriptScrollRef}
                className="max-h-[180px] min-h-[60px] overflow-y-auto rounded-lg bg-slate-50 px-3.5 py-2.5 text-[0.8125rem] leading-[1.65] text-gray-600"
              >
                {transcriptSegments.length > 0 || transcript.trim() ? (
                  <TranscriptTurns
                    segments={transcriptSegments}
                    fallbackText={transcript}
                    labels={liveSpeakerLabels}
                    compact
                  />
                ) : (
                  <span className="italic text-slate-300">Listening…</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Floating record control ────────────────────────────────── */}
        <div className="fixed bottom-6 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-4 rounded-full border border-slate-200 bg-white/95 px-5 py-2.5 shadow-[0_8px_30px_rgba(15,23,42,0.1)] backdrop-blur-sm">
          {isRecording && (
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-red-500 animate-pulse" />
              <span
                className="text-[1.1rem] font-semibold tracking-[0.02em] text-slate-700 [font-variant-numeric:tabular-nums]"
                style={FIGTREE_FONT_STYLE}
              >
                {formatTime(recordingTime)}
              </span>
            </div>
          )}
          <motion.button
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white transition-all duration-200",
              isRecording
                ? "bg-red-600 shadow-[0_2px_10px_rgba(220,38,38,0.25)] hover:bg-red-700"
                : "bg-cyan-600 shadow-[0_2px_10px_rgba(6,182,212,0.25)] hover:bg-cyan-700",
            )}
            onClick={isRecording ? handleStopRecording : onStartRecording}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            transition={{ duration: 0.15 }}
            type="button"
          >
            {isRecording ? <Square size={22} fill="currentColor" /> : <Mic size={22} />}
          </motion.button>
          {!isRecording && (
            <span className="text-[0.8125rem] font-medium text-slate-400">Tap to record</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={MEETINGS_TAB_CLASS_NAME}>
      <div className={MEETINGS_CONTAINER_CLASS_NAME}>
        {systemAudioNotice}

        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h1 className={cn(MEETINGS_TITLE_CLASS_NAME, "mb-0")} style={GARAMOND_FONT_STYLE}>
              {currentRequest.meeting_title || "Meeting Notes"}
            </h1>
            <p className={cn(MEETINGS_SUBTITLE_CLASS_NAME, "mb-0")}>
              {currentRequest.meeting_local_datetime}
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-cyan-50 px-3.5 py-1.5 text-[0.8125rem] font-medium text-cyan-600">
            <FileText size={12} />
            {MEETING_TYPE_OPTIONS.find((option) => option.value === meetingTypeHint)?.label ?? "Auto"}
          </div>
        </div>

        {attendees.length > 0 && (
          <div className={cn(PARTICIPANT_PILLS_CLASS_NAME, "mb-3")}>
            {attendees.map((attendee, index) => (
              <span key={`${attendeeLabel(attendee)}-${index}`} className={PARTICIPANT_PILL_CLASS_NAME}>
                <span className={PARTICIPANT_PILL_TEXT_CLASS_NAME}>{attendeeLabel(attendee)}</span>
                <button className={PARTICIPANT_PILL_REMOVE_CLASS_NAME} onClick={() => removeAttendee(index)} type="button">
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className={RESULT_TABS_CLASS_NAME}>
          <button
            className={cn(RESULT_TAB_CLASS_NAME, resultTab === "notes" && "border-b-cyan-600 text-cyan-600")}
            onClick={() => setResultTab("notes")}
            type="button"
          >
            <FileText size={13} />
            Notes
            {streaming && resultTab === "notes" && <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />}
          </button>
          <button
            className={cn(RESULT_TAB_CLASS_NAME, resultTab === "transcript" && "border-b-cyan-600 text-cyan-600")}
            onClick={() => setResultTab("transcript")}
            type="button"
          >
            <Mic size={13} />
            Transcript
          </button>
        </div>

        {resultTab === "notes" && (
          <>
            {phase === "processing" && !result && !error && (
              <div className="flex flex-col items-center gap-4 py-16">
                <Loader2 size={28} className="animate-spin" />
                <span className="text-[0.9375rem] font-medium text-slate-500">
                  {getScribblesLoadingLabel(
                    minutesTranscriptionStatus,
                    transcript,
                    minutesSegmentsCompleted,
                    minutesSegmentsTotal,
                    minutesSegmentQueue,
                  )}
                </span>
              </div>
            )}

            {(result || error) && (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                {error ? (
                  <div className="px-6 py-5 text-sm text-red-600">{error}</div>
                ) : (
                  <div className="max-h-[460px] overflow-y-auto px-6 py-5 text-sm leading-[1.75] text-slate-700">
                    <MarkdownNotesView markdown={result} />
                  </div>
                )}

                {!streaming && result && !error && (
                  <div className="flex gap-2 border-t border-slate-100 px-4 py-3">
                    <button
                      className={cn(FOOTER_BUTTON_CLASS_NAME, "border-cyan-600 bg-cyan-600 text-white hover:border-cyan-700 hover:bg-cyan-700")}
                      onClick={() => void handleCopy(result)}
                      type="button"
                    >
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                      {copied ? "Copied!" : "Copy"}
                    </button>
                    <button
                      className={cn(
                        FOOTER_BUTTON_CLASS_NAME,
                        !hasEmailableParticipants && "opacity-[0.45] hover:border-slate-200 hover:bg-white",
                      )}
                      onClick={() =>
                        void handleShareByEmail({
                          subjectTitle: currentRequest.meeting_title,
                          attendeesFull: currentRequest.attendees_full,
                          markdown: result,
                        })
                      }
                      title={hasEmailableParticipants ? "Open mail draft" : "Add emails to share"}
                      type="button"
                    >
                      <Mail size={12} /> Email
                    </button>
                    <button
                      className={FOOTER_BUTTON_CLASS_NAME}
                      onClick={() => {
                        setResult("");
                        setError("");
                        setPhase("processing");
                        void processTranscript();
                      }}
                      type="button"
                    >
                      <RotateCcw size={12} /> Retry
                    </button>
                    <button className={FOOTER_BUTTON_CLASS_NAME} onClick={handleNewMeeting} type="button">
                      <Mic size={12} /> New
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {resultTab === "transcript" && (
          <div className="p-0">
            <TranscriptView
              segments={transcriptSegments}
              fallbackText={transcript}
              labels={liveSpeakerLabels}
              emptyMessage="No transcript yet."
            />
          </div>
        )}
      </div>
    </div>
  );
}

interface TranscriptTurnsProps {
  segments: MeetingTranscriptSegment[];
  fallbackText: string;
  labels: SpeakerLabels;
  compact?: boolean;
}

function TranscriptTurns({
  segments,
  fallbackText,
  labels,
  compact = false,
}: TranscriptTurnsProps) {
  const turns: TranscriptTurn[] =
    segments.length > 0 ? groupSegmentsIntoTurns(segments, labels) : [];

  if (turns.length === 0) {
    const trimmed = fallbackText.trim();
    if (!trimmed) return null;
    return (
      <div className={cn("whitespace-pre-wrap", compact && "leading-[1.65]")}>
        <span className="mr-1 font-semibold text-slate-700">
          {labels.microphone}:
        </span>
        <span>{trimmed}</span>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", compact ? "gap-1.5" : "gap-3")}>
      {turns.map((turn, index) => (
        <div key={`${turn.startTime}-${index}`} className="whitespace-pre-wrap">
          <span
            className={cn(
              "mr-1 font-semibold",
              turn.source === "microphone" ? "text-cyan-700" : "text-slate-700",
            )}
          >
            {turn.label}:
          </span>
          <span>{turn.text}</span>
        </div>
      ))}
    </div>
  );
}

interface TranscriptViewProps {
  segments: MeetingTranscriptSegment[];
  fallbackText: string;
  labels: SpeakerLabels;
  emptyMessage: string;
}

function TranscriptView({
  segments,
  fallbackText,
  labels,
  emptyMessage,
}: TranscriptViewProps) {
  const hasContent = segments.length > 0 || fallbackText.trim().length > 0;

  if (!hasContent) {
    return (
      <div className="flex flex-col items-center gap-2 px-5 py-10 text-[0.8125rem] text-slate-400">
        <Mic size={20} />
        <span>{emptyMessage}</span>
      </div>
    );
  }

  return (
    <div className="max-h-[400px] overflow-y-auto rounded-lg bg-slate-50 px-3.5 py-3 text-[0.8125rem] leading-[1.65] text-gray-700">
      <TranscriptTurns
        segments={segments}
        fallbackText={fallbackText}
        labels={labels}
      />
    </div>
  );
}
