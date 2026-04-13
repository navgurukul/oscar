export const RECORDING_CONFIG = {
  SESSION_DURATION_MS: 60000,
  INTERIM_SAVE_INTERVAL_MS: 1000,
  MIN_RECORDING_TIME: 2,
  IOS_RESTART_INTERVAL_MS: 25000,
  IOS_RESTART_DELAY_MS: 150,
  STOP_PROCESSING_DELAY_MS: 1500,
  COMPLETION_DELAY_MS: 600,
} as const;

export const PERMISSION_CONFIG = {
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 2000,
} as const;

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
