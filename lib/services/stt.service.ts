// STT (Speech-to-Text) service for managing recording lifecycle

import type { STTLogic } from "speech-to-speech";
import type { RecordingConfig } from "../types/recording.types";
import { browserService } from "./browser.service";
import { ERROR_MESSAGES, RECORDING_CONFIG } from "../constants";

type TranscriptCallback = (transcript: string) => void;
type LogCallback = (message: string, level?: string) => void;

export class STTService {
  private sttInstance: STTLogic | null = null;
  private accumulatedTranscript: string = "";
  private transcriptCallback: TranscriptCallback | null = null;
  private isRecordingActive: boolean = false;
  private restartInterval: NodeJS.Timeout | null = null;
  private lastRestartTime: number = 0;
  private isRestarting: boolean = false;
  private lastTranscriptTime: number = 0;

  /**
   * Initialize the STT service
   * @param onTranscriptUpdate - Callback for transcript updates
   * @param config - Optional configuration
   */
  async initialize(
    onTranscriptUpdate: TranscriptCallback,
    config?: RecordingConfig
  ): Promise<void> {
    // Check browser support
    if (!browserService.isSpeechRecognitionSupported()) {
      throw new Error(ERROR_MESSAGES.BROWSER_NOT_SUPPORTED);
    }

    // Request microphone permission BEFORE initializing STT
    // This prevents race conditions where recording starts before permission is granted
    const permissionResult = await browserService.checkMicrophonePermission();
    if (!permissionResult.granted) {
      throw new Error(
        permissionResult.error || ERROR_MESSAGES.MIC_PERMISSION_DENIED
      );
    }

    try {
      const { STTLogic } = await import("speech-to-speech");

      this.transcriptCallback = onTranscriptUpdate;

      // Create STT instance with transcript callback
      this.sttInstance = new STTLogic(
        this.createLogCallback(),
        (transcript) => this.handleTranscriptUpdate(transcript),
        {
          sessionDurationMs:
            config?.sessionDurationMs || RECORDING_CONFIG.SESSION_DURATION_MS,
          interimSaveIntervalMs:
            config?.interimSaveIntervalMs ||
            RECORDING_CONFIG.INTERIM_SAVE_INTERVAL_MS,
          preserveTranscriptOnStart: config?.preserveTranscriptOnStart ?? true,
        }
      );

      // Set up words update callback for real-time tracking
      this.sttInstance.setWordsUpdateCallback((words) => {
        console.log("[STT] Words update:", words);
      });

      // Pre-warm recognition to reduce first-start latency
      // This starts and stops quickly so the WASM/runtime loads upfront
      try {
        this.sttInstance.start();
        setTimeout(() => {
          try {
            this.sttInstance?.stop();
          } catch (e) {
            console.debug("[STT] Warm-up stop failed:", e);
          }
        }, 300);
      } catch (e) {
        console.debug("[STT] Warm-up start failed:", e);
      }
    } catch (error) {
      console.error("[STT] Initialization error:", error);
      throw new Error(ERROR_MESSAGES.STT_INIT_FAILED);
    }
  }

  /**
   * Start recording with optional seed transcript for continuation
   */
  async startRecording(seedTranscript?: string): Promise<void> {
    if (!this.sttInstance) {
      throw new Error(ERROR_MESSAGES.STT_NOT_INITIALIZED);
    }

    try {
      // Seed transcript if continuing - this is critical for continue mode
      if (seedTranscript && seedTranscript.trim()) {
        this.accumulatedTranscript = seedTranscript.trim();
        // Update callback immediately to show previous transcript
        if (this.transcriptCallback) {
          this.transcriptCallback(this.accumulatedTranscript);
        }
      } else {
        this.accumulatedTranscript = "";
      }

      // Ensure we're not in a restart state
      this.isRestarting = false;
      this.lastRestartTime = Date.now();

      // Start STT immediately for continuous recording
      // The library handles its own restarts internally, so we don't need preemptive restarts
      this.sttInstance.start();
      this.isRecordingActive = true;
      this.lastTranscriptTime = Date.now();

      // Lightweight silence watchdog to minimize restart gaps
      if (this.restartInterval) {
        clearInterval(this.restartInterval);
      }
      this.restartInterval = setInterval(() => {
        if (!this.isRecordingActive || !this.sttInstance) return;

        const now = Date.now();
        const sinceLast = now - this.lastTranscriptTime;
        const sinceRestart = now - this.lastRestartTime;

        if (
          sinceLast >= RECORDING_CONFIG.SILENCE_RESTART_THRESHOLD_MS &&
          sinceRestart >= RECORDING_CONFIG.MIN_RESTART_GAP_MS
        ) {
          try {
            this.sttInstance.start();
            this.lastRestartTime = now;
          } catch (e) {
            console.debug("[STT] Watchdog restart failed:", e);
          }
        }
      }, 250);

      // Note: We removed the preemptive restart strategy because the speech-to-speech
      // library handles restarts internally. Our manual restarts were conflicting with
      // the library's own restart mechanism, causing the "produced no result" warnings.
    } catch (error) {
      this.isRecordingActive = false;
      this.isRestarting = false;
      console.error("[STT] Start recording error:", error);
      throw new Error(ERROR_MESSAGES.RECORDING_FAILED);
    }
  }

