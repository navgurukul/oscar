import { useState, useEffect, useMemo } from "react";
import { Search, Star, Trash2, Loader2, SquaresSubtract, FileText, ChevronLeft, ChevronRight, Mic, Square } from "lucide-react";
import { motion } from "framer-motion";
import { notesService } from "../services/notes.service";
import { NoteCard } from "./NoteCard";
import { TrashPanel } from "./TrashPanel";
import type { DBNote } from "../types/note.types";

type SortOption = "created" | "updated" | "length";

interface NotesTabProps {
  // userId available for future use (e.g., filtering by user)
  userId: string;
  isRecording: boolean;
  onToggleRecording: () => void;
  recordingTime: number;
  refreshKey?: number;
}

// Format recording time as MM:SS
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function NotesTab({ userId, isRecording, onToggleRecording, recordingTime, refreshKey }: NotesTabProps) {
  const [allNotes, setAllNotes] = useState<DBNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [trashCount, setTrashCount] = useState(0);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<DBNote | null>(null);
  
  const ITEMS_PER_PAGE = 5;

  // Filter and sort state
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("created");
  const [currentPage, setCurrentPage] = useState(1);
  const [showStarredOnly, setShowStarredOnly] = useState(false);

  useEffect(() => {
    loadNotes();
    loadTrashCount();
  }, [userId, refreshKey]);

  const loadTrashCount = async () => {
    const { data, error } = await notesService.getTrashedNotes();
    if (!error && data) {
      setTrashCount(data.length);
    }
  };

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy, showStarredOnly]);

  // Filter and sort notes
  const filteredNotes = useMemo(() => {
    let result = [...allNotes];

    // Filter starred only
    if (showStarredOnly) {
      result = result.filter((note) => note.is_starred);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((note) => {
        const title = (note.title || "").toLowerCase();
        const content = (
          note.edited_text || note.original_formatted_text
        ).toLowerCase();
        return title.includes(query) || content.includes(query);
      });
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "created":
          comparison =
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          break;
        case "updated":
          comparison =
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
          break;
        case "length":
          const aLength = (a.edited_text || a.original_formatted_text).length;
          const bLength = (b.edited_text || b.original_formatted_text).length;
          comparison = bLength - aLength;
          break;
      }
      // Secondary sort by ID for stability
      if (comparison === 0) {
        comparison = a.id.localeCompare(b.id);
      }
      return comparison;
    });

    return result;
  }, [allNotes, searchQuery, sortBy, showStarredOnly]);

  const totalPages = Math.ceil(filteredNotes.length / ITEMS_PER_PAGE);

  const paginatedNotes = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredNotes.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredNotes, currentPage]);

  const loadNotes = async () => {
    setIsLoading(true);
    const { data, error } = await notesService.getNotes();
    if (error) {
      setError("Failed to load notes. Please try again.");
    } else {
      setAllNotes(data || []);
    }
    setIsLoading(false);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();

    setDeletingId(id);
    try {
      const { error } = await notesService.deleteNote(id);
      if (error) {
        console.error("[NotesTab] delete failed:", error);
        // Inline error feedback instead of alert() which may not work in WKWebView
        setError("Failed to delete note. Please try again.");
        setTimeout(() => setError(null), 3000);
      } else {
        setAllNotes((prev) => prev.filter((note) => note.id !== id));
        setTrashCount((prev) => prev + 1);
      }
    } catch (err) {
      console.error("[NotesTab] delete error:", err);
      setError("Failed to delete note. Please try again.");
      setTimeout(() => setError(null), 3000);
    }
    setDeletingId(null);
  };

  const handleRestore = () => {
    loadNotes();
    loadTrashCount();
  };

  const handleToggleStar = async (note: DBNote, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStarred = !note.is_starred;
    // Optimistic update
    setAllNotes((prev) =>
      prev.map((n) => (n.id === note.id ? { ...n, is_starred: newStarred } : n))
    );
    const { data, error } = await notesService.toggleStar(note.id, newStarred);
    if (error || !data) {
      // Revert on failure
      setAllNotes((prev) =>
        prev.map((n) =>
          n.id === note.id ? { ...n, is_starred: note.is_starred } : n
        )
      );
    } else {
      // Sync with actual DB value
      setAllNotes((prev) =>
        prev.map((n) => (n.id === data.id ? { ...n, is_starred: data.is_starred } : n))
      );
    }
  };

  const handleNoteClick = (note: DBNote) => {
    setSelectedNote(note);
  };

  const handleBackToList = () => {
    setSelectedNote(null);
    loadNotes(); // Refresh in case of changes
  };

  const hasActiveFilters = searchQuery.trim() || showStarredOnly;

  const getEmptyMessage = () => {
    if (allNotes.length === 0) {
      return "No notes yet. Start recording to create your first note!";
    }
    if (showStarredOnly && !searchQuery.trim()) {
      return "No starred notes yet. Star a note to find it here quickly.";
    }
    if (searchQuery.trim()) {
      return `No notes found for "${searchQuery}"`;
    }
    return "No notes match your filters.";
  };

  // Render pagination items
  const renderPaginationItems = () => {
    const items = [];
    const maxVisiblePages = 5;

    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    if (startPage > 1) {
      items.push(
        <button
          key="1"
          onClick={() => setCurrentPage(1)}
          className="pagination-btn"
        >
          1
        </button>
      );
      if (startPage > 2) {
        items.push(<span key="ellipsis-start" className="pagination-ellipsis">...</span>);
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      items.push(
        <button
          key={i}
          onClick={() => setCurrentPage(i)}
          className={`pagination-btn ${currentPage === i ? "active" : ""}`}
        >
          {i}
        </button>
      );
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        items.push(<span key="ellipsis-end" className="pagination-ellipsis">...</span>);
      }
      items.push(
        <button
          key={totalPages}
          onClick={() => setCurrentPage(totalPages)}
          className="pagination-btn"
        >
          {totalPages}
        </button>
      );
    }

    return items;
  };

  // Note Detail View
  if (selectedNote) {
    return (
      <div className="notes-tab">
        <div className="notes-detail-view">
          <div className="notes-detail-header">
            <button onClick={handleBackToList} className="notes-detail-back">
              <ChevronLeft size={20} />
              Back to Notes
            </button>
          </div>
          <div className="notes-detail-content">
            <h1 className="notes-detail-title">
              {selectedNote.title || "Untitled Note"}
            </h1>
            <p className="notes-detail-date">
              {new Date(selectedNote.created_at).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
            <div className="notes-detail-separator" />
            <div className="notes-detail-text">
              {selectedNote.edited_text || selectedNote.original_formatted_text}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Notes List View
  return (
    <div className="notes-tab">
      <div className="notes-container">
        <h1 className="notes-title">Scribble</h1>

        {error && (
          <div className="notes-error">
            <p>{error}</p>
          </div>
        )}

        {/* Filter Bar */}
        {allNotes.length > 0 && (
          <div className="notes-filter-bar">
            {/* Search Input */}
            <div className="notes-search">
              <Search size={16} className="notes-search-icon" />
              <input
                type="text"
                placeholder="Search notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="notes-search-input"
              />
            </div>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="notes-sort-select"
            >
              <option value="created">Date Created</option>
              <option value="updated">Date Updated</option>
              <option value="length">Length</option>
            </select>

            {/* Starred filter toggle */}
            <button
              onClick={() => setShowStarredOnly((v) => !v)}
              title={showStarredOnly ? "Show all notes" : "Show starred only"}
              className={`notes-starred-toggle ${showStarredOnly ? "active" : ""}`}
            >
              <Star
                size={16}
                className={showStarredOnly ? "star-filled" : ""}
                fill={showStarredOnly ? "currentColor" : "none"}
              />
              <span>Starred</span>
            </button>
          </div>
        )}

        {/* Trash Button - Bottom Right */}
        <button
          onClick={() => setIsTrashOpen(true)}
          className="trash-floating-btn"
          title="View trash"
        >
          <Trash2 size={24} />
          {trashCount > 0 && (
            <span className="trash-badge">
              {trashCount > 99 ? "99+" : trashCount}
            </span>
          )}
        </button>

        {/* Trash Panel */}
        <TrashPanel
          isOpen={isTrashOpen}
          onClose={() => setIsTrashOpen(false)}
          onRestore={handleRestore}
        />

        {isLoading ? (
          <div className="notes-loading">
            <Loader2 size={32} className="spin" />
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="notes-empty">
            {allNotes.length === 0 ? (
              <FileText size={64} className="notes-empty-icon" />
            ) : (
              <SquaresSubtract size={64} className="notes-empty-icon" />
            )}
            <p className="notes-empty-text">{getEmptyMessage()}</p>
            {hasActiveFilters && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setShowStarredOnly(false);
                }}
                className="notes-clear-filters"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="notes-list">
            <div className="notes-list-content">
              {paginatedNotes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onClick={() => handleNoteClick(note)}
                  onToggleStar={(e) => handleToggleStar(note, e)}
                  onDelete={(e) => handleDelete(note.id, e)}
                  isDeleting={deletingId === note.id}
                />
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="notes-pagination">
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="pagination-nav-btn"
                >
                  <ChevronLeft size={18} />
                </button>

                {renderPaginationItems()}

                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="pagination-nav-btn"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Section: Record Button */}
      <div className="fixed bottom-6 sm:bottom-10 left-60 right-0 z-50 flex justify-center pointer-events-none">
        <div className="pointer-events-auto">
          <motion.div
            whileHover={{ y: -5 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="flex flex-col items-center gap-2"
          >
            {isRecording && (
              <div className="text-sm font-mono text-rose-600 font-medium">
                {formatTime(recordingTime)}
              </div>
            )}
            <button
              onClick={onToggleRecording}
              className={`w-16 h-16 flex items-center justify-center sm:w-20 sm:h-20 rounded-full text-white shadow-lg hover:shadow-xl transition-all duration-200 ${
                isRecording
                  ? "bg-rose-600 hover:bg-rose-700 animate-pulse"
                  : "bg-cyan-600 hover:bg-cyan-700"
              }`}
            >
              {isRecording ? (
                <Square className="w-6 h-6 sm:w-8 sm:h-8" fill="currentColor" />
              ) : (
                <Mic className="w-6 h-6 sm:w-8 sm:h-8" />
              )}
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
