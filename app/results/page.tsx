"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useNoteStorage } from "@/lib/hooks/useNoteStorage";
import { storageService } from "@/lib/services/storage.service";
import { notesService } from "@/lib/services/notes.service";
import { feedbackService } from "@/lib/services/feedback.service";
import { NoteEditor } from "@/components/results/NoteEditor";
import { NoteActions } from "@/components/results/NoteActions";
import { Spinner } from "@/components/ui/spinner";
import { ROUTES, UI_STRINGS } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import type { FeedbackReason } from "@/lib/types/note.types";

export default function ResultsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { isLoading, formattedNote, rawText, title } = useNoteStorage();

  const [showRawTranscript, setShowRawTranscript] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [noteId, setNoteId] = useState<string | null>(null);
  const [isCopying, setIsCopying] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Feedback state
  const [isFeedbackSubmitting, setIsFeedbackSubmitting] = useState(false);
  const [hasFeedbackSubmitted, setHasFeedbackSubmitted] = useState(false);
  const [feedbackValue, setFeedbackValue] = useState<boolean | null>(null);

  // Get the note ID from session storage (set by recording page)
  useEffect(() => {
    const storedNoteId = storageService.getCurrentNoteId();
    if (storedNoteId) {
      setNoteId(storedNoteId);
    }
  }, []);

  // Initialize edited text when formatted note loads
  useEffect(() => {
    if (formattedNote) {
      setEditedText(formattedNote);
    }
  }, [formattedNote]);

  // Redirect if no note - only after loading completes
  useEffect(() => {
    if (!isLoading && !formattedNote && !rawText) {
      router.push(ROUTES.HOME);
    }
  }, [isLoading, formattedNote, rawText, router]);

  const handleCopyNote = async () => {
    if (isCopying) return; // Prevent double-clicks

    setIsCopying(true);
    try {
      const textToCopy = isEditing ? editedText : formattedNote;
      await navigator.clipboard.writeText(textToCopy);
      toast({
        title: "Copied!",
        description: "Note copied to clipboard.",
      });
    } catch (error) {
      console.error("Failed to copy:", error);
      toast({
        title: "Copy Failed",
        description: "Could not copy to clipboard.",
        variant: "destructive",
      });
    } finally {
      setIsCopying(false);
    }
  };

  const handleDownloadNote = () => {
    if (isDownloading) return; // Prevent double-clicks

    setIsDownloading(true);
    try {
      const textToDownload = isEditing ? editedText : formattedNote;
      const blob = new Blob([textToDownload], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = UI_STRINGS.NOTE_FILENAME;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Downloaded!",
        description: "Note saved to your device.",
      });
    } catch (error) {
      console.error("Failed to download:", error);
      toast({
        title: "Download Failed",
        description: "Could not download the file.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleStartEditing = () => {
    setIsEditing(true);
  };

  const handleCancelEditing = () => {
    setEditedText(formattedNote);
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    if (!noteId) {
      toast({
        title: "Error",
        description: "Could not save changes - note not found in database.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    const { error } = await notesService.updateNote(noteId, {
      edited_text: editedText,
    });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to save changes. Please try again.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Saved!",
        description: "Your changes have been saved.",
      });
      setIsEditing(false);
    }
    setIsSaving(false);
  };

  const handleFeedbackSubmit = async (
    helpful: boolean,
    reasons?: FeedbackReason[]
  ) => {
    if (!noteId) {
      toast({
        title: "Error",
        description: "Could not submit feedback - note not found.",
        variant: "destructive",
      });
      return;
    }

    setIsFeedbackSubmitting(true);
    const { success, error } = await feedbackService.submitFeedback(
      noteId,
      helpful,
      reasons
    );

    if (error || !success) {
      toast({
        title: "Error",
        description: "Failed to submit feedback. Please try again.",
        variant: "destructive",
      });
    } else {
      setHasFeedbackSubmitted(true);
      setFeedbackValue(helpful);
      toast({
        title: "Thanks!",
        description: "Your feedback helps us improve.",
      });
    }
    setIsFeedbackSubmitting(false);
  };

  // Show loading state while data is being loaded
  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="flex items-center justify-center mb-4">
            <Spinner className="text-cyan-500" />
          </div>
          <p className="text-gray-300">{UI_STRINGS.LOADING_NOTE}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center px-4 pt-8 pb-24">
      <div className="w-full max-w-xl flex flex-col items-center gap-8 mt-16">
        {/* Header */}
        <div className="text-center space-y-2 mt-8">
          <h1 className="text-4xl font-bold text-white">
            {UI_STRINGS.RESULTS_TITLE}
          </h1>
        </div>

        {/* Note Editor with Integrated Raw Transcript */}
        <NoteEditor
          formattedNote={isEditing ? editedText : formattedNote}
          title={title || UI_STRINGS.UNTITLED_NOTE}
          onCopy={handleCopyNote}
          onDownload={handleDownloadNote}
          showRawTranscript={showRawTranscript}
          onToggleTranscript={() => setShowRawTranscript(!showRawTranscript)}
          rawText={rawText}
          isEditing={isEditing}
          onStartEditing={handleStartEditing}
          onCancelEditing={handleCancelEditing}
          onSaveEdit={handleSaveEdit}
          onTextChange={setEditedText}
          isSaving={isSaving}
          canEdit={!!noteId}
          isCopying={isCopying}
          isDownloading={isDownloading}
          // Feedback props
          onFeedbackSubmit={handleFeedbackSubmit}
          isFeedbackSubmitting={isFeedbackSubmitting}
          hasFeedbackSubmitted={hasFeedbackSubmitted}
          feedbackValue={feedbackValue}
          showFeedback={!!noteId}
        />
      </div>

      {/* Fixed Action Buttons */}
      <NoteActions />
    </main>
  );
}