  /**
   * Stop recording and return final transcript
   */
  async stopRecording(): Promise<string> {
    if (!this.sttInstance || !this.isRecordingActive) {
      return this.accumulatedTranscript;
    }

    try {
      this.isRecordingActive = false;

      // Clear any restart interval (though we don't use it anymore)
      if (this.restartInterval) {
        clearInterval(this.restartInterval);
        this.restartInterval = null;
      }

      // Ensure we're not restarting
      this.isRestarting = false;

      // Get current transcript before stopping to capture everything
      // This ensures we have the latest from the library, merged with our accumulated
      const currentTranscript = this.sttInstance.getFullTranscript();
      if (currentTranscript && currentTranscript.trim()) {
        this.accumulatedTranscript = this.mergeTranscripts(
          this.accumulatedTranscript,
          currentTranscript.trim()
        );
      }

      // Stop STT
      this.sttInstance.stop();

      // Wait for final transcript processing
      await new Promise((resolve) =>
        setTimeout(resolve, RECORDING_CONFIG.STOP_PROCESSING_DELAY_MS)
      );

      // Get final transcript - prefer accumulated, fallback to instance
      const finalTranscript =
        this.accumulatedTranscript.trim() ||
        this.sttInstance.getFullTranscript().trim();

      return finalTranscript;
    } catch (error) {
      console.error("[STT] Stop recording error:", error);
      return this.accumulatedTranscript;
    }
  }

  /**
   * Get current accumulated transcript
   */
  getTranscript(): string {
    return this.accumulatedTranscript;
  }

  /**
   * Destroy and cleanup STT instance
   */
  destroy(): void {
    if (this.restartInterval) {
      clearInterval(this.restartInterval);
      this.restartInterval = null;
    }

    this.isRestarting = false;
    this.isRecordingActive = false;

    if (this.sttInstance) {
      try {
        this.sttInstance.destroy();
      } catch (error) {
        console.error("[STT] Destroy error:", error);
      }
      this.sttInstance = null;
    }

    this.accumulatedTranscript = "";
    this.transcriptCallback = null;
  }

  /**
   * Handle transcript updates from STT
   * Ensures continuous transcript accumulation even during restarts
   * Properly handles continue mode by merging seed transcript with new updates
   */
  private handleTranscriptUpdate(transcript: string): void {
    if (!transcript) return;
    this.lastTranscriptTime = Date.now();

    // Merge new transcript with accumulated (which may include seed transcript)
    // The library's internal restarts preserve transcript, so we merge intelligently
    const merged = this.mergeTranscripts(
      this.accumulatedTranscript,
      transcript
    );
    this.accumulatedTranscript = merged;

    if (this.transcriptCallback) {
      this.transcriptCallback(merged);
    }
  }

  /**
   * Merge incoming transcript with accumulated transcript
   * Handles browser restarts and prevents duplication
   * Ensures seed transcript (from continue mode) is preserved
   */
  private mergeTranscripts(previous: string, incoming: string): string {
    if (!incoming) return previous;
    if (!previous) return incoming;

    // Normalize whitespace for comparison
    const prevTrimmed = previous.trim();
    const incTrimmed = incoming.trim();

    // If incoming is a superset (contains all of previous), prefer it
    if (incTrimmed.startsWith(prevTrimmed)) return incTrimmed;
    if (incTrimmed.includes(prevTrimmed)) return incTrimmed;

    // If incoming is wholly contained in previous, keep previous to preserve seed
    if (prevTrimmed.includes(incTrimmed)) return prevTrimmed;

    // Compute maximal overlap where previous suffix equals incoming prefix
    // This handles cases where library restarts and sends partial transcripts
    const max = Math.min(prevTrimmed.length, incTrimmed.length);
    for (let i = max; i > 0; i--) {
      if (prevTrimmed.slice(-i) === incTrimmed.slice(0, i)) {
        return prevTrimmed + incTrimmed.slice(i);
      }
    }

    // Fallback: append with separating space
    // This ensures seed transcript is preserved and new content is appended
    return prevTrimmed + (prevTrimmed.endsWith(" ") ? "" : " ") + incTrimmed;
  }

  /**
   * NOTE: Preemptive restart strategy has been removed.
   * 
   * The speech-to-speech library handles restarts internally and automatically.
   * Our manual restart strategy was conflicting with the library's own restart
   * mechanism, causing:
   * - "produced no result within 2000ms" warnings
   * - Frequent unnecessary restarts
   * - Audio loss during restart gaps
   * 
   * The library's internal restart mechanism:
   * - Automatically restarts sessions when needed
   * - Preserves transcript during restarts (via preserveTranscriptOnStart)
   * - Handles silence gates and buffering internally
   * - Is optimized for continuous recording
   * 
   * We now rely entirely on the library's built-in restart handling.
   */

  /**
   * Create log callback for STT instance
   */
  private createLogCallback(): LogCallback {
    return (message: string, level?: string) => {
      console.log(`[STT ${level || "info"}]`, message);
    };
  }
}

// Export singleton instance
export const sttService = new STTService();
