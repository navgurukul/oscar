"use client";

import { aiService } from "../services/ai.service";
import { useAIOperation } from "./useAIOperation";

export function useAIFormatting() {
  return useAIOperation(
    (signal, rawText: string) => aiService.formatText(rawText, signal)
  );
}
