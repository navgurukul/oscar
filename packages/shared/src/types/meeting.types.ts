export type MeetingTypeHint =
  | "auto"
  | "discovery"
  | "1on1"
  | "standup"
  | "general";

export type MeetingTranscriptSource = "microphone" | "speaker";

export interface MeetingAttendee {
  name: string;
  email: string;
}

export interface MeetingCalendarContext {
  scheduled_start_time: string;
  scheduled_end_time: string;
  organizer_email: string;
  event_title: string;
}

export interface MeetingTranscriptSegment {
  id: string;
  speaker: {
    source: MeetingTranscriptSource;
    diarization_label?: string;
  };
  text: string;
  start_time: string;
  end_time: string;
}

export interface EnhancedMeetingNoteRequest {
  meeting_title: string;
  meeting_local_datetime: string;
  attendees_compact: string;
  attendees_full: MeetingAttendee[];
  calendar_context: MeetingCalendarContext | null;
  my_notes_markdown: string;
  transcript_segments: MeetingTranscriptSegment[];
  meeting_type_hint: MeetingTypeHint;
}

export interface EnhancedMeetingNoteResponse {
  markdown: string;
}

export interface SavedMeetingRecord {
  id: string;
  startedAt: string;
  meetingTitle: string;
  meetingLocalDatetime: string;
  attendeesCompact: string;
  attendeesFull: MeetingAttendee[];
  calendarContext: MeetingCalendarContext | null;
  meetingTypeHint: MeetingTypeHint;
  transcript: string;
  transcriptSegments: MeetingTranscriptSegment[];
  myNotesMarkdown: string;
  notesMarkdown: string;
  createdAt: string;
}
