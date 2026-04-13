export const UI_STRINGS = {
  // App branding
  APP_NAME: "OSCAR",

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
