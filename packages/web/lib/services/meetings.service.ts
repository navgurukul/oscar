import { createClient } from "@/lib/supabase/client";
import type {
  MeetingAttendee,
  MeetingCalendarContext,
  MeetingTranscriptSegment,
  MeetingTypeHint,
  SavedMeetingRecord,
} from "@oscar/shared/types";

interface DBMeeting {
  id: string;
  user_id: string;
  started_at: string;
  meeting_title: string;
  meeting_local_datetime: string;
  attendees_compact: string;
  attendees_full: MeetingAttendee[] | null;
  calendar_context: MeetingCalendarContext | null;
  meeting_type_hint: MeetingTypeHint;
  transcript: string;
  transcript_segments: MeetingTranscriptSegment[] | null;
  my_notes_markdown: string;
  notes_markdown: string;
  created_at: string;
}

function toSaved(row: DBMeeting): SavedMeetingRecord {
  return {
    id: row.id,
    startedAt: row.started_at,
    meetingTitle: row.meeting_title,
    meetingLocalDatetime: row.meeting_local_datetime,
    attendeesCompact: row.attendees_compact,
    attendeesFull: row.attendees_full ?? [],
    calendarContext: row.calendar_context,
    meetingTypeHint: row.meeting_type_hint,
    transcript: row.transcript,
    transcriptSegments: row.transcript_segments ?? [],
    myNotesMarkdown: row.my_notes_markdown,
    notesMarkdown: row.notes_markdown,
    createdAt: row.created_at,
  };
}

function getSupabase() {
  return createClient();
}

export const meetingsService = {
  async getMeetings(): Promise<{
    data: SavedMeetingRecord[] | null;
    error: Error | null;
  }> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("meetings")
      .select("*")
      .order("started_at", { ascending: false });

    if (error) return { data: null, error: error as Error };
    return {
      data: (data ?? []).map((row) => toSaved(row as DBMeeting)),
      error: null,
    };
  },
};
