"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { STTService } from "../services/stt.service";
import { permissionService } from "../services/permission.service";
import { RecordingState } from "../types/recording.types";
import { ERROR_MESSAGES, PERMISSION_CONFIG } from "../constants";

export function useRecording() {
  const [state, setState] = useState<RecordingState>(RecordingState.IDLE);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [permissionRetryCount, setPermissionRetryCount] = useState(0);

  const sttServiceRef = useRef<STTService | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize STT service
  const initSTT = useCallback(async () => {
    setState(RecordingState.INITIALIZING);
    setError(null);

    try {
      const service = new STTService();

      // Update state to indicate we're requesting permission
      setState(RecordingState.REQUESTING_PERMISSION);

      // This will now prompt for permission during initialization
      await service.initialize((transcript) => {
        setCurrentTranscript(transcript);
      });

      sttServiceRef.current = service;
      setState(RecordingState.READY);
      // Reset retry count on successful init
      setPermissionRetryCount(0);
    } catch (error: unknown) {
      const err = error as Error;
      console.error("[useRecording] Initialization error:", error);
      const errorMsg = err?.message || ERROR_MESSAGES.STT_INIT_FAILED;

      // Check if this is a permission denied error
      if (permissionService.isPermissionDeniedError(errorMsg)) {
        setError(permissionService.getErrorMessage(permissionRetryCount));
        setState(RecordingState.PERMISSION_DENIED);
      } else {
        setError(errorMsg);
        setState(RecordingState.ERROR);
      }
    }
  }, [permissionRetryCount]);

  // Initial initialization on mount
  useEffect(() => {
    initSTT();

    // Cleanup on unmount
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (sttServiceRef.current) {
        sttServiceRef.current.destroy();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start timer when recording
  useEffect(() => {
    if (state === RecordingState.RECORDING) {
      setRecordingTime(0);
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [state]);

  /**
   * Retry permission request after denial
   */
  const retryPermission = useCallback(async () => {
    if (permissionRetryCount >= PERMISSION_CONFIG.MAX_RETRY_ATTEMPTS) {
      setError(ERROR_MESSAGES.PERMISSION_BLOCKED);
      return;
    }

    // Destroy existing service if any
    if (sttServiceRef.current) {
      sttServiceRef.current.destroy();
      sttServiceRef.current = null;
    }

    setPermissionRetryCount((prev) => prev + 1);

    // Small delay before retry to give browser time to reset
    await new Promise((resolve) =>
      setTimeout(resolve, PERMISSION_CONFIG.RETRY_DELAY_MS)
    );

    await initSTT();
  }, [permissionRetryCount, initSTT]);

  const startRecording = useCallback(
    async (seedTranscript?: string) => {
      if (!sttServiceRef.current || state === RecordingState.RECORDING) {
        return;
      }

      setError(null);
      setState(RecordingState.RECORDING);

      try {
        await sttServiceRef.current.startRecording(seedTranscript);
      } catch (error: unknown) {
        const err = error as Error;
        console.error("[useRecording] Start error:", error);
        setError(err?.message || ERROR_MESSAGES.RECORDING_FAILED);
        setState(RecordingState.ERROR);
      }
    },
    [state]
  );

  const stopRecording = useCallback(async (): Promise<string> => {
    if (!sttServiceRef.current || state !== RecordingState.RECORDING) {
      return currentTranscript;
    }

    setState(RecordingState.PROCESSING);
    setError(null);

    try {
      const finalTranscript = await sttServiceRef.current.stopRecording();
      setState(RecordingState.READY);
      return finalTranscript;
    } catch (error: unknown) {
      const err = error as Error;
      console.error("[useRecording] Stop error:", error);
      setError(err?.message || ERROR_MESSAGES.PROCESSING_FAILED);
      setState(RecordingState.ERROR);
      return currentTranscript;
    }
  }, [state, currentTranscript]);

  const clearError = useCallback(() => {
    setError(null);
    if (state === RecordingState.ERROR) {
      setState(RecordingState.READY);
    }
  }, [state]);

  return {
    // State
    state,
    isInitializing: state === RecordingState.INITIALIZING,
    isRequestingPermission: state === RecordingState.REQUESTING_PERMISSION,
    isReady: state === RecordingState.READY,
    isRecording: state === RecordingState.RECORDING,
    isProcessing: state === RecordingState.PROCESSING,
    hasError: state === RecordingState.ERROR,
    isPermissionDenied: state === RecordingState.PERMISSION_DENIED,

    // Data
    currentTranscript,
    recordingTime,
    error,
    permissionRetryCount,
    canRetryPermission:
      permissionRetryCount < PERMISSION_CONFIG.MAX_RETRY_ATTEMPTS,

    // Actions
    startRecording,
    stopRecording,
    clearError,
    retryPermission,
  };
}
