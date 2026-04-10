import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { aiService, type DesktopAIMode } from "../services/ai.service";
import {
  FileText,
  Users,
  Mic,
  Square,
  Copy,
  Check,
  RotateCcw,
  ChevronLeft,
  ChevronDown,
  Loader2,
  Clock,
  Mail,
  CalendarDays,
  Play,
  Plus,
  PenLine,
  Settings,
  X,
  Trash2,
  History,
} from "lucide-react";
import { motion } from "framer-motion";
import googleMeetLogo from "../assets/meeting-logos/google-meet.png";
import zoomLogo from "../assets/meeting-logos/zoom.png";
import teamsLogo from "../assets/meeting-logos/teams.png";
import { cn } from "../lib/utils";

const GOOGLE_CALENDAR_LOGO_URL =
  "https://cdn.brandfetch.io/id6O2oGzv-/theme/dark/idMX2_OMSc.svg?c=1bxid64Mup7aczewSAYMX&t=1755572706253";
const CTA_APP_LOGOS = [
  { src: googleMeetLogo, label: "Google Meet", logoClassName: "h-auto max-h-[25px] w-[25px] max-w-[25px] object-contain" },
  { src: zoomLogo, label: "Zoom", logoClassName: "h-auto max-h-6 w-6 max-w-6 object-contain" },
  { src: teamsLogo, label: "Teams", logoClassName: "h-auto max-h-6 w-6 max-w-6 object-contain" },
  // { src: slackLogo, label: "Slack", logoClassName: "h-auto max-h-[34px] w-[34px] max-w-[34px] object-contain" },
];

const FIGTREE_FONT_STYLE = { fontFamily: '"Figtree", -apple-system, sans-serif' } as const;
const GARAMOND_FONT_STYLE = { fontFamily: '"EB Garamond", Georgia, serif' } as const;
const MINUTES_INFO_CARD_STYLE = {
  background:
    "radial-gradient(circle at top left, rgba(255, 255, 255, 0.22), transparent 36%), linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)",
} as const;
const MINUTES_INFO_CARD_OVERLAY_STYLE = {
  background: "linear-gradient(180deg, rgba(255, 255, 255, 0.08), transparent 60%)",
} as const;
const LOGO_CHIP_BACKDROP_STYLE = { WebkitBackdropFilter: "blur(10px)" } as const;
const MEETINGS_TAB_CLASS_NAME = "flex flex-1 flex-col overflow-y-auto px-12 pt-8 pb-[120px]";
const MEETINGS_CONTAINER_CLASS_NAME = "mx-auto w-full max-w-[720px]";
const MEETINGS_TITLE_CLASS_NAME = "mb-5 text-center text-[1.75rem] font-semibold text-slate-800";
const MEETINGS_SUBTITLE_CLASS_NAME = "mb-7 text-sm leading-6 text-slate-500";
const SECTION_HEADER_CLASS_NAME = "mb-3 flex items-center gap-[7px] text-[0.8125rem] font-semibold uppercase tracking-[0.04em] text-slate-500";
const CALENDAR_EMPTY_CLASS_NAME = "flex flex-col items-center gap-2 px-0 py-3 text-center";
const PARTICIPANT_PILLS_CLASS_NAME = "flex min-h-8 flex-wrap items-center gap-1.5 py-1";
const PARTICIPANT_PILL_CLASS_NAME = "inline-flex max-w-[220px] items-center gap-1 rounded-[20px] border border-slate-200 bg-slate-100 px-2 py-[3px] pl-2.5 text-xs leading-[1.3] text-slate-600";
const PARTICIPANT_PILL_TEXT_CLASS_NAME = "truncate";
const PARTICIPANT_PILL_REMOVE_CLASS_NAME = "flex size-4 shrink-0 items-center justify-center rounded-full p-0 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-500";
const RESULT_TABS_CLASS_NAME = "mb-4 flex border-b border-slate-200";
const RESULT_TAB_CLASS_NAME = "mb-[-1px] inline-flex items-center gap-1.5 border-b-2 border-transparent bg-transparent px-4 py-2.5 text-[0.8125rem] font-medium text-slate-400 transition-colors hover:text-slate-500";
const FOOTER_BUTTON_CLASS_NAME = "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-[7px] text-[0.8125rem] font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-100";

export type CalendarReconnectResult = "refreshed" | "needs_reconnect" | "retry_later";

// ── Types ────────────────────────────────────────────────────────────────────

export interface MeetingTemplateData {
  id: string;
  name: string;
  desc: string;
  prompt: string;    // for built-in: "" (uses id as mode). for custom: the full instruction text.
  builtin: boolean;
}

export interface SavedMeeting {
  id: string;
  title: string;
  date: string;        // ISO string
  participants: string[];
  transcript: string;
  notes: string;
  templateId: string;
}

type Phase = "select" | "recording" | "processing" | "result" | "view_saved";
export type MinutesTranscriptionStatus =
  | "idle"
  | "recording"
  | "transcribing"
  | "finalizing"
  | "notes";

interface CalendarEvent {
  title: string;
  start_time: string;
  end_time: string;
  start_at: string;
  end_at: string;
  attendees: string[];
  calendar_name: string;
}

