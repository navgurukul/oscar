// Note-related type definitions

export interface Note {
  formattedText: string;
  rawText: string;
  title?: string;
}

export interface FormattingResult {
  success: boolean;
  formattedText?: string;
  error?: string;
}

export interface TitleGenerationResult {
  success: boolean;
  title?: string;
  error?: string;
}
