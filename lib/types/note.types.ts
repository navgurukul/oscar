// Note-related type definitions

export interface Note {
  formattedText: string;
  rawText: string;
  title?: string;
}

// Feedback reason options
export type FeedbackReason =
  | "too_short"
  | "missed_key_info"
  | "incorrect_grammar"
  | "wrong_tone"
  | "poor_formatting"
  | "other"
  | (string & {});

// Database note type (Supabase)
export interface DBNote {
  id: string;
  user_id: string;
  title: string;
  /**
   * Optional folder name for organizing notes.
   * Nullable/optional to stay compatible if the column doesn't exist yet.
   */
  folder?: string | null;
  /**
   * When true, this note is shared/collaborative and can be viewed by other users.
   * Requires a matching boolean column in the database schema.
   */
  is_shared?: boolean;
  raw_text: string;
  original_formatted_text: string;
  edited_text: string | null;
  created_at: string;
  updated_at: string;
  feedback_helpful: boolean | null;
  feedback_reasons: FeedbackReason[] | null;
  feedback_timestamp: string | null;
  is_starred: boolean;
}

// Insert type for creating a new note
export interface DBNoteInsert {
  user_id: string;
  title: string;
  folder?: string | null;
  raw_text: string;
  original_formatted_text: string;
  edited_text?: string | null;
  is_starred?: boolean;
  is_shared?: boolean;
}

// Update type for modifying a note
export interface DBNoteUpdate {
  title?: string;
  folder?: string | null;
  raw_text?: string;
  original_formatted_text?: string;
  edited_text?: string | null;
  updated_at?: string;
  feedback_helpful?: boolean | null;
  feedback_reasons?: FeedbackReason[] | null;
  feedback_timestamp?: string | null;
  is_starred?: boolean;
  is_shared?: boolean;
}

export interface FormattingResult {
  success: boolean;
  formattedText?: string;
  error?: string;
  /** True if local fallback formatting was used instead of AI */
  fallback?: boolean;
}

export interface TitleGenerationResult {
  success: boolean;
  title?: string;
  error?: string;
}

// Feedback submission data
export interface FeedbackSubmission {
  noteId: string;
  helpful: boolean;
  reasons?: FeedbackReason[];
}
