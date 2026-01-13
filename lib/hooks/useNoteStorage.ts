"use client";

import { useState, useEffect } from "react";
import { storageService } from "../services/storage.service";

export function useNoteStorage() {
  const [isLoading, setIsLoading] = useState(true);
  const [formattedNote, setFormattedNote] = useState("");
  const [rawText, setRawText] = useState("");
  const [title, setTitle] = useState("");

  // Load note data on mount
  useEffect(() => {
    const note = storageService.getNote();
    if (note) {
      setFormattedNote(note.formattedText || "");
      setRawText(note.rawText || "");
      setTitle(note.title || "");
    }
    setIsLoading(false);
  }, []);

  const saveNote = (formatted: string, raw: string, noteTitle?: string) => {
    storageService.saveNote(formatted, raw, noteTitle);
    setFormattedNote(formatted);
    setRawText(raw);
    if (noteTitle) setTitle(noteTitle);
  };

  const updateFormattedNote = (text: string) => {
    storageService.updateFormattedNote(text);
    setFormattedNote(text);
  };

  const updateTitle = (newTitle: string) => {
    storageService.updateTitle(newTitle);
    setTitle(newTitle);
  };

  const clearNote = () => {
    storageService.clearNote();
    setFormattedNote("");
    setRawText("");
    setTitle("");
  };

  return {
    isLoading,
    formattedNote,
    rawText,
    title,
    saveNote,
    updateFormattedNote,
    updateTitle,
    clearNote,
  };
}
