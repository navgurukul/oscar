import { useState, useRef, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { meetingsService } from "./services/meetings.service";
import { aiService } from "./services/ai.service";
import { scribblesService } from "./services/scribbles.service";
import { streamsService } from "./services/streams.service";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { Navigation } from "./components/Navigation";
import { Header } from "./components/Header";
import { ScribbleTab } from "./components/ScribbleTab";
import { SettingsTab } from "./components/SettingsTab";
import { UpdateNotification } from "./components/UpdateNotification";
import { UpgradeModal } from "./components/UpgradeModal";
import { PermissionRecoveryModal } from "./components/PermissionRecoveryModal";
import { UpdateReleaseNotesModal } from "./components/UpdateReleaseNotesModal";
import { useMinutesRecorder } from "./hooks/useMinutesRecorder";
import { useUpdater } from "./hooks/useUpdater";
import HomeTab from "./components/HomeTab";
import { MeetingsTab } from "./components/MeetingsTab";
import { AuthScreen } from "./components/onboarding/AuthScreen";
import { PermissionsScreen } from "./components/onboarding/PermissionsScreen";
import { SetupScreen } from "./components/onboarding/SetupScreen";
import { isAuthSessionError, revalidateSession } from "./lib/auth-session";
import { isAuthCallbackTrusted, clearAuthFlow } from "./lib/auth-flow";
import {
  isContextAwarePlatform,
  routeDictationContext,
} from "./lib/dictation-context";
import type { CalendarReconnectResult } from "./components/MeetingsTab";
import type { SavedMeetingRecord } from "./types/meeting.types";
import type {
  DictationContextSnapshot,
  LocalTranscript,
} from "./types/scribble.types";
import type {
  DownloadProgress,
  DownloadRetry,
  HotkeyContextEventPayload,
  HotkeyContextEnrichPayload,
  MicrophonePermissionState,
  RoleModelState,
  TabType,
  Transcription,
  WhisperModelRole,
} from "./lib/app-types";
import { MINUTES_DATA_RESET_VERSION } from "./lib/desktop-constants";
import {
  buildDictationContextSnapshot,
  buildDictationMetadata,
  getDesktopPlatform,
  getMicrophonePermissionState,
  isMacOS,
} from "./lib/desktop-platform";
import {
  DEFAULT_CLEANUP_STYLE,
  type CleanupStyle,
  type CleanupStyleWire,
} from "./lib/cleanup-style";
import { buildInitialPrompt, getWhisperLanguage } from "./lib/whisper";
import {
  type ModelSpec,
  type ModelPreset as WhisperModelPreset,
  type WhisperModelVariant,
} from "./lib/whisper-models";
import {
  downloadModel,
  pickCrossFamilyInterim,
  resolveModelForRole,
} from "./lib/whisper-model-manager";
import { getStore, loadSetting, saveSetting } from "./lib/store";
import { getSubscriptionEntitlement } from "@oscar/shared/constants";
import { applyTranscriptPostProcessing } from "@oscar/shared/prompts";
import "./App.css";

const STREAM_TAIL_BUFFER_MS = 200;

// Hard ceiling on the silent AI cleanup before a dictation pastes anyway. The
// cleanup median is ~1.8s; this only fires on a hung/slow Mercury call (the
// perf-log tail reaches tens of seconds). On timeout the controller aborts the
// fetch and the raw Whisper transcript is pasted, so the pill never freezes.
const STREAM_CLEANUP_DEADLINE_MS = 7000;

// Stall watchdog for the dictation flow. The per-dictation perf.jsonl record is
// only written in processAudio's `finally`, which a truly hung `await` (dead
// socket, stale GPU context, wedged paste) never reaches — so hangs leave NO
// trace and the log looks clean. This independent timer fires while the flow is
// stuck and writes a one-shot `kind:"stall"` breadcrumb naming the stage we were
// in. LOG-ONLY: it must never abort the work (a legitimately slow transcription
// on a low-end CPU must finish), so a slow-but-completing run emits both a stall
// and a normal record sharing `dictationId`; a real hang emits only the stall.
// Set well above any healthy run (cleanup is bounded to 7s; the longest stage is
// transcription) so it flags genuine wedges, not slow-but-progressing work.
const STREAM_STALL_WATCHDOG_MS = 25000;

// Local "already-clean" fast-path. Returns true only when the raw Whisper text
// already reads as a clean, complete, short English utterance that "faithful"
// cleanup would leave essentially unchanged — letting the dictation paste it
// directly and skip the ~1.8s Mercury round-trip. Strict by design: ASCII-only
// (non-English defers to cleanup), capitalized start, terminal punctuation,
// short, and free of filler/stutter/spacing damage. Any doubt → false → cleanup
// runs. A pure-punctuation hallucination fails the capitalized-start gate, so it
// never fast-paths (it still reaches the server, which suppresses it).
const STREAM_FASTPATH_MAX_WORDS = 12;
const STREAM_FILLER_RE = /\b(?:u+m+|u+h+|e+r+|h+m+|mhm|mmm)\b/i;
function looksAlreadyCleanForPaste(text: string): boolean {
  const t = text.trim();
  if (!t || /[\n\r]/.test(t)) return false;
  if (!/^[\x20-\x7E]+$/.test(t)) return false; // ASCII only
  if (!/^[A-Z0-9"']/.test(t)) return false; // capitalized / quoted start
  if (!/[.!?]["')]?$/.test(t)) return false; // terminal punctuation
  if (t.split(/\s+/).length > STREAM_FASTPATH_MAX_WORDS) return false;
  if (STREAM_FILLER_RE.test(t)) return false; // disfluency
  if (/\s{2,}/.test(t) || /\s[,.;:!?]/.test(t)) return false; // spacing damage
  if (/\b(\w+)\s+\1\b/i.test(t)) return false; // repeated-word stutter
  return true;
}

interface PasteMetricsResponse {
  kind?: string;
  status?: string;
  trusted?: boolean;
  targetBundleId?: string | null;
  targetApp?: string | null;
  activated?: boolean;
  targetFound?: boolean;
  timings?: Record<string, number>;
}

function parsePasteMetricsResponse(value: string): PasteMetricsResponse | null {
  try {
    const parsed = JSON.parse(value) as PasteMetricsResponse;
    return parsed && parsed.kind === "paste-metrics" ? parsed : null;
  } catch {
    return null;
  }
}

function normalizePasteTimingKey(key: string): string {
  return key.replace(/Ms$/, "").replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

function buildFallbackScribbleTitle(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  const firstSentence = normalized.split(/[.!?\n]/)[0]?.trim() || normalized;
  const title = firstSentence.slice(0, 60).trim();
  return title || "Untitled Scribble";
}

interface AudioTrimResult {
  audio: Float32Array;
  originalSamples: number;
  trimmedSamples: number;
  leadingTrimMs: number;
  trailingTrimMs: number;
  voicedFrames: number;
  thresholdRms: number;
  thresholdPeak: number;
}

const STREAM_SAMPLE_RATE = 16_000;
const STREAM_TRIM_FRAME_MS = 20;
const STREAM_TRIM_PADDING_MS = 250;
const STREAM_MIN_TRIM_MS = 120;
const STREAM_MIN_RETAINED_MS = 800;
const STREAM_TRIM_RMS_THRESHOLD = 0.006;
const STREAM_TRIM_PEAK_THRESHOLD = 0.025;

function durationMsForSamples(samples: number): number {
  return Math.round((samples / STREAM_SAMPLE_RATE) * 1000);
}

function trimStreamSilence(audio: Float32Array): AudioTrimResult {
  const frameSize = Math.max(
    1,
    Math.round((STREAM_SAMPLE_RATE * STREAM_TRIM_FRAME_MS) / 1000),
  );
  const paddingSamples = Math.round(
    (STREAM_SAMPLE_RATE * STREAM_TRIM_PADDING_MS) / 1000,
  );
  const minRetainedSamples = Math.round(
    (STREAM_SAMPLE_RATE * STREAM_MIN_RETAINED_MS) / 1000,
  );

  let firstVoiced = -1;
  let lastVoiced = -1;
  let voicedFrames = 0;

  for (let frameStart = 0; frameStart < audio.length; frameStart += frameSize) {
    const frameEnd = Math.min(audio.length, frameStart + frameSize);
    let sumSq = 0;
    let peak = 0;

    for (let i = frameStart; i < frameEnd; i++) {
      const sample = audio[i];
      sumSq += sample * sample;
      const abs = sample < 0 ? -sample : sample;
      if (abs > peak) peak = abs;
    }

    const rms = Math.sqrt(sumSq / Math.max(1, frameEnd - frameStart));
    if (rms >= STREAM_TRIM_RMS_THRESHOLD || peak >= STREAM_TRIM_PEAK_THRESHOLD) {
      voicedFrames += 1;
      if (firstVoiced === -1) firstVoiced = frameStart;
      lastVoiced = frameEnd;
    }
  }

  if (firstVoiced === -1 || lastVoiced === -1) {
    return {
      audio,
      originalSamples: audio.length,
      trimmedSamples: audio.length,
      leadingTrimMs: 0,
      trailingTrimMs: 0,
      voicedFrames,
      thresholdRms: STREAM_TRIM_RMS_THRESHOLD,
      thresholdPeak: STREAM_TRIM_PEAK_THRESHOLD,
    };
  }

  const start = Math.max(0, firstVoiced - paddingSamples);
  const end = Math.min(audio.length, lastVoiced + paddingSamples);
  const trimmedSamples = end - start;
  const removedSamples = audio.length - trimmedSamples;

  if (
    trimmedSamples < minRetainedSamples ||
    durationMsForSamples(removedSamples) < STREAM_MIN_TRIM_MS
  ) {
    return {
      audio,
      originalSamples: audio.length,
      trimmedSamples: audio.length,
      leadingTrimMs: 0,
      trailingTrimMs: 0,
      voicedFrames,
      thresholdRms: STREAM_TRIM_RMS_THRESHOLD,
      thresholdPeak: STREAM_TRIM_PEAK_THRESHOLD,
    };
  }

  return {
    audio: audio.slice(start, end),
    originalSamples: audio.length,
    trimmedSamples,
    leadingTrimMs: durationMsForSamples(start),
    trailingTrimMs: durationMsForSamples(audio.length - end),
    voicedFrames,
    thresholdRms: STREAM_TRIM_RMS_THRESHOLD,
    thresholdPeak: STREAM_TRIM_PEAK_THRESHOLD,
  };
}

function createRoleModelState(
  role: WhisperModelRole,
  preset: WhisperModelPreset = "auto",
): RoleModelState {
  return {
    role,
    preset,
    recommendation: null,
    activeVariant: null,
    resolvedPath: null,
    fallbackUsed: false,
    downloadState: "idle",
    progress: 0,
    error: null,
  };
}

function App() {
  const defaultContextAwareDictationEnabled = isContextAwarePlatform(
    getDesktopPlatform(),
  );

  // Auth
  const [user, setUser] = useState<User | null>(null);
  const [, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // First-run gates
  const [permissionsShown, setPermissionsShown] = useState<boolean | null>(
    null,
  );
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null);

  // Recording & processing (global hotkey functionality)
  const [_isRecording, setIsRecording] = useState(false);
  const [_transcript, setTranscript] = useState("");
  const [localTranscripts, setLocalTranscripts] = useState<LocalTranscript[]>(
    [],
  );
  const [isScribbleRecording, setIsScribbleRecording] = useState(false);
  const [scribbleRecordingTime, setScribbleRecordingTime] = useState(0);
  const [scribbleRefreshKey, setScribbleRefreshKey] = useState(0);
  const [isScribbleProcessing, setIsScribbleProcessing] = useState(false);
  const [scribbleStatus, setScribbleStatus] = useState<string | null>(null);
  const [_whisperLoaded, setWhisperLoaded] = useState(false);
  const [_status, setStatus] = useState("Initializing...");
  // Boot progress of the local voice engine (model load + warm-up). Drives the
  // banner in the main shell so the first launch after install — when the
  // model load and warm-up can take minutes — reads as visible progress
  // instead of a hang.
  const [engineBootPhase, setEngineBootPhase] = useState<
    "idle" | "loading" | "warming" | "ready" | "error"
  >("idle");
  const [_isProcessing, setIsProcessing] = useState(false);
  // Ref mirror of the dictation/scribble processing state so the synchronous
  // meeting-start gate can read it without a stale closure (WS-C rule 4).
  const isProcessingRef = useRef(false);
  useEffect(() => {
    isProcessingRef.current = _isProcessing;
  }, [_isProcessing]);
  // Deferred model load (WS-C rule 3 / I3): when a swap is requested while a
  // pipeline is busy, the download proceeds eagerly but the load is queued here
  // and applied once idle, so the resident context never changes under an
  // in-flight transcription (matrix row 7).
  const pendingLoadRef = useRef<
    Partial<Record<WhisperModelRole, WhisperModelVariant>>
  >({});
  // Stable getter, re-assigned each render below once all the busy refs exist —
  // true while ANY STT pipeline is active, so a model swap or clear-data holds.
  const isAnyPipelineBusyRef = useRef<() => boolean>(() => false);
  // Roles with a download in flight — lets a passive inspect (autoDownload:
  // false) avoid clobbering a live `downloading` state, closing the startup
  // race where the inspect effect raced initWhisper's download (WS-D).
  const downloadingRolesRef = useRef<Set<WhisperModelRole>>(new Set());
  // True when dictation has SOME model to serve right now — the target, a
  // same-family interim, or a cross-family (degraded) interim. The hotkey gate
  // reads this: when false (e.g. English selected with only Hinglish installed,
  // or a fresh download with no interim), it shows the pill's downloading phase
  // and captures no audio (matrix rows 5, 11) while still recording on a serving
  // interim (rows 9, 10).
  const dictationServeableRef = useRef(false);
  const [hotkeyWarning, setHotkeyWarning] = useState("");
  const [dictationConflict, setDictationConflict] = useState(false);

  // Settings panel
  const [_whisperModelPath, setWhisperModelPath] = useState("");
  const [_autoPaste, setAutoPaste] = useState(true);

  // Hardware-aware model selection. Preset persists across sessions; variant
  // is resolved on demand by the manager so it always matches what's on disk.
  const [dictationModel, setDictationModel] = useState<RoleModelState>(() =>
    createRoleModelState("dictation"),
  );
  const [meetingModel, setMeetingModel] = useState<RoleModelState>(() =>
    createRoleModelState("minutes"),
  );
  const dictationModelPresetRef = useRef<WhisperModelPreset>("auto");
  const minutesModelPresetRef = useRef<WhisperModelPreset>("auto");
  const modelDownloadPromisesRef = useRef(
    new Map<WhisperModelVariant, Promise<string>>(),
  );
  const modelDownloadQueueRef = useRef<Promise<void>>(Promise.resolve());

  // AI editing (legacy — kept for settings migration)
  const [_aiEditing, setAiEditing] = useState(false);

  // AI Improvement toggle (user-controllable — controls Gemini AI cleanup)
  const [aiImprovementEnabled, setAiImprovementEnabled] = useState(true);
  const aiImprovementEnabledRef = useRef(true);
  const [contextAwareDictationEnabled, setContextAwareDictationEnabled] =
    useState(defaultContextAwareDictationEnabled);
  const contextAwareDictationEnabledRef = useRef(defaultContextAwareDictationEnabled);

  // Transcription language ("auto" = whisper auto-detects, "hi-en" = Hinglish)
  const [transcriptionLanguage, setTranscriptionLanguage] = useState("hi-en");

  // Persisted cleanup style (tone of AI-cleaned dictation). Applies on every
  // dictation regardless of trigger source.
  const [cleanupStyle, setCleanupStyle] =
    useState<CleanupStyle>(DEFAULT_CLEANUP_STYLE);
  // Prompt mode: persisted rewrite mode that turns dictated speech into a
  // ready-to-paste prompt. Toggleable from Settings and the recording pill; the
  // always-visible pill badge is the guardrail against forgetting it's on.
  // promptModeRef drives cleanup; the state value feeds the Settings toggle.
  const [promptMode, setPromptMode] = useState(false);

  // Diagnostics opt-in: when ON, perf.jsonl records the verbatim raw + AI-cleaned
  // transcript text (PII) alongside the timing/char-count signal. Default OFF —
  // the char/word counts and deltas are always logged; only the raw strings are
  // gated. Toggled from Settings → Data & privacy.
  const [perfLogTranscripts, setPerfLogTranscripts] = useState(false);

  // Selected microphone device id ("" = system default)
  const [selectedMicId, setSelectedMicId] = useState("");
  const selectedMicIdRef = useRef("");

  // Google Calendar OAuth tokens
  const [googleCalendarToken, setGoogleCalendarToken] = useState("");
  const [googleCalendarRefreshToken, setGoogleCalendarRefreshToken] = useState("");
  const [googleCalendarConnectedUserId, setGoogleCalendarConnectedUserId] = useState("");
  // Unix timestamp (ms) when the access token expires — 0 means unknown
  const [googleCalendarTokenExpiry, setGoogleCalendarTokenExpiry] = useState(0);
  // Legacy in-flight PKCE verifier. Kept so old browser callbacks fail cleanly
  // if a user returns from an already-open direct Google OAuth tab.
  const pkceCodeVerifierRef = useRef<string>("");
  const calendarOAuthInProgressRef = useRef(false);

  const [savedMeetings, setSavedMeetings] = useState<SavedMeetingRecord[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("home");

  // System audio capture (other participants' audio via ScreenCaptureKit)
  const [systemAudioSupported, setSystemAudioSupported] = useState(false);
  const [systemAudioEnabled, setSystemAudioEnabled] = useState(true);

  // Personal dictionary (local state; synced to Supabase when logged in)
  const [dictWords, setDictWords] = useState<string[]>([]);
  const [, setDictSyncing] = useState(false);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const scribbleMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const scribbleAudioChunksRef = useRef<Blob[]>([]);
  const scribbleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isScribbleRecordingRef = useRef(false);
  const isScribbleProcessingRef = useRef(false);
  const whisperLoadedRef = useRef(false);
  const isRecordingRef = useRef(false);
  const hotkeyStartInFlightRef = useRef(false);
  const hotkeyStopTailTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const streamRef = useRef<MediaStream | null>(null);
  const autoPasteRef = useRef(true);
  const targetAppRef = useRef<string>("");
  // Bundle identifier (macOS) of the frontmost app captured at hotkey press.
  // Preferred over the display name for re-activation so paste can't land in
  // the wrong window when two running apps share a localized name. Empty when
  // unavailable (non-macOS, or the OS didn't report a bundle id).
  const targetBundleIdRef = useRef<string>("");
  const dictationContextRef = useRef<DictationContextSnapshot | null>(null);
  // Active dictation session id (from the press event) + the raw start payload,
  // so a late `hotkey-context-enrich` can be matched to the right dictation and
  // merged onto its context. A stale enrich (session moved on) is dropped.
  const currentDictationSessionRef = useRef<number | null>(null);
  const lastHotkeyPayloadRef = useRef<HotkeyContextEventPayload | null>(null);
  const pendingStopRef = useRef(false);
  const warmStreamRef = useRef<MediaStream | null>(null);
  const voiceEngineWarmupRef = useRef(false);
  const meterCtxRef = useRef<AudioContext | null>(null);
  const meterSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const meterAnalyserRef = useRef<AnalyserNode | null>(null);
  const meterRafRef = useRef<number | null>(null);
  const aiEditingRef = useRef(false);
  const transcriptionLanguageRef = useRef<string>("hi-en");
  const cleanupStyleRef = useRef<CleanupStyle>(DEFAULT_CLEANUP_STYLE);
  const promptModeRef = useRef(false);
  const perfLogTranscriptsRef = useRef(false);
  const dictWordsRef = useRef<string[]>([]);
  const sessionRef = useRef<Session | null>(null);
  const authInitRef = useRef(false);
  const currentWhisperRoleRef = useRef<WhisperModelRole | null>(null);
  const currentWhisperKeyRef = useRef("");
  const canStartMeetingRecordingRef = useRef<() => boolean>(() => true);
  const ensureMinutesWhisperModelLoadedRef = useRef<
    (role: WhisperModelRole) => Promise<unknown>
  >(async () => {
    throw new Error("Whisper loader unavailable.");
  });
  const warmMinutesVoiceEngineRef = useRef<() => Promise<void>>(async () => {});
  const getMinutesAudioConstraintsRef = useRef<
    () => MediaTrackConstraints | boolean
  >(() => true);

  const minutesRecorder = useMinutesRecorder({
    canStartRecordingRef: canStartMeetingRecordingRef,
    ensureWhisperModelLoadedRef: ensureMinutesWhisperModelLoadedRef,
    warmVoiceEngineRef: warmMinutesVoiceEngineRef,
    getAudioConstraintsRef: getMinutesAudioConstraintsRef,
    warmStreamRef,
    dictWordsRef,
    transcriptionLanguageRef,
    systemAudioEnabled,
    systemAudioSupported,
  });
  const {
    isRecording: isMeetingRecording,
    isRecordingRef: isMeetingRecordingRef,
    isPipelineBusyRef: isMeetingPipelineBusyRef,
    isPreparing: isMeetingPreparing,
    isMuted: isMeetingMuted,
    toggleMute: toggleMeetingMute,
    isCapturingSystemAudio: isMeetingCapturingSystemAudio,
    recordingTime: meetingRecordingTime,
    transcript: meetingTranscript,
    transcriptSegments: meetingTranscriptSegments,
    startedAt: meetingStartedAt,
    transcriptionStatus: minutesTranscriptionStatus,
    segmentQueue: minutesSegmentQueue,
    segmentsCompleted: minutesSegmentsCompleted,
    segmentsTotal: minutesSegmentsTotal,
    failedSegments: minutesFailedSegments,
    systemAudioWarning,
    clearSystemAudioWarning,
    startRecording: startMeetingRecording,
    stopRecording: stopMeetingRecording,
    clearTranscript: clearMeetingTranscript,
  } = minutesRecorder;

  // True while ANY speech pipeline is active — hotkey/scribble dictation, its
  // post-record processing, or a meeting recording/draining/finalizing. Read by
  // the deferred-swap and clear-data gates (WS-C rules 3 & 4; invariant I3).
  isAnyPipelineBusyRef.current = () =>
    isRecordingRef.current ||
    isScribbleRecordingRef.current ||
    isScribbleProcessingRef.current ||
    isProcessingRef.current ||
    isMeetingPipelineBusyRef.current();

  // Auto-updater
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const updater = useUpdater();
  const [appVersion, setAppVersion] = useState<string | null>(null);

  useEffect(() => {
    isScribbleRecordingRef.current = isScribbleRecording;
  }, [isScribbleRecording]);

  // Fetch app version on mount
  useEffect(() => {
    getVersion()
      .then((v) => setAppVersion(v))
      .catch(() => setAppVersion("0.1.0"));
  }, []);

  // Check for updates on startup
  useEffect(() => {
    // Delay check to not block initial load
    const timer = setTimeout(() => {
      updater.checkForUpdates();
    }, 3000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time startup check; updater ref is stable
  }, []);

  const persistCalendarConnection = useCallback(async ({
    accessToken,
    expiry,
    refreshToken,
    userId,
  }: {
    accessToken: string;
    expiry: number;
    refreshToken?: string;
    userId?: string | null;
  }) => {
    setGoogleCalendarToken(accessToken);
    setGoogleCalendarTokenExpiry(expiry);

    const writes: Promise<void>[] = [
      saveSetting("googleCalendarToken", accessToken),
      saveSetting("googleCalendarTokenExpiry", expiry),
    ];

    if (refreshToken) {
      setGoogleCalendarRefreshToken(refreshToken);
      writes.push(saveSetting("googleCalendarRefreshToken", refreshToken));
    }

    if (userId) {
      setGoogleCalendarConnectedUserId(userId);
      writes.push(saveSetting("googleCalendarConnectedUserId", userId));
    }

    await Promise.all(writes);
  }, []);

  const clearCalendarConnection = useCallback(async () => {
    setGoogleCalendarToken("");
    setGoogleCalendarRefreshToken("");
    setGoogleCalendarConnectedUserId("");
    setGoogleCalendarTokenExpiry(0);
    await Promise.all([
      saveSetting("googleCalendarToken", ""),
      saveSetting("googleCalendarRefreshToken", ""),
      saveSetting("googleCalendarConnectedUserId", ""),
      saveSetting("googleCalendarTokenExpiry", 0),
    ]);
  }, []);

  const signOutLocally = useCallback(async () => {
    const [signOutResult, clearCalendarResult] = await Promise.allSettled([
      supabase.auth.signOut({ scope: "local" }),
      clearCalendarConnection(),
    ]);

    if (clearCalendarResult.status === "rejected") {
      console.warn(
        "[auth] Failed to clear calendar connection during sign-out:",
        clearCalendarResult.reason,
      );
    }

    if (signOutResult.status === "rejected") {
      console.error("[auth] Failed to clear local auth session:", signOutResult.reason);
      throw signOutResult.reason;
    }

    setSession(null);
    sessionRef.current = null;
    setUser(null);
  }, [clearCalendarConnection]);

  // Invoked when an authenticated call fails because the session is dead. Clears
  // the stale session (→ AuthScreen) and brings the main window forward so the
  // user can re-authenticate — the dictation flow runs with the main window
  // hidden, so without this the sign-in screen would never be seen. Returns
  // true when the session actually recovered (a transient blip), in which case
  // no re-auth prompt is needed.
  const promptReauth = useCallback(async (): Promise<boolean> => {
    const recovered = await revalidateSession({ force: true });
    if (recovered) return true;
    try {
      const win = getCurrentWindow();
      await win.show();
      await win.unminimize();
      await win.setFocus();
    } catch (e) {
      console.warn("[auth] could not focus main window for re-auth:", e);
    }
    return false;
  }, []);

  // ── Supabase auth listener ─────────────────────────────────────────────────

  useEffect(() => {
    // Guard against double-mount (React StrictMode / hot-reload).  The first
    // getSession() call may consume the refresh token; a concurrent second call
    // with the same (now-consumed) token triggers "Invalid Refresh Token:
    // Already Used" + lock-steal cascades.
    if (authInitRef.current) {
      setAuthLoading(false);
      return;
    }
    authInitRef.current = true;

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s?.user && googleCalendarConnectedUserId && googleCalendarConnectedUserId !== s.user.id) {
        void clearCalendarConnection();
      }
      setSession(s);
      sessionRef.current = s;
      setUser(s?.user ?? null);
      setAuthLoading(false);
      // Proactively validate a restored session. A hard restart (e.g.
      // auto-update relaunch) can leave a stale/rotated refresh token that
      // getSession() still hands back; revalidate clears it now → AuthScreen,
      // instead of letting the first dictation fail AI cleanup silently.
      if (s) void revalidateSession();
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      const previousUserId = sessionRef.current?.user?.id ?? null;
      const nextUserId = s?.user?.id ?? null;

      if (event === "SIGNED_OUT") {
        void clearCalendarConnection();
      } else if (previousUserId && nextUserId && previousUserId !== nextUserId) {
        void clearCalendarConnection();
      } else if (nextUserId && googleCalendarConnectedUserId && googleCalendarConnectedUserId !== nextUserId) {
        void clearCalendarConnection();
      }

      setSession(s);
      sessionRef.current = s;
      setUser(s?.user ?? null);
      if (s?.user) { syncDictionaryFromSupabase(s.user.id); loadMeetingsFromSupabase(); }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only: auth listener + one-time session check
  }, [clearCalendarConnection, googleCalendarConnectedUserId]);

  // Re-validate the session whenever the window regains focus / visibility. The
  // app is often left running with the main window hidden while the user
  // dictates via the pill; a token can expire (or its refresh token rot) in that
  // gap. Catching it on resume clears a dead session before the next AI call.
  useEffect(() => {
    const onResume = () => {
      void revalidateSession();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") onResume();
    };
    window.addEventListener("focus", onResume);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onResume);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // ── Deep link handler for OAuth callback ────────────────────────────────────

  useEffect(() => {
    // Handle deep link URL
    const handleDeepLink = async (url: string) => {
      // Parse the deep link URL
      if (url.startsWith("oscar://auth/callback")) {
        const urlObj = new URL(url);

        // Calendar PKCE flow: web callback forwarded the authorization code.
        // Exchange it for access + refresh tokens via the edge function.
        const calendarCode = urlObj.searchParams.get("calendar_code");
        if (calendarCode) {
          const verifier = pkceCodeVerifierRef.current;
          if (!verifier) {
            console.error("[deep-link] calendar_code received but no PKCE verifier in memory");
            return;
          }
          const redirectUri = `${import.meta.env.VITE_WEB_APP_URL || "https://oscar.samyarth.org"}/auth/desktop-callback`;
          try {
            const { data, error: fnErr } = await supabase.functions.invoke<{
              access_token: string; refresh_token?: string; expires_in: number;
            }>("exchange-calendar-token", {
              body: { code: calendarCode, code_verifier: verifier, redirect_uri: redirectUri },
            });
            if (fnErr || !data?.access_token) {
              console.error("[deep-link] Calendar token exchange failed:", fnErr);
              return;
            }
            // Consume verifier only after successful exchange
            pkceCodeVerifierRef.current = "";
            const expiry = Date.now() + (data.expires_in ?? 3600) * 1000;
            await persistCalendarConnection({
              accessToken: data.access_token,
              expiry,
              refreshToken: data.refresh_token,
              userId: sessionRef.current?.user?.id ?? null,
            });
            console.log("[deep-link] Google Calendar tokens stored (PKCE)");
          } catch (err) {
            console.error("[deep-link] Calendar token exchange error:", err);
          }
          return;
        }

        // Legacy: implicit-flow returned the access_token directly in the deep link
        const calendarToken = urlObj.searchParams.get("calendar_token");
        if (calendarToken) {
          const expiry = Date.now() + 3600 * 1000;
          void persistCalendarConnection({
            accessToken: calendarToken,
            expiry,
            userId: sessionRef.current?.user?.id ?? null,
          });
          console.log("[deep-link] Google Calendar token stored (legacy implicit)");
          return;
        }

        const error = urlObj.searchParams.get("error");
        const success = urlObj.searchParams.get("success");
        let accessToken = urlObj.searchParams.get("access_token");
        let refreshToken = urlObj.searchParams.get("refresh_token");
        let expiresIn = urlObj.searchParams.get("expires_in");
        // Single-use nonce minted by beginAuthFlow() and round-tripped through
        // the web callback as `&state=`. Used below to reject session injection.
        let stateParam = urlObj.searchParams.get("state");

        // Also check fragment (after #) for tokens
        if (urlObj.hash) {
          const fragmentParams = new URLSearchParams(urlObj.hash.substring(1));
          accessToken = accessToken || fragmentParams.get("access_token");
          refreshToken = refreshToken || fragmentParams.get("refresh_token");
          expiresIn = expiresIn || fragmentParams.get("expires_in");
          stateParam = stateParam || fragmentParams.get("state");
        }

        if (error) {
          console.error("[deep-link] Auth error:", error);
          calendarOAuthInProgressRef.current = false;
        }

        if (accessToken && refreshToken) {
          // Reject session injection. Accept the tokens ONLY when this callback
          // matches a sign-in THIS app started (the single-use nonce in the
          // `state` param matches the in-flight flow). Fails closed: a missing,
          // expired, or mismatched nonce — i.e. an unsolicited deep link fired
          // by any other local process or web page — is dropped here, so an
          // attacker cannot silently switch the app into their own account.
          if (!isAuthCallbackTrusted(stateParam)) {
            console.warn(
              "[deep-link] Rejected auth callback: untrusted or missing state nonce",
            );
            calendarOAuthInProgressRef.current = false;
            return;
          }
          // The nonce is single-use — consume it the moment we accept the
          // callback so the same deep link cannot be replayed.
          clearAuthFlow();

          // Set the session using the tokens from the web app
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            console.error("[deep-link] Failed to set session:", sessionError);
          } else if (data.session) {
            setSession(data.session);
            setUser(data.session.user);
            sessionRef.current = data.session;
          }

          // Only a calendar consent flow grants Calendar scope. Normal sign-in
          // also returns a Google provider_token, but that token cannot read
          // Calendar events and should not be treated as connected calendar state.
          const providerToken = urlObj.searchParams.get("provider_token");
          const providerRefreshToken = urlObj.searchParams.get("provider_refresh_token");
          if (providerToken && calendarOAuthInProgressRef.current) {
            const providerTokenExpiry = Date.now() + Number(expiresIn || "3600") * 1000;
            await persistCalendarConnection({
              accessToken: providerToken,
              expiry: providerTokenExpiry,
              refreshToken: providerRefreshToken || undefined,
              userId: data.session?.user.id ?? sessionRef.current?.user?.id ?? null,
            });
            calendarOAuthInProgressRef.current = false;
            console.log("[deep-link] Google Calendar token stored");
          }
        } else if (success === "true") {
          // No tokens in the deep link — the onAuthStateChange listener will
          // pick up any session change automatically.  Avoid calling
          // getSession() here because it races with the auth effect's
          // getSession() and can trigger "Invalid Refresh Token: Already Used"
          // when both try to consume the same refresh token concurrently.
          console.log("[deep-link] success=true but no tokens; relying on onAuthStateChange");
        }
      }
    };

    // Check for pending deep link on mount (for when app was closed and opened via deep link)
    const checkPendingDeepLink = async () => {
      try {
        const pendingUrl = await invoke<string | null>("get_pending_deep_link");
        if (pendingUrl) {
          handleDeepLink(pendingUrl);
        }
      } catch (err) {
        console.warn("[deep-link] Failed to get pending deep link:", err);
      }
    };

    // Listen for deep link events (when app is already running)
    const unlistenDeepLink = listen<string>("deep-link", (event) => {
      handleDeepLink(event.payload);
    });

    // Check for pending deep link
    checkPendingDeepLink();

    return () => {
      unlistenDeepLink.then((f) => f());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only: deep link listener registered once
  }, []);

  // ── Boot: load persisted settings ──────────────────────────────────────────

  useEffect(() => {
    (async () => {
      const [
        savedAiEditing,
        savedAutoPaste,
        savedDict,
        permsDone,
        setupDone,
        savedTranscripts,
        savedLanguage,
        savedMicId,
        savedAiImprovement,
        savedContextAwareDictation,
        savedDictationPreset,
        savedMinutesPreset,
        savedCalToken,
        savedCalRefreshToken,
        savedCalConnectedUserId,
        savedCalTokenExpiry,
        savedSystemAudioEnabled,
        savedMeetingsData,
        savedMinutesDataResetVersion,
        savedCleanupStyle,
        savedPromptMode,
        savedPerfLogTranscripts,
      ] = await Promise.all([
        loadSetting<boolean>("aiEditing", false),
        loadSetting<boolean>("autoPaste", true),
        loadSetting<string[]>("dictWords", []),
        loadSetting<boolean>("permissionsDone", false),
        loadSetting<boolean>("setupComplete", false),
        loadSetting<LocalTranscript[]>("localTranscripts", []),
        loadSetting<string>("transcriptionLanguage", "hi-en"),
        loadSetting<string>("selectedMicId", ""),
        loadSetting<boolean>("aiImprovementEnabled", true),
        loadSetting<boolean>(
          "contextAwareDictationEnabled",
          defaultContextAwareDictationEnabled,
        ),
        loadSetting<WhisperModelPreset>("dictationModelPreset", "auto"),
        loadSetting<WhisperModelPreset>("minutesModelPreset", "auto"),
        loadSetting<string>("googleCalendarToken", ""),
        loadSetting<string>("googleCalendarRefreshToken", ""),
        loadSetting<string>("googleCalendarConnectedUserId", ""),
        loadSetting<number>("googleCalendarTokenExpiry", 0),
        loadSetting<boolean>("systemAudioEnabled", true),
        loadSetting<SavedMeetingRecord[]>("savedMeetings", []),
        loadSetting<string>("minutesDataResetVersion", ""),
        loadSetting<CleanupStyle>("cleanupStyle", DEFAULT_CLEANUP_STYLE),
        loadSetting<boolean>("promptMode", false),
        loadSetting<boolean>("perfLogTranscripts", false),
      ]);

      const micPermission = await getMicrophonePermissionState().catch(
        () => "unknown" as MicrophonePermissionState,
      );
      const accessibilityGranted = await invoke<boolean>(
        "check_accessibility_permission",
      ).catch(() => true);

      let nextPermissionsShown = permsDone;
      if (permsDone && micPermission === "denied") {
        nextPermissionsShown = false;
      }
      if (permsDone && isMacOS() && !accessibilityGranted) {
        nextPermissionsShown = false;
      }

      try {
        await invoke<boolean>("ensure_recording_hotkey_registered");
        setHotkeyWarning("");
      } catch (err) {
        const message = String(err).replace(/^Error:\s*/i, "");
        setHotkeyWarning(message);
        if (permsDone && isMacOS() && !accessibilityGranted) {
          nextPermissionsShown = false;
        }
      }

      if (isMacOS()) {
        const conflict = await invoke<boolean>("check_dictation_ctrl_conflict").catch(() => false);
        setDictationConflict(conflict);
      }

      setPermissionsShown(nextPermissionsShown);
      if (!setupDone) {
        setSetupComplete(false);
      }
      setAiEditing(savedAiEditing);
      aiEditingRef.current = savedAiEditing;
      setAutoPaste(savedAutoPaste);
      autoPasteRef.current = savedAutoPaste;
      setDictWords(savedDict);
      dictWordsRef.current = savedDict;
      setLocalTranscripts(savedTranscripts);
      setTranscriptionLanguage(savedLanguage);
      transcriptionLanguageRef.current = savedLanguage;
      setSelectedMicId(savedMicId);
      selectedMicIdRef.current = savedMicId;
      setAiImprovementEnabled(savedAiImprovement);
      aiImprovementEnabledRef.current = savedAiImprovement;
      setContextAwareDictationEnabled(savedContextAwareDictation);
      contextAwareDictationEnabledRef.current = savedContextAwareDictation;
      setDictationModel((prev) => ({ ...prev, preset: savedDictationPreset }));
      dictationModelPresetRef.current = savedDictationPreset;
      setMeetingModel((prev) => ({ ...prev, preset: savedMinutesPreset }));
      minutesModelPresetRef.current = savedMinutesPreset;
      setSystemAudioEnabled(savedSystemAudioEnabled);
      setCleanupStyle(savedCleanupStyle);
      cleanupStyleRef.current = savedCleanupStyle;
      setPromptMode(savedPromptMode);
      promptModeRef.current = savedPromptMode;
      setPerfLogTranscripts(savedPerfLogTranscripts);
      perfLogTranscriptsRef.current = savedPerfLogTranscripts;
      const hasLegacyCalendarConnection =
        Boolean(savedCalToken || savedCalRefreshToken) && !savedCalConnectedUserId;
      if (hasLegacyCalendarConnection) {
        void clearCalendarConnection();
      } else if (savedCalToken) {
        // Only restore the access token if it hasn't expired (or expiry is unknown).
        // If it IS expired but we have a refresh token, the first calendar API call
        // will trigger an auto-refresh; we still load it so the UI shows the
        // calendar section rather than the "connect calendar" button.
        setGoogleCalendarToken(savedCalToken);
      }
      if (!hasLegacyCalendarConnection && savedCalRefreshToken) setGoogleCalendarRefreshToken(savedCalRefreshToken);
      if (!hasLegacyCalendarConnection && savedCalConnectedUserId) {
        setGoogleCalendarConnectedUserId(savedCalConnectedUserId);
      }
      if (!hasLegacyCalendarConnection && savedCalTokenExpiry) setGoogleCalendarTokenExpiry(savedCalTokenExpiry);

      if (savedMinutesDataResetVersion !== MINUTES_DATA_RESET_VERSION) {
        setSavedMeetings([]);
        await Promise.all([
          saveSetting("savedMeetings", []),
          saveSetting("meetingTemplates", []),
          saveSetting("minutesDataResetVersion", MINUTES_DATA_RESET_VERSION),
        ]);
      } else if (savedMeetingsData && savedMeetingsData.length > 0) {
        setSavedMeetings(savedMeetingsData);
      }

      // Check system audio capture support (macOS 13+ only)
      invoke<boolean>("is_system_audio_supported")
        .then((supported) => setSystemAudioSupported(supported))
        .catch(() => setSystemAudioSupported(false));

      // Setup was completed on a previous launch. Render the app immediately
      // and load the speech model in the BACKGROUND — never block the render on
      // it. Otherwise a first-launch model download (e.g. the default language
      // now maps to a model that isn't on disk yet) leaves `setupComplete` at
      // `null` and the whole UI blank for the entire several-hundred-MB
      // download. initWhisper surfaces its own load state via `status` and
      // auto-retries the download, so the app stays usable (settings, scribbles,
      // meetings) throughout and dictation lights up once the model is ready.
      if (setupDone) {
        setSetupComplete(true);
        void initWhisper();
      }
    })();

    const SELF_APP_NAMES = ["oscar"];
    const unlistenStart = listen<HotkeyContextEventPayload>(
      "hotkey-recording-start",
      (ev) => {
        const appName = ev.payload?.appName?.trim() || "";
        const isSelfApp = SELF_APP_NAMES.includes(appName.toLowerCase());

        // Don't double-fire while another recording flow is in-flight.
        // NOTE: previously this also bailed on `isSelfApp`, which silently
        // dropped the hotkey whenever macOS reported Oscar as frontmost —
        // e.g. when the always-visible pill window or the main window had
        // recent focus. That made Ctrl+Space appear dead. We now always
        // start the recording; if the frontmost truly is Oscar, the paste
        // path falls back to clipboard-only (target stays empty) instead of
        // pasting into Oscar itself.
        if (
          isScribbleRecordingRef.current ||
          isScribbleProcessingRef.current ||
          isMeetingRecordingRef.current
        ) {
          pendingStopRef.current = false;
          return;
        }

        targetAppRef.current = isSelfApp
          ? ""
          : ev.payload?.targetAppName?.trim() || "";
        targetBundleIdRef.current = isSelfApp
          ? ""
          : ev.payload?.appId?.trim() || "";
        dictationContextRef.current = isSelfApp
          ? null
          : buildDictationContextSnapshot(ev.payload);
        // Record the session so a later context-enrich event can be matched (or
        // dropped if a newer press has superseded it). Keep the raw payload to
        // merge the deferred AppleScript fields onto. Self-app gets no base, so
        // its enrich is ignored.
        currentDictationSessionRef.current = ev.payload?.sessionId ?? null;
        lastHotkeyPayloadRef.current = isSelfApp ? null : ev.payload ?? null;
        pendingStopRef.current = false;

        // Push the captured context to the always-on pill so its label can read
        // "Optimized for X" for a recognized app (high confidence) or the raw OS
        // app name for an unrecognized one (low confidence, no "optimized"
        // claim). Gated on the same context-aware setting + platform that drive
        // routing/persistence; cleared again when the flow ends (processAudio
        // finally) so a stale label can't linger on the next handle hover.
        const pillContextSnapshot = dictationContextRef.current;
        const pillContextEnabled =
          contextAwareDictationEnabledRef.current &&
          isContextAwarePlatform(getDesktopPlatform());
        if (pillContextSnapshot && pillContextEnabled) {
          const pillRouting = routeDictationContext(pillContextSnapshot);
          const known = pillRouting.confidence !== "low";
          emit("pill-context-app", {
            name: known ? pillRouting.appKey : pillContextSnapshot.appName,
            confidence: known ? "high" : "low",
          }).catch(() => {});
        } else {
          emit("pill-context-app", null).catch(() => {});
        }

        if (whisperLoadedRef.current && !isRecordingRef.current) {
          hotkeyStartInFlightRef.current = true;
          void startHotkeyRecording().finally(() => {
            hotkeyStartInFlightRef.current = false;
          });
        }
      },
    );

    // Late context enrichment: the AppleScript-derived window title + browser
    // site, captured off the press path so recording arms instantly. Apply it
    // only if the session still matches the active dictation — a result for a
    // dictation the user already moved on from must not clobber the new one.
    const unlistenEnrich = listen<HotkeyContextEnrichPayload>(
      "hotkey-context-enrich",
      (ev) => {
        const sid = ev.payload?.sessionId;
        if (sid == null || sid !== currentDictationSessionRef.current) return;
        const base = lastHotkeyPayloadRef.current;
        if (!base) return; // self-app or no base — nothing to enrich.

        const merged: HotkeyContextEventPayload = {
          ...base,
          windowTitle: ev.payload?.windowTitle ?? base.windowTitle ?? null,
          siteHost: ev.payload?.siteHost ?? base.siteHost ?? null,
          siteTitle: ev.payload?.siteTitle ?? base.siteTitle ?? null,
        };
        lastHotkeyPayloadRef.current = merged;
        const snap = buildDictationContextSnapshot(merged);
        if (!snap) return;
        dictationContextRef.current = snap;

        // Refresh the pill label only while still recording — the site/host may
        // now upgrade confidence (e.g. a recognized browser tab). Skip if the
        // flow already ended so a late result can't flash a label on the idle
        // handle (processAudio clears it on finish).
        const pillContextEnabled =
          contextAwareDictationEnabledRef.current &&
          isContextAwarePlatform(getDesktopPlatform());
        if (pillContextEnabled && isRecordingRef.current) {
          const pillRouting = routeDictationContext(snap);
          const known = pillRouting.confidence !== "low";
          emit("pill-context-app", {
            name: known ? pillRouting.appKey : snap.appName,
            confidence: known ? "high" : "low",
          }).catch(() => {});
        }
      },
    );

    const unlistenStop = listen("hotkey-recording-stop", () => {
      // ALWAYS set pending stop — this is the safety net for the race condition
      // where STOP arrives before getUserMedia resolves in startHotkeyRecording
      pendingStopRef.current = hotkeyStartInFlightRef.current;
      // Also try the normal stop path
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state === "recording"
      ) {
        stopHotkeyRecording();
      }
    });
    const unlistenErr = listen<string>("hotkey-permission-error", (ev) => {
      setHotkeyWarning(ev.payload);
    });
    const unlistenReg = listen("hotkey-registered", () => setHotkeyWarning(""));

    // ── Edge-handle pill events ───────────────────────────────────────────
    // Settings updates from the pill's popover — persist + sync state.
    const unlistenPillSettings = listen<{
      language?: string;
      autoPaste?: boolean;
      aiImprovement?: boolean;
      cleanupStyle?: CleanupStyle;
      promptMode?: boolean;
    }>("pill-settings-update", (ev) => {
      const p = ev.payload || {};
      if (p.language !== undefined) {
        setTranscriptionLanguage(p.language);
        transcriptionLanguageRef.current = p.language;
        void saveSetting("transcriptionLanguage", p.language);
      }
      if (p.autoPaste !== undefined) {
        setAutoPaste(p.autoPaste);
        autoPasteRef.current = p.autoPaste;
        void saveSetting("autoPaste", p.autoPaste);
      }
      if (p.aiImprovement !== undefined) {
        setAiImprovementEnabled(p.aiImprovement);
        aiImprovementEnabledRef.current = p.aiImprovement;
        void saveSetting("aiImprovementEnabled", p.aiImprovement);
      }
      if (p.cleanupStyle !== undefined) {
        setCleanupStyle(p.cleanupStyle);
        cleanupStyleRef.current = p.cleanupStyle;
        void saveSetting("cleanupStyle", p.cleanupStyle);
      }
      if (p.promptMode !== undefined) {
        setPromptMode(p.promptMode);
        promptModeRef.current = p.promptMode;
        void saveSetting("promptMode", p.promptMode);
      }
    });

    // When the pill window has wired its listeners, push current settings.
    const unlistenPillReady = listen("pill-ready", () => {
      invoke("pill_push_settings", {
        language: transcriptionLanguageRef.current,
        autoPaste: autoPasteRef.current,
        aiImprovement: aiImprovementEnabledRef.current,
        cleanupStyle: cleanupStyleRef.current,
        promptMode: promptModeRef.current,
      }).catch(console.warn);
    });

    // ── In-app Ctrl+Space fallback ───────────────────────────────────────
    // The Tauri global-shortcut plugin's macOS backend (NSEvent global
    // monitor) does NOT fire when Oscar itself is the foreground app — the
    // key event is delivered to the focused webview first and the global
    // monitor only sees events targeted at other apps. So when Oscar's
    // window is focused, Ctrl+Space appears dead. Mirror the hotkey flow
    // via a webview-level keydown so the dictation pill still expands.
    let inAppHotkeyDown = false;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || !e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (e.repeat || inAppHotkeyDown) {
        e.preventDefault();
        return;
      }
      inAppHotkeyDown = true;
      e.preventDefault();
      invoke("pill_request_record_start").catch(console.warn);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (!inAppHotkeyDown) return;
      if (e.code === "Space" || e.code === "ControlLeft" || e.code === "ControlRight") {
        inAppHotkeyDown = false;
        invoke("pill_request_record_stop").catch(console.warn);
      }
    };
    const onWindowBlur = () => {
      // Safety net — if user alt-tabs while holding the keys, force a stop
      // so the recording doesn't get stuck on.
      if (inAppHotkeyDown) {
        inAppHotkeyDown = false;
        invoke("pill_request_record_stop").catch(console.warn);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onWindowBlur);

    return () => {
      const hadPendingTailStop = hotkeyStopTailTimerRef.current !== null;
      if (hotkeyStopTailTimerRef.current) {
        clearTimeout(hotkeyStopTailTimerRef.current);
        hotkeyStopTailTimerRef.current = null;
      }
      if (
        hadPendingTailStop &&
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state === "recording"
      ) {
        mediaRecorderRef.current.stop();
      }
      unlistenStart.then((f) => f());
      unlistenEnrich.then((f) => f());
      unlistenStop.then((f) => f());
      unlistenErr.then((f) => f());
      unlistenReg.then((f) => f());
      unlistenPillSettings.then((f) => f());
      unlistenPillReady.then((f) => f());
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onWindowBlur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only: loads settings, registers hotkey listeners; uses refs for mutable state
  }, []);

  // ── Supabase dictionary sync ───────────────────────────────────────────────

  const loadMeetingsFromSupabase = useCallback(async () => {
    const { data, error } = await meetingsService.getMeetings();
    if (error) { console.warn("[minutes] Supabase load failed:", error); return; }
    if (data && data.length > 0) setSavedMeetings(data);
  }, []);

  const syncDictionaryFromSupabase = useCallback(async (userId: string) => {
    setDictSyncing(true);
    try {
      const { data, error } = await supabase
        .from("user_vocabulary")
        .select("term")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const words = (data ?? []).map((r: { term: string }) => r.term);
      dictWordsRef.current = words;
      setDictWords(words);
      await saveSetting("dictWords", words);
    } catch (e) {
      console.warn("[dict] sync failed:", e);
    } finally {
      setDictSyncing(false);
    }
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const setWhisperLoadedAndRef = (val: boolean) => {
    whisperLoadedRef.current = val;
    setWhisperLoaded(val);
  };

  const getAudioConstraints = (
    micId = selectedMicIdRef.current,
  ): MediaTrackConstraints | boolean => (
    micId ? { deviceId: { ideal: micId } } : true
  );

  // Pre-warm the microphone so hotkey recording starts instantly (no getUserMedia delay).
  // This is critical for fullscreen apps where macOS Space-switching delays event delivery.
  const warmMicrophone = async (micId = selectedMicIdRef.current) => {
    if (
      warmStreamRef.current &&
      warmStreamRef.current
        .getAudioTracks()
        .some((track) => track.readyState === "live")
    ) {
      return;
    }

    warmStreamRef.current = null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: getAudioConstraints(micId),
      });
      warmStreamRef.current = stream;
    } catch (e) {
      console.warn("[mic] failed to pre-warm microphone:", e);
    }
  };

  const warmBrowserAudioPath = async () => {
    try {
      const AudioContextCtor = window.AudioContext;
      if (AudioContextCtor) {
        const audioContext = new AudioContextCtor({ sampleRate: 16000 });
        await audioContext.close();
      }
    } catch (e) {
      console.warn("[audio] browser audio warmup failed:", e);
    }
  };

  const warmMediaRecorderPath = async () => {
    const stream = warmStreamRef.current;
    if (
      !stream ||
      !stream.getAudioTracks().some((track) => track.readyState === "live") ||
      typeof MediaRecorder === "undefined"
    ) {
      return;
    }

    try {
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = () => {};
      recorder.start(50);
      await new Promise((resolve) => setTimeout(resolve, 120));
      if (recorder.state === "recording") recorder.stop();
    } catch (e) {
      console.warn("[audio] MediaRecorder warmup failed:", e);
    }
  };

  const warmVoiceEngine = async (micId = selectedMicIdRef.current) => {
    if (voiceEngineWarmupRef.current) return;
    voiceEngineWarmupRef.current = true;

    await warmMicrophone(micId);
    await warmBrowserAudioPath();
    await warmMediaRecorderPath();

    try {
      await invoke("warm_whisper_runtime");
    } catch (e) {
      console.warn("[whisper] runtime warmup failed:", e);
    }
  };

  const updateRoleModel = useCallback(
    (role: WhisperModelRole, patch: Partial<RoleModelState>) => {
      const update = (prev: RoleModelState): RoleModelState => ({
        ...prev,
        ...patch,
      });
      if (role === "dictation") {
        setDictationModel(update);
      } else {
        setMeetingModel(update);
      }
    },
    [],
  );

  const syncDownloadProgress = useCallback(
    (variant: WhisperModelVariant, progress: number) => {
      const update = (prev: RoleModelState): RoleModelState =>
        prev.recommendation?.spec.variant === variant
          ? { ...prev, progress }
          : prev;
      setDictationModel(update);
      setMeetingModel(update);
    },
    [],
  );

  const downloadRecommendedModel = useCallback(
    async (spec: ModelSpec): Promise<string> => {
      const existing = modelDownloadPromisesRef.current.get(spec.variant);
      if (existing) return existing;

      const queuedDownload = modelDownloadQueueRef.current.then(async () => {
        const unlistenProgress = await listen<DownloadProgress>(
          "download-progress",
          (event) => {
            // Route by the event's own variant tag rather than matching the
            // current recommendation (WS-C rule 7) — correct even if a stale
            // recommendation lingers during a preset/language flip.
            syncDownloadProgress(
              event.payload.variant,
              event.payload.percentage,
            );
          },
        );
        const unlistenRetry = await listen<DownloadRetry>(
          "download-retry",
          (event) => {
            const { attempt, max_attempts, reason } = event.payload;
            console.warn(
              `[whisper] download retry ${attempt}/${max_attempts}: ${reason}`,
            );
          },
        );

        try {
          const path = await downloadModel(spec, spec.sha256);
          syncDownloadProgress(spec.variant, 100);
          return path;
        } finally {
          unlistenProgress();
          unlistenRetry();
        }
      });

      const trackedDownload = queuedDownload.finally(() => {
        modelDownloadPromisesRef.current.delete(spec.variant);
      });

      modelDownloadQueueRef.current = trackedDownload
        .then(() => undefined)
        .catch(() => undefined);

      modelDownloadPromisesRef.current.set(spec.variant, trackedDownload);
      return trackedDownload;
    },
    [syncDownloadProgress],
  );

  const prepareWhisperModel = useCallback(
    async (
      role: WhisperModelRole,
      options: { load?: boolean; autoDownload?: boolean } = {},
    ) => {
      const preset =
        role === "dictation"
          ? dictationModelPresetRef.current
          : minutesModelPresetRef.current;

      // Passive inspect (autoDownload:false) must not stomp a live download's
      // `downloading`/progress state — closes the startup race where the
      // inspect effect raced initWhisper's in-flight download (WS-D).
      if (
        options.autoDownload === false &&
        downloadingRolesRef.current.has(role)
      ) {
        return { role, path: null, variant: null };
      }

      updateRoleModel(role, {
        preset,
        downloadState: "checking",
        progress: 0,
        error: null,
      });

      const { recommendation, resolved } = await resolveModelForRole(
        role,
        preset,
        transcriptionLanguageRef.current,
      );

      // Track the *currently authoritative* variant through every code path
      // below so the caller can read it without waiting for React to re-render
      // after `updateRoleModel`. Fixes the `model="unknown"` attribution bug
      // in stream-dictation perf logs, where `dictationModel.activeVariant`
      // was read from a stale closure mid-handler.
      let resolvedVariant: WhisperModelVariant | null = resolved?.variant ?? null;

      updateRoleModel(role, {
        recommendation,
        activeVariant: resolvedVariant,
        resolvedPath: resolved?.path ?? null,
        fallbackUsed: resolved?.fallbackUsed ?? false,
        interim: resolved?.interim ?? false,
        crossFamilyInterim: resolved?.crossFamilyInterim ?? false,
        downloadState: resolved ? "ready" : "idle",
      });

      let path = resolved?.path ?? null;
      // Download only when nothing usable is on disk, or when an installed
      // fallback isn't an acceptable substitute. A *sufficient* fallback (the
      // shared per-device model) is reused without an upgrade download — except
      // under the "best" preset, where the larger model is an explicit opt-in.
      const shouldDownloadRecommended =
        options.autoDownload !== false &&
        (!path ||
          (Boolean(resolved?.fallbackUsed) &&
            (preset === "best" || !resolved?.sufficient)));

      if (shouldDownloadRecommended) {
        updateRoleModel(role, {
          downloadState: "downloading",
          progress: 0,
          error: null,
        });
        downloadingRolesRef.current.add(role);

        try {
          path = await downloadRecommendedModel(recommendation.spec);
          resolvedVariant = recommendation.spec.variant;
          updateRoleModel(role, {
            activeVariant: resolvedVariant,
            resolvedPath: path,
            fallbackUsed: false,
            interim: false,
            crossFamilyInterim: false,
            downloadState: "ready",
            progress: 100,
          });
        } catch (err) {
          const message = `Model download failed: ${err}`;
          console.warn(`[whisper] ${role} model download failed:`, err);
          updateRoleModel(role, {
            downloadState: "error",
            error: message,
            progress: 0,
          });

          // Keep serving if we can. First a same-family installed model, then —
          // only for a hi-en target, only as an offline degrade — a general
          // model (I10 one-way valve). Either way the role stays in `error` so
          // the `online` retry re-attempts the real download and upgrades.
          const retry = await resolveModelForRole(
            role,
            preset,
            transcriptionLanguageRef.current,
          );
          if (retry.resolved) {
            path = retry.resolved.path;
            resolvedVariant = retry.resolved.variant;
            updateRoleModel(role, {
              recommendation: retry.recommendation,
              activeVariant: resolvedVariant,
              resolvedPath: retry.resolved.path,
              fallbackUsed: retry.resolved.fallbackUsed,
              interim: true,
              crossFamilyInterim: false,
              downloadState: "ready",
              error: message,
            });
          } else {
            const cross = await pickCrossFamilyInterim(
              role,
              recommendation.spec.variant,
            );
            if (cross) {
              path = cross.path;
              resolvedVariant = cross.variant;
              updateRoleModel(role, {
                activeVariant: resolvedVariant,
                resolvedPath: cross.path,
                fallbackUsed: true,
                interim: true,
                crossFamilyInterim: true,
                downloadState: "ready",
                error: message,
              });
            }
          }
        } finally {
          downloadingRolesRef.current.delete(role);
        }
      }

      if (!path) {
        if (!options.load && options.autoDownload === false) {
          return { role, path: null, variant: null };
        }
        throw new Error(
          role === "minutes"
            ? "Meeting model not found."
            : "Dictation model not found.",
        );
      }

      if (!options.load) {
        return { role, path, variant: resolvedVariant };
      }

      // Rust loads by variant and resolves the path itself (invariant I1).
      // `path` is non-null here (guarded above), so resolvedVariant is too.
      if (!resolvedVariant) {
        throw new Error(
          role === "minutes"
            ? "Meeting model not found."
            : "Dictation model not found.",
        );
      }

      // Deferred swap (WS-C rule 3; I3; matrix row 7): if loading would CHANGE
      // the resident model while a pipeline is busy, queue it and apply once
      // idle so we never tear the context out from under an in-flight
      // transcription. The download already happened — only the in-RAM swap
      // waits. A re-load of the same resident model never defers.
      const wouldSwap = currentWhisperKeyRef.current !== path;
      if (wouldSwap && isAnyPipelineBusyRef.current()) {
        pendingLoadRef.current[role] = resolvedVariant;
        console.info(
          `[whisper] deferring ${role} swap to ${resolvedVariant} until idle`,
        );
        return { role, path, variant: resolvedVariant };
      }
      delete pendingLoadRef.current[role];

      await invoke("ensure_model_loaded", { role, variant: resolvedVariant });
      const pathChanged = currentWhisperKeyRef.current !== path;
      if (pathChanged) {
        currentWhisperKeyRef.current = path;
        voiceEngineWarmupRef.current = false;
      }
      currentWhisperRoleRef.current = role;

      setWhisperLoadedAndRef(true);
      setWhisperModelPath(path);
      return { role, path, variant: resolvedVariant };
    },
    [downloadRecommendedModel, updateRoleModel],
  );

  const ensureWhisperModelLoaded = useCallback(
    async (preferredRole: WhisperModelRole) =>
      prepareWhisperModel(preferredRole, { load: true, autoDownload: true }),
    [prepareWhisperModel],
  );

  // Transcribe declaring the variant we expect to be resident. On a typed
  // `model-mismatch` (a load race), re-ensure that exact variant and retry once
  // — never a silent wrong-model transcript (invariant I2; matrix row 19).
  const transcribeWithVariant = useCallback(
    async (
      role: WhisperModelRole,
      expectedVariant: WhisperModelVariant,
      payload: {
        audioData: number[];
        initialPrompt?: string;
        language?: string;
      },
    ): Promise<Transcription> => {
      const args = { ...payload, expectedVariant };
      try {
        return await invoke<Transcription>("transcribe_audio", args);
      } catch (e) {
        if (String(e).includes("model-mismatch")) {
          console.warn(
            "[whisper] model-mismatch — re-ensuring",
            expectedVariant,
          );
          await invoke("ensure_model_loaded", { role, variant: expectedVariant });
          return invoke<Transcription>("transcribe_audio", args);
        }
        throw e;
      }
    },
    [],
  );

  canStartMeetingRecordingRef.current = () =>
    !isRecordingRef.current &&
    !isScribbleRecordingRef.current &&
    !isScribbleProcessingRef.current &&
    // Block while a dictation transcription is still processing (WS-C rule 4).
    !isProcessingRef.current;
  ensureMinutesWhisperModelLoadedRef.current = ensureWhisperModelLoaded;
  warmMinutesVoiceEngineRef.current = () => warmVoiceEngine();
  getMinutesAudioConstraintsRef.current = () => getAudioConstraints();

  const handleModelPresetChange = useCallback(
    async (role: WhisperModelRole, preset: WhisperModelPreset) => {
      if (role === "dictation") {
        dictationModelPresetRef.current = preset;
        setDictationModel((prev) => ({ ...prev, preset }));
        await saveSetting("dictationModelPreset", preset);
      } else {
        minutesModelPresetRef.current = preset;
        setMeetingModel((prev) => ({ ...prev, preset }));
        await saveSetting("minutesModelPreset", preset);
      }

      void prepareWhisperModel(role, {
        load: currentWhisperRoleRef.current === role,
        autoDownload: true,
      }).catch((err) => {
        console.warn(`[whisper] failed to prepare ${role} model:`, err);
      });
    },
    [prepareWhisperModel],
  );

  const initWhisper = async () => {
    try {
      setEngineBootPhase("loading");
      // Shown on the home screen while the model resolves — this can include a
      // one-time download of a few hundred MB (e.g. the Hinglish model on first
      // use), so give feedback instead of a silent wait. The per-model download
      // progress also surfaces via `dictationModel.downloadState`.
      setStatus("Preparing speech model…");
      await ensureWhisperModelLoaded("dictation");
      setStatus("Preparing voice engine...");
      setEngineBootPhase("warming");
      void warmVoiceEngine().finally(() => {
        setStatus("Ready! Hold Ctrl+Space anywhere to record.");
        setEngineBootPhase("ready");
      });
      return true;
    } catch {
      setWhisperLoadedAndRef(false);
      setEngineBootPhase("error");
      setStatus(
        "Speech model isn't downloaded yet — check Settings → Speech models or reconnect to the internet.",
      );
      return false;
    }
  };

  useEffect(() => {
    if (!setupComplete) return;

    void prepareWhisperModel("dictation", { autoDownload: false })
      .catch((err) => console.warn("[whisper] failed to inspect dictation model:", err));
    void prepareWhisperModel("minutes", { autoDownload: false })
      .catch((err) => console.warn("[whisper] failed to inspect meeting model:", err));
  }, [prepareWhisperModel, setupComplete]);

  // Auto-retry model downloads when connectivity returns (WS-C rule 5; matrix
  // rows 1, 10). Debounced so a link that flaps `online` repeatedly can't storm
  // the network: re-resolving a ready role is a cheap no-op, an errored one
  // retries its download, and a hi-en cross-family interim upgrades to Apex.
  const onlineRetryAtRef = useRef(0);
  useEffect(() => {
    const onOnline = () => {
      const now = Date.now();
      if (now - onlineRetryAtRef.current < 10_000) return;
      onlineRetryAtRef.current = now;
      void prepareWhisperModel("dictation", {
        load: currentWhisperRoleRef.current === "dictation",
        autoDownload: true,
      }).catch(() => {});
      void prepareWhisperModel("minutes", {
        load: currentWhisperRoleRef.current === "minutes",
        autoDownload: true,
      }).catch(() => {});
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [prepareWhisperModel]);

  // Apply any deferred model swap once every pipeline goes idle (WS-C rule 3;
  // matrix row 7). Runs whenever a pipeline transitions; no-ops while busy.
  useEffect(() => {
    if (isAnyPipelineBusyRef.current()) return;
    const pending = pendingLoadRef.current;
    (["dictation", "minutes"] as WhisperModelRole[]).forEach((role) => {
      if (!pending[role]) return;
      delete pending[role];
      void prepareWhisperModel(role, {
        load: true,
        autoDownload: false,
      }).catch((err) =>
        console.warn(`[whisper] deferred ${role} swap failed:`, err),
      );
    });
  }, [
    prepareWhisperModel,
    isMeetingRecording,
    _isProcessing,
    isScribbleRecording,
    isScribbleProcessing,
    minutesTranscriptionStatus,
    minutesSegmentQueue,
  ]);

  // Mirror dictation serveability for the synchronous hotkey gate.
  useEffect(() => {
    dictationServeableRef.current = dictationModel.activeVariant != null;
  }, [dictationModel.activeVariant]);

  // Forward dictation-role download progress to the pill so its downloading
  // phase shows a live % (WS-D). Minutes progress surfaces in the Meetings tab.
  useEffect(() => {
    if (dictationModel.downloadState === "downloading") {
      void emit("pill-download-progress", {
        percentage: dictationModel.progress,
      }).catch(() => {});
    }
  }, [dictationModel.downloadState, dictationModel.progress]);

  // ── Recording-pill waveform meter ──────────────────────────────────────────
  // Sample the live mic stream and push 15 normalized band levels to the pill
  // window so its waveform bars react to the user's voice on top of their
  // baseline CSS motion.

  const PILL_WAVE_BARS = 15;

  const startAudioMeter = (stream: MediaStream) => {
    stopAudioMeter();
    try {
      const AudioCtor = window.AudioContext;
      if (!AudioCtor) return;
      const ctx = new AudioCtor();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
      meterCtxRef.current = ctx;
      meterSourceRef.current = source;
      meterAnalyserRef.current = analyser;

      const bufLen = analyser.frequencyBinCount;
      const data = new Uint8Array(bufLen);
      const usable = Math.min(60, bufLen);
      const binsPerBar = Math.max(1, Math.floor(usable / PILL_WAVE_BARS));

      const tick = () => {
        const a = meterAnalyserRef.current;
        if (!a) return;
        a.getByteFrequencyData(data);
        const levels = new Array<number>(PILL_WAVE_BARS);
        for (let i = 0; i < PILL_WAVE_BARS; i++) {
          let sum = 0;
          const startBin = i * binsPerBar;
          const endBin = Math.min(startBin + binsPerBar, usable);
          for (let j = startBin; j < endBin; j++) sum += data[j];
          const avg = sum / Math.max(1, endBin - startBin) / 255;
          levels[i] = Math.min(1, Math.pow(avg, 0.7));
        }
        emit("pill-audio-level", levels).catch(() => {});
        meterRafRef.current = requestAnimationFrame(tick);
      };
      meterRafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      console.warn("[meter] start failed", e);
    }
  };

  const stopAudioMeter = () => {
    if (meterRafRef.current !== null) {
      cancelAnimationFrame(meterRafRef.current);
      meterRafRef.current = null;
    }
    try { meterSourceRef.current?.disconnect(); } catch {}
    try { meterAnalyserRef.current?.disconnect(); } catch {}
    try { meterCtxRef.current?.close(); } catch {}
    meterSourceRef.current = null;
    meterAnalyserRef.current = null;
    meterCtxRef.current = null;
    emit("pill-audio-level", new Array(PILL_WAVE_BARS).fill(0)).catch(() => {});
  };

  // ── Hotkey recording ───────────────────────────────────────────────────────

  const startHotkeyRecording = async () => {
    if (isScribbleRecordingRef.current || isScribbleProcessingRef.current) {
      return;
    }
    // Block while a meeting is recording OR still finalizing — stopRecording
    // flips isMeetingRecordingRef false while segments are still draining, so
    // gate on the full pipeline and give feedback instead of silently ignoring
    // the hotkey (WS-C rule 4; matrix row 8).
    if (isMeetingPipelineBusyRef.current()) {
      setStatus("Finishing meeting notes…");
      return;
    }

    // No usable dictation model yet (downloading with no interim to serve, e.g.
    // English selected with only Hinglish installed): show the pill's
    // downloading phase, capture NO audio, kick the prepare, and let the next
    // press record once a model is serveable (WS-D; matrix rows 5, 11). An
    // installed interim keeps dictationServeableRef true, so rows 9/10 record.
    if (!dictationServeableRef.current) {
      invoke("show_recording_pill").catch(console.warn);
      invoke("set_pill_phase", { phase: "downloading" }).catch(console.warn);
      setStatus("Downloading speech model…");
      void prepareWhisperModel("dictation", {
        load: true,
        autoDownload: true,
      }).catch(() => {});
      return;
    }

    // Show the pill immediately so users see instant feedback
    invoke("show_recording_pill").catch(console.warn);

    // Use the pre-warmed stream if available; fall back to getUserMedia
    let stream: MediaStream;
    if (
      warmStreamRef.current &&
      warmStreamRef.current
        .getAudioTracks()
        .some((t) => t.readyState === "live")
    ) {
      stream = warmStreamRef.current;
    } else {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: getAudioConstraints(),
        });
        warmStreamRef.current = stream; // keep for next time
      } catch (e) {
        console.error("[record] getUserMedia failed:", e);
        setStatus(`Error: Could not access microphone — ${e}`);
        invoke("hide_recording_pill").catch(console.warn);
        return;
      }
    }

    // Check if stop arrived during any async wait
    if (pendingStopRef.current) {
      pendingStopRef.current = false;
      isRecordingRef.current = false;
      setIsRecording(false);
      setStatus("Recording too short — try holding longer");
      invoke("hide_recording_pill").catch(console.warn);
      return;
    }

    // A prior meeting mute may have left this shared warm stream's mic track
    // disabled; re-enable it so dictation never starts mic-dead.
    stream.getAudioTracks().forEach((t) => (t.enabled = true));

    streamRef.current = stream;
    const mimeType = MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : "audio/mp4";
    const mediaRecorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = mediaRecorder;
    audioChunksRef.current = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data);
    };
    mediaRecorder.onstop = () => {
      processAudio(
        stream,
        autoPasteRef.current,
        targetAppRef.current,
        targetBundleIdRef.current,
      );
    };

    // Re-check for a stop that landed between the getUserMedia resolution above
    // and here, before arming the recorder. The earlier check only covers the
    // stream-acquisition await; a very short tap whose release arrives in this
    // window would otherwise start a recording with no pending stop left to end
    // it, so it would run until the next manual stop. Abort cleanly instead.
    if (pendingStopRef.current) {
      pendingStopRef.current = false;
      isRecordingRef.current = false;
      setIsRecording(false);
      setStatus("Recording too short — try holding longer");
      invoke("hide_recording_pill").catch(console.warn);
      return;
    }

    mediaRecorder.start(100);
    startAudioMeter(stream);
    isRecordingRef.current = true;
    setIsRecording(true);
    setStatus("Recording... Release to stop");

    // Prewarm the dictation-cleanup backend NOW, at record-start, so its
    // ~2.8s Amplify Lambda cold-start is paid during the (usually multi-second)
    // recording + decode + transcribe window instead of serially before paste.
    // Firing here rather than at processing-start gives the boot far more lead
    // time: perf.jsonl showed cold-starts landing on the critical path
    // (cleanup-platform-net ~2.5s, some past the 7s deadline → raw transcript
    // pasted) because the post-record window alone was too short to hide a cold
    // boot. Fire-and-forget and a server-side no-op (returns before any Mercury/
    // quota work), so a wasted ping on a silent take is harmless. Gated on
    // cleanup being enabled at all.
    if (aiImprovementEnabledRef.current) {
      void aiService.warmUp();
    }
  };

  const stopHotkeyRecording = () => {
    if (hotkeyStopTailTimerRef.current) return;

    const stopRequestedAt = performance.now();
    const stopRecorder = () => {
      hotkeyStopTailTimerRef.current = null;
      isRecordingRef.current = false;
      setIsRecording(false);
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state === "recording"
      ) {
        console.info("[record] stopping after tail buffer", {
          tailMs: Math.round(performance.now() - stopRequestedAt),
        });
        mediaRecorderRef.current.stop();
      }
      stopAudioMeter();
      // Switch pill to processing (dots) — don't hide yet
      invoke("set_pill_processing").catch(console.warn);
    };

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      hotkeyStopTailTimerRef.current = setTimeout(
        stopRecorder,
        STREAM_TAIL_BUFFER_MS,
      );
      return;
    }

    stopRecorder();
  };

  // ── Audio processing (shared by hotkey recording) ───────────────────────────

  const processAudio = async (
    _stream: MediaStream,
    shouldPaste: boolean,
    _targetApp?: string,   // used in paste_transcription for NSRunningApplication re-focus
    _targetBundleId?: string, // preferred over _targetApp for re-focus (macOS bundle id)
  ) => {
    // ── Timing instrumentation (stream/dictation flow) ───────────────────────
    // Logs a single summary line at the end so we can spot which stage is slow.
    const tStart = performance.now();
    const timings: Record<string, number> = {};
    const metrics: Record<string, string | number> = {};
    let hadError = false;
    // Error class+message captured from the catch so perf.jsonl records WHY a
    // run failed, not just that it did. Our own error strings (e.g.
    // "model-mismatch", network failures) are not PII, so they log regardless of
    // the transcript opt-in.
    let errorInfo: string | null = null;

    // ── Stall watchdog + stage breadcrumb ────────────────────────────────────
    // `currentStage` names the unbounded await we're currently sitting on; the
    // watchdog reads it if the flow wedges. `dictationId` ties a stall record to
    // its eventual completion record when the run was merely slow. See
    // STREAM_STALL_WATCHDOG_MS for the log-only rationale.
    const dictationId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${tStart}`;
    let currentStage = "init";
    let stageStartedAt = tStart;
    let stallLogged = false;
    const enterStage = (stage: string) => {
      currentStage = stage;
      stageStartedAt = performance.now();
    };
    const stallWatchdog = setTimeout(() => {
      stallLogged = true;
      const elapsedMs = Math.round(performance.now() - tStart);
      const stageMs = Math.round(performance.now() - stageStartedAt);
      console.warn(
        `[stream-timing] STALL stage=${currentStage} elapsed=${elapsedMs}ms`,
      );
      try {
        invoke("append_perf_log", {
          jsonLine: JSON.stringify({
            ts: new Date().toISOString(),
            flow: "stream-dictation",
            kind: "stall",
            dictationId,
            platform: navigator.platform,
            online: navigator.onLine,
            stalledStage: currentStage,
            elapsedMs,
            stageMs,
            timings,
            metrics,
          }),
        }).catch((e) => console.warn("[perf] stall append failed:", e));
      } catch (e) {
        console.warn("[perf] failed to build stall record:", e);
      }
    }, STREAM_STALL_WATCHDOG_MS);

    // ── Transcript capture for offline quality analysis ──────────────────────
    // Hoisted out of the try-block so the `finally` can persist them to
    // perf.jsonl regardless of which exit path the handler takes. These are raw
    // user speech (PII): the verbatim strings are only written to perf.jsonl
    // when the user opts in via the `perfLogTranscripts` setting — see the gate
    // in the finally block below.
    let rawWhisperText: string | null = null;
    let finalCleanedText: string | null = null;
    let pasteHappened = false;
    // Set when AI cleanup was skipped because the session is dead. The raw
    // transcript still pastes (no text lost), but the pill reports "sign in to
    // enable AI" instead of a normal success toast.
    let aiAuthFailed = false;

    // Shared early-abort exit for the pre-transcription guards below. They
    // return before the try/finally that resets processing state, so route them
    // through one place that clears the processing flag, sets the status, and
    // collapses the pill — keeping every exit path consistent.
    const endProcessingEarly = (statusMessage: string) => {
      clearTimeout(stallWatchdog);
      setIsProcessing(false);
      setStatus(statusMessage);
      invoke("hide_recording_pill").catch(console.warn);
    };

    const chunkCount = audioChunksRef.current.length;
    const totalBytes = audioChunksRef.current.reduce((s, b) => s + b.size, 0);

    if (chunkCount === 0 || totalBytes === 0) {
      console.warn("[process] ABORT: no audio captured");
      endProcessingEarly("❌ No audio captured. Check microphone permission.");
      return;
    }

    const mimeType = MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : "audio/mp4";
    const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

    if (audioBlob.size < 500) {
      endProcessingEarly(`❌ Blob too small (${audioBlob.size}B). Try again.`);
      return;
    }

    // (Cleanup-backend prewarm now fires at record-start in startHotkeyRecording
    // — far more lead time to absorb the Amplify Lambda cold-start than this
    // post-record window offered.)
    setStatus(`Decoding ${(audioBlob.size / 1024).toFixed(0)}KB audio...`);
    const tDecode0 = performance.now();
    // Decode in Rust (symphonia), NOT WebAudio. WKWebView on macOS 26/27 throws
    // `EncodingError: Decoding failed` from AudioContext.decodeAudioData on the
    // mp4/AAC its own MediaRecorder produces, which silently killed every
    // dictation (recording was fine, decode wasn't). The Rust path mirrors the
    // meeting-segment decoder and returns 16 kHz mono f32 directly — no mixdown.
    let audioData: Float32Array;
    try {
      enterStage("decode");
      const blobBytes = Array.from(new Uint8Array(await audioBlob.arrayBuffer()));
      const ext = mimeType.includes("mp4") ? "mp4" : "webm";
      const pcm = await invoke<number[]>("decode_audio_blob", {
        bytes: blobBytes,
        ext,
      });
      audioData = Float32Array.from(pcm);
    } catch (e) {
      endProcessingEarly(`❌ Decode failed: ${e}`);
      return;
    }

    if (audioData.length < 1600) {
      endProcessingEarly(
        `❌ Too short (${audioData.length} samples). Speak for ≥1 second.`,
      );
      return;
    }

    let sumSq = 0;
    let peak = 0;
    for (let i = 0; i < audioData.length; i++) {
      const v = audioData[i];
      sumSq += v * v;
      const abs = v < 0 ? -v : v;
      if (abs > peak) peak = abs;
    }
    const rms = Math.sqrt(sumSq / audioData.length);
    if (rms < 0.005 || peak < 0.02) {
      console.warn(
        `[process] ABORT: silent audio (rms=${rms.toFixed(4)}, peak=${peak.toFixed(4)})`,
      );
      endProcessingEarly("⚠️ No speech detected. Try speaking louder or closer.");
      return;
    }

    const tTrim0 = performance.now();
    const trimResult = trimStreamSilence(audioData);
    audioData = trimResult.audio;
    timings["audio-trim"] = Math.round(performance.now() - tTrim0);
    metrics["audio-ms"] =
      `${durationMsForSamples(trimResult.originalSamples)}->${durationMsForSamples(trimResult.trimmedSamples)}`;
    metrics["trim-ms"] =
      `${trimResult.leadingTrimMs}+${trimResult.trailingTrimMs}`;
    metrics["voice-frames"] = trimResult.voicedFrames;
    metrics["trim-threshold"] =
      `${trimResult.thresholdRms.toFixed(3)}/${trimResult.thresholdPeak.toFixed(3)}`;

    const durationSec = (audioData.length / 16000).toFixed(1);
    setIsProcessing(true);
    setStatus(`Transcribing ${durationSec}s...`);
    timings["decode+mixdown"] = Math.round(performance.now() - tDecode0);

    try {
      // Captured BEFORE the await so we observe the pre-load state. After
      // ensureWhisperModelLoaded resolves, whisperLoadedRef.current is always
      // true, which would defeat the cold/warm bucketing.
      const wasModelWarm = whisperLoadedRef.current;
      const tWhisperLoad0 = performance.now();
      // ensureWhisperModelLoaded returns the freshly-resolved variant so we
      // can attribute perf to a model name without hitting the stale-closure
      // bug we'd get from reading `dictationModel.activeVariant` here
      // (React doesn't re-render between the setState in prepareWhisperModel
      // and this line within the same handler).
      enterStage("model-load");
      const ensured = await ensureWhisperModelLoaded("dictation");
      timings["whisper-load"] = Math.round(performance.now() - tWhisperLoad0);
      metrics["cold-load"] = wasModelWarm ? "0" : "1";
      const activeVariant = ensured.variant ?? dictationModel.activeVariant ?? null;
      if (!activeVariant) {
        endProcessingEarly("Speech model isn't ready yet.");
        return;
      }

      const tAudioArray0 = performance.now();
      const audioDataForIpc = Array.from(audioData);
      timings["audio-array"] = Math.round(performance.now() - tAudioArray0);

      enterStage("transcribe");
      const tWhisper0 = performance.now();
      const result = await transcribeWithVariant("dictation", activeVariant, {
        audioData: audioDataForIpc,
        initialPrompt: buildInitialPrompt(
          transcriptionLanguageRef.current,
          dictWordsRef.current,
        ),
        language: getWhisperLanguage(transcriptionLanguageRef.current, "dictation"),
      });
      timings["whisper-transcribe"] = Math.round(performance.now() - tWhisper0);

      // ── Per-stage metrics for offline analysis ─────────────────────────────
      // audio-sec is post-trim (what Whisper actually saw). rtf =
      // inference-ms / audio-ms — under 1.0 means faster than realtime.
      const audioSec = audioData.length / 16000;
      metrics["audio-sec"] = audioSec.toFixed(2);
      metrics["model"] = activeVariant ?? "unknown";
      if (audioSec > 0) {
        metrics["rtf"] = (
          timings["whisper-transcribe"] / (audioSec * 1000)
        ).toFixed(2);
      }
      if (result.perf) {
        // Sub-stage timing returned from the Rust side. Mirrors the names in
        // whisper.rs / state.rs::TranscriptionPerf.
        timings["whisper-vad"] = result.perf.vadMs;
        timings["whisper-state"] = result.perf.stateCreateMs;
        timings["whisper-infer"] = result.perf.inferenceMs;
        timings["whisper-segments"] = result.perf.segmentsMs;
        timings["whisper-rust-total"] = result.perf.totalMs;
        metrics["raw-segments"] = result.perf.rawSegments;
        metrics["drop-no-speech"] = result.perf.droppedNoSpeech;
        metrics["drop-hallu"] = result.perf.droppedHallucination;
      }

      if (!result.text) {
        console.warn("[process] ABORT: no speech detected (whisper empty)");
        setStatus("⚠️ No speech detected. Try speaking louder or closer.");
        return;
      }

      // Snapshot the raw Whisper output BEFORE any cleanup so perf.jsonl can
      // compare raw → AI-polished output across runs and across teammates.
      rawWhisperText = result.text;
      let finalText = result.text;
      const aiCleanupEnabled = aiImprovementEnabledRef.current;
      const effectiveContextAwareDictation =
        aiCleanupEnabled &&
        contextAwareDictationEnabledRef.current &&
        isContextAwarePlatform(getDesktopPlatform());
      const activeDictationContext = effectiveContextAwareDictation
        ? dictationContextRef.current
        : null;
      const dictationRouting = activeDictationContext
        ? routeDictationContext(activeDictationContext)
        : null;
      const dictationMetadata = buildDictationMetadata(dictationRouting);
      // Prompt mode overrides the persisted tone style. The wire value stays
      // "prompt-engineer" — the deployed edge function matches that string.
      const effectiveStylePreset: CleanupStyleWire = promptModeRef.current
        ? "prompt-engineer"
        : cleanupStyleRef.current;
      // Record the effective style on the saved metadata so feedback analytics
      // can attribute helpful-rate per style — no schema change, it rides the
      // existing dictation_prompt_version field (e.g. "context-v1/concise").
      if (
        effectiveStylePreset !== "faithful" &&
        "dictation_prompt_version" in dictationMetadata &&
        dictationMetadata.dictation_prompt_version
      ) {
        dictationMetadata.dictation_prompt_version =
          `${dictationMetadata.dictation_prompt_version}/${effectiveStylePreset}`;
      }
      let cleanupReturnedEmpty = false;

      // Local fast-path: when the user wants only faithful cleanup and the raw
      // transcript already reads clean, skip the Mercury round-trip and paste
      // as-is. Context-aware dictation is allowed only when routing has no
      // reliable category-specific behavior (default / low confidence), so the
      // skip remains equivalent to faithful cleanup for generic targets.
      const cleanupFastPathContextAllowed =
        !effectiveContextAwareDictation ||
        !dictationRouting ||
        dictationRouting.category === "default" ||
        dictationRouting.confidence === "low";
      const cleanupFastPathLanguageAllowed =
        transcriptionLanguageRef.current === "en" ||
        transcriptionLanguageRef.current === "auto";
      const cleanupFastPath =
        aiCleanupEnabled &&
        effectiveStylePreset === "faithful" &&
        !promptModeRef.current &&
        cleanupFastPathContextAllowed &&
        cleanupFastPathLanguageAllowed &&
        looksAlreadyCleanForPaste(finalText);
      if (cleanupFastPath) {
        // Apply the same deterministic post-processing the cleanup path runs on
        // Mercury's output (ai.service.ts -> applyTranscriptPostProcessing), so
        // skipping Mercury never drops a known local correction (e.g.
        // "living come dining" -> "living-cum-dining"). Pure, idempotent regex.
        finalText = applyTranscriptPostProcessing(finalText);
        metrics["cleanup-skipped"] = "already-clean";
        metrics["cleanup-skip-routing"] = dictationRouting
          ? `${dictationRouting.category}/${dictationRouting.confidence}`
          : "none";
      }

      // Silent AI cleanup via the backend AI function.
      // This now runs BEFORE paste so the AI-cleaned output is what gets pasted.
      if (aiCleanupEnabled && !cleanupFastPath) {
        setStatus("Improving with AI...");
        enterStage("ai-cleanup");
        const tAi0 = performance.now();
        // Deadline so a hung/slow Mercury cleanup never freezes the pill. When
        // it fires, the abort cancels the in-flight fetch and the catch below
        // falls through to pasting the raw Whisper transcript. Cleared in the
        // `finally` on the normal (fast) path.
        const cleanupController = new AbortController();
        const cleanupDeadline = setTimeout(
          () => cleanupController.abort(),
          STREAM_CLEANUP_DEADLINE_MS,
        );
        try {
          const cleaned = await aiService.processText(
            finalText,
            "transcribe_cleanup",
            {
              promptProfile: "stream",
              // User-chosen tone, or the per-session prompt-engineer override.
              // Sent unconditionally (independent of context-aware routing).
              stylePreset: effectiveStylePreset,
              // User-selected language code. Mercury 2 uses this to preserve
              // Devanagari for "hi", apply Hinglish spelling rules for "hi-en",
              // or do standard English cleanup for "en". Missing/auto = let
              // the cleanup detect from text content.
              language: transcriptionLanguageRef.current,
              // Deadline signal — aborting cancels the underlying fetch.
              signal: cleanupController.signal,
              // Capture wire-level breakdown so perf.jsonl can distinguish
              // "server is slow" (ttfb dominates) from "network is slow"
              // (dns/tcp/tls dominate) for the ai-cleanup stage.
              onTiming: (t) => {
                timings["cleanup-prep"] = t.prepMs;
                timings["cleanup-roundtrip"] = t.roundtripMs;
                if (t.matchedResource) {
                  if (t.dnsMs !== undefined) timings["cleanup-dns"] = t.dnsMs;
                  if (t.tcpMs !== undefined) timings["cleanup-tcp"] = t.tcpMs;
                  if (t.tlsMs !== undefined) timings["cleanup-tls"] = t.tlsMs;
                  if (t.ttfbMs !== undefined) timings["cleanup-ttfb"] = t.ttfbMs;
                  if (t.downloadMs !== undefined)
                    timings["cleanup-download"] = t.downloadMs;
                  metrics["cleanup-resource-matched"] = "1";
                } else {
                  metrics["cleanup-resource-matched"] = "0";
                }
                // Server-reported split (cleanup success path). Subtracting
                // edge-total from the observed roundtrip isolates the Supabase
                // platform/cold-start + FE↔edge network slice — the ~69% the
                // local wire timing couldn't attribute. Drives whether the next
                // lever is prewarm (cold-start), region (Mumbai→Mercury), or the
                // hop itself.
                if (t.server) {
                  timings["cleanup-edge-total"] = t.server.edgeTotalMs;
                  timings["cleanup-mercury"] = t.server.mercuryMs;
                  timings["cleanup-mercury-headers"] =
                    t.server.mercuryHeadersMs;
                  metrics["cleanup-cache-hit-pct"] = t.server.cacheHitPct;
                  timings["cleanup-platform-net"] = Math.max(
                    0,
                    Math.round(t.roundtripMs - t.server.edgeTotalMs),
                  );
                }
              },
              ...(activeDictationContext && dictationRouting
                ? {
                    context: activeDictationContext,
                    routing: dictationRouting,
                  }
                : {}),
            },
          );
          timings["ai-cleanup"] = Math.round(performance.now() - tAi0);
          if (cleaned && cleaned.trim().length > 0) {
            finalText = cleaned;
          } else {
            // Server signalled "no real speech" (silence / hallucination).
            // Skip paste and persistence so the user is not surprised by a
            // chatty refusal or stray hallucinated text.
            cleanupReturnedEmpty = true;
          }
        } catch (aiErr) {
          timings["ai-cleanup"] = Math.round(performance.now() - tAi0);
          if (cleanupController.signal.aborted) {
            // Deadline hit: cleanup was too slow. Keep the raw transcript (set
            // above) so the user gets their words now instead of waiting on a
            // stalled call. Recorded so perf.jsonl can show how often this fires.
            metrics["cleanup-timed-out"] = "1";
            console.warn(
              `[ai] cleanup exceeded ${STREAM_CLEANUP_DEADLINE_MS}ms — pasting raw transcript`,
            );
          } else if (isAuthSessionError(aiErr)) {
            // Dead session: don't fail silently — the raw transcript still
            // pastes, but flag it so the pill prompts re-auth and the main
            // window is raised to the sign-in screen. promptReauth returns true
            // when the session actually recovered (a transient blip), in which
            // case we leave the normal success toast alone.
            const recovered = await promptReauth();
            aiAuthFailed = !recovered;
            if (!recovered) {
              console.warn("[ai] cleanup skipped — session invalid, prompting re-auth");
            }
          } else {
            // Other failures: fall back to raw transcript silently.
            console.warn(
              "[ai] silent cleanup failed, using raw transcript:",
              aiErr,
            );
          }
        } finally {
          clearTimeout(cleanupDeadline);
        }
      }

      // Snapshot whatever text we'd actually paste (cleaned if successful,
      // raw if cleanup was skipped/failed). Captured even in the
      // `cleanupReturnedEmpty` early-return below so perf.jsonl still records
      // what Whisper produced versus what the server suppressed.
      finalCleanedText = cleanupReturnedEmpty ? "" : finalText;

      if (cleanupReturnedEmpty) {
        // Mercury returned empty — its "no real speech" signal. But Whisper DID
        // produce text, so dropping it silently loses the user's words. Keep the
        // raw transcript: persist it locally and tell the user it was saved
        // unpolished. We still skip auto-paste — an empty cleanup is a
        // low-confidence signal, so we don't push the raw text into their app.
        const rawText =
          rawWhisperText && rawWhisperText.trim().length > 0
            ? rawWhisperText
            : null;
        if (rawText) {
          finalCleanedText = rawText;
          console.info(
            "[process] AI cleanup returned empty — saving raw transcript unpolished",
          );
          setTranscript((prev) => (prev ? prev + "\n\n" + rawText : rawText));
          const rawRecord: LocalTranscript = {
            id: crypto.randomUUID(),
            text: rawText,
            rawText,
            createdAt: new Date().toISOString(),
            ...dictationMetadata,
          };
          setLocalTranscripts((prev) => {
            const updated = [rawRecord, ...prev];
            saveSetting("localTranscripts", updated);
            return updated;
          });
          setStatus("Saved your words (couldn't polish them) — see Home.");
        } else {
          console.info(
            "[process] AI cleanup returned empty — treating as silence",
          );
          setStatus("⚠️ No speech detected. Try speaking louder or closer.");
        }
        return;
      }

      // ── Auto-paste: do this AFTER AI cleanup ──────────────────────────────
      // Now that AI cleanup is complete, paste the improved text to the target app.
      if (shouldPaste) {
        const isMac = navigator.platform.toLowerCase().includes("mac");
        enterStage("paste");
        const tPaste0 = performance.now();
        try {
          // Pass targetApp so the Rust command can re-activate it via
          // NSRunningApplication before posting Cmd+V.  This handles the case
          // where the Tauri IPC call causes Oscar's process to take focus on
          // the main thread.  The Rust side uses NSRunningApplication (NOT
          // `open -a`) so there's no Space-switch animation or Spaces disruption.
          const pasteResult = await invoke<string>("paste_transcription", {
            text: finalText,
            targetApp: _targetApp || undefined,
            targetBundleId: _targetBundleId || undefined,
          });
          timings["paste"] = Math.round(performance.now() - tPaste0);
          const pasteMetrics = parsePasteMetricsResponse(pasteResult);
          if (pasteMetrics?.timings) {
            Object.entries(pasteMetrics.timings).forEach(([key, value]) => {
              if (Number.isFinite(value)) {
                timings[`paste-${normalizePasteTimingKey(key)}`] =
                  Math.round(value);
              }
            });
          }
          if (pasteMetrics?.status) {
            metrics["paste-status"] = pasteMetrics.status;
          }
          if (pasteMetrics?.targetBundleId) {
            metrics["paste-target-bundle-id"] = pasteMetrics.targetBundleId;
          }
          if (pasteMetrics?.targetApp) {
            metrics["paste-target-app"] = pasteMetrics.targetApp;
          }
          if (typeof pasteMetrics?.activated === "boolean") {
            metrics["paste-activated"] = pasteMetrics.activated ? "1" : "0";
          }
          if (typeof pasteMetrics?.targetFound === "boolean") {
            metrics["paste-target-found"] = pasteMetrics.targetFound ? "1" : "0";
          }
          // User-felt latency: stop → paste-done. Excludes persistence work
          // that runs afterwards. This is the number that matches "how long
          // until my text shows up" for the user.
          metrics["paste-felt-ms"] = Math.round(performance.now() - tStart);
          const pasteStatus = pasteMetrics?.status ?? pasteResult;
          if (pasteStatus === "CLIPBOARD_ONLY" || pasteStatus === "clipboard_only") {
            // Accessibility not granted — text is in clipboard, guide user
            setStatus(
              isMac
                ? "📋 Copied! Grant Accessibility in System Settings for auto-paste, or press ⌘V."
                : "📋 Copied! Press Ctrl+V to paste.",
            );
          } else {
            pasteHappened = true;
            setStatus("Pasted! ✓");
          }
        } catch (pe) {
          timings["paste"] = Math.round(performance.now() - tPaste0);
          metrics["paste-felt-ms"] = Math.round(performance.now() - tStart);
          console.error("[paste] FAILED:", pe);
          setStatus(
            isMac
              ? "📋 Copied to clipboard. Press ⌘V to paste."
              : "📋 Copied to clipboard. Press Ctrl+V to paste.",
          );
        }
      }

      enterStage("persist");
      const tPersist0 = performance.now();
      setTranscript((prev) => (prev ? prev + "\n\n" + finalText : finalText));

      // Add to local transcripts list for the HomeTab UI
      const newTranscript: LocalTranscript = {
        id: crypto.randomUUID(),
        text: finalText,
        // Keep the raw transcript locally so it can be persisted alongside the
        // formatted text if the user later leaves feedback on this dictation.
        rawText: rawWhisperText ?? null,
        createdAt: new Date().toISOString(),
        ...dictationMetadata,
      };
      // Use functional update to avoid stale closure issues
      setLocalTranscripts((prev) => {
        const updatedTranscripts = [newTranscript, ...prev];
        // Persist to disk
        saveSetting("localTranscripts", updatedTranscripts);
        return updatedTranscripts;
      });
      timings["persist"] = Math.round(performance.now() - tPersist0);

      // Stream is a local-only feature: the dictation lives in localTranscripts
      // (saved to disk above) and never persists to the backend. A row is only
      // written to the `streams` table when the user submits feedback — see the
      // future persist-on-feedback path that reuses streamsService.record().

      if (!shouldPaste) {
        // Auto-paste is off: still write the result to the OS clipboard so the
        // user can manually press ⌘V / Ctrl+V wherever they want.
        try {
          await invoke("copy_to_clipboard", { text: finalText });
          const isMac = navigator.platform.toLowerCase().includes("mac");
          setStatus(
            isMac
              ? "📋 Copied to clipboard. Press ⌘V to paste."
              : "📋 Copied to clipboard. Press Ctrl+V to paste.",
          );
        } catch (ce) {
          console.warn("[clipboard] copy failed:", ce);
          setStatus("Done! ✓");
        }
      }
    } catch (e) {
      hadError = true;
      errorInfo =
        e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      setStatus(`❌ Error: ${e}`);
      // Surface an error glyph on the pill briefly, then collapse to rest.
      invoke("set_pill_phase", { phase: "error" }).catch(console.warn);
      setTimeout(() => {
        invoke("hide_recording_pill").catch(console.warn);
      }, 1500);
    } finally {
      // Flow reached a terminal state — disarm the stall watchdog so it can't
      // emit a false stall after a slow-but-completing run.
      clearTimeout(stallWatchdog);
      setIsProcessing(false);
      // Clear the pill's context label as the flow ends; the next record-start
      // re-emits a fresh one. The "Inserted into document" outcome toast below
      // is unchanged and shows for every app, recognized or not.
      emit("pill-context-app", null).catch(() => {});
      // Success path: show the outcome toast — "Inserted" when auto-paste
      // landed the text in the focused app, "Copied" when only the clipboard
      // was set. When the session was dead, the raw transcript still pasted but
      // AI cleanup was skipped, so report "sign in to enable AI" instead and
      // dwell a touch longer so it's readable. Then collapse to the edge handle.
      if (!hadError) {
        const finalPhase = aiAuthFailed
          ? "auth"
          : pasteHappened
            ? "inserted"
            : "copied";
        invoke("set_pill_phase", { phase: finalPhase }).catch(console.warn);
        setTimeout(() => {
          invoke("hide_recording_pill").catch(console.warn);
        }, aiAuthFailed ? 2400 : 1500);
      }
      const totalMs = Math.round(performance.now() - tStart);
      const timingParts = Object.entries(timings)
        .map(([k, v]) => `${k}=${v}ms`);
      const metricParts = Object.entries(metrics)
        .map(([k, v]) => `${k}=${v}`);
      const parts = [...timingParts, ...metricParts]
        .join(" ");
      console.info(`[stream-timing] total=${totalMs}ms ${parts}`);

      // ── Persist one JSONL record per dictation to <app-data>/perf.jsonl ────
      // Fire-and-forget: a disk-write failure must never affect dictation UX.
      // The append_perf_log Rust command resolves the per-platform app data
      // dir; it logs the resolved path on the first successful append so users
      // know where to grab the file.
      //
      // PRIVACY: the verbatim `raw`/`final` transcript strings are raw user
      // speech (PII), so they are only written when the user has explicitly
      // opted in via the `perfLogTranscripts` setting (Settings → Data &
      // privacy, default OFF). The char/word counts and deltas — the actual
      // perf signal — are always logged. Do NOT upload the file to public
      // locations as-is.
      try {
        const logTranscripts = perfLogTranscriptsRef.current;
        const rawChars = rawWhisperText ? rawWhisperText.length : 0;
        const finalChars = finalCleanedText ? finalCleanedText.length : 0;
        // Cheap word count — split on whitespace runs. Good enough for
        // verbosity-shift signals; not language-aware.
        const rawWords = rawWhisperText
          ? rawWhisperText.trim().split(/\s+/).filter(Boolean).length
          : 0;
        const finalWords = finalCleanedText
          ? finalCleanedText.trim().split(/\s+/).filter(Boolean).length
          : 0;
        // Coarse outcome bucket for at-a-glance filtering; the nuanced cases
        // (cleanup-skipped fast-path, cleanup-empty, no-speech) are already
        // distinguishable from `metrics`. `errorInfo` carries the failure class.
        const outcome = hadError
          ? "error"
          : aiAuthFailed
            ? "auth-degraded"
            : pasteHappened
              ? "pasted"
              : "copied-or-saved";
        const record = {
          ts: new Date().toISOString(),
          flow: "stream-dictation",
          kind: "complete",
          dictationId,
          platform: navigator.platform,
          userAgent: navigator.userAgent,
          online: navigator.onLine,
          hadError,
          errorInfo,
          outcome,
          // True when the stall watchdog already emitted a `kind:"stall"` record
          // for this id — i.e. a stage overran the budget but the run still
          // finished (slow, not hung). Pair the two records by `dictationId`.
          stalledThenRecovered: stallLogged,
          totalMs,
          timings,
          metrics,
          // Records whether the verbatim transcript strings below were
          // included, so a reader can tell "opted out" apart from "empty".
          perfLogTranscripts: logTranscripts,
          // Transcripts + summary stats. `charDelta` < 0 means cleanup
          // shortened the text (filler removal); > 0 means cleanup expanded
          // it (rare, usually grammar fixes adding words). The verbatim
          // `raw`/`final` strings are PII — only present when opted in.
          transcripts: {
            ...(logTranscripts
              ? { raw: rawWhisperText, final: finalCleanedText }
              : {}),
            rawChars,
            finalChars,
            charDelta: finalChars - rawChars,
            rawWords,
            finalWords,
            wordDelta: finalWords - rawWords,
          },
        };
        invoke("append_perf_log", {
          jsonLine: JSON.stringify(record),
        }).catch((e) => console.warn("[perf] append_perf_log failed:", e));
      } catch (perfErr) {
        console.warn("[perf] failed to build perf record:", perfErr);
      }
    }

    // Don't stop the stream — keep it warm for next recording
  };

  // ── Scribble recording (click to start/stop, saves a Scribble) ───────────

  // Shared core: take decoded 16 kHz mono PCM → transcribe → format → title →
  // save as a Scribble. Used by both the mic-recorded path and audio-file
  // import so the two stay in lockstep.
  const runScribblePipeline = async (
    audioData: Float32Array,
    finish: (msg: string | null) => void,
  ) => {
    const uid = user?.id;
    if (!uid) {
      setStatus("Sign in to save Scribbles.");
      finish("Sign in to save Scribbles.");
      return;
    }
    if (audioData.length < 1600) {
      setStatus("That recording was too short. Try again.");
      finish("Too short. Try again.");
      return;
    }

    try {
      const ensured = await ensureWhisperModelLoaded("dictation");
      const activeVariant =
        ensured.variant ?? dictationModel.activeVariant ?? null;
      if (!activeVariant) {
        setStatus("Speech model isn't ready yet.");
        finish("Speech model isn't ready yet.");
        return;
      }
      const result = await transcribeWithVariant("dictation", activeVariant, {
        audioData: Array.from(audioData),
        initialPrompt: buildInitialPrompt(
          transcriptionLanguageRef.current,
          dictWordsRef.current,
        ),
        language: getWhisperLanguage(transcriptionLanguageRef.current, "dictation"),
      });

      const rawText = result.text?.trim() ?? "";
      if (!rawText) {
        setStatus("No speech detected.");
        finish("No speech detected. Try again.");
        return;
      }

      let formattedText = rawText;
      let title = "";
      if (aiImprovementEnabledRef.current) {
        setScribbleStatus("polishing");
        setStatus("polishing");
        try {
          const formatted = await aiService.formatScribble(rawText);
          if (formatted.trim()) {
            formattedText = formatted.trim();
          }
        } catch (aiErr) {
          console.warn("[scribble] format failed, saving raw transcript:", aiErr);
        }

        setScribbleStatus("titling");
        try {
          title = await aiService.generateScribbleTitle(formattedText);
        } catch (titleErr) {
          console.warn("[scribble] title generation failed, using fallback:", titleErr);
        }
      }

      setScribbleStatus("saving");
      setStatus("saving");
      const { error } = await scribblesService.createScribble({
        user_id: uid,
        title: title || buildFallbackScribbleTitle(formattedText),
        raw_text: rawText,
        original_formatted_text: formattedText,
        edited_text: null,
      });

      if (error) {
        throw error;
      }

      setScribbleRefreshKey((key) => key + 1);
      setStatus("Scribble saved.");
      finish("Scribble saved ✓");
    } catch (e) {
      console.error("[scribble] failed:", e);
      setStatus(`Scribble failed: ${e}`);
      finish(`Failed: ${e}`);
    }
  };

  const processScribbleAudio = async () => {
    const finish = (msg: string | null) => {
      setIsProcessing(false);
      setIsScribbleProcessing(false);
      isScribbleProcessingRef.current = false;
      setScribbleStatus(msg);
      if (msg) {
        window.setTimeout(() => {
          setScribbleStatus((current) => (current === msg ? null : current));
        }, 2500);
      }
    };

    if (!user?.id) {
      setStatus("Sign in to save Scribbles.");
      finish("Sign in to save Scribbles.");
      return;
    }

    const chunkCount = scribbleAudioChunksRef.current.length;
    const totalBytes = scribbleAudioChunksRef.current.reduce((s, b) => s + b.size, 0);

    if (chunkCount === 0 || totalBytes === 0) {
      setStatus("No audio captured. Check microphone permission.");
      finish("No audio captured. Check microphone permission.");
      return;
    }

    const mimeType = MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : "audio/mp4";
    const audioBlob = new Blob(scribbleAudioChunksRef.current, { type: mimeType });

    if (audioBlob.size < 500) {
      setStatus("Scribble recording was too short. Try again.");
      finish("Recording was too short. Try again.");
      return;
    }

    setIsProcessing(true);
    setIsScribbleProcessing(true);
    setScribbleStatus("transcribing");
    setStatus("transcribing");

    // Decode in Rust (symphonia), NOT WebAudio — WKWebView's decodeAudioData
    // throws EncodingError on the mp4/AAC MediaRecorder produces on macOS 26/27
    // (see processAudio). Returns 16 kHz mono f32 directly.
    let audioData: Float32Array;
    try {
      const blobBytes = Array.from(new Uint8Array(await audioBlob.arrayBuffer()));
      const ext = mimeType.includes("mp4") ? "mp4" : "webm";
      const pcm = await invoke<number[]>("decode_audio_blob", {
        bytes: blobBytes,
        ext,
      });
      audioData = Float32Array.from(pcm);
    } catch (e) {
      setStatus(`Scribble decode failed: ${e}`);
      finish(`Decode failed: ${e}`);
      return;
    }

    await runScribblePipeline(audioData, finish);
  };

  // Import an existing audio file as a Scribble — decode → 16 kHz mono →
  // same transcribe/format/title/save core as a mic recording.
  const importScribbleFromFile = async (file: File) => {
    const finish = (msg: string | null) => {
      setIsProcessing(false);
      setIsScribbleProcessing(false);
      isScribbleProcessingRef.current = false;
      setScribbleStatus(msg);
      if (msg) {
        window.setTimeout(() => {
          setScribbleStatus((current) => (current === msg ? null : current));
        }, 2500);
      }
    };

    if (!user?.id) {
      setStatus("Sign in to save Scribbles.");
      finish("Sign in to save Scribbles.");
      return;
    }
    if (
      isRecordingRef.current ||
      isScribbleRecordingRef.current ||
      isScribbleProcessingRef.current
    ) {
      return;
    }
    const looksLikeAudio =
      file.type.startsWith("audio/") ||
      /\.(mp3|m4a|wav|webm|ogg|oga|aac|flac|mp4)$/i.test(file.name);
    if (!looksLikeAudio) {
      setStatus("That doesn't look like an audio file.");
      finish("Unsupported file type.");
      return;
    }

    setIsProcessing(true);
    setIsScribbleProcessing(true);
    isScribbleProcessingRef.current = true;
    setScribbleStatus("transcribing");
    setStatus(`Importing ${file.name}…`);

    // Prefer Rust (symphonia) for mp4/m4a/aac/wav/webm — WKWebView's
    // decodeAudioData is broken on macOS 26/27. Fall back to WebAudio for the
    // formats symphonia isn't built with (mp3/flac/ogg) so those still import.
    let audioData: Float32Array;
    try {
      const ext = (file.name.split(".").pop() || "").toLowerCase();
      try {
        const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
        const pcm = await invoke<number[]>("decode_audio_blob", { bytes, ext });
        audioData = Float32Array.from(pcm);
      } catch {
        const audioContext = new AudioContext({ sampleRate: 16000 });
        try {
          const decoded = await audioContext.decodeAudioData(
            await file.arrayBuffer(),
          );
          const mono = new Float32Array(decoded.length);
          for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
            const channel = decoded.getChannelData(ch);
            for (let i = 0; i < decoded.length; i++)
              mono[i] += channel[i] / decoded.numberOfChannels;
          }
          audioData = mono;
        } finally {
          audioContext.close();
        }
      }
    } catch (e) {
      setStatus(`Could not read that audio file: ${e}`);
      finish("Could not read that file.");
      return;
    }

    await runScribblePipeline(audioData, finish);
  };

  const startScribbleRecording = async () => {
    if (
      isRecordingRef.current ||
      isScribbleRecordingRef.current ||
      isScribbleProcessingRef.current
    ) {
      return;
    }
    // Block while a meeting is recording or finalizing (WS-C rule 4).
    if (isMeetingPipelineBusyRef.current()) {
      setStatus("Finishing meeting notes…");
      return;
    }
    // Scribble shares the dictation role — if no model is serveable yet, give a
    // downloading state and kick the prepare instead of recording audio that
    // would only fail to transcribe (WS-D).
    if (!dictationServeableRef.current) {
      setStatus("Downloading speech model — try again once it's ready.");
      void prepareWhisperModel("dictation", {
        load: true,
        autoDownload: true,
      }).catch(() => {});
      return;
    }

    let stream: MediaStream;
    if (
      warmStreamRef.current &&
      warmStreamRef.current.getAudioTracks().some((t) => t.readyState === "live")
    ) {
      stream = warmStreamRef.current;
    } else {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: getAudioConstraints(),
        });
        warmStreamRef.current = stream;
      } catch (e) {
        console.error("[scribble] getUserMedia failed:", e);
        setStatus(`Could not access microphone: ${e}`);
        isScribbleProcessingRef.current = false;
        return;
      }
    }

    // A prior meeting mute may have left this shared warm stream's mic track
    // disabled; re-enable it so a scribble never starts mic-dead.
    stream.getAudioTracks().forEach((t) => (t.enabled = true));

    const mimeType = MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : "audio/mp4";
    const mediaRecorder = new MediaRecorder(stream, { mimeType });
    scribbleMediaRecorderRef.current = mediaRecorder;
    scribbleAudioChunksRef.current = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        scribbleAudioChunksRef.current.push(event.data);
      }
    };
    mediaRecorder.onstop = () => {
      void processScribbleAudio();
    };

    mediaRecorder.start(100);
    isScribbleRecordingRef.current = true;
    setIsScribbleRecording(true);
    setScribbleRecordingTime(0);
    scribbleTimerRef.current = setInterval(() => {
      setScribbleRecordingTime((previous) => previous + 1);
    }, 1000);
    setStatus("Recording Scribble...");
  };

  const stopScribbleRecording = () => {
    isScribbleRecordingRef.current = false;
    setIsScribbleRecording(false);
    if (scribbleTimerRef.current) {
      clearInterval(scribbleTimerRef.current);
      scribbleTimerRef.current = null;
    }
    if (
      scribbleMediaRecorderRef.current &&
      scribbleMediaRecorderRef.current.state === "recording"
    ) {
      isScribbleProcessingRef.current = true;
      setIsScribbleProcessing(true);
      setScribbleStatus("transcribing");
      scribbleMediaRecorderRef.current.stop();
    } else {
      isScribbleProcessingRef.current = false;
      setIsScribbleProcessing(false);
    }
  };

  // ── Google Calendar OAuth (direct Google PKCE — no Supabase auth) ───────

  const connectGoogleCalendar = async () => {
    const redirectUri = `${import.meta.env.VITE_WEB_APP_URL || "https://oscar.samyarth.org"}/auth/desktop-callback`;
    const clientId = "332965035815-v8fnucr2ho5tm0c1jvsd84lch5n8m654.apps.googleusercontent.com";

    try {
      // Generate PKCE code_verifier (43-128 chars, unreserved URI chars)
      const verifierBytes = new Uint8Array(32);
      crypto.getRandomValues(verifierBytes);
      const codeVerifier = btoa(String.fromCharCode(...verifierBytes))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
      pkceCodeVerifierRef.current = codeVerifier;

      // Derive code_challenge (S256)
      const challengeBuffer = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(codeVerifier),
      );
      const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(challengeBuffer)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "https://www.googleapis.com/auth/calendar.readonly",
        access_type: "offline",
        prompt: "consent",
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        state: "calendar_connect",
      });

      const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

      console.log("[calendar] Opening direct Google OAuth URL (PKCE, no Supabase auth)");
      await openUrl(oauthUrl);
    } catch (err) {
      pkceCodeVerifierRef.current = "";
      console.error("[calendar] Failed to start Google Calendar OAuth:", err);
      alert(`Calendar connect failed: ${(err as Error).message}`);
    }
  };

  // ── Google Calendar token refresh ────────────────────────────────────────
  // Called automatically before the access token expires. Returns an explicit
  // state so temporary refresh hiccups do not immediately disconnect Calendar.

  const refreshCalendarToken = useCallback(async (): Promise<CalendarReconnectResult> => {
    if (!googleCalendarRefreshToken) return "needs_reconnect";
    console.log("[calendar] Refreshing access token…");
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      const { data, error: fnErr } = await supabase.functions.invoke<{
        access_token: string; expires_in: number; needs_reconnect?: boolean;
      }>("refresh-calendar-token", {
        headers: s?.access_token ? { Authorization: `Bearer ${s.access_token}` } : {},
        body: { refresh_token: googleCalendarRefreshToken },
      });
      if (fnErr || !data?.access_token) {
        if (data?.needs_reconnect) {
          console.warn("[calendar] Refresh token needs reconnect");
          return "needs_reconnect";
        }
        console.warn("[calendar] Token refresh failed:", fnErr);
        return "retry_later";
      }
      const expiry = Date.now() + (data.expires_in ?? 3600) * 1000;
      await persistCalendarConnection({
        accessToken: data.access_token,
        expiry,
        userId: sessionRef.current?.user?.id ?? null,
      });
      console.log("[calendar] Access token refreshed successfully");
      return "refreshed";
    } catch (err) {
      console.warn("[calendar] Token refresh error:", err);
      return "retry_later";
    }
  }, [googleCalendarRefreshToken, persistCalendarConnection]);

  useEffect(() => {
    if (!googleCalendarToken || !googleCalendarRefreshToken || !googleCalendarTokenExpiry) return;

    const refreshLeadMs = 5 * 60 * 1000;
    const refreshDelay = Math.max(googleCalendarTokenExpiry - Date.now() - refreshLeadMs, 0);

    const timeoutId = setTimeout(async () => {
      const refreshState = await refreshCalendarToken();
      if (refreshState === "needs_reconnect") {
        await clearCalendarConnection();
      }
    }, refreshDelay);

    return () => clearTimeout(timeoutId);
  }, [
    clearCalendarConnection,
    googleCalendarRefreshToken,
    googleCalendarToken,
    googleCalendarTokenExpiry,
    refreshCalendarToken,
  ]);

  useEffect(() => {
    if (!user?.id || !googleCalendarConnectedUserId) return;
    if (googleCalendarConnectedUserId !== user.id) {
      void clearCalendarConnection();
    }
  }, [clearCalendarConnection, googleCalendarConnectedUserId, user?.id]);

  const handlePermissionsContinue = async () => {
    await saveSetting("permissionsDone", true);
    setPermissionsShown(true);
    if (whisperLoadedRef.current) void warmVoiceEngine();
  };

  const retryHotkeyRegistration = useCallback(async () => {
    try {
      await invoke<boolean>("ensure_recording_hotkey_registered");
      setHotkeyWarning("");
    } catch (err) {
      setHotkeyWarning(String(err).replace(/^Error:\s*/i, ""));
    }
  }, []);

  const handleSetupComplete = async () => {
    const loaded = await initWhisper();
    if (!loaded) {
      throw new Error(
        "The speech model downloaded, but OSCAR could not load it. Please try setup again.",
      );
    }
    await saveSetting("setupComplete", true);
    setSetupComplete(true);
  };

  const handleSignOut = async () => {
    await signOutLocally();
  };

  // AI Improvement toggle handler
  const handleAiImprovementChange = useCallback((enabled: boolean) => {
    setAiImprovementEnabled(enabled);
    aiImprovementEnabledRef.current = enabled;
    saveSetting("aiImprovementEnabled", enabled);
    invoke("pill_push_settings", {
      language: transcriptionLanguageRef.current,
      autoPaste: autoPasteRef.current,
      aiImprovement: enabled,
      cleanupStyle: cleanupStyleRef.current,
      promptMode: promptModeRef.current,
    }).catch(console.warn);
  }, []);

  const handleContextAwareDictationChange = useCallback((enabled: boolean) => {
    setContextAwareDictationEnabled(enabled);
    contextAwareDictationEnabledRef.current = enabled;
    saveSetting("contextAwareDictationEnabled", enabled);
  }, []);

  const handleSystemAudioToggle = useCallback((enabled: boolean) => {
    setSystemAudioEnabled(enabled);
    saveSetting("systemAudioEnabled", enabled);
    if (!enabled) {
      clearSystemAudioWarning();
    }
  }, [clearSystemAudioWarning]);

  useEffect(() => {
    if (!setupComplete) return;
    if (activeTab !== "meetings") return;
    if (currentWhisperRoleRef.current !== "minutes") return;
    void warmVoiceEngine().catch((err) =>
      console.warn("[whisper] failed to warm voice engine:", err),
    );
  }, [activeTab, setupComplete]);

  // Pre-download the Minutes Whisper model the moment the user opens the
  // Minutes tab — using the gap while they pick meeting type / attendees,
  // long before they hit record. Without this, the (large) model download
  // lands entirely on the first "Start recording" click and reads as a hang.
  //
  // This is cheap when the model is already on disk (resolveModelForRole
  // short-circuits, no network). When a download IS needed, it's deduped via
  // modelDownloadPromisesRef: a later record-time ensureWhisperModelLoaded
  // joins THIS same in-flight download rather than starting a second one. The
  // once-per-session guard avoids re-kicking it on every tab revisit.
  const minutesPredownloadStartedRef = useRef(false);
  useEffect(() => {
    if (!setupComplete) return;
    if (activeTab !== "meetings") return;
    if (minutesPredownloadStartedRef.current) return;
    minutesPredownloadStartedRef.current = true;
    void prepareWhisperModel("minutes", {
      load: false,
      autoDownload: true,
    }).catch((err) =>
      console.warn("[whisper] minutes model pre-download failed:", err),
    );
  }, [activeTab, setupComplete, prepareWhisperModel]);

  // ── Subscription state ─────────────────────────────────────────────────────
  const [isProUser, setIsProUser] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [permissionRecoveryOpen, setPermissionRecoveryOpen] = useState(false);
  const [permissionRecoveryKind] = useState<"microphone" | "accessibility">(
    "microphone",
  );
  const [releaseNotesOpen, setReleaseNotesOpen] = useState(false);

  // Fetch subscription status when user changes
  useEffect(() => {
    if (!user) return;

    const fetchSubscription = async () => {
      try {
        const { data } = await supabase
          .from("subscriptions")
          .select("tier, status, current_period_end")
          .eq("user_id", user.id)
          .maybeSingle();

        const entitlement = getSubscriptionEntitlement({
          tier: data?.tier,
          status: data?.status,
          currentPeriodEnd: data?.current_period_end,
        });

        setIsProUser(entitlement.isPro);
      } catch (e) {
        console.error("Failed to fetch subscription:", e);
        setIsProUser(false);
      }
    };

    fetchSubscription();
  }, [user]);

  // Stream is a logged-in-only desktop feature. The pill window, its hover
  // poller, and the global hotkey are created/registered in Rust independent of
  // this React tree, so gating the render below isn't enough — we must tell Rust
  // to actually hide/disable them. Enable only for a fully set-up, authenticated
  // session (mirrors the render gates just below); disable on sign-out or
  // session expiry (the auth listener sets user → null, re-running this effect).
  useEffect(() => {
    const enabled =
      !!user && permissionsShown === true && setupComplete === true;
    invoke("set_pill_enabled", { enabled }).catch(console.warn);
  }, [user, permissionsShown, setupComplete]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (authLoading) return null;
  if (!user)
    return (
      <AuthScreen
        onAuth={(s) => {
          setSession(s);
          sessionRef.current = s;
          setUser(s.user);
        }}
      />
    );
  if (permissionsShown === null) return null;
  if (!permissionsShown)
    return (
      <PermissionsScreen
        onContinue={handlePermissionsContinue}
        hotkeyWarning={hotkeyWarning}
        onRetryHotkey={retryHotkeyRegistration}
      />
    );
  if (setupComplete === null) return null;
  if (!setupComplete)
    return (
      <SetupScreen
        onComplete={handleSetupComplete}
        transcriptionLanguage={transcriptionLanguage}
        onLanguageChange={(lang) => {
          // A language picked during onboarding: mirror it into state + ref so
          // initWhisper (post-setup) loads the model SetupScreen just fetched,
          // not the old default (WS-E).
          setTranscriptionLanguage(lang);
          transcriptionLanguageRef.current = lang;
        }}
      />
    );

  const headerTitleByTab: Record<TabType, string> = {
    home: "OSCAR · LISTENING SURFACE",
    scribble: "OSCAR · SCRIBBLES",
    meetings: "OSCAR · MINUTES",
    settings: "OSCAR · SETTINGS",
    vocabulary: "OSCAR · VOCABULARY",
    billing: "OSCAR · BILLING",
  };

  return (
    <div className="h-screen bg-cream overflow-hidden flex flex-col font-sans text-ink">
      {/* Header - flows in layout, not fixed */}
      <Header
        title={headerTitleByTab[activeTab] ?? "OSCAR"}
        userEmail={user.email || ""}
        onSignOut={handleSignOut}
        onSettingsClick={() => setActiveTab("settings")}
      />

      {hotkeyWarning && (
        <div className="px-6 py-4 border-b border-cream-300 bg-cream-200 flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-terracotta">
              HOTKEY CONFLICT
            </span>
            <p className="mt-1 font-serif text-[16px] leading-snug tracking-[-0.005em] text-ink">
              Another app owns <em className="italic text-terracotta">Ctrl + Space</em>.
            </p>
            <p className="mt-1 text-[12px] text-ink-soft">{hotkeyWarning}</p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-full bg-ink text-cream px-4 py-2 text-[12px] font-medium border-none cursor-pointer hover:opacity-90"
            onClick={() => retryHotkeyRegistration()}
          >
            Retry hotkey
          </button>
        </div>
      )}

      {dictationConflict && (
        <div className="px-6 py-4 border-b border-cream-300 bg-cream-200 flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-terracotta">
              MACOS DICTATION CONFLICT
            </span>
            <p className="mt-1 font-serif text-[16px] leading-snug tracking-[-0.005em] text-ink">
              macOS Dictation steals <em className="italic text-terracotta">Ctrl + Space</em>.
            </p>
            <p className="mt-1 text-[12px] text-ink-soft leading-relaxed">
              Open <strong className="text-ink">System Settings → Keyboard → Dictation</strong> and change the shortcut to "Press 🌐 Key Twice" or Off.
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-full bg-ink text-cream px-4 py-2 text-[12px] font-medium border-none cursor-pointer hover:opacity-90"
            onClick={() => setDictationConflict(false)}
          >
            Dismiss
          </button>
        </div>
      )}

      {(engineBootPhase === "loading" || engineBootPhase === "warming") && (
        <div className="px-6 py-4 border-b border-cream-300 bg-cream-200 flex items-center gap-4">
          <div
            className="shrink-0 h-5 w-5 rounded-full border-2 border-ink/20 border-t-terracotta animate-spin"
            aria-hidden
          />
          <div className="flex-1 min-w-0">
            <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-terracotta">
              {engineBootPhase === "loading"
                ? "Setting up voice engine"
                : "Warming up"}
            </span>
            <p className="mt-1 font-serif text-[16px] leading-snug tracking-[-0.005em] text-ink">
              {engineBootPhase === "loading"
                ? "Loading the on-device speech model…"
                : "Almost ready — warming up the transcriber…"}
            </p>
            <p className="mt-1 text-[12px] text-ink-soft">
              The first launch after installing can take a few minutes. You can
              keep using the app — dictation unlocks automatically when this
              finishes.
            </p>
          </div>
        </div>
      )}

      {/* Body area: sidebar + content + right gutter */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - flows in layout, not fixed */}
        <Navigation
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab)}
          userEmail={user.email || ""}
          userName={user.user_metadata?.full_name || ""}
          isProUser={isProUser}
          onUpgradeClick={() => setUpgradeModalOpen(true)}
          appVersion={appVersion}
          updaterState={{
            checking: updater.checking,
            updateAvailable: updater.updateAvailable,
            downloading: updater.downloading,
            downloadProgress: updater.downloadProgress,
            readyToInstall: updater.readyToInstall,
            error: updater.error,
            updateInfo: updater.updateInfo,
          }}
          onCheckForUpdates={updater.checkForUpdates}
          onDownloadUpdate={updater.downloadAndInstall}
          onInstallUpdate={updater.installAndRelaunch}
        />

        {/* Center: content + bottom gutter */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Main scrollable content */}
          <main
            className={`flex-1 flex flex-col ${activeTab === "settings" ? "overflow-hidden" : "overflow-y-auto"} bg-cream`}
          >
            <div className="flex-1 flex flex-col min-h-0">
              {activeTab === "home" && user && (
                <HomeTab
                  userName={user.user_metadata?.full_name || ""}
                  userId={user.id}
                  localTranscripts={localTranscripts}
                  onDeleteTranscript={(id) => {
                    setLocalTranscripts((prev) => {
                      const updated = prev.filter((t) => t.id !== id);
                      saveSetting("localTranscripts", updated);
                      return updated;
                    });
                  }}
                  onClearAllTranscripts={() => {
                    setLocalTranscripts([]);
                    saveSetting("localTranscripts", []);
                  }}
                  onSaveAsScribble={async (transcript) => {
                    const { error } = await scribblesService.createScribble({
                      user_id: user.id,
                      title: buildFallbackScribbleTitle(transcript.text),
                      raw_text: transcript.text,
                      original_formatted_text: transcript.text,
                      edited_text: null,
                      // Carry the dictation routing context captured at record
                      // time onto the saved scribble, matching the Stream
                      // history path so metadata persists on every save path
                      // (and the ContextLabel badge renders on the scribble).
                      dictation_category: transcript.dictation_category ?? null,
                      dictation_variant: transcript.dictation_variant ?? null,
                      dictation_app_key: transcript.dictation_app_key ?? null,
                      dictation_context_source:
                        transcript.dictation_context_source ?? null,
                      dictation_prompt_version:
                        transcript.dictation_prompt_version ?? null,
                    });
                    if (error) throw error;
                    setScribbleRefreshKey((k) => k + 1);
                    setLocalTranscripts((prev) => {
                      const updated = prev.filter((t) => t.id !== transcript.id);
                      saveSetting("localTranscripts", updated);
                      return updated;
                    });
                  }}
                  onSubmitFeedback={async (transcript, feedback) => {
                    // Stream stays local until the user gives feedback. On
                    // submit we persist one row carrying the original
                    // transcript, the formatted text, and the feedback. Stream
                    // is signed-in-only, so record() always has a user_id.
                    const id = await streamsService.record({
                      raw_transcript: transcript.rawText ?? "",
                      formatted_text: transcript.text,
                      feedback,
                      app_key: transcript.dictation_app_key ?? null,
                      dictation_category:
                        transcript.dictation_category ?? null,
                      dictation_variant: transcript.dictation_variant ?? null,
                      dictation_context_source:
                        transcript.dictation_context_source ?? null,
                      dictation_prompt_version:
                        transcript.dictation_prompt_version ?? null,
                    });
                    if (!id) throw new Error("Failed to save feedback");
                  }}
                />
              )}

              {/* Kept mounted (hidden when inactive) rather than conditionally
                  rendered, so switching tabs mid-meeting never tears down the
                  recording draft/phase — the session keeps running and the user
                  returns to exactly where they left off. */}
              {user && (
                <div className={activeTab === "meetings" ? "flex flex-1 flex-col min-h-0" : "hidden"}>
                <MeetingsTab
                  isRecording={isMeetingRecording}
                  isPreparing={isMeetingPreparing}
                  modelDownloadState={meetingModel.downloadState}
                  modelDownloadProgress={meetingModel.progress}
                  modelDownloadError={meetingModel.error}
                  onAuthError={promptReauth}
                  onStartRecording={startMeetingRecording}
                  onStopRecording={stopMeetingRecording}
                  isMuted={isMeetingMuted}
                  onToggleMute={toggleMeetingMute}
                  isCapturingSystemAudio={isMeetingCapturingSystemAudio}
                  recordingTime={meetingRecordingTime}
                  transcript={meetingTranscript}
                  transcriptSegments={meetingTranscriptSegments}
                  meetingStartedAt={meetingStartedAt}
                  onClearTranscript={clearMeetingTranscript}
                  systemAudioWarning={systemAudioWarning}
                  googleCalendarToken={googleCalendarToken}
                  onConnectCalendar={connectGoogleCalendar}
                  onCalendarTokenInvalid={async () => {
                    const refreshState = await refreshCalendarToken();
                    if (refreshState === "needs_reconnect") {
                      await clearCalendarConnection();
                    }
                    return refreshState;
                  }}
                  savedMeetings={savedMeetings}
                  vocabularyTerms={dictWords}
                  onSaveMeeting={(meeting) => {
                    const updated = [meeting, ...savedMeetings.filter((m) => m.id !== meeting.id)];
                    setSavedMeetings(updated);
                    saveSetting("savedMeetings", updated);
                    if (user) {
                      meetingsService
                        .saveMeeting(meeting, user.id)
                        .then(({ data }) => {
                          // When the workspace has auto-publish on, the DB trigger
                          // mints a public share token at insert. Merge it back so
                          // the Minutes UI can surface the live /m/{token} link.
                          if (!data) return;
                          setSavedMeetings((prev) => {
                            const merged = prev.map((m) =>
                              m.id === meeting.id
                                ? {
                                    ...m,
                                    visibility: data.visibility,
                                    publicShareToken: data.publicShareToken,
                                    sharedWithOrg: data.visibility !== "private",
                                  }
                                : m,
                            );
                            saveSetting("savedMeetings", merged);
                            return merged;
                          });
                        })
                        .catch((e) => console.warn("[minutes] save failed:", e));
                    }
                  }}
                  onDeleteMeeting={(id) => {
                    const updated = savedMeetings.filter((m) => m.id !== id);
                    setSavedMeetings(updated);
                    saveSetting("savedMeetings", updated);
                    meetingsService.deleteMeeting(id).catch((e) => console.warn("[minutes] delete failed:", e));
                  }}
                  hostName={user.user_metadata?.full_name || ""}
                  hostEmail={user.email || ""}
                  minutesTranscriptionStatus={minutesTranscriptionStatus}
                  minutesSegmentQueue={minutesSegmentQueue}
                  minutesSegmentsCompleted={minutesSegmentsCompleted}
                  minutesSegmentsTotal={minutesSegmentsTotal}
                  minutesFailedSegments={minutesFailedSegments}
                />
                </div>
              )}

              {activeTab === "scribble" && user && (
                <ScribbleTab
                  userId={user.id}
                  refreshKey={scribbleRefreshKey}
                  isRecording={isScribbleRecording}
                  isProcessing={isScribbleProcessing}
                  statusMessage={scribbleStatus}
                  onToggleRecording={() => {
                    if (isScribbleProcessing) return;
                    if (isScribbleRecording) {
                      stopScribbleRecording();
                    } else {
                      void startScribbleRecording();
                    }
                  }}
                  onImportAudio={(file) => void importScribbleFromFile(file)}
                  recordingTime={scribbleRecordingTime}
                />
              )}

              {activeTab === "settings" && (
                <SettingsTab
                  transcriptionLanguage={transcriptionLanguage}
                  cleanupStyle={cleanupStyle}
                  onCleanupStyleChange={(style) => {
                    setCleanupStyle(style);
                    cleanupStyleRef.current = style;
                    saveSetting("cleanupStyle", style);
                    invoke("pill_push_settings", {
                      language: transcriptionLanguageRef.current,
                      autoPaste: autoPasteRef.current,
                      aiImprovement: aiImprovementEnabledRef.current,
                      cleanupStyle: style,
                      promptMode: promptModeRef.current,
                    }).catch(console.warn);
                  }}
                  promptMode={promptMode}
                  onPromptModeChange={(on) => {
                    setPromptMode(on);
                    promptModeRef.current = on;
                    saveSetting("promptMode", on);
                    invoke("pill_push_settings", {
                      language: transcriptionLanguageRef.current,
                      autoPaste: autoPasteRef.current,
                      aiImprovement: aiImprovementEnabledRef.current,
                      cleanupStyle: cleanupStyleRef.current,
                      promptMode: on,
                    }).catch(console.warn);
                  }}
                  onLanguageChange={(lang) => {
                    setTranscriptionLanguage(lang);
                    transcriptionLanguageRef.current = lang;
                    saveSetting("transcriptionLanguage", lang);
                    invoke("pill_push_settings", {
                      language: lang,
                      autoPaste: autoPasteRef.current,
                      aiImprovement: aiImprovementEnabledRef.current,
                      cleanupStyle: cleanupStyleRef.current,
                      promptMode: promptModeRef.current,
                    }).catch(console.warn);
                    // Model selection is language-aware: "hi-en" routes to the
                    // Oriserve Hinglish model, other languages to the general
                    // ladder. Prepare BOTH roles now so neither downloads the
                    // wrong model mid-recording (WS-C rule 2); reload whichever
                    // role is live, just download the other. Re-arm the
                    // Meetings-tab pre-download so it re-resolves for the new
                    // language on the next visit. Downloads stay serialized
                    // (dictation first) via modelDownloadQueueRef.
                    minutesPredownloadStartedRef.current = false;
                    void prepareWhisperModel("dictation", {
                      load: currentWhisperRoleRef.current === "dictation",
                      autoDownload: true,
                    }).catch((err) => {
                      console.warn(
                        "[whisper] language-change dictation prepare failed:",
                        err,
                      );
                    });
                    void prepareWhisperModel("minutes", {
                      load: currentWhisperRoleRef.current === "minutes",
                      autoDownload: true,
                    }).catch((err) => {
                      console.warn(
                        "[whisper] language-change minutes prepare failed:",
                        err,
                      );
                    });
                  }}
                  perfLogTranscripts={perfLogTranscripts}
                  onPerfLogTranscriptsChange={(enabled) => {
                    setPerfLogTranscripts(enabled);
                    perfLogTranscriptsRef.current = enabled;
                    saveSetting("perfLogTranscripts", enabled);
                  }}
                  onClearDiagnostics={() => {
                    invoke("clear_perf_log").catch((e) =>
                      console.warn("[perf] clear_perf_log failed:", e),
                    );
                  }}
                  selectedMicId={selectedMicId}
                  onMicChange={(id) => {
                    setSelectedMicId(id);
                    selectedMicIdRef.current = id;
                    saveSetting("selectedMicId", id);
                    // Reset warm stream and re-warm with new mic
                    if (warmStreamRef.current) {
                      warmStreamRef.current
                        .getTracks()
                        .forEach((t) => t.stop());
                      warmStreamRef.current = null;
                    }
                    voiceEngineWarmupRef.current = false;
                    void warmVoiceEngine(id);
                  }}
                  onClearData={async () => {
                    // WS-F + matrix row 4: never wipe data mid-pipeline.
                    if (isAnyPipelineBusyRef.current()) {
                      setStatus("Finish recording before clearing data.");
                      return;
                    }
                    // Order matters (invariant I9): cancel in-flight downloads
                    // and unload the resident context BEFORE removing the model
                    // bytes, so no .partial reappears and Windows holds no file
                    // lock. Rust owns the bytes, so a single clear_local_models
                    // recursively removes final files, .partial sidecars, and the
                    // legacy phi files — replacing the old FE path-string loop
                    // (which also broke on Windows '/' separators). Each step is
                    // best-effort; only the reload is unconditional.
                    try {
                      await invoke("cancel_model_downloads");
                    } catch (e) {
                      console.warn("[clear-data] cancel_model_downloads failed:", e);
                    }
                    try {
                      await invoke("unload_whisper_model");
                    } catch (e) {
                      console.warn("[clear-data] unload_whisper_model failed:", e);
                    }
                    try {
                      await invoke("clear_local_models");
                    } catch (e) {
                      console.warn("[clear-data] clear_local_models failed:", e);
                    }
                    // Privacy: perf.jsonl can hold raw + AI-cleaned transcripts
                    // when "Log transcripts to diagnostics" is on.
                    try {
                      await invoke("clear_perf_log");
                    } catch (e) {
                      console.warn("[clear-data] clear_perf_log failed:", e);
                    }
                    // Sign out locally so the desktop session clears even offline.
                    try {
                      await signOutLocally();
                    } catch (e) {
                      console.warn("[clear-data] signOutLocally failed:", e);
                    }
                    try {
                      const store = await getStore();
                      await store.clear();
                      await store.save();
                    } catch (e) {
                      console.warn("[clear-data] store clear failed:", e);
                    }
                    localStorage.clear();
                    window.location.reload();
                  }}
                  userEmail={user?.email}
                  userId={user?.id}
                  onSignOut={handleSignOut}
                  aiImprovementEnabled={aiImprovementEnabled}
                  onAiImprovementChange={handleAiImprovementChange}
                  contextAwareDictationEnabled={contextAwareDictationEnabled}
                  onContextAwareDictationChange={handleContextAwareDictationChange}
                  contextAwarePlatform={getDesktopPlatform()}
                  systemAudioSupported={systemAudioSupported}
                  systemAudioEnabled={systemAudioEnabled}
                  onSystemAudioToggle={handleSystemAudioToggle}
                  dictationModel={dictationModel}
                  meetingModel={meetingModel}
                  onModelPresetChange={handleModelPresetChange}
                  onModelRetry={(role) => {
                    void prepareWhisperModel(role, {
                      load: currentWhisperRoleRef.current === role,
                      autoDownload: true,
                    }).catch((err) =>
                      console.warn(`[whisper] retry ${role} failed:`, err),
                    );
                  }}
                  appVersion={appVersion}
                />
              )}
            </div>
          </main>

          {/* Bottom gutter */}
          <div className="h-3 bg-cream flex-shrink-0" />
        </div>

        {/* Right gutter */}
        <div className="w-3 bg-cream flex-shrink-0" />
      </div>

      {/* Update notification */}
      {!updateDismissed && (
        <UpdateNotification
          updateAvailable={updater.updateAvailable}
          downloading={updater.downloading}
          downloadProgress={updater.downloadProgress}
          readyToInstall={updater.readyToInstall}
          error={updater.error}
          updateInfo={updater.updateInfo}
          onDownload={updater.downloadAndInstall}
          onInstall={updater.installAndRelaunch}
          onDismiss={() => setUpdateDismissed(true)}
          onShowNotes={() => setReleaseNotesOpen(true)}
        />
      )}

      {/* Full release-notes modal */}
      <UpdateReleaseNotesModal
        open={releaseNotesOpen}
        version={updater.updateInfo?.version}
        currentVersion={updater.updateInfo?.currentVersion}
        body={updater.updateInfo?.body}
        readyToInstall={updater.readyToInstall}
        onClose={() => setReleaseNotesOpen(false)}
        onInstall={() => {
          setReleaseNotesOpen(false);
          if (updater.readyToInstall) {
            updater.installAndRelaunch();
          } else {
            updater.downloadAndInstall();
          }
        }}
        onDefer={() => setReleaseNotesOpen(false)}
      />

      {/* Upgrade modal — limit reached / Pro CTA. */}
      <UpgradeModal
        open={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        onUpgrade={() => {
          openUrl(`${import.meta.env.VITE_WEB_APP_URL ?? "https://oscar.samyarth.org"}/pricing`).catch(
            (err) => console.error("Failed to open pricing:", err),
          );
          setUpgradeModalOpen(false);
        }}
        onDefer={() => setUpgradeModalOpen(false)}
      />

      {/* Mid-session permission recovery — non-blocking overlay. */}
      <PermissionRecoveryModal
        open={permissionRecoveryOpen}
        permission={permissionRecoveryKind}
        onClose={() => setPermissionRecoveryOpen(false)}
      />

      {/* Background updater bg shim — keeps the cream chrome consistent. */}
    </div>
  );
}

export default App;
