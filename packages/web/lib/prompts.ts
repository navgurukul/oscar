// Re-export from shared — prompts are domain logic, not web-specific
export {
  sanitizeUserInput,
  validateUserInput,
  wrapUserInput,
  SYSTEM_PROMPTS,
  USER_PROMPTS,
  buildFormatPromptWithVocabulary,
} from "@oscar/shared/prompts";
