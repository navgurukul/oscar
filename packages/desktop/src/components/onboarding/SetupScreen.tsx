import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
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
import type { DownloadProgress } from "../../lib/app-types";
import { CoverShowcase } from "./CoverShowcase";
import { StepIndicator } from "./StepIndicator";

interface SetupScreenProps {
  onComplete: () => Promise<void> | void;
}

type Phase = "detecting" | "ready" | "downloading" | "error";

export function SetupScreen({ onComplete }: SetupScreenProps) {
  const [phase, setPhase] = useState<Phase>("detecting");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [hardware, setHardware] = useState<HardwareProfile | null>(null);
  const [recommendation, setRecommendation] =
    useState<ModelRecommendation | null>(null);

  // Detect hardware + compute recommendation up front so the download prompt
  // can show the user a size and a one-line "why this model" before they
  // commit to the download.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [hw, { recommendation: rec, resolved }] = await Promise.all([
          detectHardware(),
          resolveModelForRole("dictation", "auto"),
        ]);
        if (cancelled) return;
        setHardware(hw);
        setRecommendation(rec);

        // Already installed — skip download entirely.
        if (resolved) {
          await onComplete();
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
  }, [onComplete]);

  const downloadAndComplete = async () => {
    if (!recommendation) return;
    setPhase("downloading");
    setError("");
    setProgress({ downloaded: 0, total: recommendation.spec.sizeBytes, percentage: 0 });

    const unlisten = await listen<DownloadProgress>(
      "download-progress",
      (event) => {
        setProgress(event.payload);
      },
    );

    try {
      await downloadModel(recommendation.spec);
      unlisten();
      // Opportunistic — never block setup on cleanup.
      void cleanupLegacyModels([recommendation.spec.variant]);
      await onComplete();
    } catch (downloadError) {
      unlisten();
      setError(`Download failed: ${downloadError}`);
      setPhase("ready");
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
