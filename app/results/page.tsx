"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useNoteStorage } from "@/lib/hooks/useNoteStorage";
import { notesService } from "@/lib/services/notes.service";
import { NoteEditor } from "@/components/results/NoteEditor";
import { NoteActions } from "@/components/results/NoteActions";
import { Spinner } from "@/components/ui/spinner";
import { ROUTES, UI_STRINGS } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";

export default function ResultsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { isLoading, formattedNote, rawText, title } = useNoteStorage();

  const [showRawTranscript, setShowRawTranscript] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [noteId, setNoteId] = useState<string | null>(null);

  // Get the note ID from session storage (set by recording page)
  useEffect(() => {
    const storedNoteId = sessionStorage.getItem("currentNoteId");
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
    try {
      const textToCopy = isEditing ? editedText : formattedNote;
      await navigator.clipboard.writeText(textToCopy);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleDownloadNote = () => {
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
        />
      </div>

      {/* Fixed Action Buttons */}
      <NoteActions />
    </main>
  );
}
