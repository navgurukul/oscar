import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  FileText,
  Users,
  MessageSquare,
  Lightbulb,
  Mic,
  Square,
  Copy,
  Check,
  RotateCcw,
  ChevronLeft,
  Loader2,
  Calendar,
  Clock,
  Mail,
  CalendarDays,
  Info,
} from "lucide-react";
import { motion } from "framer-motion";

// ── Types ────────────────────────────────────────────────────────────────────

type MeetingTemplate =
  | "meeting_general"
  | "meeting_standup"
  | "meeting_1on1"
  | "meeting_brainstorm";

type Phase = "select" | "recording" | "processing" | "result";

interface CalendarEvent {
  title: string;
  start_time: string;
  end_time: string;
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
  googleCalendarToken: string;
  onConnectCalendar: () => void;
  onCalendarTokenInvalid: () => void;
}

// ── Template definitions ─────────────────────────────────────────────────────

const TEMPLATES: {
  id: MeetingTemplate;
  icon: typeof FileText;
  name: string;
  desc: string;
}[] = [
  {
    id: "meeting_general",
    icon: FileText,
    name: "General Meeting",
    desc: "Key points, decisions, and action items",
  },
  {
    id: "meeting_standup",
    icon: Users,
    name: "Standup",
    desc: "Done, doing, and blockers",
  },
  {
    id: "meeting_1on1",
    icon: MessageSquare,
    name: "1:1 Meeting",
    desc: "Discussion, actions, and follow-ups",
  },
  {
    id: "meeting_brainstorm",
    icon: Lightbulb,
    name: "Brainstorm",
    desc: "Ideas, themes, and next steps",
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/** Best-guess template for a meeting title */
function guessTemplate(title: string): MeetingTemplate {
  const t = title.toLowerCase();
  if (t.includes("standup") || t.includes("stand-up") || t.includes("scrum") || t.includes("daily"))
    return "meeting_standup";
  if (t.includes("1:1") || t.includes("1-1") || t.includes("one on one") || t.includes("one-on-one"))
    return "meeting_1on1";
  if (t.includes("brainstorm") || t.includes("ideation") || t.includes("design sprint"))
    return "meeting_brainstorm";
  return "meeting_general";
}

// ── Sub-components ───────────────────────────────────────────────────────────

function CalendarEventCard({
  event,
  onUse,
}: {
  event: CalendarEvent;
  onUse: (event: CalendarEvent) => void;
}) {
  return (
    <div className="cal-event-card">
      <div className="cal-event-time">
        <Clock size={12} />
        {event.start_time} – {event.end_time}
      </div>
      <div className="cal-event-title">{event.title}</div>
      <div className="cal-event-meta">
        {event.attendees.length > 0 && (
          <span className="cal-event-attendees">
            <Users size={11} />
            {event.attendees.length} participant{event.attendees.length !== 1 ? "s" : ""}
          </span>
        )}
        {event.calendar_name && (
          <span className="cal-event-cal-name">{event.calendar_name}</span>
        )}
      </div>
      <button className="cal-event-use-btn" onClick={() => onUse(event)}>
        Use this meeting
      </button>
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
  googleCalendarToken,
  onConnectCalendar,
  onCalendarTokenInvalid,
}: MeetingsTabProps) {
  const [selectedTemplate, setSelectedTemplate] =
    useState<MeetingTemplate | null>(null);
  const [meetingTitle, setMeetingTitle] = useState("");
  const [participants, setParticipants] = useState("");
  const [phase, setPhase] = useState<Phase>("select");
  const [result, setResult] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  // Calendar state
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<"needs_reconnect" | "fetch_error" | null>(null);

  const outputRef = useRef<HTMLDivElement>(null);
  const unlistenRef = useRef<(() => void) | null>(null);

  // Fetch Google Calendar events when token is available
  useEffect(() => {
    if (!googleCalendarToken) {
      setCalendarEvents([]);
      setCalendarError(null);
      return;
    }

    setCalendarLoading(true);
    setCalendarError(null);

    // Fetch events for a 24-hour window around today
    const now = new Date();
    const timeMin = new Date(now);
    timeMin.setHours(0, 0, 0, 0);
    const timeMax = new Date(now);
    timeMax.setHours(23, 59, 59, 999);

    invoke<CalendarEvent[]>("get_calendar_events", {
      token: googleCalendarToken,
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
    })
      .then((events) => {
        setCalendarEvents(events);
        setCalendarError(null);
      })
      .catch((e: unknown) => {
        const msg = String(e);
        if (msg.includes("NEEDS_RECONNECT")) {
          setCalendarError("needs_reconnect");
          onCalendarTokenInvalid();
        } else {
          console.warn("[meetings] calendar fetch failed:", e);
          setCalendarError("fetch_error");
        }
      })
      .finally(() => setCalendarLoading(false));
  }, [googleCalendarToken, onCalendarTokenInvalid]);

  // Auto-scroll streaming output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [result]);

  // Cleanup listener on unmount
  useEffect(() => () => { unlistenRef.current?.(); }, []);

  // Run AI processing when transcript is ready and we're in processing phase
  const processTranscript = useCallback(async () => {
    if (!selectedTemplate || !transcript.trim()) return;

    // Build enriched prompt context from participants and title
    const context = [
      meetingTitle ? `Meeting: ${meetingTitle}` : "",
      participants.trim() ? `Participants: ${participants.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const enrichedText = context
      ? `${context}\n\n---\n\n${transcript}`
      : transcript;

    setStreaming(true);
    setResult("");
    setError("");

    unlistenRef.current?.();
    const unlisten = await listen<string>("ai-token", (evt) => {
      setResult((prev) => prev + evt.payload);
    });
    unlistenRef.current = unlisten;

    try {
      await invoke("ai_process_text", {
        text: enrichedText,
        mode: selectedTemplate,
      });
      setPhase("result");
    } catch (err) {
      setError(`${err}`);
      setPhase("result");
    } finally {
      unlisten();
      unlistenRef.current = null;
      setStreaming(false);
    }
  }, [selectedTemplate, transcript, meetingTitle, participants]);

  useEffect(() => {
    if (phase === "processing" && transcript.trim()) {
      processTranscript();
    }
  }, [phase, transcript, processTranscript]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSelectTemplate = (template: MeetingTemplate) => {
    setSelectedTemplate(template);
    setPhase("recording");
    setResult("");
    setError("");
  };

  const handleUseCalendarEvent = (event: CalendarEvent) => {
    setMeetingTitle(event.title);
    setParticipants(event.attendees.join(", "));
    setSelectedTemplate(guessTemplate(event.title));
    setPhase("recording");
    setResult("");
    setError("");
  };

  const handleStopRecording = () => {
    onStopRecording();
    setPhase("processing");
  };

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareByEmail = async () => {
    const emails = participants
      .split(/[,;]+/)
      .map((e) => e.trim())
      .filter((e) => e.includes("@"))
      .join(",");

    const subject = encodeURIComponent(
      `Meeting Notes: ${meetingTitle || "Meeting"}`
    );
    const body = encodeURIComponent(
      `Hi,\n\nPlease find the meeting notes below.\n\n---\n\n${result}\n\n---\n\nGenerated by OSCAR`
    );

    const mailto = emails
      ? `mailto:${emails}?subject=${subject}&body=${body}`
      : `mailto:?subject=${subject}&body=${body}`;

    await openUrl(mailto);
  };

  const handleNewMeeting = () => {
    unlistenRef.current?.();
    unlistenRef.current = null;
    setSelectedTemplate(null);
    setMeetingTitle("");
    setParticipants("");
    setPhase("select");
    setResult("");
    setError("");
    setStreaming(false);
    onClearTranscript();
  };

  const handleBack = () => {
    if (isRecording) onStopRecording();
    setPhase("select");
    setSelectedTemplate(null);
    setResult("");
    setError("");
    onClearTranscript();
  };

  const templateInfo = TEMPLATES.find((t) => t.id === selectedTemplate);
  const hasEmailableParticipants = participants
    .split(/[,;]+/)
    .some((e) => e.trim().includes("@"));

  // ── Phase: Template Selection ────────────────────────────────────────────

  if (phase === "select") {
    return (
      <div className="meetings-tab">
        <div className="meetings-container">
          <h1 className="meetings-title">Meetings</h1>
          <p className="meetings-subtitle">
            Choose a meeting type to record and generate structured notes
            automatically.
          </p>

          {/* Today's calendar events */}
          <div className="cal-section">
            <div className="cal-section-header">
              <CalendarDays size={15} />
              <span>Today's Meetings</span>
              {calendarLoading && <Loader2 size={12} className="spin" />}
            </div>

            {/* No token — prompt user to connect */}
            {!googleCalendarToken && !calendarLoading && (
              <div className="cal-empty">
                <Calendar size={28} className="cal-empty-icon" />
                <p className="cal-empty-text">Connect Google Calendar</p>
                <p className="cal-empty-hint">
                  See today's meetings here and auto-fill participant lists from your calendar.
                </p>
                <button className="cal-connect-btn" onClick={onConnectCalendar}>
                  Connect Google Calendar
                </button>
                <div className="cal-empty-note">
                  <Info size={12} />
                  You can still record and generate notes using any template below.
                </div>
              </div>
            )}

            {/* Token expired / revoked */}
            {calendarError === "needs_reconnect" && (
              <div className="cal-empty">
                <Calendar size={28} className="cal-empty-icon" />
                <p className="cal-empty-text">Calendar access expired</p>
                <p className="cal-empty-hint">
                  Your Google Calendar connection has expired. Reconnect to see today's events.
                </p>
                <button className="cal-connect-btn" onClick={onConnectCalendar}>
                  Reconnect Google Calendar
                </button>
              </div>
            )}

            {/* Generic fetch error */}
            {calendarError === "fetch_error" && (
              <div className="cal-empty">
                <p className="cal-empty-text">Couldn't load calendar events</p>
                <p className="cal-empty-hint">Check your internet connection and try again.</p>
              </div>
            )}

            {/* Loaded events */}
            {googleCalendarToken && !calendarError && !calendarLoading && (
              calendarEvents.length === 0 ? (
                <div className="cal-empty">
                  <Calendar size={28} className="cal-empty-icon" />
                  <p className="cal-empty-text">No meetings scheduled for today.</p>
                  <div className="cal-empty-note">
                    <Info size={12} />
                    You can still record and generate notes using any template below.
                  </div>
                </div>
              ) : (
                <div className="cal-events-list">
                  {calendarEvents.map((evt, i) => (
                    <CalendarEventCard
                      key={i}
                      event={evt}
                      onUse={handleUseCalendarEvent}
                    />
                  ))}
                </div>
              )
            )}
          </div>

          {/* Template grid */}
          <div className="cal-section-header" style={{ marginTop: 24, marginBottom: 12 }}>
            <FileText size={15} />
            <span>Or choose a template</span>
          </div>
          <div className="meetings-templates">
            {TEMPLATES.map(({ id, icon: Icon, name, desc }) => (
              <motion.button
                key={id}
                className="meeting-template-card"
                onClick={() => handleSelectTemplate(id)}
                whileHover={{ y: -2 }}
                transition={{ duration: 0.15 }}
              >
                <div className="meeting-template-icon">
                  <Icon size={20} />
                </div>
                <span className="meeting-template-name">{name}</span>
                <span className="meeting-template-desc">{desc}</span>
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Phase: Recording ─────────────────────────────────────────────────────

  if (phase === "recording") {
    return (
      <div className="meetings-tab">
        <div className="meetings-container">
          <button className="meeting-back-btn" onClick={handleBack}>
            <ChevronLeft size={18} />
            Back
          </button>

          {/* Meeting title */}
          <div className="meeting-meta-fields">
            <div className="meeting-field">
              <label className="meeting-field-label">Meeting Title</label>
              <input
                className="meeting-field-input"
                type="text"
                placeholder="e.g. Product Weekly Sync"
                value={meetingTitle}
                onChange={(e) => setMeetingTitle(e.target.value)}
              />
            </div>
            <div className="meeting-field">
              <label className="meeting-field-label">
                Participants
                <span className="meeting-field-hint">
                  — names or emails, comma-separated
                </span>
              </label>
              <input
                className="meeting-field-input"
                type="text"
                placeholder="Alice, bob@company.com, Charlie"
                value={participants}
                onChange={(e) => setParticipants(e.target.value)}
              />
            </div>
          </div>

          {/* Template badge */}
          {templateInfo && (
            <div className="meeting-recording-header">
              <div className="meeting-template-badge">
                <templateInfo.icon size={14} />
                {templateInfo.name}
              </div>
            </div>
          )}

          {/* Record button + timer */}
          <div className="meeting-recording">
            <div className="meeting-timer">{formatTime(recordingTime)}</div>

            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.15 }}
            >
              <button
                onClick={isRecording ? handleStopRecording : onStartRecording}
                className={`meeting-record-btn ${isRecording ? "recording" : ""}`}
              >
                {isRecording ? (
                  <Square size={32} fill="currentColor" />
                ) : (
                  <Mic size={32} />
                )}
              </button>
            </motion.div>

            <span className="meeting-recording-label">
              {isRecording
                ? "Recording… Click to stop"
                : "Click to start recording"}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ── Phase: Processing & Result ───────────────────────────────────────────

  return (
    <div className="meetings-tab">
      <div className="meetings-container">
        {/* Header */}
        <div className="meeting-result-top">
          <div>
            <h1 className="meetings-title">
              {meetingTitle || "Meeting Notes"}
            </h1>
            {meetingTitle && <p className="meetings-subtitle" style={{ marginBottom: 0 }}>
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>}
          </div>
          {templateInfo && (
            <div className="meeting-template-badge">
              <templateInfo.icon size={14} />
              {templateInfo.name}
            </div>
          )}
        </div>

        {/* Participants pill row */}
        {participants.trim() && (
          <div className="meeting-participants-row">
            <Users size={13} />
            <span>{participants}</span>
          </div>
        )}

        {/* Processing spinner */}
        {phase === "processing" && !result && !error && (
          <div className="meeting-processing">
            <Loader2 size={32} className="spin" />
            <span className="meeting-processing-label">
              {!transcript.trim()
                ? "Transcribing audio…"
                : "Generating meeting notes…"}
            </span>
          </div>
        )}

        {/* Result card */}
        {(result || error) && (
          <div className="meeting-result">
            <div className="meeting-result-header">
              <div className="meeting-result-title">
                <FileText size={14} />
                <span>Notes</span>
                {streaming && <span className="ai-thinking-dot" />}
              </div>
            </div>

            {error ? (
              <div className="meeting-result-error">{error}</div>
            ) : (
              <div className="meeting-result-text" ref={outputRef}>
                {result || (streaming && (
                  <span className="ai-cursor-blink">&#9613;</span>
                ))}
              </div>
            )}

            {!streaming && result && !error && (
              <div className="meeting-result-footer">
                <button
                  className="meeting-footer-btn meeting-footer-btn-primary"
                  onClick={handleCopy}
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? "Copied!" : "Copy Notes"}
                </button>

                {/* Share via email — shown when participants have email addresses */}
                <button
                  className={`meeting-footer-btn ${!hasEmailableParticipants ? "meeting-footer-btn-disabled" : ""}`}
                  onClick={handleShareByEmail}
                  title={
                    hasEmailableParticipants
                      ? "Open mail draft with notes"
                      : "Add participant email addresses to share"
                  }
                >
                  <Mail size={13} />
                  Share via Email
                </button>

                <button
                  className="meeting-footer-btn"
                  onClick={() => {
                    setResult("");
                    setError("");
                    setPhase("processing");
                    processTranscript();
                  }}
                >
                  <RotateCcw size={13} />
                  Retry
                </button>
                <button className="meeting-footer-btn" onClick={handleNewMeeting}>
                  <Mic size={13} />
                  New Meeting
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
