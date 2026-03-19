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
  raw_text: string;
  original_formatted_text: string;
  edited_text: string | null;
  created_at: string;
  updated_at: string;
  feedback_helpful: boolean | null;
  feedback_reasons: FeedbackReason[] | null;
  feedback_timestamp: string | null;
  // Soft delete metadata
  deleted_at: string | null;
  // Starred/favorite
  is_starred: boolean;
  // Optional: folder and sharing
  folder?: string | null;
  folder_id?: string | null;
  share_enabled?: boolean | null;
  share_token?: string | null;
  share_expires_at?: string | null;
  // Optional: simple sharing flag if using boolean in DB
  is_shared?: boolean | null;
}

// Insert type for creating a new note
export interface DBNoteInsert {
  user_id: string;
  title: string;
  raw_text: string;
  original_formatted_text: string;
  edited_text?: string | null;
  folder?: string | null;
  folder_id?: string | null;
  share_enabled?: boolean | null;
  share_token?: string | null;
  share_expires_at?: string | null;
  is_shared?: boolean | null;
}

// Update type for modifying a note
export interface DBNoteUpdate {
  title?: string;
  raw_text?: string;
  original_formatted_text?: string;
  edited_text?: string | null;
  updated_at?: string;
  feedback_helpful?: boolean | null;
  feedback_reasons?: FeedbackReason[] | null;
  feedback_timestamp?: string | null;
  // Soft delete metadata
  deleted_at?: string | null;
  // Starred/favorite
  is_starred?: boolean;
  // Folder and sharing
  folder?: string | null;
  folder_id?: string | null;
  share_enabled?: boolean | null;
  share_token?: string | null;
  share_expires_at?: string | null;
  is_shared?: boolean | null;
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

// Folder types
export interface DBFolder {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DBFolderInsert {
  name: string;
}

export interface DBFolderUpdate {
  name?: string;
  deleted_at?: string | null;
}
