import { homeDir } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useState } from "react";
import {
  MODEL_PATH,
  MODEL_URL,
  OLD_MODEL_PATH,
} from "../../lib/desktop-constants";
import type { DownloadProgress } from "../../lib/app-types";
import { CoverShowcase } from "./CoverShowcase";
import { StepIndicator } from "./StepIndicator";

interface SetupScreenProps {
  onComplete: () => Promise<void> | void;
}

export function SetupScreen({ onComplete }: SetupScreenProps) {
  const [step, setStep] = useState<"download" | "loading">("download");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<DownloadProgress | null>(null);

  const downloadModel = async () => {
    setStep("loading");
    setProgress({ downloaded: 0, total: 1, percentage: 0 });

    const unlisten = await listen<DownloadProgress>("download-progress", (event) => {
      setProgress(event.payload);
    });

    try {
      const home = await homeDir();
      const fullPath = `${home}/${MODEL_PATH}`;

      await invoke("download_whisper_model", {
        url: MODEL_URL,
        path: fullPath,
      });

      unlisten();

      try {
        const oldModelPath = `${home}/${OLD_MODEL_PATH}`;
        const oldExists = await invoke<boolean>("check_file_exists", {
          path: oldModelPath,
        });
        if (oldExists) {
          await invoke("delete_file", { path: oldModelPath });
          console.log("Cleaned up old model file:", oldModelPath);
        }
      } catch (cleanupError) {
        console.warn("Failed to clean up old model:", cleanupError);
      }

      await onComplete();
    } catch (downloadError) {
      unlisten();
      setError(`Something went wrong: ${downloadError}`);
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
                Downloading the speech recognition model (~142 MB). Processed
                entirely on your device — this only happens once.
              </p>

              <div className="setup-loading">
                <div className="download-progress-container">
                  <div className="download-progress-bar">
                    <div
                      className="download-progress-fill"
                      style={{ width: `${progress?.percentage || 0}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-right text-[0.8rem] text-slate-500">
                    {progress?.percentage
                      ? `${Math.round(progress.percentage)}%`
                      : "Starting..."}
                  </p>
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
              OSCAR downloads a local speech model so your recordings can be
              transcribed directly on your Mac.
            </p>

            {error && <p className="setup-error">{error}</p>}

            <button
              type="button"
              className="perm-continue-btn-modern active"
              onClick={downloadModel}
            >
              Download Model
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
