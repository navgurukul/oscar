"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { STTService } from "../services/stt.service";
import { RecordingState } from "../types/recording.types";
import { ERROR_MESSAGES } from "../constants";

export function useRecording() {
  const [state, setState] = useState<RecordingState>(RecordingState.IDLE);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const sttServiceRef = useRef<STTService | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize STT service
  useEffect(() => {
    const initSTT = async () => {
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
      } catch (error: unknown) {
        const err = error as Error;
        console.error("[useRecording] Initialization error:", error);
        setError(err?.message || ERROR_MESSAGES.STT_INIT_FAILED);
        setState(RecordingState.ERROR);
      }
    };

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

    // Data
    currentTranscript,
    recordingTime,
    error,

    // Actions
    startRecording,
    stopRecording,
    clearError,
  };
}
