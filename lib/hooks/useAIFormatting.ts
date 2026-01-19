"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { aiService } from "../services/ai.service";
import type { FormattingResult } from "../types/note.types";

export function useAIFormatting() {
  const [isFormatting, setIsFormatting] = useState(false);
  const [formattingError, setFormattingError] = useState<string | null>(null);

  // AbortController for cancellation
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const formatText = useCallback(
    async (rawText: string): Promise<FormattingResult> => {
      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller for this request
      abortControllerRef.current = new AbortController();

      setIsFormatting(true);
      setFormattingError(null);

      try {
        const result = await aiService.formatText(
          rawText,
          abortControllerRef.current.signal
        );

        if (!result.success) {
          setFormattingError(result.error || "Failed to format text");
        }

        return result;
      } catch (error: unknown) {
        const err = error as Error;
        const errorMsg = err?.message || "Failed to format text";
        setFormattingError(errorMsg);
        return {
          success: false,
          error: errorMsg,
        };
      } finally {
        setIsFormatting(false);
      }
    },
    []
  );

  const cancelFormatting = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsFormatting(false);
    }
  }, []);

  return {
    isFormatting,
    formattingError,
    formatText,
    cancelFormatting,
  };
}
