"use client";

import { aiService } from "../services/ai.service";
import { useAIOperation } from "./useAIOperation";

export function useAIFormatting() {
  return useAIOperation(
    (signal, rawText: string, onChunk?: (text: string) => void) =>
      aiService.formatText(rawText, signal, onChunk)
  );
}
