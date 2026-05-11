import { Star, Trash2, Loader2 } from "lucide-react";
import type { DBScribble } from "../types/scribble.types";
import { formatScribbleDate } from "../lib/utils";

interface ScribbleCardProps {
  scribble: DBScribble;
  onClick: () => void;
  onToggleStar: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  isDeleting?: boolean;
}

export function ScribbleCard({
  scribble,
  onClick,
  onToggleStar,
  onDelete,
  isDeleting = false,
}: ScribbleCardProps) {
  const getPreview = (scribble: DBScribble) => {
    const text = scribble.edited_text || scribble.original_formatted_text;
    return text.length > 150 ? text.substring(0, 150) + "..." : text;
  };

  return (
    <div
      onClick={onClick}
      className="scribble-card"
    >
      <div className="scribble-card-header">
        <div className="scribble-card-title-section">
          <h2 className="scribble-card-title">
            {scribble.title || "Untitled Scribble"}
          </h2>
          <p className="scribble-card-date">
            {formatScribbleDate(scribble.created_at)}
          </p>
        </div>
        <div className="scribble-card-actions">
          {/* Star Button */}
          <button
            onClick={onToggleStar}
            className={`scribble-card-action-btn star ${scribble.is_starred ? "starred" : ""}`}
            title={scribble.is_starred ? "Unstar scribble" : "Star scribble"}
          >
            {scribble.is_starred ? (
              <Star size={16} className="star-icon-filled" fill="currentColor" />
            ) : (
              <Star size={16} className="star-icon" />
            )}
          </button>
          {/* Delete Button */}
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="scribble-card-action-btn delete"
            title="Delete scribble"
          >
            {isDeleting ? (
              <Loader2 size={16} className="spin" />
            ) : (
              <Trash2 size={16} />
            )}
          </button>
        </div>
      </div>
      <div className="scribble-card-separator" />
      <div className="scribble-card-content">
        <p className="scribble-card-preview">
          {getPreview(scribble)}
        </p>
      </div>
    </div>
  );
}
