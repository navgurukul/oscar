"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FolderPlus,
  Inbox,
  Search,
  Sparkles,
  Star,
  Trash2,
  Clock3,
  Folder,
  CheckSquare,
  Square,
  ArrowUpDown,
} from "lucide-react";
import { TrashSheet } from "@/components/notes/TrashSheet";
import { NotesListSkeleton } from "@/components/shared/NotesListSkeleton";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/contexts/AuthContext";
import { notesService } from "@/lib/services/notes.service";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { DBNote } from "@/lib/types/note.types";

type SortOption = "updated" | "created" | "length" | "title";
type SavedViewKey = "all" | "recent" | "starred" | "unfoldered" | `folder:${string}`;

const ITEMS_PER_PAGE = 8;
const RECENT_WINDOW_DAYS = 14;
const VIEW_STORAGE_KEY = "oscar-scribble-view";
const SYSTEM_VIEWS: Array<{
  id: Exclude<SavedViewKey, `folder:${string}`>;
  label: string;
  icon: typeof Inbox;
  description: string;
}> = [
  {
    id: "all",
    label: "All Scribbles",
    icon: Sparkles,
    description: "Everything captured from Stream in one place.",
  },
  {
    id: "recent",
    label: "Recent",
    icon: Clock3,
    description: `Updated in the last ${RECENT_WINDOW_DAYS} days.`,
  },
  {
    id: "starred",
    label: "Starred",
    icon: Star,
    description: "Your keepers, pinned for quick return trips.",
  },
  {
    id: "unfoldered",
    label: "Unsorted",
    icon: Inbox,
    description: "Scribbles that still need a home.",
  },
];

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getPreview(note: DBNote) {
  const text = note.edited_text || note.original_formatted_text;
  return text.length > 180 ? `${text.slice(0, 180).trim()}...` : text;
}

function isFolderView(view: SavedViewKey): view is `folder:${string}` {
  return view.startsWith("folder:");
}

function getFolderName(view: `folder:${string}`) {
  return view.slice("folder:".length);
}

function getRecentCutoff() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RECENT_WINDOW_DAYS);
  return cutoff.getTime();
}

function mergeNotes(previous: DBNote[], incoming: DBNote[]) {
  const map = new Map(previous.map((note) => [note.id, note]));
  incoming.forEach((note) => {
    map.set(note.id, note);
  });
  return Array.from(map.values());
}

