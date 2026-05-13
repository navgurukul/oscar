import type { DictationContextSnapshot } from "../types/scribble.types";

export type TabType =
  | "home"
  | "meetings"
  | "scribble"
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

// Re-export the canonical model variant union from whisper-models.ts. Keeping
// the old name alive so settings persisted under the previous schema
// (`MinutesModelVariant`) still type-check on load.
export type {
  WhisperModelVariant,
  ModelPreset as WhisperModelPreset,
  ModelSpec as WhisperModelSpec,
  ModelRecommendation as WhisperModelRecommendation,
  HardwareProfile,
  GpuBackend,
} from "./whisper-models";
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
