// Storage service for session storage operations

import type { Note } from '../types/note.types'

const STORAGE_KEYS = {
  FORMATTED_NOTE: 'formattedNote',
  RAW_TEXT: 'rawText',
  TITLE: 'noteTitle',
  CONTINUE_MODE: 'continueRecording',
} as const

export const storageService = {
  /**
   * Save complete note data to session storage
   */
  saveNote(formatted: string, raw: string, title?: string): void {
    try {
      sessionStorage.setItem(STORAGE_KEYS.FORMATTED_NOTE, formatted)
      sessionStorage.setItem(STORAGE_KEYS.RAW_TEXT, raw)
      if (title) {
        sessionStorage.setItem(STORAGE_KEYS.TITLE, title)
      }
    } catch (error) {
      console.error('Failed to save note to storage:', error)
      throw new Error('Failed to save note data')
    }
  },

  /**
   * Retrieve complete note data from session storage
   */
  getNote(): Partial<Note> | null {
    try {
      const formattedText = sessionStorage.getItem(STORAGE_KEYS.FORMATTED_NOTE)
      const rawText = sessionStorage.getItem(STORAGE_KEYS.RAW_TEXT)
      const title = sessionStorage.getItem(STORAGE_KEYS.TITLE)

      if (!formattedText && !rawText) {
        return null
      }

      return {
        formattedText: formattedText || '',
        rawText: rawText || '',
        title: title || undefined,
      }
    } catch (error) {
      console.error('Failed to retrieve note from storage:', error)
      return null
    }
  },

  /**
   * Get formatted note text
   */
  getFormattedNote(): string | null {
    return sessionStorage.getItem(STORAGE_KEYS.FORMATTED_NOTE)
  },

  /**
   * Get raw transcript text
   */
  getRawText(): string | null {
    return sessionStorage.getItem(STORAGE_KEYS.RAW_TEXT)
  },

  /**
   * Get note title
   */
  getTitle(): string | null {
    return sessionStorage.getItem(STORAGE_KEYS.TITLE)
  },

  /**
   * Update formatted note text
   */
  updateFormattedNote(text: string): void {
    sessionStorage.setItem(STORAGE_KEYS.FORMATTED_NOTE, text)
  },

  /**
   * Update note title
   */
  updateTitle(title: string): void {
    sessionStorage.setItem(STORAGE_KEYS.TITLE, title)
  },

  /**
   * Clear all note-related data
   */
  clearNote(): void {
    sessionStorage.removeItem(STORAGE_KEYS.FORMATTED_NOTE)
    sessionStorage.removeItem(STORAGE_KEYS.RAW_TEXT)
    sessionStorage.removeItem(STORAGE_KEYS.TITLE)
    sessionStorage.removeItem(STORAGE_KEYS.CONTINUE_MODE)
  },

  /**
   * Set continue recording mode flag
   */
  setContinueMode(enabled: boolean): void {
    if (enabled) {
      sessionStorage.setItem(STORAGE_KEYS.CONTINUE_MODE, 'true')
    } else {
      sessionStorage.removeItem(STORAGE_KEYS.CONTINUE_MODE)
    }
  },

  /**
   * Check if continue recording mode is active
   */
  getContinueMode(): boolean {
    return sessionStorage.getItem(STORAGE_KEYS.CONTINUE_MODE) === 'true'
  },

  /**
   * Clear continue mode flag
   */
  clearContinueMode(): void {
    sessionStorage.removeItem(STORAGE_KEYS.CONTINUE_MODE)
  },
}
