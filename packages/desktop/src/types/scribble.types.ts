// Re-export all scribble types from the shared package (single source of truth)
export type {
  Scribble,
  LocalTranscript,
  FeedbackReason,
  DBScribble,
  DBScribbleInsert,
  DBScribbleUpdate,
  FormattingResult,
  TitleGenerationResult,
  FeedbackSubmission,
  DictationCategory,
  DictationContextSnapshot,
  DictationContextSource,
  DictationRoutingConfidence,
  DictationRoutingResult,
} from "@oscar/shared/types";

export {
  DICTATION_CATEGORIES,
  DICTATION_CATEGORY_DESCRIPTIONS,
  DICTATION_CATEGORY_LABELS,
  DICTATION_PROMPT_VERSION,
  isDictationCategory,
} from "@oscar/shared/types";
