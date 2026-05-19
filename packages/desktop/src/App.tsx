import { useState, useRef, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { meetingsService } from "./services/meetings.service";
import { aiService } from "./services/ai.service";
import { scribblesService } from "./services/scribbles.service";
import { emit, listen } from "@tauri-apps/api/event";
import { homeDir } from "@tauri-apps/api/path";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { Navigation } from "./components/Navigation";
import { Header } from "./components/Header";
import { ScribbleTab } from "./components/ScribbleTab";
import { SettingsTab } from "./components/SettingsTab";
import { UpdateNotification } from "./components/UpdateNotification";
import { useMinutesRecorder } from "./hooks/useMinutesRecorder";
import { useUpdater } from "./hooks/useUpdater";
import HomeTab from "./components/HomeTab";
import { MeetingsTab } from "./components/MeetingsTab";
import { AuthScreen } from "./components/onboarding/AuthScreen";
import { PermissionsScreen } from "./components/onboarding/PermissionsScreen";
import { SetupScreen } from "./components/onboarding/SetupScreen";
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
  HotkeyContextEventPayload,
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
import { buildInitialPrompt, getWhisperLanguage } from "./lib/whisper";
import {
  FALLBACK_MODELS,
  relativeModelPath,
  type ModelSpec,
  type ModelPreset as WhisperModelPreset,
  type WhisperModelVariant,
} from "./lib/whisper-models";
import {
  downloadModel,
  resolveModelForRole,
} from "./lib/whisper-model-manager";
import { getStore, loadSetting, saveSetting } from "./lib/store";
import "./App.css";

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
  const [_isProcessing, setIsProcessing] = useState(false);
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
  const [_dictWords, setDictWords] = useState<string[]>([]);
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
  const streamRef = useRef<MediaStream | null>(null);
  const autoPasteRef = useRef(true);
  const targetAppRef = useRef<string>("");
  const dictationContextRef = useRef<DictationContextSnapshot | null>(null);
  const pendingStopRef = useRef(false);
  const warmStreamRef = useRef<MediaStream | null>(null);
  const voiceEngineWarmupRef = useRef(false);
  const meterCtxRef = useRef<AudioContext | null>(null);
  const meterSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const meterAnalyserRef = useRef<AnalyserNode | null>(null);
  const meterRafRef = useRef<number | null>(null);
  const aiEditingRef = useRef(false);
  const transcriptionLanguageRef = useRef<string>("hi-en");
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
    recordingTime: meetingRecordingTime,
    transcript: meetingTranscript,
    transcriptSegments: meetingTranscriptSegments,
    startedAt: meetingStartedAt,
    transcriptionStatus: minutesTranscriptionStatus,
    segmentQueue: minutesSegmentQueue,
    segmentsCompleted: minutesSegmentsCompleted,
    segmentsTotal: minutesSegmentsTotal,
    systemAudioWarning,
    clearSystemAudioWarning,
    startRecording: startMeetingRecording,
    stopRecording: stopMeetingRecording,
    clearTranscript: clearMeetingTranscript,
  } = minutesRecorder;

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

        // Also check fragment (after #) for tokens
        if (urlObj.hash) {
          const fragmentParams = new URLSearchParams(urlObj.hash.substring(1));
          accessToken = accessToken || fragmentParams.get("access_token");
          refreshToken = refreshToken || fragmentParams.get("refresh_token");
          expiresIn = expiresIn || fragmentParams.get("expires_in");
        }

        if (error) {
          console.error("[deep-link] Auth error:", error);
          calendarOAuthInProgressRef.current = false;
        }

        if (accessToken && refreshToken) {
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

      // If setup is complete, verify that the Whisper model still loads.
      if (setupDone) {
        const loaded = await initWhisper();
        if (!loaded) {
          await saveSetting("setupComplete", false);
          setSetupComplete(false);
          return;
        }
        setSetupComplete(true);
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
        dictationContextRef.current = isSelfApp
          ? null
          : buildDictationContextSnapshot(ev.payload);
        pendingStopRef.current = false;
        if (whisperLoadedRef.current && !isRecordingRef.current) {
          hotkeyStartInFlightRef.current = true;
          void startHotkeyRecording().finally(() => {
            hotkeyStartInFlightRef.current = false;
          });
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
    });

    // When the pill window has wired its listeners, push current settings.
    const unlistenPillReady = listen("pill-ready", () => {
      invoke("pill_push_settings", {
        language: transcriptionLanguageRef.current,
        autoPaste: autoPasteRef.current,
        aiImprovement: aiImprovementEnabledRef.current,
      }).catch(console.warn);
    });

    return () => {
      unlistenStart.then((f) => f());
      unlistenStop.then((f) => f());
      unlistenErr.then((f) => f());
      unlistenReg.then((f) => f());
      unlistenPillSettings.then((f) => f());
      unlistenPillReady.then((f) => f());
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
      const mimeType = MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "audio/webm";
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
        const unlisten = await listen<DownloadProgress>(
          "download-progress",
          (event) => {
            syncDownloadProgress(spec.variant, event.payload.percentage);
          },
        );

        try {
          const path = await downloadModel(spec);
          syncDownloadProgress(spec.variant, 100);
          return path;
        } finally {
          unlisten();
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

      updateRoleModel(role, {
        preset,
        downloadState: "checking",
        progress: 0,
        error: null,
      });

      const { recommendation, resolved } = await resolveModelForRole(
        role,
        preset,
      );

      updateRoleModel(role, {
        recommendation,
        activeVariant: resolved?.variant ?? null,
        resolvedPath: resolved?.path ?? null,
        fallbackUsed: resolved?.fallbackUsed ?? false,
        downloadState: resolved ? "ready" : "idle",
      });

      let path = resolved?.path ?? null;
      const shouldDownloadRecommended =
        options.autoDownload !== false && (!path || resolved?.fallbackUsed);

      if (shouldDownloadRecommended) {
        updateRoleModel(role, {
          downloadState: "downloading",
          progress: 0,
          error: null,
        });

        try {
          path = await downloadRecommendedModel(recommendation.spec);
          updateRoleModel(role, {
            activeVariant: recommendation.spec.variant,
            resolvedPath: path,
            fallbackUsed: false,
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

          const retry = await resolveModelForRole(role, preset);
          if (retry.resolved) {
            path = retry.resolved.path;
            updateRoleModel(role, {
              recommendation: retry.recommendation,
              activeVariant: retry.resolved.variant,
              resolvedPath: retry.resolved.path,
              fallbackUsed: retry.resolved.fallbackUsed,
              downloadState: "ready",
              error: message,
            });
          }
        }
      }

      if (!path) {
        if (!options.load && options.autoDownload === false) {
          return { role, path: null };
        }
        throw new Error(
          role === "minutes"
            ? "Meeting model not found."
            : "Dictation model not found.",
        );
      }

      if (!options.load) {
        return { role, path };
      }

      await invoke("ensure_whisper_model_loaded", { role, path });
      const pathChanged = currentWhisperKeyRef.current !== path;
      if (pathChanged) {
        currentWhisperKeyRef.current = path;
        voiceEngineWarmupRef.current = false;
      }
      currentWhisperRoleRef.current = role;

      setWhisperLoadedAndRef(true);
      setWhisperModelPath(path);
      return { role, path };
    },
    [downloadRecommendedModel, updateRoleModel],
  );

  const ensureWhisperModelLoaded = useCallback(
    async (preferredRole: WhisperModelRole) =>
      prepareWhisperModel(preferredRole, { load: true, autoDownload: true }),
    [prepareWhisperModel],
  );

  canStartMeetingRecordingRef.current = () =>
    !isRecordingRef.current &&
    !isScribbleRecordingRef.current &&
    !isScribbleProcessingRef.current;
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
      await ensureWhisperModelLoaded("dictation");
      setStatus("Preparing voice engine...");
      void warmVoiceEngine().finally(() => {
        setStatus("Ready! Hold Ctrl+Space anywhere to record.");
      });
      return true;
    } catch {
      setWhisperLoadedAndRef(false);
      setStatus("Whisper model not found. Set the path in Settings.");
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
    if (
      isScribbleRecordingRef.current ||
      isScribbleProcessingRef.current ||
      isMeetingRecordingRef.current
    ) {
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

    streamRef.current = stream;
    const mimeType = MediaRecorder.isTypeSupported("audio/mp4")
      ? "audio/mp4"
      : "audio/webm";
    const mediaRecorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = mediaRecorder;
    audioChunksRef.current = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data);
    };
    mediaRecorder.onstop = () => {
      processAudio(stream, autoPasteRef.current, targetAppRef.current);
    };

    mediaRecorder.start(100);
    startAudioMeter(stream);
    isRecordingRef.current = true;
    setIsRecording(true);
    setStatus("Recording... Release to stop");
  };

  const stopHotkeyRecording = () => {
    isRecordingRef.current = false;
    setIsRecording(false);
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();
    }
    stopAudioMeter();
    // Switch pill to processing (dots) — don't hide yet
    invoke("set_pill_processing").catch(console.warn);
  };

  // ── Audio processing (shared by hotkey recording) ───────────────────────────

  const processAudio = async (
    _stream: MediaStream,
    shouldPaste: boolean,
    _targetApp?: string,   // used in paste_transcription for NSRunningApplication re-focus
  ) => {
    // ── Timing instrumentation (stream/dictation flow) ───────────────────────
    // Logs a single summary line at the end so we can spot which stage is slow.
    const tStart = performance.now();
    const timings: Record<string, number> = {};
    const metrics: Record<string, string | number> = {};
    let hadError = false;

    const chunkCount = audioChunksRef.current.length;
    const totalBytes = audioChunksRef.current.reduce((s, b) => s + b.size, 0);

    if (chunkCount === 0 || totalBytes === 0) {
      console.warn("[process] ABORT: no audio captured");
      setStatus("❌ No audio captured. Check microphone permission.");
      invoke("hide_recording_pill").catch(console.warn);
      return;
    }

    const mimeType = MediaRecorder.isTypeSupported("audio/mp4")
      ? "audio/mp4"
      : "audio/webm";
    const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

    if (audioBlob.size < 500) {
      setStatus(`❌ Blob too small (${audioBlob.size}B). Try again.`);
      invoke("hide_recording_pill").catch(console.warn);
      return;
    }

    setStatus(`Decoding ${(audioBlob.size / 1024).toFixed(0)}KB audio...`);
    const tDecode0 = performance.now();
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioContext = new AudioContext({ sampleRate: 16000 });
    let audioData: Float32Array;

    try {
      const decoded = await audioContext.decodeAudioData(arrayBuffer);
      const numChannels = decoded.numberOfChannels;
      const length = decoded.length;
      const mono = new Float32Array(length);
      for (let ch = 0; ch < numChannels; ch++) {
        const channel = decoded.getChannelData(ch);
        for (let i = 0; i < length; i++) mono[i] += channel[i] / numChannels;
      }
      audioData = mono;
    } catch (e) {
      setStatus(`❌ Decode failed (${mimeType}): ${e}`);
      invoke("hide_recording_pill").catch(console.warn);
      return;
    } finally {
      audioContext.close();
    }

    if (audioData.length < 1600) {
      setStatus(
        `❌ Too short (${audioData.length} samples). Speak for ≥1 second.`,
      );
      invoke("hide_recording_pill").catch(console.warn);
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
      setStatus("⚠️ No speech detected. Try speaking louder or closer.");
      invoke("hide_recording_pill").catch(console.warn);
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
      await ensureWhisperModelLoaded("dictation");
      timings["whisper-load"] = Math.round(performance.now() - tWhisperLoad0);
      metrics["cold-load"] = wasModelWarm ? "0" : "1";

      const tAudioArray0 = performance.now();
      const audioDataForIpc = Array.from(audioData);
      timings["audio-array"] = Math.round(performance.now() - tAudioArray0);

      const tWhisper0 = performance.now();
      const result = await invoke<Transcription>("transcribe_audio", {
        audioData: audioDataForIpc,
        initialPrompt: buildInitialPrompt(
          transcriptionLanguage,
          dictWordsRef.current,
        ),
        language: getWhisperLanguage(transcriptionLanguage, "dictation"),
      });
      timings["whisper-transcribe"] = Math.round(performance.now() - tWhisper0);

      // ── Per-stage metrics for offline analysis ─────────────────────────────
      // audio-sec is post-trim (what Whisper actually saw). rtf =
      // inference-ms / audio-ms — under 1.0 means faster than realtime.
      const audioSec = audioData.length / 16000;
      metrics["audio-sec"] = audioSec.toFixed(2);
      metrics["model"] = dictationModel.activeVariant ?? "unknown";
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
      let cleanupReturnedEmpty = false;

      // Silent AI cleanup via the backend AI function.
      // This now runs BEFORE paste so the AI-cleaned output is what gets pasted.
      if (aiCleanupEnabled) {
        setStatus("Improving with AI...");
        const tAi0 = performance.now();
        try {
          const cleaned = await aiService.processText(
            finalText,
            "transcribe_cleanup",
            {
              promptProfile: "stream",
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
          // Silently fall back to raw transcript — user never sees this
          console.warn(
            "[ai] silent cleanup failed, using raw transcript:",
            aiErr,
          );
        }
      }

      if (cleanupReturnedEmpty) {
        console.info("[process] AI cleanup returned empty — treating as silence");
        setStatus("⚠️ No speech detected. Try speaking louder or closer.");
        return;
      }

      // ── Auto-paste: do this AFTER AI cleanup ──────────────────────────────
      // Now that AI cleanup is complete, paste the improved text to the target app.
      if (shouldPaste) {
        const isMac = navigator.platform.toLowerCase().includes("mac");
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
          });
          timings["paste"] = Math.round(performance.now() - tPaste0);
          // User-felt latency: stop → paste-done. Excludes persistence work
          // that runs afterwards. This is the number that matches "how long
          // until my text shows up" for the user.
          metrics["paste-felt-ms"] = Math.round(performance.now() - tStart);
          if (pasteResult === "CLIPBOARD_ONLY") {
            // Accessibility not granted — text is in clipboard, guide user
            setStatus(
              isMac
                ? "📋 Copied! Grant Accessibility in System Settings for auto-paste, or press ⌘V."
                : "📋 Copied! Press Ctrl+V to paste.",
            );
          } else {
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

      const tPersist0 = performance.now();
      setTranscript((prev) => (prev ? prev + "\n\n" + finalText : finalText));

      // Add to local transcripts list for the HomeTab UI
      const newTranscript: LocalTranscript = {
        id: crypto.randomUUID(),
        text: finalText,
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

      if (!shouldPaste) {
        setStatus("Done! ✓");
      }
    } catch (e) {
      hadError = true;
      setStatus(`❌ Error: ${e}`);
      // Surface an error glyph on the pill briefly, then collapse to rest.
      invoke("set_pill_phase", { phase: "error" }).catch(console.warn);
      setTimeout(() => {
        invoke("hide_recording_pill").catch(console.warn);
      }, 1500);
    } finally {
      setIsProcessing(false);
      // Success path: show the "Inserted" toast for the design dwell, then
      // collapse the pill back to its resting edge handle.
      if (!hadError) {
        invoke("set_pill_phase", { phase: "inserted" }).catch(console.warn);
        setTimeout(() => {
          invoke("hide_recording_pill").catch(console.warn);
        }, 1500);
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
      try {
        const record = {
          ts: new Date().toISOString(),
          flow: "stream-dictation",
          platform: navigator.platform,
          userAgent: navigator.userAgent,
          hadError,
          totalMs,
          timings,
          metrics,
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

    const mimeType = MediaRecorder.isTypeSupported("audio/mp4")
      ? "audio/mp4"
      : "audio/webm";
    const audioBlob = new Blob(scribbleAudioChunksRef.current, { type: mimeType });

    if (audioBlob.size < 500) {
      setStatus("Scribble recording was too short. Try again.");
      finish("Recording was too short. Try again.");
      return;
    }

    setIsProcessing(true);
    setIsScribbleProcessing(true);
    setScribbleStatus("Transcribing…");
    setStatus("Transcribing Scribble...");

    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioContext = new AudioContext({ sampleRate: 16000 });
    let audioData: Float32Array;

    try {
      const decoded = await audioContext.decodeAudioData(arrayBuffer);
      const numChannels = decoded.numberOfChannels;
      const length = decoded.length;
      const mono = new Float32Array(length);
      for (let ch = 0; ch < numChannels; ch++) {
        const channel = decoded.getChannelData(ch);
        for (let i = 0; i < length; i++) mono[i] += channel[i] / numChannels;
      }
      audioData = mono;
    } catch (e) {
      setStatus(`Scribble decode failed (${mimeType}): ${e}`);
      finish(`Decode failed: ${e}`);
      return;
    } finally {
      audioContext.close();
    }

    if (audioData.length < 1600) {
      setStatus("Scribble recording was too short. Try again.");
      finish("Recording was too short. Try again.");
      return;
    }

    try {
      await ensureWhisperModelLoaded("dictation");
      const result = await invoke<Transcription>("transcribe_audio", {
        audioData: Array.from(audioData),
        initialPrompt: buildInitialPrompt(
          transcriptionLanguage,
          dictWordsRef.current,
        ),
        language: getWhisperLanguage(transcriptionLanguage, "dictation"),
      });

      const rawText = result.text?.trim() ?? "";
      if (!rawText) {
        setStatus("No speech detected. Try speaking louder or closer.");
        finish("No speech detected. Try again.");
        return;
      }

      let formattedText = rawText;
      let title = "";
      if (aiImprovementEnabledRef.current) {
        setScribbleStatus("Polishing…");
        setStatus("Polishing Scribble...");
        try {
          const formatted = await aiService.formatScribble(rawText);
          if (formatted.trim()) {
            formattedText = formatted.trim();
          }
        } catch (aiErr) {
          console.warn("[scribble] format failed, saving raw transcript:", aiErr);
        }

        setScribbleStatus("Titling…");
        try {
          title = await aiService.generateScribbleTitle(formattedText);
        } catch (titleErr) {
          console.warn("[scribble] title generation failed, using fallback:", titleErr);
        }
      }

      setScribbleStatus("Saving…");
      setStatus("Saving Scribble...");
      const { error } = await scribblesService.createScribble({
        user_id: user.id,
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

  const startScribbleRecording = async () => {
    if (
      isRecordingRef.current ||
      isMeetingRecordingRef.current ||
      isScribbleRecordingRef.current ||
      isScribbleProcessingRef.current
    ) {
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

    const mimeType = MediaRecorder.isTypeSupported("audio/mp4")
      ? "audio/mp4"
      : "audio/webm";
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
      setScribbleStatus("Processing…");
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

  // ── Subscription state ─────────────────────────────────────────────────────
  const [isProUser, setIsProUser] = useState(false);

  // Fetch subscription status when user changes
  useEffect(() => {
    if (!user) return;

    const fetchSubscription = async () => {
      try {
        const { data } = await supabase
          .from("subscriptions")
          .select("status")
          .eq("user_id", user.id)
          .maybeSingle();

        setIsProUser(data?.status === "active");
      } catch (e) {
        console.error("Failed to fetch subscription:", e);
        setIsProUser(false);
      }
    };

    fetchSubscription();
  }, [user]);

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
  if (!setupComplete) return <SetupScreen onComplete={handleSetupComplete} />;

  return (
    <div className="h-screen bg-white overflow-hidden flex flex-col font-['Figtree',-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif] text-slate-800">
      {/* Header - flows in layout, not fixed */}
      <Header
        userEmail={user.email || ""}
        onSignOut={handleSignOut}
        onSettingsClick={() => setActiveTab("settings")}
      />

      {hotkeyWarning && (
        <div className="px-4 py-3 border-b border-amber-200 bg-amber-50 flex items-center justify-between gap-3">
          <p className="text-sm text-amber-900 m-0">{hotkeyWarning}</p>
          <button
            type="button"
            className="text-sm font-medium text-amber-900 bg-white border border-amber-300 rounded-md px-3 py-1.5"
            onClick={() => retryHotkeyRegistration()}
          >
            Retry Hotkey
          </button>
        </div>
      )}

      {dictationConflict && (
        <div className="px-4 py-3 border-b border-amber-200 bg-amber-50 flex items-center justify-between gap-3">
          <p className="text-sm text-amber-900 m-0">
            macOS Dictation is set to &ldquo;Press Control Key Twice&rdquo;, which interferes with Ctrl+Space recording. Go to{" "}
            <strong>System Settings → Keyboard → Dictation</strong> and change the shortcut to &ldquo;Press 🌐 Key Twice&rdquo; or Off.
          </p>
          <button
            type="button"
            className="shrink-0 text-sm font-medium text-amber-900 bg-white border border-amber-300 rounded-md px-3 py-1.5"
            onClick={() => setDictationConflict(false)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Body area: sidebar + content + right gutter */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - flows in layout, not fixed */}
        <Navigation
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab)}
          userEmail={user.email || ""}
          isProUser={isProUser}
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
            className={`flex-1 flex flex-col ${activeTab === "settings" ? "overflow-hidden" : "overflow-y-auto"} bg-slate-50 rounded-tl-2xl`}
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
                />
              )}

              {activeTab === "meetings" && user && (
                <MeetingsTab
                  isRecording={isMeetingRecording}
                  onStartRecording={startMeetingRecording}
                  onStopRecording={stopMeetingRecording}
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
                  onSaveMeeting={(meeting) => {
                    const updated = [meeting, ...savedMeetings.filter((m) => m.id !== meeting.id)];
                    setSavedMeetings(updated);
                    saveSetting("savedMeetings", updated);
                    if (user) meetingsService.saveMeeting(meeting, user.id).catch((e) => console.warn("[minutes] save failed:", e));
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
                />
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
                  recordingTime={scribbleRecordingTime}
                />
              )}

              {activeTab === "settings" && (
                <SettingsTab
                  transcriptionLanguage={transcriptionLanguage}
                  onLanguageChange={(lang) => {
                    setTranscriptionLanguage(lang);
                    transcriptionLanguageRef.current = lang;
                    saveSetting("transcriptionLanguage", lang);
                    invoke("pill_push_settings", {
                      language: lang,
                      autoPaste: autoPasteRef.current,
                      aiImprovement: aiImprovementEnabledRef.current,
                    }).catch(console.warn);
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
                    try {
                      // Delete downloaded model files
                      const home = await homeDir();
                      const filesToDelete = [
                        ...Object.values(FALLBACK_MODELS).map(
                          (spec) => `${home}/${relativeModelPath(spec.variant)}`,
                        ),
                        // Legacy local AI model files (removed in favour of cloud AI)
                        `${home}/.oscar/models/phi-3.5-mini-Q4_K_M.gguf`,
                        `${home}/.oscar/models/phi-3.5-tokenizer.json`,
                      ];
                      for (const f of filesToDelete) {
                        try {
                          const exists = await invoke<boolean>(
                            "check_file_exists",
                            { path: f },
                          );
                          if (exists) await invoke("delete_file", { path: f });
                        } catch {
                          // best-effort cleanup
                        }
                      }
                    } catch {
                      // homeDir or invoke failed — continue with clearing
                    }

                    // Sign out of Supabase locally so the desktop session is
                    // always cleared even if the network is unavailable.
                    try {
                      await signOutLocally();
                    } catch {
                      // may already be signed out
                    }

                    // Clear all persisted settings
                    try {
                      const store = await getStore();
                      await store.clear();
                      await store.save();
                    } catch {
                      // clearing store failed — reload will reset state anyway
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
                />
              )}
            </div>
          </main>

          {/* Bottom gutter */}
          <div className="h-3 bg-white flex-shrink-0" />
        </div>

        {/* Right gutter */}
        <div className="w-3 bg-white flex-shrink-0" />
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
        />
      )}
    </div>
  );
}

export default App;
