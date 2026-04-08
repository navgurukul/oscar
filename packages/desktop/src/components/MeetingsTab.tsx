import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
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
  Calendar,
  Clock,
  Mail,
  CalendarDays,
  Play,
  PenLine,
  Settings,
  X,
  Trash2,
  History,
} from "lucide-react";
import { motion } from "framer-motion";

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
  systemAudioWarning?: string;
  googleCalendarToken: string;
  onConnectCalendar: () => void;
  onCalendarTokenInvalid: () => void;
  templates: MeetingTemplateData[];
  onManageTemplates: () => void;
  savedMeetings: SavedMeeting[];
  onSaveMeeting: (meeting: SavedMeeting) => void;
  onDeleteMeeting: (id: string) => void;
}

// ── Default templates ───────────────────────────────────────────────────────

export const DEFAULT_TEMPLATES: MeetingTemplateData[] = [
  { id: "meeting_general",    name: "General",    desc: "Key points, decisions, action items", prompt: "", builtin: true },
  { id: "meeting_standup",    name: "Standup",    desc: "Done, doing, blockers",              prompt: "", builtin: true },
  { id: "meeting_1on1",       name: "1:1",        desc: "Discussion & follow-ups",            prompt: "", builtin: true },
  { id: "meeting_brainstorm", name: "Brainstorm", desc: "Ideas & next steps",                 prompt: "", builtin: true },
];

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

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function findLiveEvent(events: CalendarEvent[]): CalendarEvent | null {
  const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
  return (
    events.find((evt) => {
      const start = timeToMinutes(evt.start_time);
      const end   = timeToMinutes(evt.end_time);
      return nowMins >= start && nowMins <= end;
    }) ||
    events.find((evt) => {
      const start = timeToMinutes(evt.start_time);
      return start > nowMins && start - nowMins <= 5;
    }) ||
    null
  );
}

