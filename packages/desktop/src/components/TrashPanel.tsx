import { useState, useEffect } from "react";
import { RotateCcw, X, Loader2 } from "lucide-react";
import { notesService } from "../services/notes.service";
import type { DBNote } from "../types/note.types";

interface TrashPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onRestore?: () => void;
}

export function TrashPanel({ isOpen, onClose, onRestore }: TrashPanelProps) {
  const [trashedNotes, setTrashedNotes] = useState<DBNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadTrashedNotes();
    }
  }, [isOpen]);

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
    if (!confirm("Delete forever? This cannot be undone.")) return;

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

  if (!isOpen) return null;

  return (
    <div className="trash-panel-overlay" onClick={onClose}>
      <div className="trash-panel" onClick={(e) => e.stopPropagation()}>
        <div className="trash-panel-header">
          <div>
            <h2 className="trash-panel-title">Trash</h2>
            <p className="trash-panel-subtitle">
              {trashedNotes.length} deleted {trashedNotes.length === 1 ? "note" : "notes"}
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
          ) : trashedNotes.length === 0 ? (
            <div className="trash-panel-empty">
              <p>Trash is empty</p>
            </div>
          ) : (
            <div className="trash-notes-list">
              {trashedNotes.map((note) => (
                <div key={note.id} className="trash-note-item">
                  <div className="trash-note-header">
                    <h3 className="trash-note-title">
                      {note.title || "Untitled Note"}
                    </h3>
                    <span className="trash-note-date">
                      {formatDate(note.deleted_at!)}
                    </span>
                  </div>
                  <p className="trash-note-preview">{getPreview(note)}</p>
                  <div className="trash-note-actions">
                    <button
                      onClick={() => handleRestore(note.id)}
                      disabled={restoringId === note.id}
                      className="trash-action-btn restore"
                    >
                      {restoringId === note.id ? (
                        <Loader2 size={14} className="spin" />
                      ) : (
                        <RotateCcw size={14} />
                      )}
                      Restore
                    </button>
                    <button
                      onClick={() => handlePermanentDelete(note.id)}
                      disabled={deletingId === note.id}
                      className="trash-action-btn delete"
                    >
                      {deletingId === note.id ? (
                        <Loader2 size={14} className="spin" />
                      ) : (
                        <X size={14} />
                      )}
                      Delete
                    </button>
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
