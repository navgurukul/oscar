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

function legacyParticipants(attendeesFull?: MeetingAttendee[], attendeesCompact?: string): string[] {
  const fromFull = (attendeesFull ?? []).map(attendeeLabel).filter(Boolean);
  if (fromFull.length > 0) return fromFull;
  return (attendeesCompact ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
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

    if (isMissingEnhancedMeetingColumn(error as Error | null)) {
      const legacyUpdates: Record<string, unknown> = {};
      if (updates.meetingTitle !== undefined)
        legacyUpdates.title = updates.meetingTitle;
      if (
        updates.attendeesCompact !== undefined ||
        updates.attendeesFull !== undefined
      ) {
        legacyUpdates.participants = legacyParticipants(
          updates.attendeesFull,
          updates.attendeesCompact,
        );
      }
      if (updates.meetingTypeHint !== undefined) {
        legacyUpdates.template_id =
          updates.meetingTypeHint === "standup"
            ? "meeting_standup"
            : "meeting_general";
      }
      if (updates.notesMarkdown !== undefined)
        legacyUpdates.notes = updates.notesMarkdown;

      const { data: legacyData, error: legacyError } = await supabase
        .from("meetings")
        .update(legacyUpdates)
        .eq("id", id)
        .select()
        .single();

      if (legacyError) return { data: null, error: legacyError as Error };
      return { data: toSaved(legacyData as DBMeeting), error: null };
    }

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
