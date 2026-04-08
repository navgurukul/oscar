// API-related type definitions

export interface GroqFormatRequest {
  rawText: string;
}

export interface GroqFormatResponse {
  formattedText: string;
}

export interface GroqTitleRequest {
  text: string;
}

export interface GroqTitleResponse {
  title: string;
}

export interface APIError {
  error: string;
  details?: string;
  status?: number;
}
