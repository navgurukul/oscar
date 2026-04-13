export interface DBVocabularyEntry {
  id: string;
  user_id: string;
  term: string;
  pronunciation: string | null;
  context: string | null;
  created_at: string;
  updated_at: string;
}

export interface DBVocabularyInsert {
  user_id: string;
  term: string;
  pronunciation?: string | null;
  context?: string | null;
}

export interface DBVocabularyUpdate {
  term?: string;
  pronunciation?: string | null;
  context?: string | null;
}
