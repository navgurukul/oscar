'use client'

import { useState } from 'react'
import { aiService } from '../services/ai.service'
import type { FormattingResult, TitleGenerationResult } from '../types/note.types'

export function useAIFormatting() {
  const [isFormatting, setIsFormatting] = useState(false)
  const [isTitleGenerating, setIsTitleGenerating] = useState(false)
  const [formattingError, setFormattingError] = useState<string | null>(null)
  const [titleError, setTitleError] = useState<string | null>(null)

  const formatText = async (rawText: string): Promise<FormattingResult> => {
    setIsFormatting(true)
    setFormattingError(null)

    try {
      const result = await aiService.formatText(rawText)
      
      if (!result.success) {
        setFormattingError(result.error || 'Failed to format text')
      }
      
      return result
    } catch (error: any) {
      const errorMsg = error?.message || 'Failed to format text'
      setFormattingError(errorMsg)
      return {
        success: false,
        error: errorMsg,
      }
    } finally {
      setIsFormatting(false)
    }
  }

  const generateTitle = async (text: string): Promise<TitleGenerationResult> => {
    setIsTitleGenerating(true)
    setTitleError(null)

    try {
      const result = await aiService.generateTitle(text)
      
      if (!result.success) {
        setTitleError(result.error || 'Failed to generate title')
      }
      
      return result
    } catch (error: any) {
      const errorMsg = error?.message || 'Failed to generate title'
      setTitleError(errorMsg)
      return {
        success: false,
        error: errorMsg,
      }
    } finally {
      setIsTitleGenerating(false)
    }
  }

  const clearErrors = () => {
    setFormattingError(null)
    setTitleError(null)
  }

  return {
    isFormatting,
    isTitleGenerating,
    formattingError,
    titleError,
    formatText,
    generateTitle,
    clearErrors,
  }
}
