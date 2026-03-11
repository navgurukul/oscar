// API-related type definitions

export interface DeepseekFormatRequest {
  rawText: string;
}

export interface DeepseekFormatResponse {
  formattedText: string;
}

export interface DeepseekTitleRequest {
  text: string;
}

export interface DeepseekTitleResponse {
  title: string;
}

export interface APIError {
  error: string;
  details?: string;
  status?: number;
}
