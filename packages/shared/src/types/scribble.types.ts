// Scribble-related type definitions — canonical source for all packages

import type {
  DictationCategory,
  DictationContextSource,
} from "./dictation.types";

export interface Scribble {
  formattedText: string;
  rawText: string;
  title?: string;
}

export interface DictationScribbleMetadata {
  dictation_category?: DictationCategory | null;
  dictation_variant?: DictationCategory | null;
  dictation_app_key?: string | null;
  dictation_context_source?: DictationContextSource | null;
  dictation_prompt_version?: string | null;
}

// Local transcript (desktop-only, but defined centrally for consistency)
export interface LocalTranscript extends DictationScribbleMetadata {
  id: string;
  /** AI-formatted / cleaned text — what the user sees and pastes. */
  text: string;
  /** Raw Whisper transcript, kept so it can be persisted alongside the
   *  formatted text if the user later submits feedback on this dictation.
   *  Optional: dictations created before this was added won't have it. */
  rawText?: string | null;
  createdAt: string;
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

// Database scribble type (Supabase)
export interface DBScribble extends DictationScribbleMetadata {
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
  // Folder/category name
  folder: string | null;
  // Organization sharing (Phase 2)
  organization_id?: string | null;
  shared_with_org?: boolean;
  shared_at?: string | null;
  // Public share link (Phase 6)
  visibility?: Visibility;
  public_share_token?: string | null;
  // Tags — denormalized text[] (migration 018). Optional: the legacy `notes`
  // fallback table has no tags column, so rows from there omit it.
  tags?: string[] | null;
}

export type Visibility = "private" | "org" | "public";

// Insert type for creating a new scribble
export interface DBScribbleInsert extends DictationScribbleMetadata {
  // Optional client-supplied primary key. Lets the create path recover the
  // row by id when an INSERT commits but its RETURNING representation is
  // suppressed by a deployed RLS policy (avoids a false "Save failed").
  id?: string;
  user_id: string;
  title: string;
  raw_text: string;
  original_formatted_text: string;
  edited_text?: string | null;
  folder?: string | null;
}

// Update type for modifying a scribble
export interface DBScribbleUpdate extends DictationScribbleMetadata {
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
  // Folder/category name
  folder?: string | null;
  // Tags (migration 018)
  tags?: string[] | null;
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
  scribbleId: string;
  helpful: boolean;
  reasons?: FeedbackReason[];
}
