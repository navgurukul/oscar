import { supabase } from "../supabase";
import type {
  MeetingAttendee,
  MeetingCalendarContext,
  MeetingTranscriptSegment,
  MeetingTypeHint,
  SavedMeetingRecord,
} from "../types/meeting.types";

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

export const meetingsService = {
  async getMeetings(): Promise<{
    data: SavedMeetingRecord[] | null;
    error: Error | null;
  }> {
    const { data, error } = await supabase
      .from("meetings")
      .select("*")
      .order("started_at", { ascending: false });

    if (error) return { data: null, error: error as Error };
    return { data: (data ?? []).map((row) => toSaved(row as DBMeeting)), error: null };
  },

  async saveMeeting(
    meeting: SavedMeetingRecord,
    userId: string,
  ): Promise<{ error: Error | null }> {
    const { error } = await supabase.from("meetings").upsert(
      {
        id: meeting.id,
        user_id: userId,
        started_at: meeting.startedAt,
        meeting_title: meeting.meetingTitle,
        meeting_local_datetime: meeting.meetingLocalDatetime,
        attendees_compact: meeting.attendeesCompact,
        attendees_full: meeting.attendeesFull,
        calendar_context: meeting.calendarContext,
        meeting_type_hint: meeting.meetingTypeHint,
        transcript: meeting.transcript,
        transcript_segments: meeting.transcriptSegments,
        my_notes_markdown: meeting.myNotesMarkdown,
        notes_markdown: meeting.notesMarkdown,
      },
      { onConflict: "id" },
    );
    return { error: error as Error | null };
  },

  async deleteMeeting(id: string): Promise<{ error: Error | null }> {
    const { error } = await supabase.from("meetings").delete().eq("id", id);
    return { error: error as Error | null };
  },
};
