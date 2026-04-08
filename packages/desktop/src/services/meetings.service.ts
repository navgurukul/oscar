import { supabase } from "../supabase";
import type { SavedMeeting } from "../components/MeetingsTab";

interface DBMeeting {
  id: string;
  user_id: string;
  title: string;
  date: string;
  participants: string[];
  transcript: string;
  notes: string;
  template_id: string;
  created_at: string;
}

function toSaved(row: DBMeeting): SavedMeeting {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    participants: row.participants ?? [],
    transcript: row.transcript,
    notes: row.notes,
    templateId: row.template_id,
  };
}

export const meetingsService = {
  /** Fetch all meetings for the current user, newest first. */
  async getMeetings(): Promise<{ data: SavedMeeting[] | null; error: Error | null }> {
    const { data, error } = await supabase
      .from("meetings")
      .select("*")
      .order("date", { ascending: false });

    if (error) return { data: null, error: error as Error };
    return { data: (data ?? []).map(toSaved), error: null };
  },

  /** Insert or replace a meeting record. */
  async saveMeeting(
    meeting: SavedMeeting,
    userId: string,
  ): Promise<{ error: Error | null }> {
    const { error } = await supabase.from("meetings").upsert(
      {
        id: meeting.id,
        user_id: userId,
        title: meeting.title,
        date: meeting.date,
        participants: meeting.participants,
        transcript: meeting.transcript,
        notes: meeting.notes,
        template_id: meeting.templateId,
      },
      { onConflict: "id" },
    );
    return { error: error as Error | null };
  },

  /** Hard-delete a meeting by id. */
  async deleteMeeting(id: string): Promise<{ error: Error | null }> {
    const { error } = await supabase.from("meetings").delete().eq("id", id);
    return { error: error as Error | null };
  },
};
