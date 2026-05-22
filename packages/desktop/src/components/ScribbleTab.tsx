import { useState, useEffect, useMemo } from "react";
import {
  Search,
  Star,
  Trash2,
  Loader2,
  Mic,
  Square,
  Download,
  FileText,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { motion } from "framer-motion";
import { ContextLabel } from "./ContextLabel";
import { TrashPanel } from "./TrashPanel";
import { scribblesService } from "../services/scribbles.service";
import { formatScribbleDate } from "../lib/utils";
import type { DBScribble } from "../types/scribble.types";

type SortOption = "created" | "updated" | "length";

interface ScribbleTabProps {
  userId: string;
  refreshKey?: number;
  isRecording: boolean;
  isProcessing?: boolean;
  statusMessage?: string | null;
  onToggleRecording: () => void;
  recordingTime: number;
}

const ITEMS_PER_PAGE = 30;

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function Caps({
  children,
  tone = "faint",
  className = "",
}: {
  children: React.ReactNode;
  tone?: "faint" | "ink" | "terra";
  className?: string;
}) {
  const toneClass =
    tone === "terra"
      ? "text-terracotta"
      : tone === "ink"
        ? "text-ink"
        : "text-ink-faint";
  return (
    <span
      className={`font-mono text-[10px] tracking-[0.18em] uppercase ${toneClass} ${className}`}
    >
      {children}
    </span>
  );
}

interface ScribbleRowProps {
  scribble: DBScribble;
  isActive: boolean;
  onClick: () => void;
}

function ScribbleRow({ scribble, isActive, onClick }: ScribbleRowProps) {
  const preview = (() => {
    const text = scribble.edited_text || scribble.original_formatted_text || "";
    return text.length > 110 ? text.slice(0, 110) + "…" : text;
  })();

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-5 py-4 border-b border-cream-300 transition-colors cursor-pointer bg-transparent border-l-0 border-r-0 border-t-0 ${
        isActive ? "bg-cream-200" : "hover:bg-cream-100"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] tracking-[0.04em] text-ink">
          {formatScribbleDate(scribble.created_at)}
        </span>
        <ContextLabel
          appKey={scribble.dictation_app_key}
          source={scribble.dictation_context_source}
          variant="compact"
        />
      </div>
      <h3
        className="mt-1.5 font-serif text-[16px] font-medium text-ink leading-[1.2]"
        style={{ letterSpacing: "-0.005em" }}
      >
        {scribble.title || "Untitled Scribble"}
      </h3>
      <p className="mt-1 text-[12px] text-ink-soft leading-relaxed line-clamp-2">
        {preview}
      </p>
      {scribble.is_starred && (
        <Star
          size={10}
          className="text-terracotta mt-1.5 inline-block"
          fill="currentColor"
        />
      )}
    </button>
  );
}

interface DetailPaneProps {
  scribble: DBScribble | null;
  onExportTxt: (s: DBScribble) => void;
  onExportMarkdown: (s: DBScribble) => void;
  onToggleStar: (s: DBScribble) => void;
  onDelete: (s: DBScribble) => void;
  isDeleting: boolean;
}

