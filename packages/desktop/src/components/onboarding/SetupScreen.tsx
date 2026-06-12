import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";
import {
  detectHardware,
  formatModelSize,
  modelDisplayName,
  type HardwareProfile,
  type ModelRecommendation,
} from "../../lib/whisper-models";
import {
  cleanupLegacyModels,
  downloadModel,
  resolveModelForRole,
} from "../../lib/whisper-model-manager";
import type { DownloadProgress, DownloadRetry } from "../../lib/app-types";
import { CoverShowcase } from "./CoverShowcase";
import { StepIndicator } from "./StepIndicator";

interface SetupScreenProps {
  onComplete: () => Promise<void> | void;
  // Current transcription language (e.g. "hi-en"). Onboarding resolves the
  // model the app will actually use for this language, so we download it once
  // here instead of fetching a general model and then re-downloading the
  // language-specific one on first launch.
  transcriptionLanguage: string;
}

type Phase = "detecting" | "ready" | "downloading" | "error";

export function SetupScreen({
  onComplete,
  transcriptionLanguage,
}: SetupScreenProps) {
  const [phase, setPhase] = useState<Phase>("detecting");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [retry, setRetry] = useState<DownloadRetry | null>(null);
  const [hardware, setHardware] = useState<HardwareProfile | null>(null);
  const [recommendation, setRecommendation] =
    useState<ModelRecommendation | null>(null);

  // Always read the *latest* onComplete via a ref. Keeping it in the
  // detection effect's dep array would re-run the effect every time the
  // parent re-renders (the callback's identity is not stable), wiping the
  // in-flight "downloading" phase back to "ready" mid-download.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Re-entry guard: a stray second click on "Download Model" must not start a
  // second concurrent backend download — two tasks racing on the same
  // `.partial` file produce interleaved progress events and corrupt the file.
  const downloadingRef = useRef(false);

  // Detect hardware + compute recommendation up front so the download prompt
  // can show the user a size and a one-line "why this model" before they
  // commit to the download. Mount-only: re-running this on every parent
  // re-render would clobber the "downloading" phase.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [hw, { recommendation: rec, resolved }] = await Promise.all([
          detectHardware(),
          resolveModelForRole("dictation", "auto", transcriptionLanguage),
        ]);
        if (cancelled) return;
        setHardware(hw);
        setRecommendation(rec);

        // Already installed — skip download entirely.
        if (resolved) {
          await onCompleteRef.current();
          return;
        }

        setPhase("ready");
      } catch (e) {
        if (cancelled) return;
        setError(`Hardware detection failed: ${e}`);
        setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only by design; see onCompleteRef above
  }, []);

  const downloadAndComplete = async () => {
    if (!recommendation || downloadingRef.current) return;
    downloadingRef.current = true;
    setPhase("downloading");
    setError("");
    setRetry(null);
    setProgress({
      variant: recommendation.spec.variant,
      downloaded: 0,
      total: recommendation.spec.sizeBytes,
      percentage: 0,
    });

    const unlistenProgress = await listen<DownloadProgress>(
      "download-progress",
      (event) => {
        // A retry has produced fresh bytes — clear the retry banner so the
        // progress bar takes over visually.
        setRetry(null);
        setProgress(event.payload);
      },
    );
    const unlistenRetry = await listen<DownloadRetry>(
      "download-retry",
      (event) => {
        setRetry(event.payload);
      },
    );

    try {
      await downloadModel(recommendation.spec, recommendation.spec.sha256);
      // Opportunistic — never block setup on cleanup.
      void cleanupLegacyModels([recommendation.spec.variant]);
      await onCompleteRef.current();
    } catch (downloadError) {
      setError(`Download failed: ${downloadError}`);
      setRetry(null);
      setPhase("ready");
    } finally {
      unlistenProgress();
      unlistenRetry();
      downloadingRef.current = false;
    }
  };

  const renderLeftPane = () => {
    if (phase === "detecting") {
      return (
        <>
          <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-terracotta">
            03 · ACTIVE · DETECTING HARDWARE
          </span>
          <h1 className="split-title">
            Picking the <em className="italic text-terracotta">right model</em>.
          </h1>
          <p className="split-description">
            Choosing the best speech model for your machine.
          </p>
        </>
      );
    }

    if (phase === "downloading" && recommendation) {
      const pct = progress?.percentage ?? 0;
      return (
        <>
          <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-terracotta">
            03 · DOWNLOADING · MODEL
          </span>
          <h1 className="split-title">
            Warming up the <em className="italic text-terracotta">engines</em>.
          </h1>
          <p className="split-description">
            Downloading {modelDisplayName(recommendation.spec.variant)} (
            {formatModelSize(recommendation.spec.sizeBytes)}). Processed
            entirely on your device — this only happens once.
          </p>
          <div className="setup-loading">
            <div className="download-progress-container">
              <div className="download-progress-bar">
                <div
                  className="download-progress-fill"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-1.5 text-right text-[0.8rem] text-slate-500">
                {pct ? `${Math.round(pct)}%` : "Starting..."}
              </p>
            </div>
            {retry && (
              <p className="mt-2 text-[0.8rem] text-slate-500">
                Connection interrupted — retrying ({retry.attempt}/
                {retry.max_attempts}) in {retry.delay_secs}s. Resuming where
                we left off.
              </p>
            )}
            {error && <p className="setup-error">{error}</p>}
          </div>
        </>
      );
    }

    // ready | error
    return (
      <>
        <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-terracotta">
          03 · READY · FIRST SCRIBBLE
        </span>
        <h1 className="split-title">
          Try a <em className="italic text-terracotta">practice run</em>.
        </h1>
        <p className="split-description">
          OSCAR runs speech recognition locally on your device.
          {recommendation
            ? ` We picked ${modelDisplayName(recommendation.spec.variant)} (${formatModelSize(recommendation.spec.sizeBytes)}) for your hardware.`
            : ""}
        </p>
        {hardware && (
          <p
            className="split-description"
            style={{ marginTop: 8, opacity: 0.7, fontSize: "0.85rem" }}
          >
            Detected: {hardware.ramGb} GB RAM · {hardware.cpuCores} CPU cores
            {hardware.gpuBackend !== "none" &&
              ` · ${hardware.gpuBackend.toUpperCase()} acceleration`}
          </p>
        )}
        {error && <p className="setup-error">{error}</p>}
        <button
          type="button"
          className="perm-continue-btn-modern active"
          onClick={downloadAndComplete}
          disabled={!recommendation}
        >
          Download Model
        </button>
      </>
    );
  };

  return (
    <div className="split-layout">
      <StepIndicator currentStep="setup" />
      <div className="split-layout-inner">
        <div className="split-left">
          <div className="split-content">
            <div className="brand-header">
              <img
                src="/oscar-light-logo.svg"
                alt="OSCAR"
                width="36"
                height="36"
              />
              <span className="brand-name">OSCAR</span>
            </div>
            {renderLeftPane()}
          </div>
        </div>
        <div className="split-right">
          <CoverShowcase />
        </div>
      </div>
    </div>
  );
}
