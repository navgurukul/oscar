export const API_CONFIG = {
  // Internal API routes
  FORMAT_ENDPOINT: "/api/groq/format",
  FORMAT_EMAIL_ENDPOINT: "/api/groq/format-email",
  TITLE_ENDPOINT: "/api/groq/title",
  TRANSLATE_ENDPOINT: "/api/groq/translate",

  // External APIs
  GROQ_API_URL: "https://api.groq.com/openai/v1/chat/completions",

  // Groq model
  GROQ_MODEL: "llama-3.1-8b-instant",

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
