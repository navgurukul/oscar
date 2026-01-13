"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useNoteStorage } from "@/lib/hooks/useNoteStorage";
import { NoteEditor } from "@/components/results/NoteEditor";
import { NoteActions } from "@/components/results/NoteActions";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FileText, Copy, Download, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ResultsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { isLoading, formattedNote, rawText, title, updateFormattedNote } =
    useNoteStorage();

  const [showRawTranscript, setShowRawTranscript] = useState(false);

  // Redirect if no note - only after loading completes
  useEffect(() => {
    if (!isLoading && !formattedNote && !rawText) {
      router.push("/");
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
    a.download = "oscar-note.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyRaw = async () => {
    try {
      await navigator.clipboard.writeText(rawText);
      toast({
        title: "Copied!",
        description: "Raw transcript copied to clipboard.",
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
    a.download = "oscar-raw.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Downloaded!",
      description: "Raw transcript saved to your device.",
    });
  };

  // Show loading state while data is being loaded
  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600 mx-auto mb-4"></div>
          <p className="text-gray-300">Loading your note...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center px-4 pt-8">
      <div className="w-full max-w-xl flex flex-col items-center gap-8 mt-16">
        {/* Header */}
        <div className="text-center space-y-2 mt-8">
          <h1 className="text-4xl font-bold text-white">Here's your note</h1>
          {/* <p className="text-gray-400">
            AI formatted your thoughts into clean text
          </p> */}
        </div>

        {/* Note Editor */}
        <NoteEditor
          formattedNote={formattedNote}
          title={title || "Untitled Note"}
          onSave={handleSaveNote}
          onCopy={handleCopyNote}
          onDownload={handleDownloadNote}
        />

        {/* Raw Transcript Toggle Button */}
        <div className="flex justify-center">
          <Button
            onClick={() => setShowRawTranscript(!showRawTranscript)}
            variant="outline"
            className="flex items-center gap-2 text-cyan-500 border-cyan-700/30 hover:bg-slate-800"
          >
            <FileText className="w-5 h-5" />
            <span className="font-medium">
              {showRawTranscript
                ? "Hide Raw Transcript"
                : "Show Raw Transcript"}
            </span>
            {showRawTranscript ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Raw Transcript - Expandable Section */}
        {showRawTranscript && (
          <Card className="bg-slate-900 border-cyan-700/30 animate-fadeIn rounded-2xl shadow-xl w-[650px]">
            <CardHeader>
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-white">
                  Raw Transcript
                </h3>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyRaw}
                    className="text-gray-400 hover:text-cyan-500"
                  >
                    <Copy className="w-5 h-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDownloadRaw}
                    className="text-gray-400 hover:text-cyan-500"
                  >
                    <Download className="w-5 h-5" />
                  </Button>
                </div>
              </div>
              <Separator className="mt-3 bg-gray-700" />
            </CardHeader>
            <CardContent>
              <div className="prose prose-lg max-w-none text-gray-300 whitespace-pre-wrap">
                {rawText || "No raw transcript available."}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex justify-center gap-4 mt-6 pb-12">
          <NoteActions />
        </div>
      </div>
    </main>
  );
}
