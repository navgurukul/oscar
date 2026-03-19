"use client";

import { useState, useEffect } from "react";
import { RotateCcw, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { notesService } from "@/lib/services/notes.service";
import type { DBNote } from "@/lib/types/note.types";

interface TrashSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestore?: () => void;
}

export function TrashSheet({ open, onOpenChange, onRestore }: TrashSheetProps) {
  const [trashedNotes, setTrashedNotes] = useState<DBNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadTrashedNotes();
    }
  }, [open]);

  const loadTrashedNotes = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await notesService.getTrashedNotes();
      if (error) {
        console.error("Failed to load trashed notes:", error);
        setTrashedNotes([]);
      } else {
        setTrashedNotes(data || []);
      }
    } catch (err) {
      console.error("Error loading trashed notes:", err);
      setTrashedNotes([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async (id: string) => {
    setRestoringId(id);
    const { error } = await notesService.restoreNote(id);
    if (error) {
      console.error("Failed to restore note:", error);
    } else {
      setTrashedNotes((prev) => prev.filter((note) => note.id !== id));
      onRestore?.();
    }
    setRestoringId(null);
  };

  const handlePermanentDelete = async (id: string) => {
    if (!confirm("Delete forever?")) return;

    setDeletingId(id);
    const { error } = await notesService.permanentDelete(id);
    if (error) {
      console.error("Failed to delete note:", error);
    } else {
      setTrashedNotes((prev) => prev.filter((note) => note.id !== id));
    }
    setDeletingId(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const getPreview = (note: DBNote) => {
    const text = note.edited_text || note.original_formatted_text;
    return text.length > 100 ? text.substring(0, 100) + "..." : text;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-sm bg-slate-950 border-l border-slate-800 overflow-y-auto">
        <SheetHeader className="pb-6">
          <SheetTitle className="text-white text-left text-lg">Trash</SheetTitle>
          <SheetDescription className="text-gray-500 text-left">
            {trashedNotes.length} deleted {trashedNotes.length === 1 ? "note" : "notes"}
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner className="w-6 h-6 text-cyan-500" />
          </div>
        ) : trashedNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-gray-500 text-sm">Trash is empty</p>
          </div>
        ) : (
          <div className="space-y-4">
            {trashedNotes.map((note) => (
              <div
                key={note.id}
                className="group border-b border-slate-800 pb-4 last:border-0"
              >
                <div className="flex items-start justify-between gap-3 mb-1">
                  <h3 className="text-white text-sm font-medium truncate flex-1">
                    {note.title || "Untitled Note"}
                  </h3>
                  <span className="text-gray-600 text-xs shrink-0">
                    {formatDate(note.deleted_at!)}
                  </span>
                </div>
                <p className="text-gray-500 text-sm line-clamp-2 mb-3">
                  {getPreview(note)}
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleRestore(note.id)}
                    disabled={restoringId === note.id}
                    className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 disabled:opacity-50 transition-colors"
                  >
                    {restoringId === note.id ? (
                      <Spinner className="w-3 h-3" />
                    ) : (
                      <RotateCcw className="w-3 h-3" />
                    )}
                    Restore
                  </button>
                  <button
                    onClick={() => handlePermanentDelete(note.id)}
                    disabled={deletingId === note.id}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white disabled:opacity-50 transition-colors"
                  >
                    {deletingId === note.id ? (
                      <Spinner className="w-3 h-3" />
                    ) : (
                      <X className="w-3 h-3" />
                    )}
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
