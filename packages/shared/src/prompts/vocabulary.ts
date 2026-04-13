import type { DBVocabularyEntry } from "../types/vocabulary.types";
import { sanitizeUserInput } from "./sanitization";
import { SYSTEM_PROMPTS } from "./system-prompts";

/**
 * Builds a formatting prompt that includes user's custom vocabulary
 */
export function buildFormatPromptWithVocabulary(
  vocabulary: Pick<DBVocabularyEntry, "term" | "pronunciation" | "context">[]
) {
  if (!vocabulary || vocabulary.length === 0) {
    return SYSTEM_PROMPTS.FORMAT;
  }

  const vocabItems = vocabulary
    .map((v) => {
      const sanitizedTerm = sanitizeUserInput(v.term || "");
      const sanitizedPronunciation = v.pronunciation ? sanitizeUserInput(v.pronunciation) : "";
      const sanitizedContext = v.context ? sanitizeUserInput(v.context) : "";

      let item = `- "${sanitizedTerm}"`;
      if (sanitizedPronunciation) item += ` (pronounced: ${sanitizedPronunciation})`;
      if (sanitizedContext) item += ` [Context: ${sanitizedContext}]`;
      return item;
    })
    .join("\n");

  return `${SYSTEM_PROMPTS.FORMAT}

=== USER CUSTOM VOCABULARY ===
The user has provided a custom vocabulary list.
IMPORTANT: If you encounter words in the transcript that sound phonetically similar to these terms or seem like misrecognitions of them, you MUST correct them to the exact term provided below:

${vocabItems}

Always prefer the terms from this list when they fit the context.

REMEMBER: The transcript to format will be in <transcript></transcript> tags.`;
}
