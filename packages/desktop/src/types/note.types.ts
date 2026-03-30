// Re-export all note types from the shared package (single source of truth)
export type {
  Note,
  LocalTranscript,
  FeedbackReason,
  DBNote,
  DBNoteInsert,
  DBNoteUpdate,
  FormattingResult,
  TitleGenerationResult,
  FeedbackSubmission,
} from "@oscar/shared/types";
