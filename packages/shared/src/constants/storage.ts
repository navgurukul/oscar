export const STORAGE_KEYS = {
  FORMATTED_SCRIBBLE: "formattedScribble",
  RAW_TEXT: "rawText",
  TITLE: "scribbleTitle",
  CONTINUE_MODE: "continueRecording",
  CURRENT_SCRIBBLE_ID: "currentScribbleId",
} as const;

export const ROUTES = {
  HOME: "/",
  RECORDING: "/recording",
  RESULTS: "/results",
  SCRIBBLE: "/scribble",
  AUTH: "/auth",
  SETTINGS: "/settings",
  BILLING: "/billing",
  PRICING: "/pricing",
  TEAM: "/team",
  ORG_SETTINGS: "/settings/organization",
  INVITE: "/invite",
  STREAMS: "/streams",
} as const;
