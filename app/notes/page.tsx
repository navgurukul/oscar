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
import { SquaresSubtract, Trash2, Search, Star } from "lucide-react";
import type { DBNote } from "@/lib/types/note.types";
import { getTimeBasedPrompt } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
  const [currentPage, setCurrentPage] = useState(1);
  // Organization filters
  const [selectedNotebook, setSelectedNotebook] = useState<string | "all">("all");
  const [tagFilter, setTagFilter] = useState<string>("");

  useEffect(() => {
    loadNotes();
    setContextPrompt(getTimeBasedPrompt());
  }, []);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy, showOnlyStarred, selectedNotebook, tagFilter]);

  // Derive available notebooks and tags from notes
  const allNotebooks = useMemo(() => {
    const set = new Set<string>();
    allNotes.forEach((note) => {
      if (note.notebook) set.add(note.notebook);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allNotes]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    allNotes.forEach((note) => {
      (note.tags || []).forEach((tag) => set.add(tag));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allNotes]);

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

    // Filter by notebook
    if (selectedNotebook !== "all") {
      result = result.filter((note) => note.notebook === selectedNotebook);
    }

    // Filter by tag
    if (tagFilter.trim()) {
      const tag = tagFilter.trim().toLowerCase();
      result = result.filter((note) =>
        (note.tags || []).some((t) => t.toLowerCase() === tag)
      );
    }

    // Filter by starred
    if (showOnlyStarred) {
      result = result.filter((note) => note.is_starred);
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
  }, [allNotes, searchQuery, sortBy, showOnlyStarred]);

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
    searchQuery.trim() || showOnlyStarred || selectedNotebook !== "all" || tagFilter.trim();

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
    if (selectedNotebook !== "all") {
      return "No notes in this notebook";
    }
    if (tagFilter.trim()) {
      return "No notes with this tag";
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

            {/* Notebook Filter */}
            {allNotebooks.length > 0 && (
              <Select
                value={selectedNotebook}
                onValueChange={(value) => setSelectedNotebook(value as string | "all")}
              >
                <SelectTrigger className="h-10 w-full md:w-[180px] bg-slate-800 border-cyan-700/30 rounded-lg text-white focus:ring-1 focus:ring-cyan-600 transition-colors">
                  <SelectValue placeholder="Notebook" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-cyan-700/30 text-white">
                  <SelectItem value="all">All Notebooks</SelectItem>
                  {allNotebooks.map((nb) => (
                    <SelectItem key={nb} value={nb}>
                      {nb}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Tag Filter */}
            <div className="w-full md:w-[180px]">
              <Input
                type="text"
                placeholder="Filter by tag"
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                className="h-10 w-full bg-slate-800 border border-cyan-700/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-600 transition-colors"
              />
            </div>

            {/* Sort Dropdown */}
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
              {paginatedNotes.map((note) => (
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
                        {/* Star Button */}
                        <button
                          onClick={(e) =>
                            handleToggleStar(note.id, note.is_starred, e)
                          }
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
