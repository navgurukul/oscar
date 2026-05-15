// API-related type definitions

export interface FormatRequest {
  rawText: string;
}

export interface FormatResponse {
  formattedText: string;
}

export interface TitleRequest {
  text: string;
}

export interface TitleResponse {
  title: string;
}

export interface APIError {
  error: string;
  details?: string;
  status?: number;
}
