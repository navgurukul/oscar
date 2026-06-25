export const API_CONFIG = {
  // Internal API routes
  FORMAT_ENDPOINT: "/api/ai/format",
  FORMAT_EMAIL_ENDPOINT: "/api/ai/format-email",
  TITLE_ENDPOINT: "/api/ai/title",
  TRANSLATE_ENDPOINT: "/api/ai/translate",
  TRANSFORM_ENDPOINT: "/api/ai/transform",
  // Stream/dictation cleanup. Web mirror of the desktop ai-process edge
  // function's transcribe_cleanup path, so desktop dictation can run on the
  // same Amplify Mercury route as Scribble (one key, one client). Gated on the
  // desktop by VITE_STREAM_CLEANUP_VIA_WEB; off = legacy edge path.
  DICTATION_CLEANUP_ENDPOINT: "/api/ai/dictation-cleanup",

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
  // 64 (not 32): headroom for 4–10 word titles in multi-token languages
  // (Hindi/Hinglish tokenize to more tokens per word). Reasoning is disabled
  // for this call server-side (thinkingBudget=0), so the full budget reaches
  // the title text.
  TITLE_MAX_TOKENS: 64,
  TITLE_MAX_LENGTH: 60,
} as const;
