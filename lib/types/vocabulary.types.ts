/**
 * Vocabulary type definitions for custom vocabulary/name recognition feature
 */

/**
 * Database vocabulary entry type (full row)
 */
export interface DBVocabularyEntry {
  id: string;
  user_id: string;
  term: string;
  pronunciation: string | null;
  context: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Insert type for creating vocabulary entries
 */
export interface DBVocabularyInsert {
  user_id: string;
  term: string;
  pronunciation?: string | null;
  context?: string | null;
}

/**
 * Update type for modifying vocabulary entries
 */
export interface DBVocabularyUpdate {
  term?: string;
  pronunciation?: string | null;
  context?: string | null;
}
