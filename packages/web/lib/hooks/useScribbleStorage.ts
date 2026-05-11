"use client";

import { useState, useEffect } from "react";
import { storageService } from "../services/storage.service";

export function useScribbleStorage() {
  const [isLoading, setIsLoading] = useState(true);
  const [formattedScribble, setFormattedScribble] = useState("");
  const [rawText, setRawText] = useState("");
  const [title, setTitle] = useState("");

  // Load scribble data on mount
  useEffect(() => {
    const scribble = storageService.getScribble();
    if (scribble) {
      setFormattedScribble(scribble.formattedText || "");
      setRawText(scribble.rawText || "");
      setTitle(scribble.title || "");
    }
    setIsLoading(false);
  }, []);

  const saveScribble = (formatted: string, raw: string, scribbleTitle?: string) => {
    storageService.saveScribble(formatted, raw, scribbleTitle);
    setFormattedScribble(formatted);
    setRawText(raw);
    setTitle(scribbleTitle || "");
  };

  const updateFormattedScribble = (text: string) => {
    storageService.updateFormattedScribble(text);
    setFormattedScribble(text);
  };

  const clearScribble = () => {
    storageService.clearScribble();
    setFormattedScribble("");
    setRawText("");
    setTitle("");
  };

  return {
    isLoading,
    formattedScribble,
    rawText,
    title,
    saveScribble,
    updateFormattedScribble,
    clearScribble,
  };
}
