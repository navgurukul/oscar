"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useNoteStorage } from "@/lib/hooks/useNoteStorage";
import { NoteEditor } from "@/components/results/NoteEditor";
import { NoteActions } from "@/components/results/NoteActions";
import { useToast } from "@/hooks/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { ROUTES, UI_STRINGS } from "@/lib/constants";

export default function ResultsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { isLoading, formattedNote, rawText, title, updateFormattedNote } =
    useNoteStorage();

  const [showRawTranscript, setShowRawTranscript] = useState(false);

  // Redirect if no note - only after loading completes
  useEffect(() => {
    if (!isLoading && !formattedNote && !rawText) {
      router.push(ROUTES.HOME);
    }
  }, [isLoading, formattedNote, rawText, router]);

  const handleSaveNote = (editedNote: string) => {
    updateFormattedNote(editedNote);
  };

  const handleCopyNote = async () => {
    try {
      await navigator.clipboard.writeText(formattedNote);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleDownloadNote = () => {
    const blob = new Blob([formattedNote], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = UI_STRINGS.NOTE_FILENAME;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyRaw = async () => {
    try {
      await navigator.clipboard.writeText(rawText);
      toast({
        title: UI_STRINGS.COPIED_TOAST_TITLE,
        description: UI_STRINGS.COPIED_TOAST_DESCRIPTION,
      });
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleDownloadRaw = () => {
    const blob = new Blob([rawText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = UI_STRINGS.RAW_FILENAME;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: UI_STRINGS.DOWNLOADED_TOAST_TITLE,
      description: UI_STRINGS.DOWNLOADED_TOAST_DESCRIPTION,
    });
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
          {/* <p className="text-gray-400">
            AI formatted your thoughts into clean text
          </p> */}
        </div>

        {/* Note Editor with Integrated Raw Transcript */}
        <NoteEditor
          formattedNote={formattedNote}
          title={title || UI_STRINGS.UNTITLED_NOTE}
          onSave={handleSaveNote}
          onCopy={handleCopyNote}
          onDownload={handleDownloadNote}
          showRawTranscript={showRawTranscript}
          onToggleTranscript={() => setShowRawTranscript(!showRawTranscript)}
          rawText={rawText}
          onCopyRaw={handleCopyRaw}
          onDownloadRaw={handleDownloadRaw}
        />
      </div>

      {/* Fixed Action Buttons */}
      <NoteActions />
    </main>
  );
}
