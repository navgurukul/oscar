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
