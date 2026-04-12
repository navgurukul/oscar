import { createClient } from "@/lib/supabase/client";
import type {
  DictationCategory,
  DictationContextSource,
  FeedbackReason,
} from "@/lib/types/note.types";

/**
 * Feedback Service
 * Handles AI formatting quality feedback storage and retrieval
 */

function getSupabase() {
  return createClient();
}

export const feedbackService = {
  /**
   * Submit feedback for a note's AI formatting
   */
  async submitFeedback(
    noteId: string,
    helpful: boolean,
    reasons?: FeedbackReason[]
  ): Promise<{ success: boolean; error: Error | null }> {
    const supabase = getSupabase();
    const normalizedReasons =
      helpful
        ? null
        : Array.from(new Set((reasons ?? []).filter(Boolean)));

    const { error } = await supabase
      .from("notes")
      .update({
        feedback_helpful: helpful,
        feedback_reasons:
          normalizedReasons && normalizedReasons.length > 0
            ? normalizedReasons
            : null,
        feedback_timestamp: new Date().toISOString(),
      })
      .eq("id", noteId);

    if (error) {
      console.error("Failed to submit feedback:", error);
      return { success: false, error: error as Error };
    }

    return { success: true, error: null };
  },

  /**
   * Get feedback statistics for prompt optimization
   * Returns aggregated feedback data
   */
  async getFeedbackStats(): Promise<{
    data: {
      total: number;
      helpful: number;
      notHelpful: number;
      helpfulPercentage: number;
      reasonBreakdown: Record<string, number>;
      variantBreakdown: Record<string, number>;
      categoryBreakdown: Record<string, number>;
      appBreakdown: Record<string, number>;
      promptVersionBreakdown: Record<string, number>;
    } | null;
    error: Error | null;
  }> {
    const supabase = getSupabase();

    // Get all notes with feedback
    const { data: notes, error } = await supabase
      .from("notes")
      .select(
        "feedback_helpful, feedback_reasons, dictation_variant, dictation_category, dictation_app_key, dictation_prompt_version"
      )
      .not("feedback_helpful", "is", null);

    if (error) {
      console.error("Failed to fetch feedback stats:", error);
      return { data: null, error: error as Error };
    }

    // Calculate statistics
    const total = notes?.length || 0;
    const helpful =
      notes?.filter((n) => n.feedback_helpful === true).length || 0;
    const notHelpful =
      notes?.filter((n) => n.feedback_helpful === false).length || 0;
    const helpfulPercentage = total > 0 ? (helpful / total) * 100 : 0;

    // Breakdown reasons for negative feedback
    const reasonBreakdown: Record<string, number> = {};
    const variantBreakdown: Record<string, number> = {};
    const categoryBreakdown: Record<string, number> = {};
    const appBreakdown: Record<string, number> = {};
    const promptVersionBreakdown: Record<string, number> = {};
    notes?.forEach((note) => {
      if (note.feedback_helpful === false && note.feedback_reasons) {
        note.feedback_reasons.forEach((reason: string) => {
          reasonBreakdown[reason] = (reasonBreakdown[reason] || 0) + 1;
        });
      }

      const variant = note.dictation_variant || "unknown";
      const category = note.dictation_category || "unknown";
      const appKey = note.dictation_app_key || "unknown";
      const promptVersion = note.dictation_prompt_version || "unknown";

      variantBreakdown[variant] = (variantBreakdown[variant] || 0) + 1;
      categoryBreakdown[category] = (categoryBreakdown[category] || 0) + 1;
      appBreakdown[appKey] = (appBreakdown[appKey] || 0) + 1;
      promptVersionBreakdown[promptVersion] =
        (promptVersionBreakdown[promptVersion] || 0) + 1;
    });

    return {
      data: {
        total,
        helpful,
        notHelpful,
        helpfulPercentage,
        reasonBreakdown,
        variantBreakdown,
        categoryBreakdown,
        appBreakdown,
        promptVersionBreakdown,
      },
      error: null,
    };
  },

  /**
   * Get recent negative feedback with full context
   * Useful for prompt refinement
   */
  async getRecentNegativeFeedback(limit: number = 20): Promise<{
    data: Array<{
      id: string;
      title: string;
      raw_text: string;
      original_formatted_text: string;
      feedback_reasons: FeedbackReason[];
      feedback_timestamp: string;
      dictation_variant: DictationCategory | null;
      dictation_category: DictationCategory | null;
      dictation_app_key: string | null;
      dictation_context_source: DictationContextSource | null;
      dictation_prompt_version: string | null;
    }> | null;
    error: Error | null;
  }> {
    const supabase = getSupabase();
    const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 100);

    const { data, error } = await supabase
      .from("notes")
      .select(
        "id, title, raw_text, original_formatted_text, feedback_reasons, feedback_timestamp, dictation_variant, dictation_category, dictation_app_key, dictation_context_source, dictation_prompt_version"
      )
      .eq("feedback_helpful", false)
      .not("feedback_reasons", "is", null)
      .order("feedback_timestamp", { ascending: false })
      .limit(safeLimit);

    if (error) {
      console.error("Failed to fetch negative feedback:", error);
      return { data: null, error: error as Error };
    }

    return { data, error: null };
  },
};
