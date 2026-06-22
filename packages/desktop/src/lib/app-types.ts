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

export interface TranscriptionPerf {
  /** VAD pre-filter wall-clock ms (`filter_speech` in whisper.rs). */
  vadMs: number;
  /** Time to acquire shared context handle + create per-call WhisperState. */
  stateCreateMs: number;
  /** `state.full(params, audio)` wall-clock ms — the dominant inference cost. */
  inferenceMs: number;
  /** Segment extraction + hallucination filter loop ms. */
  segmentsMs: number;
  /** Total wall-clock ms inside `transcribe_audio_inner`. */
  totalMs: number;
  /** Speech-audio length fed to inference, in samples (16 kHz mono). */
  speechSamples: number;
  /** Raw segments Whisper produced before filtering. */
  rawSegments: number;
  /** Segments dropped by `no_speech_probability` gate. */
  droppedNoSpeech: number;
  /** Segments dropped by `is_hallucination_segment`. */
  droppedHallucination: number;
}

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
  /** Populated by `transcribe_audio_inner`; absent when Whisper was skipped. */
  perf?: TranscriptionPerf;
}



export interface MeetingSegmentJob {
  blob: Blob;
  ext: string;
  /** Recording session that produced this segment. Threaded through to the
   *  Rust transcribe command so it reads the matching `(session, index)`
   *  system-audio buffer and never a buffer left by an abandoned meeting. */
  sessionId: number;
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
  // Monotonic id stamped at press; pairs the start event with its later
  // async context-enrichment event (see HotkeyContextEnrichPayload).
  sessionId?: number;
}

// Late, session-tagged context delivered after recording has already started:
// the AppleScript-derived window title + browser site that were deferred off
// the press path so the pill arms instantly. Applied only if sessionId still
// matches the active dictation.
export interface HotkeyContextEnrichPayload {
  sessionId: number;
  windowTitle?: string | null;
  siteHost?: string | null;
  siteTitle?: string | null;
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
  /** Serving a stop-gap model while the target variant downloads (WS-C). */
  interim?: boolean;
  /** hi-en being served by a general model as an offline degrade (I10) — UI
   *  shows the reduced-Hinglish-accuracy notice. */
  crossFamilyInterim?: boolean;
}

export interface DownloadProgress {
  /** Which model this progress belongs to — lets listeners route by variant
   *  instead of guessing from the current recommendation. */
  variant: WhisperModelVariant;
  downloaded: number;
  total: number;
  percentage: number;
}

export interface DownloadRetry {
  variant: WhisperModelVariant;
  attempt: number;
  max_attempts: number;
  delay_secs: number;
  reason: string;
}

export interface DictationContextEnvelope {
  context: DictationContextSnapshot;
}
