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
      this.sttInstance.start();
      this.isRecordingActive = true;
      this.lastTranscriptTime = Date.now();

      // Hybrid restart strategy: Library handles internal restarts + our silence watchdog
      // The library's internal restarts handle session timeouts and browser limits
      // Our watchdog handles silence gaps to ensure continuous recording during pauses
      // Both work together: library for session management, watchdog for silence recovery
      if (this.restartInterval) {
        clearInterval(this.restartInterval);
      }
      this.restartInterval = setInterval(() => {
        if (!this.isRecordingActive || !this.sttInstance || this.isRestarting) {
          return;
        }

        const now = Date.now();
        const sinceLastTranscript = now - this.lastTranscriptTime;
        const sinceLastRestart = now - this.lastRestartTime;

        // Only restart if:
        // 1. Silence detected (no transcript updates for threshold time)
        // 2. Enough time has passed since last restart (avoid rapid restarts)
        // 3. Not already restarting (library might be handling a restart)
        if (
          sinceLastTranscript >= RECORDING_CONFIG.SILENCE_RESTART_THRESHOLD_MS &&
          sinceLastRestart >= RECORDING_CONFIG.MIN_RESTART_GAP_MS
        ) {
          try {
            // Lightweight restart: just call start() to wake up recognition
            // This doesn't stop the current session, just ensures it's active
            // The library's preserveTranscriptOnStart ensures no data loss
            this.sttInstance.start();
            this.lastRestartTime = now;
          } catch (e) {
            // Silently handle - library might be in the middle of its own restart
            console.debug("[STT] Watchdog restart skipped (library handling):", e);
          }
        }
      }, 250);
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
   * Hybrid Restart Strategy:
   * 
   * We use a combination of the library's internal restarts and our silence watchdog:
   * 
   * 1. Library's Internal Restarts:
   *    - Handles session timeouts (iOS Safari ~30s limit)
   *    - Manages browser recognition limits
   *    - Preserves transcript during restarts (via preserveTranscriptOnStart)
   *    - Optimized for continuous recording
   * 
   * 2. Our Silence Watchdog:
   *    - Monitors for silence gaps (no transcript updates)
   *    - Proactively restarts recognition during long pauses
   *    - Ensures recording continues even after silence
   *    - Lightweight: only calls start() without stopping
   * 
   * Both work together:
   * - Library handles session management and browser limits
   * - Watchdog handles silence recovery and gap prevention
   * - No conflicts: watchdog checks timing and state before restarting
   * - preserveTranscriptOnStart ensures no data loss during either restart type
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
