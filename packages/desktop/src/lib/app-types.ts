import type { DictationContextSnapshot } from "../types/scribble.types";
import type {
  ModelPreset as WhisperModelPreset,
  ModelRecommendation as WhisperModelRecommendation,
  WhisperModelVariant,
} from "./whisper-models";

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
  speechMs: number;
  hasDetectedSpeech: boolean;
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

export type MicrophonePermissionState = "granted" | "denied" | "prompt" | "unknown";
export type WhisperModelRole = "dictation" | "minutes";

// Re-export canonical model types from the Whisper registry.
export type {
  WhisperModelVariant,
  ModelPreset as WhisperModelPreset,
  ModelSpec as WhisperModelSpec,
  ModelRecommendation as WhisperModelRecommendation,
  HardwareProfile,
  GpuBackend,
} from "./whisper-models";
export type RoleModelDownloadState = "idle" | "checking" | "downloading" | "ready" | "error";

export interface RoleModelState {
  role: WhisperModelRole;
  preset: WhisperModelPreset;
  recommendation: WhisperModelRecommendation | null;
  activeVariant: WhisperModelVariant | null;
  resolvedPath: string | null;
  fallbackUsed: boolean;
  downloadState: RoleModelDownloadState;
  progress: number;
  error: string | null;
}

export interface DownloadProgress {
  downloaded: number;
  total: number;
  percentage: number;
}

export interface DictationContextEnvelope {
  context: DictationContextSnapshot;
}
