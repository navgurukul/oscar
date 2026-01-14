"use client";

import { useState } from "react";
import { aiService } from "../services/ai.service";
import type { FormattingResult } from "../types/note.types";

export function useAIFormatting() {
  const [isFormatting, setIsFormatting] = useState(false);
  const [formattingError, setFormattingError] = useState<string | null>(null);

  const formatText = async (rawText: string): Promise<FormattingResult> => {
    setIsFormatting(true);
    setFormattingError(null);

    try {
      const result = await aiService.formatText(rawText);

      if (!result.success) {
        setFormattingError(result.error || "Failed to format text");
      }

      return result;
    } catch (error: any) {
      const errorMsg = error?.message || "Failed to format text";
      setFormattingError(errorMsg);
      return {
        success: false,
        error: errorMsg,
      };
    } finally {
      setIsFormatting(false);
    }
  };

  return {
    isFormatting,
    formattingError,
    formatText,
  };
}
