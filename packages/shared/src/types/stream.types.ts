import type {
  DictationCategory,
  DictationContextSource,
} from "./dictation.types";

export interface DBStream {
  id: string;
  user_id: string;
  organization_id: string | null;
  app_key: string | null;
  destination_app: string | null;
  raw_transcript: string;
  formatted_text: string;
  /** Free-text user feedback on the dictation. A stream row is only persisted
   *  when the user submits feedback, so in practice this is non-empty. */
  feedback: string | null;
  duration_ms: number | null;
  dictation_category: DictationCategory | null;
  dictation_variant: DictationCategory | null;
  dictation_context_source: DictationContextSource | null;
  dictation_prompt_version: string | null;
  created_at: string;
}

export interface DBStreamInsert {
  user_id: string;
  organization_id?: string | null;
  app_key?: string | null;
  destination_app?: string | null;
  raw_transcript: string;
  formatted_text: string;
  feedback?: string | null;
  duration_ms?: number | null;
  dictation_category?: DictationCategory | null;
  dictation_variant?: DictationCategory | null;
  dictation_context_source?: DictationContextSource | null;
  dictation_prompt_version?: string | null;
}
