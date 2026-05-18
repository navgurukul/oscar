// Storage service for session storage operations

import type { Scribble } from "../types/scribble.types";
import { STORAGE_KEYS } from "../constants";

/**
 * Check if we're in a browser environment
 */
function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

export const storageService = {
  /**
   * Save complete scribble data to session storage
   */
  saveScribble(formatted: string, raw: string, title?: string): void {
    if (!isBrowser()) {
      console.warn("sessionStorage not available (SSR context)");
      return;
    }

    try {
      sessionStorage.setItem(STORAGE_KEYS.FORMATTED_SCRIBBLE, formatted);
      sessionStorage.setItem(STORAGE_KEYS.RAW_TEXT, raw);
      if (title) {
        sessionStorage.setItem(STORAGE_KEYS.TITLE, title);
      } else {
        sessionStorage.removeItem(STORAGE_KEYS.TITLE);
      }
    } catch (error) {
      // sessionStorage can fail when storage is full or in private browsing.
      // Log but do not throw — the scribble will still be in memory for this session.
      console.error("Failed to save scribble to storage:", error);
    }
  },

  /**
   * Retrieve complete scribble data from session storage
   */
  getScribble(): Partial<Scribble> | null {
    if (!isBrowser()) {
      return null;
    }

    try {
      const formattedText = sessionStorage.getItem(STORAGE_KEYS.FORMATTED_SCRIBBLE);
      const rawText = sessionStorage.getItem(STORAGE_KEYS.RAW_TEXT);
      const title = sessionStorage.getItem(STORAGE_KEYS.TITLE);

      if (!formattedText && !rawText) {
        return null;
      }

      return {
        formattedText: formattedText || "",
        rawText: rawText || "",
        title: title || undefined,
      };
    } catch (error) {
      console.error("Failed to retrieve scribble from storage:", error);
      return null;
    }
  },

  /**
   * Get raw transcript text
   */
  getRawText(): string | null {
    if (!isBrowser()) {
      return null;
    }
    return sessionStorage.getItem(STORAGE_KEYS.RAW_TEXT);
  },

  /**
   * Update formatted scribble text
   */
  updateFormattedScribble(text: string): void {
    if (!isBrowser()) {
      return;
    }
    sessionStorage.setItem(STORAGE_KEYS.FORMATTED_SCRIBBLE, text);
  },

  /**
   * Update raw transcript text
   */
  updateRawText(text: string): void {
    if (!isBrowser()) {
      return;
    }
    sessionStorage.setItem(STORAGE_KEYS.RAW_TEXT, text);
  },

  /**
   * Clear all scribble-related data
   */
  clearScribble(): void {
    if (!isBrowser()) {
      return;
    }
    sessionStorage.removeItem(STORAGE_KEYS.FORMATTED_SCRIBBLE);
    sessionStorage.removeItem(STORAGE_KEYS.RAW_TEXT);
    sessionStorage.removeItem(STORAGE_KEYS.TITLE);
    sessionStorage.removeItem(STORAGE_KEYS.CONTINUE_MODE);
    sessionStorage.removeItem(STORAGE_KEYS.CURRENT_SCRIBBLE_ID);
  },

  /**
   * Set continue recording mode flag
   */
  setContinueMode(enabled: boolean): void {
    if (!isBrowser()) {
      return;
    }
    if (enabled) {
      sessionStorage.setItem(STORAGE_KEYS.CONTINUE_MODE, "true");
    } else {
      sessionStorage.removeItem(STORAGE_KEYS.CONTINUE_MODE);
    }
  },

  /**
   * Check if continue recording mode is active
   */
  getContinueMode(): boolean {
    if (!isBrowser()) {
      return false;
    }
    return sessionStorage.getItem(STORAGE_KEYS.CONTINUE_MODE) === "true";
  },

  /**
   * Clear continue mode flag
   */
  clearContinueMode(): void {
    if (!isBrowser()) {
      return;
    }
    sessionStorage.removeItem(STORAGE_KEYS.CONTINUE_MODE);
  },

  /**
   * Set current scribble ID
   */
  setCurrentScribbleId(id: string | null): void {
    if (!isBrowser()) {
      return;
    }
    if (id) {
      sessionStorage.setItem(STORAGE_KEYS.CURRENT_SCRIBBLE_ID, id);
    } else {
      sessionStorage.removeItem(STORAGE_KEYS.CURRENT_SCRIBBLE_ID);
    }
  },

  /**
   * Get current scribble ID
   */
  getCurrentScribbleId(): string | null {
    if (!isBrowser()) {
      return null;
    }
    return sessionStorage.getItem(STORAGE_KEYS.CURRENT_SCRIBBLE_ID);
  },
};