interface MeetingsTabProps {
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  recordingTime: number;
  transcript: string;
  onClearTranscript: () => void;
  systemAudioWarning?: string;
  googleCalendarToken: string;
  onConnectCalendar: () => void;
  onCalendarTokenInvalid: () => Promise<CalendarReconnectResult>;
  templates: MeetingTemplateData[];
  onManageTemplates: () => void;
  savedMeetings: SavedMeeting[];
  onSaveMeeting: (meeting: SavedMeeting) => void;
  onDeleteMeeting: (id: string) => void;
  minutesTranscriptionStatus: MinutesTranscriptionStatus;
  minutesSegmentQueue: number;
  minutesSegmentsCompleted: number;
  minutesSegmentsTotal: number;
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

// ── Default templates ───────────────────────────────────────────────────────

export const DEFAULT_TEMPLATES: MeetingTemplateData[] = [
  { id: "meeting_general",    name: "General",    desc: "Key points, decisions, action items", prompt: "", builtin: true },
  { id: "meeting_standup",    name: "Standup",    desc: "Done, doing, blockers",              prompt: "", builtin: true },
  { id: "meeting_1on1",       name: "1:1",        desc: "Discussion & follow-ups",            prompt: "", builtin: true },
  { id: "meeting_brainstorm", name: "Brainstorm", desc: "Ideas & next steps",                 prompt: "", builtin: true },
];

const LONG_TRANSCRIPT_THRESHOLD = 12_000;
const LONG_TRANSCRIPT_CHUNK_SIZE = 4_000;
const LONG_TRANSCRIPT_OVERLAP = 300;

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function guessTemplateId(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("standup") || t.includes("stand-up") || t.includes("scrum") || t.includes("daily"))
    return "meeting_standup";
  if (t.includes("1:1") || t.includes("1-1") || t.includes("one on one") || t.includes("one-on-one"))
    return "meeting_1on1";
  if (t.includes("brainstorm") || t.includes("ideation") || t.includes("design sprint"))
    return "meeting_brainstorm";
  return "meeting_general";
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

