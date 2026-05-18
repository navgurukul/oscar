"use client";

import { useState } from "react";
import { RotateCcw, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { scribblesService } from "@/lib/services/scribbles.service";
import {
  useTrashedScribbles,
  useRestoreScribble,
} from "@/lib/hooks/queries/useScribbles";
import { queryKeys } from "@/lib/hooks/queries/keys";
import type { DBScribble } from "@/lib/types/scribble.types";

interface TrashSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestore?: () => void;
}

export function TrashSheet({ open, onOpenChange, onRestore }: TrashSheetProps) {
  const qc = useQueryClient();
  const { data: trashedScribbles = [], isLoading } = useTrashedScribbles(open);
  const restoreMutation = useRestoreScribble();
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const permanentDelete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await scribblesService.permanentDelete(id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      qc.setQueryData<DBScribble[]>(queryKeys.trashedScribbles, (prev) =>
        prev ? prev.filter((s) => s.id !== id) : prev,
      );
    },
  });

  const handleRestore = async (id: string) => {
    setRestoringId(id);
    try {
      await restoreMutation.mutateAsync(id);
      onRestore?.();
    } catch (err) {
      console.error("Failed to restore scribble:", err);
    }
    setRestoringId(null);
  };

  const handlePermanentDelete = async (id: string) => {
    if (!confirm("Delete forever?")) return;
    setDeletingId(id);
    try {
      await permanentDelete.mutateAsync(id);
    } catch (err) {
      console.error("Failed to delete scribble:", err);
    }
    setDeletingId(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const getPreview = (scribble: DBScribble) => {
    const text = scribble.edited_text || scribble.original_formatted_text;
    return text.length > 100 ? text.substring(0, 100) + "..." : text;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-sm bg-slate-950 border-l border-slate-800 overflow-y-auto">
        <SheetHeader className="pb-6">
          <SheetTitle className="text-white text-left text-lg">Trash</SheetTitle>
          <SheetDescription className="text-gray-500 text-left">
            {trashedScribbles.length} deleted {trashedScribbles.length === 1 ? "scribble" : "scribbles"}
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner className="w-6 h-6 text-cyan-500" />
          </div>
        ) : trashedScribbles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-gray-500 text-sm">Trash is empty</p>
          </div>
        ) : (
          <div className="space-y-4">
            {trashedScribbles.map((scribble) => (
              <div
                key={scribble.id}
                className="group border-b border-slate-800 pb-4 last:border-0"
              >
                <div className="flex items-start justify-between gap-3 mb-1">
                  <h3 className="text-white text-sm font-medium truncate flex-1">
                    {scribble.title || "Untitled Scribble"}
                  </h3>
                  <span className="text-gray-600 text-xs shrink-0">
                    {formatDate(scribble.deleted_at!)}
                  </span>
                </div>
                <p className="text-gray-500 text-sm line-clamp-2 mb-3">
                  {getPreview(scribble)}
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleRestore(scribble.id)}
                    disabled={restoringId === scribble.id}
                    className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 disabled:opacity-50 transition-colors"
                  >
                    {restoringId === scribble.id ? (
                      <Spinner className="w-3 h-3" />
                    ) : (
                      <RotateCcw className="w-3 h-3" />
                    )}
                    Restore
                  </button>
                  <button
                    onClick={() => handlePermanentDelete(scribble.id)}
                    disabled={deletingId === scribble.id}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white disabled:opacity-50 transition-colors"
                  >
                    {deletingId === scribble.id ? (
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
