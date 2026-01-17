"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { notesService } from "@/lib/services/notes.service";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FileText, Mic, Plus, SquaresSubtract, Trash2 } from "lucide-react";
import type { DBNote } from "@/lib/types/note.types";
import { Dialog } from "@/components/ui/dialog";
import { HomeRecordingButton } from "@/components/recording/HomeRecordingButton";
import { getTimeBasedPrompt } from "@/lib/utils";

export default function NotesPage() {
  const router = useRouter();
  const [notes, setNotes] = useState<DBNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteErrorOpen, setDeleteErrorOpen] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string>("");
  const [deleteSuccessOpen, setDeleteSuccessOpen] = useState(false);
  const [deleteSuccessMessage, setDeleteSuccessMessage] = useState<string>("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [contextPrompt, setContextPrompt] = useState("");

  useEffect(() => {
    loadNotes();
    // Set initial prompt based on current time
    setContextPrompt(getTimeBasedPrompt());
  }, []);

  const loadNotes = async () => {
    setIsLoading(true);
    const { data, error } = await notesService.getNotes();
    if (error) {
      setError("Failed to load notes. Please try again.");
    } else {
      setNotes(data || []);
    }
    setIsLoading(false);
  };

  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmId(id);
    setDeleteConfirmOpen(true);
  };

  const performDelete = async () => {
    if (!deleteConfirmId) return;
    const id = deleteConfirmId;
    setDeleteConfirmOpen(false);
    setDeletingId(id);
    const { error } = await notesService.deleteNote(id);
    if (error) {
      setDeleteErrorMessage("Failed to delete note. Please try again.");
      setDeleteErrorOpen(true);
    } else {
      setNotes(notes.filter((note) => note.id !== id));
      setDeleteSuccessMessage("Note deleted successfully.");
      setDeleteSuccessOpen(true);
    }
    setDeletingId(null);
    setDeleteConfirmId(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getPreview = (note: DBNote) => {
    const text = note.edited_text || note.original_formatted_text;
    return text.length > 150 ? text.substring(0, 150) + "..." : text;
  };

  if (isLoading) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center">
        <Spinner className="text-cyan-500 mb-4" />
        <p className="text-gray-300 text-center">Loading your notes...</p>
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center px-4 pt-8 pb-24">
      <Dialog
        open={deleteErrorOpen}
        title="Delete Failed"
        description={deleteErrorMessage}
        onClose={() => setDeleteErrorOpen(false)}
        primaryActionLabel="Close"
        onPrimaryAction={() => setDeleteErrorOpen(false)}
      />
      <Dialog
        open={deleteSuccessOpen}
        title="Deleted"
        description={deleteSuccessMessage}
        onClose={() => setDeleteSuccessOpen(false)}
        primaryActionLabel="Close"
        onPrimaryAction={() => setDeleteSuccessOpen(false)}
      />
      <Dialog
        open={deleteConfirmOpen}
        title="Delete Note"
        description="Are you sure you want to delete this note?"
        onClose={() => setDeleteConfirmOpen(false)}
        primaryActionLabel="Delete"
        onPrimaryAction={performDelete}
        secondaryActionLabel="Cancel"
        onSecondaryAction={() => setDeleteConfirmOpen(false)}
      />
      <div className="w-full max-w-2xl mt-16">
        <div className="flex items-center justify-center mb-8">
          <h1 className="text-3xl font-bold text-white">Your Notes</h1>
          {/* <Button
            onClick={() => router.push("/recording")}
            className="bg-cyan-600 hover:bg-cyan-700 text-white"
          >
            <Mic className="w-4 h-4 mr-2" />
            New Note
          </Button> */}
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {notes.length === 0 ? (
          <div className="text-center py-16 mt-16">
            <SquaresSubtract className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            {/* <h2 className="text-xl font-medium text-gray-300 mb-2">
              No notes yet
            </h2> */}
            <p className="text-gray-500 mb-6">{contextPrompt}</p>
            <div className="fixed bottom-10 left-1/2 -translate-x-1/2 ">
              <HomeRecordingButton />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {notes.map((note) => (
              <Card
                key={note.id}
                onClick={() => router.push(`/notes/${note.id}`)}
                className="bg-slate-900 border-cyan-700/30 rounded-2xl shadow-xl cursor-pointer hover:border-cyan-700/60 transition-all hover:shadow-2xl group overflow-hidden"
              >
                <CardHeader>
                  <div className="flex gap-6 justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <div className="mb-2">
                        <h2 className="text-xl font-semibold text-white truncate">
                          {note.title || "Untitled Note"}
                        </h2>
                        <p className="text-gray-400 text-sm">
                          {formatDate(note.created_at)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDeleteClick(note.id, e)}
                      disabled={deletingId === note.id}
                      className="p-2 text-gray-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete note"
                    >
                      {deletingId === note.id ? (
                        <Spinner className="w-4 h-4" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <Separator className="w-24 h-0.5 bg-cyan-500" />
                </CardHeader>
                <CardContent>
                  <p className="text-md text-start text-gray-300 line-clamp-2">
                    {getPreview(note)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
