// Web-specific constants — imports base from shared, overrides only what differs.
import {
  API_CONFIG as _API_CONFIG,
  UI_STRINGS as _UI_STRINGS,
  ROUTES as _ROUTES,
  RATE_LIMITS as _RATE_LIMITS,
} from "@oscar/shared/constants";

// Re-export unchanged constants directly
export {
  ERROR_MESSAGES,
  ERROR_TIPS,
  PROCESSING_STEPS,
  STORAGE_KEYS,
  RECORDING_CONFIG,
  PERMISSION_CONFIG,
  LOCAL_FORMATTER_CONFIG,
  SUBSCRIPTION_CONFIG,
  PRICING,
  PRICING_USD,
} from "@oscar/shared/constants";
export type { Currency } from "@oscar/shared/constants";

// API_CONFIG — web adds streaming flags, transform endpoint, different top_p/title_max_length
export const API_CONFIG = {
  ..._API_CONFIG,
  TRANSFORM_ENDPOINT: "/api/groq/transform",
  GROQ_MODEL_FAST: "llama-3.1-8b-instant",
  FORMAT_TOP_P: 1.0,
  FORMAT_EMAIL_MAX_TOKENS: 2048,
  FORMAT_TRANSFORM_MAX_TOKENS: 1536,
  FORMAT_STREAM: true,
  TITLE_MAX_LENGTH: 40,
  TITLE_STREAM: false,
  TRANSLATE_TEMPERATURE: 0.0,
  TRANSLATE_MAX_TOKENS: 1024,
} as const;

// UI_STRINGS — web overrides branding for Stream/Scribble terminology
export const UI_STRINGS = {
  ..._UI_STRINGS,
  RECORDING_TITLE: "Start a Stream",
  RESULTS_TITLE: "Fresh Scribble",
  HOME_TAGLINE: "Start a Stream.",
  RECORDING_INSTRUCTION:
    "Press the microphone button and start speaking. Oscar will turn your Stream into a Scribble.",
} as const;

// ROUTES — web adds DOWNLOAD, MEETINGS
export const ROUTES = {
  ..._ROUTES,
  MEETINGS: "/meetings",
  DOWNLOAD: "/download",
} as const;

// RATE_LIMITS — web adds AI_TRANSFORM
export const RATE_LIMITS = {
  ..._RATE_LIMITS,
  AI_TRANSFORM: {
    maxRequests: 15,
    windowMs: 60 * 1000,
    message: "Too many transform requests. Please wait a moment.",
  },
} as const;
