import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { buildMeetingContextPack, copyMarkdownAsRichText } from "@oscar/shared";
import { aiService } from "../services/ai.service";
import {
  Mic,
  MicOff,
  Copy,
  Check,
  RotateCcw,
  ChevronLeft,
  Loader2,
  Mail,
  X,
  Trash2,
  RefreshCw,
  Link2,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "../lib/utils";
import { markdownPreview, stripEvidenceComments } from "./MarkdownNotesView";
import {
  MinutesDistillView,
  parseMinutes,
  type ActionItem,
} from "./MinutesDistillView";
import { isAuthSessionError } from "../lib/auth-session";
import type { RoleModelDownloadState } from "../lib/app-types";
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
import { WEB_APP_URL } from "../lib/web-app-url";

const GOOGLE_CALENDAR_LOGO_URL =
  "https://cdn.brandfetch.io/id6O2oGzv-/theme/dark/idMX2_OMSc.svg?c=1bxid64Mup7aczewSAYMX&t=1755572706253";
const FIGTREE_FONT_STYLE = {
  fontFamily: '"Figtree", -apple-system, sans-serif',
} as const;
const GARAMOND_FONT_STYLE = {
  fontFamily: '"EB Garamond", Georgia, serif',
} as const;
const MEETINGS_TAB_CLASS_NAME = "flex flex-1 flex-col overflow-y-auto bg-cream";
const MEETINGS_CONTAINER_CLASS_NAME = "mx-auto w-full max-w-[1100px]";
const PARTICIPANT_PILL_CLASS_NAME =
  "inline-flex max-w-[220px] items-center gap-1.5 rounded-full border border-cream-300 bg-cream-200 px-2.5 py-[3px] pl-1 text-xs leading-[1.3] text-ink-soft";
const PARTICIPANT_PILL_TEXT_CLASS_NAME = "truncate";
const PARTICIPANT_PILL_REMOVE_CLASS_NAME =
  "flex size-4 shrink-0 items-center justify-center rounded-full p-0 text-ink-faint transition-colors hover:bg-cream-300 hover:text-ink";
const RESULT_TABS_CLASS_NAME =
  "mt-5 flex items-center gap-7 border-b border-cream-300";
const RESULT_TAB_CLASS_NAME =
  "pb-[10px] border-b-[1.5px] border-transparent bg-transparent font-mono text-[10px] tracking-[0.18em] uppercase text-ink-soft transition-colors hover:text-ink";
const RESULT_TAB_ACTIVE_CLASS_NAME = "border-b-terracotta text-terracotta";
const FOOTER_BUTTON_CLASS_NAME =
  "inline-flex items-center gap-1.5 rounded-full border border-cream-300 bg-transparent px-3.5 py-[7px] text-[12px] text-ink-soft transition-colors hover:border-cream-400 hover:bg-cream-50";
const FOOTER_BUTTON_PRIMARY_CLASS_NAME =
  "inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-[7px] text-[12px] text-cream transition-colors hover:bg-ink-night";

// Live public-link row, shown under a meeting's notes when the workspace has
// auto-publish on (so the row carries the same /m/{token} link the summary
// surfaces on web). Renders nothing for private meetings.
function MinutesShareLink({ meeting }: { meeting: SavedMeetingRecord }) {
  const [copied, setCopied] = useState(false);
  if (meeting.visibility !== "public" || !meeting.publicShareToken) return null;
  const url = `${WEB_APP_URL}/m/${meeting.publicShareToken}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };
  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cream-300 bg-cream-200 px-4 py-3">
      <div className="min-w-0">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
          Public link · anyone can read
        </span>
        <p
          className="mt-0.5 truncate text-[12px] text-ink-soft"
          style={{ maxWidth: 520 }}
        >
          {url}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => void copy()}
          className={FOOTER_BUTTON_CLASS_NAME}
        >
          {copied ? <Check size={11} /> : <Link2 size={11} />}
          {copied ? "Copied" : "Copy link"}
        </button>
        <button
          type="button"
          onClick={() => void openUrl(url)}
          className={FOOTER_BUTTON_CLASS_NAME}
        >
          Open
        </button>
      </div>
    </div>
  );
}

export type CalendarReconnectResult =
  | "refreshed"
  | "needs_reconnect"
  | "retry_later";
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
  /** True while the recorder is preparing (model download/load, system audio). */
  isPreparing?: boolean;
  /** Whisper "minutes" model download lifecycle, for the prepare-button label. */
  modelDownloadState?: RoleModelDownloadState;
  /** Download progress 0-100, shown while modelDownloadState === "downloading". */
  modelDownloadProgress?: number;
  /** Model download/prepare error message, surfaced when a start attempt fails. */
  modelDownloadError?: string | null;
  /**
   * Recover a dead/expired OSCAR session. Returns true if the session was
   * revalidated (caller may retry), false if re-auth is required.
   */
  onAuthError?: () => Promise<boolean>;
  onStartRecording: () => void;
  onStopRecording: () => void;
  /** True while the local mic is muted (system audio keeps recording). */
  isMuted?: boolean;
  /** Toggle the local mic mute. Other participants keep being captured. */
  onToggleMute?: () => void;
  /** True when system audio (other participants) is actually being captured. */
  isCapturingSystemAudio?: boolean;
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

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function V2Caps({
  children,
  accent = false,
  className,
}: {
  children: React.ReactNode;
  accent?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "font-mono text-[10px] tracking-[0.18em] uppercase",
        accent ? "text-terracotta" : "text-ink-faint",
        className,
      )}
    >
      {children}
    </span>
  );
}

function V2SectionCap({
  children,
  accent = false,
  right,
}: {
  children: React.ReactNode;
  accent?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center min-h-4">
      <V2Caps accent={accent}>{children}</V2Caps>
      {right && <span className="ml-auto">{right}</span>}
    </div>
  );
}

function V2PersonChip({
  name,
  size = 22,
  tone = "soft",
}: {
  name: string;
  size?: number;
  tone?: "soft" | "accent";
}) {
  const initial = (name || "·").trim().charAt(0).toUpperCase() || "·";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-serif font-medium leading-none",
        tone === "accent"
          ? "bg-terracotta text-cream"
          : "bg-terracotta-100 text-ink",
      )}
      style={{ width: size, height: size, fontSize: size * 0.5 }}
    >
      {initial}
    </span>
  );
}

function V2AttendeePill({
  name,
  onRemove,
}: {
  name: string;
  onRemove?: () => void;
}) {
  return (
    <span className={PARTICIPANT_PILL_CLASS_NAME}>
      <V2PersonChip name={name} size={18} />
      <span className={PARTICIPANT_PILL_TEXT_CLASS_NAME}>{name}</span>
      {onRemove && (
        <button
          className={PARTICIPANT_PILL_REMOVE_CLASS_NAME}
          onClick={onRemove}
          type="button"
        >
          <X size={10} />
        </button>
      )}
    </span>
  );
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
              ? "bg-terracotta-50 text-terracotta-600"
              : "text-ink-faint hover:bg-cream-200 hover:text-ink-soft",
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
        "flex w-full items-center justify-between gap-3.5 rounded-[14px] border border-cream-300 bg-cream px-3.5 py-3 max-md:flex-col max-md:items-start",
        warning && "border-orange-300 bg-cream-50",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <div
          className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] border border-slate-200 bg-slate-50"
          aria-hidden="true"
        >
          <img
            className="h-[18px] w-[18px] object-contain"
            src={GOOGLE_CALENDAR_LOGO_URL}
            alt=""
          />
        </div>
        <div className="flex min-w-0 flex-col gap-0.5 text-left">
          <p className="m-0 text-sm font-semibold text-slate-800">{title}</p>
          <p className="m-0 text-[0.7625rem] leading-[1.45] text-slate-500">
            {hint}
          </p>
        </div>
      </div>
      <button
        className="shrink-0 rounded-lg bg-terracotta-500 px-[18px] py-2 text-[0.8125rem] font-semibold text-cream transition-colors hover:bg-terracotta-600 active:bg-terracotta-700 max-md:w-full"
        onClick={onClick}
        type="button"
      >
        {buttonLabel}
      </button>
    </div>
  );
}

export function MeetingsTab({
  isRecording,
  isPreparing = false,
  modelDownloadState = "idle",
  modelDownloadProgress = 0,
  modelDownloadError = null,
  onAuthError,
  onStartRecording,
  onStopRecording,
  isMuted = false,
  onToggleMute,
  isCapturingSystemAudio = false,
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
  const [meetingTypeHint, setMeetingTypeHint] =
    useState<MeetingTypeHint>("auto");
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
  const [resultTab, setResultTab] = useState<"notes" | "transcript" | "rough">(
    "notes",
  );
  const [viewingSaved, setViewingSaved] = useState<SavedMeetingRecord | null>(
    null,
  );
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState("");
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [showAttendeeEditor, setShowAttendeeEditor] = useState(false);
  const [calendarError, setCalendarError] = useState<
    "needs_reconnect" | "fetch_error" | null
  >(null);
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
      liveTranscriptScrollRef.current.scrollTop =
        liveTranscriptScrollRef.current.scrollHeight;
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
    setAttendees((prev) =>
      prev.filter((_, currentIndex) => currentIndex !== index),
    );
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
            setCalendarErrorMsg(
              message.replace(/^Error:\s*/i, "").slice(0, 200),
            );
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

  // A live meeting session — actively recording, or the brief warm-up before
  // it. Keeps the meeting resumable from the Minutes list instead of being
  // ended when the user navigates away from the recording screen.
  const activeSession = isRecording || isPreparing;

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
      meetingTitle.trim() || selectedCalendarEvent?.title || "Untitled Meeting";
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

  // Stable identity for the meeting record across re-saves: the same row is
  // upserted first with empty notes (save-first), then again with the distilled
  // notes once enhance resolves. Kept in refs so re-renders never mint a new id
  // or reset the created-at stamp.
  const savedMeetingIdRef = useRef<string | null>(null);
  const savedCreatedAtRef = useRef<string>("");
  // Re-entrancy guard for processTranscript. persistMeeting() now saves during
  // the "processing" phase, and onSaveMeeting is a fresh closure on every App
  // render — so saving churns processTranscript's identity and re-fires the
  // finalization effect while phase is still "processing". Without this guard
  // that would launch duplicate (concurrent) enhance calls for one meeting.
  const processingRef = useRef(false);

  // Persist the meeting (raw transcript + whatever notes we have) to the Minutes
  // library. Idempotent on id, so it's safe to call repeatedly. This is the core
  // of the "never lose a recorded meeting" guarantee: a long recording is saved
  // BEFORE the AI distill step runs, so a 429 / quota / network failure can no
  // longer erase it — the notes simply stay empty until the user regenerates.
  const persistMeeting = useCallback(
    (notesMarkdown: string) => {
      const request = buildNoteRequest();
      const hasContent =
        request.transcript_segments.length > 0 ||
        transcript.trim().length > 0 ||
        request.my_notes_markdown.trim().length > 0 ||
        notesMarkdown.trim().length > 0;
      // Don't create an empty ghost record (no transcript, no notes, no result).
      if (!hasContent) return;

      const now = new Date().toISOString();
      if (!savedMeetingIdRef.current) {
        savedMeetingIdRef.current = `meeting_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 8)}`;
        savedCreatedAtRef.current = now;
      }

      const labeledTranscript =
        request.transcript_segments.length > 0
          ? buildLabeledTranscript(
              request.transcript_segments,
              liveSpeakerLabels,
            )
          : transcript;

      onSaveMeeting({
        id: savedMeetingIdRef.current,
        startedAt:
          selectedCalendarEvent?.start_at ||
          meetingStartedAt ||
          savedCreatedAtRef.current,
        meetingTitle: request.meeting_title,
        meetingLocalDatetime: request.meeting_local_datetime,
        attendeesCompact: request.attendees_compact,
        attendeesFull: request.attendees_full,
        calendarContext: request.calendar_context,
        meetingTypeHint: request.meeting_type_hint,
        transcript: labeledTranscript,
        transcriptSegments: request.transcript_segments,
        myNotesMarkdown: request.my_notes_markdown,
        notesMarkdown,
        createdAt: savedCreatedAtRef.current,
      });
    },
    [
      buildNoteRequest,
      liveSpeakerLabels,
      meetingStartedAt,
      onSaveMeeting,
      selectedCalendarEvent,
      transcript,
    ],
  );

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
              : buildFallbackTranscriptSegments(
                  saved.transcript,
                  saved.startedAt,
                ),
          meeting_type_hint: saved.meetingTypeHint,
        });
        const newMarkdown =
          await aiService.generateEnhancedMeetingNote(request);
        const updated: SavedMeetingRecord = {
          ...saved,
          notesMarkdown: newMarkdown,
        };
        onSaveMeeting(updated);
        setViewingSaved(updated);
      } catch (err) {
        setRegenerateError(err instanceof Error ? err.message : String(err));
      } finally {
        setRegenerating(false);
      }
    },
    [attachContextPack, onSaveMeeting, regenerating],
  );

  const processTranscript = useCallback(async () => {
    // Note: no early-return for the empty case. generateEnhancedMeetingNote
    // resolves a no-speech / no-notes meeting to an honest empty note, so we
    // still transition to the result screen rather than leaving the
    // "distilling…" screen spinning forever.
    if (processingRef.current) return;
    processingRef.current = true;
    setStreaming(true);
    setResult("");
    setError("");

    // Save-first: persist the raw transcript before the AI step so a 429 /
    // quota / network failure can never erase a recorded meeting. Only on the
    // first distill — a "Regenerate" re-run already has a saved record whose
    // notes we must not blank if this attempt fails.
    if (!savedMeetingIdRef.current) {
      persistMeeting("");
    }

    try {
      let processed: string;
      try {
        processed =
          await aiService.generateEnhancedMeetingNote(buildNoteRequest());
      } catch (firstError) {
        // A long meeting can outlive the access token; by distill time the
        // refresh token may already be rotated/dead. Mirror the dictation
        // path: try to recover the session once, then retry. If the session
        // can't be revalidated, onAuthError raises the sign-in screen and we
        // surface an actionable message instead of the raw auth error.
        if (!isAuthSessionError(firstError)) throw firstError;
        const recovered = (await onAuthError?.()) ?? false;
        if (!recovered) {
          throw new Error(
            "Your OSCAR session expired. Sign in again, then distill these minutes.",
          );
        }
        processed =
          await aiService.generateEnhancedMeetingNote(buildNoteRequest());
      }
      setResult(processed);
      // Fill the distilled notes into the already-saved record.
      persistMeeting(processed);
      setPhase("result");
    } catch (processingError) {
      setError(
        processingError instanceof Error
          ? processingError.message
          : String(processingError),
      );
      setPhase("result");
      // The raw transcript was saved up front (persistMeeting above), so the
      // meeting is safe in the Minutes library and can be regenerated once the
      // AI service recovers — nothing is lost.
    } finally {
      processingRef.current = false;
      setStreaming(false);
    }
  }, [
    buildNoteRequest,
    hasTranscriptInput,
    manualNotes,
    onAuthError,
    persistMeeting,
  ]);

  useEffect(() => {
    // Fire once finalization completes — even when nothing usable was
    // captured. processTranscript() resolves the empty case to an honest empty
    // note, so a silent meeting reaches the result screen instead of leaving
    // the "distilling…" screen spinning indefinitely.
    if (phase === "processing" && minutesTranscriptionStatus === "notes") {
      void processTranscript();
    }
  }, [minutesTranscriptionStatus, phase, processTranscript]);

  // The meeting is persisted by persistMeeting() inside processTranscript:
  // save-first with empty notes before the AI step, then again with the
  // distilled notes on success. No gated post-result save effect — that gate
  // (`!result || error`) was what discarded the transcript on an enhance
  // failure.

  const startFromEvent = (event: CalendarEvent) => {
    // Clear any prior recorder state (transcript, segments, and the elapsed
    // timer) before showing the fresh recording screen — otherwise the pill
    // would surface the previous meeting's time/segments until the next start.
    onClearTranscript();
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
    savedCreatedAtRef.current = "";
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
    const subject = encodeURIComponent(
      `Meeting Notes: ${subjectTitle || "Meeting"}`,
    );
    const body = encodeURIComponent(
      `Hi,\n\nPlease find the meeting notes below.\n\n---\n\n${stripEvidenceComments(markdown)}\n\n---\n\nGenerated by OSCAR`,
    );
    await openUrl(
      emails
        ? `mailto:${emails}?subject=${subject}&body=${body}`
        : `mailto:?subject=${subject}&body=${body}`,
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
    savedCreatedAtRef.current = "";
  };

  const handleNewMeeting = () => {
    resetDraftState();
    setViewingSaved(null);
    setPhase("select");
  };

  const handleBack = () => {
    // Leaving the recording screen must NOT end the meeting. While a session is
    // live (recording, or the brief warm-up before it), keep both the recorder
    // and the draft (title / attendees / rough notes) alive and just drop back
    // to the Minutes list — the resume banner there returns to the meeting.
    // Only clear the draft when nothing is in flight (idle / finished / error).
    if (isRecording || isPreparing) {
      setPhase("select");
      return;
    }
    resetDraftState();
    setPhase("select");
  };

  const currentRequest = buildNoteRequest();
  const hasEmailableParticipants = attendees.some((attendee) =>
    Boolean(attendee.email.trim()),
  );
  const nextCalendarEvents = calendarEvents
    .filter((event) => getEventTimestamp(event.end_at) >= currentTime)
    .sort(
      (a, b) => getEventTimestamp(a.start_at) - getEventTimestamp(b.start_at),
    )
    .slice(0, 5);

  const systemAudioNotice = systemAudioWarning ? (
    <div className="mb-4 rounded-xl border border-orange-300 bg-orange-50 px-3.5 py-3 text-[0.9rem] leading-[1.5] text-orange-800">
      {systemAudioWarning}
    </div>
  ) : null;

  // Full-surface gate for the recording screen while the (one-time, per-device)
  // transcription model is still being prepared/downloaded, or after a prepare
  // failure. Recording starts automatically once the model is ready, so the
  // happy path simply waits here; the error branch closes the silent-no-op hole
  // where startRecording bails but the phase stays "recording".
  const renderRecordingGate = () => {
    if (!isRecording && !isPreparing && modelDownloadState === "error") {
      return (
        <div className="flex flex-1 flex-col items-center justify-center px-8 py-16 text-center">
          <V2Caps accent>MINUTES · ENGINE UNAVAILABLE</V2Caps>
          <h2
            className="mt-3 max-w-[460px] font-serif text-[28px] font-medium leading-[1.15] text-ink"
            style={GARAMOND_FONT_STYLE}
          >
            Couldn&rsquo;t start the transcription model.
          </h2>
          <p className="mt-3 max-w-[440px] text-[14px] leading-relaxed text-ink-soft">
            {modelDownloadError ||
              "Check your connection and try again — the download resumes where it left off."}
          </p>
          <div className="mt-6 flex items-center gap-3">
            <button
              className={FOOTER_BUTTON_PRIMARY_CLASS_NAME}
              onClick={onStartRecording}
              type="button"
            >
              <RefreshCw size={13} /> Retry
            </button>
            <button
              className={FOOTER_BUTTON_CLASS_NAME}
              onClick={handleBack}
              type="button"
            >
              Back to Minutes
            </button>
          </div>
        </div>
      );
    }

    // Only take over the whole surface for a genuine model *download* (a
    // multi-second, once-per-device operation worth a progress screen). A warm
    // prepare (model already on disk — the common case now that we pre-download
    // on tab open) finishes sub-second; swapping the two-pane out for this gate
    // there just produces a jarring transient flash. That brief warm-up is
    // surfaced in the record pill ("Preparing…") instead.
    if (isPreparing && modelDownloadState === "downloading") {
      const pct = Math.max(0, Math.min(100, Math.round(modelDownloadProgress)));
      return (
        <div className="flex flex-1 flex-col items-center justify-center px-8 py-16 text-center">
          <V2Caps accent>MINUTES · PREPARING ENGINE</V2Caps>
          <h2
            className="mt-3 max-w-[480px] font-serif text-[28px] font-medium leading-[1.15] text-ink"
            style={GARAMOND_FONT_STYLE}
          >
            Getting the transcription model ready
          </h2>
          <p className="mt-3 max-w-[460px] text-[14px] leading-relaxed text-ink-soft">
            This downloads once per device, then it&rsquo;s instant. Recording
            starts automatically the moment it&rsquo;s ready.
          </p>
          <div className="mt-7 w-full max-w-[360px]">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-cream-300">
              <div
                className="h-full rounded-full bg-terracotta transition-[width] duration-300 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-2.5 flex items-center justify-center gap-1.5 font-mono text-[11px] text-ink-soft">
              <Loader2 size={12} className="animate-spin" />
              Downloading model · {pct}%
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  if (phase === "select") {
    const showEmptyState =
      !activeSession &&
      savedMeetings.length === 0 &&
      nextCalendarEvents.length === 0 &&
      !googleCalendarToken;

    if (showEmptyState) {
      return (
        <div className={MEETINGS_TAB_CLASS_NAME}>
          <div className={MEETINGS_CONTAINER_CLASS_NAME}>
            <main className="px-9 pt-12 pb-9">
              <V2Caps>MINUTES · NOTHING HERE YET</V2Caps>
              <h1
                className="mt-2 font-serif font-medium text-ink tracking-[-0.025em] text-[56px] leading-[0.98] max-w-[560px]"
                style={GARAMOND_FONT_STYLE}
              >
                What was <em className="italic text-terracotta">said</em>,
                <br />
                then <em className="italic text-terracotta">decided</em>.
              </h1>
              <p className="mt-5 max-w-md text-[14.5px] leading-relaxed text-ink-soft">
                Record a meeting. Keep your rough notes. Oscar turns both into a
                clean structured summary — decisions, actions, follow-ups, with
                the transcript right behind it.
              </p>

              {systemAudioNotice}

              <div className="mt-9 flex max-w-2xl items-center gap-5 rounded-2xl border border-cream-300 bg-cream-200 p-5">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-cream-300 bg-cream">
                  <img
                    className="h-6 w-6 object-contain"
                    src={GOOGLE_CALENDAR_LOGO_URL}
                    alt=""
                    aria-hidden="true"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <V2Caps>RECOMMENDED · 1 MIN</V2Caps>
                  <div
                    className="mt-1 font-serif text-[18px] font-medium text-ink"
                    style={GARAMOND_FONT_STYLE}
                  >
                    Connect Google Calendar
                  </div>
                  <div className="mt-0.5 text-[12.5px] text-ink-soft">
                    Your upcoming meetings show up here. One click to start
                    recording — titles and attendees come along.
                  </div>
                </div>
                <button
                  className="shrink-0 rounded-full bg-terracotta-500 px-[18px] py-[9px] text-[13px] font-medium text-cream transition-colors hover:bg-terracotta-600"
                  onClick={onConnectCalendar}
                  type="button"
                >
                  Connect
                </button>
              </div>

              <button
                className="mt-4 inline-flex items-center gap-1.5 text-[13px] text-ink-soft transition-colors hover:text-ink"
                onClick={() => {
                  resetDraftState();
                  setShowAttendeeEditor(true);
                }}
                type="button"
              >
                <span className="border-b border-cream-400">
                  Or start a meeting without a calendar
                </span>
                <span className="font-mono">→</span>
              </button>

              <div className="mt-12 grid max-w-3xl grid-cols-3 gap-7">
                {[
                  {
                    n: "01",
                    t: "You record",
                    d: "Tap a meeting on your calendar or start fresh. Oscar captures system + mic audio, labels speakers as they talk.",
                  },
                  {
                    n: "02",
                    t: "You scribble",
                    d: "Type rough notes in your own shorthand. Oscar reconciles them with the transcript when you stop.",
                  },
                  {
                    n: "03",
                    t: "You leave with the minutes",
                    d: "Decisions, actions with owners, follow-ups. Copy clean, email the room, or paste into Notion.",
                  },
                ].map((s) => (
                  <div key={s.n} className="border-t border-cream-400 pt-3.5">
                    <span className="font-mono text-[11px] tracking-[0.16em] text-terracotta">
                      {s.n}
                    </span>
                    <div
                      className="mt-1.5 font-serif text-[18px] font-medium text-ink tracking-[-0.005em]"
                      style={GARAMOND_FONT_STYLE}
                    >
                      {s.t}
                    </div>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">
                      {s.d}
                    </p>
                  </div>
                ))}
              </div>
            </main>
          </div>
        </div>
      );
    }

    const totalListened = savedMeetings.reduce((acc, m) => {
      const start = Date.parse(m.startedAt);
      const created = Date.parse(m.createdAt);
      if (
        Number.isFinite(start) &&
        Number.isFinite(created) &&
        created > start
      ) {
        return acc + (created - start);
      }
      return acc;
    }, 0);
    const listenedHours = Math.floor(totalListened / 3_600_000);
    const listenedMinutes = Math.floor((totalListened % 3_600_000) / 60_000);
    const listenedLabel =
      listenedHours > 0
        ? `${listenedHours} H ${listenedMinutes} M LISTENED`
        : listenedMinutes > 0
          ? `${listenedMinutes} M LISTENED`
          : "READY TO LISTEN";

    return (
      <div className={MEETINGS_TAB_CLASS_NAME}>
        <div className={MEETINGS_CONTAINER_CLASS_NAME}>
          {/* Resume banner — a live recording keeps running in the background
              when you leave the recording screen; this is the way back to it. */}
          {activeSession && (
            <div className="px-9 pt-6">
              <div className="flex items-center gap-4 rounded-2xl border border-terracotta-100 bg-terracotta-50 px-5 py-3.5">
                <span className="inline-flex shrink-0 items-center gap-2">
                  <span className="inline-block h-[7px] w-[7px] rounded-full bg-terracotta animate-pulse" />
                  <span className="font-mono text-[11px] tracking-[0.16em] text-terracotta">
                    {isRecording ? "RECORDING" : "PREPARING"}
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <div
                    className="truncate font-serif text-[16px] font-medium text-ink"
                    style={GARAMOND_FONT_STYLE}
                  >
                    {meetingTitle.trim() ||
                      selectedCalendarEvent?.title ||
                      "Untitled meeting"}
                  </div>
                  <div className="font-mono text-[11px] text-ink-faint">
                    {formatTime(recordingTime)} ·{" "}
                    {isMuted
                      ? isCapturingSystemAudio
                        ? "mic muted · others still recording"
                        : "mic muted · mic-only meeting"
                      : "still recording in the background"}
                  </div>
                </div>
                <button
                  className="shrink-0 rounded-full bg-ink px-4 py-[7px] text-[12px] font-medium text-cream transition-colors hover:bg-ink-night"
                  onClick={() => setPhase("recording")}
                  type="button"
                >
                  Resume
                </button>
                <button
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-terracotta px-4 py-[7px] text-[12px] font-medium text-cream transition-colors hover:bg-terracotta-600"
                  onClick={handleStopRecording}
                  type="button"
                >
                  <span className="inline-block h-2 w-2 bg-cream" /> Stop &amp;
                  distill
                </button>
              </div>
            </div>
          )}
          {/* hero */}
          <div className="px-9 pt-8 pb-7 border-b border-cream-300">
            <V2Caps>
              MINUTES · {savedMeetings.length} SAVED · {listenedLabel}
            </V2Caps>
            <div className="mt-1.5 flex items-end justify-between gap-6">
              <h1
                className="font-serif font-medium text-ink tracking-[-0.02em] text-[40px] leading-none"
                style={GARAMOND_FONT_STYLE}
              >
                What was <em className="italic text-terracotta">decided</em>.
              </h1>
              <div className="mb-1.5 flex items-center gap-2">
                {!activeSession && (
                  <button
                    className="inline-flex items-center gap-2 rounded-full bg-ink px-3.5 py-[7px] text-[12px] text-cream transition-colors hover:bg-ink-night"
                    onClick={() => {
                      resetDraftState();
                      setShowAttendeeEditor(true);
                      setPhase("recording");
                    }}
                    type="button"
                  >
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-terracotta" />
                    New meeting
                  </button>
                )}
              </div>
            </div>
          </div>

          {systemAudioNotice && (
            <div className="px-9 pt-4">{systemAudioNotice}</div>
          )}

          {/* coming up */}
          <section className="px-9 pt-6 pb-4">
            <V2SectionCap
              right={
                <V2Caps>
                  {googleCalendarToken
                    ? "GOOGLE CALENDAR · SYNCED"
                    : "CALENDAR NOT CONNECTED"}
                </V2Caps>
              }
            >
              COMING UP
            </V2SectionCap>

            {!googleCalendarToken && !calendarLoading && (
              <div className="mt-3">
                <CalendarConnectCard
                  title="Connect Google Calendar"
                  hint="Keep your next meetings synced inside Minutes and jump into recording in one click."
                  buttonLabel="Connect Calendar"
                  onClick={onConnectCalendar}
                />
              </div>
            )}

            {calendarError === "needs_reconnect" && (
              <div className="mt-3">
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
              <div className="mt-3 flex flex-col items-start gap-2">
                <p className="m-0 text-sm font-medium text-ink-soft">
                  Couldn't load events
                </p>
                <p className="m-0 max-w-[420px] text-[0.8125rem] leading-[1.45] text-ink-faint">
                  {calendarErrorMsg.includes("not been used") ||
                  calendarErrorMsg.includes("disabled")
                    ? "Enable the Google Calendar API in Cloud Console."
                    : calendarErrorMsg.includes("403") ||
                        calendarErrorMsg.includes("PERMISSION_DENIED")
                      ? "Permission denied — check Calendar API & OAuth scopes."
                      : calendarErrorMsg || "Check your internet connection."}
                </p>
                <button
                  className="rounded-full bg-terracotta-500 px-4 py-1.5 text-[12px] font-medium text-cream transition-colors hover:bg-terracotta-600"
                  onClick={onConnectCalendar}
                  type="button"
                >
                  Reconnect
                </button>
              </div>
            )}

            {googleCalendarToken &&
              !calendarError &&
              !calendarLoading &&
              (nextCalendarEvents.length === 0 ? (
                <p className="mt-3 text-[12.5px] text-ink-faint">
                  No upcoming meetings on your calendar.
                </p>
              ) : (
                <motion.div
                  className="mt-3"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22 }}
                >
                  {nextCalendarEvents.map((event, index) => {
                    const live = isEventOngoing(event, currentTime);
                    const dayLabel = live
                      ? "NOW"
                      : getEventDayLabel(event, currentTime).toUpperCase();
                    const attendeeText =
                      event.attendees.length === 1
                        ? "1 attendee"
                        : `${event.attendees.length} attendees`;
                    return (
                      <button
                        key={`${event.title}-${event.start_at}-${index}`}
                        className={cn(
                          "group grid w-full grid-cols-12 items-center gap-4 border-b border-cream-300 py-2.5 text-left transition-colors hover:bg-cream-50",
                          index === nextCalendarEvents.length - 1 &&
                            "border-b-0",
                        )}
                        onClick={() => startFromEvent(event)}
                        type="button"
                      >
                        <div className="col-span-3 flex items-center gap-3">
                          {live ? (
                            <span className="font-mono text-[11px] tracking-[0.16em] text-terracotta">
                              ● {dayLabel}
                            </span>
                          ) : (
                            <span className="font-mono text-[11px] tracking-[0.16em] text-ink-faint">
                              {dayLabel}
                            </span>
                          )}
                          <span className="font-mono text-[12px] text-ink">
                            {formatEventTimeRange(event)}
                          </span>
                        </div>
                        <div className="col-span-7">
                          <span
                            className="font-serif text-[16px] font-medium text-ink tracking-[-0.005em]"
                            style={GARAMOND_FONT_STYLE}
                          >
                            {event.title}
                          </span>
                          <span className="ml-3 text-[12px] text-ink-faint">
                            · {attendeeText}
                          </span>
                        </div>
                        <div className="col-span-2 text-right">
                          {live ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-terracotta px-3 py-1.5 text-[11px] font-medium text-cream">
                              <span className="inline-block h-[5px] w-[5px] rounded-full bg-cream" />
                              Record now
                            </span>
                          ) : (
                            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">
                              record →
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </motion.div>
              ))}
          </section>

          {/* previous */}
          {savedMeetings.length > 0 && (
            <section className="px-9 pt-6 pb-9">
              <V2SectionCap right={<V2Caps>SORTED BY RECENT</V2Caps>}>
                PREVIOUS · {savedMeetings.length} MEETING
                {savedMeetings.length === 1 ? "" : "S"}
              </V2SectionCap>
              <div className="mt-3">
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
                    const monthDay = startDate
                      .toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                      .toUpperCase();
                    const parsedCounts = parseMinutes(meeting.notesMarkdown);
                    const decCount = parsedCounts.decisions.length;
                    const actCount = parsedCounts.actions.length;
                    return (
                      <article
                        key={meeting.id}
                        onClick={() => {
                          setViewingSaved(meeting);
                          setResultTab("notes");
                          setPhase("view_saved");
                        }}
                        className="group grid cursor-pointer grid-cols-12 gap-4 border-b border-cream-300 py-4"
                      >
                        <div className="col-span-3">
                          <span className="font-mono text-[12px] text-ink">
                            {dateMono}
                          </span>
                          <span className="mt-0.5 block font-mono text-[10px] tracking-[0.16em] text-ink-faint">
                            MINUTES · {monthDay}
                          </span>
                        </div>
                        <div className="col-span-7 min-w-0">
                          <h3
                            className="font-serif text-[17px] font-medium text-ink tracking-[-0.005em] leading-[1.2]"
                            style={GARAMOND_FONT_STYLE}
                          >
                            {meeting.meetingTitle}
                          </h3>
                          {meeting.attendeesCompact && (
                            <div className="mt-1 text-[11.5px] text-ink-faint">
                              {meeting.attendeesCompact}
                            </div>
                          )}
                          {meeting.notesMarkdown ? (
                            <p className="mt-1 truncate text-[12px] leading-relaxed text-ink-soft">
                              {markdownPreview(meeting.notesMarkdown)}
                            </p>
                          ) : (
                            <p className="mt-1 font-mono text-[11px] tracking-[0.04em] text-terracotta">
                              Transcript saved · notes not generated — open to
                              regenerate
                            </p>
                          )}
                        </div>
                        <div className="col-span-2 flex flex-col items-end justify-center gap-1 text-right">
                          {decCount > 0 && (
                            <span className="font-mono text-[11px] text-terracotta">
                              {decCount} decision{decCount === 1 ? "" : "s"}
                            </span>
                          )}
                          {actCount > 0 && (
                            <span className="font-mono text-[11px] text-ink-faint">
                              {actCount} action{actCount === 1 ? "" : "s"}
                            </span>
                          )}
                        </div>
                      </article>
                    );
                  })}
              </div>
            </section>
          )}
        </div>
      </div>
    );
  }

  if (phase === "view_saved" && viewingSaved) {
    const savedParsed = parseMinutes(viewingSaved.notesMarkdown);
    const hasSavedNotes = viewingSaved.notesMarkdown.trim().length > 0;
    const savedTurnCount =
      viewingSaved.transcriptSegments.length > 0
        ? groupSegmentsIntoTurns(
            viewingSaved.transcriptSegments,
            savedSpeakerLabels,
          ).length
        : 0;
    const savedDateLabel = viewingSaved.meetingLocalDatetime;

    return (
      <div className={MEETINGS_TAB_CLASS_NAME}>
        <div className={MEETINGS_CONTAINER_CLASS_NAME}>
          {/* header */}
          <div className="px-9 pt-7 pb-5 border-b border-cream-300">
            <div className="flex items-center gap-2.5">
              <button
                className="inline-flex items-center gap-2 text-ink-faint transition-colors hover:text-ink"
                onClick={() => {
                  setPhase("select");
                  setViewingSaved(null);
                }}
                type="button"
              >
                <ChevronLeft size={13} />
                <V2Caps>BACK TO MINUTES</V2Caps>
              </button>
              <span className="ml-auto inline-flex items-center gap-3">
                <span className="font-mono text-[11px] text-ink-faint">
                  {savedDateLabel}
                </span>
                <button
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-cream-300 bg-transparent text-ink-faint transition-colors hover:border-[#8c2f25] hover:text-[#8c2f25]"
                  onClick={() => {
                    onDeleteMeeting(viewingSaved.id);
                    setPhase("select");
                    setViewingSaved(null);
                  }}
                  title="Delete meeting"
                  type="button"
                >
                  <Trash2 size={12} />
                </button>
              </span>
            </div>
            <h1
              className="mt-3 font-serif text-[32px] font-medium tracking-[-0.015em] leading-[1.05] text-ink"
              style={GARAMOND_FONT_STYLE}
            >
              {viewingSaved.meetingTitle}
            </h1>
            {viewingSaved.attendeesFull.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {viewingSaved.attendeesFull.map((attendee, index) => (
                  <V2AttendeePill
                    key={`${attendeeLabel(attendee)}-${index}`}
                    name={attendeeLabel(attendee)}
                  />
                ))}
              </div>
            )}

            {systemAudioNotice && (
              <div className="mt-3">{systemAudioNotice}</div>
            )}

            <div className={RESULT_TABS_CLASS_NAME}>
              <button
                className={cn(
                  RESULT_TAB_CLASS_NAME,
                  resultTab === "notes" && RESULT_TAB_ACTIVE_CLASS_NAME,
                )}
                onClick={() => setResultTab("notes")}
                type="button"
              >
                NOTES
              </button>
              <button
                className={cn(
                  RESULT_TAB_CLASS_NAME,
                  resultTab === "transcript" && RESULT_TAB_ACTIVE_CLASS_NAME,
                )}
                onClick={() => setResultTab("transcript")}
                type="button"
              >
                TRANSCRIPT
                {savedTurnCount > 0 && ` · ${savedTurnCount} TURNS`}
              </button>
              <button
                className={cn(
                  RESULT_TAB_CLASS_NAME,
                  resultTab === "rough" && RESULT_TAB_ACTIVE_CLASS_NAME,
                )}
                onClick={() => setResultTab("rough")}
                type="button"
              >
                YOUR ROUGH NOTES
              </button>
            </div>
          </div>

          {/* body */}
          {resultTab === "notes" && (
            <section className="px-9 pt-7 pb-6">
              {hasSavedNotes ? (
                <>
                  <MinutesDistillView markdown={viewingSaved.notesMarkdown} />
                  <MinutesShareLink meeting={viewingSaved} />
                </>
              ) : (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <p
                    className="font-serif text-[17px] text-ink"
                    style={GARAMOND_FONT_STYLE}
                  >
                    Notes weren&rsquo;t generated for this meeting
                  </p>
                  <p className="max-w-md text-[12.5px] leading-relaxed text-ink-soft">
                    The transcript is saved safely — see the Transcript tab.
                    Press Regenerate below to distill the minutes, useful when
                    the AI step hit a temporary limit during recording.
                  </p>
                </div>
              )}
            </section>
          )}

          {resultTab === "transcript" && (
            <section className="px-9 pt-7 pb-6">
              <TranscriptTurnsRich
                segments={viewingSaved.transcriptSegments}
                fallbackText={viewingSaved.transcript}
                labels={savedSpeakerLabels}
                emptyMessage="No transcript available."
                annotatedDecisions={savedParsed.decisions}
                annotatedActions={savedParsed.actions}
              />
            </section>
          )}

          {resultTab === "rough" && (
            <section className="px-9 pt-7 pb-6">
              <V2SectionCap>YOUR ROUGH NOTES</V2SectionCap>
              <div
                className="mt-4 whitespace-pre-wrap font-serif text-[15.5px] leading-[1.6] text-ink"
                style={GARAMOND_FONT_STYLE}
              >
                {viewingSaved.myNotesMarkdown.trim() || (
                  <span className="italic text-ink-faint">
                    No rough notes were saved with this meeting.
                  </span>
                )}
              </div>
            </section>
          )}

          {/* footer */}
          <div className="border-t border-cream-300 px-9 py-5 flex items-center gap-2">
            <button
              className={cn(
                FOOTER_BUTTON_PRIMARY_CLASS_NAME,
                !hasSavedNotes && "cursor-not-allowed opacity-50",
              )}
              onClick={() => void handleCopy(viewingSaved.notesMarkdown)}
              disabled={!hasSavedNotes}
              type="button"
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
              {copied ? "Copied" : "Copy clean"}
            </button>
            <button
              className={cn(
                FOOTER_BUTTON_CLASS_NAME,
                !hasSavedNotes && "cursor-not-allowed opacity-50",
              )}
              onClick={() =>
                void handleShareByEmail({
                  subjectTitle: viewingSaved.meetingTitle,
                  attendeesFull: viewingSaved.attendeesFull,
                  markdown: viewingSaved.notesMarkdown,
                })
              }
              disabled={!hasSavedNotes}
              type="button"
            >
              <Mail size={11} />
              Email to attendees
            </button>
            <button
              className={cn(
                FOOTER_BUTTON_CLASS_NAME,
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
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <RefreshCw size={11} />
              )}
              {regenerating ? "Regenerating…" : "Regenerate"}
            </button>
            <span className="ml-auto inline-flex items-center gap-3">
              <V2Caps>SAVED · MINUTES LIBRARY</V2Caps>
            </span>
          </div>

          {regenerateError && (
            <div className="px-9 pb-5">
              <p className="m-0 text-[12px] text-[#8c2f25]">
                {regenerateError}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (phase === "recording") {
    const meetingDateLabel = (() => {
      const value = meetingStartedAt || selectedCalendarEvent?.start_at || "";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "";
      const weekday = date
        .toLocaleDateString(undefined, { weekday: "short" })
        .toUpperCase();
      const monthDay = date
        .toLocaleDateString(undefined, { month: "short", day: "numeric" })
        .toUpperCase();
      const time = date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      return `${weekday} · ${monthDay} · ${time}`;
    })();
    const meetingTypeLabel =
      MEETING_TYPE_OPTIONS.find((option) => option.value === meetingTypeHint)
        ?.label ?? "Auto";
    const recordingGate = renderRecordingGate();

    return (
      <div className="relative flex flex-1 flex-col overflow-hidden bg-cream">
        <div
          className={cn(
            MEETINGS_CONTAINER_CLASS_NAME,
            "flex flex-1 flex-col overflow-hidden",
          )}
        >
          {/* header */}
          <div className="px-8 pt-6 pb-4 border-b border-cream-300">
            <div className="flex items-center gap-2.5">
              <button
                className="inline-flex items-center gap-2 text-ink-faint transition-colors hover:text-ink"
                onClick={handleBack}
                type="button"
              >
                <ChevronLeft size={14} />
                <V2Caps>BACK TO MINUTES</V2Caps>
              </button>
              <span className="ml-auto inline-flex items-center gap-1.5">
                {isRecording ? (
                  <>
                    <span
                      className={cn(
                        "inline-block h-[7px] w-[7px] rounded-full",
                        isMuted
                          ? "bg-ink-faint"
                          : "bg-terracotta animate-pulse",
                      )}
                    />
                    <span
                      className={cn(
                        "font-mono text-[11px]",
                        isMuted ? "text-ink-faint" : "text-terracotta",
                      )}
                    >
                      {isMuted ? "MIC MUTED" : "RECORDING"} ·{" "}
                      {formatTime(recordingTime)}
                    </span>
                  </>
                ) : (
                  <span className="font-mono text-[11px] text-ink-faint">
                    READY TO RECORD
                  </span>
                )}
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-3">
              <input
                className="min-w-0 flex-1 border-0 bg-transparent p-0 font-serif text-[26px] font-medium leading-[1.1] tracking-[-0.01em] text-ink outline-none placeholder:text-ink-faint"
                style={GARAMOND_FONT_STYLE}
                type="text"
                placeholder="Untitled meeting"
                value={meetingTitle}
                onChange={(event) => setMeetingTitle(event.target.value)}
              />
              {meetingDateLabel && (
                <span className="font-mono text-[11px] text-ink-faint">
                  {meetingDateLabel}
                </span>
              )}
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {attendees.map((attendee, index) => (
                <V2AttendeePill
                  key={`${attendeeLabel(attendee)}-${index}`}
                  name={attendeeLabel(attendee)}
                  onRemove={() => removeAttendee(index)}
                />
              ))}
              <button
                className="inline-flex items-center gap-1 text-[11px] text-ink-faint transition-colors hover:text-ink-soft"
                onClick={() => setShowAttendeeEditor((v) => !v)}
                type="button"
              >
                · + add
              </button>
              <span className="ml-auto inline-flex items-center gap-2 rounded-full border border-cream-300 bg-cream-200 px-2.5 py-[3px] text-[11px] text-ink-soft">
                Type:
                <span className="font-medium text-ink">{meetingTypeLabel}</span>
                <MeetingTypePicker
                  value={meetingTypeHint}
                  onChange={setMeetingTypeHint}
                />
              </span>
            </div>
            {showAttendeeEditor && (
              <motion.div
                className="mt-2.5 rounded-xl border border-cream-300 bg-cream-50 px-3 py-2"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                transition={{ duration: 0.15 }}
              >
                <input
                  className="w-full border-0 bg-transparent p-1 text-[12px] text-ink outline-none placeholder:text-ink-faint"
                  type="text"
                  placeholder={
                    attendees.length === 0
                      ? "Name or email, press Enter"
                      : "Add another participant"
                  }
                  value={participantInput}
                  onChange={(event) => setParticipantInput(event.target.value)}
                  onKeyDown={handleParticipantKeyDown}
                  onBlur={handleParticipantBlur}
                  autoFocus
                  style={FIGTREE_FONT_STYLE}
                />
              </motion.div>
            )}
          </div>

          {systemAudioNotice && (
            <div className="px-8 pt-3">{systemAudioNotice}</div>
          )}

          {/* two-pane: notes | live transcript — replaced by the prepare /
              download gate while the model isn't ready yet */}
          {recordingGate ? (
            recordingGate
          ) : (
            <div className="grid flex-1 grid-cols-12 overflow-hidden">
              <div className="col-span-6 overflow-auto px-8 py-6 border-r border-cream-300">
                <V2SectionCap>YOUR ROUGH NOTES · LIVE</V2SectionCap>
                <textarea
                  className="mt-4 w-full resize-none border-0 bg-transparent p-0 font-serif text-[16px] leading-[1.55] text-ink outline-none placeholder:text-ink-faint min-h-[400px]"
                  style={GARAMOND_FONT_STYLE}
                  placeholder="Type your shorthand. Oscar will reconcile both sides into the minutes."
                  value={manualNotes}
                  onChange={(event) => setManualNotes(event.target.value)}
                />
              </div>
              <div className="col-span-6 overflow-auto bg-cream-200 px-7 py-6">
                <V2SectionCap
                  accent
                  right={
                    <span className="font-mono text-[10px] tracking-[0.16em] text-terracotta">
                      {transcriptSegments.length > 0
                        ? `${
                            new Set(
                              transcriptSegments.map(
                                (s) => s.speaker?.source ?? "?",
                              ),
                            ).size
                          } SPEAKER${
                            new Set(
                              transcriptSegments.map(
                                (s) => s.speaker?.source ?? "?",
                              ),
                            ).size === 1
                              ? ""
                              : "S"
                          } DETECTED`
                        : isRecording
                          ? isMuted
                            ? isCapturingSystemAudio
                              ? "MIC MUTED · OTHERS LIVE"
                              : "MIC MUTED · MIC ONLY"
                            : "LISTENING…"
                          : ""}
                    </span>
                  }
                >
                  LIVE TRANSCRIPT · ORACLE WHISPER
                </V2SectionCap>
                <div ref={liveTranscriptScrollRef} className="mt-4 space-y-3.5">
                  {transcriptSegments.length > 0 || transcript.trim() ? (
                    <LiveTranscriptTurns
                      segments={transcriptSegments}
                      fallbackText={transcript}
                      labels={liveSpeakerLabels}
                      isLive={isRecording}
                    />
                  ) : (
                    <p
                      className="font-serif italic text-ink-faint"
                      style={GARAMOND_FONT_STYLE}
                    >
                      {isRecording
                        ? "Listening…"
                        : "Hit record to start capturing the conversation."}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* floating record pill — hidden while the prepare/download gate owns the surface */}
        {!recordingGate && (
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 flex justify-center pb-6">
            <div className="pointer-events-auto inline-flex items-center gap-3 rounded-full bg-ink py-2 pl-[18px] pr-2 text-cream shadow-[0_12px_32px_rgba(15,13,10,0.22)]">
              {/* waveform */}
              <div className="flex items-center gap-[2px] h-4">
                {Array.from({ length: 18 }).map((_, i) => {
                  const base = 3 + Math.abs(Math.sin(i * 0.7 + 1.2)) * 12;
                  const live = isRecording && !isMuted;
                  const h = live ? base : base * 0.4;
                  return (
                    <span
                      key={i}
                      className="rounded-[1px] bg-terracotta"
                      style={{
                        width: 2,
                        height: h,
                        opacity: live ? 0.6 + (i / 18) * 0.4 : 0.3,
                        transition: "height 200ms ease",
                      }}
                    />
                  );
                })}
              </div>
              <span className="font-mono text-[12px] text-cream">
                {formatTime(recordingTime)}
              </span>
              {isRecording && onToggleMute && (
                <button
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors",
                    isMuted
                      ? "bg-terracotta text-cream hover:bg-terracotta-600"
                      : "bg-cream/15 text-cream hover:bg-cream/25",
                  )}
                  onClick={onToggleMute}
                  type="button"
                  aria-pressed={isMuted}
                  aria-label="Toggle microphone mute"
                  title={
                    isMuted
                      ? isCapturingSystemAudio
                        ? "Your mic is muted. Other participants are still being recorded — click to unmute."
                        : "Your mic is muted. This is a mic-only meeting, so nothing is captured while muted — click to unmute."
                      : isCapturingSystemAudio
                        ? "Mute your mic. Other participants (system audio) keep recording."
                        : "Mute your mic."
                  }
                >
                  {isMuted ? <MicOff size={11} /> : <Mic size={11} />}
                  {isMuted ? "Muted" : "Mute"}
                </button>
              )}
              {isRecording ? (
                <button
                  className="inline-flex items-center gap-1.5 rounded-full bg-terracotta px-3.5 py-1.5 text-[11px] font-medium text-cream transition-colors hover:bg-terracotta-600"
                  onClick={handleStopRecording}
                  type="button"
                >
                  <span className="inline-block h-2 w-2 bg-cream" /> Stop &
                  distill
                </button>
              ) : isPreparing ? (
                <button
                  className="inline-flex items-center gap-1.5 rounded-full bg-terracotta px-3.5 py-1.5 text-[11px] font-medium text-cream opacity-70 cursor-default"
                  disabled
                  type="button"
                >
                  <Loader2 size={11} className="animate-spin" />{" "}
                  Preparing&hellip;
                </button>
              ) : (
                <button
                  className="inline-flex items-center gap-1.5 rounded-full bg-terracotta px-3.5 py-1.5 text-[11px] font-medium text-cream transition-colors hover:bg-terracotta-600"
                  onClick={onStartRecording}
                  type="button"
                >
                  <Mic size={11} /> Start recording
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (phase === "processing") {
    const segTotal = Math.max(
      minutesSegmentsTotal,
      minutesSegmentsCompleted + minutesSegmentQueue,
    );
    const segDone = segTotal > 0 && minutesSegmentsCompleted >= segTotal;
    const transcribing =
      minutesTranscriptionStatus === "transcribing" ||
      minutesTranscriptionStatus === "finalizing";
    const distinctSpeakers = new Set(
      transcriptSegments.map((s) => s.speaker?.source ?? "?"),
    ).size;
    const speakerNames =
      attendees.map(attendeeLabel).filter(Boolean).slice(0, 5).join(", ") ||
      "—";
    const roughLineCount = manualNotes
      .split(/\r?\n/)
      .filter((l) => l.trim()).length;

    type StepState = "done" | "doing" | "pending";
    const steps: Array<{ state: StepState; label: string; meta: string }> = [
      {
        state:
          segDone || (!transcribing && transcriptSegments.length > 0)
            ? "done"
            : transcribing
              ? "doing"
              : "pending",
        label:
          segTotal > 0
            ? `Transcribed ${Math.min(minutesSegmentsCompleted, segTotal)} of ${segTotal} segments`
            : "Transcribing audio",
        meta: recordingTime ? `${formatTime(recordingTime)} of audio` : "",
      },
      {
        state: distinctSpeakers > 0 ? (segDone ? "done" : "doing") : "pending",
        label: distinctSpeakers
          ? `Resolved ${distinctSpeakers} speaker${distinctSpeakers === 1 ? "" : "s"}`
          : "Resolving speakers",
        meta: speakerNames,
      },
      {
        state: manualNotes.trim()
          ? streaming || result
            ? "done"
            : "doing"
          : "pending",
        label: manualNotes.trim()
          ? "Reconciled with your rough notes"
          : "No rough notes — using transcript only",
        meta: manualNotes.trim()
          ? `${roughLineCount} line${roughLineCount === 1 ? "" : "s"} · merged`
          : "",
      },
      {
        state: result ? "done" : streaming ? "doing" : "pending",
        label: "Naming the decisions",
        meta: streaming && !result ? "reading for intent…" : "",
      },
      {
        state: result ? "done" : streaming ? "doing" : "pending",
        label: "Drafting action items with owners",
        meta: "",
      },
      {
        state: result ? "done" : streaming ? "doing" : "pending",
        label: "Listing follow-ups",
        meta: "",
      },
    ];
    const transcribedDuration = recordingTime
      ? formatTime(recordingTime)
      : "your meeting";

    return (
      <div className={MEETINGS_TAB_CLASS_NAME}>
        <div className={MEETINGS_CONTAINER_CLASS_NAME}>
          <main className="flex min-h-full items-center justify-center px-9 py-12">
            <div className="w-[540px]">
              <V2Caps accent>
                JUST FINISHED · LISTENING TO {transcribedDuration} OF YOU
              </V2Caps>
              <h1
                className="mt-3 font-serif text-[44px] font-medium tracking-[-0.02em] leading-none text-ink"
                style={GARAMOND_FONT_STYLE}
              >
                A moment, while
                <br />
                Oscar <em className="italic text-terracotta">distills</em>.
              </h1>
              <p className="mt-5 text-[14px] leading-relaxed text-ink-soft">
                Your rough notes are safe. The transcript is saved. You can
                close this window and come back — the meeting will be in your
                library when it&rsquo;s done.
              </p>

              {error && (
                <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
                  {error}
                </p>
              )}

              <div className="mt-8 border-y border-cream-300">
                {steps.map((s, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-start gap-4 py-3",
                      i > 0 && "border-t border-cream-300",
                    )}
                  >
                    <div className="mt-0.5 flex w-4 shrink-0 items-center justify-center">
                      {s.state === "done" && (
                        <Check
                          size={13}
                          className="text-ink-soft"
                          strokeWidth={1.6}
                        />
                      )}
                      {s.state === "doing" && (
                        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-terracotta" />
                      )}
                      {s.state === "pending" && (
                        <span className="inline-block h-[5px] w-[5px] rounded-full bg-cream-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div
                        className={cn(
                          "text-[14px]",
                          s.state === "pending" ? "text-ink-faint" : "text-ink",
                          s.state === "doing" && "font-medium",
                        )}
                      >
                        {s.label}
                        {s.state === "doing" && (
                          <span
                            className="ml-1 inline-block animate-pulse bg-terracotta align-[-1px]"
                            style={{ width: 6, height: 12 }}
                          />
                        )}
                      </div>
                      {s.meta && (
                        <div className="mt-0.5 font-mono text-[10.5px] tracking-[0.06em] text-ink-faint">
                          {s.meta}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex items-center gap-3">
                <span className="font-mono text-[11px] tracking-[0.16em] text-ink-faint">
                  {result
                    ? "ALMOST DONE"
                    : streaming
                      ? "DISTILLING…"
                      : transcribing
                        ? "TRANSCRIBING…"
                        : "QUEUED"}
                </span>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // ─── RESULT ──────────────────────────────────────────────────────────
  const resultParsed = result ? parseMinutes(result) : null;
  const resultDateLabel = currentRequest.meeting_local_datetime;
  const finishedDuration = recordingTime ? formatTime(recordingTime) : "";
  const transcriptTurnCount =
    transcriptSegments.length > 0
      ? groupSegmentsIntoTurns(transcriptSegments, liveSpeakerLabels).length
      : 0;

  return (
    <div className={MEETINGS_TAB_CLASS_NAME}>
      <div className={MEETINGS_CONTAINER_CLASS_NAME}>
        {/* header */}
        <div className="px-9 pt-7 pb-5 border-b border-cream-300">
          <div className="flex items-center gap-2.5">
            <button
              className="inline-flex items-center gap-2 text-ink-faint transition-colors hover:text-ink"
              onClick={handleBack}
              type="button"
            >
              <ChevronLeft size={13} />
              <V2Caps>BACK TO MINUTES</V2Caps>
            </button>
            {result && finishedDuration && (
              <V2Caps accent>· JUST FINISHED · {finishedDuration}</V2Caps>
            )}
            <span className="ml-auto inline-flex items-center gap-1.5">
              <span className="font-mono text-[11px] text-ink-faint">
                {resultDateLabel}
              </span>
            </span>
          </div>
          <h1
            className="mt-3 font-serif text-[32px] font-medium tracking-[-0.015em] leading-[1.05] text-ink"
            style={GARAMOND_FONT_STYLE}
          >
            {currentRequest.meeting_title || "Meeting Notes"}
          </h1>
          {attendees.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {attendees.map((attendee, index) => (
                <V2AttendeePill
                  key={`${attendeeLabel(attendee)}-${index}`}
                  name={attendeeLabel(attendee)}
                />
              ))}
            </div>
          )}

          {systemAudioNotice && <div className="mt-3">{systemAudioNotice}</div>}

          {/* tab bar */}
          <div className={RESULT_TABS_CLASS_NAME}>
            <button
              className={cn(
                RESULT_TAB_CLASS_NAME,
                resultTab === "notes" && RESULT_TAB_ACTIVE_CLASS_NAME,
              )}
              onClick={() => setResultTab("notes")}
              type="button"
            >
              NOTES
            </button>
            <button
              className={cn(
                RESULT_TAB_CLASS_NAME,
                resultTab === "transcript" && RESULT_TAB_ACTIVE_CLASS_NAME,
              )}
              onClick={() => setResultTab("transcript")}
              type="button"
            >
              TRANSCRIPT
              {transcriptTurnCount > 0 && ` · ${transcriptTurnCount} TURNS`}
            </button>
            <button
              className={cn(
                RESULT_TAB_CLASS_NAME,
                resultTab === "rough" && RESULT_TAB_ACTIVE_CLASS_NAME,
              )}
              onClick={() => setResultTab("rough")}
              type="button"
            >
              YOUR ROUGH NOTES
            </button>
          </div>
        </div>

        {/* body */}
        {resultTab === "notes" && (
          <section className="px-9 pt-7 pb-6">
            {error && (
              <div className="mb-4 space-y-3">
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
                  {error}
                </div>
                <div className="rounded-md border border-cream-300 bg-cream-50 px-3 py-2 text-[12.5px] leading-relaxed text-ink-soft">
                  Your transcript is saved to the Minutes library — nothing was
                  lost. You can view it in the Transcript tab and regenerate
                  these notes anytime once the service recovers.
                </div>
                <button
                  className={FOOTER_BUTTON_PRIMARY_CLASS_NAME}
                  onClick={() => {
                    setResult("");
                    setError("");
                    setPhase("processing");
                    void processTranscript();
                  }}
                  type="button"
                >
                  <RotateCcw size={11} />
                  Try again
                </button>
              </div>
            )}
            {!result && !error && (
              <div className="flex flex-col items-center gap-3 py-12 text-ink-faint">
                <Loader2 size={20} className="animate-spin" />
                <span className="font-mono text-[11px] tracking-[0.16em]">
                  DISTILLING…
                </span>
              </div>
            )}
            {result && <MinutesDistillView markdown={result} />}
            {result &&
              (() => {
                const saved = savedMeetings.find(
                  (m) => m.id === savedMeetingIdRef.current,
                );
                return saved ? <MinutesShareLink meeting={saved} /> : null;
              })()}
          </section>
        )}

        {resultTab === "transcript" && (
          <section className="px-9 pt-7 pb-6">
            <TranscriptTurnsRich
              segments={transcriptSegments}
              fallbackText={transcript}
              labels={liveSpeakerLabels}
              emptyMessage="No transcript yet."
              annotatedDecisions={resultParsed?.decisions ?? []}
              annotatedActions={resultParsed?.actions ?? []}
            />
          </section>
        )}

        {resultTab === "rough" && (
          <section className="px-9 pt-7 pb-6">
            <V2SectionCap>YOUR ROUGH NOTES</V2SectionCap>
            <div
              className="mt-4 font-serif text-[15.5px] leading-[1.6] text-ink whitespace-pre-wrap"
              style={GARAMOND_FONT_STYLE}
            >
              {manualNotes.trim() || (
                <span className="text-ink-faint italic">
                  You didn&rsquo;t type any rough notes for this meeting.
                </span>
              )}
            </div>
          </section>
        )}

        {/* footer actions */}
        {result && !error && (
          <div className="border-t border-cream-300 px-9 py-5 flex items-center gap-2">
            <button
              className={FOOTER_BUTTON_PRIMARY_CLASS_NAME}
              onClick={() => void handleCopy(result)}
              type="button"
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
              {copied ? "Copied" : "Copy clean"}
            </button>
            <button
              className={cn(
                FOOTER_BUTTON_CLASS_NAME,
                !hasEmailableParticipants && "opacity-50",
              )}
              onClick={() =>
                void handleShareByEmail({
                  subjectTitle: currentRequest.meeting_title,
                  attendeesFull: currentRequest.attendees_full,
                  markdown: result,
                })
              }
              title={
                hasEmailableParticipants
                  ? "Open mail draft"
                  : "Add emails to share"
              }
              type="button"
            >
              <Mail size={11} />
              Email to attendees
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
              <RotateCcw size={11} />
              Regenerate
            </button>
            <span className="ml-auto inline-flex items-center gap-3">
              <V2Caps>SAVED · MINUTES LIBRARY</V2Caps>
              <button
                className="inline-flex items-center gap-1 rounded-full border border-cream-300 bg-transparent px-2 py-1.5 text-ink-faint transition-colors hover:border-cream-400 hover:text-ink"
                onClick={handleNewMeeting}
                type="button"
                title="Start a new meeting"
              >
                <Mic size={11} />
              </button>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

interface LiveTranscriptTurnsProps {
  segments: MeetingTranscriptSegment[];
  fallbackText: string;
  labels: SpeakerLabels;
  isLive: boolean;
}

function formatTurnElapsed(turn: TranscriptTurn, baseTime: number): string {
  const start = Date.parse(turn.startTime);
  if (!Number.isFinite(start) || !Number.isFinite(baseTime)) return "00:00";
  const diff = Math.max(0, Math.floor((start - baseTime) / 1000));
  return formatTime(diff);
}

function LiveTranscriptTurns({
  segments,
  fallbackText,
  labels,
  isLive,
}: LiveTranscriptTurnsProps) {
  const turns: TranscriptTurn[] =
    segments.length > 0 ? groupSegmentsIntoTurns(segments, labels) : [];

  if (turns.length === 0) {
    const trimmed = fallbackText.trim();
    if (!trimmed) return null;
    return (
      <p
        className="font-serif text-[14px] leading-[1.45] text-ink pl-6"
        style={GARAMOND_FONT_STYLE}
      >
        {trimmed}
      </p>
    );
  }

  const baseTime = Date.parse(turns[0]?.startTime ?? "");

  return (
    <>
      {turns.map((turn, index) => {
        const last = index === turns.length - 1;
        const live = isLive && last;
        return (
          <div
            key={`${turn.startTime}-${index}`}
            style={{ opacity: live ? 1 : 0.78 }}
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-ink-faint">
                {formatTurnElapsed(turn, baseTime)}
              </span>
              <V2PersonChip
                name={turn.label}
                size={16}
                tone={live ? "accent" : "soft"}
              />
              <V2Caps accent={live}>{turn.label.toUpperCase()}</V2Caps>
            </div>
            <p
              className="mt-1 pl-6 font-serif text-[14px] leading-[1.45] text-ink"
              style={GARAMOND_FONT_STYLE}
            >
              {turn.text}
              {live && (
                <span
                  className="ml-1 inline-block bg-terracotta align-[-2px] animate-pulse"
                  style={{ width: 7, height: 14 }}
                />
              )}
            </p>
          </div>
        );
      })}
    </>
  );
}

interface TranscriptTurnsRichProps {
  segments: MeetingTranscriptSegment[];
  fallbackText: string;
  labels: SpeakerLabels;
  emptyMessage: string;
  annotatedDecisions: string[];
  annotatedActions: ActionItem[];
}

function tokenizeForMatch(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 3);
}

function turnAnnotation(
  turn: TranscriptTurn,
  decisions: string[],
  actions: ActionItem[],
): "decision" | "action" | null {
  const turnTokens = new Set(tokenizeForMatch(turn.text));
  if (turnTokens.size === 0) return null;
  const matchScore = (target: string): number => {
    const targetTokens = tokenizeForMatch(target);
    if (targetTokens.length === 0) return 0;
    let hits = 0;
    for (const t of targetTokens) if (turnTokens.has(t)) hits++;
    return hits / targetTokens.length;
  };
  let bestDec = 0;
  for (const d of decisions) bestDec = Math.max(bestDec, matchScore(d));
  let bestAct = 0;
  for (const a of actions) bestAct = Math.max(bestAct, matchScore(a.task));
  if (bestDec >= 0.4 && bestDec >= bestAct) return "decision";
  if (bestAct >= 0.4) return "action";
  return null;
}

function TranscriptTurnsRich({
  segments,
  fallbackText,
  labels,
  emptyMessage,
  annotatedDecisions,
  annotatedActions,
}: TranscriptTurnsRichProps) {
  const turns: TranscriptTurn[] =
    segments.length > 0 ? groupSegmentsIntoTurns(segments, labels) : [];

  if (turns.length === 0) {
    const trimmed = fallbackText.trim();
    if (!trimmed) {
      return (
        <div className="flex flex-col items-center gap-2 py-10 text-ink-faint">
          <Mic size={18} />
          <span className="font-mono text-[11px] tracking-[0.16em]">
            {emptyMessage.toUpperCase()}
          </span>
        </div>
      );
    }
    return (
      <p
        className="font-serif text-[15.5px] leading-[1.5] text-ink"
        style={GARAMOND_FONT_STYLE}
      >
        {trimmed}
      </p>
    );
  }

  const baseTime = Date.parse(turns[0]?.startTime ?? "");

  return (
    <div>
      {turns.map((turn, index) => {
        const elapsed = (() => {
          const start = Date.parse(turn.startTime);
          if (!Number.isFinite(start) || !Number.isFinite(baseTime))
            return "00:00";
          const diff = Math.max(0, Math.floor((start - baseTime) / 1000));
          return formatTime(diff);
        })();
        const tag = turnAnnotation(turn, annotatedDecisions, annotatedActions);
        return (
          <div
            key={`${turn.startTime}-${index}`}
            className={cn(
              "grid grid-cols-12 gap-5 py-3.5",
              index < turns.length - 1 && "border-b border-cream-300",
            )}
          >
            <div className="col-span-2 flex flex-col gap-1">
              <span className="font-mono text-[11px] text-ink">{elapsed}</span>
              <div className="flex items-center gap-1.5">
                <V2PersonChip name={turn.label} size={16} tone="soft" />
                <V2Caps>{turn.label.toUpperCase()}</V2Caps>
              </div>
            </div>
            <div className="col-span-9">
              <p
                className="font-serif text-[15.5px] leading-[1.5] tracking-[-0.002em] text-ink"
                style={GARAMOND_FONT_STYLE}
              >
                {turn.text}
              </p>
            </div>
            <div className="col-span-1 text-right">
              {tag === "decision" && <V2Caps accent>DECISION</V2Caps>}
              {tag === "action" && <V2Caps>ACTION</V2Caps>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
