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
  Play,
  PenLine,
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
  { id: "meeting_general",   icon: FileText,      name: "General",    desc: "Key points, decisions, action items" },
  { id: "meeting_standup",   icon: Users,         name: "Standup",    desc: "Done, doing, blockers" },
  { id: "meeting_1on1",      icon: MessageSquare, name: "1:1",        desc: "Discussion & follow-ups" },
  { id: "meeting_brainstorm",icon: Lightbulb,     name: "Brainstorm", desc: "Ideas & next steps" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

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

/** Returns minutes since midnight for a "HH:MM" string */
function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Returns the first event that is currently happening or starting
 * within the next 5 minutes. Returns null if none.
 */
function findLiveEvent(events: CalendarEvent[]): CalendarEvent | null {
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  return (
    events.find((evt) => {
      const start = timeToMinutes(evt.start_time);
      const end   = timeToMinutes(evt.end_time);
      return nowMins >= start && nowMins <= end;          // happening now
    }) ||
    events.find((evt) => {
      const start = timeToMinutes(evt.start_time);
      return start > nowMins && start - nowMins <= 5;    // starting in ≤5 min
    }) ||
    null
  );
}

// ── Compact calendar event card (whole card is clickable) ───────────────────

function CalendarEventCard({
  event,
  onUse,
  isLive,
}: {
  event: CalendarEvent;
  onUse: (event: CalendarEvent) => void;
  isLive?: boolean;
}) {
  return (
    <button className={`cal-event-card${isLive ? " cal-event-live" : ""}`} onClick={() => onUse(event)}>
      <div className="cal-event-time">
        <Clock size={11} />
        {event.start_time} – {event.end_time}
        {isLive && <span className="cal-live-dot" />}
      </div>
      <div className="cal-event-title">{event.title}</div>
      {event.attendees.length > 0 && (
        <div className="cal-event-attendees">
          <Users size={10} />
          {event.attendees.length} participant{event.attendees.length !== 1 ? "s" : ""}
        </div>
      )}
    </button>
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
  const [selectedTemplate, setSelectedTemplate] = useState<MeetingTemplate | null>(null);
  const [meetingTitle, setMeetingTitle]         = useState("");
  const [participants, setParticipants]         = useState("");
  const [manualNotes, setManualNotes]           = useState("");
  const [phase, setPhase]                       = useState<Phase>("select");
  const [result, setResult]                     = useState("");
  const [streaming, setStreaming]               = useState(false);
  const [error, setError]                       = useState("");
  const [copied, setCopied]                     = useState(false);

  // Calendar state
  const [calendarEvents, setCalendarEvents]   = useState<CalendarEvent[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError]     = useState<"needs_reconnect" | "fetch_error" | null>(null);
  const [calendarErrorMsg, setCalendarErrorMsg] = useState("");
  const [liveEvent, setLiveEvent]             = useState<CalendarEvent | null>(null);

  const outputRef   = useRef<HTMLDivElement>(null);
  const unlistenRef = useRef<(() => void) | null>(null);
  const notesRef    = useRef<HTMLTextAreaElement>(null);

  // Fetch Google Calendar events when token is available
  useEffect(() => {
    if (!googleCalendarToken) {
      setCalendarEvents([]);
      setCalendarError(null);
      setLiveEvent(null);
      return;
    }

    setCalendarLoading(true);
    setCalendarError(null);

    const now = new Date();
    const timeMin = new Date(now); timeMin.setHours(0, 0, 0, 0);
    const timeMax = new Date(now); timeMax.setHours(23, 59, 59, 999);

    invoke<CalendarEvent[]>("get_calendar_events", {
      token: googleCalendarToken,
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
    })
      .then((events) => {
        setCalendarEvents(events);
        setCalendarError(null);
        setLiveEvent(findLiveEvent(events));
      })
      .catch((e: unknown) => {
        const msg = String(e);
        if (msg.includes("NEEDS_RECONNECT")) {
          setCalendarError("needs_reconnect");
          setCalendarErrorMsg("");
          onCalendarTokenInvalid();
        } else {
          console.warn("[meetings] calendar fetch failed:", e);
          setCalendarError("fetch_error");
          setCalendarErrorMsg(msg.replace(/^Error:\s*/i, "").slice(0, 200));
        }
      })
      .finally(() => setCalendarLoading(false));
  }, [googleCalendarToken, onCalendarTokenInvalid]);

  // Re-check live event every minute
  useEffect(() => {
    if (!calendarEvents.length) return;
    const id = setInterval(() => setLiveEvent(findLiveEvent(calendarEvents)), 60_000);
    return () => clearInterval(id);
  }, [calendarEvents]);

  // Auto-scroll streaming output
  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [result]);

  // Cleanup listener on unmount
  useEffect(() => () => { unlistenRef.current?.(); }, []);

  // AI processing
  const processTranscript = useCallback(async () => {
    if (!selectedTemplate || (!transcript.trim() && !manualNotes.trim())) return;

    const context = [
      meetingTitle ? `Meeting: ${meetingTitle}` : "",
      participants.trim() ? `Participants: ${participants.trim()}` : "",
    ].filter(Boolean).join("\n");

    const parts = [
      context,
      manualNotes.trim() ? `My notes:\n${manualNotes.trim()}` : "",
      transcript.trim() ? `Transcript:\n${transcript.trim()}` : "",
    ].filter(Boolean);

    const enrichedText = parts.join("\n\n---\n\n");

    setStreaming(true);
    setResult("");
    setError("");

    unlistenRef.current?.();
    const unlisten = await listen<string>("ai-token", (evt) => {
      setResult((prev) => prev + evt.payload);
    });
    unlistenRef.current = unlisten;

    try {
      await invoke("ai_process_text", { text: enrichedText, mode: selectedTemplate });
      setPhase("result");
    } catch (err) {
      setError(`${err}`);
      setPhase("result");
    } finally {
      unlisten();
      unlistenRef.current = null;
      setStreaming(false);
    }
  }, [selectedTemplate, transcript, manualNotes, meetingTitle, participants]);

  useEffect(() => {
    if (phase === "processing" && (transcript.trim() || manualNotes.trim())) {
      processTranscript();
    }
  }, [phase, transcript, manualNotes, processTranscript]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const startFromEvent = (event: CalendarEvent) => {
    setMeetingTitle(event.title);
    setParticipants(event.attendees.join(", "));
    setSelectedTemplate(guessTemplate(event.title));
    setPhase("recording");
    setResult("");
    setError("");
    setManualNotes("");
  };

  const handleSelectTemplate = (template: MeetingTemplate) => {
    setSelectedTemplate(template);
    setPhase("recording");
    setResult("");
    setError("");
    setManualNotes("");
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
    const emails = participants.split(/[,;]+/).map((e) => e.trim()).filter((e) => e.includes("@")).join(",");
    const subject = encodeURIComponent(`Meeting Notes: ${meetingTitle || "Meeting"}`);
    const body    = encodeURIComponent(`Hi,\n\nPlease find the meeting notes below.\n\n---\n\n${result}\n\n---\n\nGenerated by OSCAR`);
    await openUrl(emails ? `mailto:${emails}?subject=${subject}&body=${body}` : `mailto:?subject=${subject}&body=${body}`);
  };

  const handleNewMeeting = () => {
    unlistenRef.current?.();
    unlistenRef.current = null;
    setSelectedTemplate(null);
    setMeetingTitle("");
    setParticipants("");
    setManualNotes("");
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
    setManualNotes("");
    onClearTranscript();
  };

  const templateInfo = TEMPLATES.find((t) => t.id === selectedTemplate);
  const hasEmailableParticipants = participants.split(/[,;]+/).some((e) => e.trim().includes("@"));

  // ── Phase: Select ────────────────────────────────────────────────────────

  if (phase === "select") {
    return (
      <div className="meetings-tab">
        <div className="meetings-container">
          <h1 className="meetings-title">Meetings</h1>

          {/* ── Live meeting banner (Granola-style) ── */}
          {liveEvent && (
            <motion.div
              className="meeting-live-banner"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="meeting-live-banner-dot" />
              <div className="meeting-live-banner-text">
                <span className="meeting-live-banner-label">
                  {timeToMinutes(liveEvent.start_time) > new Date().getHours() * 60 + new Date().getMinutes()
                    ? "Starting soon"
                    : "In progress"}
                </span>
                <span className="meeting-live-banner-title">{liveEvent.title}</span>
              </div>
              <button
                className="meeting-live-banner-btn"
                onClick={() => startFromEvent(liveEvent)}
              >
                <Play size={12} fill="currentColor" />
                Record
              </button>
            </motion.div>
          )}

          {/* ── Today's calendar events ── */}
          <div className="cal-section">
            <div className="cal-section-header">
              <CalendarDays size={14} />
              <span>Today</span>
              {calendarLoading && <Loader2 size={12} className="spin" />}
            </div>

            {!googleCalendarToken && !calendarLoading && (
              <div className="cal-empty">
                <Calendar size={24} className="cal-empty-icon" />
                <p className="cal-empty-text">Connect Google Calendar</p>
                <p className="cal-empty-hint">See today's meetings and start recording in one tap.</p>
                <button className="cal-connect-btn" onClick={onConnectCalendar}>
                  Connect Google Calendar
                </button>
              </div>
            )}

            {calendarError === "needs_reconnect" && (
              <div className="cal-empty">
                <p className="cal-empty-text">Calendar access expired</p>
                <button className="cal-connect-btn" onClick={onConnectCalendar}>
                  Reconnect
                </button>
              </div>
            )}

            {calendarError === "fetch_error" && (
              <div className="cal-empty">
                <p className="cal-empty-text">Couldn't load events</p>
                <p className="cal-empty-hint">
                  {calendarErrorMsg.includes("not been used") || calendarErrorMsg.includes("disabled")
                    ? "Enable the Google Calendar API in Cloud Console."
                    : calendarErrorMsg.includes("403") || calendarErrorMsg.includes("PERMISSION_DENIED")
                    ? "Permission denied — check Calendar API & OAuth scopes."
                    : calendarErrorMsg || "Check your internet connection."}
                </p>
                <button className="cal-connect-btn" onClick={onConnectCalendar} style={{ marginTop: 8 }}>
                  Reconnect
                </button>
              </div>
            )}

            {googleCalendarToken && !calendarError && !calendarLoading && (
              calendarEvents.length === 0 ? (
                <div className="cal-empty">
                  <p className="cal-empty-hint">No meetings scheduled for today.</p>
                </div>
              ) : (
                <div className="cal-events-list">
                  {calendarEvents.map((evt, i) => (
                    <CalendarEventCard
                      key={i}
                      event={evt}
                      onUse={startFromEvent}
                      isLive={liveEvent?.title === evt.title && liveEvent?.start_time === evt.start_time}
                    />
                  ))}
                </div>
              )
            )}
          </div>

          {/* ── Template grid ── */}
          <div className="cal-section-header" style={{ marginTop: 20, marginBottom: 10 }}>
            <FileText size={14} />
            <span>Start without calendar</span>
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
                <div className="meeting-template-icon"><Icon size={18} /></div>
                <span className="meeting-template-name">{name}</span>
                <span className="meeting-template-desc">{desc}</span>
              </motion.button>
            ))}
          </div>

          {!googleCalendarToken && (
            <div className="cal-empty-note" style={{ marginTop: 16 }}>
              <Info size={11} />
              Connect Google Calendar above to auto-detect meetings.
            </div>
          )}
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
            <ChevronLeft size={16} />
            Back
          </button>

          {/* Title + participants row */}
          <div className="meeting-meta-fields">
            <input
              className="meeting-field-input meeting-title-input"
              type="text"
              placeholder="Meeting title"
              value={meetingTitle}
              onChange={(e) => setMeetingTitle(e.target.value)}
            />
            <input
              className="meeting-field-input"
              type="text"
              placeholder="Participants — names or emails, comma-separated"
              value={participants}
              onChange={(e) => setParticipants(e.target.value)}
            />
          </div>

          {/* Record button + timer */}
          <div className="meeting-recording">
            <motion.button
              className={`meeting-record-btn ${isRecording ? "recording" : ""}`}
              onClick={isRecording ? handleStopRecording : onStartRecording}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              transition={{ duration: 0.15 }}
            >
              {isRecording ? <Square size={28} fill="currentColor" /> : <Mic size={28} />}
            </motion.button>

            <div className="meeting-recording-status">
              {isRecording
                ? <><span className="meeting-rec-dot" /><span className="meeting-timer">{formatTime(recordingTime)}</span></>
                : <span className="meeting-recording-label">Tap to start recording</span>
              }
            </div>

            {templateInfo && (
              <div className="meeting-template-badge">
                <templateInfo.icon size={12} />
                {templateInfo.name}
              </div>
            )}
          </div>

          {/* ── Simultaneous notes area (Granola-style) ── */}
          <div className="meeting-notes-section">
            <div className="meeting-notes-header">
              <PenLine size={13} />
              <span>Your notes</span>
              <span className="meeting-notes-hint">type freely while recording</span>
            </div>
            <textarea
              ref={notesRef}
              className="meeting-notes-area"
              placeholder="Jot down key points, action items, or anything worth remembering…"
              value={manualNotes}
              onChange={(e) => setManualNotes(e.target.value)}
              rows={6}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Phase: Processing & Result ───────────────────────────────────────────

  return (
    <div className="meetings-tab">
      <div className="meetings-container">
        <div className="meeting-result-top">
          <div>
            <h1 className="meetings-title">{meetingTitle || "Meeting Notes"}</h1>
            {meetingTitle && (
              <p className="meetings-subtitle" style={{ marginBottom: 0 }}>
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </p>
            )}
          </div>
          {templateInfo && (
            <div className="meeting-template-badge">
              <templateInfo.icon size={13} />
              {templateInfo.name}
            </div>
          )}
        </div>

        {participants.trim() && (
          <div className="meeting-participants-row">
            <Users size={12} />
            <span>{participants}</span>
          </div>
        )}

        {phase === "processing" && !result && !error && (
          <div className="meeting-processing">
            <Loader2 size={28} className="spin" />
            <span className="meeting-processing-label">
              {!transcript.trim() ? "Transcribing audio…" : "Generating meeting notes…"}
            </span>
          </div>
        )}

        {(result || error) && (
          <div className="meeting-result">
            <div className="meeting-result-header">
              <div className="meeting-result-title">
                <FileText size={13} />
                <span>Notes</span>
                {streaming && <span className="ai-thinking-dot" />}
              </div>
            </div>

            {error ? (
              <div className="meeting-result-error">{error}</div>
            ) : (
              <div className="meeting-result-text" ref={outputRef}>
                {result || (streaming && <span className="ai-cursor-blink">&#9613;</span>)}
              </div>
            )}

            {!streaming && result && !error && (
              <div className="meeting-result-footer">
                <button className="meeting-footer-btn meeting-footer-btn-primary" onClick={handleCopy}>
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? "Copied!" : "Copy"}
                </button>
                <button
                  className={`meeting-footer-btn ${!hasEmailableParticipants ? "meeting-footer-btn-disabled" : ""}`}
                  onClick={handleShareByEmail}
                  title={hasEmailableParticipants ? "Open mail draft" : "Add participant emails to share"}
                >
                  <Mail size={12} />
                  Email
                </button>
                <button className="meeting-footer-btn" onClick={() => { setResult(""); setError(""); setPhase("processing"); processTranscript(); }}>
                  <RotateCcw size={12} />
                  Retry
                </button>
                <button className="meeting-footer-btn" onClick={handleNewMeeting}>
                  <Mic size={12} />
                  New
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
