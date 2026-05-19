export const API_CONFIG = {
  // Internal API routes
  FORMAT_ENDPOINT: "/api/ai/format",
  FORMAT_EMAIL_ENDPOINT: "/api/ai/format-email",
  TITLE_ENDPOINT: "/api/ai/title",
  TRANSLATE_ENDPOINT: "/api/ai/translate",

  // External APIs (Google Gemini, native API)
  GEMINI_API_BASE_URL: "https://generativelanguage.googleapis.com/v1beta",

  // Inference model
  GEMINI_MODEL: "gemini-2.5-flash",

  // Format API settings
  FORMAT_TEMPERATURE: 0.0,
  FORMAT_TOP_P: 0.7,
  FORMAT_MAX_TOKENS: 8192,

  // Title API settings
  TITLE_TEMPERATURE: 0.3,
  TITLE_TOP_P: 0.7,
  TITLE_MAX_TOKENS: 32,
  TITLE_MAX_LENGTH: 60,
} as const;
