import type { MinutesModelVariant } from "./app-types";

export const WINDOW_DRAG_BLOCKERS =
  "button, a, input, textarea, select, [role='button'], [contenteditable='true']";

export const MODEL_URL =
  "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin";
export const MODEL_PATH = ".oscar/models/ggml-base.bin";
export const OLD_MODEL_PATH = ".oscar/models/ggml-tiny.bin";
export const MINUTES_DATA_RESET_VERSION = "enhanced-notes-v1";
export const MINUTES_MODEL_URL =
  "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin";
export const MINUTES_MODEL_PATH = ".oscar/models/ggml-large-v3-turbo-q5_0.bin";
export const MINUTES_MODEL_VARIANT: MinutesModelVariant = "large-v3-turbo-q5_0";
export const MEETING_SEGMENT_DURATION_MS = 120_000;
export const SYSTEM_AUDIO_SETTINGS_URL =
  "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture";
