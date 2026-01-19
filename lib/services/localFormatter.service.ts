// Local text formatter for fallback when AI is unavailable

import { LOCAL_FORMATTER_CONFIG } from "../constants";

/**
 * Local formatter service provides basic text cleanup when AI formatting fails.
 * It's intentionally conservative - preserving meaning over stylistic perfection.
 */
export const localFormatterService = {
  /**
   * Format raw transcript text locally without AI
   * @param rawText - Raw transcript from speech recognition
   * @returns Cleaned up text
   */
  formatTextLocally(rawText: string): string {
    if (!rawText || !rawText.trim()) {
      return "";
    }

    let text = rawText;

    // 1. Remove filler words (case-insensitive, word boundaries)
    text = this.removeFillerWords(text);

    // 2. Normalize whitespace
    text = this.normalizeWhitespace(text);

    // 3. Fix capitalization
    text = this.fixCapitalization(text);

    // 4. Add punctuation where missing
    text = this.addMissingPunctuation(text);

    // 5. Add paragraph breaks for long text
    text = this.addParagraphBreaks(text);

    return text.trim();
  },

  /**
   * Remove common filler words from text
   */
  removeFillerWords(text: string): string {
    const fillerWords = LOCAL_FORMATTER_CONFIG.FILLER_WORDS;

    // Build regex pattern for filler words with word boundaries
    // Handle multi-word fillers like "you know"
    const patterns = fillerWords.map((word) => {
      // Escape special regex characters
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // Match word boundaries, optional comma after
      return `\\b${escaped}\\b,?\\s*`;
    });

    const regex = new RegExp(patterns.join("|"), "gi");
    return text.replace(regex, " ");
  },

  /**
   * Normalize whitespace - multiple spaces to single, trim lines
   */
  normalizeWhitespace(text: string): string {
    return text
      .replace(/[ \t]+/g, " ") // Multiple spaces/tabs to single space
      .replace(/\n\s*\n\s*\n/g, "\n\n") // Multiple blank lines to max 2
      .replace(/^\s+|\s+$/gm, "") // Trim each line
      .trim();
  },

  /**
   * Fix capitalization - first letter of sentences and after periods
   */
  fixCapitalization(text: string): string {
    // Capitalize first character
    if (text.length > 0) {
      text = text.charAt(0).toUpperCase() + text.slice(1);
    }

    // Capitalize after sentence-ending punctuation
    text = text.replace(/([.!?]\s+)([a-z])/g, (_, punct, letter) => {
      return punct + letter.toUpperCase();
    });

    // Capitalize after newlines
    text = text.replace(/(\n\s*)([a-z])/g, (_, newline, letter) => {
      return newline + letter.toUpperCase();
    });

    return text;
  },

  /**
   * Add missing punctuation based on context
   */
  addMissingPunctuation(text: string): string {
    // Question words that likely indicate a question
    const questionStarters =
      /^(what|when|where|who|why|how|is|are|was|were|do|does|did|can|could|would|should|will|have|has|had)\b/i;

    // Split into sentences (rough split on existing punctuation or long pauses)
    const sentences = text.split(/(?<=[.!?])\s+|\n+/);

    const processed = sentences.map((sentence) => {
      sentence = sentence.trim();
      if (!sentence) return "";

      // Check if sentence already ends with punctuation
      if (/[.!?]$/.test(sentence)) {
        return sentence;
      }

      // Check if it looks like a question
      if (questionStarters.test(sentence)) {
        return sentence + "?";
      }

      // Default: add period
      return sentence + ".";
    });

    return processed.filter(Boolean).join(" ");
  },

  /**
   * Add paragraph breaks for readability (every ~4-5 sentences)
   */
  addParagraphBreaks(text: string): string {
    // Don't add breaks to already-formatted text with paragraphs
    if (text.includes("\n\n")) {
      return text;
    }

    // Count sentences
    const sentences = text.match(/[^.!?]+[.!?]+/g);
    if (
      !sentences ||
      sentences.length <= LOCAL_FORMATTER_CONFIG.PARAGRAPH_SENTENCE_COUNT
    ) {
      return text;
    }

    // Add breaks every N sentences
    const result: string[] = [];
    let currentParagraph: string[] = [];

    sentences.forEach((sentence, index) => {
      currentParagraph.push(sentence.trim());

      if (
        (index + 1) % LOCAL_FORMATTER_CONFIG.PARAGRAPH_SENTENCE_COUNT === 0 &&
        index < sentences.length - 1
      ) {
        result.push(currentParagraph.join(" "));
        currentParagraph = [];
      }
    });

    // Add remaining sentences
    if (currentParagraph.length > 0) {
      result.push(currentParagraph.join(" "));
    }

    return result.join("\n\n");
  },
};
