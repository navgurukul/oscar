"use client";

/**
 * Generic hook factory for AI service operations that need:
 * - loading state
 * - error state
 * - request cancellation via AbortController
 * - cleanup on unmount
 *
 * Usage:
 *   const { isFormatting, formattingError, formatText, cancelFormatting } =
 *     useAIOperation((signal, rawText: string) => aiService.formatText(rawText, signal));
 */

import { useState, useRef, useEffect, useCallback } from "react";
import type { FormattingResult } from "../types/note.types";

type AIOperationFn<TArgs extends unknown[]> = (
  signal: AbortSignal,
  ...args: TArgs
) => Promise<FormattingResult>;

export function useAIOperation<TArgs extends unknown[]>(
  operation: AIOperationFn<TArgs>
) {
  const [isFormatting, setIsFormatting] = useState(false);
  const [formattingError, setFormattingError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Abort any in-flight request when the component unmounts
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const formatText = useCallback(
    async (...args: TArgs): Promise<FormattingResult> => {
      // Cancel any previous request before starting a new one
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      setIsFormatting(true);
      setFormattingError(null);

      try {
        const result = await operation(abortControllerRef.current.signal, ...args);
        if (!result.success) {
          setFormattingError(result.error ?? "Operation failed");
        }
        return result;
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Operation failed";
        setFormattingError(msg);
        return { success: false, error: msg };
      } finally {
        setIsFormatting(false);
      }
    },
    // operation is stable (defined at module level or memoised by caller)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const cancelFormatting = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsFormatting(false);
    }
  }, []);

  return { isFormatting, formattingError, formatText, cancelFormatting };
}
