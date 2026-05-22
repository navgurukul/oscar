import { useState, useEffect, useMemo } from "react";
import { Search, Star, Trash2, Loader2, SquaresSubtract, FileText, ChevronLeft, ChevronRight, Mic, Square, Download } from "lucide-react";
import { ContextLabel } from "./ContextLabel";
// Editorial caps-mono label
const Caps = ({ children }: { children: React.ReactNode }) => (
  <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-faint">{children}</span>
);
import { motion } from "framer-motion";
import { scribblesService } from "../services/scribbles.service";
import { ScribbleCard } from "./ScribbleCard";
import { TrashPanel } from "./TrashPanel";
import type { DBScribble } from "../types/scribble.types";

type SortOption = "created" | "updated" | "length";

interface ScribbleTabProps {
  // userId available for future use (e.g., filtering by user)
  userId: string;
  refreshKey?: number;
  isRecording: boolean;
  isProcessing?: boolean;
  statusMessage?: string | null;
  onToggleRecording: () => void;
  recordingTime: number;
}

// Format recording time as MM:SS
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}


export function ScribbleTab({
  userId,
  refreshKey = 0,
  isRecording,
  isProcessing = false,
  statusMessage = null,
  onToggleRecording,
  recordingTime,
}: ScribbleTabProps) {
  const [allScribbles, setAllScribbles] = useState<DBScribble[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [trashCount, setTrashCount] = useState(0);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [selectedScribble, setSelectedScribble] = useState<DBScribble | null>(null);
  
  const ITEMS_PER_PAGE = 5;

  // Filter and sort state
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("created");
  const [currentPage, setCurrentPage] = useState(1);
  const [showStarredOnly, setShowStarredOnly] = useState(false);

  useEffect(() => {
    loadScribbles();
    loadTrashCount();
  }, [userId, refreshKey]);

  const loadTrashCount = async () => {
    const { data, error } = await scribblesService.getTrashedScribbles();
    if (!error && data) {
      setTrashCount(data.length);
    }
  };

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy, showStarredOnly]);

  // Filter and sort scribbles
  const filteredScribbles = useMemo(() => {
    let result = [...allScribbles];

    // Filter starred only
    if (showStarredOnly) {
      result = result.filter((scribble) => scribble.is_starred);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((scribble) => {
        const title = (scribble.title || "").toLowerCase();
        const content = (
          scribble.edited_text || scribble.original_formatted_text
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
  }, [allScribbles, searchQuery, sortBy, showStarredOnly]);

  const totalPages = Math.ceil(filteredScribbles.length / ITEMS_PER_PAGE);

  const paginatedScribbles = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredScribbles.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredScribbles, currentPage]);

  const loadScribbles = async () => {
    setIsLoading(true);
    const { data, error } = await scribblesService.getScribbles();
    if (error) {
      console.error("[ScribbleTab] load failed:", error);
      setError("Failed to load scribbles. Please try again.");
    } else {
      setError(null);
      setAllScribbles(data || []);
    }
    setIsLoading(false);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();

    setDeletingId(id);
    try {
      const { error } = await scribblesService.deleteScribble(id);
      if (error) {
        console.error("[ScribbleTab] delete failed:", error);
        // Inline error feedback instead of alert() which may not work in WKWebView
        setError("Failed to delete scribble. Please try again.");
        setTimeout(() => setError(null), 3000);
      } else {
        setAllScribbles((prev) => prev.filter((scribble) => scribble.id !== id));
        setTrashCount((prev) => prev + 1);
      }
    } catch (err) {
      console.error("[ScribbleTab] delete error:", err);
      setError("Failed to delete scribble. Please try again.");
      setTimeout(() => setError(null), 3000);
    }
    setDeletingId(null);
  };

  const handleRestore = () => {
    loadScribbles();
    loadTrashCount();
  };

  const handleToggleStar = async (scribble: DBScribble, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStarred = !scribble.is_starred;
    // Optimistic update
    setAllScribbles((prev) =>
      prev.map((n) => (n.id === scribble.id ? { ...n, is_starred: newStarred } : n))
    );
    const { data, error } = await scribblesService.toggleStar(scribble.id, newStarred);
    if (error || !data) {
      // Revert on failure
      setAllScribbles((prev) =>
        prev.map((n) =>
          n.id === scribble.id ? { ...n, is_starred: scribble.is_starred } : n
        )
      );
    } else {
      // Sync with actual DB value
      setAllScribbles((prev) =>
        prev.map((n) => (n.id === data.id ? { ...n, is_starred: data.is_starred } : n))
      );
    }
  };

  const handleScribbleClick = (scribble: DBScribble) => {
    setSelectedScribble(scribble);
  };

  const handleBackToList = () => {
    setSelectedScribble(null);
    loadScribbles(); // Refresh in case of changes
  };

  const triggerDownload = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportTxt = (scribble: DBScribble) => {
    const body = scribble.edited_text || scribble.original_formatted_text;
    const slug = (scribble.title || "scribble").replace(/[^a-z0-9]/gi, "_");
    triggerDownload(body, `${slug}.txt`, "text/plain");
  };

  const handleExportMarkdown = (scribble: DBScribble) => {
    const title = scribble.title || "Untitled Scribble";
    const date  = new Date(scribble.created_at).toLocaleDateString("en-US", {
      month: "long", day: "numeric", year: "numeric",
    });
    const body  = scribble.edited_text || scribble.original_formatted_text;
    const md    = `# ${title}\n\n_${date}_\n\n---\n\n${body}`;
    const slug  = title.replace(/[^a-z0-9]/gi, "_");
    triggerDownload(md, `${slug}.md`, "text/markdown");
  };

  const hasActiveFilters = searchQuery.trim() || showStarredOnly;

  const getEmptyMessage = () => {
    if (allScribbles.length === 0) {
      return "No Scribbles yet. Saved scribbles sync here when created.";
    }
    if (showStarredOnly && !searchQuery.trim()) {
      return "No starred Scribbles yet. Star one to find it here quickly.";
    }
    if (searchQuery.trim()) {
      return `No Scribbles found for "${searchQuery}"`;
    }
    return "No Scribbles match your filters.";
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

  // Scribble Detail View
  if (selectedScribble) {
    return (
      <div className="scribbles-tab">
        <div className="scribbles-detail-view">
          <div className="scribbles-detail-header">
            <button onClick={handleBackToList} className="scribbles-detail-back">
              <ChevronLeft size={20} />
              Back to Scribble
            </button>
            <div className="scribbles-detail-actions">
              <button
                onClick={() => handleExportTxt(selectedScribble)}
                className="scribbles-detail-action-btn"
                title="Download as plain text (.txt)"
              >
                <Download size={15} />
                <span>.txt</span>
              </button>
              <button
                onClick={() => handleExportMarkdown(selectedScribble)}
                className="scribbles-detail-action-btn"
                title="Download as Markdown (.md)"
              >
                <Download size={15} />
                <span>.md</span>
              </button>
            </div>
          </div>
          <div className="scribbles-detail-content">
            <ContextLabel
              appKey={selectedScribble.dictation_app_key}
              source={selectedScribble.dictation_context_source}
              className="mb-2"
            />
            <h1 className="scribbles-detail-title">
              {selectedScribble.title || "Untitled Scribble"}
            </h1>
            <p className="scribbles-detail-date">
              {new Date(selectedScribble.created_at).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
            <div className="scribbles-detail-separator" />
            <div className="scribbles-detail-text">
              {selectedScribble.edited_text || selectedScribble.original_formatted_text}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Scribbles List View
  return (
    <div className="scribbles-tab">
      <div className="scribbles-container">
        {/* Editorial hero */}
        <div className="pb-6 mb-6 border-b border-cream-300 text-left">
          <Caps>SCRIBBLES · {allScribbles.length}</Caps>
          <h1
            className="mt-2 font-serif font-medium text-ink"
            style={{ fontSize: 36, lineHeight: 1.05, letterSpacing: "-0.02em" }}
          >
            Everything you{" "}
            <em className="italic text-terracotta">said</em>.
          </h1>
        </div>

        {error && (
          <div className="scribbles-error">
            <p>{error}</p>
          </div>
        )}

        {/* Filter Bar */}
        {allScribbles.length > 0 && (
          <div className="scribbles-filter-bar">
            {/* Search Input */}
            <div className="scribbles-search">
              <Search size={16} className="scribbles-search-icon" />
              <input
                type="text"
                placeholder="Search Scribble..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="scribbles-search-input"
              />
            </div>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="scribbles-sort-select"
            >
              <option value="created">Date Created</option>
              <option value="updated">Date Updated</option>
              <option value="length">Length</option>
            </select>

            {/* Starred filter toggle */}
            <button
              onClick={() => setShowStarredOnly((v) => !v)}
              title={showStarredOnly ? "Show all scribbles" : "Show starred only"}
              className={`scribbles-starred-toggle ${showStarredOnly ? "active" : ""}`}
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
          <div className="scribbles-loading">
            <Loader2 size={32} className="spin" />
          </div>
        ) : filteredScribbles.length === 0 ? (
          <div className="scribbles-empty">
            {allScribbles.length === 0 ? (
              <FileText size={64} className="scribbles-empty-icon" />
            ) : (
              <SquaresSubtract size={64} className="scribbles-empty-icon" />
            )}
            <p className="scribbles-empty-text">{getEmptyMessage()}</p>
            {hasActiveFilters && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setShowStarredOnly(false);
                }}
                className="scribbles-clear-filters"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="scribbles-list">
            <div className="scribbles-list-content">
              {paginatedScribbles.map((scribble) => (
                <ScribbleCard
                  key={scribble.id}
                  scribble={scribble}
                  onClick={() => handleScribbleClick(scribble)}
                  onToggleStar={(e) => handleToggleStar(scribble, e)}
                  onDelete={(e) => handleDelete(scribble.id, e)}
                  isDeleting={deletingId === scribble.id}
                />
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="scribbles-pagination">
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
            whileHover={isProcessing ? undefined : { y: -5 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="flex flex-col items-center gap-2"
          >
            {isRecording && !isProcessing && (
              <div className="text-sm font-mono text-rose-600 font-medium tabular-nums">
                {formatTime(recordingTime)}
              </div>
            )}
            {(isProcessing || (statusMessage && !isRecording)) && (
              <div
                className={`text-xs font-medium px-3 py-1 rounded-full shadow-sm border ${
                  isProcessing
                    ? "bg-cream-50 text-terracotta border-terracotta/30"
                    : statusMessage?.toLowerCase().startsWith("failed") ||
                      statusMessage?.toLowerCase().includes("too short") ||
                      statusMessage?.toLowerCase().includes("no audio") ||
                      statusMessage?.toLowerCase().includes("no speech") ||
                      statusMessage?.toLowerCase().startsWith("sign in")
                    ? "bg-[#fbe9e7] text-[#8c2f25] border-[#e8c9b8]"
                    : "bg-cream-200 text-ink border-cream-300"
                }`}
              >
                <span className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.04em]">
                  {isProcessing && <Loader2 size={12} className="spin" />}
                  {statusMessage ?? "processing"}
                </span>
              </div>
            )}
            <div className="relative">
              {isRecording && !isProcessing && (
                <>
                  <span className="absolute inset-0 rounded-full bg-rose-500/40 animate-ping" aria-hidden />
                  <span className="absolute -inset-1 rounded-full ring-2 ring-rose-300/60" aria-hidden />
                </>
              )}
              <button
                onClick={onToggleRecording}
                disabled={isProcessing}
                title={
                  isProcessing
                    ? "Processing Scribble…"
                    : isRecording
                    ? "Stop Scribble recording"
                    : "Record a new Scribble"
                }
                className={`relative w-16 h-16 flex items-center justify-center sm:w-20 sm:h-20 rounded-full text-cream shadow-lg transition-colors duration-200 ${
                  isProcessing
                    ? "bg-ink-faint cursor-wait"
                    : isRecording
                    ? "bg-rose-600 hover:bg-rose-700 hover:shadow-xl"
                    : "bg-terracotta hover:bg-terracotta-600 hover:shadow-xl"
                }`}
              >
                {isProcessing ? (
                  <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 spin" />
                ) : isRecording ? (
                  <Square className="w-6 h-6 sm:w-8 sm:h-8" fill="currentColor" />
                ) : (
                  <Mic className="w-6 h-6 sm:w-8 sm:h-8" />
                )}
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
