import React, { useState, useRef, useEffect, useCallback, memo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { notesService } from "./services/notes.service";
import { listen } from "@tauri-apps/api/event";
import { homeDir } from "@tauri-apps/api/path";
import { getVersion } from "@tauri-apps/api/app";
import { load } from "@tauri-apps/plugin-store";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { SparklesCore } from "@/components/ui/sparkles";
import { Cover } from "@/components/ui/cover";
import { Navigation } from "./components/Navigation";
import { Header } from "./components/Header";
import { NotesTab } from "./components/NotesTab";
import { SettingsTab } from "./components/SettingsTab";
import { UpdateNotification } from "./components/UpdateNotification";
import { useUpdater } from "./hooks/useUpdater";
import HomeTab from "./components/HomeTab";
import { MeetingsTab, DEFAULT_TEMPLATES } from "./components/MeetingsTab";
import type { MeetingTemplateData, SavedMeeting } from "./components/MeetingsTab";
import type { LocalTranscript } from "./types/note.types";
import "./App.css";

type TabType = "home" | "meetings" | "notes" | "vocabulary" | "billing" | "settings";

interface Transcription {
  text: string;
  error?: string;
}

type TonePreset = "none" | "professional" | "casual" | "friendly";
type MicrophonePermissionState = "granted" | "denied" | "prompt" | "unknown";

// ── Persistent store helpers ──────────────────────────────────────────────────

async function getStore() {
  return load("app-settings.json", { defaults: {} });
}

async function loadSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    const store = await getStore();
    const val = await store.get<T>(key);
    return val !== undefined && val !== null ? val : fallback;
  } catch {
    return fallback;
  }
}

async function saveSetting<T>(key: string, value: T): Promise<void> {
  try {
    const store = await getStore();
    await store.set(key, value);
    await store.save(); // flush to disk immediately — set() is in-memory only
  } catch (e) {
    console.warn("[store] save failed:", e);
  }
}

function isMacOS() {
  return navigator.platform.toLowerCase().includes("mac");
}

async function getMicrophonePermissionState(): Promise<MicrophonePermissionState> {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) {
    return "unknown";
  }

  try {
    const result = await navigator.permissions.query({
      name: "microphone" as PermissionName,
    });
    return result.state;
  } catch {
    return "unknown";
  }
}

// ── Step Indicator ────────────────────────────────────────────────────────────

