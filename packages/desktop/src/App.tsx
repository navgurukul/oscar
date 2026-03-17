import React, { useState, useRef, useEffect, useCallback, memo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { homeDir } from "@tauri-apps/api/path";
import { load } from "@tauri-apps/plugin-store";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { User, Session } from "@supabase/supabase-js";
import { supabase, SUPABASE_URL } from "./supabase";
import { SparklesCore } from "@/components/ui/sparkles";
import { Cover } from "@/components/ui/cover";
import { Navigation } from "./components/Navigation";
import { Header } from "./components/Header";
import { NotesTab } from "./components/NotesTab";
import { SettingsTab } from "./components/SettingsTab";
import { UpdateNotification } from "./components/UpdateNotification";
import { useUpdater } from "./hooks/useUpdater";
import oscarLogo from "/OSCAR_LIGHT_LOGO.png";
import "./App.css";

type TabType = "notes" | "vocabulary" | "billing" | "settings";

interface Transcription {
  text: string;
  error?: string;
}

type TonePreset = "none" | "professional" | "casual" | "friendly";

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
  } catch (e) {
    console.warn("[store] save failed:", e);
  }
}

// ── Step Indicator ────────────────────────────────────────────────────────────

function StepIndicator({ currentStep }: { currentStep: "signin" | "permissions" | "setup" }) {
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
            <svg className="step-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      <div className={`cover-slide ${currentSlide === 0 ? 'active' : ''}`}>
        <div className="cover-content">
          <p className="cover-subtitle">Using OSCAR</p>
          <h2 className="cover-title">4x faster than typing</h2>
          <div className="cover-highlight">
            <span className="cover-speed">220 wpm</span>
          </div>
          <div className="cover-demo-text">
            <p>"Just started with the project, how would you like to set up the file? Here are a few options..."</p>
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
      <div className={`cover-slide ${currentSlide === 1 ? 'active' : ''}`}>
        <div className="cover-content">
          <p className="cover-subtitle">Experience the future</p>
          <h2 className="cover-title warp-title">
            Write at <Cover>warp speed</Cover>
          </h2>
          <div className="cover-highlight">
            <span className="cover-speed">AI-powered</span>
          </div>
          <div className="cover-demo-text">
            <p>Transform your thoughts into text instantly. Just speak naturally and let OSCAR do the rest.</p>
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
      <div className={`cover-slide ${currentSlide === 2 ? 'active' : ''}`}>
        <div className="cover-content">
          <p className="cover-subtitle">Works everywhere</p>
          <h2 className="cover-title">Use in any app</h2>
          <div className="cover-highlight">
            <span className="cover-speed">Global shortcut</span>
          </div>
          <div className="cover-demo-text">
            <p>Hold <kbd>Ctrl</kbd>+<kbd>Space</kbd> to start dictating. Works in Slack, Notion, VS Code, and everywhere else.</p>
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
            className={`slide-dot ${currentSlide === index ? 'active' : ''}`}
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
  const [oauthState, setOauthState] = useState<{ verifier: string; url: string } | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll for session when OAuth is in progress
  useEffect(() => {
    if (oauthState) {
      // Start polling for session
      pollingRef.current = setInterval(async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
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
      const timeout = setTimeout(() => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        setOauthState(null);
        setLoading(false);
        setError("Authentication timed out. Please try again.");
      }, 5 * 60 * 1000);

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
          redirectTo: "http://localhost:3000/auth/desktop-callback",
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
                <img src={oscarLogo} alt="OSCAR" width="36" height="36" />
              {/* </div> */}
              <span className="brand-name">OSCAR</span>
            </div>

            <h1 className="split-title">
              Let's get you started
            </h1>
            <p className="split-description">
              Write faster in every app using your voice. Sign in with Google to sync your dictionary and enable AI editing.
            </p>

            {error && <p className="auth-error">{error}</p>}
            {oauthState && (
              <p className="auth-message">
                Waiting for authentication... Please complete the sign-in in your browser.
              </p>
            )}

            <button
              type="button"
              className="google-signin-btn"
              onClick={signInWithGoogle}
              disabled={loading}
            >
              <svg className="google-icon" viewBox="0 0 24 24" width="18" height="18">
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
              By signing up, you agree to our Terms of Service and Privacy Policy.
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

function PermissionsScreen({ onContinue }: { onContinue: () => void }) {
  const [micStatus, setMicStatus] = useState<"idle" | "granted" | "denied">("idle");
  const [accessibilityEnabled, setAccessibilityEnabled] = useState(false);

  const requestMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMicStatus("granted");
    } catch {
      setMicStatus("denied");
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
              <img src={oscarLogo} alt="OSCAR" width="36" height="36" />
              <span className="brand-name">OSCAR</span>
            </div>

            <h1 className="split-title">
              Allow OSCAR to transcribe your voice
            </h1>
            <p className="split-description">
              When you turn it on, OSCAR transcribes using your microphone. Your audio
              is processed locally — nothing leaves your device.
            </p>

            <div className="permissions-items-modern">
              <div className="perm-item-modern">
                <div className="perm-item-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" x2="12" y1="19" y2="22" />
                  </svg>
                </div>
                <div className="perm-item-content">
                  <span className="perm-item-label">Microphone access</span>
                  <span className="perm-item-sub">Required for voice transcription</span>
                </div>
                {micStatus === "granted" ? (
                  <span className="perm-badge-modern granted">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                ) : micStatus === "denied" ? (
                  <span className="perm-badge-modern denied">Denied</span>
                ) : (
                  <button className="perm-enable-btn-modern" onClick={requestMic}>
                    Enable
                  </button>
                )}
              </div>

              <div className="perm-item-modern">
                <div className="perm-item-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" x2="21" y1="14" y2="3" />
                  </svg>
                </div>
                <div className="perm-item-content">
                  <span className="perm-item-label">Accessibility &amp; global hotkey</span>
                  <span className="perm-item-sub">Required for Ctrl+Space anywhere</span>
                </div>
                {accessibilityEnabled ? (
                  <span className="perm-badge-modern granted">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                ) : (
                  <button className="perm-enable-btn-modern" onClick={() => setAccessibilityEnabled(true)}>
                    Enable
                  </button>
                )}
              </div>
            </div>

            {!accessibilityEnabled && (
              <p className="perm-skip-note-modern">
                You can enable Accessibility later in System Settings → Privacy &amp; Security.
              </p>
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

const MODEL_URL = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin";
const MODEL_PATH = ".oscar/models/ggml-base.bin";

interface DownloadProgress {
  downloaded: number;
  total: number;
  percentage: number;
}

function SetupScreen({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<"download" | "apikey" | "loading">("download");
  const [, setDownloadStatus] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<DownloadProgress | null>(null);

  const downloadModel = async () => {
    setStep("loading");
    setProgress({ downloaded: 0, total: 1, percentage: 0 });
    
    // Set up progress listener
    const unlisten = await listen<DownloadProgress>("download-progress", (event) => {
      setProgress(event.payload);
    });
    
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
      setDownloadStatus("Download complete!");
      
      // Move to API key step
      setTimeout(() => {
        setStep("apikey");
      }, 500);
    } catch (err) {
      unlisten();
      setError(`Something went wrong: ${err}`);
      setStep("download");
    }
  };

  const handleComplete = async () => {
    // Save API key if provided
    if (apiKey.trim()) {
      await saveSetting("userApiKey", apiKey.trim());
    }
    
    // Mark setup as complete
    await saveSetting("setupComplete", true);
    
    onComplete();
  };

  const handleSkipApiKey = () => {
    handleComplete();
  };

  if (step === "loading") {
    return (
      <div className="split-layout">
        <StepIndicator currentStep="setup" />
        <div className="split-layout-inner">
          <div className="split-left">
            <div className="split-content">
              <div className="brand-header">
                <img src={oscarLogo} alt="OSCAR" width="36" height="36" />
                <span className="brand-name">OSCAR</span>
              </div>

              <h1 className="split-title">Warming up the engines...</h1>
              <p className="split-description">
                Downloading the speech recognition model. This happens entirely on your device — just a quick one-time setup.
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
                <img src={oscarLogo} alt="OSCAR" width="36" height="36" />
                <span className="brand-name">OSCAR</span>
              </div>

              <h1 className="split-title">Getting your voice ready</h1>
              <p className="split-description">
                We need to set up the magic that turns your voice into text. 
                This happens entirely on your device — just a quick one-time setup.
              </p>

              {error && <p className="setup-error">{error}</p>}

              <button className="perm-continue-btn-modern active" onClick={downloadModel}>
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

  // API Key step
  return (
    <div className="split-layout">
      <StepIndicator currentStep="setup" />
      <div className="split-layout-inner">
        <div className="split-left">
          <div className="split-content">
            <div className="brand-header">
              <img src={oscarLogo} alt="OSCAR" width="36" height="36" />
              <span className="brand-name">OSCAR</span>
            </div>

            <h1 className="split-title">AI Enhancement (Optional)</h1>
            <p className="split-description">
              OSCAR can enhance your transcriptions with AI. Use our service (requires sign-in) 
              or provide your own DeepSeek API key.
            </p>

            <div className="setup-apikey-section">
              <label className="setup-label">Your DeepSeek API Key (optional)</label>
              <input
                type="password"
                className="setup-input"
                placeholder="sk-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <p className="setup-hint">
                Leave blank to use OSCAR&apos;s AI service. Your key is stored locally.
              </p>
            </div>

            <div className="setup-buttons">
              <button className="perm-continue-btn-modern active" onClick={handleComplete}>
                {apiKey.trim() ? "Save & Continue" : "Continue"}
              </button>
              {!apiKey.trim() && (
                <button className="setup-skip-btn" onClick={handleSkipApiKey}>
                  Skip
                </button>
              )}
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

// ── Component ─────────────────────────────────────────────────────────────────

function App() {
  // Auth
  const [user, setUser] = useState<User | null>(null);
  const [, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // First-run gates
  const [permissionsShown, setPermissionsShown] = useState<boolean | null>(null);
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null);
  const [userApiKey, setUserApiKey] = useState<string>("");

  // Recording & processing (global hotkey functionality)
  const [_isRecording, setIsRecording] = useState(false);
  const [_transcript, setTranscript] = useState("");
  const [whisperLoaded, setWhisperLoaded] = useState(false);
  const [_status, setStatus] = useState("Initializing...");
  const [_isProcessing, setIsProcessing] = useState(false);
  const [_hotkeyWarning, setHotkeyWarning] = useState("");

  // Settings panel
  const [whisperModelPath, setWhisperModelPath] = useState("");
  const [autoPaste, setAutoPaste] = useState(true);

  // AI editing
  const [aiEditing, setAiEditing] = useState(false);
  const [tonePreset, setTonePreset] = useState<TonePreset>("none");

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
  const aiEditingRef = useRef(false);
  const tonePresetRef = useRef<TonePreset>("none");
  const dictWordsRef = useRef<string[]>([]);
  const sessionRef = useRef<Session | null>(null);

  // Auto-updater
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const updater = useUpdater();

  // Check for updates on startup
  useEffect(() => {
    // Delay check to not block initial load
    const timer = setTimeout(() => {
      updater.checkForUpdates();
    }, 3000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Supabase auth listener ─────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      sessionRef.current = s;
      setUser(s?.user ?? null);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      sessionRef.current = s;
      setUser(s?.user ?? null);
      if (s?.user) syncDictionaryFromSupabase(s.user.id);
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Deep link handler for OAuth callback ────────────────────────────────────

  useEffect(() => {
    // Handle deep link URL
    const handleDeepLink = async (url: string) => {
      console.log("[deep-link] Received:", url);
      
      // Parse the deep link URL
      if (url.startsWith("oscar://auth/callback")) {
        const urlObj = new URL(url);
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
          console.log("[deep-link] Setting session with tokens...");
          
          // Set the session using the tokens from the web app
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          
          if (sessionError) {
            console.error("[deep-link] Failed to set session:", sessionError);
          } else if (data.session) {
            console.log("[deep-link] Session established successfully");
            setSession(data.session);
            setUser(data.session.user);
            sessionRef.current = data.session;
          }
        } else if (success === "true") {
          // Fallback: no tokens in URL, try to get session (for backward compatibility)
          console.log("[deep-link] Auth success but no tokens, checking session...");
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            console.log("[deep-link] Session found, authenticating...");
            setSession(session);
            setUser(session.user);
            sessionRef.current = session;
          }
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Boot: load persisted settings ──────────────────────────────────────────

  useEffect(() => {
    (async () => {
      const [savedAiEditing, savedTone, savedAutoPaste, savedDict, permsDone, setupDone, savedApiKey] =
        await Promise.all([
          loadSetting<boolean>("aiEditing", false),
          loadSetting<TonePreset>("tonePreset", "none"),
          loadSetting<boolean>("autoPaste", true),
          loadSetting<string[]>("dictWords", []),
          loadSetting<boolean>("permissionsDone", false),
          loadSetting<boolean>("setupComplete", false),
          loadSetting<string>("userApiKey", ""),
        ]);

      setPermissionsShown(permsDone);
      setSetupComplete(setupDone);
      setUserApiKey(savedApiKey);
      setAiEditing(savedAiEditing);
      aiEditingRef.current = savedAiEditing;
      setTonePreset(savedTone);
      tonePresetRef.current = savedTone;
      setAutoPaste(savedAutoPaste);
      autoPasteRef.current = savedAutoPaste;
      setDictWords(savedDict);
      dictWordsRef.current = savedDict;

      // If setup is complete, load the Whisper model
      if (setupDone) {
        initWhisper();
      }
    })();

    const unlistenStart = listen("hotkey-recording-start", () => {
      if (whisperLoadedRef.current && !isRecordingRef.current) startHotkeyRecording();
    });
    const unlistenStop = listen("hotkey-recording-stop", () => {
      if (isRecordingRef.current) stopHotkeyRecording();
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Supabase dictionary sync ───────────────────────────────────────────────

  const syncDictionaryFromSupabase = useCallback(async (userId: string) => {
    setDictSyncing(true);
    try {
      const { data, error } = await supabase
        .from("user_dictionary")
        .select("word")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const words = (data ?? []).map((r: { word: string }) => r.word);
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

  const initWhisper = async () => {
    // First check the standard OSCAR model location
    try {
      const home = await homeDir();
      const oscarPath = `${home}/.oscar/models/ggml-base.bin`;
      await invoke("load_whisper_model", { path: oscarPath });
      setWhisperLoadedAndRef(true);
      setWhisperModelPath(oscarPath);
      setStatus("Ready! Hold Ctrl+Space anywhere to record.");
      return;
    } catch {
      // Fall back to other common locations
      const paths = [
        "/Users/souvikdeb/.whisper/ggml-small.bin",
        "/Users/souvikdeb/.whisper/ggml-base.bin",
        "./models/ggml-base.bin",
        "/usr/local/share/whisper/ggml-base.bin",
      ];
      for (const path of paths) {
        try {
          await invoke("load_whisper_model", { path });
          setWhisperLoadedAndRef(true);
          setWhisperModelPath(path);
          setStatus("Ready! Hold Ctrl+Space anywhere to record.");
          return;
        } catch {
          continue;
        }
      }
    }
    setStatus("Whisper model not found. Set the path in Settings.");
  };

  const loadWhisperModel = async () => {
    if (!whisperModelPath) return;
    try {
      setStatus("Loading Whisper model...");
      await invoke("load_whisper_model", { path: whisperModelPath });
      setWhisperLoadedAndRef(true);
      setStatus("Ready! Hold Ctrl+Space anywhere to record.");
    } catch (e) {
      setStatus(`Failed to load model: ${e}`);
    }
  };

  // ── Dictionary helpers ─────────────────────────────────────────────────────

  const buildInitialPrompt = () => {
    if (dictWordsRef.current.length === 0) return undefined;
    return dictWordsRef.current.join(", ");
  };

  // ── Hotkey recording ───────────────────────────────────────────────────────

  const startHotkeyRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "audio/webm";
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => processAudio(stream, autoPasteRef.current);

      mediaRecorder.start(100);
      isRecordingRef.current = true;
      setIsRecording(true);
      setStatus("Recording... Release to stop");
      invoke("show_recording_pill").catch(console.warn);
    } catch (e) {
      setStatus(`Error: Could not access microphone — ${e}`);
    }
  };

  const stopHotkeyRecording = () => {
    if (mediaRecorderRef.current && isRecordingRef.current) {
      isRecordingRef.current = false;
      setIsRecording(false);
      mediaRecorderRef.current.stop();
      invoke("hide_recording_pill").catch(console.warn);
    }
  };

  // ── Audio processing (shared by hotkey recording) ───────────────────────────

  const processAudio = async (stream: MediaStream, shouldPaste: boolean) => {
    const chunkCount = audioChunksRef.current.length;
    const totalBytes = audioChunksRef.current.reduce((s, b) => s + b.size, 0);

    if (chunkCount === 0 || totalBytes === 0) {
      setStatus("❌ No audio captured. Check microphone permission.");
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    const mimeType = MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "audio/webm";
    const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

    if (audioBlob.size < 500) {
      setStatus(`❌ Blob too small (${audioBlob.size}B). Try again.`);
      stream.getTracks().forEach((t) => t.stop());
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
      stream.getTracks().forEach((t) => t.stop());
      return;
    } finally {
      audioContext.close();
    }

    if (audioData.length < 1600) {
      setStatus(`❌ Too short (${audioData.length} samples). Speak for ≥1 second.`);
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    const durationSec = (audioData.length / 16000).toFixed(1);
    setIsProcessing(true);
    setStatus(`Transcribing ${durationSec}s...`);

    try {
      const result = await invoke<Transcription>("transcribe_audio", {
        audioData: Array.from(audioData),
        initialPrompt: buildInitialPrompt(),
      });

      if (!result.text) {
        setStatus("⚠️ No speech detected. Try speaking louder or closer.");
        return;
      }

      let finalText = result.text;

      // AI editing via user's API key or Supabase Edge Function
      if (aiEditingRef.current) {
        // Check if user has their own API key
        const hasUserApiKey = userApiKey && userApiKey.trim().length > 0;
        
        if (hasUserApiKey || (sessionRef.current && SUPABASE_URL)) {
          setStatus("✨ Enhancing with AI...");
          try {
            finalText = await invoke<string>("enhance_text", {
              text: finalText,
              tone: tonePresetRef.current,
              edgeFunctionUrl: hasUserApiKey ? null : `${SUPABASE_URL}/functions/v1/enhance`,
              jwt: hasUserApiKey ? null : sessionRef.current?.access_token,
              apiKey: hasUserApiKey ? userApiKey : null,
            });
          } catch (aiErr) {
            console.warn("[ai] enhance failed, using raw transcript:", aiErr);
            setStatus(`⚠️ AI edit failed: ${aiErr}`);
            await new Promise((r) => setTimeout(r, 1500));
          }
        } else {
          setStatus("⚠️ Sign in or add an API key to use AI editing.");
          await new Promise((r) => setTimeout(r, 1500));
        }
      }

      setTranscript((prev) => (prev ? prev + "\n\n" + finalText : finalText));

      if (shouldPaste) {
        try {
          await invoke("paste_transcription", { text: finalText });
          setStatus("Pasted! ✓");
        } catch (pe) {
          console.warn("[paste] error:", pe);
          setStatus("Done! (paste failed — check Accessibility permission)");
        }
      } else {
        setStatus("Done! ✓");
      }
    } catch (e) {
      setStatus(`❌ Error: ${e}`);
    } finally {
      setIsProcessing(false);
    }

    stream.getTracks().forEach((t) => t.stop());
  };

  const handlePermissionsContinue = async () => {
    await saveSetting("permissionsDone", true);
    setPermissionsShown(true);
  };

  const handleSetupComplete = async () => {
    setSetupComplete(true);
    // Load the model after setup is complete
    initWhisper();
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  // ── Tab state ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabType>("notes");

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
  if (!user) return <AuthScreen onAuth={(s) => { setSession(s); sessionRef.current = s; setUser(s.user); }} />;
  if (permissionsShown === null) return null;
  if (!permissionsShown) return <PermissionsScreen onContinue={handlePermissionsContinue} />;
  if (setupComplete === null) return null;
  if (!setupComplete) return <SetupScreen onComplete={handleSetupComplete} />;

  return (
    <div className="app-modern">
      <Navigation
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        userEmail={user.email || ""}
        isProUser={isProUser}
      />

      <main className="main-area">
        <Header
          userEmail={user.email || ""}
          onSignOut={handleSignOut}
          onSettingsClick={() => setActiveTab("settings")}
        />
        <div className="main-area-content">
          {activeTab === "notes" && user && (
            <NotesTab userId={user.id} />
          )}

          {activeTab === "settings" && (
          <SettingsTab
            whisperModelPath={whisperModelPath}
            autoPaste={autoPaste}
            aiEditing={aiEditing}
            tonePreset={tonePreset}
            userApiKey={userApiKey}
            whisperLoaded={whisperLoaded}
            onModelPathChange={setWhisperModelPath}
            onLoadModel={loadWhisperModel}
            onAutoPasteChange={(value) => {
              autoPasteRef.current = value;
              setAutoPaste(value);
              saveSetting("autoPaste", value);
            }}
            onAiEditingChange={(value) => {
              aiEditingRef.current = value;
              setAiEditing(value);
              saveSetting("aiEditing", value);
            }}
            onTonePresetChange={(t) => {
              tonePresetRef.current = t;
              setTonePreset(t);
              saveSetting("tonePreset", t);
            }}
            onApiKeyChange={setUserApiKey}
            onSaveApiKey={() => saveSetting("userApiKey", userApiKey)}
            onClearData={() => {
              if (confirm("This will clear all local data including settings. Continue?")) {
                localStorage.clear();
                window.location.reload();
              }
            }}
            userEmail={user?.email}
            onSignOut={handleSignOut}
          />
        )}
        </div>
      </main>

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
