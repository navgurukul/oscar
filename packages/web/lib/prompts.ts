// Re-export from shared — prompts are domain logic, not web-specific
export {
  sanitizeUserInput,
  validateUserInput,
  wrapUserInput,
  SYSTEM_PROMPTS,
  USER_PROMPTS,
  buildFormatPromptWithVocabulary,
  applyTranscriptPostProcessing,
  applyTranscriptPostProcessingWithChanges,
} from "@oscar/shared/prompts";
export type {
  TranscriptPostProcessChange,
  TranscriptPostProcessIssue,
  TranscriptPostProcessResult,
} from "@oscar/shared/prompts";
