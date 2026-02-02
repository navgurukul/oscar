// Recording-related type definitions

export enum RecordingState {
  IDLE = "IDLE",
  INITIALIZING = "INITIALIZING",
  REQUESTING_PERMISSION = "REQUESTING_PERMISSION",
  READY = "READY",
  RECORDING = "RECORDING",
  PROCESSING = "PROCESSING",
  ERROR = "ERROR",
  PERMISSION_DENIED = "PERMISSION_DENIED",
}

export interface TranscriptUpdate {
  text: string;
  isFinal: boolean;
  timestamp: number;
}

export interface RecordingConfig {
  sessionDurationMs?: number;
  interimSaveIntervalMs?: number;
  preserveTranscriptOnStart?: boolean;
}

export interface RecordingError {
  code: string;
  message: string;
  details?: string;
  recoverable: boolean;
}

export interface RecordingSession {
  transcript: string;
  startTime: number;
  endTime?: number;
  duration: number;
}
