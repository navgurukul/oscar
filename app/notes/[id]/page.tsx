"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { notesService } from "@/lib/services/notes.service";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Copy,
  Download,
  Edit3,
  Save,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { DBNote } from "@/lib/types/note.types";

export default function NoteDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const { toast } = useToast();

  const [note, setNote] = useState<DBNote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedText, setEditedText] = useState("");
  const [showRawTranscript, setShowRawTranscript] = useState(false);

  useEffect(() => {
    const loadNote = async () => {
      if (!id) return;
      setIsLoading(true);
      const { data, error } = await notesService.getNoteById(id);
      if (error || !data) {
        router.push("/notes");
      } else {
        setNote(data);
        setEditedText(data.edited_text || data.original_formatted_text);
      }
      setIsLoading(false);
    };

    loadNote();
  }, [id, router]);

  const handleSaveEdit = async () => {
    if (!note) return;
    setIsSaving(true);

    const { error } = await notesService.updateNote(note.id, {
      edited_text: editedText,
    });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to save changes. Please try again.",
        variant: "destructive",
      });
    } else {
      setNote({ ...note, edited_text: editedText });
      setIsEditing(false);
      toast({
        title: "Saved!",
        description: "Your changes have been saved.",
      });
    }
    setIsSaving(false);
  };

  const handleCopy = async () => {
    const text = note?.edited_text || note?.original_formatted_text || "";
    await navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Note copied to clipboard.",
    });
  };

  const handleDownload = () => {
    if (!note) return;
    const text = note.edited_text || note.original_formatted_text;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${note.title.replace(/[^a-z0-9]/gi, "_")}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="flex items-center justify-center mb-4">
            <Spinner className="text-cyan-500" />
          </div>
          <p className="text-gray-300">Loading your note...</p>
        </div>
      </main>
    );
  }

  if (!note) {
    return null;
  }

  const displayText = note.edited_text || note.original_formatted_text;

  return (
    <main className="flex flex-col items-center px-4 pt-8 pb-24">
      <div className="w-full max-w-xl flex flex-col items-center gap-8 mt-16">
        {/* Header with Back Button */}

        {/* <div className="flex-1 text-center">
          <h1 className="text-3xl font-bold text-white">
            {note.title || "Untitled Note"}
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {formatDate(note.created_at)}
          </p>
        </div> */}
        <div className="w-9" />

        {/* Note Editor Card */}
        <div className="w-[650px]">
          <Card className="bg-slate-900 border-cyan-700/30 rounded-t-2xl shadow-xl overflow-hidden">
            <CardHeader>
              {/* Title and Actions */}
              <div className="flex gap-6 justify-between items-start">
                <div className="mb-2">
                  <h2 className="text-xl font-semibold text-white truncate">
                    {note.title || "Untitled Note"}
                  </h2>
                  <p className="text-gray-400 text-sm">
                    {formatDate(note.created_at)}
                  </p>
                </div>

                <div className="flex items-center">
                  <div className="flex">
                    {isEditing ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleSaveEdit}
                          disabled={isSaving}
                          className="text-cyan-500 hover:text-cyan-300"
                        >
                          {isSaving ? (
                            <Spinner className="w-4 h-4" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setIsEditing(false);
                            setEditedText(
                              note.edited_text || note.original_formatted_text
                            );
                          }}
                          disabled={isSaving}
                          className="text-gray-400 hover:text-white"
                        >
                          <X className="w-5 h-5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsEditing(true)}
                          className="text-gray-400 hover:text-cyan-500"
                        >
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCopy}
                          className="text-gray-400 hover:text-cyan-500"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleDownload}
                          className="text-gray-400 hover:text-cyan-500"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <Separator className="w-24 h-0.5 bg-cyan-500" />
            </CardHeader>

            <CardContent>
              {isEditing ? (
                <textarea
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  className="w-full min-h-[300px] bg-slate-800 text-gray-300 rounded-lg p-4 resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-slate-700"
                  autoFocus
                />
              ) : (
                <div className="text-md text-start text-gray-300 whitespace-pre-wrap">
                  {displayText}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Raw Transcript - Slide In/Out with Framer Motion */}
          <AnimatePresence mode="wait">
            {showRawTranscript ? (
              <motion.div
                key="transcript-visible"
                initial={{ opacity: 0, scaleY: 0, y: 0 }}
                animate={{ opacity: 1, scaleY: 1, y: 0 }}
                exit={{ opacity: 0, scaleY: 0, y: 0 }}
                transition={{
                  duration: 0.3,
                  ease: "easeInOut",
                }}
                style={{ originY: 0 }}
              >
                <div className="flex justify-center">
                  <Card className="bg-white border-none rounded-t-none rounded-b-2xl shadow-xl w-[580px]">
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        {/* Raw Transcript Text */}
                        <div className="text-gray-800 text-md whitespace-pre-wrap leading-relaxed">
                          {note.raw_text || "No transcript available."}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Hide Button - Below Raw Transcript with Delayed Animation */}
                <motion.div
                  initial={{ opacity: 0, y: 0 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 0 }}
                  transition={{
                    duration: 0.2,
                    ease: "easeOut",
                    delay: 0.2,
                  }}
                  className="flex justify-center"
                >
                  <button
                    onClick={() => setShowRawTranscript(false)}
                    className="bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-700 hover:to-cyan-800 text-white font-medium py-2.5 px-10 transition-all duration-300 ease-in-out shadow-lg hover:shadow-xl flex items-center justify-center gap-2 rounded-b-2xl"
                  >
                    <span className="text-sm">hide original transcript</span>
                  </button>
                </motion.div>
              </motion.div>
            ) : (
              <motion.div
                key="transcript-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: 0.2,
                  ease: "easeOut",
                }}
                className="flex justify-center"
              >
                <button
                  onClick={() => setShowRawTranscript(true)}
                  className="bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-700 hover:to-cyan-800 text-white font-medium py-2.5 px-10 transition-all duration-300 ease-in-out shadow-lg hover:shadow-xl flex items-center justify-center gap-2 rounded-b-2xl"
                >
                  <span className="text-sm">view original transcript</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}
