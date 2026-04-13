export const STORAGE_KEYS = {
  FORMATTED_NOTE: "formattedNote",
  RAW_TEXT: "rawText",
  TITLE: "noteTitle",
  CONTINUE_MODE: "continueRecording",
  CURRENT_NOTE_ID: "currentNoteId",
} as const;

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
