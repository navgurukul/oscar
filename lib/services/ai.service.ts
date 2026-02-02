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
import { localFormatterService } from "./localFormatter.service";

/**
 * Retry configuration for AI API calls
 */
const RETRY_CONFIG = {
  MAX_RETRIES: 2,
  INITIAL_DELAY_MS: 1000,
  TIMEOUT_MS: 30000,
} as const;

/**
 * Helper to create fetch request with timeout and optional abort signal
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = RETRY_CONFIG.TIMEOUT_MS,
  externalSignal?: AbortSignal
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // If external signal is provided, abort when it aborts
  const handleExternalAbort = () => {
    controller.abort();
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timeoutId);
      throw new Error(ERROR_MESSAGES.FORMATTING_CANCELLED);
    }
    externalSignal.addEventListener("abort", handleExternalAbort);
  }

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (externalSignal) {
      externalSignal.removeEventListener("abort", handleExternalAbort);
    }
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        // Check if it was external abort or timeout
        if (externalSignal?.aborted) {
          throw new Error(ERROR_MESSAGES.FORMATTING_CANCELLED);
        }
        throw new Error("Request timed out. Please try again.");
      }
    }
    throw error;
  } finally {
    if (externalSignal) {
      externalSignal.removeEventListener("abort", handleExternalAbort);
    }
  }
}

/**
 * Retry helper with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = RETRY_CONFIG.MAX_RETRIES,
  initialDelay: number = RETRY_CONFIG.INITIAL_DELAY_MS,
  signal?: AbortSignal
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Check for cancellation before each attempt
    if (signal?.aborted) {
      throw new Error(ERROR_MESSAGES.FORMATTING_CANCELLED);
    }

    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error as Error;

      // Don't retry on cancellation
      if (lastError.message === ERROR_MESSAGES.FORMATTING_CANCELLED) {
        throw lastError;
      }

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
   * Falls back to local formatting if AI fails
   * @param rawText - Raw transcript from speech recognition
   * @param signal - Optional AbortSignal for cancellation
   * @returns Formatted text result
   */
  async formatText(
    rawText: string,
    signal?: AbortSignal
  ): Promise<FormattingResult> {
    if (!rawText || !rawText.trim()) {
      return {
        success: false,
        error: ERROR_MESSAGES.NO_TEXT_PROVIDED_FOR_FORMATTING,
      };
    }

    // Check for cancellation early
    if (signal?.aborted) {
      return {
        success: false,
        error: ERROR_MESSAGES.FORMATTING_CANCELLED,
      };
    }

    try {
      return await retryWithBackoff(
        async () => {
          const response = await fetchWithTimeout(
            API_CONFIG.FORMAT_ENDPOINT,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ rawText }),
            },
            RETRY_CONFIG.TIMEOUT_MS,
            signal
          );

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
        },
        RETRY_CONFIG.MAX_RETRIES,
        RETRY_CONFIG.INITIAL_DELAY_MS,
        signal
      );
    } catch (error: unknown) {
      const err = error as Error;
      console.error("Format text error:", error);

      // If cancelled, don't fallback - just return the cancellation error
      if (err?.message === ERROR_MESSAGES.FORMATTING_CANCELLED) {
        return {
          success: false,
          error: ERROR_MESSAGES.FORMATTING_CANCELLED,
        };
      }

      // Fallback to local formatting
      console.log("AI formatting failed, using local fallback");
      const localFormatted = localFormatterService.formatTextLocally(rawText);

      if (localFormatted) {
        return {
          success: true,
          formattedText: localFormatted,
          fallback: true,
        };
      }

      return {
        success: false,
        error: err?.message || "Failed to format text",
      };
    }
  },

  /**
   * Translate text into a target language (en/hi)
   */
  async translateText(
    text: string,
    targetLanguage: "en" | "hi"
  ): Promise<{ success: boolean; translatedText?: string; error?: string }> {
    if (!text || !text.trim()) {
      return {
        success: false,
        error: ERROR_MESSAGES.NO_TEXT_PROVIDED_FOR_TRANSLATION,
      };
    }

    try {
      return await retryWithBackoff(async () => {
        const response = await fetchWithTimeout(API_CONFIG.TRANSLATE_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, targetLanguage }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Translate API error: ${response.status}`, errorText);
          throw new Error(`Translation failed: ${response.status}`);
        }

        const data = (await response.json()) as { translatedText?: string };
        const translatedText = data?.translatedText?.trim();

        if (!translatedText) {
          throw new Error(ERROR_MESSAGES.EMPTY_RESPONSE_FROM_TRANSLATION);
        }

        return { success: true, translatedText };
      });
    } catch (error) {
      console.error("Translation error:", error);
      return {
        success: false,
        error: ERROR_MESSAGES.API_ERROR,
      };
    }
  },

  /**
   * Generate a concise title for the note
   * @param text - Formatted or raw text content
   * @param signal - Optional AbortSignal for cancellation
   * @returns Title generation result
   */
  async generateTitle(
    text: string,
    signal?: AbortSignal
  ): Promise<TitleGenerationResult> {
    const source = (text || "").trim();

    if (!source) {
      return {
        success: false,
        error: ERROR_MESSAGES.NO_TEXT_PROVIDED_FOR_TITLE,
      };
    }

    // Check for cancellation early
    if (signal?.aborted) {
      return this.generateFallbackTitle(source);
    }

    try {
      return await retryWithBackoff(
        async () => {
          const response = await fetchWithTimeout(
            API_CONFIG.TITLE_ENDPOINT,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: source }),
            },
            RETRY_CONFIG.TIMEOUT_MS,
            signal
          );

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
        },
        RETRY_CONFIG.MAX_RETRIES,
        RETRY_CONFIG.INITIAL_DELAY_MS,
        signal
      );
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
