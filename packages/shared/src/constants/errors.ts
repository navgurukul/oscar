export const ERROR_MESSAGES = {
  // Browser/Device Errors
  BROWSER_NOT_SUPPORTED:
    "Speech recognition is not supported in this browser. On iOS, please use Safari. On other devices, use Chrome, Safari, or Edge.",
  MIC_NOT_FOUND: "No microphone found. Check your device and try again.",
  MIC_PERMISSION_DENIED:
    "Microphone permission required. Enable it from browser settings and reload.",
  MIC_IN_USE: "Microphone in use. Close other apps and try again.",

  // Permission-specific errors (for retry flow)
  PERMISSION_DENIED_RETRY:
    "Microphone access denied. Click 'Try Again' to allow access.",
  PERMISSION_BLOCKED:
    "Microphone access blocked. Please enable in browser settings.",

  // Recording Errors
  RECORDING_FAILED:
    "Failed to start recording. Please check microphone permissions.",
  NO_SPEECH_DETECTED: "No speech detected. Please try recording again.",
  RECORDING_TOO_SHORT:
    "Recording was too short. Please record for at least 3-5 seconds.",
  STT_INIT_FAILED:
    "Failed to initialize speech recognition. Please check browser compatibility and microphone permissions.",

  // Processing Errors
  PROCESSING_FAILED: "Failed to process recording. Please try again.",
  FORMATTING_FAILED: "Failed to format text. Please try again.",
  TITLE_GENERATION_FAILED: "Failed to generate title.",
  FORMATTING_FALLBACK:
    "AI unavailable - basic formatting applied. You can still edit your note.",
  FORMATTING_CANCELLED: "Formatting cancelled.",

  // API Errors
  API_ERROR: "API request failed. Please try again.",
  NETWORK_ERROR: "Network error. Please check your connection.",
  GROQ_API_ERROR: "Groq API error",
  GROQ_REQUEST_FAILED: "Groq request failed",
  INVALID_JSON_BODY: "Invalid JSON body",
  INVALID_GROQ_RESPONSE: "Invalid Groq response",
  SERVER_MISSING_API_KEY: "Server missing GROQ_API_KEY",
  RAW_TEXT_REQUIRED: "rawText is required",
  TEXT_REQUIRED: "text is required",
  NO_TEXT_PROVIDED_FOR_FORMATTING: "No text provided for formatting",
  NO_TEXT_PROVIDED_FOR_TITLE: "No text provided for title generation",
  NO_TEXT_PROVIDED_FOR_TRANSLATION: "No text provided for translation",
  EMPTY_RESPONSE_FROM_FORMATTING: "Empty response from formatting service",
  EMPTY_RESPONSE_FROM_TRANSLATION: "Empty response from translation service",

  // Storage Errors
  STORAGE_ERROR: "Failed to save data. Please try again.",

  // Generic
  UNKNOWN_ERROR: "An unexpected error occurred. Please try again.",
  STT_NOT_INITIALIZED: "STT not initialized",
} as const;

export const ERROR_TIPS = {
  MIC_TIPS: [
    "Make sure your microphone is working",
    "Speak clearly and loudly",
    "Check browser microphone permissions",
    "Try using Chrome, Safari, or Edge browser",
    "Record for at least 3-5 seconds",
  ],
} as const;