export default function NotesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const [allNotes, setAllNotes] = useState<DBNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery);
  const [sortBy, setSortBy] = useState<SortOption>("updated");
  const [currentView, setCurrentView] = useState<SavedViewKey>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [trashCount, setTrashCount] = useState(0);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [isApplyingBulkAction, setIsApplyingBulkAction] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const folderCounts = useMemo(() => {
    const counts = new Map<string, number>();
    allNotes.forEach((note) => {
      if (!note.folder) return;
      counts.set(note.folder, (counts.get(note.folder) ?? 0) + 1);
    });
    return counts;
  }, [allNotes]);

  const folders = useMemo(() => {
    return Array.from(folderCounts.keys()).sort((left, right) => left.localeCompare(right));
  }, [folderCounts]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push(`/auth?redirectTo=${encodeURIComponent("/notes")}`);
      return;
    }

    void loadWorkspace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [currentView, deferredSearch, sortBy]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedView = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (!storedView) return;

    if (
      storedView === "all" ||
      storedView === "recent" ||
      storedView === "starred" ||
      storedView === "unfoldered"
    ) {
      setCurrentView(storedView);
      return;
    }

    if (storedView.startsWith("folder:")) {
      const folderName = storedView.slice("folder:".length);
      if (folders.includes(folderName)) {
        setCurrentView(storedView as SavedViewKey);
      }
    }
  }, [folders]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(VIEW_STORAGE_KEY, currentView);
  }, [currentView]);

  useEffect(() => {
    if (isFolderView(currentView) && !folders.includes(getFolderName(currentView))) {
      setCurrentView("all");
    }
  }, [currentView, folders]);

  const viewCounts = useMemo(() => {
    const recentCutoff = getRecentCutoff();
    return {
      all: allNotes.length,
      recent: allNotes.filter(
        (note) => new Date(note.updated_at).getTime() >= recentCutoff
      ).length,
      starred: allNotes.filter((note) => note.is_starred).length,
      unfoldered: allNotes.filter((note) => !note.folder).length,
    };
  }, [allNotes]);

  const filteredNotes = useMemo(() => {
    const recentCutoff = getRecentCutoff();
    const query = deferredSearch.trim().toLowerCase();

    let notes = allNotes.filter((note) => {
      if (currentView === "recent") {
        return new Date(note.updated_at).getTime() >= recentCutoff;
      }

      if (currentView === "starred") {
        return note.is_starred;
      }

      if (currentView === "unfoldered") {
        return !note.folder;
      }

      if (isFolderView(currentView)) {
        return note.folder === getFolderName(currentView);
      }

      return true;
    });

    if (query) {
      notes = notes.filter((note) => {
        const content = (note.edited_text || note.original_formatted_text).toLowerCase();
        return (
          note.title.toLowerCase().includes(query) ||
          content.includes(query) ||
          (note.folder ?? "").toLowerCase().includes(query)
        );
      });
    }

    notes.sort((left, right) => {
      switch (sortBy) {
        case "created":
          return (
            new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
          );
        case "length":
          return (
            (right.edited_text || right.original_formatted_text).length -
            (left.edited_text || left.original_formatted_text).length
          );
        case "title":
          return left.title.localeCompare(right.title);
        case "updated":
        default:
          return (
            new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()
          );
      }
    });

    return notes;
  }, [allNotes, currentView, deferredSearch, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredNotes.length / ITEMS_PER_PAGE));
  const paginatedNotes = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredNotes.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredNotes, currentPage]);

  const selectedCount = selectedIds.size;
  const pageSelectionState = useMemo(() => {
    if (paginatedNotes.length === 0) return "none";
    const selectedOnPage = paginatedNotes.filter((note) => selectedIds.has(note.id)).length;
    if (selectedOnPage === 0) return "none";
    if (selectedOnPage === paginatedNotes.length) return "all";
    return "some";
  }, [paginatedNotes, selectedIds]);

  const activeViewLabel = useMemo(() => {
    if (isFolderView(currentView)) return getFolderName(currentView);
    return SYSTEM_VIEWS.find((view) => view.id === currentView)?.label ?? "Scribble";
  }, [currentView]);

  const activeViewDescription = useMemo(() => {
    if (isFolderView(currentView)) {
      return `${folderCounts.get(getFolderName(currentView)) ?? 0} Scribbles in this folder.`;
    }

    return (
      SYSTEM_VIEWS.find((view) => view.id === currentView)?.description ??
      "Everything captured from Stream in one place."
    );
  }, [currentView, folderCounts]);

  async function loadWorkspace() {
    setIsLoading(true);
    setError(null);

    const [notesResult, trashedResult] = await Promise.all([
      notesService.getNotes(),
      notesService.getTrashedNotes(),
    ]);

    if (notesResult.error) {
      setError("Could not load Scribble right now. Please try again.");
    } else {
      setAllNotes(notesResult.data ?? []);
    }
    if (!trashedResult.error) {
      setTrashCount(trashedResult.data?.length ?? 0);
    }

    setIsLoading(false);
  }

  function updateNotesInState(updatedNotes: DBNote[]) {
    setAllNotes((previous) => mergeNotes(previous, updatedNotes));
  }

  function handleToggleSelection(id: string) {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleToggleSelectPage() {
    setSelectedIds((previous) => {
      const next = new Set(previous);

      if (pageSelectionState === "all") {
        paginatedNotes.forEach((note) => next.delete(note.id));
      } else {
        paginatedNotes.forEach((note) => next.add(note.id));
      }

      return next;
    });
  }

  async function handleToggleStar(note: DBNote, event: React.MouseEvent) {
    event.stopPropagation();
    const newStarred = !note.is_starred;

    setAllNotes((previous) =>
      previous.map((item) =>
        item.id === note.id ? { ...item, is_starred: newStarred } : item
      )
    );

    const { data, error } = await notesService.toggleStar(note.id, newStarred);
    if (error || !data) {
      setAllNotes((previous) =>
        previous.map((item) =>
          item.id === note.id ? { ...item, is_starred: note.is_starred } : item
        )
      );
      toast({
        title: "Couldn’t update star",
        description: "Please try again.",
        variant: "destructive",
      });
      return;
    }

    updateNotesInState([data]);
  }

  async function handleDeleteOne(noteId: string, event: React.MouseEvent) {
    event.stopPropagation();
    if (!window.confirm("Move this Scribble to trash?")) return;

    const { error: deleteError } = await notesService.deleteNote(noteId);
    if (deleteError) {
      toast({
        title: "Couldn’t move Scribble to trash",
        description: "Please try again.",
        variant: "destructive",
      });
      return;
    }

    setAllNotes((previous) => previous.filter((note) => note.id !== noteId));
    setSelectedIds((previous) => {
      const next = new Set(previous);
      next.delete(noteId);
      return next;
    });
    setTrashCount((previous) => previous + 1);
  }

  async function applyBulkUpdate(
    updates: Parameters<typeof notesService.updateNotes>[1],
    successMessage: string
  ) {
    if (selectedCount === 0) return;

    setIsApplyingBulkAction(true);
    const ids = Array.from(selectedIds);
    const { data, error: updateError } = await notesService.updateNotes(ids, updates);

    if (updateError || !data) {
      toast({
        title: "Bulk action failed",
        description: "Please try again.",
        variant: "destructive",
      });
      setIsApplyingBulkAction(false);
      return;
    }

    updateNotesInState(data);
    setSelectedIds(new Set());
    toast({
      title: successMessage,
      description: `${data.length} Scribble${data.length === 1 ? "" : "s"} updated.`,
    });
    setIsApplyingBulkAction(false);
  }

  async function handleDeleteSelected() {
    if (selectedCount === 0) return;
    if (!window.confirm(`Move ${selectedCount} selected Scribbles to trash?`)) return;

    setIsApplyingBulkAction(true);
    const ids = Array.from(selectedIds);
    const { data, error: deleteError } = await notesService.deleteNotes(ids);

    if (deleteError || !data) {
      toast({
        title: "Couldn’t move Scribbles to trash",
        description: "Please try again.",
        variant: "destructive",
      });
      setIsApplyingBulkAction(false);
      return;
    }

    setAllNotes((previous) => previous.filter((note) => !selectedIds.has(note.id)));
    setSelectedIds(new Set());
    setTrashCount((previous) => previous + data.length);
    toast({
      title: "Moved to trash",
      description: `${data.length} Scribble${data.length === 1 ? "" : "s"} moved to trash.`,
    });
    setIsApplyingBulkAction(false);
  }

  async function handleCreateFolderFromSelection() {
    const trimmedName = newFolderName.trim();

    if (!trimmedName) {
      toast({
        title: "Folder name required",
        description: "Give the folder a name first.",
        variant: "destructive",
      });
      return;
    }

    if (selectedCount === 0) {
      toast({
        title: "Select Scribbles first",
        description: "Folders are created the first time you move one or more Scribbles into them.",
        variant: "destructive",
      });
      return;
    }

    await applyBulkUpdate({ folder: trimmedName }, "Folder created");
    setCurrentView(`folder:${trimmedName}`);
    setNewFolderName("");
  }

  function handleTrashRestore() {
    void loadWorkspace();
  }

  function renderPaginationItems() {
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
            href="#"
            onClick={(event) => {
              event.preventDefault();
              setCurrentPage(1);
            }}
          >
            1
          </PaginationLink>
        </PaginationItem>
      );

      if (startPage > 2) {
        items.push(<PaginationEllipsis key="ellipsis-start" />);
      }
    }

    for (let page = startPage; page <= endPage; page += 1) {
      items.push(
        <PaginationItem key={page}>
          <PaginationLink
            href="#"
            isActive={currentPage === page}
            onClick={(event) => {
              event.preventDefault();
              setCurrentPage(page);
            }}
          >
            {page}
          </PaginationLink>
        </PaginationItem>
      );
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        items.push(<PaginationEllipsis key="ellipsis-end" />);
      }

      items.push(
        <PaginationItem key={totalPages}>
          <PaginationLink
            href="#"
            onClick={(event) => {
              event.preventDefault();
              setCurrentPage(totalPages);
            }}
          >
            {totalPages}
          </PaginationLink>
        </PaginationItem>
      );
    }

    return items;
  }

  if (isLoading || authLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center px-4 pt-24 pb-24">
        <div className="w-full max-w-5xl">
          <div className="mb-8 space-y-3">
            <div className="h-4 w-24 rounded-full bg-white/10" />
            <div className="h-10 w-64 rounded-full bg-white/10" />
          </div>
          <NotesListSkeleton />
        </div>
      </main>
    );
  }

  const isEmptyWorkspace = allNotes.length === 0;

  return (
    <main className="min-h-screen bg-[#020617] px-4 pt-24 pb-24 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
              <Sparkles className="h-3.5 w-3.5" />
              Scribble
            </div>
            <div className="space-y-2">
              <h1 className="text-4xl font-semibold tracking-tight text-white">
                Organize every Stream in one calm workspace.
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-400">
                Jump between recent, starred, and folder views, then tidy multiple
                Scribbles at once without leaving the page.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsTrashOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-cyan-500/30 hover:text-cyan-200"
            >
              <Trash2 className="h-4 w-4" />
              Trash
              {trashCount > 0 && (
                <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-200">
                  {trashCount}
                </span>
              )}
            </button>
            <button
              onClick={() => router.push("/recording")}
              className="inline-flex items-center gap-2 rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              <Sparkles className="h-4 w-4" />
              Start a Stream
            </button>
          </div>
        </header>

        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[280px,minmax(0,1fr)]">
          <aside className="space-y-4">
            <section className="rounded-[28px] border border-white/8 bg-white/[0.03] p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Saved Views</h2>
                <span className="text-xs text-slate-500">{allNotes.length} total</span>
              </div>

              <div className="space-y-1.5">
                {SYSTEM_VIEWS.map((view) => {
                  const Icon = view.icon;
                  const isActive = currentView === view.id;
                  const count = viewCounts[view.id];

                  return (
                    <button
                      key={view.id}
                      onClick={() => setCurrentView(view.id)}
                      className={cn(
                        "flex w-full items-start justify-between rounded-2xl px-3 py-3 text-left transition",
                        isActive
                          ? "bg-cyan-500/10 text-cyan-100 ring-1 ring-cyan-500/30"
                          : "bg-transparent text-slate-300 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "mt-0.5 rounded-full p-1.5",
                            isActive ? "bg-cyan-500/20" : "bg-white/5"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-sm font-medium">{view.label}</div>
                          <div className="mt-1 text-xs leading-5 text-slate-500">
                            {view.description}
                          </div>
                        </div>
                      </div>
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs font-semibold text-slate-400">
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-[28px] border border-white/8 bg-white/[0.03] p-4">
              <div className="mb-3 space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Folder className="h-4 w-4 text-cyan-300" />
                  Folders
                </div>
                <p className="text-xs leading-5 text-slate-500">
                  Create a folder by moving selected Scribbles into it.
                </p>
              </div>

              <div className="mb-4 flex gap-2">
                <Input
                  value={newFolderName}
                  onChange={(event) => setNewFolderName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !isApplyingBulkAction) {
                      void handleCreateFolderFromSelection();
                    }
                  }}
                  placeholder="New folder"
                  className="border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-cyan-500/30"
                />
                <button
                  onClick={() => void handleCreateFolderFromSelection()}
                  disabled={isApplyingBulkAction}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 text-cyan-100 transition hover:bg-cyan-500/20 disabled:opacity-50"
                  title="Create folder from selection"
                >
                  {isApplyingBulkAction ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    <FolderPlus className="h-4 w-4" />
                  )}
                </button>
              </div>

              {folders.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 px-3 py-4 text-sm text-slate-500">
                  No folders yet.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {folders.map((folderName) => {
                    const isActive = currentView === `folder:${folderName}`;
                    return (
                      <button
                        key={folderName}
                        onClick={() => setCurrentView(`folder:${folderName}`)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left transition",
                          isActive
                            ? "bg-emerald-500/10 text-emerald-100 ring-1 ring-emerald-500/30"
                            : "bg-transparent text-slate-300 hover:bg-white/5 hover:text-white"
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className={cn(
                              "rounded-full p-1.5",
                              isActive ? "bg-emerald-500/15" : "bg-white/5"
                            )}
                          >
                            <Folder className="h-4 w-4" />
                          </div>
                          <span className="truncate text-sm font-medium">{folderName}</span>
                        </div>
                        <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs font-semibold text-slate-400">
                          {folderCounts.get(folderName) ?? 0}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </aside>

          <section className="rounded-[32px] border border-white/8 bg-white/[0.03] p-4 md:p-6">
            <div className="flex flex-col gap-4 border-b border-white/8 pb-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-1">
                  <h2 className="text-2xl font-semibold tracking-tight text-white">
                    {activeViewLabel}
                  </h2>
                  <p className="text-sm text-slate-400">{activeViewDescription}</p>
                </div>
                <div className="text-sm text-slate-500">
                  {filteredNotes.length} result{filteredNotes.length === 1 ? "" : "s"}
                </div>
              </div>

              <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search Scribble by title, text, or folder..."
                    className="border-white/10 bg-white/5 pl-10 text-white placeholder:text-slate-500 focus-visible:ring-cyan-500/30"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Select
                    value={sortBy}
                    onValueChange={(value) => setSortBy(value as SortOption)}
                  >
                    <SelectTrigger className="h-10 w-[180px] border-white/10 bg-white/5 text-white">
                      <div className="flex items-center gap-2 text-sm text-slate-300">
                        <ArrowUpDown className="h-4 w-4 text-slate-500" />
                        <SelectValue placeholder="Sort" />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="border-white/10 bg-slate-950 text-white">
                      <SelectItem value="updated">Recently Updated</SelectItem>
                      <SelectItem value="created">Recently Created</SelectItem>
                      <SelectItem value="length">Longest First</SelectItem>
                      <SelectItem value="title">Title A-Z</SelectItem>
                    </SelectContent>
                  </Select>

                  <button
                    onClick={handleToggleSelectPage}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-medium text-slate-200 transition hover:border-cyan-500/20 hover:text-white"
                  >
                    {pageSelectionState === "all" ? (
                      <CheckSquare className="h-4 w-4 text-cyan-300" />
                    ) : (
                      <Square className="h-4 w-4 text-slate-500" />
                    )}
                    {pageSelectionState === "all" ? "Clear page" : "Select page"}
                  </button>
                </div>
              </div>
            </div>

            {selectedCount > 0 && (
              <div className="mt-4 flex flex-col gap-3 rounded-[24px] border border-cyan-500/20 bg-cyan-500/8 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="text-sm text-cyan-50">
                    <span className="font-semibold">{selectedCount}</span> Scribble
                    {selectedCount === 1 ? "" : "s"} selected
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => void applyBulkUpdate({ is_starred: true }, "Starred selection")}
                      disabled={isApplyingBulkAction}
                      className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/15 disabled:opacity-50"
                    >
                      Star
                    </button>
                    <button
                      onClick={() => void applyBulkUpdate({ is_starred: false }, "Unstarred selection")}
                      disabled={isApplyingBulkAction}
                      className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/15 disabled:opacity-50"
                    >
                      Unstar
                    </button>
                    <button
                      onClick={() => void applyBulkUpdate({ folder: null }, "Removed from folder")}
                      disabled={isApplyingBulkAction}
                      className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/15 disabled:opacity-50"
                    >
                      Clear folder
                    </button>
                    <button
                      onClick={() => void handleDeleteSelected()}
                      disabled={isApplyingBulkAction}
                      className="rounded-full border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-100 transition hover:bg-red-500/15 disabled:opacity-50"
                    >
                      Move to trash
                    </button>
                  </div>
                </div>

                {folders.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {folders.map((folderName) => (
                      <button
                        key={folderName}
                        onClick={() => void applyBulkUpdate({ folder: folderName }, `Moved to ${folderName}`)}
                        disabled={isApplyingBulkAction}
                        className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/15 disabled:opacity-50"
                      >
                        Move to {folderName}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mt-5 min-h-[420px]">
              {isEmptyWorkspace ? (
                <div className="flex min-h-[420px] flex-col items-center justify-center rounded-[28px] border border-dashed border-white/10 px-6 text-center">
                  <Sparkles className="mb-4 h-12 w-12 text-cyan-400/70" />
                  <h3 className="text-2xl font-semibold text-white">No Scribbles yet</h3>
                  <p className="mt-3 max-w-md text-sm leading-6 text-slate-400">
                    Start a Stream and OSCAR will clean it up, title it, and file it
                    here for you.
                  </p>
                  <button
                    onClick={() => router.push("/recording")}
                    className="mt-6 rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
                  >
                    Start a Stream
                  </button>
                </div>
              ) : filteredNotes.length === 0 ? (
                <div className="flex min-h-[420px] flex-col items-center justify-center rounded-[28px] border border-dashed border-white/10 px-6 text-center">
                  <Search className="mb-4 h-12 w-12 text-slate-600" />
                  <h3 className="text-2xl font-semibold text-white">Nothing matches this view</h3>
                  <p className="mt-3 max-w-md text-sm leading-6 text-slate-400">
                    Try a different saved view or clear the search to bring more
                    Scribbles back into view.
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setCurrentView("all");
                    }}
                    className="mt-6 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-cyan-500/20 hover:text-white"
                  >
                    Reset filters
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {paginatedNotes.map((note) => {
                    const isSelected = selectedIds.has(note.id);

                    return (
                      <article
                        key={note.id}
                        className={cn(
                          "group rounded-[28px] border px-4 py-4 transition md:px-5",
                          isSelected
                            ? "border-cyan-500/30 bg-cyan-500/[0.08]"
                            : "border-white/8 bg-white/[0.02] hover:border-cyan-500/20 hover:bg-white/[0.04]"
                        )}
                      >
                        <div className="flex gap-4">
                          <button
                            onClick={() => handleToggleSelection(note.id)}
                            className="mt-1 h-5 w-5 shrink-0 rounded-md text-slate-400 transition hover:text-cyan-200"
                            aria-label={isSelected ? "Deselect Scribble" : "Select Scribble"}
                          >
                            {isSelected ? (
                              <CheckSquare className="h-5 w-5 text-cyan-300" />
                            ) : (
                              <Square className="h-5 w-5" />
                            )}
                          </button>

                          <div
                            className="min-w-0 flex-1 cursor-pointer"
                            onClick={() => router.push(`/notes/${note.id}`)}
                          >
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                              <div className="min-w-0 space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="truncate text-lg font-semibold text-white">
                                    {note.title || "Untitled Note"}
                                  </h3>
                                  {note.is_starred && (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-200">
                                      <Star className="h-3 w-3 fill-current" />
                                      Starred
                                    </span>
                                  )}
                                  {note.folder && (
                                    <button
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setCurrentView(`folder:${note.folder}`);
                                      }}
                                      className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-200"
                                    >
                                      <Folder className="h-3 w-3" />
                                      {note.folder}
                                    </button>
                                  )}
                                </div>

                                <p className="max-w-3xl text-sm leading-6 text-slate-400">
                                  {getPreview(note)}
                                </p>
                              </div>

                              <div className="shrink-0 text-xs text-slate-500">
                                {formatDate(note.updated_at)}
                              </div>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-start gap-1">
                            <button
                              onClick={(event) => void handleToggleStar(note, event)}
                              className={cn(
                                "rounded-xl p-2 transition",
                                note.is_starred
                                  ? "text-cyan-300 hover:bg-cyan-500/10"
                                  : "text-slate-500 hover:bg-white/5 hover:text-cyan-200"
                              )}
                              title={note.is_starred ? "Unstar Scribble" : "Star Scribble"}
                            >
                              <Star
                                className={cn(
                                  "h-4 w-4",
                                  note.is_starred && "fill-current"
                                )}
                              />
                            </button>
                            <button
                              onClick={(event) => void handleDeleteOne(note.id, event)}
                              className="rounded-xl p-2 text-slate-500 transition hover:bg-white/5 hover:text-red-200"
                              title="Move Scribble to trash"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            {filteredNotes.length > 0 && totalPages > 1 && (
              <div className="mt-6 overflow-x-auto pb-2">
                <Pagination>
                  <PaginationContent className="flex-nowrap gap-1">
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(event) => {
                          event.preventDefault();
                          if (currentPage > 1) setCurrentPage(currentPage - 1);
                        }}
                        className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    {renderPaginationItems()}
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(event) => {
                          event.preventDefault();
                          if (currentPage < totalPages) setCurrentPage(currentPage + 1);
                        }}
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
          </section>
        </div>
      </div>

      <TrashSheet
        open={isTrashOpen}
        onOpenChange={setIsTrashOpen}
        onRestore={handleTrashRestore}
      />
    </main>
  );
}
