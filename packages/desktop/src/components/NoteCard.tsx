import { Star, Trash2, Loader2 } from "lucide-react";
import type { DBNote } from "../types/note.types";
import { formatNoteDate } from "../lib/utils";

interface NoteCardProps {
  note: DBNote;
  onClick: () => void;
  onToggleStar: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  isDeleting?: boolean;
}

export function NoteCard({
  note,
  onClick,
  onToggleStar,
  onDelete,
  isDeleting = false,
}: NoteCardProps) {
  const getPreview = (note: DBNote) => {
    const text = note.edited_text || note.original_formatted_text;
    return text.length > 150 ? text.substring(0, 150) + "..." : text;
  };

  return (
    <div
      onClick={onClick}
      className="note-card"
    >
      <div className="note-card-header">
        <div className="note-card-title-section">
          <h2 className="note-card-title">
            {note.title || "Untitled Note"}
          </h2>
          <p className="note-card-date">
            {formatNoteDate(note.created_at)}
          </p>
        </div>
        <div className="note-card-actions">
          {/* Star Button */}
          <button
            onClick={onToggleStar}
            className={`note-card-action-btn star ${note.is_starred ? "starred" : ""}`}
            title={note.is_starred ? "Unstar note" : "Star note"}
          >
            {note.is_starred ? (
              <Star size={16} className="star-icon-filled" fill="currentColor" />
            ) : (
              <Star size={16} className="star-icon" />
            )}
          </button>
          {/* Delete Button */}
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="note-card-action-btn delete"
            title="Delete note"
          >
            {isDeleting ? (
              <Loader2 size={16} className="spin" />
            ) : (
              <Trash2 size={16} />
            )}
          </button>
        </div>
      </div>
      <div className="note-card-separator" />
      <div className="note-card-content">
        <p className="note-card-preview">
          {getPreview(note)}
        </p>
      </div>
    </div>
  );
}