function StepIndicator({
  currentStep,
}: {
  currentStep: "signin" | "permissions" | "setup";
}) {
  const steps = [
    { id: "signin", label: "SIGN IN" },
    { id: "permissions", label: "PERMISSIONS" },
    { id: "setup", label: "SET UP" },
  ];

  const currentIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <div className="step-indicator">
      {steps.map((step, index) => (
        <React.Fragment key={step.id}>
          <div className={`step-item ${index <= currentIndex ? "active" : ""}`}>
            <span className="step-label">{step.label}</span>
          </div>
          {index < steps.length - 1 && (
            <svg
              className="step-arrow"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Memoized Sparkles Background ───────────────────────────────────────────────

const MemoizedSparkles = memo(() => (
  <div className="sparkles-container">
    <SparklesCore
      background="transparent"
      minSize={0.4}
      maxSize={1}
      particleDensity={100}
      className="w-full h-full"
      particleColor="#FFFFFF"
    />
  </div>
));

// ── Cover Showcase ─────────────────────────────────────────────────────────────

function CoverShowcase() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const totalSlides = 3;

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % totalSlides);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="cover-showcase">
      <MemoizedSparkles />

      {/* Slide 1: Speed */}
      <div className={`cover-slide ${currentSlide === 0 ? "active" : ""}`}>
        <div className="cover-content">
          <p className="cover-subtitle">Using OSCAR</p>
          <h2 className="cover-title">4x faster than typing</h2>
          <div className="cover-highlight">
            <span className="cover-speed">220 wpm</span>
          </div>
          <div className="cover-demo-text">
            <p>
              "Just started with the project, how would you like to set up the
              file? Here are a few options..."
            </p>
          </div>
          <div className="cover-waveform">
            <div className="waveform-bar" />
            <div className="waveform-bar" />
            <div className="waveform-bar" />
            <div className="waveform-bar" />
            <div className="waveform-bar" />
            <div className="waveform-bar" />
            <div className="waveform-bar" />
            <div className="waveform-bar" />
          </div>
        </div>
      </div>

      {/* Slide 2: Warp Speed */}
      <div className={`cover-slide ${currentSlide === 1 ? "active" : ""}`}>
        <div className="cover-content">
          <p className="cover-subtitle">Experience the future</p>
          <h2 className="cover-title warp-title">
            Write at <Cover>warp speed</Cover>
          </h2>
          <div className="cover-highlight">
            <span className="cover-speed">AI-powered</span>
          </div>
          <div className="cover-demo-text">
            <p>
              Transform your thoughts into text instantly. Just speak naturally
              and let OSCAR do the rest.
            </p>
          </div>
          <div className="cover-waveform">
            <div className="waveform-bar" />
            <div className="waveform-bar" />
            <div className="waveform-bar" />
            <div className="waveform-bar" />
            <div className="waveform-bar" />
            <div className="waveform-bar" />
            <div className="waveform-bar" />
            <div className="waveform-bar" />
          </div>
        </div>
      </div>

      {/* Slide 3: Anywhere */}
      <div className={`cover-slide ${currentSlide === 2 ? "active" : ""}`}>
        <div className="cover-content">
          <p className="cover-subtitle">Works everywhere</p>
          <h2 className="cover-title">Use in any app</h2>
          <div className="cover-highlight">
            <span className="cover-speed">Global shortcut</span>
          </div>
          <div className="cover-demo-text">
            <p>
              Hold <kbd>Ctrl</kbd>+<kbd>Space</kbd> to start dictating. Works in
              Slack, Notion, VS Code, and everywhere else.
            </p>
          </div>
          <div className="cover-waveform">
            <div className="waveform-bar" />
            <div className="waveform-bar" />
            <div className="waveform-bar" />
            <div className="waveform-bar" />
            <div className="waveform-bar" />
            <div className="waveform-bar" />
            <div className="waveform-bar" />
            <div className="waveform-bar" />
          </div>
        </div>
      </div>

      {/* Slide Indicators */}
      <div className="slide-indicators">
        {Array.from({ length: totalSlides }).map((_, index) => (
          <button
            key={index}
            className={`slide-dot ${currentSlide === index ? "active" : ""}`}
            onClick={() => setCurrentSlide(index)}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

// ── Auth Screen ───────────────────────────────────────────────────────────────

function AuthScreen({ onAuth }: { onAuth: (session: Session) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [oauthState, setOauthState] = useState<{
    verifier: string;
    url: string;
  } | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll for session when OAuth is in progress
  useEffect(() => {
    if (oauthState) {
      // Start polling for session
      pollingRef.current = setInterval(async () => {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session) {
            // Session found, stop polling and authenticate
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }
            setOauthState(null);
            setLoading(false);
            onAuth(session);
          }
        } catch (err) {
          console.warn("[auth] Polling error:", err);
        }
      }, 1000);

      // Stop polling after 5 minutes
      const timeout = setTimeout(
        () => {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          setOauthState(null);
          setLoading(false);
          setError("Authentication timed out. Please try again.");
        },
        5 * 60 * 1000,
      );

      return () => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
        }
        clearTimeout(timeout);
      };
    }
  }, [oauthState, onAuth]);

  const signInWithGoogle = async () => {
    setError("");
    setLoading(true);

    try {
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${import.meta.env.VITE_WEB_APP_URL || "https://oscar.samyarth.org"}/auth/desktop-callback`,
          skipBrowserRedirect: true,
        },
      });

      if (oauthError) throw oauthError;

      if (data?.url) {
        setOauthState({ verifier: "", url: data.url });
        await openUrl(data.url);
      } else {
        throw new Error("No OAuth URL returned");
      }
    } catch (err: unknown) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  return (
    <div className="split-layout">
      <StepIndicator currentStep="signin" />
      <div className="split-layout-inner">
        <div className="split-left">
          <div className="split-content">
            <div className="brand-header">
              {/* <div className="brand-icon-small"> */}
              <img
                src="/OSCAR_LIGHT_LOGO.png"
                alt="OSCAR"
                width="36"
                height="36"
              />
              {/* </div> */}
              <span className="brand-name">OSCAR</span>
            </div>

            <h1 className="split-title">Let's get you started</h1>
            <p className="split-description">
              Write faster in every app using your voice. Sign in with Google to
              sync your dictionary and enable AI editing.
            </p>

            {error && <p className="auth-error">{error}</p>}
            {oauthState && (
              <p className="auth-message">
                Waiting for authentication... Please complete the sign-in in
                your browser.
              </p>
            )}

            <button
              type="button"
              className="google-signin-btn"
              onClick={signInWithGoogle}
              disabled={loading}
            >
              <svg
                className="google-icon"
                viewBox="0 0 24 24"
                width="18"
                height="18"
              >
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {loading ? "Opening browser..." : "Continue with Google"}
            </button>

            <p className="terms-text">
              By signing up, you agree to our{" "}
              <button
                type="button"
                className="terms-link"
                onClick={() =>
                  openUrl(
                    `${import.meta.env.VITE_WEB_APP_URL || "https://oscar.samyarth.org"}/terms`,
                  )
                }
              >
                Terms of Service
              </button>{" "}
              and{" "}
              <button
                type="button"
                className="terms-link"
                onClick={() =>
                  openUrl(
                    `${import.meta.env.VITE_WEB_APP_URL || "https://oscar.samyarth.org"}/privacy`,
                  )
                }
              >
                Privacy Policy
              </button>
              .
            </p>

            <button
              type="button"
              className="bypass-auth-btn"
              onClick={() => {
                // Bypass auth for development - create mock session
                onAuth({
                  user: {
                    id: "dev-user-id",
                    email: "dev@example.com",
                    user_metadata: { full_name: "Dev User" },
                    app_metadata: {},
                    aud: "dev",
                    created_at: new Date().toISOString(),
                  } as User,
                  access_token: "dev-token",
                  refresh_token: "dev-refresh",
                  expires_in: 3600,
                  expires_at: Math.floor(Date.now() / 1000) + 3600,
                  token_type: "bearer",
                } as Session);
              }}
              style={{
                marginTop: "16px",
                padding: "10px 16px",
                fontSize: "0.85rem",
                color: "#6b7280",
                background: "transparent",
                border: "1px dashed #d1d5db",
                borderRadius: "8px",
                cursor: "pointer",
                width: "100%",
              }}
            >
              Skip Authentication (Dev Only)
            </button>
          </div>
        </div>
        <div className="split-right">
          <CoverShowcase />
        </div>
      </div>
    </div>
  );
}

// ── Permissions Screen ────────────────────────────────────────────────────────

function PermissionsScreen({
  onContinue,
  hotkeyWarning,
  onRetryHotkey,
}: {
  onContinue: () => void;
  hotkeyWarning?: string;
  onRetryHotkey?: () => Promise<void> | void;
}) {
  const [micStatus, setMicStatus] = useState<"idle" | "granted" | "denied">(
    "idle",
  );
  const [accessibilityEnabled, setAccessibilityEnabled] = useState(false);
  const [systemAudioSupported, setSystemAudioSupported] = useState(false);
  const [systemAudioStatus, setSystemAudioStatus] = useState<
    "idle" | "granted" | "denied"
  >("idle");

  useEffect(() => {
    getMicrophonePermissionState()
      .then((state) => {
        if (state === "granted") setMicStatus("granted");
        if (state === "denied") setMicStatus("denied");
      })
      .catch(() => {});

    invoke<boolean>("check_accessibility_permission")
      .then(setAccessibilityEnabled)
      .catch(() => {});

    invoke<boolean>("is_system_audio_supported")
      .then(async (supported) => {
        setSystemAudioSupported(supported);
        if (!supported) return;

        const granted = await invoke<boolean>("check_system_audio_permission")
          .catch(() => false);
        if (granted) {
          setSystemAudioStatus("granted");
        }
      })
      .catch(() => setSystemAudioSupported(false));
  }, []);

  const requestMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMicStatus("granted");
    } catch {
      setMicStatus("denied");
    }
  };

  const requestAccessibility = async () => {
    try {
      // AXIsProcessTrustedWithOptions registers the current binary and opens System Settings
      const granted = await invoke<boolean>("request_accessibility_permission");
      setAccessibilityEnabled(granted);
      if (granted) {
        await onRetryHotkey?.();
      }
      if (!granted) {
        // Poll until the user enables it in System Settings
        const interval = setInterval(async () => {
          const trusted = await invoke<boolean>(
            "check_accessibility_permission",
          );
          if (trusted) {
            setAccessibilityEnabled(true);
            clearInterval(interval);
            await onRetryHotkey?.();
          }
        }, 1500);
        // Stop polling after 60s
        setTimeout(() => clearInterval(interval), 60_000);
      }
    } catch {
      // Fallback: open System Settings manually
      await openUrl(
        "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
      ).catch(() => {});
    }
  };

  const requestSystemAudio = async () => {
    try {
      const granted = await invoke<boolean>("request_system_audio_permission");
      setSystemAudioStatus(granted ? "granted" : "denied");

      if (!granted) {
        const interval = setInterval(async () => {
          const trusted = await invoke<boolean>("check_system_audio_permission");
          if (trusted) {
            setSystemAudioStatus("granted");
            clearInterval(interval);
          }
        }, 1500);
        setTimeout(() => clearInterval(interval), 60_000);
      }
    } catch {
      setSystemAudioStatus("denied");
      await openUrl(SYSTEM_AUDIO_SETTINGS_URL).catch(() => {});
    }
  };

  const canContinue = micStatus === "granted";

  return (
    <div className="split-layout">
      <StepIndicator currentStep="permissions" />
      <div className="split-layout-inner">
        <div className="split-left">
          <div className="split-content">
            <div className="brand-header">
              <img
                src="/OSCAR_LIGHT_LOGO.png"
                alt="OSCAR"
                width="36"
                height="36"
              />
              <span className="brand-name">OSCAR</span>
            </div>

            <h1 className="split-title">
              Allow OSCAR to transcribe your voice
            </h1>
            <p className="split-description">
              When you turn it on, OSCAR transcribes using your microphone. Your
              audio is processed locally — nothing leaves your device.
            </p>

            <div className="permissions-items-modern">
              <div className="perm-item-modern">
                <div className="perm-item-icon">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" x2="12" y1="19" y2="22" />
                  </svg>
                </div>
                <div className="perm-item-content">
                  <span className="perm-item-label">Microphone access</span>
                  <span className="perm-item-sub">
                    Required for voice transcription
                  </span>
                </div>
                {micStatus === "granted" ? (
                  <span className="perm-badge-modern granted">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                ) : micStatus === "denied" ? (
                  <span className="perm-badge-modern denied">Denied</span>
                ) : (
                  <button
                    className="perm-enable-btn-modern"
                    onClick={requestMic}
                  >
                    Enable
                  </button>
                )}
              </div>

              <div className="perm-item-modern">
                <div className="perm-item-icon">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" x2="21" y1="14" y2="3" />
                  </svg>
                </div>
                <div className="perm-item-content">
                  <span className="perm-item-label">
                    Accessibility &amp; global hotkey
                  </span>
                  <span className="perm-item-sub">
                    Required for Ctrl+Space anywhere
                  </span>
                </div>
                {accessibilityEnabled ? (
                  <span className="perm-badge-modern granted">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                ) : (
                  <button
                    className="perm-enable-btn-modern"
                    onClick={requestAccessibility}
                  >
                    Enable
                  </button>
                )}
              </div>
            </div>

              {systemAudioSupported && (
                <div className="perm-item-modern">
                  <div className="perm-item-icon">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                    </svg>
                  </div>
                  <div className="perm-item-content">
                    <span className="perm-item-label">
                      System audio in meetings
                    </span>
                    <span className="perm-item-sub">
                      Optional, but needed to capture other participants
                    </span>
                  </div>
                  {systemAudioStatus === "granted" ? (
                    <span className="perm-badge-modern granted">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                  ) : (
                    <button
                      className="perm-enable-btn-modern"
                      onClick={requestSystemAudio}
                    >
                      {systemAudioStatus === "denied" ? "Retry" : "Enable"}
                    </button>
                  )}
                </div>
              )}

            {!accessibilityEnabled && (
              <p className="perm-skip-note-modern">
                You can enable Accessibility later in System Settings → Privacy
                &amp; Security.
              </p>
            )}

            {systemAudioSupported && systemAudioStatus !== "granted" && (
              <p className="perm-skip-note-modern">
                System audio is optional. macOS may ask you to restart OSCAR
                after enabling Screen Recording.
              </p>
            )}

            {hotkeyWarning && (
              <div
                style={{
                  marginTop: 16,
                  padding: "12px 14px",
                  borderRadius: 12,
                  background: "#fff7ed",
                  border: "1px solid #fdba74",
                  color: "#9a3412",
                }}
              >
                <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.5 }}>
                  {hotkeyWarning}
                </p>
                {onRetryHotkey && (
                  <button
                    type="button"
                    className="setup-skip-btn"
                    style={{ marginTop: 10 }}
                    onClick={() => onRetryHotkey()}
                  >
                    Retry Hotkey
                  </button>
                )}
              </div>
            )}

            <button
              className={`perm-continue-btn-modern ${canContinue ? "active" : ""}`}
              disabled={!canContinue}
              onClick={onContinue}
            >
              Continue
            </button>
          </div>
        </div>
        <div className="split-right">
          <CoverShowcase />
        </div>
      </div>
    </div>
  );
}

// ── Setup Screen ──────────────────────────────────────────────────────────────

const MODEL_URL =
  "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin";
const MODEL_PATH = ".oscar/models/ggml-small.bin";
const OLD_MODEL_PATH = ".oscar/models/ggml-base.bin";
const SYSTEM_AUDIO_SETTINGS_URL =
  "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture";


interface DownloadProgress {
  downloaded: number;
  total: number;
  percentage: number;
}

function SetupScreen({ onComplete }: { onComplete: () => Promise<void> | void }) {
  const [step, setStep] = useState<"download" | "loading">("download");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<DownloadProgress | null>(null);

  const downloadModel = async () => {
    setStep("loading");
    setProgress({ downloaded: 0, total: 1, percentage: 0 });

    // Set up progress listener
    const unlisten = await listen<DownloadProgress>(
      "download-progress",
      (event) => {
        setProgress(event.payload);
      },
    );

    try {
      // Get the home directory and construct full path
      const home = await homeDir();
      const fullPath = `${home}/${MODEL_PATH}`;

      // Download the model (async, with progress events)
      await invoke("download_whisper_model", {
        url: MODEL_URL,
        path: fullPath,
      });

      unlisten();

      // Clean up old model file if it exists (migration from base to small)
      try {
        const oldModelPath = `${home}/${OLD_MODEL_PATH}`;
        const oldExists = await invoke<boolean>("check_file_exists", {
          path: oldModelPath,
        });
        if (oldExists) {
          await invoke("delete_file", { path: oldModelPath });
          console.log("Cleaned up old model file:", oldModelPath);
        }
      } catch (cleanupErr) {
        console.warn("Failed to clean up old model:", cleanupErr);
        // Non-fatal — don't block setup completion
      }

      await onComplete();
    } catch (err) {
      unlisten();
      setError(`Something went wrong: ${err}`);
      setStep("download");
    }
  };

  if (step === "loading") {
    return (
      <div className="split-layout">
        <StepIndicator currentStep="setup" />
        <div className="split-layout-inner">
          <div className="split-left">
            <div className="split-content">
              <div className="brand-header">
                <img
                  src="/OSCAR_LIGHT_LOGO.png"
                  alt="OSCAR"
                  width="36"
                  height="36"
                />
                <span className="brand-name">OSCAR</span>
              </div>

              <h1 className="split-title">Warming up the engines...</h1>
              <p className="split-description">
                Downloading the speech recognition model. This happens entirely
                on your device — just a quick one-time setup.
              </p>

              <div className="setup-loading">
                {/* Progress bar */}
                <div className="download-progress-container">
                  <div className="download-progress-bar">
                    <div
                      className="download-progress-fill"
                      style={{ width: `${progress?.percentage || 0}%` }}
                    />
                  </div>
                </div>

                {error && <p className="setup-error">{error}</p>}
              </div>
            </div>
          </div>
          <div className="split-right">
            <CoverShowcase />
          </div>
        </div>
      </div>
    );
  }

  if (step === "download") {
    return (
      <div className="split-layout">
        <StepIndicator currentStep="setup" />
        <div className="split-layout-inner">
          <div className="split-left">
            <div className="split-content">
              <div className="brand-header">
                <img
                  src="/OSCAR_LIGHT_LOGO.png"
                  alt="OSCAR"
                  width="36"
                  height="36"
                />
                <span className="brand-name">OSCAR</span>
              </div>

              <h1 className="split-title">Getting your voice ready</h1>
              <p className="split-description">
                We need to set up the magic that turns your voice into text.
                This happens entirely on your device — just a quick one-time
                setup.
              </p>

              {error && <p className="setup-error">{error}</p>}

              <button
                className="perm-continue-btn-modern active"
                onClick={downloadModel}
              >
                Get Started
              </button>
            </div>
          </div>
          <div className="split-right">
            <CoverShowcase />
          </div>
        </div>
      </div>
    );
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

function App() {
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
  const [notesRefreshKey, setNotesRefreshKey] = useState(0);
  const [_whisperLoaded, setWhisperLoaded] = useState(false);
  const [_status, setStatus] = useState("Initializing...");
  const [_isProcessing, setIsProcessing] = useState(false);
  const [hotkeyWarning, setHotkeyWarning] = useState("");

  // Settings panel
  const [_whisperModelPath, setWhisperModelPath] = useState("");
  const [_autoPaste, setAutoPaste] = useState(true);

  // AI editing (legacy — kept for settings migration)
  const [_aiEditing, setAiEditing] = useState(false);
  const [_tonePreset, setTonePreset] = useState<TonePreset>("none");

  // AI Improvement toggle (user-controllable — controls DeepSeek cleanup)
  const [aiImprovementEnabled, setAiImprovementEnabled] = useState(true);
  const aiImprovementEnabledRef = useRef(true);

  // Transcription language ("auto" = whisper auto-detects, "hi-en" = Hinglish)
  const [transcriptionLanguage, setTranscriptionLanguage] = useState("hi-en");

  // Selected microphone device id ("" = system default)
  const [selectedMicId, setSelectedMicId] = useState("");

  // Google Calendar OAuth provider token
  const [googleCalendarToken, setGoogleCalendarToken] = useState("");

  // Meeting templates (built-in + custom)
  const [meetingTemplates, setMeetingTemplates] = useState<MeetingTemplateData[]>(DEFAULT_TEMPLATES);
  const [savedMeetings, setSavedMeetings] = useState<SavedMeeting[]>([]);
  const [settingsInitialSection, setSettingsInitialSection] = useState<string | undefined>(undefined);

  // Meeting recording state (separate from hold-to-talk dictation)
  const [isMeetingRecording, setIsMeetingRecording] = useState(false);
  const [meetingRecordingTime, setMeetingRecordingTime] = useState(0);
  const [meetingTranscript, setMeetingTranscript] = useState("");
  const meetingMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const meetingAudioChunksRef = useRef<Blob[]>([]);
  const meetingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
  const pendingStopRef = useRef(false);
  const warmStreamRef = useRef<MediaStream | null>(null);
  const aiEditingRef = useRef(false);
  const tonePresetRef = useRef<TonePreset>("none");
  const dictWordsRef = useRef<string[]>([]);
  const sessionRef = useRef<Session | null>(null);
  const authInitRef = useRef(false);

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
      setSession(s);
      sessionRef.current = s;
      setUser(s?.user ?? null);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      sessionRef.current = s;
      setUser(s?.user ?? null);
      if (s?.user) syncDictionaryFromSupabase(s.user.id);
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only: auth listener + one-time session check
  }, []);

  // ── Deep link handler for OAuth callback ────────────────────────────────────

  useEffect(() => {
    // Handle deep link URL
    const handleDeepLink = async (url: string) => {
      // Parse the deep link URL
      if (url.startsWith("oscar://auth/callback")) {
        const urlObj = new URL(url);

        // Calendar-only OAuth callback (direct Google OAuth, not Supabase)
        const calendarToken = urlObj.searchParams.get("calendar_token");
        if (calendarToken) {
          setGoogleCalendarToken(calendarToken);
          saveSetting("googleCalendarToken", calendarToken);
          console.log("[deep-link] Google Calendar token stored");
          return;
        }

        const error = urlObj.searchParams.get("error");
        const success = urlObj.searchParams.get("success");
        let accessToken = urlObj.searchParams.get("access_token");
        let refreshToken = urlObj.searchParams.get("refresh_token");

        // Also check fragment (after #) for tokens
        if (urlObj.hash) {
          const fragmentParams = new URLSearchParams(urlObj.hash.substring(1));
          accessToken = accessToken || fragmentParams.get("access_token");
          refreshToken = refreshToken || fragmentParams.get("refresh_token");
        }

        if (error) {
          console.error("[deep-link] Auth error:", error);
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

          // Store Google Calendar provider_token if present
          const providerToken = urlObj.searchParams.get("provider_token");
          if (providerToken) {
            setGoogleCalendarToken(providerToken);
            saveSetting("googleCalendarToken", providerToken);
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
        savedCalToken,
        savedSystemAudioEnabled,
        savedTemplates,
        savedMeetingsData,
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
        loadSetting<string>("googleCalendarToken", ""),
        loadSetting<boolean>("systemAudioEnabled", true),
        loadSetting<MeetingTemplateData[]>("meetingTemplates", []),
        loadSetting<SavedMeeting[]>("savedMeetings", []),
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
      setAiImprovementEnabled(savedAiImprovement);
      aiImprovementEnabledRef.current = savedAiImprovement;
      setSystemAudioEnabled(savedSystemAudioEnabled);
      if (savedCalToken) setGoogleCalendarToken(savedCalToken);
      // Merge stored templates with defaults (so new built-ins are always present)
      if (savedTemplates && savedTemplates.length > 0) {
        const storedBuiltins = savedTemplates.filter((t: MeetingTemplateData) => t.builtin);
        const customs = savedTemplates.filter((t: MeetingTemplateData) => !t.builtin);
        // Use stored version for built-ins if present, else default
        const merged = DEFAULT_TEMPLATES.map((def) => {
          const stored = storedBuiltins.find((s: MeetingTemplateData) => s.id === def.id);
          return stored ? { ...def, ...stored, builtin: true } : def;
        });
        // Append any custom templates
        setMeetingTemplates([...merged, ...customs]);
      }
      if (savedMeetingsData && savedMeetingsData.length > 0) {
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

    const SELF_APP_NAMES = ["oscar", "claude"]; // filter out our own app
    const unlistenStart = listen<string>("hotkey-recording-start", (ev) => {
      const raw = (ev.payload || "").trim();
      // If the frontmost app is ourselves, clear it so we don't try to activate ourselves
      targetAppRef.current = SELF_APP_NAMES.includes(raw.toLowerCase())
        ? ""
        : raw;
      pendingStopRef.current = false;
      if (whisperLoadedRef.current && !isRecordingRef.current)
        startHotkeyRecording();
    });
    const unlistenStop = listen("hotkey-recording-stop", () => {
      // ALWAYS set pending stop — this is the safety net for the race condition
      // where STOP arrives before getUserMedia resolves in startHotkeyRecording
      pendingStopRef.current = true;
      // Also try the normal stop path
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state === "recording"
      ) {
        isRecordingRef.current = false;
        setIsRecording(false);
        mediaRecorderRef.current.stop();
        // Switch to processing dots — pill hides after processAudio finishes
        invoke("set_pill_processing").catch(console.warn);
      } else {
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

  // Pre-warm the microphone so hotkey recording starts instantly (no getUserMedia delay).
  // This is critical for fullscreen apps where macOS Space-switching delays event delivery.
  const warmMicrophone = async () => {
    if (warmStreamRef.current) return; // already warm
    try {
      const audioConstraints = selectedMicId
        ? { deviceId: { ideal: selectedMicId } }
        : true;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
      });
      warmStreamRef.current = stream;
    } catch (e) {
      console.warn("[mic] failed to pre-warm microphone:", e);
    }
  };

  const tryLoadWhisperModel = async (): Promise<string | null> => {
    // Get home directory first so it's available in fallback section
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
        await invoke("load_whisper_model", { path });
        return path;
      } catch {
        continue;
      }
    }

    return null;
  };

  const initWhisper = async () => {
    const loadedPath = await tryLoadWhisperModel();
    if (loadedPath) {
      setWhisperLoadedAndRef(true);
      setWhisperModelPath(loadedPath);
      setStatus("Ready! Hold Ctrl+Space anywhere to record.");
      warmMicrophone();
      return true;
    }

    setWhisperLoadedAndRef(false);
    setStatus("Whisper model not found. Set the path in Settings.");
    return false;
  };

  // ── Dictionary helpers ─────────────────────────────────────────────────────

  // Hinglish hint: common Hindi words romanized — biases Whisper toward
  // recognizing Hindi vocabulary when transcription language is "hi-en".
  const HINGLISH_HINT =
    "acha, theek hai, haan, nahi, kya, kaise, kab, kyun, lekin, aur, " +
    "matlab, samajh, baat, kaam, kal, aaj, abhi, sab, log, dekho, " +
    "bolo, suno, chalo, pehle, baad mein, zaroor, bilkul, thoda, bahut";

  const buildInitialPrompt = () => {
    const parts: string[] = [];
    // Add Hinglish vocabulary hint when language is set to Hinglish
    if (transcriptionLanguage === "hi-en") {
      parts.push(HINGLISH_HINT);
    }
    if (dictWordsRef.current.length > 0) {
      parts.push(dictWordsRef.current.join(", "));
    }
    return parts.length > 0 ? parts.join(", ") : undefined;
  };

  // Resolve transcription language for Whisper: "hi-en" → "en", "auto" → undefined
  const getWhisperLanguage = () => {
    if (transcriptionLanguage === "auto") return undefined;
    if (transcriptionLanguage === "hi-en") return "en";
    return transcriptionLanguage;
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
        const audioConstraints = selectedMicId
          ? { deviceId: { ideal: selectedMicId } }
          : true;
        stream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
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
      const result = await invoke<Transcription>("transcribe_audio", {
        audioData: Array.from(audioData),
        initialPrompt: buildInitialPrompt(),
        language: getWhisperLanguage(),
      });

      if (!result.text) {
        console.warn("[process] ABORT: no speech detected");
        setStatus("⚠️ No speech detected. Try speaking louder or closer.");
        return;
      }

      let finalText = result.text;

      // Silent AI cleanup via DeepSeek — fix transcription artifacts.
      // This now runs BEFORE paste so the AI-cleaned output is what gets pasted.
      if (aiImprovementEnabledRef.current) {
        setStatus("Improving with AI...");
        try {
          const cleaned = await invoke<string>("ai_process_text", {
            text: finalText,
            mode: "transcribe_cleanup",
          });
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
      };
      // Use functional update to avoid stale closure issues
      setLocalTranscripts((prev) => {
        const updatedTranscripts = [newTranscript, ...prev];
        // Persist to disk
        saveSetting("localTranscripts", updatedTranscripts);
        return updatedTranscripts;
      });

      // Save to Supabase as a note (matches web app behavior)
      if (user) {
        const rawText = result.text;
        // Generate title: first sentence up to 60 chars, fallback to "Untitled Note"
        const firstSentence = finalText.split(/[.\n]/)[0]?.trim() || "";
        const title =
          firstSentence.length > 60
            ? firstSentence.slice(0, 57) + "..."
            : firstSentence || "Untitled Note";

        notesService
          .createNote({
            user_id: user.id,
            title,
            raw_text: rawText,
            original_formatted_text: finalText,
          })
          .then(({ error: saveErr }) => {
            if (saveErr) {
              console.warn("[notes] failed to save note:", saveErr);
            } else {
              setNotesRefreshKey((k) => k + 1);
            }
          });
      }

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

  // ── Google Calendar OAuth ────────────────────────────────────────────────

  const connectGoogleCalendar = async () => {
    // Bypass Supabase OAuth (which doesn't support additional scopes via UI).
    // Build a direct Google OAuth implicit-flow URL so we control the scope.
    const GOOGLE_CLIENT_ID = "332965035815-v8fnucr2ho5tm0c1jvsd84lch5n8m654.apps.googleusercontent.com";
    const redirectUri = `${import.meta.env.VITE_WEB_APP_URL || "https://oscar.samyarth.org"}/auth/desktop-callback`;
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "token",
      scope: "https://www.googleapis.com/auth/calendar.readonly",
      state: "calendar_connect",
      prompt: "consent",
    });
    const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    console.log("[calendar] Opening OAuth URL:", oauthUrl);
    await openUrl(oauthUrl);
  };

  // ── Meeting recording (click to start/stop, no auto-paste) ──────────────

  const startMeetingRecording = async () => {
    setSystemAudioWarning("");

    let stream: MediaStream;
    if (
      warmStreamRef.current &&
      warmStreamRef.current.getAudioTracks().some((t) => t.readyState === "live")
    ) {
      stream = warmStreamRef.current;
    } else {
      try {
        const audioConstraints = selectedMicId
          ? { deviceId: { ideal: selectedMicId } }
          : true;
        stream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
        });
        warmStreamRef.current = stream;
      } catch (e) {
        console.error("[meeting-record] getUserMedia failed:", e);
        return;
      }
    }

    const mimeType = MediaRecorder.isTypeSupported("audio/mp4")
      ? "audio/mp4"
      : "audio/webm";
    const mediaRecorder = new MediaRecorder(stream, { mimeType });
    meetingMediaRecorderRef.current = mediaRecorder;
    meetingAudioChunksRef.current = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) meetingAudioChunksRef.current.push(e.data);
    };
    mediaRecorder.onstop = () => {
      processMeetingAudio();
    };

    // Start system audio capture (ScreenCaptureKit on macOS) in parallel with mic
    if (systemAudioEnabled && systemAudioSupported) {
      try {
        await invoke("start_system_audio_capture");
        systemAudioActiveRef.current = true;
        setSystemAudioWarning("");
        console.log("[meeting-record] System audio capture started");
      } catch (e) {
        console.warn("[meeting-record] System audio capture failed, mic only:", e);
        systemAudioActiveRef.current = false;
        const reason = String(e).replace(/^Error:\s*/i, "");
        setSystemAudioWarning(
          `${reason} Meeting recording will continue with your microphone only.`,
        );
      }
    } else {
      systemAudioActiveRef.current = false;
      setSystemAudioWarning("");
    }

    mediaRecorder.start(100);
    setIsMeetingRecording(true);
    setMeetingRecordingTime(0);
    setMeetingTranscript("");
    meetingTimerRef.current = setInterval(() => {
      setMeetingRecordingTime((prev) => prev + 1);
    }, 1000);
  };

  const stopMeetingRecording = () => {
    setIsMeetingRecording(false);
    if (meetingTimerRef.current) {
      clearInterval(meetingTimerRef.current);
      meetingTimerRef.current = null;
    }
    if (
      meetingMediaRecorderRef.current &&
      meetingMediaRecorderRef.current.state === "recording"
    ) {
      meetingMediaRecorderRef.current.stop();
    }
  };

  const processMeetingAudio = async () => {
    const mimeType = MediaRecorder.isTypeSupported("audio/mp4")
      ? "audio/mp4"
      : "audio/webm";
    const audioBlob = new Blob(meetingAudioChunksRef.current, {
      type: mimeType,
    });
    if (audioBlob.size < 500) {
      setMeetingTranscript("");
      return;
    }

    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioContext = new AudioContext({ sampleRate: 16000 });
    try {
      const decoded = await audioContext.decodeAudioData(arrayBuffer);
      const numChannels = decoded.numberOfChannels;
      const length = decoded.length;
      const mono = new Float32Array(length);
      for (let ch = 0; ch < numChannels; ch++) {
        const channel = decoded.getChannelData(ch);
        for (let i = 0; i < length; i++) mono[i] += channel[i] / numChannels;
      }

      const useSystemAudio = systemAudioActiveRef.current;
      systemAudioActiveRef.current = false;

      const promptStr = buildInitialPrompt();
      const langStr = getWhisperLanguage();

      const result = await invoke<Transcription>(
        useSystemAudio ? "transcribe_meeting_audio" : "transcribe_audio",
        useSystemAudio
          ? { micAudioData: Array.from(mono), initialPrompt: promptStr, language: langStr }
          : { audioData: Array.from(mono), initialPrompt: promptStr, language: langStr }
      );

      if (result.text) {
        setMeetingTranscript(result.text);
      }
    } catch (e) {
      console.error("[meeting] audio decode failed:", e);
    } finally {
      audioContext.close();
    }
  };

  const handlePermissionsContinue = async () => {
    await saveSetting("permissionsDone", true);
    setPermissionsShown(true);
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
    await supabase.auth.signOut();
  };

  // AI Improvement toggle handler
  const handleAiImprovementChange = useCallback((enabled: boolean) => {
    setAiImprovementEnabled(enabled);
    aiImprovementEnabledRef.current = enabled;
    saveSetting("aiImprovementEnabled", enabled);
  }, []);

  const handleSystemAudioToggle = useCallback((enabled: boolean) => {
    setSystemAudioEnabled(enabled);
    saveSetting("systemAudioEnabled", enabled);
    if (!enabled) {
      setSystemAudioWarning("");
    }
  }, []);

  // ── Tab state ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabType>("home");

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
                  onClearTranscript={() => setMeetingTranscript("")}
                  systemAudioWarning={systemAudioWarning}
                  googleCalendarToken={googleCalendarToken}
                  onConnectCalendar={connectGoogleCalendar}
                  onCalendarTokenInvalid={() => {
                    setGoogleCalendarToken("");
                    saveSetting("googleCalendarToken", "");
                  }}
                  templates={meetingTemplates}
                  onManageTemplates={() => {
                    setSettingsInitialSection("meetingTemplates");
                    setActiveTab("settings");
                  }}
                  savedMeetings={savedMeetings}
                  onSaveMeeting={(meeting) => {
                    const updated = [meeting, ...savedMeetings.filter((m) => m.id !== meeting.id)];
                    setSavedMeetings(updated);
                    saveSetting("savedMeetings", updated);
                  }}
                  onDeleteMeeting={(id) => {
                    const updated = savedMeetings.filter((m) => m.id !== id);
                    setSavedMeetings(updated);
                    saveSetting("savedMeetings", updated);
                  }}
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
                  refreshKey={notesRefreshKey}
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
                    saveSetting("selectedMicId", id);
                    // Reset warm stream and re-warm with new mic
                    if (warmStreamRef.current) {
                      warmStreamRef.current
                        .getTracks()
                        .forEach((t) => t.stop());
                      warmStreamRef.current = null;
                    }
                    warmMicrophone();
                  }}
                  onClearData={async () => {
                    try {
                      // Delete downloaded model files
                      const home = await homeDir();
                      const filesToDelete = [
                        `${home}/${MODEL_PATH}`,
                        `${home}/${OLD_MODEL_PATH}`,
                        // Legacy local AI model files (removed in favour of DeepSeek)
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

                    // Sign out of Supabase
                    try {
                      await supabase.auth.signOut();
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
                  meetingTemplates={meetingTemplates}
                  onSaveTemplate={(tpl) => {
                    setMeetingTemplates((prev) => {
                      const exists = prev.findIndex((t) => t.id === tpl.id);
                      const updated = exists >= 0
                        ? prev.map((t) => (t.id === tpl.id ? tpl : t))
                        : [...prev, tpl];
                      saveSetting("meetingTemplates", updated);
                      return updated;
                    });
                  }}
                  onDeleteTemplate={(id) => {
                    setMeetingTemplates((prev) => {
                      const updated = prev.filter((t) => t.id !== id);
                      saveSetting("meetingTemplates", updated);
                      return updated;
                    });
                  }}
                  initialSection={settingsInitialSection as any}
                  systemAudioSupported={systemAudioSupported}
                  systemAudioEnabled={systemAudioEnabled}
                  onSystemAudioToggle={handleSystemAudioToggle}
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
