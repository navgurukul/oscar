"use client";

import { aiService } from "../services/ai.service";
import { useAIOperation } from "./useAIOperation";

export function useAIEmailFormatting() {
  return useAIOperation(
    (signal, rawText: string, title?: string) =>
      aiService.formatEmailText(rawText, title, signal)
  );
}
