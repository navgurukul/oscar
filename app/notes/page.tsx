"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { notesService } from "@/lib/services/notes.service";
import { Spinner } from "@/components/ui/spinner";
import { NotesListSkeleton } from "@/components/shared/NotesListSkeleton";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { SquaresSubtract, Trash2, Search, Star, Folder, Share2 } from "lucide-react";
import type { DBNote } from "@/lib/types/note.types";
import { getTimeBasedPrompt } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSubscriptionContext } from "@/lib/contexts/SubscriptionContext";
import { NOTE_FOLDER_PRESETS } from "@/lib/constants";
import { NoteActions } from "@/components/results/NoteActions";


type SortOption = "created" | "updated" | "length";

export default function NotesPage() {
  const router = useRouter();
  const [allNotes, setAllNotes] = useState<DBNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingStarId, setTogglingStarId] = useState<string | null>(null);
  const [contextPrompt, setContextPrompt] = useState("");
  const ITEMS_PER_PAGE = 5;

  // Filter and sort state
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("created");
  const [showOnlyStarred, setShowOnlyStarred] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string>("all");
  const [draggingNoteId, setDraggingNoteId] = useState<string | null>(null);
  const [movingNoteId, setMovingNoteId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const [showOnlyShared, setShowOnlyShared] = useState(false);
  const { isProUser } = useSubscriptionContext();

  const normalizeFolderKey = (folder: string | null | undefined) =>
    (folder || "").trim().toLowerCase();

  useEffect(() => {
    loadNotes();
    setContextPrompt(getTimeBasedPrompt());
  }, []);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy, showOnlyStarred, showOnlyShared, selectedFolder]);

  const folders = useMemo(() => {
    const displayByKey = new Map<string, string>();
    if (isProUser) return [];

    // Auto-create folders only from notes that actually exist
    for (const note of allNotes) {
      const raw = typeof note.folder === "string" ? note.folder.trim() : "";
      const key = normalizeFolderKey(raw);
      if (!key) continue;
      if (!displayByKey.has(key)) displayByKey.set(key, raw);
    }

    return Array.from(displayByKey.values()).sort((a, b) => a.localeCompare(b));
  }, [allNotes, isProUser]);
  
  // Filter and sort notes
  const filteredNotes = useMemo(() => {
    let result = [...allNotes];

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

    // Filter by starred
    if (showOnlyStarred) {
      result = result.filter((note) => note.is_starred);
    }

    // Filter by shared
    if (showOnlyShared) {
      result = result.filter((note) => note.is_shared);
    }

    // Apply folder filter when a specific folder is selected
    if (!isProUser && selectedFolder !== "all") {
      if (selectedFolder === "none") {
        // "Simple Notes" = notes with no folder (folder is null/empty)
        result = result.filter((note) => !normalizeFolderKey(note.folder));
      } else {
        const selectedKey = normalizeFolderKey(selectedFolder);
        result = result.filter(
          (note) => normalizeFolderKey(note.folder) === selectedKey
        );
      }
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
  }, [allNotes, searchQuery, sortBy, showOnlyStarred, showOnlyShared, selectedFolder, isProUser]);

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

  const handleMoveNoteToFolder = async (
    id: string,
    targetFolder: string | null
  ) => {
    // Optimistic update
    setAllNotes((prev) =>
      prev.map((note) =>
        note.id === id ? { ...note, folder: targetFolder } : note
      )
    );
    setMovingNoteId(id);

    const { error } = await notesService.updateNote(id, {
      folder: targetFolder,
    });

    if (error) {
      // Revert on error by reloading notes list
      await loadNotes();
      alert("Failed to move note to folder. Please try again.");
    }

    setMovingNoteId(null);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this note?")) return;

    setDeletingId(id);
    const { error } = await notesService.deleteNote(id);
    if (error) {
      alert("Failed to delete note. Please try again.");
    } else {
      setAllNotes(allNotes.filter((note) => note.id !== id));
    }
    setDeletingId(null);
  };

  const handleToggleStar = async (
    id: string,
    currentStarred: boolean,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();

    // Optimistic update
    setAllNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_starred: !currentStarred } : n))
    );
    setTogglingStarId(id);

    const { error } = await notesService.toggleStar(id, !currentStarred);

    if (error) {
      // Revert on error
      setAllNotes((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, is_starred: currentStarred } : n
        )
      );
      alert("Failed to update star. Please try again.");
    }

    setTogglingStarId(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getPreview = (note: DBNote) => {
    const text = note.edited_text || note.original_formatted_text;
    return text.length > 150 ? text.substring(0, 150) + "..." : text;
  };

  const hasActiveFilters =
    searchQuery.trim() ||
    showOnlyStarred ||
    showOnlyShared ||
    (!isProUser && selectedFolder !== "all");
  const hasFolderNotes = allNotes.some((note) =>
    normalizeFolderKey(note.folder)
  );
  const getEmptyMessage = () => {
    if (allNotes.length === 0) {
      return contextPrompt;
    }
    if (showOnlyStarred && searchQuery.trim()) {
      return "No starred notes match your search";
    }
    if (showOnlyStarred) {
      return "No starred notes yet";
    }
    if (showOnlyShared) {
      return "No shared notes yet";
    }
    // ✅ FIX: isProUser (not !isProUser)
    if (!isProUser && selectedFolder !== "all") {
      if (selectedFolder === "none") return "No notes in Simple Notes";
      return `No notes in "${selectedFolder}"`;
    }
    if (searchQuery.trim()) {
      return `No notes found for "${searchQuery}"`;
    }
    return contextPrompt;
  };

  const getFolderSectionTitle = () => {
    // ✅ FIX: isProUser (not !isProUser)
    if (isProUser) return null;
    if (selectedFolder === "all") return null;
    if (selectedFolder === "none") return "Simple Notes";
    return selectedFolder;
  };

  // Reusable renderer for a single note card
  const renderNoteCard = (note: DBNote) => (
    <Card
      key={note.id}
      draggable
      onDragStart={() => setDraggingNoteId(note.id)}
      onDragEnd={() =>
        setDraggingNoteId((current) => (current === note.id ? null : current))
      }
      onClick={() => router.push(`/notes/${note.id}`)}
      className={`bg-slate-900 border-cyan-700/30 rounded-2xl shadow-xl cursor-pointer hover:border-cyan-700/60 transition-all hover:shadow-2xl group overflow-hidden ${
        movingNoteId === note.id ? "opacity-60" : ""
      }`}
    >
      <CardHeader>
        <div className="flex gap-6 justify-between items-start">
          <div className="flex-1 min-w-0">
            <div className="mb-2">
              <h2 className="text-xl font-semibold text-white truncate">
                {note.title || "Untitled Note"}
              </h2>
              <p className="text-gray-300 text-sm">
                {formatDate(note.created_at)}
              </p>
              {/* ✅ FIX: isProUser (not !isProUser) — show folder badge for Pro */}
              {!isProUser && (note.folder || "").trim() && (
                <p className="text-xs text-cyan-400 mt-1">
                  {(note.folder || "").trim()}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {/* Star Button */}
            <button
              onClick={(e) => handleToggleStar(note.id, note.is_starred, e)}
              disabled={togglingStarId === note.id}
              className={`p-2 transition-colors ${
                note.is_starred
                  ? "text-cyan-500"
                  : "text-gray-500 hover:text-cyan-500"
              }`}
              title={note.is_starred ? "Unstar note" : "Star note"}
            >
              {togglingStarId === note.id ? (
                <Spinner className="w-4 h-4" />
              ) : (
                <Star
                  className={`w-4 h-4 ${
                    note.is_starred ? "fill-cyan-500" : ""
                  }`}
                />
              )}
            </button>
            {/* Delete Button */}
            <button
              onClick={(e) => handleDelete(note.id, e)}
              disabled={deletingId === note.id}
              className="p-2 text-gray-500 hover:text-white transition-colors"
              title="Delete note"
            >
              {deletingId === note.id ? (
                <Spinner className="w-4 h-4" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
        <Separator className="w-24 h-0.5 bg-cyan-500" />
      </CardHeader>
      <CardContent>
        <p className="text-md text-start text-gray-400 line-clamp-2">
          {getPreview(note)}
        </p>
      </CardContent>
    </Card>
  );

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
        <PaginationItem key="1">
          <PaginationLink
            onClick={(e) => {
              e.preventDefault();
              setCurrentPage(1);
            }}
            href="#"
            className="h-8 w-8 sm:h-10 sm:w-10 text-sm"
          >
            1
          </PaginationLink>
        </PaginationItem>
      );
      if (startPage > 2) {
        items.push(
          <PaginationEllipsis
            key="ellipsis-start"
            className="h-8 w-8 sm:h-9 sm:w-9"
          />
        );
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      items.push(
        <PaginationItem key={i}>
          <PaginationLink
            isActive={currentPage === i}
            onClick={(e) => {
              e.preventDefault();
              setCurrentPage(i);
            }}
            href="#"
            className="h-8 w-8 sm:h-10 sm:w-10 text-sm"
          >
            {i}
          </PaginationLink>
        </PaginationItem>
      );
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        items.push(
          <PaginationEllipsis
            key="ellipsis-end"
            className="h-8 w-8 sm:h-9 sm:w-9"
          />
        );
      }
      items.push(
        <PaginationItem key={totalPages}>
          <PaginationLink
            onClick={(e) => {
              e.preventDefault();
              setCurrentPage(totalPages);
            }}
            href="#"
            className="h-8 w-8 sm:h-10 sm:w-10 text-sm"
          >
            {totalPages}
          </PaginationLink>
        </PaginationItem>
      );
    }

    return items;
  };

  if (isLoading) {
    return (
      <main className="flex flex-col items-center px-4 pt-8 pb-24">
        <div className="w-full max-w-2xl mt-16">
          <div className="flex items-center justify-center mb-8">
            <h1 className="text-3xl font-bold text-white">Your Notes</h1>
          </div>
          <NotesListSkeleton />
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center px-4 pt-8 pb-24">
      <div className="w-full max-w-2xl mt-16">
        <div className="flex items-center justify-center mt-8 mb-8">
          <h1 className="text-3xl font-bold text-white">Your Notes</h1>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Filter Bar */}
        {allNotes.length > 0 && (
          <div className="flex flex-col gap-3 mb-6">
            {/* Folder tabs (can be shown/hidden) */}
            { isProUser && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setSelectedFolder("all")}
                  onDragOver={(e) => {
                    if (draggingNoteId) e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggingNoteId) {
                      handleMoveNoteToFolder(draggingNoteId, null);
                    }
                    setDraggingNoteId(null);
                  }}
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs border transition-colors ${
                    selectedFolder === "all"
                      ? "bg-cyan-600/20 border-cyan-500 text-cyan-200"
                      : "bg-slate-900 border-slate-700 text-gray-300 hover:border-cyan-500 hover:text-cyan-200"
                  }`}
                >
                  <Folder className="w-3 h-3" />
                  <span>All</span>
                </button>
                <button
                  onClick={() => setSelectedFolder("none")}
                  onDragOver={(e) => {
                    if (draggingNoteId) e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggingNoteId) {
                      handleMoveNoteToFolder(draggingNoteId, null);
                    }
                    setDraggingNoteId(null);
                  }}
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs border transition-colors ${
                    selectedFolder === "none"
                      ? "bg-cyan-600/20 border-cyan-500 text-cyan-200"
                      : "bg-slate-900 border-slate-700 text-gray-300 hover:border-cyan-500 hover:text-cyan-200"
                  }`}
                >
                  <Folder className="w-3 h-3" />
                  <span>Simple Notes</span>
                </button>
                {/* ✅ NEW: Auto-generated folder tabs from API notes */}
                {folders.map((folder) => (
                  <button
                    key={folder}
                    onClick={() => setSelectedFolder(folder)}
                    onDragOver={(e) => {
                      if (draggingNoteId) e.preventDefault();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggingNoteId) {
                        handleMoveNoteToFolder(draggingNoteId, folder);
                      }
                      setDraggingNoteId(null);
                    }}
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs border transition-colors ${
                      selectedFolder === folder
                        ? "bg-cyan-600/20 border-cyan-500 text-cyan-200"
                        : "bg-slate-900 border-slate-700 text-gray-300 hover:border-cyan-500 hover:text-cyan-200"
                    }`}
                  >
                    <Folder className="w-3 h-3" />
                    <span>{folder}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
              {/* Search Input */}
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 z-10" />
                <Input
                  type="text"
                  placeholder="Search notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-10 w-full pl-10 pr-4 bg-slate-800 border border-cyan-700/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-600 transition-colors"
                />
              </div>

              {/* Sort Dropdown */}
              <Select
                value={sortBy}
                onValueChange={(value) => setSortBy(value as SortOption)}
              >
                <SelectTrigger className="h-10 w-full md:w-[160px] bg-slate-800 border-cyan-700/30 rounded-lg text-white focus:ring-1 focus:ring-cyan-600 transition-colors">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-cyan-700/30 text-white">
                  <SelectItem value="created">Date Created</SelectItem>
                  <SelectItem value="updated">Date Updated</SelectItem>
                  <SelectItem value="length">Length</SelectItem>
                </SelectContent>
              </Select>

              {/* Folder Filter Dropdown (can be shown/hidden) */}
              { !isProUser && (
                <Select
                  value={selectedFolder}
                  onValueChange={(value) => setSelectedFolder(value)}
                >
                  <SelectTrigger className="h-10 w-full md:w-[160px] bg-slate-800 border-cyan-700/30 rounded-lg text-white focus:ring-1 focus:ring-cyan-600 transition-colors">
                    <SelectValue placeholder="Folder" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-cyan-700/30 text-white">
                    <SelectItem value="all">All folders</SelectItem>
                    <SelectItem value="none">Simple Notes</SelectItem>
                    {folders.map((folder) => (
                      <SelectItem key={folder} value={folder}>
                        {folder}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

           

              {/* Starred Toggle */}
              <Button
                onClick={() => setShowOnlyStarred(!showOnlyStarred)}
                className={`h-10 flex items-center justify-center gap-2 px-4 rounded-lg border transition-colors w-full md:w-auto ${
                  showOnlyStarred
                    ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-500"
                    : "bg-slate-800 border-cyan-700/30 text-gray-400 hover:text-white"
                }`}
              >
                <Star
                  className={`w-4 h-4 ${showOnlyStarred ? "fill-cyan-500" : ""}`}
                />
                <span className="hidden md:inline font-normal">Starred</span>
              </Button>

              {/* Shared Toggle */}
              <Button
                onClick={() => setShowOnlyShared(!showOnlyShared)}
                className={`h-10 flex items-center justify-center gap-2 px-4 rounded-lg border transition-colors w-full md:w-auto ${
                  showOnlyShared
                    ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-500"
                    : "bg-slate-800 border-cyan-700/30 text-gray-400 hover:text-white"
                }`}
              >
                <Share2 className="w-4 h-4" />
                <span className="hidden md:inline font-normal">Shared</span>
              </Button>
            </div>
          </div>
        )}

        {filteredNotes.length === 0 ? (
          <div className="text-center py-16 mt-16">
            <SquaresSubtract className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 mb-6">{getEmptyMessage()}</p>
            {hasActiveFilters && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setShowOnlyStarred(false);
                  setSelectedFolder("all");
                }}
                className="text-cyan-500 hover:text-cyan-400 transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Folder section header when a specific folder is selected (Pro only) */}
            {getFolderSectionTitle() && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-cyan-700/30 bg-slate-900">
                <Folder className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-medium text-white">
                  {getFolderSectionTitle()}
                </span>
                <span className="text-xs text-gray-400">
                  ({filteredNotes.length})
                </span>
              </div>
            )}

            <div className="space-y-4 min-h-[400px]">
              {hasFolderNotes  ? (
                (() => {
                  const folderGroups = new Map<string, DBNote[]>();
                  const simpleNotes: DBNote[] = [];

                  paginatedNotes.forEach((note) => {
                    const key = normalizeFolderKey(note.folder);
                    if (!key) {
                      // folder null/empty -> simple card (no folder group)
                      simpleNotes.push(note);
                    } else {
                      const existing = folderGroups.get(key) || [];
                      existing.push(note);
                      folderGroups.set(key, existing);
                    }
                  });

                  return (
                    <>
                      {Array.from(folderGroups.entries()).map(
                        ([key, notes]) => {
                          const displayName =
                            (notes[0].folder || "").trim() || "Folder";

                          return (
                            <Card
                              key={key}
                              className="bg-slate-900 border-cyan-700/30 rounded-2xl shadow-xl overflow-hidden"
                            >
                              <CardHeader className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <Folder className="w-4 h-4 text-cyan-400" />
                                  <span className="text-sm font-medium text-white">
                                    {displayName}
                                  </span>
                                  <span className="text-xs text-gray-400">
                                    ({notes.length})
                                  </span>
                                </div>
                              </CardHeader>
                              <CardContent className="pt-0 pb-4 px-3">
                                <div className="space-y-3">
                                  {notes.map((note) => renderNoteCard(note))}
                                </div>
                              </CardContent>
                            </Card>
                          );
                        }
                      )}

                      {/* Notes with folder = null/empty stay as simple cards */}
                      {simpleNotes.length > 0 && (
                        <div className="space-y-3">
                          {simpleNotes.map((note) => renderNoteCard(note))}
                        </div>
                      )}
                    </>
                  );
                })()
              ) : (
                paginatedNotes.map((note) => renderNoteCard(note))
              )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-8 -mx-4 sm:mx-0 overflow-x-auto pb-2">
                <Pagination>
                  <PaginationContent className="flex-nowrap gap-1 min-w-max">
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={(e) => {
                          e.preventDefault();
                          if (currentPage > 1) setCurrentPage(currentPage - 1);
                        }}
                        href="#"
                        className={
                          currentPage === 1
                            ? "pointer-events-none opacity-50"
                            : "cursor-pointer"
                        }
                      />
                    </PaginationItem>

                    {renderPaginationItems()}

                    <PaginationItem>
                      <PaginationNext
                        onClick={(e) => {
                          e.preventDefault();
                          if (currentPage < totalPages)
                            setCurrentPage(currentPage + 1);
                        }}
                        href="#"
                        className={
                          currentPage === totalPages
                            ? "pointer-events-none opacity-50"
                            : "cursor-pointer"
                        }
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </div>
        )}
      </div>
    
    </main>
  );
}