import type {
  FormattingResult,
  TitleGenerationResult,
} from "../types/note.types";
import type {
  GroqFormatResponse,
  GroqTitleResponse,
} from "../types/api.types";
import { API_CONFIG, ERROR_MESSAGES, UI_STRINGS } from "../constants";
import { localFormatterService } from "./localFormatter.service";

const RETRY_CONFIG = {
  MAX_RETRIES: 2,
  INITIAL_DELAY_MS: 1000,
  TIMEOUT_MS: 15000,      // ✅ was 60s — matches backend 12s + small buffer
  TITLE_TIMEOUT_MS: 8000, // ✅ titles are tiny, fail fast
} as const;

export type TransformMode = "summary" | "bullets";

// ✅ Reusable stream reader — live chunks, UI updates as text arrives
async function readStream(
  response: Response,
  onChunk: (text: string) => void
): Promise<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let fullText = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      fullText += chunk;
      onChunk(fullText); // ✅ UI update har chunk pe
    }
  } finally {
    reader.releaseLock();
  }

  return fullText.trim();
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = RETRY_CONFIG.TIMEOUT_MS,
  externalSignal?: AbortSignal
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const handleExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timeoutId);
      throw new Error(ERROR_MESSAGES.FORMATTING_CANCELLED);
    }
    externalSignal.addEventListener("abort", handleExternalAbort);
  }

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      if (externalSignal?.aborted) throw new Error(ERROR_MESSAGES.FORMATTING_CANCELLED);
      throw new Error("Request timed out. Please try again.");
    }
    throw error;
  } finally {
    externalSignal?.removeEventListener("abort", handleExternalAbort);
  }
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = RETRY_CONFIG.MAX_RETRIES,
  initialDelay: number = RETRY_CONFIG.INITIAL_DELAY_MS,
  signal?: AbortSignal
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) throw new Error(ERROR_MESSAGES.FORMATTING_CANCELLED);
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error as Error;
      if (lastError.message === ERROR_MESSAGES.FORMATTING_CANCELLED) throw lastError;
      if (
        lastError.message?.includes("400") ||
        lastError.message?.includes("401") ||
        lastError.message?.includes("403")
      ) throw lastError;

      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

/**
 * Parse a streaming or JSON response from the format APIs.
 * Handles both legacy JSON and streaming text paths, cleans markdown fences.
 */
async function parseFormatResponse(
  response: Response,
  onChunk?: (text: string) => void
): Promise<string> {
  const contentType = response.headers.get("content-type") || "";
  let formattedText: string;

  if (contentType.includes("application/json")) {
    const data = (await response.json()) as GroqFormatResponse;
    formattedText = data?.formattedText?.trim() || "";
  } else {
    formattedText = await readStream(response, onChunk ?? (() => {}));
  }

  if (!formattedText) {
    throw new Error(ERROR_MESSAGES.EMPTY_RESPONSE_FROM_FORMATTING);
  }

  // Strip markdown code fences (safety net — backend already strips these)
  return formattedText
    .replace(/^```[\w]*\n/, "")
    .replace(/\n```$/, "")
    .trim();
}

/**
 * Handle formatting errors with local fallback.
 */
function handleFormatError(
  error: unknown,
  rawText: string
): FormattingResult {
  const err = error as Error;

  if (err?.message === ERROR_MESSAGES.FORMATTING_CANCELLED) {
    return { success: false, error: ERROR_MESSAGES.FORMATTING_CANCELLED };
  }

  console.log("AI formatting failed, using local fallback");
  const localFormatted = localFormatterService.formatTextLocally(rawText);
  if (localFormatted) {
    return { success: true, formattedText: localFormatted, fallback: true };
  }

  return { success: false, error: err?.message || "Failed to format text" };
}

