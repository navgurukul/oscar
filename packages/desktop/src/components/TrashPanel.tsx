import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { scribblesService } from "../services/scribbles.service";
import type { DBScribble } from "../types/scribble.types";

interface TrashPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onRestore?: () => void;
}

function formatTrashDate(iso: string) {
  const d = new Date(iso);
  const day = d.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${day} · ${time}`;
}

function daysUntilExpiry(deletedAt: string): number {
  const elapsed = Date.now() - new Date(deletedAt).getTime();
  const dayMs = 1000 * 60 * 60 * 24;
  return Math.max(0, 30 - Math.floor(elapsed / dayMs));
}

export function TrashPanel({ isOpen, onClose, onRestore }: TrashPanelProps) {
  const [trashedScribbles, setTrashedScribbles] = useState<DBScribble[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) loadTrashedScribbles();
  }, [isOpen]);

  const loadTrashedScribbles = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await scribblesService.getTrashedScribbles();
      if (error) {
        console.error("Failed to load trashed scribbles:", error);
        setTrashedScribbles([]);
      } else {
        setTrashedScribbles(data || []);
      }
    } catch (err) {
      console.error("Error loading trashed scribbles:", err);
      setTrashedScribbles([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async (id: string) => {
    setRestoringId(id);
    const { error } = await scribblesService.restoreScribble(id);
    if (error) {
      console.error("Failed to restore scribble:", error);
    } else {
      setTrashedScribbles((prev) => prev.filter((s) => s.id !== id));
      onRestore?.();
    }
    setRestoringId(null);
  };

  const handlePermanentDelete = async (id: string) => {
    setDeletingId(id);
    setConfirmDeleteId(null);
    const { error } = await scribblesService.permanentDelete(id);
    if (error) {
      console.error("Failed to delete scribble:", error);
    } else {
      setTrashedScribbles((prev) => prev.filter((s) => s.id !== id));
    }
    setDeletingId(null);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[1100] flex justify-end"
      style={{ background: "rgba(15,13,10,0.45)" }}
      onClick={onClose}
    >
      <div
        className="w-[640px] max-w-[92vw] h-full bg-cream border-l border-cream-300 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-10 pt-12 pb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-faint">
                TRASH · {trashedScribbles.length} {trashedScribbles.length === 1 ? "ITEM" : "ITEMS"} · 30 DAY RETENTION
              </span>
              <h1
                className="mt-2 font-serif font-medium text-ink leading-[1.02]"
                style={{ fontSize: 36, letterSpacing: "-0.02em" }}
              >
                Things you almost{" "}
                <em className="italic text-terracotta">lost</em>.
              </h1>
              <p className="mt-3 max-w-md text-[13px] leading-relaxed text-ink-soft">
                Anything you deleted is held here for 30 days before it's gone for good. Restore what should still be a Scribble.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full bg-transparent border border-cream-300 text-ink-faint hover:text-ink hover:border-cream-400 cursor-pointer transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="px-10 pb-12">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-ink-faint">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : trashedScribbles.length === 0 ? (
            <div className="py-16 text-center">
              <p className="font-serif text-[18px] text-ink-soft leading-snug">
                Nothing in trash.
              </p>
              <p className="mt-1.5 text-[12px] text-ink-faint">
                Anything you delete shows here for 30 days.
              </p>
            </div>
          ) : (
            <div>
              {trashedScribbles.map((scribble) => {
                const expires = daysUntilExpiry(scribble.deleted_at!);
                const confirming = confirmDeleteId === scribble.id;
                return (
                  <article
                    key={scribble.id}
                    className="grid grid-cols-12 gap-4 items-baseline py-5 border-b border-cream-300"
                  >
                    <div className="col-span-3">
                      <span className="font-mono text-[12px] text-ink tracking-[0.02em]">
                        {formatTrashDate(scribble.deleted_at!)}
                      </span>
                    </div>
                    <div className="col-span-5 min-w-0">
                      <h3
                        className="font-serif font-medium text-ink leading-[1.2]"
                        style={{ fontSize: 17, letterSpacing: "-0.005em" }}
                      >
                        {scribble.title || "Untitled Scribble"}
                      </h3>
                    </div>
                    <div className="col-span-2">
                      <span className="font-mono text-[10px] tracking-[0.16em] uppercase text-ink-faint">
                        EXPIRES IN {expires} {expires === 1 ? "DAY" : "DAYS"}
                      </span>
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-3">
                      {confirming ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handlePermanentDelete(scribble.id)}
                            disabled={deletingId === scribble.id}
                            className="font-mono text-[10px] tracking-[0.16em] uppercase text-[#8c2f25] bg-transparent border-none cursor-pointer hover:opacity-80"
                          >
                            {deletingId === scribble.id ? (
                              <Loader2 size={11} className="animate-spin inline" />
                            ) : (
                              "DELETE"
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="font-mono text-[10px] tracking-[0.16em] uppercase text-ink-faint bg-transparent border-none cursor-pointer hover:text-ink-soft"
                          >
                            CANCEL
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleRestore(scribble.id)}
                            disabled={restoringId === scribble.id}
                            className="font-mono text-[11px] tracking-[0.16em] uppercase text-terracotta bg-transparent border-none cursor-pointer hover:opacity-80"
                          >
                            {restoringId === scribble.id ? (
                              <Loader2 size={11} className="animate-spin inline" />
                            ) : (
                              "Restore"
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(scribble.id)}
                            disabled={deletingId === scribble.id}
                            className="font-mono text-[10px] tracking-[0.16em] uppercase text-ink-faint bg-transparent border-none cursor-pointer hover:text-[#8c2f25]"
                          >
                            ×
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
