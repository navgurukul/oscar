import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { SYSTEM_AUDIO_SETTINGS_URL } from "../../lib/desktop-constants";
import { getMicrophonePermissionState } from "../../lib/desktop-platform";
import { CoverShowcase } from "./CoverShowcase";
import { StepIndicator } from "./StepIndicator";

interface PermissionsScreenProps {
  onContinue: () => void;
  hotkeyWarning?: string;
  onRetryHotkey?: () => Promise<void> | void;
}

export function PermissionsScreen({
  onContinue,
  hotkeyWarning,
  onRetryHotkey,
}: PermissionsScreenProps) {
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

        const granted = await invoke<boolean>("check_system_audio_permission").catch(
          () => false,
        );
        if (granted) {
          setSystemAudioStatus("granted");
        }
      })
      .catch(() => setSystemAudioSupported(false));
  }, []);

  const requestMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMicStatus("granted");
    } catch {
      setMicStatus("denied");
    }
  };

  const requestAccessibility = async () => {
    try {
      const granted = await invoke<boolean>("request_accessibility_permission");
      setAccessibilityEnabled(granted);
      if (granted) {
        await onRetryHotkey?.();
      }
      if (granted) return;

      const interval = setInterval(async () => {
        const trusted = await invoke<boolean>("check_accessibility_permission");
        if (!trusted) return;

        setAccessibilityEnabled(true);
        clearInterval(interval);
        await onRetryHotkey?.();
      }, 1500);
      setTimeout(() => clearInterval(interval), 60_000);
    } catch {
      await openUrl(
        "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
      ).catch(() => {});
    }
  };

  const requestSystemAudio = async () => {
    try {
      const granted = await invoke<boolean>("request_system_audio_permission");
      setSystemAudioStatus(granted ? "granted" : "denied");

      if (granted) return;

      const interval = setInterval(async () => {
        const trusted = await invoke<boolean>("check_system_audio_permission");
        if (!trusted) return;

        setSystemAudioStatus("granted");
        clearInterval(interval);
      }, 1500);
      setTimeout(() => clearInterval(interval), 60_000);
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
                    type="button"
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
                    type="button"
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
                    type="button"
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
              <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-3 text-amber-900">
                <p className="m-0 text-[0.9rem] leading-6">{hotkeyWarning}</p>
                {onRetryHotkey && (
                  <button
                    type="button"
                    className="setup-skip-btn mt-2.5"
                    onClick={() => onRetryHotkey()}
                  >
                    Retry Hotkey
                  </button>
                )}
              </div>
            )}

            <p className="mb-0 mt-5 text-[0.78rem] text-slate-400">
              Next up: downloading the AI speech model (~140 MB, one-time).
            </p>

            <button
              type="button"
              className={`perm-continue-btn-modern mt-2.5 ${canContinue ? "active" : ""}`}
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