export const aiService = {

  async formatText(
    rawText: string,
    signal?: AbortSignal,
    onChunk?: (text: string) => void
  ): Promise<FormattingResult> {
    if (!rawText?.trim()) {
      return { success: false, error: ERROR_MESSAGES.NO_TEXT_PROVIDED_FOR_FORMATTING };
    }
    if (signal?.aborted) {
      return { success: false, error: ERROR_MESSAGES.FORMATTING_CANCELLED };
    }

    try {
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

      const formattedText = await parseFormatResponse(response, onChunk);
      return { success: true, formattedText };
    } catch (error: unknown) {
      console.error("Format text error:", error);
      return handleFormatError(error, rawText);
    }
  },

  async formatEmailText(
    rawText: string,
    title?: string,
    signal?: AbortSignal,
    onChunk?: (text: string) => void
  ): Promise<FormattingResult> {
    if (!rawText?.trim()) {
      return { success: false, error: ERROR_MESSAGES.NO_TEXT_PROVIDED_FOR_FORMATTING };
    }
    if (signal?.aborted) {
      return { success: false, error: ERROR_MESSAGES.FORMATTING_CANCELLED };
    }

    try {
      const response = await fetchWithTimeout(
        API_CONFIG.FORMAT_EMAIL_ENDPOINT,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawText, title }),
        },
        RETRY_CONFIG.TIMEOUT_MS,
        signal
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Email Format API error: ${response.status}`, errorText);
        throw new Error(`Formatting failed: ${response.status}`);
      }

      const formattedText = await parseFormatResponse(response, onChunk);
      return { success: true, formattedText };
    } catch (error: unknown) {
      console.error("Format email text error:", error);
      return handleFormatError(error, rawText);
    }
  },

  // ✅ Both format + email parallel — onChunk dono ke liye
  async formatTextAndEmail(
    rawText: string,
    title?: string,
    signal?: AbortSignal,
    onFormatChunk?: (text: string) => void,  // ← NEW
    onEmailChunk?: (text: string) => void    // ← NEW
  ): Promise<{ formatting: FormattingResult; email: FormattingResult }> {
    const [formatting, email] = await Promise.all([
      this.formatText(rawText, signal, onFormatChunk),
      this.formatEmailText(rawText, title, signal, onEmailChunk),
    ]);
    return { formatting, email };
  },

  async transformText(
    text: string,
    mode: TransformMode,
    title?: string,
    signal?: AbortSignal,
    onChunk?: (text: string) => void
  ): Promise<FormattingResult> {
    if (!text?.trim()) {
      return {
        success: false,
        error: ERROR_MESSAGES.NO_TEXT_PROVIDED_FOR_FORMATTING,
      };
    }
    if (signal?.aborted) {
      return { success: false, error: ERROR_MESSAGES.FORMATTING_CANCELLED };
    }

    try {
      const response = await fetchWithTimeout(
        API_CONFIG.TRANSFORM_ENDPOINT,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, mode, title }),
        },
        RETRY_CONFIG.TIMEOUT_MS,
        signal
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Transform API error: ${response.status}`, errorText);
        throw new Error(`Formatting failed: ${response.status}`);
      }

      const formattedText = await parseFormatResponse(response, onChunk);
      return { success: true, formattedText };
    } catch (error: unknown) {
      console.error("Transform text error:", error);
      return { success: false, error: (error as Error)?.message || "Failed to transform text" };
    }
  },

  async translateText(
    text: string,
    targetLanguage: "en" | "hi",
    signal?: AbortSignal
  ): Promise<{ success: boolean; translatedText?: string; error?: string }> {
    if (!text?.trim()) {
      return { success: false, error: ERROR_MESSAGES.NO_TEXT_PROVIDED_FOR_TRANSLATION };
    }

    try {
      const response = await fetchWithTimeout(
        API_CONFIG.TRANSLATE_ENDPOINT,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, targetLanguage }),
        },
        RETRY_CONFIG.TIMEOUT_MS, // ✅ was 60s
        signal
      );

      if (!response.ok) {
        let serverError: string | undefined;
        let serverDetails: string | undefined;
        try {
          const errJson = await response.json();
          serverError = errJson?.error;
          serverDetails = errJson?.details;
        } catch {
          serverError = await response.text();
        }

        // Map common server errors to user-friendly messages
        let friendlyError: string = ERROR_MESSAGES.API_ERROR;
        if (response.status === 401) {
          friendlyError = "Please sign in to use translation.";
        } else if (response.status === 429) {
          friendlyError = "Too many translation requests. Please wait a moment.";
        } else if (response.status === 500) {
          if (serverError?.includes("Server missing GROQ_API_KEY")) {
            friendlyError = "Server configuration issue: translation API key is missing.";
          } else {
            friendlyError = ERROR_MESSAGES.GROQ_REQUEST_FAILED;
          }
        } else if (response.status >= 400 && response.status < 500) {
          friendlyError = serverError || ERROR_MESSAGES.API_ERROR;
        }

        console.error("Translate API error:", response.status, serverError || serverDetails);
        return { success: false, error: friendlyError };
      }

      const data = (await response.json()) as { translatedText?: string };
      const translatedText = data?.translatedText?.trim();

      if (!translatedText) throw new Error(ERROR_MESSAGES.EMPTY_RESPONSE_FROM_TRANSLATION);

      return { success: true, translatedText };

    } catch (error) {
      console.error("Translation error:", error);
      const err = error as Error;
      if (err?.message?.includes("timed out")) {
        return { success: false, error: "Translation timed out. Please try again." };
      }
      return { success: false, error: err?.message || ERROR_MESSAGES.API_ERROR };
    }
  },

  async generateTitle(
    text: string,
    signal?: AbortSignal
  ): Promise<TitleGenerationResult> {
    const source = (text || "").trim();
    if (!source) return { success: false, error: ERROR_MESSAGES.NO_TEXT_PROVIDED_FOR_TITLE };
    if (signal?.aborted) return this.generateFallbackTitle(source);

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
            RETRY_CONFIG.TITLE_TIMEOUT_MS, // ✅ 8s — titles are tiny
            signal
          );

          if (!response.ok) return this.generateFallbackTitle(source);

          const data = (await response.json()) as GroqTitleResponse;
          const title = data?.title?.trim();
          if (!title) return this.generateFallbackTitle(source);

          return { success: true, title: this.sanitizeTitle(title) };
        },
        RETRY_CONFIG.MAX_RETRIES,
        RETRY_CONFIG.INITIAL_DELAY_MS,
        signal
      );
    } catch {
      return this.generateFallbackTitle(source);
    }
  },

  generateFallbackTitle(text: string): TitleGenerationResult {
    try {
      const cleaned = text.replace(/\s+/g, " ").trim();
      const firstSentence = (cleaned.match(/[^.!?]+[.!?]?/) || [""])[0].trim();
      const truncated =
        firstSentence.length > API_CONFIG.TITLE_MAX_LENGTH
          ? firstSentence.slice(0, 57).trim() + "…"
          : firstSentence;

      return {
        success: true,
        title: this.sanitizeTitle(truncated || cleaned.slice(0, API_CONFIG.TITLE_MAX_LENGTH)),
      };
    } catch {
      return { success: true, title: UI_STRINGS.UNTITLED_NOTE };
    }
  },

  sanitizeTitle(title: string): string {
    return (title || "")
      .replace(/[\r\n]+/g, " ")
      .replace(/^["'\s]+|["'\s]+$/g, "")
      .replace(/^```[\w]*\n/, "")
      .replace(/\n```$/, "")
      .trim();
  },
};
