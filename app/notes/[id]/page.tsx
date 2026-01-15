"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { notesService } from "@/lib/services/notes.service";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Copy,
  Download,
  Edit3,
  Save,
  X,
  Eye,
  FileText,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { DBNote } from "@/lib/types/note.types";

export default function NoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useToast();

  const [note, setNote] = useState<DBNote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedText, setEditedText] = useState("");
  const [showOriginal, setShowOriginal] = useState(false);
  const [showRawTranscript, setShowRawTranscript] = useState(false);

  useEffect(() => {
    const loadNote = async () => {
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
        <Spinner className="text-cyan-500" />
      </main>
    );
  }

  if (!note) {
    return null;
  }

  const displayText = note.edited_text || note.original_formatted_text;
  const hasEdits = note.edited_text !== null;

  return (
    <main className="flex flex-col items-center px-4 pt-8 pb-24">
      <div className="w-full max-w-2xl mt-16">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => router.push("/notes")}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">{note.title}</h1>
            <p className="text-gray-400 text-sm">
              {formatDate(note.created_at)}
              {hasEdits && <span className="text-cyan-400 ml-2">(edited)</span>}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 mb-6">
          {!isEditing ? (
            <>
              <Button
                onClick={() => setIsEditing(true)}
                variant="outline"
                className="text-cyan-400 border-cyan-700/50 hover:bg-cyan-900/20"
              >
                <Edit3 className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <Button
                onClick={handleCopy}
                variant="outline"
                className="text-gray-300 border-slate-600 hover:bg-slate-800"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy
              </Button>
              <Button
                onClick={handleDownload}
                variant="outline"
                className="text-gray-300 border-slate-600 hover:bg-slate-800"
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
              {hasEdits && (
                <Button
                  onClick={() => setShowOriginal(!showOriginal)}
                  variant="outline"
                  className="text-gray-300 border-slate-600 hover:bg-slate-800"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  {showOriginal ? "Hide Original" : "View Original"}
                </Button>
              )}
              <Button
                onClick={() => setShowRawTranscript(!showRawTranscript)}
                variant="outline"
                className="text-gray-300 border-slate-600 hover:bg-slate-800"
              >
                <FileText className="w-4 h-4 mr-2" />
                {showRawTranscript ? "Hide Transcript" : "Raw Transcript"}
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={handleSaveEdit}
                disabled={isSaving}
                className="bg-cyan-600 hover:bg-cyan-700 text-white"
              >
                {isSaving ? (
                  <Spinner className="w-4 h-4 mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save
              </Button>
              <Button
                onClick={() => {
                  setIsEditing(false);
                  setEditedText(
                    note.edited_text || note.original_formatted_text
                  );
                }}
                variant="outline"
                className="text-gray-300 border-slate-600 hover:bg-slate-800"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </>
          )}
        </div>

        {/* Note content */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
          {isEditing ? (
            <textarea
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              className="w-full min-h-[400px] bg-transparent text-gray-200 resize-none focus:outline-none"
              autoFocus
            />
          ) : (
            <div className="prose prose-invert max-w-none">
              <pre className="whitespace-pre-wrap text-gray-200 font-sans">
                {displayText}
              </pre>
            </div>
          )}
        </div>

        {/* Original text comparison */}
        {showOriginal && hasEdits && !isEditing && (
          <div className="mt-6">
            <h3 className="text-lg font-medium text-gray-300 mb-3">
              Original AI-Generated Text
            </h3>
            <div className="bg-slate-800 border border-slate-600 rounded-xl p-6">
              <pre className="whitespace-pre-wrap text-gray-400 font-sans">
                {note.original_formatted_text}
              </pre>
            </div>
          </div>
        )}

        {/* Raw transcript */}
        {showRawTranscript && !isEditing && (
          <div className="mt-6">
            <h3 className="text-lg font-medium text-gray-300 mb-3">
              Raw Transcript
            </h3>
            <div className="bg-slate-800 border border-slate-600 rounded-xl p-6">
              <pre className="whitespace-pre-wrap text-gray-400 font-sans">
                {note.raw_text}
              </pre>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
