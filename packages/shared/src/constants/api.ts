export const API_CONFIG = {
  // Internal API routes
  FORMAT_ENDPOINT: "/api/groq/format",
  FORMAT_EMAIL_ENDPOINT: "/api/groq/format-email",
  TITLE_ENDPOINT: "/api/groq/title",
  TRANSLATE_ENDPOINT: "/api/groq/translate",

  // External APIs (Cerebras Cloud, OpenAI-compatible endpoint)
  GROQ_API_URL: "https://api.cerebras.ai/v1/chat/completions",

  // Inference model
  GROQ_MODEL: "llama3.1-8b",

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
