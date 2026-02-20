// Centralized constants file for the OSCAR application

/**
 * Error messages and tips
 */
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
  DEEPSEEK_API_ERROR: "Deepseek API error",
  DEEPSEEK_REQUEST_FAILED: "Deepseek request failed",
  INVALID_JSON_BODY: "Invalid JSON body",
  INVALID_DEEPSEEK_RESPONSE: "Invalid Deepseek response",
  SERVER_MISSING_API_KEY: "Server missing DEEPSEEK_API_KEY",
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

/**
 * API configuration and endpoints
 */
export const API_CONFIG = {
  // Internal API routes
  FORMAT_ENDPOINT: "/api/deepseek/format",
  FORMAT_EMAIL_ENDPOINT: "/api/deepseek/format-email",
  TITLE_ENDPOINT: "/api/deepseek/title",
  TRANSLATE_ENDPOINT: "/api/deepseek/translate",

  // External APIs
  DEEPSEEK_API_URL: "https://api.deepseek.com/v1/chat/completions",

  // DeepSeek model configuration
  DEEPSEEK_MODEL: "deepseek-chat",

  // Format API settings
  FORMAT_TEMPERATURE: 0.1,
  FORMAT_TOP_P: 0.9,
  FORMAT_MAX_TOKENS: 8192,

  // Title API settings
  TITLE_TEMPERATURE: 0.3,
  TITLE_TOP_P: 0.9,
  TITLE_MAX_TOKENS: 64,
  TITLE_MAX_LENGTH: 60,
} as const;

/**
 * User interface strings and labels
 */
export const UI_STRINGS = {
  // App branding
  APP_NAME: "OSCARRR",

  // Page titles
  PROCESSING_TITLE: "Processing Your Speech",
  RECORDING_TITLE: "Record Your Voice",
  RESULTS_TITLE: "Here's your note",

  // Loading states
  INITIALIZING: "Initializing...",
  REQUESTING_PERMISSION: "Requesting microphone permission...",
  LOADING_NOTE: "Loading your note...",

  // Note defaults
  UNTITLED_NOTE: "Untitled Note",
  NO_RAW_TRANSCRIPT: "No raw transcript available.",

  // Button labels
  CONTINUE_RECORDING: "Continue Recording",
  RECORD_AGAIN: "Record Again",
  SHOW_RAW_TRANSCRIPT: "Show Raw Transcript",
  HIDE_RAW_TRANSCRIPT: "Hide Raw Transcript",

  // Section labels
  RAW_TRANSCRIPT: "Raw Transcript",

  // Toast messages
  COPIED_TOAST_TITLE: "Copied!",
  COPIED_TOAST_DESCRIPTION: "Raw transcript copied to clipboard.",
  DOWNLOADED_TOAST_TITLE: "Downloaded!",
  DOWNLOADED_TOAST_DESCRIPTION: "Raw transcript saved to your device.",

  // Home page
  HOME_TAGLINE: "Speak your thoughts.",
  HOME_WORDS: [
    "Let AI write.",
    "Let AI refine.",
    "Let AI transform.",
    "Create effortlessly.",
  ],

  // Recording page
  RECORDING_INSTRUCTION:
    "Press the microphone button and start speaking. Oscar will do the rest.",

  // Download filenames
  NOTE_FILENAME: "oscar-note.txt",
  RAW_FILENAME: "oscar-raw.txt",
} as const;

/**
 * Processing screen steps
 */
export const PROCESSING_STEPS = [
  {
    title: "Analyzing Audio",
    description: "Processing sound waves",
  },
  {
    title: "AI Recognition",
    description: "Understanding speech patterns",
  },
  {
    title: "Formatting",
    description: "Structuring your text",
  },
] as const;

/**
 * Session storage keys
 */
export const STORAGE_KEYS = {
  FORMATTED_NOTE: "formattedNote",
  RAW_TEXT: "rawText",
  TITLE: "noteTitle",
  CONTINUE_MODE: "continueRecording",
  CURRENT_NOTE_ID: "currentNoteId",
} as const;

/**
 * Application routes
 */
export const ROUTES = {
  HOME: "/",
  RECORDING: "/recording",
  RESULTS: "/results",
  NOTES: "/notes",
  AUTH: "/auth",
  SETTINGS: "/settings",
  BILLING: "/billing",
  PRICING: "/pricing",
} as const;

/**
 * Recording configuration defaults
 */
export const RECORDING_CONFIG = {
  SESSION_DURATION_MS: 60000,
  INTERIM_SAVE_INTERVAL_MS: 1000,
  MIN_RECORDING_TIME: 2,
  IOS_RESTART_INTERVAL_MS: 25000,
  IOS_RESTART_DELAY_MS: 150,
  STOP_PROCESSING_DELAY_MS: 1500,
  COMPLETION_DELAY_MS: 600,
} as const;

/**
 * Permission handling configuration
 */
export const PERMISSION_CONFIG = {
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 2000,
} as const;

/**
 * Local formatter configuration for fallback text processing
 */
export const LOCAL_FORMATTER_CONFIG = {
  FILLER_WORDS: [
    "um",
    "uh",
    "er",
    "ah",
    "like",
    "you know",
    "actually",
    "basically",
    "so",
    "well",
    "i mean",
    "sort of",
    "kind of",
  ],
  PARAGRAPH_SENTENCE_COUNT: 4,
} as const;

/**
 * Subscription tier limits
 */
export const SUBSCRIPTION_CONFIG = {
  FREE_MONTHLY_RECORDINGS: 10, // Free tier: 10 recordings per month, Pro: unlimited
  FREE_MAX_NOTES: 20,
  FREE_MAX_VOCABULARY: 5,
} as const;

/**
 * Pricing configuration (INR)
 */
export const PRICING = {
  MONTHLY: 249,
  YEARLY: 1999,
  YEARLY_SAVINGS_PERCENT: 33,
  CURRENCY: "INR",
} as const;

/**
 * Rate limiting configuration
 * Protects APIs from abuse and runaway costs
 */
export const RATE_LIMITS = {
  // AI API Endpoints (DeepSeek) - More restrictive due to cost
  AI_FORMAT: {
    maxRequests: 20, // 20 requests per user
    windowMs: 60 * 1000, // Per 1 minute
    message:
      "Too many formatting requests. Please wait a moment before trying again.",
  },
  AI_TITLE: {
    maxRequests: 30, // 30 requests per user
    windowMs: 60 * 1000, // Per 1 minute
    message: "Too many title generation requests. Please wait a moment.",
  },
  AI_FORMAT_EMAIL: {
    maxRequests: 15, // 15 requests per user
    windowMs: 60 * 1000, // Per 1 minute
    message: "Too many email formatting requests. Please wait a moment.",
  },
  AI_TRANSLATE: {
    maxRequests: 15, // 15 requests per user
    windowMs: 60 * 1000, // Per 1 minute
    message: "Too many translation requests. Please wait a moment.",
  },

  // Payment API Endpoints - Prevent subscription spam
  PAYMENT_CREATE_SUBSCRIPTION: {
    maxRequests: 5, // 5 subscription creation attempts
    windowMs: 15 * 60 * 1000, // Per 15 minutes
    message: "Too many subscription requests. Please wait before trying again.",
  },

  // Webhook endpoints - Very generous but prevents DoS
  PAYMENT_WEBHOOK: {
    maxRequests: 100, // 100 webhooks per source
    windowMs: 60 * 1000, // Per 1 minute
    message: "Webhook rate limit exceeded.",
  },
} as const;