// ── Compact calendar event card ─────────────────────────────────────────────

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
          {event.attendees.length}
        </div>
      )}
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
    <div className="tpl-picker" ref={ref}>
      <button className="tpl-picker-btn" onClick={() => setOpen(!open)}>
        <FileText size={12} />
        <span>{selected?.name || "Template"}</span>
        <ChevronDown size={12} className={open ? "tpl-chevron-open" : ""} />
      </button>
      {open && (
        <div className="tpl-picker-menu">
          {templates.map((t) => (
            <button
              key={t.id}
              className={`tpl-picker-item${t.id === selectedId ? " active" : ""}`}
              onClick={() => { onChange(t.id); setOpen(false); }}
            >
              <span className="tpl-picker-item-name">{t.name}</span>
              <span className="tpl-picker-item-desc">{t.desc}</span>
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
  const [liveEvent, setLiveEvent]               = useState<CalendarEvent | null>(null);
  const lastCalendarFetchRef = useRef<string>("");

  const outputRef   = useRef<HTMLDivElement>(null);
  const unlistenRef = useRef<(() => void) | null>(null);

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
      setCalendarEvents([]); setCalendarError(null); setLiveEvent(null);
      lastCalendarFetchRef.current = "";
      return;
    }
    const now = new Date();
    const dateKey = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const cacheKey = `${googleCalendarToken.slice(0, 16)}:${dateKey}`;
    if (cacheKey === lastCalendarFetchRef.current && calendarEvents.length > 0) {
      // Same token + date, already have data — just refresh live event
      setLiveEvent(findLiveEvent(calendarEvents));
      return;
    }
    setCalendarLoading(true); setCalendarError(null);
    const timeMin = new Date(now); timeMin.setHours(0, 0, 0, 0);
    const timeMax = new Date(now); timeMax.setHours(23, 59, 59, 999);

    invoke<CalendarEvent[]>("get_calendar_events", {
      token: googleCalendarToken, timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString(),
    })
      .then((events) => {
        setCalendarEvents(events); setCalendarError(null); setLiveEvent(findLiveEvent(events));
        lastCalendarFetchRef.current = cacheKey;
      })
      .catch((e: unknown) => {
        const msg = String(e);
        if (msg.includes("NEEDS_RECONNECT")) {
          setCalendarError("needs_reconnect"); setCalendarErrorMsg(""); onCalendarTokenInvalid();
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

  useEffect(() => { if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight; }, [result]);
  useEffect(() => () => { unlistenRef.current?.(); }, []);

  // AI processing — resolve template to mode
  const processTranscript = useCallback(async () => {
    if (!selectedTemplateId || (!transcript.trim() && !manualNotes.trim())) return;

    const tpl = templates.find((t) => t.id === selectedTemplateId);
    const isCustom = tpl && !tpl.builtin;

    const context = [
      meetingTitle ? `Meeting: ${meetingTitle}` : "",
      participants.trim() ? `Participants: ${participants.trim()}` : "",
    ].filter(Boolean).join("\n");

    // For custom templates, prepend the custom instructions
    const customInstructions = isCustom && tpl?.prompt
      ? `Template instructions: ${tpl.prompt}`
      : "";

    const parts = [
      customInstructions,
      context,
      manualNotes.trim() ? `My notes:\n${manualNotes.trim()}` : "",
      transcript.trim() ? `Transcript:\n${transcript.trim()}` : "",
    ].filter(Boolean);

    const enrichedText = parts.join("\n\n---\n\n");
    const mode = isCustom ? "meeting_custom" : selectedTemplateId;

    setStreaming(true); setResult(""); setError("");
    unlistenRef.current?.();
    const unlisten = await listen<string>("ai-token", (evt) => {
      setResult((prev) => prev + evt.payload);
    });
    unlistenRef.current = unlisten;

    try {
      await invoke("ai_process_text", { text: enrichedText, mode });
      setPhase("result");
    } catch (err) {
      setError(`${err}`); setPhase("result");
    } finally {
      unlisten(); unlistenRef.current = null; setStreaming(false);
    }
  }, [selectedTemplateId, transcript, manualNotes, meetingTitle, participants, templates]);

  useEffect(() => {
    if (phase === "processing" && (transcript.trim() || manualNotes.trim())) processTranscript();
  }, [phase, transcript, manualNotes, processTranscript]);

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

  const handleStopRecording = () => { onStopRecording(); setPhase("processing"); };

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
    unlistenRef.current?.(); unlistenRef.current = null;
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

  const systemAudioNotice = systemAudioWarning ? (
    <div
      style={{
        marginBottom: 16,
        padding: "12px 14px",
        borderRadius: 12,
        background: "#fff7ed",
        border: "1px solid #fdba74",
        color: "#9a3412",
        fontSize: "0.9rem",
        lineHeight: 1.5,
      }}
    >
      {systemAudioWarning}
    </div>
  ) : null;

  // ── Phase: Select ────────────────────────────────────────────────────────

  if (phase === "select") {
    return (
      <div className="meetings-tab">
        <div className="meetings-container">
          <div className="meetings-header-row">
            <h1 className="meetings-title">Minutes</h1>
            <button className="meetings-manage-tpl-btn" onClick={onManageTemplates} title="Manage templates">
              <Settings size={14} />
              Templates
            </button>
          </div>

          {/* Info card */}
          <div className="minutes-info-card">
            <p className="minutes-info-card-title">Record your meeting — AI writes structured notes the moment you stop.</p>
            <p className="minutes-info-card-sub">Key Decisions · Action Items · Follow-ups</p>
          </div>

          {systemAudioNotice}

          {/* ── Live meeting banner ── */}
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
              <button className="meeting-live-banner-btn" onClick={() => startFromEvent(liveEvent)}>
                <Play size={12} fill="currentColor" />
                Record
              </button>
            </motion.div>
          )}

          {/* ── Today's calendar ── */}
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
                <button className="cal-connect-btn" onClick={onConnectCalendar}>Connect Google Calendar</button>
              </div>
            )}

            {calendarError === "needs_reconnect" && (
              <div className="cal-empty">
                <p className="cal-empty-text">Calendar access expired</p>
                <button className="cal-connect-btn" onClick={onConnectCalendar}>Reconnect</button>
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
                <button className="cal-connect-btn" onClick={onConnectCalendar} style={{ marginTop: 8 }}>Reconnect</button>
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


          {/* ── Previous meetings ── */}
          {savedMeetings.length > 0 && (
            <div className="prev-meetings-section">
              <div className="cal-section-header">
                <History size={14} />
                <span>Previous meetings</span>
              </div>
              <div className="prev-meetings-list">
                {savedMeetings
                  .slice()
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((m) => (
                    <button
                      key={m.id}
                      className="prev-meeting-card"
                      onClick={() => { setViewingSaved(m); setResultTab("notes"); setPhase("view_saved"); }}
                    >
                      <div className="prev-meeting-top">
                        <span className="prev-meeting-title">{m.title}</span>
                        <span className="prev-meeting-date">
                          {new Date(m.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      </div>
                      {m.participants.length > 0 && (
                        <div className="prev-meeting-meta">
                          <Users size={10} />
                          <span>{m.participants.length} participant{m.participants.length !== 1 ? "s" : ""}</span>
                        </div>
                      )}
                      <div className="prev-meeting-preview">
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
      <div className="meetings-tab">
        <div className="meetings-container">
          <button className="meeting-back-btn" onClick={() => { setPhase("select"); setViewingSaved(null); }}>
            <ChevronLeft size={16} /> Back
          </button>

          {systemAudioNotice}

          <div className="meeting-result-top">
            <div>
              <h1 className="meetings-title">{viewingSaved.title}</h1>
              <p className="meetings-subtitle" style={{ marginBottom: 0 }}>
                {new Date(viewingSaved.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </p>
            </div>
            <button
              className="prev-meeting-delete-btn"
              onClick={() => {
                onDeleteMeeting(viewingSaved.id);
                setPhase("select"); setViewingSaved(null);
              }}
              title="Delete meeting"
            >
              <Trash2 size={14} />
            </button>
          </div>

          {viewingSaved.participants.length > 0 && (
            <div className="meeting-participants-pills result-pills">
              {viewingSaved.participants.map((p, i) => (
                <span key={i} className="participant-pill">
                  <span className="participant-pill-text">{p}</span>
                </span>
              ))}
            </div>
          )}

          {/* Tabs: Notes / Transcript */}
          <div className="meeting-result-tabs">
            <button
              className={`meeting-result-tab${resultTab === "notes" ? " active" : ""}`}
              onClick={() => setResultTab("notes")}
            >
              <FileText size={13} />
              Notes
            </button>
            <button
              className={`meeting-result-tab${resultTab === "transcript" ? " active" : ""}`}
              onClick={() => setResultTab("transcript")}
            >
              <Mic size={13} />
              Transcript
            </button>
          </div>

          {resultTab === "notes" && (
            <div className="meeting-result">
              <div className="meeting-result-text">
                {viewingSaved.notes}
              </div>
              <div className="meeting-result-footer">
                <button className="meeting-footer-btn meeting-footer-btn-primary" onClick={async () => {
                  await navigator.clipboard.writeText(viewingSaved.notes);
                  setCopied(true); setTimeout(() => setCopied(false), 2000);
                }}>
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? "Copied!" : "Copy"}
                </button>
                <button className="meeting-footer-btn" onClick={async () => {
                  const emails = viewingSaved.participants.filter((e) => e.includes("@")).join(",");
                  const subject = encodeURIComponent(`Meeting Notes: ${viewingSaved.title}`);
                  const body = encodeURIComponent(`Hi,\n\nPlease find the meeting notes below.\n\n---\n\n${viewingSaved.notes}\n\n---\n\nGenerated by OSCAR`);
                  await openUrl(emails ? `mailto:${emails}?subject=${subject}&body=${body}` : `mailto:?subject=${subject}&body=${body}`);
                }}>
                  <Mail size={12} /> Email
                </button>
              </div>
            </div>
          )}

          {resultTab === "transcript" && (
            <div className="meeting-transcript-view">
              {viewingSaved.transcript.trim() ? (
                <div className="meeting-transcript-text">{viewingSaved.transcript}</div>
              ) : (
                <div className="meeting-transcript-empty">
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
      <div className="meetings-tab meeting-recording-phase">
        <div className="meetings-container">
          <button className="meeting-back-btn" onClick={handleBack}>
            <ChevronLeft size={16} /> Back
          </button>

          {systemAudioNotice}

          {/* Title + participants (borderless, inline editing) */}
          <div className="meeting-meta-fields">
            <input
              className="meeting-field-borderless meeting-title-input"
              type="text"
              placeholder="Meeting title"
              value={meetingTitle}
              onChange={(e) => setMeetingTitle(e.target.value)}
            />
            <div className="meeting-participants-pills">
              {participantsList.map((p, i) => (
                <span key={i} className="participant-pill">
                  <span className="participant-pill-text">{p}</span>
                  <button className="participant-pill-remove" onClick={() => removeParticipant(i)}>
                    <X size={10} />
                  </button>
                </span>
              ))}
              <input
                className="meeting-participant-input"
                type="text"
                placeholder={participantsList.length === 0 ? "Add participants (email or name, press Enter)" : "Add more..."}
                value={participantInput}
                onChange={(e) => setParticipantInput(e.target.value)}
                onKeyDown={handleParticipantKeyDown}
                onBlur={handleParticipantBlur}
              />
            </div>
          </div>

          {/* Template picker */}
          <div className="meeting-recording-toolbar">
            <TemplatePicker
              templates={templates}
              selectedId={selectedTemplateId}
              onChange={setSelectedTemplateId}
            />
          </div>

          {/* ── Simultaneous notes area ── */}
          <div className="meeting-notes-section">
            <div className="meeting-notes-header">
              <PenLine size={13} />
              <span>Your notes</span>
              <span className="meeting-notes-hint">type freely while recording</span>
            </div>
            <textarea
              className="meeting-notes-area"
              placeholder="Jot down key points, action items, or anything worth remembering…"
              value={manualNotes}
              onChange={(e) => setManualNotes(e.target.value)}
              rows={6}
            />
          </div>
        </div>

        {/* ── Fixed bottom-center record button ── */}
        <div className="meeting-record-dock">
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
        </div>
      </div>
    );
  }

  // ── Phase: Processing & Result ───────────────────────────────────────────

  return (
    <div className="meetings-tab">
      <div className="meetings-container">
        {systemAudioNotice}

        <div className="meeting-result-top">
          <div>
            <h1 className="meetings-title">{meetingTitle || "Meeting Notes"}</h1>
            {meetingTitle && (
              <p className="meetings-subtitle" style={{ marginBottom: 0 }}>
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </p>
            )}
          </div>
          {selectedTpl && (
            <div className="meeting-template-badge">
              <FileText size={12} />
              {selectedTpl.name}
            </div>
          )}
        </div>

        {participantsList.length > 0 && (
          <div className="meeting-participants-pills result-pills">
            {participantsList.map((p, i) => (
              <span key={i} className="participant-pill">
                <span className="participant-pill-text">{p}</span>
                <button className="participant-pill-remove" onClick={() => removeParticipant(i)}>
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Tabs: Notes / Transcript */}
        <div className="meeting-result-tabs">
          <button
            className={`meeting-result-tab${resultTab === "notes" ? " active" : ""}`}
            onClick={() => setResultTab("notes")}
          >
            <FileText size={13} />
            Notes
            {streaming && resultTab === "notes" && <span className="ai-thinking-dot" />}
          </button>
          <button
            className={`meeting-result-tab${resultTab === "transcript" ? " active" : ""}`}
            onClick={() => setResultTab("transcript")}
          >
            <Mic size={13} />
            Transcript
          </button>
        </div>

        {resultTab === "notes" && (
          <>
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
                      title={hasEmailableParticipants ? "Open mail draft" : "Add emails to share"}
                    >
                      <Mail size={12} /> Email
                    </button>
                    <button className="meeting-footer-btn" onClick={() => { setResult(""); setError(""); setPhase("processing"); processTranscript(); }}>
                      <RotateCcw size={12} /> Retry
                    </button>
                    <button className="meeting-footer-btn" onClick={handleNewMeeting}>
                      <Mic size={12} /> New
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {resultTab === "transcript" && (
          <div className="meeting-transcript-view">
            {transcript.trim() ? (
              <div className="meeting-transcript-text">{transcript}</div>
            ) : (
              <div className="meeting-transcript-empty">
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
