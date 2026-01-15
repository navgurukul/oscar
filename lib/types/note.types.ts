// Note-related type definitions

export interface Note {
  formattedText: string;
  rawText: string;
  title?: string;
}

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
}

// Insert type for creating a new note
export interface DBNoteInsert {
  user_id: string;
  title: string;
  raw_text: string;
  original_formatted_text: string;
  edited_text?: string | null;
}

// Update type for modifying a note
export interface DBNoteUpdate {
  title?: string;
  edited_text?: string | null;
  updated_at?: string;
}

export interface FormattingResult {
  success: boolean;
  formattedText?: string;
  error?: string;
}

export interface TitleGenerationResult {
  success: boolean;
  title?: string;
  error?: string;
}
