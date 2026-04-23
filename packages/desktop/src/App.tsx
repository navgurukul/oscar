import { useState, useRef, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { meetingsService } from "./services/meetings.service";
import { aiService } from "./services/ai.service";
import { listen, emit } from "@tauri-apps/api/event";
import { homeDir } from "@tauri-apps/api/path";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { Navigation } from "./components/Navigation";
import { Header } from "./components/Header";
import { NotesTab } from "./components/NotesTab";
import { SettingsTab } from "./components/SettingsTab";
import { UpdateNotification } from "./components/UpdateNotification";
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
import type {
  CalendarReconnectResult,
  MinutesTranscriptionStatus,
} from "./components/MeetingsTab";
import type {
  MeetingTranscriptSegment,
  SavedMeetingRecord,
} from "./types/meeting.types";
import type {
  DictationContextSnapshot,
  LocalTranscript,
} from "./types/note.types";
import type {
  DownloadProgress,
  HotkeyContextEventPayload,
  MeetingSegmentJob,
  MinutesModelDownloadState,
  MinutesModelVariant,
  MicrophonePermissionState,
  TabType,
  TonePreset,
  Transcription,
  WhisperModelRole,
} from "./lib/app-types";
import {
  MEETING_SEGMENT_DURATION_MS,
  MINUTES_DATA_RESET_VERSION,
  MINUTES_MODEL_PATH,
  MINUTES_MODEL_URL,
  MINUTES_MODEL_VARIANT,
  MODEL_PATH,
  OLD_MODEL_PATH,
} from "./lib/desktop-constants";
import {
  buildDictationContextSnapshot,
  buildDictationMetadata,
  getDesktopPlatform,
  getMicrophonePermissionState,
  isMacOS,
} from "./lib/desktop-platform";
import {
  appendTranscriptSegment,
  buildTranscriptFromStructuredSegments,
  getTranscriptTailWords,
  mergeMeetingTranscriptSegments,
  toAbsoluteMeetingTranscriptSegments,
} from "./lib/transcript-utils";
import { buildInitialPrompt, getWhisperLanguage } from "./lib/whisper";
import { getStore, loadSetting, saveSetting } from "./lib/store";
import "./App.css";

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
  const [isRecording, setIsRecording] = useState(false);
  const [_transcript, setTranscript] = useState("");
  const [localTranscripts, setLocalTranscripts] = useState<LocalTranscript[]>(
    [],
  );
  const [_whisperLoaded, setWhisperLoaded] = useState(false);
  const [_status, setStatus] = useState("Initializing...");
  const [_isProcessing, setIsProcessing] = useState(false);
  const [hotkeyWarning, setHotkeyWarning] = useState("");

  // Settings panel
  const [_whisperModelPath, setWhisperModelPath] = useState("");
  const [_autoPaste, setAutoPaste] = useState(true);
  const [minutesModelEnabled, setMinutesModelEnabled] = useState(false);
  const [minutesModelPath, setMinutesModelPath] = useState("");
  const [minutesModelVariant, setMinutesModelVariant] =
    useState<MinutesModelVariant>(MINUTES_MODEL_VARIANT);
  const [minutesModelDownloadState, setMinutesModelDownloadState] =
    useState<MinutesModelDownloadState>("idle");
  const [minutesModelDownloadProgress, setMinutesModelDownloadProgress] =
    useState(0);

  // AI editing (legacy — kept for settings migration)
  const [_aiEditing, setAiEditing] = useState(false);
  const [_tonePreset, setTonePreset] = useState<TonePreset>("none");

  // AI Improvement toggle (user-controllable — controls Groq AI cleanup)
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

  // Meeting recording state (separate from hold-to-talk dictation)
  const [isMeetingRecording, setIsMeetingRecording] = useState(false);
  const [meetingRecordingTime, setMeetingRecordingTime] = useState(0);
  const [meetingTranscript, setMeetingTranscript] = useState("");
  const [meetingTranscriptSegments, setMeetingTranscriptSegments] = useState<
    MeetingTranscriptSegment[]
  >([]);
  const [meetingStartedAt, setMeetingStartedAt] = useState("");
  const [minutesTranscriptionStatus, setMinutesTranscriptionStatus] =
    useState<MinutesTranscriptionStatus>("idle");
  const [minutesSegmentQueue, setMinutesSegmentQueue] = useState(0);
  const [minutesSegmentsCompleted, setMinutesSegmentsCompleted] = useState(0);
  const [minutesSegmentsTotal, setMinutesSegmentsTotal] = useState(0);
  const meetingMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const meetingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const meetingSegmentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const meetingSegmentStopRef =
    useRef<((mode?: "rotate" | "final") => void) | null>(null);
  const meetingSessionIdRef = useRef(0);
  const meetingStopRequestedRef = useRef(false);
  const meetingNextSegmentIndexRef = useRef(0);
  const meetingSegmentQueueRef = useRef<MeetingSegmentJob[]>([]);
  const meetingSegmentWorkerRunningRef = useRef(false);
  const meetingTranscriptRef = useRef("");
  const meetingTranscriptSegmentsRef = useRef<MeetingTranscriptSegment[]>([]);
  const meetingStartedAtRef = useRef("");
  const meetingFinalizationResolveRef = useRef<(() => void) | null>(null);
  const meetingSessionUsesSystemAudioRef = useRef(false);

  // System audio capture (other participants' audio via ScreenCaptureKit)
  const [systemAudioSupported, setSystemAudioSupported] = useState(false);
  const [systemAudioEnabled, setSystemAudioEnabled] = useState(true);
  const [systemAudioWarning, setSystemAudioWarning] = useState("");
  const systemAudioActiveRef = useRef(false);

  // Personal dictionary (local state; synced to Supabase when logged in)
  const [_dictWords, setDictWords] = useState<string[]>([]);
  const [, setDictSyncing] = useState(false);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const whisperLoadedRef = useRef(false);
  const isRecordingRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const autoPasteRef = useRef(true);
  const targetAppRef = useRef<string>("");
  const dictationContextRef = useRef<DictationContextSnapshot | null>(null);
  const pendingStopRef = useRef(false);
  const warmStreamRef = useRef<MediaStream | null>(null);
  const voiceEngineWarmupRef = useRef(false);
  const aiEditingRef = useRef(false);
  const tonePresetRef = useRef<TonePreset>("none");
  const dictWordsRef = useRef<string[]>([]);
  const sessionRef = useRef<Session | null>(null);
  const authInitRef = useRef(false);
  const currentWhisperRoleRef = useRef<WhisperModelRole | null>(null);
  const currentWhisperKeyRef = useRef("");

  // Auto-updater
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const updater = useUpdater();
  const [appVersion, setAppVersion] = useState<string | null>(null);

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
        savedTone,
        savedAutoPaste,
        savedDict,
        permsDone,
        setupDone,
        savedTranscripts,
        savedLanguage,
        savedMicId,
        savedAiImprovement,
        savedContextAwareDictation,
        savedMinutesModelEnabled,
        savedMinutesModelPath,
        savedMinutesModelVariant,
        savedCalToken,
        savedCalRefreshToken,
        savedCalConnectedUserId,
        savedCalTokenExpiry,
        savedSystemAudioEnabled,
        savedMeetingsData,
        savedMinutesDataResetVersion,
      ] = await Promise.all([
        loadSetting<boolean>("aiEditing", false),
        loadSetting<TonePreset>("tonePreset", "none"),
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
        loadSetting<boolean>("minutesModelEnabled", false),
        loadSetting<string>("minutesModelPath", ""),
        loadSetting<MinutesModelVariant>("minutesModelVariant", MINUTES_MODEL_VARIANT),
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

      setPermissionsShown(nextPermissionsShown);
      if (!setupDone) {
        setSetupComplete(false);
      }
      setAiEditing(savedAiEditing);
      aiEditingRef.current = savedAiEditing;
      setTonePreset(savedTone);
      tonePresetRef.current = savedTone;
      setAutoPaste(savedAutoPaste);
      autoPasteRef.current = savedAutoPaste;
      setDictWords(savedDict);
      dictWordsRef.current = savedDict;
      setLocalTranscripts(savedTranscripts);
      setTranscriptionLanguage(savedLanguage);
      setSelectedMicId(savedMicId);
      selectedMicIdRef.current = savedMicId;
      setAiImprovementEnabled(savedAiImprovement);
      aiImprovementEnabledRef.current = savedAiImprovement;
      setContextAwareDictationEnabled(savedContextAwareDictation);
      contextAwareDictationEnabledRef.current = savedContextAwareDictation;
      const normalizedMinutesModelPath = savedMinutesModelPath || "";
      let hasMinutesModel = false;
      if (normalizedMinutesModelPath) {
        hasMinutesModel = await invoke<boolean>("check_file_exists", {
          path: normalizedMinutesModelPath,
        }).catch(() => false);
      }
      setMinutesModelEnabled(savedMinutesModelEnabled && hasMinutesModel);
      setMinutesModelPath(savedMinutesModelEnabled && hasMinutesModel ? normalizedMinutesModelPath : "");
      setMinutesModelVariant(savedMinutesModelVariant || MINUTES_MODEL_VARIANT);
      setMinutesModelDownloadState(
        savedMinutesModelEnabled && hasMinutesModel ? "installed" : "idle",
      );
      setMinutesModelDownloadProgress(0);
      if (savedMinutesModelEnabled && !hasMinutesModel) {
        void saveSetting("minutesModelEnabled", false);
        void saveSetting("minutesModelPath", "");
      }
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
        targetAppRef.current = isSelfApp
          ? ""
          : ev.payload?.targetAppName?.trim() || "";
        dictationContextRef.current = isSelfApp
          ? null
          : buildDictationContextSnapshot(ev.payload);
        pendingStopRef.current = false;
        if (whisperLoadedRef.current && !isRecordingRef.current)
          startHotkeyRecording();
      },
    );
    const unlistenStop = listen("hotkey-recording-stop", () => {
      // ALWAYS set pending stop — this is the safety net for the race condition
      // where STOP arrives before getUserMedia resolves in startHotkeyRecording
      pendingStopRef.current = true;
      // Switch pill to processing immediately — regardless of recorder state
      invoke("set_pill_processing").catch(console.warn);
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state === "recording"
      ) {
        isRecordingRef.current = false;
        setIsRecording(false);
        mediaRecorderRef.current.stop();
      }
    });
    const unlistenErr = listen<string>("hotkey-permission-error", (ev) => {
      setHotkeyWarning(ev.payload);
    });
    const unlistenReg = listen("hotkey-registered", () => setHotkeyWarning(""));

    return () => {
      unlistenStart.then((f) => f());
      unlistenStop.then((f) => f());
      unlistenErr.then((f) => f());
      unlistenReg.then((f) => f());
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

  const resolveDictationModelPath = useCallback(async (): Promise<string | null> => {
    let home: string;
    try {
      home = await homeDir();
    } catch {
      setStatus("Failed to get home directory.");
      return null;
    }

    const paths = [
      `${home}/.oscar/models/ggml-small.bin`,
      `${home}/.whisper/ggml-small.bin`,
      "./models/ggml-small.bin",
      "/usr/local/share/whisper/ggml-small.bin",
    ];

    for (const path of paths) {
      try {
        const exists = await invoke<boolean>("check_file_exists", { path });
        if (exists) return path;
      } catch {
        continue;
      }
    }

    return null;
  }, []);

  const resolveMinutesModelPath = useCallback(async (): Promise<string | null> => {
    if (!minutesModelEnabled) {
      return null;
    }

    let home: string;
    try {
      home = await homeDir();
    } catch {
      return null;
    }

    const candidates = [
      minutesModelPath,
      `${home}/${MINUTES_MODEL_PATH}`,
    ].filter(Boolean);

    for (const path of candidates) {
      try {
        const exists = await invoke<boolean>("check_file_exists", { path });
        if (exists) return path;
      } catch {
        continue;
      }
    }

    return null;
  }, [minutesModelEnabled, minutesModelPath]);

  const ensureWhisperModelLoaded = useCallback(async (preferredRole: WhisperModelRole) => {
    let role: WhisperModelRole = preferredRole;
    let path =
      preferredRole === "minutes"
        ? await resolveMinutesModelPath()
        : await resolveDictationModelPath();

    if (!path && preferredRole === "minutes") {
      role = "dictation";
      path = await resolveDictationModelPath();
    }

    if (!path) {
      throw new Error("Whisper model not found.");
    }

    await invoke("ensure_whisper_model_loaded", { role, path });
    const nextKey = `${role}:${path}`;
    if (currentWhisperKeyRef.current !== nextKey) {
      currentWhisperKeyRef.current = nextKey;
      currentWhisperRoleRef.current = role;
      voiceEngineWarmupRef.current = false;
    }

    setWhisperLoadedAndRef(true);
    setWhisperModelPath(path);
    return { role, path };
  }, [resolveDictationModelPath, resolveMinutesModelPath]);

  const initWhisper = async () => {
    try {
      const { path } = await ensureWhisperModelLoaded("dictation");
      setStatus("Preparing voice engine...");
      void warmVoiceEngine().finally(() => {
        setStatus("Ready! Hold Ctrl+Space anywhere to record.");
      });
      setWhisperModelPath(path);
      return true;
    } catch {
      setWhisperLoadedAndRef(false);
      setStatus("Whisper model not found. Set the path in Settings.");
      return false;
    }
  };

  // ── Hotkey recording ───────────────────────────────────────────────────────

  const startHotkeyRecording = async () => {
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
    // Switch pill to processing (dots) — don't hide yet
    invoke("set_pill_processing").catch(console.warn);
  };

  // ── Audio processing (shared by hotkey recording) ───────────────────────────

  const processAudio = async (
    _stream: MediaStream,
    shouldPaste: boolean,
    _targetApp?: string,   // used in paste_transcription for NSRunningApplication re-focus
  ) => {
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

    const durationSec = (audioData.length / 16000).toFixed(1);
    setIsProcessing(true);
    setStatus(`Transcribing ${durationSec}s...`);

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

      if (!result.text) {
        console.warn("[process] ABORT: no speech detected");
        setStatus("⚠️ No speech detected. Try speaking louder or closer.");
        return;
      }

      let finalText = result.text;
      const activeDictationContext =
        contextAwareDictationEnabledRef.current
          ? dictationContextRef.current
          : null;
      const dictationRouting =
        contextAwareDictationEnabledRef.current
          ? routeDictationContext(activeDictationContext)
          : null;
      const dictationMetadata = buildDictationMetadata(dictationRouting);

      // Silent AI cleanup via the backend AI function.
      // This now runs BEFORE paste so the AI-cleaned output is what gets pasted.
      if (aiImprovementEnabledRef.current) {
        setStatus("Improving with AI...");
        try {
          const cleaned = await aiService.processText(
            finalText,
            "transcribe_cleanup",
            activeDictationContext && dictationRouting
              ? {
                  context: activeDictationContext,
                  routing: dictationRouting,
                }
              : undefined,
          );
          if (cleaned && cleaned.trim().length > 0) {
            finalText = cleaned;
          }
        } catch (aiErr) {
          // Silently fall back to raw transcript — user never sees this
          console.warn(
            "[ai] silent cleanup failed, using raw transcript:",
            aiErr,
          );
        }
      }

      // ── Auto-paste: do this AFTER AI cleanup ──────────────────────────────
      // Now that AI cleanup is complete, paste the improved text to the target app.
      if (shouldPaste) {
        const isMac = navigator.platform.toLowerCase().includes("mac");
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
          console.error("[paste] FAILED:", pe);
          setStatus(
            isMac
              ? "📋 Copied to clipboard. Press ⌘V to paste."
              : "📋 Copied to clipboard. Press Ctrl+V to paste.",
          );
        }
      }

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

      if (!shouldPaste) {
        setStatus("Done! ✓");
      }
    } catch (e) {
      setStatus(`❌ Error: ${e}`);
    } finally {
      setIsProcessing(false);
      // Hide the pill now that processing is complete
      invoke("hide_recording_pill").catch(console.warn);
    }

    // Don't stop the stream — keep it warm for next recording
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

  // ── Meeting recording (click to start/stop, no auto-paste) ──────────────

  const resetMeetingPipelineState = () => {
    if (meetingTimerRef.current) {
      clearInterval(meetingTimerRef.current);
      meetingTimerRef.current = null;
    }
    if (meetingSegmentTimerRef.current) {
      clearTimeout(meetingSegmentTimerRef.current);
      meetingSegmentTimerRef.current = null;
    }
    meetingSegmentQueueRef.current = [];
    meetingSegmentWorkerRunningRef.current = false;
    meetingTranscriptRef.current = "";
    meetingTranscriptSegmentsRef.current = [];
    meetingStartedAtRef.current = "";
    meetingNextSegmentIndexRef.current = 0;
    meetingStopRequestedRef.current = false;
    meetingFinalizationResolveRef.current = null;
    meetingSegmentStopRef.current = null;
    meetingSessionUsesSystemAudioRef.current = false;
    systemAudioActiveRef.current = false;
    meetingMediaRecorderRef.current = null;
    setMeetingTranscript("");
    setMeetingTranscriptSegments([]);
    setMeetingStartedAt("");
    setMeetingRecordingTime(0);
    setMinutesSegmentQueue(0);
    setMinutesSegmentsCompleted(0);
    setMinutesSegmentsTotal(0);
    setMinutesTranscriptionStatus("idle");
  };

  const maybeCompleteMeetingFinalization = () => {
    if (!meetingStopRequestedRef.current) return;
    if (
      meetingMediaRecorderRef.current &&
      meetingMediaRecorderRef.current.state === "recording"
    ) {
      return;
    }
    if (meetingSegmentQueueRef.current.length > 0) return;
    if (meetingSegmentWorkerRunningRef.current) return;

    systemAudioActiveRef.current = false;
    setMinutesSegmentQueue(0);
    setMinutesTranscriptionStatus("notes");
    meetingFinalizationResolveRef.current?.();
    meetingFinalizationResolveRef.current = null;
  };

  const processMeetingSegmentQueue = async () => {
    if (meetingSegmentWorkerRunningRef.current) return;
    meetingSegmentWorkerRunningRef.current = true;

    while (meetingSegmentQueueRef.current.length > 0) {
      const job = meetingSegmentQueueRef.current.shift();
      if (!job) break;

      setMinutesSegmentQueue(meetingSegmentQueueRef.current.length);
      if (!meetingStopRequestedRef.current) {
        setMinutesTranscriptionStatus("transcribing");
      }

      try {
        const bytes = Array.from(new Uint8Array(await job.blob.arrayBuffer()));
        const result = await invoke<Transcription>(
          "transcribe_meeting_segment_bytes",
          {
            bytes,
            ext: job.ext,
            useSystemAudio: job.useSystemAudio,
            initialPrompt: buildInitialPrompt(
              transcriptionLanguage,
              dictWordsRef.current,
            ),
            language: getWhisperLanguage(transcriptionLanguage, "minutes"),
            segmentIndex: job.segmentIndex,
            previousTailText: getTranscriptTailWords(
              meetingTranscriptRef.current,
              30,
            ),
          },
        );

        if (result.segments && result.segments.length > 0) {
          const absoluteSegments = toAbsoluteMeetingTranscriptSegments(
            job,
            result.segments,
          );
          const mergedSegments = mergeMeetingTranscriptSegments(
            meetingTranscriptSegmentsRef.current,
            absoluteSegments,
          );
          meetingTranscriptSegmentsRef.current = mergedSegments;
          setMeetingTranscriptSegments(mergedSegments);

          const nextTranscript =
            buildTranscriptFromStructuredSegments(mergedSegments);
          meetingTranscriptRef.current = nextTranscript;
          setMeetingTranscript(nextTranscript);
        } else if (result.text) {
          const nextTranscript = appendTranscriptSegment(
            meetingTranscriptRef.current,
            result.text,
          );
          meetingTranscriptRef.current = nextTranscript;
          setMeetingTranscript(nextTranscript);
        }
      } catch (e) {
        console.error("[meeting] segment transcription failed:", e);
      } finally {
        setMinutesSegmentsCompleted((prev) => prev + 1);
      }
    }

    meetingSegmentWorkerRunningRef.current = false;

    if (meetingStopRequestedRef.current) {
      maybeCompleteMeetingFinalization();
      return;
    }

    if (
      meetingMediaRecorderRef.current &&
      meetingMediaRecorderRef.current.state === "recording"
    ) {
      setMinutesTranscriptionStatus("recording");
    } else {
      setMinutesTranscriptionStatus("idle");
    }
  };

  const queueMeetingSegment = (job: MeetingSegmentJob) => {
    meetingSegmentQueueRef.current.push(job);
    setMinutesSegmentQueue(meetingSegmentQueueRef.current.length);
    setMinutesSegmentsTotal((prev) => Math.max(prev, job.segmentIndex + 1));
    if (!meetingStopRequestedRef.current) {
      setMinutesTranscriptionStatus("transcribing");
    }
    void processMeetingSegmentQueue();
  };

  const startMeetingSegmentRecorder = (sessionId: number) => {
    const stream = warmStreamRef.current;
    if (!stream) return;

    const useMp4 = MediaRecorder.isTypeSupported("audio/mp4");
    const mimeType = useMp4 ? "audio/mp4" : "audio/webm";
    const ext = useMp4 ? "mp4" : "webm";
    const segmentIndex = meetingNextSegmentIndexRef.current;
    const segmentUsesSystemAudio = meetingSessionUsesSystemAudioRef.current;
    meetingNextSegmentIndexRef.current += 1;
    const segmentStartedAtMs = Date.now();
    if (segmentIndex === 0) {
      const startedAt = new Date(segmentStartedAtMs).toISOString();
      meetingStartedAtRef.current = startedAt;
      setMeetingStartedAt(startedAt);
    }

    const chunks: Blob[] = [];
    let stopMode: "rotate" | "final" | null = null;
    let rotationPromise: Promise<void> = Promise.resolve();
    let segmentEndedAtMs = segmentStartedAtMs;

    const mediaRecorder = new MediaRecorder(stream, { mimeType });
    meetingMediaRecorderRef.current = mediaRecorder;
    meetingSegmentStopRef.current = (mode = "final") => {
      if (mediaRecorder.state !== "recording") return;
      if (meetingSegmentTimerRef.current) {
        clearTimeout(meetingSegmentTimerRef.current);
        meetingSegmentTimerRef.current = null;
      }

      stopMode = mode;
      segmentEndedAtMs = Date.now();
      rotationPromise = segmentUsesSystemAudio
        ? invoke("rotate_meeting_system_audio_segment", {
            segmentIndex,
            restartCapture: mode === "rotate",
          })
            .then(() => undefined)
            .catch((err) => {
              console.warn("[meeting] system audio segment rotation failed:", err);
              meetingSessionUsesSystemAudioRef.current = false;
              systemAudioActiveRef.current = false;
            })
        : Promise.resolve();

      mediaRecorder.stop();
    };

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      window.setTimeout(async () => {
        await rotationPromise;

        const shouldContinue =
          stopMode === "rotate" &&
          !meetingStopRequestedRef.current &&
          meetingSessionIdRef.current === sessionId;

        if (shouldContinue) {
          startMeetingSegmentRecorder(sessionId);
        }

        if (meetingMediaRecorderRef.current === mediaRecorder) {
          meetingMediaRecorderRef.current = null;
        }
        if (meetingSegmentStopRef.current && stopMode === "final") {
          meetingSegmentStopRef.current = null;
        }

        const audioBlob = new Blob(chunks, { type: mimeType });
        if (audioBlob.size >= 500) {
          queueMeetingSegment({
            blob: audioBlob,
            ext,
            segmentIndex,
            useSystemAudio: segmentUsesSystemAudio,
            startedAtMs: segmentStartedAtMs,
            endedAtMs: Math.max(segmentEndedAtMs, segmentStartedAtMs + 1),
          });
        }

        maybeCompleteMeetingFinalization();
      }, 0);
    };

    mediaRecorder.start();
    setMinutesTranscriptionStatus("recording");
    meetingSegmentTimerRef.current = setTimeout(() => {
      if (meetingSessionIdRef.current !== sessionId || meetingStopRequestedRef.current) {
        return;
      }
      meetingSegmentStopRef.current?.("rotate");
    }, MEETING_SEGMENT_DURATION_MS);
  };

  const startMeetingRecording = async () => {
    setSystemAudioWarning("");
    resetMeetingPipelineState();

    try {
      await ensureWhisperModelLoaded("minutes");
      await warmVoiceEngine();
    } catch (e) {
      console.error("[meeting-record] failed to prepare Whisper model:", e);
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
        console.error("[meeting-record] getUserMedia failed:", e);
        return;
      }
    }
    meetingSessionIdRef.current += 1;
    const sessionId = meetingSessionIdRef.current;
    meetingStopRequestedRef.current = false;
    meetingTranscriptRef.current = "";
    await invoke("clear_meeting_segment_buffers").catch((err) => {
      console.warn("[meeting-record] failed to clear segment buffers:", err);
    });

    // Start system audio capture (ScreenCaptureKit on macOS) in parallel with mic
    if (systemAudioEnabled && systemAudioSupported) {
      try {
        await invoke("start_system_audio_capture");
        systemAudioActiveRef.current = true;
        meetingSessionUsesSystemAudioRef.current = true;
        setSystemAudioWarning("");
        console.log("[meeting-record] System audio capture started");
      } catch (e) {
        console.warn("[meeting-record] System audio capture failed, mic only:", e);
        systemAudioActiveRef.current = false;
        meetingSessionUsesSystemAudioRef.current = false;
        const reason = String(e).replace(/^Error:\s*/i, "");
        setSystemAudioWarning(
          `${reason} Meeting recording will continue with your microphone only.`,
        );
      }
    } else {
      systemAudioActiveRef.current = false;
      meetingSessionUsesSystemAudioRef.current = false;
      setSystemAudioWarning("");
    }

    setIsMeetingRecording(true);
    setMeetingRecordingTime(0);
    setMeetingTranscript("");
    setMinutesTranscriptionStatus("recording");
    meetingTimerRef.current = setInterval(() => {
      setMeetingRecordingTime((prev) => prev + 1);
    }, 1000);
    startMeetingSegmentRecorder(sessionId);
  };

  const stopMeetingRecording = () => {
    setIsMeetingRecording(false);
    meetingStopRequestedRef.current = true;
    setMinutesTranscriptionStatus("finalizing");

    if (meetingTimerRef.current) {
      clearInterval(meetingTimerRef.current);
      meetingTimerRef.current = null;
    }
    if (meetingSegmentTimerRef.current) {
      clearTimeout(meetingSegmentTimerRef.current);
      meetingSegmentTimerRef.current = null;
    }

    if (meetingSegmentStopRef.current) {
      meetingSegmentStopRef.current("final");
      return;
    }

    if (systemAudioActiveRef.current) {
      void invoke("stop_system_audio_capture").catch((err) => {
        console.warn("[meeting] failed to stop system audio capture:", err);
      });
      systemAudioActiveRef.current = false;
    }
    maybeCompleteMeetingFinalization();
  };

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
      setSystemAudioWarning("");
    }
  }, []);

  const handleDownloadMinutesModel = useCallback(async () => {
    if (minutesModelDownloadState === "downloading") return;

    setMinutesModelDownloadState("downloading");
    setMinutesModelDownloadProgress(0);

    const unlisten = await listen<DownloadProgress>(
      "download-progress",
      (event) => {
        setMinutesModelDownloadProgress(event.payload.percentage);
      },
    );

    try {
      const home = await homeDir();
      const fullPath = `${home}/${MINUTES_MODEL_PATH}`;

      await invoke("download_whisper_model", {
        url: MINUTES_MODEL_URL,
        path: fullPath,
      });

      setMinutesModelEnabled(true);
      setMinutesModelPath(fullPath);
      setMinutesModelVariant(MINUTES_MODEL_VARIANT);
      setMinutesModelDownloadState("installed");
      setMinutesModelDownloadProgress(100);
      await Promise.all([
        saveSetting("minutesModelEnabled", true),
        saveSetting("minutesModelPath", fullPath),
        saveSetting("minutesModelVariant", MINUTES_MODEL_VARIANT),
      ]);

      if (activeTab === "meetings") {
        await ensureWhisperModelLoaded("minutes");
        await warmVoiceEngine();
      }
    } catch (err) {
      console.error("[minutes-model] download failed:", err);
      setMinutesModelDownloadState(minutesModelEnabled ? "installed" : "idle");
      setMinutesModelDownloadProgress(0);
    } finally {
      unlisten();
    }
  }, [
    activeTab,
    ensureWhisperModelLoaded,
    minutesModelDownloadState,
    minutesModelEnabled,
  ]);

  const handleRemoveMinutesModel = useCallback(async () => {
    if (!minutesModelPath) return;

    try {
      const exists = await invoke<boolean>("check_file_exists", {
        path: minutesModelPath,
      });
      if (exists) {
        await invoke("delete_file", { path: minutesModelPath });
      }
    } catch (err) {
      console.warn("[minutes-model] remove failed:", err);
    }

    setMinutesModelEnabled(false);
    setMinutesModelPath("");
    setMinutesModelDownloadProgress(0);
    setMinutesModelDownloadState("idle");
    await Promise.all([
      saveSetting("minutesModelEnabled", false),
      saveSetting("minutesModelPath", ""),
    ]);

    if (currentWhisperRoleRef.current === "minutes") {
      try {
        await ensureWhisperModelLoaded("dictation");
        await warmVoiceEngine();
      } catch (err) {
        console.warn("[minutes-model] failed to fall back to dictation model:", err);
      }
    }
  }, [ensureWhisperModelLoaded, minutesModelPath]);

  useEffect(() => {
    if (!setupComplete) return;

    if (activeTab === "meetings") {
      void ensureWhisperModelLoaded("minutes")
        .then(() => warmVoiceEngine())
        .catch((err) => console.warn("[whisper] failed to prepare Minutes model:", err));
      return;
    }

    if (currentWhisperRoleRef.current === "minutes") {
      void ensureWhisperModelLoaded("dictation")
        .then(() => warmVoiceEngine())
        .catch((err) => console.warn("[whisper] failed to restore dictation model:", err));
    }
  }, [activeTab, ensureWhisperModelLoaded, setupComplete]);

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
                  onClearTranscript={() => {
                    meetingTranscriptRef.current = "";
                    meetingTranscriptSegmentsRef.current = [];
                    meetingStartedAtRef.current = "";
                    setMeetingTranscript("");
                    setMeetingTranscriptSegments([]);
                    setMeetingStartedAt("");
                    setMinutesSegmentQueue(0);
                    setMinutesSegmentsCompleted(0);
                    setMinutesSegmentsTotal(0);
                    setMinutesTranscriptionStatus("idle");
                  }}
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
                  minutesTranscriptionStatus={minutesTranscriptionStatus}
                  minutesSegmentQueue={minutesSegmentQueue}
                  minutesSegmentsCompleted={minutesSegmentsCompleted}
                  minutesSegmentsTotal={minutesSegmentsTotal}
                />
              )}

              {activeTab === "notes" && user && (
                <NotesTab
                  userId={user.id}
                  isRecording={isRecording}
                  onToggleRecording={() => {
                    if (isRecording) {
                      stopHotkeyRecording();
                    } else {
                      startHotkeyRecording();
                    }
                  }}
                  recordingTime={0}
                />
              )}

              {activeTab === "settings" && (
                <SettingsTab
                  transcriptionLanguage={transcriptionLanguage}
                  onLanguageChange={(lang) => {
                    setTranscriptionLanguage(lang);
                    saveSetting("transcriptionLanguage", lang);
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
                        `${home}/${MODEL_PATH}`,
                        `${home}/${OLD_MODEL_PATH}`,
                        `${home}/${MINUTES_MODEL_PATH}`,
                        // Legacy local AI model files (removed in favour of Groq)
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
                  minutesModelEnabled={minutesModelEnabled}
                  minutesModelDownloadState={minutesModelDownloadState}
                  minutesModelDownloadProgress={minutesModelDownloadProgress}
                  minutesModelVariant={minutesModelVariant}
                  onDownloadMinutesModel={handleDownloadMinutesModel}
                  onRemoveMinutesModel={handleRemoveMinutesModel}
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