  return start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function formatEventTimeRange(event: CalendarEvent): string {
  const start = new Date(event.start_at);
  const end = new Date(event.end_at);

  if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
    return `${start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} - ${end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  }

  return `${event.start_time} - ${event.end_time}`;
}

function getTemplateGuidance(
  templateId: string,
  templates: MeetingTemplateData[],
): string {
  const template = templates.find((tpl) => tpl.id === templateId);
  if (template && !template.builtin && template.prompt.trim()) {
    return template.prompt.trim();
  }

  switch (templateId) {
    case "meeting_standup":
      return [
        "Create standup notes in markdown.",
        "Use exactly these sections:",
        "## What Was Done (Yesterday/Recently)",
        "## What's Being Worked On (Today/Next)",
        "## Blockers & Risks",
        "If multiple people spoke, organize updates by person.",
      ].join("\n");
    case "meeting_1on1":
      return [
        "Create 1:1 notes in markdown.",
        "Use exactly these sections:",
        "## Discussion Points",
        "## Feedback & Recognition",
        "## Action Items",
        "## Follow-ups for Next Meeting",
        "Include owner and deadline whenever they are explicitly mentioned.",
      ].join("\n");
    case "meeting_brainstorm":
      return [
        "Create brainstorming notes in markdown.",
        "Use exactly these sections:",
        "## Ideas Generated",
        "## Key Themes",
        "## Top Ideas (Ranked by Discussion Energy)",
        "## Next Steps",
        "List each idea with a brief description.",
      ].join("\n");
    case "meeting_general":
    default:
      return [
        "Create structured meeting notes in markdown.",
        "Use exactly these sections:",
        "## Key Discussion Points",
        "## Decisions Made",
        "## Action Items",
        "## Follow-ups",
        "Include owner and deadline whenever they are explicitly mentioned.",
      ].join("\n");
  }
}

function splitTextWithOverlap(text: string, size: number, overlap: number): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const parts: string[] = [];
  let start = 0;

  while (start < trimmed.length) {
    const end = Math.min(start + size, trimmed.length);
    parts.push(trimmed.slice(start, end));
    if (end >= trimmed.length) break;
    start = Math.max(end - overlap, start + 1);
  }

  return parts;
}

function getNotesLoadingLabel(
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

  return "Generating meeting notes…";
}

// ── Grouped calendar rows ────────────────────────────────────────────────────

function CalendarEventRow({
  event,
  onUse,
  isLive,
  currentTime,
}: {
  event: CalendarEvent;
  onUse: (event: CalendarEvent) => void;
  isLive?: boolean;
  currentTime: number;
}) {
  const attendeeLabel = event.attendees.length === 1 ? "1 attendee" : `${event.attendees.length} attendees`;

  return (
    <button
      className={cn(
        "group flex w-full items-center justify-between gap-4 border-b border-[#eef2f7] px-[18px] py-4 text-left transition-colors last:border-b-0 max-md:flex-col max-md:items-start",
        isLive
          ? "bg-gradient-to-r from-cyan-50/95 via-white to-white hover:from-cyan-50 hover:via-slate-50 hover:to-slate-50"
          : "bg-white hover:bg-slate-50",
      )}
      onClick={() => onUse(event)}
      type="button"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <span
            className={cn(
              "inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-[0.69rem] font-bold uppercase tracking-[0.05em] text-slate-500",
              isLive && "bg-teal-100 text-teal-700",
            )}
          >
            {isLive ? "Ongoing" : getEventDayLabel(event, currentTime)}
          </span>
          <span className="flex items-center gap-[5px] text-[0.78rem] font-medium text-slate-500">
            <Clock size={11} />
            {formatEventTimeRange(event)}
          </span>
        </div>
        <div className="text-[0.95rem] font-semibold leading-[1.35] text-slate-900">{event.title}</div>
        {event.attendees.length > 0 && (
          <div className="flex items-center gap-1 text-[0.76rem] text-slate-400">
            <Users size={10} />
            {attendeeLabel}
          </div>
        )}
      </div>
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-[5px] rounded-full px-3 py-[9px] text-[0.78rem] font-semibold transition-colors max-md:self-start",
          isLive
            ? "bg-teal-100 text-teal-700"
            : "bg-sky-50 text-cyan-700 group-hover:bg-cyan-100 group-hover:text-cyan-800",
        )}
      >
        <Play size={12} fill="currentColor" />
        Record
      </span>
    </button>
  );
}

// ── Template picker dropdown ────────────────────────────────────────────────

function TemplatePicker({
  templates,
  selectedId,
  onChange,
}: {
  templates: MeetingTemplateData[];
  selectedId: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = templates.find((t) => t.id === selectedId);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        className="flex items-center gap-[5px] rounded-md border border-slate-200 bg-slate-50 px-2.5 py-[5px] text-xs font-medium text-slate-600 transition-colors hover:border-slate-300"
        onClick={() => setOpen(!open)}
        type="button"
      >
        <FileText size={12} />
        <span>{selected?.name || "Template"}</span>
        <ChevronDown size={12} className={cn("transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+4px)] z-50 max-h-[260px] min-w-[200px] overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-[0_8px_24px_rgba(0,0,0,0.1)]">
          {templates.map((t) => (
            <button
              key={t.id}
              className={cn(
                "flex w-full flex-col rounded-md bg-transparent px-2.5 py-[7px] text-left transition-colors hover:bg-slate-100",
                t.id === selectedId && "bg-cyan-50",
              )}
              onClick={() => { onChange(t.id); setOpen(false); }}
              type="button"
            >
              <span className="text-[0.8125rem] font-semibold text-slate-800">{t.name}</span>
              <span className="text-[0.7rem] text-slate-400">{t.desc}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function MeetingsTab({
  isRecording,
  onStartRecording,
  onStopRecording,
  recordingTime,
  transcript,
  onClearTranscript,
  systemAudioWarning,
  googleCalendarToken,
  onConnectCalendar,
  onCalendarTokenInvalid,
  templates,
  onManageTemplates,
  savedMeetings,
  onSaveMeeting,
  onDeleteMeeting,
  minutesTranscriptionStatus,
  minutesSegmentQueue,
  minutesSegmentsCompleted,
  minutesSegmentsTotal,
}: MeetingsTabProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState("meeting_general");
  const [meetingTitle, setMeetingTitle]   = useState("");
  const [participantsList, setParticipantsList] = useState<string[]>([]);
  const [participantInput, setParticipantInput] = useState("");
  const [manualNotes, setManualNotes]     = useState("");
  const [phase, setPhase]                 = useState<Phase>("select");
  const [result, setResult]               = useState("");
  const [streaming, setStreaming]         = useState(false);
  const [error, setError]                 = useState("");
  const [copied, setCopied]               = useState(false);
  const [resultTab, setResultTab]         = useState<"notes" | "transcript">("notes");
  const [viewingSaved, setViewingSaved]   = useState<SavedMeeting | null>(null);

  // Calendar state
  const [calendarEvents, setCalendarEvents]     = useState<CalendarEvent[]>([]);
  const [calendarLoading, setCalendarLoading]   = useState(false);
  const [calendarError, setCalendarError]       = useState<"needs_reconnect" | "fetch_error" | null>(null);
  const [calendarErrorMsg, setCalendarErrorMsg] = useState("");
  const [currentTime, setCurrentTime]           = useState(() => Date.now());
  const lastCalendarFetchRef = useRef<string>("");

  const outputRef   = useRef<HTMLDivElement>(null);

  // Participant pill helpers
  const addParticipant = (value: string) => {
    const trimmed = value.trim().replace(/,+$/, "").trim();
    if (trimmed && !participantsList.includes(trimmed)) {
      setParticipantsList((prev) => [...prev, trimmed]);
    }
    setParticipantInput("");
  };

  const removeParticipant = (index: number) => {
    setParticipantsList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleParticipantKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === "," || e.key === "Tab") && participantInput.trim()) {
      e.preventDefault();
      addParticipant(participantInput);
    } else if (e.key === "Backspace" && !participantInput && participantsList.length > 0) {
      setParticipantsList((prev) => prev.slice(0, -1));
    }
  };

  const handleParticipantBlur = () => {
    if (participantInput.trim()) addParticipant(participantInput);
  };

  // Derived participants string for AI/email
  const participants = participantsList.join(", ");

  // Fetch Google Calendar events (cached — skip if same token + date)
  useEffect(() => {
    if (!googleCalendarToken) {
      setCalendarEvents([]); setCalendarError(null);
      lastCalendarFetchRef.current = "";
      return;
    }
    const now = new Date();
    const dateKey = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const cacheKey = `${googleCalendarToken.slice(0, 16)}:${dateKey}`;
    if (cacheKey === lastCalendarFetchRef.current && calendarEvents.length > 0) {
      return;
    }
    setCalendarLoading(true); setCalendarError(null);
    const timeMin = new Date(now); timeMin.setHours(0, 0, 0, 0);
    const timeMax = new Date(now); timeMax.setDate(timeMax.getDate() + 14); timeMax.setHours(23, 59, 59, 999);

    invoke<CalendarEvent[]>("get_calendar_events", {
      token: googleCalendarToken, timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString(),
    })
      .then((events) => {
        setCalendarEvents(events); setCalendarError(null);
        lastCalendarFetchRef.current = cacheKey;
      })
      .catch(async (e: unknown) => {
        const msg = String(e);
        if (msg.includes("NEEDS_RECONNECT")) {
          setCalendarErrorMsg("");
          const recoveryState = await onCalendarTokenInvalid();
          if (recoveryState === "refreshed") {
            setCalendarError(null);
          } else if (recoveryState === "retry_later") {
            setCalendarError("fetch_error");
            setCalendarErrorMsg("Calendar access is being refreshed in the background. Please try again in a moment.");
          } else {
            setCalendarError("needs_reconnect");
          }
        } else {
          console.warn("[meetings] calendar fetch failed:", e);
          setCalendarError("fetch_error");
          setCalendarErrorMsg(msg.replace(/^Error:\s*/i, "").slice(0, 200));
        }
      })
      .finally(() => setCalendarLoading(false));
  }, [googleCalendarToken, onCalendarTokenInvalid]);

  // Re-check the clock so ongoing meetings and ordering stay fresh
  useEffect(() => {
    const id = setInterval(() => setCurrentTime(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight; }, [result]);

  // AI processing — resolve template to mode
  const processTranscript = useCallback(async () => {
    if (!selectedTemplateId || (!transcript.trim() && !manualNotes.trim())) return;

    const tpl = templates.find((t) => t.id === selectedTemplateId);
    const isCustom = tpl && !tpl.builtin;

    const context = [
      meetingTitle ? `Meeting: ${meetingTitle}` : "",
      participants.trim() ? `Participants: ${participants.trim()}` : "",
    ].filter(Boolean).join("\n");

    // Any template can layer extra instructions on top of its default formatting behavior.
    const customInstructions = tpl?.prompt
      ? `Template instructions: ${tpl.prompt}`
      : "";

    const parts = [
      customInstructions,
      context,
      manualNotes.trim() ? `My notes:\n${manualNotes.trim()}` : "",
      transcript.trim() ? `Transcript:\n${transcript.trim()}` : "",
    ].filter(Boolean);

    const enrichedText = parts.join("\n\n---\n\n");
    const mode: DesktopAIMode = isCustom
      ? "meeting_custom"
      : (selectedTemplateId as DesktopAIMode);

    setStreaming(true); setResult(""); setError("");

    try {
      const normalizedTranscript = transcript.trim();
      let processed: string;

      if (normalizedTranscript.length > LONG_TRANSCRIPT_THRESHOLD) {
        const templateGuidance = getTemplateGuidance(selectedTemplateId, templates);
        const transcriptChunks = splitTextWithOverlap(
          normalizedTranscript,
          LONG_TRANSCRIPT_CHUNK_SIZE,
          LONG_TRANSCRIPT_OVERLAP,
        );

        const reducedChunks: string[] = [];

        for (let index = 0; index < transcriptChunks.length; index += 1) {
          const chunkPayload = [
            `Template instructions:\n${templateGuidance}`,
            context ? `Meeting context:\n${context}` : "",
            `Transcript chunk ${index + 1}/${transcriptChunks.length}:\n${transcriptChunks[index]}`,
          ].filter(Boolean).join("\n\n---\n\n");

          reducedChunks.push(
            await aiService.processText(chunkPayload, "meeting_reduce_chunk"),
          );
        }

        const mergePayload = [
          `Template instructions:\n${templateGuidance}`,
          context ? `Meeting context:\n${context}` : "",
          manualNotes.trim() ? `My notes:\n${manualNotes.trim()}` : "",
          `Reduced chunk summaries:\n${reducedChunks
            .map((chunk, index) => `Chunk ${index + 1}\n${chunk}`)
            .join("\n\n---\n\n")}`,
        ].filter(Boolean).join("\n\n---\n\n");

        processed = await aiService.processText(mergePayload, "meeting_reduce_merge");
      } else {
        processed = await aiService.processText(enrichedText, mode);
      }

      setResult(processed);
      setPhase("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("result");
    } finally {
      setStreaming(false);
    }
  }, [selectedTemplateId, transcript, manualNotes, meetingTitle, participants, templates]);

  useEffect(() => {
    if (
      phase === "processing" &&
      minutesTranscriptionStatus === "notes" &&
      (transcript.trim() || manualNotes.trim())
    ) {
      processTranscript();
    }
  }, [phase, transcript, manualNotes, minutesTranscriptionStatus, processTranscript]);

  // Auto-save meeting when notes are generated
  const savedMeetingIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (phase === "result" && !streaming && result && !error && !savedMeetingIdRef.current) {
      const id = `meeting_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      savedMeetingIdRef.current = id;
      onSaveMeeting({
        id,
        title: meetingTitle || "Untitled Meeting",
        date: new Date().toISOString(),
        participants: participantsList,
        transcript: transcript,
        notes: result,
        templateId: selectedTemplateId,
      });
    }
  }, [phase, streaming, result, error, meetingTitle, participantsList, transcript, selectedTemplateId, onSaveMeeting]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const startFromEvent = (event: CalendarEvent) => {
    setMeetingTitle(event.title);
    setParticipantsList(event.attendees.filter(Boolean));
    setParticipantInput("");
    setSelectedTemplateId(guessTemplateId(event.title));
    setPhase("recording");
    setResult(""); setError(""); setManualNotes(""); setResultTab("notes");
  };

  const handleStopRecording = () => {
    onStopRecording();
    setResultTab("notes");
    setPhase("processing");
  };

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const handleShareByEmail = async () => {
    const emails = participants.split(/[,;]+/).map((e) => e.trim()).filter((e) => e.includes("@")).join(",");
    const subject = encodeURIComponent(`Meeting Notes: ${meetingTitle || "Meeting"}`);
    const body    = encodeURIComponent(`Hi,\n\nPlease find the meeting notes below.\n\n---\n\n${result}\n\n---\n\nGenerated by OSCAR`);
    await openUrl(emails ? `mailto:${emails}?subject=${subject}&body=${body}` : `mailto:?subject=${subject}&body=${body}`);
  };

  const handleNewMeeting = () => {
    setSelectedTemplateId("meeting_general"); setMeetingTitle(""); setParticipantsList([]); setParticipantInput(""); setManualNotes("");
    setPhase("select"); setResult(""); setError(""); setStreaming(false); setResultTab("notes"); onClearTranscript();
    savedMeetingIdRef.current = null; setViewingSaved(null);
  };

  const handleBack = () => {
    if (isRecording) onStopRecording();
    setPhase("select"); setSelectedTemplateId("meeting_general");
    setResult(""); setError(""); setManualNotes(""); setResultTab("notes"); onClearTranscript();
  };

  const selectedTpl = templates.find((t) => t.id === selectedTemplateId);
  const hasEmailableParticipants = participants.split(/[,;]+/).some((e) => e.trim().includes("@"));
  const nextCalendarEvents = calendarEvents
    .filter((event) => getEventTimestamp(event.end_at) >= currentTime)
    .sort((a, b) => getEventTimestamp(a.start_at) - getEventTimestamp(b.start_at))
    .slice(0, 5);

  const systemAudioNotice = systemAudioWarning ? (
    <div className="mb-4 rounded-xl border border-orange-300 bg-orange-50 px-3.5 py-3 text-[0.9rem] leading-[1.5] text-orange-800">
      {systemAudioWarning}
    </div>
  ) : null;

  // ── Phase: Select ────────────────────────────────────────────────────────

  if (phase === "select") {
    return (
      <div className={MEETINGS_TAB_CLASS_NAME}>
        <div className={MEETINGS_CONTAINER_CLASS_NAME}>
          <h1 className={MEETINGS_TITLE_CLASS_NAME} style={GARAMOND_FONT_STYLE}>
            <span className="text-slate-600 font-light text-lg" style={FIGTREE_FONT_STYLE}>OSCAR</span>{" "}
            <span className="font-bold">Minutes</span>
          </h1>

          {/* Info card */}
          <div
            className="relative mb-6 flex items-stretch justify-between gap-[18px] overflow-hidden rounded-[22px] px-6 py-5 shadow-[0_18px_40px_rgba(8,145,178,0.2)] max-md:flex-col max-md:gap-[18px] max-md:p-[22px]"
            style={MINUTES_INFO_CARD_STYLE}
          >
            <div className="pointer-events-none absolute inset-0" style={MINUTES_INFO_CARD_OVERLAY_STYLE} />
            <div className="relative z-[1] flex max-w-[404px] flex-1 flex-col items-start text-left max-md:max-w-none">
              <h2
                className="m-0 text-[1.26rem] font-medium leading-[1.08] text-slate-50 max-md:text-[1.48rem]"
                style={FIGTREE_FONT_STYLE}
              >
                Raw meeting transcripts to awesome notes.
              </h2>
              <p className="mt-3 max-w-[348px] text-[0.8rem] leading-[1.55] text-sky-50/90 max-md:max-w-none">
                Choose from predefined templates or create your own.
              </p>
              <button
                className="mt-[22px] inline-flex items-center gap-1.5 rounded-full border border-white/90 bg-white px-[14px] py-2.5 text-[0.82rem] font-semibold text-cyan-700 shadow-[0_12px_24px_rgba(15,23,42,0.14)] transition-all duration-150 hover:-translate-y-px hover:text-cyan-800 hover:shadow-[0_16px_28px_rgba(15,23,42,0.18)]"
                onClick={onManageTemplates}
                title="Configure templates"
                type="button"
              >
                <Settings size={14} />
                Configure templates
              </button>
            </div>
            <div className="relative flex basis-[208px] items-center justify-end max-md:basis-auto max-md:justify-start" aria-hidden="true">
              <div className="relative flex min-h-16 w-full items-center justify-end max-md:justify-start">
                {CTA_APP_LOGOS.map((logo, index) => (
                  <div
                    key={`${logo.src}-${index}`}
                    className={cn(
                      "group relative z-[1] flex h-14 w-14 items-center justify-center rounded-full border boder-white/45 bg-white/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-[10px] transition-all duration-150 hover:z-[3] hover:-translate-y-px hover:bg-white/[0.18] hover:border-white/[0.34]",
                      index === 0 ? "ml-0" : "-ml-2.5",
                    )}
                    style={LOGO_CHIP_BACKDROP_STYLE}
                    title={logo.label}
                  >
                    <img
                      className={cn("opacity-100 transition-transform duration-150 group-hover:scale-[1.02]", logo.logoClassName)}
                      src={logo.src}
                      alt=""
                    />
                  </div>
                ))}
                <div
                  className="group relative -ml-2.5 flex h-14 w-14 items-center justify-center rounded-full border border-white/45 bg-white/15 text-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-[10px] transition-all duration-150 hover:z-[3] hover:-translate-y-px hover:bg-white/[0.18] hover:border-white/[0.34] hover:text-white/95"
                  style={LOGO_CHIP_BACKDROP_STYLE}
                >
                  <Plus size={22} />
                </div>
              </div>
            </div>
          </div>

          {systemAudioNotice}

          {/* ── Upcoming meetings ── */}
          <div className="mb-2">
            <div className={SECTION_HEADER_CLASS_NAME}>
              <CalendarDays size={14} />
              <span>Coming up</span>
              {calendarLoading && <Loader2 size={12} className="animate-spin" />}
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
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_26px_rgba(15,23,42,0.05)]"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22 }}
                >
                  {nextCalendarEvents.map((evt, i) => (
                    <CalendarEventRow
                      key={`${evt.title}-${evt.start_at}-${i}`}
                      event={evt}
                      onUse={startFromEvent}
                      isLive={isEventOngoing(evt, currentTime)}
                      currentTime={currentTime}
                    />
                  ))}
                </motion.div>
              )
            )}
          </div>


          {/* ── Previous meetings ── */}
          {savedMeetings.length > 0 && (
            <div className="mt-5">
              <div className={SECTION_HEADER_CLASS_NAME}>
                <History size={14} />
                <span>Previous meetings</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {savedMeetings
                  .slice()
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((m) => (
                    <button
                      key={m.id}
                      className="flex w-full flex-col gap-1 rounded-lg border border-slate-200 bg-white px-[13px] py-2.5 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
                      onClick={() => { setViewingSaved(m); setResultTab("notes"); setPhase("view_saved"); }}
                      style={FIGTREE_FONT_STYLE}
                      type="button"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex-1 truncate text-[0.8125rem] font-semibold text-slate-800">{m.title}</span>
                        <span className="shrink-0 text-[0.7rem] text-slate-400">
                          {new Date(m.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      </div>
                      {m.participants.length > 0 && (
                        <div className="flex items-center gap-1 text-[0.7rem] text-slate-400">
                          <Users size={10} />
                          <span>{m.participants.length} participant{m.participants.length !== 1 ? "s" : ""}</span>
                        </div>
                      )}
                      <div className="truncate whitespace-nowrap text-[0.75rem] leading-[1.4] text-slate-500">
                        {m.notes.slice(0, 100)}{m.notes.length > 100 ? "…" : ""}
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Phase: View Saved Meeting ───────────────────────────────────────────

  if (phase === "view_saved" && viewingSaved) {
    return (
      <div className={MEETINGS_TAB_CLASS_NAME}>
        <div className={MEETINGS_CONTAINER_CLASS_NAME}>
          <button
            className="mb-4 inline-flex items-center gap-1 rounded-md bg-transparent px-2 py-1 pl-1 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            onClick={() => { setPhase("select"); setViewingSaved(null); }}
            type="button"
          >
            <ChevronLeft size={16} /> Back
          </button>

          {systemAudioNotice}

          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h1 className={cn(MEETINGS_TITLE_CLASS_NAME, "mb-0")} style={GARAMOND_FONT_STYLE}>{viewingSaved.title}</h1>
              <p className={cn(MEETINGS_SUBTITLE_CLASS_NAME, "mb-0")}>
                {new Date(viewingSaved.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </p>
            </div>
            <button
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-transparent text-slate-400 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600"
              onClick={() => {
                onDeleteMeeting(viewingSaved.id);
                setPhase("select"); setViewingSaved(null);
              }}
              title="Delete meeting"
              type="button"
            >
              <Trash2 size={14} />
            </button>
          </div>

          {viewingSaved.participants.length > 0 && (
            <div className={cn(PARTICIPANT_PILLS_CLASS_NAME, "mb-3")}>
              {viewingSaved.participants.map((p, i) => (
                <span key={i} className={PARTICIPANT_PILL_CLASS_NAME}>
                  <span className={PARTICIPANT_PILL_TEXT_CLASS_NAME}>{p}</span>
                </span>
              ))}
            </div>
          )}

          {/* Tabs: Notes / Transcript */}
          <div className={RESULT_TABS_CLASS_NAME}>
            <button
              className={cn(RESULT_TAB_CLASS_NAME, resultTab === "notes" && "border-b-cyan-600 text-cyan-600")}
              onClick={() => setResultTab("notes")}
              type="button"
            >
              <FileText size={13} />
              Notes
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
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="max-h-[460px] overflow-y-auto whitespace-pre-wrap px-6 py-5 text-sm leading-[1.75] text-slate-700">
                {viewingSaved.notes}
              </div>
              <div className="flex gap-2 border-t border-slate-100 px-4 py-3">
                <button
                  className={cn(FOOTER_BUTTON_CLASS_NAME, "border-cyan-600 bg-cyan-600 text-white hover:border-cyan-700 hover:bg-cyan-700")}
                  onClick={async () => {
                  await navigator.clipboard.writeText(viewingSaved.notes);
                  setCopied(true); setTimeout(() => setCopied(false), 2000);
                  }}
                  type="button"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? "Copied!" : "Copy"}
                </button>
                <button
                  className={FOOTER_BUTTON_CLASS_NAME}
                  onClick={async () => {
                    const emails = viewingSaved.participants.filter((e) => e.includes("@")).join(",");
                    const subject = encodeURIComponent(`Meeting Notes: ${viewingSaved.title}`);
                    const body = encodeURIComponent(`Hi,\n\nPlease find the meeting notes below.\n\n---\n\n${viewingSaved.notes}\n\n---\n\nGenerated by OSCAR`);
                    await openUrl(emails ? `mailto:${emails}?subject=${subject}&body=${body}` : `mailto:?subject=${subject}&body=${body}`);
                  }}
                  type="button"
                >
                  <Mail size={12} /> Email
                </button>
              </div>
            </div>
          )}

          {resultTab === "transcript" && (
            <div className="p-0">
              {viewingSaved.transcript.trim() ? (
                <div className="max-h-[400px] overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 px-3.5 py-3 text-[0.8125rem] leading-[1.65] text-gray-700">
                  {viewingSaved.transcript}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 px-5 py-10 text-[0.8125rem] text-slate-400">
                  <Mic size={20} />
                  <span>No transcript available.</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Phase: Recording ─────────────────────────────────────────────────────

  if (phase === "recording") {
    return (
      <div className={cn(MEETINGS_TAB_CLASS_NAME, "relative pb-[140px]")}>
        <div className={MEETINGS_CONTAINER_CLASS_NAME}>
          <button
            className="mb-4 inline-flex items-center gap-1 rounded-md bg-transparent px-2 py-1 pl-1 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            onClick={handleBack}
            type="button"
          >
            <ChevronLeft size={16} /> Back
          </button>

          {systemAudioNotice}

          {/* Title + participants (borderless, inline editing) */}
          <div className="mb-1 flex flex-col gap-2">
            <input
              className="w-full border-0 border-b border-b-transparent bg-transparent px-0.5 py-1 text-[1.1rem] font-semibold text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-b-slate-200"
              type="text"
              placeholder="Meeting title"
              value={meetingTitle}
              onChange={(e) => setMeetingTitle(e.target.value)}
              style={FIGTREE_FONT_STYLE}
            />
            <div className={PARTICIPANT_PILLS_CLASS_NAME}>
              {participantsList.map((p, i) => (
                <span key={i} className={PARTICIPANT_PILL_CLASS_NAME}>
                  <span className={PARTICIPANT_PILL_TEXT_CLASS_NAME}>{p}</span>
                  <button className={PARTICIPANT_PILL_REMOVE_CLASS_NAME} onClick={() => removeParticipant(i)} type="button">
                    <X size={10} />
                  </button>
                </span>
              ))}
              <input
                className="min-w-[120px] flex-1 border-0 bg-transparent px-0.5 py-1 text-[0.8125rem] text-slate-800 outline-none placeholder:text-slate-400"
                type="text"
                placeholder={participantsList.length === 0 ? "Add participants (email or name, press Enter)" : "Add more..."}
                value={participantInput}
                onChange={(e) => setParticipantInput(e.target.value)}
                onKeyDown={handleParticipantKeyDown}
                onBlur={handleParticipantBlur}
                style={FIGTREE_FONT_STYLE}
              />
            </div>
          </div>

          {/* Template picker */}
          <div className="flex items-center gap-3 pb-2 pt-1">
            <TemplatePicker
              templates={templates}
              selectedId={selectedTemplateId}
              onChange={setSelectedTemplateId}
            />
          </div>

          {/* ── Simultaneous notes area ── */}
          <div className="mt-1 flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-[0.8125rem] font-semibold text-slate-600">
              <PenLine size={13} />
              <span>Your notes</span>
              <span className="ml-0.5 text-xs font-normal text-slate-400">type freely while recording</span>
            </div>
            <textarea
              className="min-h-[140px] w-full resize-y border-0 bg-transparent px-0.5 py-3 text-sm leading-[1.6] text-slate-800 outline-none placeholder:text-[#b0b8c4] focus:bg-transparent"
              placeholder="Jot down key points, action items, or anything worth remembering…"
              value={manualNotes}
              onChange={(e) => setManualNotes(e.target.value)}
              rows={6}
            />
          </div>
        </div>

        {/* ── Fixed bottom-center record button ── */}
        <div className="fixed bottom-6 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2">
          <motion.button
            className={cn(
              "flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white transition-all duration-200",
              isRecording
                ? "bg-red-600 shadow-[0_4px_14px_rgba(220,38,38,0.3)] hover:bg-red-700"
                : "bg-cyan-600 shadow-[0_4px_14px_rgba(6,182,212,0.3)] hover:bg-cyan-700 hover:shadow-[0_6px_18px_rgba(6,182,212,0.4)]",
            )}
            onClick={isRecording ? handleStopRecording : onStartRecording}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            transition={{ duration: 0.15 }}
            type="button"
          >
            {isRecording ? <Square size={28} fill="currentColor" /> : <Mic size={28} />}
          </motion.button>
          <div className="flex items-center gap-2">
            {isRecording
              ? (
                  <>
                    <span className="h-2 w-2 shrink-0 rounded-full bg-red-600 animate-pulse" />
                    <span
                      className="text-[1.5rem] font-semibold tracking-[0.04em] text-slate-800 [font-variant-numeric:tabular-nums]"
                      style={FIGTREE_FONT_STYLE}
                    >
                      {formatTime(recordingTime)}
                    </span>
                  </>
                )
              : <span className="text-[0.8125rem] font-medium text-slate-400">Tap to start recording</span>
            }
          </div>
        </div>
      </div>
    );
  }

  // ── Phase: Processing & Result ───────────────────────────────────────────

  return (
    <div className={MEETINGS_TAB_CLASS_NAME}>
      <div className={MEETINGS_CONTAINER_CLASS_NAME}>
        {systemAudioNotice}

        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h1 className={cn(MEETINGS_TITLE_CLASS_NAME, "mb-0")} style={GARAMOND_FONT_STYLE}>
              {meetingTitle || "Meeting Notes"}
            </h1>
            {meetingTitle && (
              <p className={cn(MEETINGS_SUBTITLE_CLASS_NAME, "mb-0")}>
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </p>
            )}
          </div>
          {selectedTpl && (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-cyan-50 px-3.5 py-1.5 text-[0.8125rem] font-medium text-cyan-600">
              <FileText size={12} />
              {selectedTpl.name}
            </div>
          )}
        </div>

        {participantsList.length > 0 && (
          <div className={cn(PARTICIPANT_PILLS_CLASS_NAME, "mb-3")}>
            {participantsList.map((p, i) => (
              <span key={i} className={PARTICIPANT_PILL_CLASS_NAME}>
                <span className={PARTICIPANT_PILL_TEXT_CLASS_NAME}>{p}</span>
                <button className={PARTICIPANT_PILL_REMOVE_CLASS_NAME} onClick={() => removeParticipant(i)} type="button">
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Tabs: Notes / Transcript */}
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
                  {getNotesLoadingLabel(
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
                  <div className="max-h-[460px] overflow-y-auto whitespace-pre-wrap px-6 py-5 text-sm leading-[1.75] text-slate-700" ref={outputRef}>
                    {result || (streaming && <span className="text-indigo-500 animate-pulse">&#9613;</span>)}
                  </div>
                )}

                {!streaming && result && !error && (
                  <div className="flex gap-2 border-t border-slate-100 px-4 py-3">
                    <button
                      className={cn(FOOTER_BUTTON_CLASS_NAME, "border-cyan-600 bg-cyan-600 text-white hover:border-cyan-700 hover:bg-cyan-700")}
                      onClick={handleCopy}
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
                      onClick={handleShareByEmail}
                      title={hasEmailableParticipants ? "Open mail draft" : "Add emails to share"}
                      type="button"
                    >
                      <Mail size={12} /> Email
                    </button>
                    <button
                      className={FOOTER_BUTTON_CLASS_NAME}
                      onClick={() => { setResult(""); setError(""); setPhase("processing"); processTranscript(); }}
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
            {transcript.trim() ? (
              <div className="max-h-[400px] overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 px-3.5 py-3 text-[0.8125rem] leading-[1.65] text-gray-700">
                {transcript}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 px-5 py-10 text-[0.8125rem] text-slate-400">
                <Mic size={20} />
                <span>No transcript yet.</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
