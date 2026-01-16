// AI service for text formatting and title generation

import type {
  FormattingResult,
  TitleGenerationResult,
} from "../types/note.types";
import type {
  DeepseekFormatResponse,
  DeepseekTitleResponse,
} from "../types/api.types";
import { API_CONFIG, ERROR_MESSAGES, UI_STRINGS } from "../constants";

export const aiService = {
  /**
   * Format raw transcript text using AI
   * @param rawText - Raw transcript from speech recognition
   * @returns Formatted text result
   */
  async formatText(rawText: string): Promise<FormattingResult> {
    if (!rawText || !rawText.trim()) {
      return {
        success: false,
        error: ERROR_MESSAGES.NO_TEXT_PROVIDED_FOR_FORMATTING,
      };
    }

    try {
      const response = await fetch(API_CONFIG.FORMAT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Format API error: ${response.status}`, errorText);
        return {
          success: false,
          error: `Formatting failed: ${response.status}`,
        };
      }

      const data = (await response.json()) as DeepseekFormatResponse;
      const formattedText = data?.formattedText?.trim();

      if (!formattedText) {
        return {
          success: false,
          error: ERROR_MESSAGES.EMPTY_RESPONSE_FROM_FORMATTING,
        };
      }

      // Remove markdown code blocks if present
      const cleanedText = formattedText
        .replace(/^```[\w]*\n/, "")
        .replace(/\n```$/, "")
        .trim();

      return {
        success: true,
        formattedText: cleanedText,
      };
    } catch (error: unknown) {
      const err = error as Error;
      console.error("Format text error:", error);
      return {
        success: false,
        error: err?.message || "Failed to format text",
      };
    }
  },

  /**
   * Generate a concise title for the note
   * @param text - Formatted or raw text content
   * @returns Title generation result
   */
  async generateTitle(text: string): Promise<TitleGenerationResult> {
    const source = (text || "").trim();

    if (!source) {
      return {
        success: false,
        error: ERROR_MESSAGES.NO_TEXT_PROVIDED_FOR_TITLE,
      };
    }

    try {
      const response = await fetch(API_CONFIG.TITLE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: source }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Title API error: ${response.status}`, errorText);

        // Fallback to heuristic title
        return this.generateFallbackTitle(source);
      }

      const data = (await response.json()) as DeepseekTitleResponse;
      const title = data?.title?.trim();

      if (!title) {
        return this.generateFallbackTitle(source);
      }

      const sanitized = this.sanitizeTitle(title);

      return {
        success: true,
        title: sanitized,
      };
    } catch (error: unknown) {
      console.error("Title generation error:", error);
      return this.generateFallbackTitle(source);
    }
  },

  /**
   * Generate fallback title using heuristic approach
   * @param text - Text content
   * @returns Heuristic title
   */
  generateFallbackTitle(text: string): TitleGenerationResult {
    try {
      const cleaned = text.replace(/\s+/g, " ").trim();
      const firstSentence = (cleaned.match(/[^.!?]+[.!?]?/) || [""])[0].trim();
      const truncated =
        firstSentence.length > API_CONFIG.TITLE_MAX_LENGTH
          ? firstSentence.slice(0, 57).trim() + "…"
          : firstSentence;

      const title = this.sanitizeTitle(
        truncated || cleaned.slice(0, API_CONFIG.TITLE_MAX_LENGTH)
      );

      return {
        success: true,
        title,
      };
    } catch {
      return {
        success: true,
        title: UI_STRINGS.UNTITLED_NOTE,
      };
    }
  },

  /**
   * Sanitize title by removing unwanted characters
   * @param title - Raw title
   * @returns Cleaned title
   */
  sanitizeTitle(title: string): string {
    return (title || "")
      .replace(/[\r\n]+/g, " ")
      .replace(/^["'\s]+|["'\s]+$/g, "")
      .replace(/^```[\w]*\n/, "")
      .replace(/\n```$/, "")
      .trim();
  },
};
