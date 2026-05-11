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
  text: string;
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
}

// Insert type for creating a new scribble
export interface DBScribbleInsert extends DictationScribbleMetadata {
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
