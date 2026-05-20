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
  started_at?: string;
  meeting_title?: string;
  meeting_local_datetime?: string;
  attendees_compact?: string;
  attendees_full?: MeetingAttendee[] | null;
  calendar_context?: MeetingCalendarContext | null;
  meeting_type_hint?: MeetingTypeHint;
  transcript: string;
  transcript_segments?: MeetingTranscriptSegment[] | null;
  my_notes_markdown?: string;
  notes_markdown?: string;
  created_at: string;
  title?: string;
  date?: string;
  participants?: string[] | null;
  notes?: string;
  template_id?: string;
}

function attendeeLabel(attendee: MeetingAttendee): string {
  return attendee.name || attendee.email;
}

function attendeesFromLegacy(participants?: string[] | null): MeetingAttendee[] {
  return (participants ?? [])
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => ({ name: value, email: "" }));
}

function attendeesCompactFromLegacy(participants?: string[] | null): string {
  return (participants ?? []).map((value) => value.trim()).filter(Boolean).join(", ");
}

function legacyParticipants(meeting: SavedMeetingRecord): string[] {
  const fromFull = meeting.attendeesFull.map(attendeeLabel).filter(Boolean);
  if (fromFull.length > 0) return fromFull;
  return meeting.attendeesCompact
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function legacyMeetingType(meetingTypeHint?: string): MeetingTypeHint {
  if (
    meetingTypeHint === "auto" ||
    meetingTypeHint === "discovery" ||
    meetingTypeHint === "1on1" ||
    meetingTypeHint === "standup" ||
    meetingTypeHint === "general"
  ) {
    return meetingTypeHint;
  }

  return meetingTypeHint === "meeting_standup" ? "standup" : "auto";
}

function isMissingEnhancedMeetingColumn(error: Error | null): boolean {
  if (!error) return false;

  return (
    (error as Error & { code?: string }).code === "PGRST204" ||
    /Could not find the '.+?' column of 'meetings'/i.test(error.message)
  );
}

function toSaved(row: DBMeeting): SavedMeetingRecord {
  const attendeesFull =
    row.attendees_full ?? attendeesFromLegacy(row.participants);

  return {
    id: row.id,
    startedAt: row.started_at ?? row.date ?? row.created_at,
    meetingTitle: row.meeting_title ?? row.title ?? "Untitled Meeting",
    meetingLocalDatetime: row.meeting_local_datetime ?? row.date ?? "",
    attendeesCompact:
      row.attendees_compact ?? attendeesCompactFromLegacy(row.participants),
    attendeesFull,
    calendarContext: row.calendar_context ?? null,
    meetingTypeHint: legacyMeetingType(row.meeting_type_hint ?? row.template_id),
    transcript: row.transcript,
    transcriptSegments: row.transcript_segments ?? [],
    myNotesMarkdown: row.my_notes_markdown ?? "",
    notesMarkdown: row.notes_markdown ?? row.notes ?? "",
    createdAt: row.created_at,
  };
}

export const meetingsService = {
  async getMeetings(): Promise<{
    data: SavedMeetingRecord[] | null;
    error: Error | null;
  }> {
    // Scope to the signed-in user so workspace-shared meetings from teammates
    // do not leak into the desktop "my meetings" list until desktop has a
    // dedicated team view.
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;
    if (!userId) return { data: null, error: new Error("Not signed in") };

    const { data, error } = await supabase
      .from("meetings")
      .select("*")
      .eq("user_id", userId)
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

    if (isMissingEnhancedMeetingColumn(error as Error | null)) {
      const { error: legacyError } = await supabase.from("meetings").upsert(
        {
          id: meeting.id,
          user_id: userId,
          title: meeting.meetingTitle,
          date: meeting.startedAt,
          participants: legacyParticipants(meeting),
          transcript: meeting.transcript,
          notes: meeting.notesMarkdown,
          template_id:
            meeting.meetingTypeHint === "standup"
              ? "meeting_standup"
              : "meeting_general",
        },
        { onConflict: "id" },
      );
      return { error: legacyError as Error | null };
    }

    return { error: error as Error | null };
  },

  async deleteMeeting(id: string): Promise<{ error: Error | null }> {
    const { error } = await supabase.from("meetings").delete().eq("id", id);
    return { error: error as Error | null };
  },
};
