// Note-related type definitions

export interface Note {
  formattedText: string
  rawText: string
  title?: string
  createdAt: number
  updatedAt: number
}

export interface NoteMetadata {
  title: string
  wordCount: number
  characterCount: number
  createdAt: number
  updatedAt: number
}

export interface FormattingResult {
  success: boolean
  formattedText?: string
  error?: string
}

export interface TitleGenerationResult {
  success: boolean
  title?: string
  error?: string
}
