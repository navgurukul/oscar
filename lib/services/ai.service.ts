// AI service for text formatting and title generation

import type { FormattingResult, TitleGenerationResult } from '../types/note.types'
import type { APIResult, DeepseekFormatResponse, DeepseekTitleResponse } from '../types/api.types'

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
        error: 'No text provided for formatting',
      }
    }

    try {
      const response = await fetch('/api/deepseek/format', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Format API error: ${response.status}`, errorText)
        return {
          success: false,
          error: `Formatting failed: ${response.status}`,
        }
      }

      const data = await response.json() as DeepseekFormatResponse
      const formattedText = data?.formattedText?.trim()
      
      if (!formattedText) {
        return {
          success: false,
          error: 'Empty response from formatting service',
        }
      }

      // Remove markdown code blocks if present
      const cleanedText = formattedText
        .replace(/^```[\w]*\n/, '')
        .replace(/\n```$/, '')
        .trim()

      return {
        success: true,
        formattedText: cleanedText,
      }
    } catch (error: any) {
      console.error('Format text error:', error)
      return {
        success: false,
        error: error?.message || 'Failed to format text',
      }
    }
  },

  /**
   * Generate a concise title for the note
   * @param text - Formatted or raw text content
   * @returns Title generation result
   */
  async generateTitle(text: string): Promise<TitleGenerationResult> {
    const source = (text || '').trim()
    
    if (!source) {
      return {
        success: false,
        error: 'No text provided for title generation',
      }
    }

    try {
      const response = await fetch('/api/deepseek/title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: source }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Title API error: ${response.status}`, errorText)
        
        // Fallback to heuristic title
        return this.generateFallbackTitle(source)
      }

      const data = await response.json() as DeepseekTitleResponse
      const title = data?.title?.trim()
      
      if (!title) {
        return this.generateFallbackTitle(source)
      }

      const sanitized = this.sanitizeTitle(title)
      
      return {
        success: true,
        title: sanitized,
      }
    } catch (error: any) {
      console.error('Title generation error:', error)
      return this.generateFallbackTitle(source)
    }
  },

  /**
   * Generate fallback title using heuristic approach
   * @param text - Text content
   * @returns Heuristic title
   */
  generateFallbackTitle(text: string): TitleGenerationResult {
    try {
      const cleaned = text.replace(/\s+/g, ' ').trim()
      const firstSentence = (cleaned.match(/[^.!?]+[.!?]?/) || [''])[0].trim()
      const truncated = firstSentence.length > 60 
        ? firstSentence.slice(0, 57).trim() + '…' 
        : firstSentence
      
      const title = this.sanitizeTitle(truncated || cleaned.slice(0, 60))
      
      return {
        success: true,
        title,
      }
    } catch (error) {
      return {
        success: true,
        title: 'Untitled Note',
      }
    }
  },

  /**
   * Sanitize title by removing unwanted characters
   * @param title - Raw title
   * @returns Cleaned title
   */
  sanitizeTitle(title: string): string {
    return (title || '')
      .replace(/[\r\n]+/g, ' ')
      .replace(/^["'\s]+|["'\s]+$/g, '')
      .replace(/^```[\w]*\n/, '')
      .replace(/\n```$/, '')
      .trim()
  },
}
