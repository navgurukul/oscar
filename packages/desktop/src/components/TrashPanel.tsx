import { useState, useEffect } from "react";
import { RotateCcw, X, Loader2 } from "lucide-react";
import { scribblesService } from "../services/scribbles.service";
import type { DBScribble } from "../types/scribble.types";
import { formatShortDate } from "../lib/utils";

interface TrashPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onRestore?: () => void;
}

export function TrashPanel({ isOpen, onClose, onRestore }: TrashPanelProps) {
  const [trashedScribbles, setTrashedScribbles] = useState<DBScribble[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadTrashedScribbles();
    }
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
      setTrashedScribbles((prev) => prev.filter((scribble) => scribble.id !== id));
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
      setTrashedScribbles((prev) => prev.filter((scribble) => scribble.id !== id));
    }
    setDeletingId(null);
  };

  const getPreview = (scribble: DBScribble) => {
    const text = scribble.edited_text || scribble.original_formatted_text;
    return text.length > 100 ? text.substring(0, 100) + "..." : text;
  };

  if (!isOpen) return null;

  return (
    <div className="trash-panel-overlay" onClick={onClose}>
      <div className="trash-panel" onClick={(e) => e.stopPropagation()}>
        <div className="trash-panel-header">
          <div>
            <h2 className="trash-panel-title">Trash</h2>
            <p className="trash-panel-subtitle">
              {trashedScribbles.length} deleted {trashedScribbles.length === 1 ? "scribble" : "scribbles"}
            </p>
          </div>
          <button className="trash-panel-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="trash-panel-content">
          {isLoading ? (
            <div className="trash-panel-loading">
              <Loader2 size={24} className="spin" />
            </div>
          ) : trashedScribbles.length === 0 ? (
            <div className="trash-panel-empty">
              <p>Trash is empty</p>
            </div>
          ) : (
            <div className="trash-scribbles-list">
              {trashedScribbles.map((scribble) => (
                <div key={scribble.id} className="trash-scribble-item">
                  <div className="trash-scribble-header">
                    <h3 className="trash-scribble-title">
                      {scribble.title || "Untitled Scribble"}
                    </h3>
                    <span className="trash-scribble-date">
                      {formatShortDate(scribble.deleted_at!)}
                    </span>
                  </div>
                  <p className="trash-scribble-preview">{getPreview(scribble)}</p>
                  <div className="trash-scribble-actions">
                    <button
                      onClick={() => handleRestore(scribble.id)}
                      disabled={restoringId === scribble.id}
                      className="trash-action-btn restore"
                    >
                      {restoringId === scribble.id ? (
                        <Loader2 size={14} className="spin" />
                      ) : (
                        <RotateCcw size={14} />
                      )}
                      Restore
                    </button>
                    {confirmDeleteId === scribble.id ? (
                      <div className="trash-confirm-delete">
                        <span className="trash-confirm-label">Delete forever?</span>
                        <button
                          onClick={() => handlePermanentDelete(scribble.id)}
                          disabled={deletingId === scribble.id}
                          className="trash-action-btn delete"
                        >
                          {deletingId === scribble.id ? (
                            <Loader2 size={14} className="spin" />
                          ) : (
                            <X size={14} />
                          )}
                          Yes
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="trash-action-btn restore"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(scribble.id)}
                        disabled={deletingId === scribble.id}
                        className="trash-action-btn delete"
                      >
                        <X size={14} />
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
