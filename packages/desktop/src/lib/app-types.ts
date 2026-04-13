import type { DictationContextSnapshot } from "../types/note.types";

export type TabType =
  | "home"
  | "meetings"
  | "notes"
  | "vocabulary"
  | "billing"
  | "settings";

export interface Transcription {
  text: string;
  error?: string;
  segments?: Array<{
    text: string;
    start_ms: number;
    end_ms: number;
    speaker: {
      source: "microphone" | "speaker";
      diarization_label?: string;
    };
  }>;
}

export interface MeetingSegmentJob {
  blob: Blob;
  ext: string;
  segmentIndex: number;
  useSystemAudio: boolean;
  startedAtMs: number;
  endedAtMs: number;
}

export interface HotkeyContextEventPayload {
  platform?: string;
  appName?: string;
  appId?: string | null;
  processName?: string | null;
  windowTitle?: string | null;
  siteHost?: string | null;
  siteTitle?: string | null;
  targetAppName?: string | null;
}

export type TonePreset = "none" | "professional" | "casual" | "friendly";
export type MicrophonePermissionState = "granted" | "denied" | "prompt" | "unknown";
export type WhisperModelRole = "dictation" | "minutes";
export type MinutesModelVariant = "large-v3-turbo-q5_0";
export type MinutesModelDownloadState = "idle" | "downloading" | "installed";

export interface DownloadProgress {
  downloaded: number;
  total: number;
  percentage: number;
}

export interface DictationContextEnvelope {
  context: DictationContextSnapshot;
}
