// STT (Speech-to-Text) service for managing recording lifecycle

import type { STTLogic } from 'speech-to-speech'
import type { RecordingConfig } from '../types/recording.types'
import { browserService } from './browser.service'
import { ERROR_MESSAGES } from '../constants/errors'

type TranscriptCallback = (transcript: string) => void
type LogCallback = (message: string, level?: string) => void

export class STTService {
  private sttInstance: STTLogic | null = null
  private accumulatedTranscript: string = ''
  private transcriptCallback: TranscriptCallback | null = null
  private isRecordingActive: boolean = false
  private restartInterval: NodeJS.Timeout | null = null

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
      throw new Error(ERROR_MESSAGES.BROWSER_NOT_SUPPORTED)
    }

    try {
      const { STTLogic } = await import('speech-to-speech')
      
      this.transcriptCallback = onTranscriptUpdate

      // Create STT instance with transcript callback
      this.sttInstance = new STTLogic(
        this.createLogCallback(),
        (transcript) => this.handleTranscriptUpdate(transcript),
        {
          sessionDurationMs: config?.sessionDurationMs || 60000,
          interimSaveIntervalMs: config?.interimSaveIntervalMs || 1000,
          preserveTranscriptOnStart: config?.preserveTranscriptOnStart ?? true,
        }
      )

      // Set up words update callback for real-time tracking
      this.sttInstance.setWordsUpdateCallback((words) => {
        console.log('[STT] Words update:', words)
      })

    } catch (error) {
      console.error('[STT] Initialization error:', error)
      throw new Error(ERROR_MESSAGES.STT_INIT_FAILED)
    }
  }

  /**
   * Start recording with optional seed transcript for continuation
   */
  async startRecording(seedTranscript?: string): Promise<void> {
    if (!this.sttInstance) {
      throw new Error('STT not initialized')
    }

    // Check microphone permission
    const permissionResult = await browserService.checkMicrophonePermission()
    if (!permissionResult.granted) {
      throw new Error(permissionResult.error || ERROR_MESSAGES.MIC_PERMISSION_DENIED)
    }

    try {
      // Seed transcript if continuing
      if (seedTranscript) {
        this.accumulatedTranscript = seedTranscript
        if (this.transcriptCallback) {
          this.transcriptCallback(seedTranscript)
        }
      } else {
        this.accumulatedTranscript = ''
      }

      // Start STT
      this.sttInstance.start()
      this.isRecordingActive = true

      // iOS Safari specific restart strategy
      if (browserService.isIOSSafari()) {
        this.startPreemptiveRestartStrategy()
      }

    } catch (error) {
      this.isRecordingActive = false
      console.error('[STT] Start recording error:', error)
      throw new Error(ERROR_MESSAGES.RECORDING_FAILED)
    }
  }

  /**
   * Stop recording and return final transcript
   */
  async stopRecording(): Promise<string> {
    if (!this.sttInstance || !this.isRecordingActive) {
      return this.accumulatedTranscript
    }

    try {
      this.isRecordingActive = false
      
      // Clear iOS restart interval
      if (this.restartInterval) {
        clearInterval(this.restartInterval)
        this.restartInterval = null
      }

      // Stop STT
      this.sttInstance.stop()

      // Wait for final transcript processing
      await new Promise(resolve => setTimeout(resolve, 1500))

      // Get final transcript
      const finalTranscript = this.accumulatedTranscript.trim() || 
                            this.sttInstance.getFullTranscript().trim()

      return finalTranscript
    } catch (error) {
      console.error('[STT] Stop recording error:', error)
      return this.accumulatedTranscript
    }
  }

  /**
   * Get current accumulated transcript
   */
  getTranscript(): string {
    return this.accumulatedTranscript
  }

  /**
   * Destroy and cleanup STT instance
   */
  destroy(): void {
    if (this.restartInterval) {
      clearInterval(this.restartInterval)
      this.restartInterval = null
    }

    if (this.sttInstance) {
      try {
        this.sttInstance.destroy()
      } catch (error) {
        console.error('[STT] Destroy error:', error)
      }
      this.sttInstance = null
    }

    this.accumulatedTranscript = ''
    this.transcriptCallback = null
    this.isRecordingActive = false
  }

  /**
   * Handle transcript updates from STT
   */
  private handleTranscriptUpdate(transcript: string): void {
    if (!transcript) return

    const merged = this.mergeTranscripts(this.accumulatedTranscript, transcript)
    this.accumulatedTranscript = merged

    if (this.transcriptCallback) {
      this.transcriptCallback(merged)
    }
  }

  /**
   * Merge incoming transcript with accumulated transcript
   * Handles browser restarts and prevents duplication
   */
  private mergeTranscripts(previous: string, incoming: string): string {
    if (!incoming) return previous
    if (!previous) return incoming

    // If incoming is a superset, prefer it
    if (incoming.startsWith(previous)) return incoming
    if (incoming.includes(previous)) return incoming

    // If incoming is wholly contained, ignore to avoid repeats
    if (previous.includes(incoming)) return previous

    // Compute maximal overlap where previous suffix equals incoming prefix
    const max = Math.min(previous.length, incoming.length)
    for (let i = max; i > 0; i--) {
      if (previous.slice(-i) === incoming.slice(0, i)) {
        return previous + incoming.slice(i)
      }
    }

    // Fallback: append with separating space
    return previous + (previous.endsWith(' ') ? '' : ' ') + incoming
  }

  /**
   * Start preemptive restart strategy for iOS Safari
   * iOS Safari stops recognition after ~30s, so we restart proactively
   */
  private startPreemptiveRestartStrategy(): void {
    if (this.restartInterval) {
      clearInterval(this.restartInterval)
    }

    this.restartInterval = setInterval(() => {
      if (!this.isRecordingActive || !this.sttInstance) {
        return
      }

      try {
        // Quick stop-start to prevent iOS cutoff
        this.sttInstance.stop()
        setTimeout(() => {
          try {
            if (this.isRecordingActive && this.sttInstance) {
              this.sttInstance.start()
            }
          } catch (error) {
            console.warn('[STT] Preemptive restart start failed:', error)
          }
        }, 150)
      } catch (error) {
        console.warn('[STT] Preemptive restart stop failed:', error)
      }
    }, 25000) // Restart every 25 seconds
  }

  /**
   * Create log callback for STT instance
   */
  private createLogCallback(): LogCallback {
    return (message: string, level?: string) => {
      console.log(`[STT ${level || 'info'}]`, message)
    }
  }
}

// Export singleton instance
export const sttService = new STTService()