function DetailPane({
  scribble,
  onExportTxt,
  onExportMarkdown,
  onToggleStar,
  onDelete,
  isDeleting,
}: DetailPaneProps) {
  if (!scribble) {
    return (
      <div className="flex-1 flex items-center justify-center px-12">
        <div className="max-w-sm text-center">
          <FileText className="mx-auto mb-5 text-ink-faint" size={32} />
          <p className="font-serif text-[20px] text-ink leading-snug">
            Pick a Scribble to read.
          </p>
          <p className="mt-2 text-[13px] text-ink-soft leading-relaxed">
            Or hold Ctrl+Space to make a new one. Your captures land in the list on the left.
          </p>
        </div>
      </div>
    );
  }

  const date = new Date(scribble.created_at).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const body = scribble.edited_text || scribble.original_formatted_text;

  return (
    <div className="flex-1 overflow-y-auto">
      <article className="max-w-[640px] mx-auto px-10 py-12">
        <ContextLabel
          appKey={scribble.dictation_app_key}
          source={scribble.dictation_context_source}
        />
        <h1
          className="mt-2 font-serif font-medium text-ink leading-[1.05]"
          style={{ fontSize: 32, letterSpacing: "-0.02em" }}
        >
          {scribble.title || "Untitled Scribble"}
        </h1>
        <p className="mt-3 font-mono text-[11px] tracking-[0.04em] text-ink-faint">
          {date}
        </p>

        <div className="mt-7 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onToggleStar(scribble)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] border bg-transparent cursor-pointer transition-colors ${
              scribble.is_starred
                ? "border-terracotta text-terracotta"
                : "border-cream-300 text-ink-soft hover:text-ink"
            }`}
          >
            <Star
              size={11}
              fill={scribble.is_starred ? "currentColor" : "none"}
            />
            {scribble.is_starred ? "Starred" : "Star"}
          </button>
          <button
            type="button"
            onClick={() => onExportTxt(scribble)}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] border border-cream-300 text-ink-soft bg-transparent hover:text-ink cursor-pointer transition-colors"
          >
            <Download size={11} />
            .txt
          </button>
          <button
            type="button"
            onClick={() => onExportMarkdown(scribble)}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] border border-cream-300 text-ink-soft bg-transparent hover:text-ink cursor-pointer transition-colors"
          >
            <Download size={11} />
            .md
          </button>
          <button
            type="button"
            onClick={() => onDelete(scribble)}
            disabled={isDeleting}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] border border-cream-300 text-ink-faint bg-transparent hover:text-[#8c2f25] hover:border-[#8c2f25] cursor-pointer transition-colors"
          >
            {isDeleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
            Delete
          </button>
        </div>

        <div className="mt-9 pt-9 border-t border-cream-300">
          <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-terracotta">
            OSCAR&rsquo;S EDIT ↓
          </span>
          <div
            className="mt-3 font-serif text-ink leading-[1.65] whitespace-pre-wrap"
            style={{ fontSize: 17 }}
          >
            {body}
          </div>
        </div>
      </article>
    </div>
  );
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
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("created");
  const [currentPage, setCurrentPage] = useState(1);
  const [showStarredOnly, setShowStarredOnly] = useState(false);

  useEffect(() => {
    loadScribbles();
    loadTrashCount();
  }, [userId, refreshKey]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy, showStarredOnly]);

  const loadTrashCount = async () => {
    const { data, error } = await scribblesService.getTrashedScribbles();
    if (!error && data) setTrashCount(data.length);
  };

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

  const filteredScribbles = useMemo(() => {
    let result = [...allScribbles];
    if (showStarredOnly) result = result.filter((s) => s.is_starred);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((s) => {
        const title = (s.title || "").toLowerCase();
        const content = (s.edited_text || s.original_formatted_text).toLowerCase();
        return title.includes(q) || content.includes(q);
      });
    }
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "created":
          cmp = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          break;
        case "updated":
          cmp = new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
          break;
        case "length": {
          const aLen = (a.edited_text || a.original_formatted_text).length;
          const bLen = (b.edited_text || b.original_formatted_text).length;
          cmp = bLen - aLen;
          break;
        }
      }
      if (cmp === 0) cmp = a.id.localeCompare(b.id);
      return cmp;
    });
    return result;
  }, [allScribbles, searchQuery, sortBy, showStarredOnly]);

  const totalPages = Math.ceil(filteredScribbles.length / ITEMS_PER_PAGE);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredScribbles.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredScribbles, currentPage]);

  // Auto-select first scribble if none selected and list non-empty
  useEffect(() => {
    if (!selectedId && filteredScribbles.length > 0) {
      setSelectedId(filteredScribbles[0].id);
    } else if (selectedId && !filteredScribbles.find((s) => s.id === selectedId)) {
      setSelectedId(filteredScribbles[0]?.id ?? null);
    }
  }, [filteredScribbles, selectedId]);

  const selected = useMemo(
    () => allScribbles.find((s) => s.id === selectedId) ?? null,
    [allScribbles, selectedId],
  );

  const handleDelete = async (scribble: DBScribble) => {
    setDeletingId(scribble.id);
    try {
      const { error } = await scribblesService.deleteScribble(scribble.id);
      if (error) {
        setError("Failed to delete scribble. Please try again.");
        setTimeout(() => setError(null), 3000);
      } else {
        setAllScribbles((prev) => prev.filter((s) => s.id !== scribble.id));
        setTrashCount((prev) => prev + 1);
        if (selectedId === scribble.id) setSelectedId(null);
      }
    } catch (err) {
      console.error("[ScribbleTab] delete error:", err);
      setError("Failed to delete scribble. Please try again.");
      setTimeout(() => setError(null), 3000);
    }
    setDeletingId(null);
  };

  const handleToggleStar = async (scribble: DBScribble) => {
    const newStarred = !scribble.is_starred;
    setAllScribbles((prev) =>
      prev.map((n) => (n.id === scribble.id ? { ...n, is_starred: newStarred } : n)),
    );
    const { data, error } = await scribblesService.toggleStar(scribble.id, newStarred);
    if (error || !data) {
      setAllScribbles((prev) =>
        prev.map((n) =>
          n.id === scribble.id ? { ...n, is_starred: scribble.is_starred } : n,
        ),
      );
    } else {
      setAllScribbles((prev) =>
        prev.map((n) => (n.id === data.id ? { ...n, is_starred: data.is_starred } : n)),
      );
    }
  };

  const triggerDownload = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
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
    const date = new Date(scribble.created_at).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const body = scribble.edited_text || scribble.original_formatted_text;
    const md = `# ${title}\n\n_${date}_\n\n---\n\n${body}`;
    const slug = title.replace(/[^a-z0-9]/gi, "_");
    triggerDownload(md, `${slug}.md`, "text/markdown");
  };

  return (
    <div className="flex-1 flex bg-cream overflow-hidden relative">
      {/* LEFT — list pane */}
      <aside className="w-[360px] shrink-0 border-r border-cream-300 flex flex-col bg-cream">
        <div className="px-5 pt-6 pb-4 border-b border-cream-300">
          <Caps>SCRIBBLES · {allScribbles.length}</Caps>
          <h1
            className="mt-2 font-serif font-medium text-ink"
            style={{ fontSize: 26, lineHeight: 1.05, letterSpacing: "-0.02em" }}
          >
            Everything you{" "}
            <em className="italic text-terracotta">said</em>.
          </h1>

          <div className="mt-4 flex items-center gap-2 rounded-full bg-cream-200 border border-cream-300 px-3 py-2">
            <Search size={13} className="text-ink-faint shrink-0" />
            <input
              type="text"
              placeholder="Find by what you said"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent outline-none border-none text-[13px] text-ink placeholder-ink-faint min-w-0"
            />
          </div>

          <div className="mt-3 flex items-center gap-3">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="bg-transparent border-none font-mono text-[10px] tracking-[0.16em] uppercase text-ink-soft cursor-pointer outline-none"
            >
              <option value="created">NEWEST</option>
              <option value="updated">UPDATED</option>
              <option value="length">LONGEST</option>
            </select>
            <button
              type="button"
              onClick={() => setShowStarredOnly((v) => !v)}
              className={`inline-flex items-center gap-1.5 bg-transparent border-none font-mono text-[10px] tracking-[0.16em] uppercase cursor-pointer ${
                showStarredOnly ? "text-terracotta" : "text-ink-soft"
              }`}
            >
              <Star size={10} fill={showStarredOnly ? "currentColor" : "none"} />
              STARRED
            </button>
            <button
              type="button"
              onClick={() => setIsTrashOpen(true)}
              className="ml-auto inline-flex items-center gap-1.5 bg-transparent border-none font-mono text-[10px] tracking-[0.16em] uppercase text-ink-soft cursor-pointer hover:text-ink"
            >
              <Trash2 size={10} />
              TRASH {trashCount > 0 ? `· ${trashCount}` : ""}
            </button>
          </div>
        </div>

        {error && (
          <div className="px-5 py-3 bg-[#fbe9e7] text-[12px] text-[#8c2f25] border-b border-cream-300">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-ink-faint">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : paginated.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="font-serif text-[16px] text-ink-soft leading-snug">
                {allScribbles.length === 0
                  ? "No Scribbles yet."
                  : "Nothing matches that filter."}
              </p>
              <p className="mt-1.5 text-[12px] text-ink-faint">
                {allScribbles.length === 0
                  ? "Hold Ctrl+Space anywhere to capture one."
                  : "Try a different search."}
              </p>
            </div>
          ) : (
            paginated.map((s) => (
              <ScribbleRow
                key={s.id}
                scribble={s}
                isActive={s.id === selectedId}
                onClick={() => setSelectedId(s.id)}
              />
            ))
          )}
        </div>

        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-cream-300 flex items-center justify-between text-[11px] text-ink-soft">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="bg-transparent border-none text-ink-soft disabled:text-ink-faint cursor-pointer disabled:cursor-default"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="font-mono">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="bg-transparent border-none text-ink-soft disabled:text-ink-faint cursor-pointer disabled:cursor-default"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </aside>

      {/* RIGHT — detail pane */}
      <DetailPane
        scribble={selected}
        onExportTxt={handleExportTxt}
        onExportMarkdown={handleExportMarkdown}
        onToggleStar={handleToggleStar}
        onDelete={handleDelete}
        isDeleting={!!(selected && deletingId === selected.id)}
      />

      {/* Trash panel */}
      <TrashPanel
        isOpen={isTrashOpen}
        onClose={() => setIsTrashOpen(false)}
        onRestore={() => {
          loadScribbles();
          loadTrashCount();
        }}
      />

      {/* Floating record button */}
      <div className="fixed bottom-8 left-[420px] right-0 z-40 flex justify-center pointer-events-none">
        <div className="pointer-events-auto">
          <motion.div
            whileHover={isProcessing ? undefined : { y: -3 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex flex-col items-center gap-2"
          >
            {isRecording && !isProcessing && (
              <div className="font-mono text-[12px] text-terracotta font-medium tabular-nums">
                {formatTime(recordingTime)}
              </div>
            )}
            {(isProcessing || (statusMessage && !isRecording)) && (
              <div
                className={`text-[11px] font-medium px-3 py-1 rounded-full shadow-sm border font-mono tracking-[0.04em] ${
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
                <span className="inline-flex items-center gap-1.5">
                  {isProcessing && <Loader2 size={11} className="animate-spin" />}
                  {statusMessage ?? "processing"}
                </span>
              </div>
            )}
            <div className="relative">
              {isRecording && !isProcessing && (
                <>
                  <span className="absolute inset-0 rounded-full bg-terracotta/40 animate-ping" aria-hidden />
                  <span className="absolute -inset-1 rounded-full ring-2 ring-terracotta/60" aria-hidden />
                </>
              )}
              <button
                type="button"
                onClick={onToggleRecording}
                disabled={isProcessing}
                title={
                  isProcessing
                    ? "Processing Scribble…"
                    : isRecording
                      ? "Stop Scribble recording"
                      : "Record a new Scribble"
                }
                className={`relative w-16 h-16 flex items-center justify-center sm:w-20 sm:h-20 rounded-full text-cream shadow-lg transition-colors duration-200 border-none cursor-pointer ${
                  isProcessing
                    ? "bg-ink-faint cursor-wait"
                    : isRecording
                      ? "bg-terracotta-700 hover:bg-terracotta"
                      : "bg-terracotta hover:bg-terracotta-600"
                }`}
              >
                {isProcessing ? (
                  <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin" />
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
