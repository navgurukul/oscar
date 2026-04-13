import { createClient } from "@/lib/supabase/client";
import type {
  MeetingAttendee,
  MeetingCalendarContext,
  MeetingTranscriptSegment,
  MeetingTypeHint,
  MeetingUpdate,
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

  async updateMeeting(
    id: string,
    updates: MeetingUpdate
  ): Promise<{ data: SavedMeetingRecord | null; error: Error | null }> {
    const supabase = getSupabase();

    const dbUpdates: Record<string, unknown> = {};
    if (updates.meetingTitle !== undefined)
      dbUpdates.meeting_title = updates.meetingTitle;
    if (updates.attendeesCompact !== undefined)
      dbUpdates.attendees_compact = updates.attendeesCompact;
    if (updates.attendeesFull !== undefined)
      dbUpdates.attendees_full = updates.attendeesFull;
    if (updates.meetingTypeHint !== undefined)
      dbUpdates.meeting_type_hint = updates.meetingTypeHint;
    if (updates.myNotesMarkdown !== undefined)
      dbUpdates.my_notes_markdown = updates.myNotesMarkdown;
    if (updates.notesMarkdown !== undefined)
      dbUpdates.notes_markdown = updates.notesMarkdown;

    const { data, error } = await supabase
      .from("meetings")
      .update(dbUpdates)
      .eq("id", id)
      .select()
      .single();

    if (error) return { data: null, error: error as Error };
    return { data: toSaved(data as DBMeeting), error: null };
  },

  async deleteMeeting(
    id: string
  ): Promise<{ error: Error | null }> {
    const supabase = getSupabase();
    const { error } = await supabase.from("meetings").delete().eq("id", id);
    return { error: error ? (error as Error) : null };
  },
};
