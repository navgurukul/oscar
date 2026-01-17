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

/**
 * Retry configuration for AI API calls
 */
const RETRY_CONFIG = {
  MAX_RETRIES: 2,
  INITIAL_DELAY_MS: 1000,
  TIMEOUT_MS: 30000,
} as const;

/**
 * Helper to create fetch request with timeout
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = RETRY_CONFIG.TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timed out. Please try again.");
    }
    throw error;
  }
}

/**
 * Retry helper with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = RETRY_CONFIG.MAX_RETRIES,
  initialDelay: number = RETRY_CONFIG.INITIAL_DELAY_MS
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error as Error;

      // Don't retry on certain errors
      if (
        lastError.message?.includes("400") ||
        lastError.message?.includes("401") ||
        lastError.message?.includes("403")
      ) {
        throw lastError;
      }

      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(
          `Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

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
      return await retryWithBackoff(async () => {
        const response = await fetchWithTimeout(API_CONFIG.FORMAT_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawText }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Format API error: ${response.status}`, errorText);
          throw new Error(`Formatting failed: ${response.status}`);
        }

        const data = (await response.json()) as DeepseekFormatResponse;
        const formattedText = data?.formattedText?.trim();

        if (!formattedText) {
          throw new Error(ERROR_MESSAGES.EMPTY_RESPONSE_FROM_FORMATTING);
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
      });
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
      return await retryWithBackoff(async () => {
        const response = await fetchWithTimeout(API_CONFIG.TITLE_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: source }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Title API error: ${response.status}`, errorText);
          // Fallback to heuristic title on API error
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
      });
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
