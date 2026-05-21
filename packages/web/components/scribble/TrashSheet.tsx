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
      <SheetContent
        className="w-full sm:max-w-sm overflow-y-auto"
        style={{ background: "#f7f4ee", borderLeft: "1px solid #e5e0d6", color: "#1a1816" }}
      >
        <SheetHeader className="pb-6">
          <SheetTitle
            className="text-left"
            style={{
              fontFamily: '"EB Garamond", Georgia, serif',
              fontSize: 28,
              fontWeight: 500,
              letterSpacing: "-0.015em",
              color: "#1a1816",
            }}
          >
            Trash
          </SheetTitle>
          <SheetDescription
            className="text-left"
            style={{
              fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#8b8780",
              fontSize: 10,
            }}
          >
            {trashedScribbles.length} DELETED · 30-DAY RETENTION
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner className="w-6 h-6" />
          </div>
        ) : trashedScribbles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm" style={{ color: "#8b8780" }}>
              Trash is empty.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {trashedScribbles.map((scribble) => (
              <div
                key={scribble.id}
                className="group pb-4 last:border-0"
                style={{ borderBottom: "1px solid #e5e0d6" }}
              >
                <div className="flex items-start justify-between gap-3 mb-1">
                  <h3
                    className="truncate flex-1"
                    style={{
                      fontFamily: '"EB Garamond", Georgia, serif',
                      fontSize: 17,
                      fontWeight: 500,
                      color: "#1a1816",
                    }}
                  >
                    {scribble.title || "Untitled Scribble"}
                  </h3>
                  <span
                    className="text-xs shrink-0"
                    style={{
                      fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                      color: "#8b8780",
                    }}
                  >
                    {formatDate(scribble.deleted_at!)}
                  </span>
                </div>
                <p className="text-sm line-clamp-2 mb-3" style={{ color: "#5a5852" }}>
                  {getPreview(scribble)}
                </p>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => handleRestore(scribble.id)}
                    disabled={restoringId === scribble.id}
                    className="flex items-center gap-1.5 text-xs disabled:opacity-50 transition-colors"
                    style={{ color: "#b8623d" }}
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
                    className="flex items-center gap-1.5 text-xs disabled:opacity-50 transition-colors"
                    style={{ color: "#8b8780" }}
                  >
                    {deletingId === scribble.id ? (
                      <Spinner className="w-3 h-3" />
                    ) : (
                      <X className="w-3 h-3" />
                    )}
                    Delete forever
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
