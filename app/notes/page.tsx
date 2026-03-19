"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { notesService } from "@/lib/services/notes.service";
import { Spinner } from "@/components/ui/spinner";
import { NotesListSkeleton } from "@/components/shared/NotesListSkeleton";
import { TrashSheet } from "@/components/notes/TrashSheet";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useSubscription } from "@/lib/hooks/useSubscription";
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
import {
  SquaresSubtract,
  Trash2,
  Search,
  Star,
  Square,
  CheckSquare2,
  X,
} from "lucide-react";
import type { DBNote, DBFolder } from "@/lib/types/note.types";
import { getTimeBasedPrompt } from "@/lib/utils";
import { Input } from "@/components/ui/input";

type SortOption = "created" | "updated" | "length";

export default function NotesPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { isProUser } = useSubscription();
  const [allNotes, setAllNotes] = useState<DBNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [contextPrompt, setContextPrompt] = useState("");
  const [trashCount, setTrashCount] = useState(0);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const ITEMS_PER_PAGE = 5;

  // Filter and sort state
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("created");
  const [currentPage, setCurrentPage] = useState(1);
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [folders, setFolders] = useState<DBFolder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | "all">("all");
  const [newFolderName, setNewFolderName] = useState("");

  useEffect(() => {
    setContextPrompt(getTimeBasedPrompt());
  }, []);

  // Load notes only once auth state is settled and we have a user.
  // This prevents fetching with a stale session immediately after OAuth redirects.
  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    loadNotes();
    loadTrashCount();
    if (isProUser) {
      loadFolders();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id, isProUser]);

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

  const isAllPageSelected = useMemo(() => {
    if (paginatedNotes.length === 0) return false;
    return paginatedNotes.every((n) => selectedIds.has(n.id));
  }, [paginatedNotes, selectedIds]);

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

  const loadFolders = async () => {
    const { data } = await notesService.getFolders();
    setFolders(data || []);
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
      // Increment trash count
      setTrashCount((prev) => prev + 1);
    }
    setDeletingId(null);
  };

  const handleRestore = () => {
    loadNotes();
    loadTrashCount();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllOnPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      paginatedNotes.forEach((n) => next.add(n.id));
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const toggleSelectAllOnPage = () => {
    if (isAllPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        paginatedNotes.forEach((n) => next.delete(n.id));
        return next;
      });
    } else {
      selectAllOnPage();
    }
  };

  const bulkDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} note(s)?`)) return;
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      await notesService.deleteNote(id);
    }
    setAllNotes((prev) => prev.filter((n) => !selectedIds.has(n.id)));
    setTrashCount((prev) => prev + ids.length);
    clearSelection();
    setSelectionMode(false);
  };

  const bulkStarSelected = async (value: boolean) => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    setAllNotes((prev) =>
      prev.map((n) => (selectedIds.has(n.id) ? { ...n, is_starred: value } : n))
    );
    await Promise.all(ids.map((id) => notesService.toggleStar(id, value)));
    clearSelection();
    setSelectionMode(false);
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

  const hasActiveFilters = searchQuery.trim() || showStarredOnly;

  const getEmptyMessage = () => {
    if (allNotes.length === 0) {
      return contextPrompt;
    }
    if (showStarredOnly && !searchQuery.trim()) {
      return "No starred notes yet. Star a note to find it here quickly.";
    }
    if (searchQuery.trim()) {
      return `No notes found for "${searchQuery}"`;
    }
    return contextPrompt;
  };

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
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 mb-6">
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
              <Select
              value={sortBy}
              onValueChange={(value) => setSortBy(value as SortOption)}
            >
              <SelectTrigger className="h-10 w-full md:w-[180px] bg-slate-800 border-cyan-700/30 rounded-lg text-white focus:ring-1 focus:ring-cyan-600 transition-colors">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-cyan-700/30 text-white">
                <SelectItem value="created">Date Created</SelectItem>
                <SelectItem value="updated">Date Updated</SelectItem>
                <SelectItem value="length">Length</SelectItem>
              </SelectContent>
            </Select>

            {/* Starred filter toggle */}
            <button
              onClick={() => setShowStarredOnly((v) => !v)}
              title={showStarredOnly ? "Show all notes" : "Show starred only"}
              className={`h-10 px-3 flex items-center gap-1.5 rounded-lg border transition-colors text-sm font-medium ${
                showStarredOnly
                  ? "bg-cyan-500/20 border-cyan-500/60 text-cyan-400"
                  : "bg-slate-800 border-cyan-700/30 text-gray-400 hover:text-cyan-400 hover:border-cyan-500/40"
              }`}
            >
              <Star
                className={`w-4 h-4 ${showStarredOnly ? "fill-cyan-400 text-cyan-400" : ""}`}
              />
              <span>Starred</span>
            </button>

            <button
              onClick={() => {
                const next = !selectionMode;
                setSelectionMode(next);
                if (!next) clearSelection();
              }}
              className={`h-10 px-3 flex items-center gap-1.5 rounded-lg border transition-colors text-sm font-medium ${
                selectionMode
                  ? "bg-cyan-500/20 border-cyan-500/60 text-cyan-400"
                  : "bg-slate-800 border-cyan-700/30 text-gray-400 hover:text-cyan-400 hover:border-cyan-500/40"
              }`}
              title={selectionMode ? "Exit select mode" : "Select multiple"}
            >
              {selectionMode ? (
                <CheckSquare2 className="w-4 h-4" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              <span>{selectionMode ? "Selected" : "Select"}</span>
            </button>

            {isProUser && (
              <>
                <Select
                  value={activeFolderId}
                  onValueChange={(value) => {
                    setActiveFolderId(value as string);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="h-10 w-full md:w-[200px] bg-slate-800 border-cyan-700/30 rounded-lg text-white focus:ring-1 focus:ring-cyan-600 transition-colors">
                    <SelectValue placeholder="All Folders" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-cyan-700/30 text-white">
                    <SelectItem value="all">All Folders</SelectItem>
                    {folders.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Input
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="New folder name"
                    className="h-10 w-full md:w-[200px] bg-slate-800 border-cyan-700/30 rounded-lg text-white"
                  />
                  <button
                    onClick={async () => {
                      if (!newFolderName.trim()) return;
                      const { data, error } = await notesService.createFolder({
                        name: newFolderName.trim(),
                      });
                      if (!error && data) {
                        setFolders((prev) => [
                          ...prev,
                          data,
                        ]);
                        setNewFolderName("");
                      }
                    }}
                    className="h-10 px-3 rounded-lg bg-slate-800 border border-cyan-700/30 text-gray-200 hover:text-cyan-400"
                  >
                    Add Folder
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {selectionMode && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <button
              onClick={toggleSelectAllOnPage}
              className="h-9 px-3 rounded-lg bg-slate-800 border border-cyan-700/30 text-gray-200 hover:text-cyan-400"
            >
              {isAllPageSelected ? "Unselect page" : "Select page"}
            </button>
            <button
              onClick={() => bulkStarSelected(true)}
              disabled={selectedIds.size === 0}
              className="h-9 px-3 rounded-lg bg-slate-800 border border-cyan-700/30 text-gray-200 hover:text-cyan-400 disabled:opacity-50"
            >
              Star
            </button>
            <button
              onClick={() => bulkStarSelected(false)}
              disabled={selectedIds.size === 0}
              className="h-9 px-3 rounded-lg bg-slate-800 border border-cyan-700/30 text-gray-200 hover:text-cyan-400 disabled:opacity-50"
            >
              Unstar
            </button>
            <button
              onClick={bulkDeleteSelected}
              disabled={selectedIds.size === 0}
              className="h-9 px-3 rounded-lg bg-red-900/40 border border-red-600/40 text-red-300 hover:text-red-200 disabled:opacity-50"
            >
              Delete
            </button>
            <button
              onClick={clearSelection}
              className="h-9 px-3 rounded-lg bg-slate-800 border border-cyan-700/30 text-gray-200 hover:text-cyan-400"
              title="Clear selection"
            >
              <span className="inline-flex items-center gap-1">
                <X className="w-4 h-4" />
                Clear
              </span>
            </button>
            <span className="text-sm text-gray-400">
              {selectedIds.size} selected
            </span>
          </div>
        )}

        {/* Trash Button - Bottom Right */}
        <button
          onClick={() => setIsTrashOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center justify-center w-10 h-10 group"
          title="View trash"
        >
          <Trash2 className="w-6 h-6 text-gray-400 group-hover:text-cyan-400 transition-all duration-300 group-hover:-translate-y-1" />
          {trashCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-medium rounded-full shadow-md transition-all duration-300 group-hover:-translate-y-1">
              {trashCount > 99 ? "99+" : trashCount}
            </span>
          )}
        </button>

        {/* Trash Sheet */}
        <TrashSheet
          open={isTrashOpen}
          onOpenChange={setIsTrashOpen}
          onRestore={handleRestore}
        />

        {filteredNotes.length === 0 ? (
          <div className="text-center py-16 mt-16">
            <SquaresSubtract className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 mb-6">{getEmptyMessage()}</p>
            {hasActiveFilters && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setShowStarredOnly(false);
                }}
                className="text-cyan-500 hover:text-cyan-400 transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-4 min-h-[400px]">
              {paginatedNotes
                .filter((n) =>
                  activeFolderId === "all" ? true : n.folder_id === activeFolderId
                )
                .map((note) => (
                <Card
                  key={note.id}
                  onClick={() => router.push(`/notes/${note.id}`)}
                  className="bg-slate-900 border-cyan-700/30 rounded-2xl shadow-xl cursor-pointer hover:border-cyan-700/60 transition-all hover:shadow-2xl group overflow-hidden"
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
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {selectionMode && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelect(note.id);
                            }}
                            title={selectedIds.has(note.id) ? "Unselect" : "Select"}
                            className={`p-2 transition-colors ${
                              selectedIds.has(note.id)
                                ? "text-cyan-400 hover:text-cyan-300"
                                : "text-gray-500 hover:text-cyan-400"
                            }`}
                          >
                            {selectedIds.has(note.id) ? (
                              <CheckSquare2 className="w-4 h-4" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        )}
                        {isProUser && folders.length > 0 && (
                          <Select
                            value={note.folder_id || "none"}
                            onValueChange={async (value) => {
                              const folderId = value === "none" ? null : value;
                              // Optimistic UI
                              setAllNotes((prev) =>
                                prev.map((n) =>
                                  n.id === note.id ? { ...n, folder_id: folderId } : n
                                )
                              );
                              const { error } = await notesService.moveNoteToFolder(
                                note.id,
                                folderId
                              );
                              if (error) {
                                // revert
                                setAllNotes((prev) =>
                                  prev.map((n) =>
                                    n.id === note.id ? { ...n, folder_id: note.folder_id || null } : n
                                  )
                                );
                              }
                            }}
                          >
                            <SelectTrigger className="h-8 w-[120px] bg-slate-800 border-cyan-700/30 rounded text-xs text-white">
                              <SelectValue placeholder="Folder" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-cyan-700/30 text-white">
                              <SelectItem value="none">No Folder</SelectItem>
                              {folders.map((f) => (
                                <SelectItem key={f.id} value={f.id}>
                                  {f.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {/* Star Button */}
                        <button
                          onClick={(e) => handleToggleStar(note, e)}
                          className={`p-2 transition-colors ${
                            note.is_starred
                              ? "text-cyan-400 hover:text-cyan-300"
                              : "text-gray-500 hover:text-cyan-400"
                          }`}
                          title={note.is_starred ? "Unstar note" : "Star note"}
                        >
                          <Star
                            className={`w-4 h-4 ${note.is_starred ? "fill-cyan-400" : ""}`}
                          />
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
              ))}
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
