"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
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
} from "lucide-react";
import { TrashSheet } from "@/components/scribble/TrashSheet";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/lib/contexts/AuthContext";
import { scribblesService } from "@/lib/services/scribbles.service";
import { useScribbles, useTrashedScribbles } from "@/lib/hooks/queries/useScribbles";
import { queryKeys } from "@/lib/hooks/queries/keys";
import { useToast } from "@/hooks/use-toast";
import type { DBScribble } from "@/lib/types/scribble.types";
import {
  v2,
  v2Serif,
  v2Mono,
  V2Caps,
  V2Mono,
  V2Source,
  V2WebHeader,
  V2Avatar,
} from "@/components/v2/V2Primitives";

type SortOption = "updated" | "created" | "length" | "title";
type SavedViewKey = "all" | "recent" | "starred" | "unfoldered" | `folder:${string}`;

const ITEMS_PER_PAGE = 10;
const RECENT_WINDOW_DAYS = 14;
const VIEW_STORAGE_KEY = "oscar-scribble-view";

const SYSTEM_VIEWS: Array<{
  id: Exclude<SavedViewKey, `folder:${string}`>;
  label: string;
  icon: typeof Inbox;
}> = [
  { id: "all", label: "All Scribbles", icon: Sparkles },
  { id: "recent", label: "Recent", icon: Clock3 },
  { id: "starred", label: "Starred", icon: Star },
  { id: "unfoldered", label: "Unsorted", icon: Inbox },
];

function formatDateLong(d: string) {
  return new Date(d)
    .toLocaleDateString(undefined, {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .toUpperCase();
}

function previewOf(s: DBScribble) {
  const text = s.edited_text || s.original_formatted_text || "";
  return text.length > 220 ? `${text.slice(0, 220).trim()}…` : text;
}

function isFolderView(view: SavedViewKey): view is `folder:${string}` {
  return view.startsWith("folder:");
}

function folderNameOf(view: `folder:${string}`) {
  return view.slice("folder:".length);
}

function recentCutoff() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RECENT_WINDOW_DAYS);
  return cutoff.getTime();
}

function mergeScribbles(prev: DBScribble[], next: DBScribble[]) {
  const map = new Map(prev.map((s) => [s.id, s]));
  next.forEach((s) => map.set(s.id, s));
  return Array.from(map.values());
}

export default function ScribblePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const qc = useQueryClient();

  // The library is React-Query-backed so writes from anywhere (results page,
  // detail page, trash sheet) reconcile here, and refetchOnMount: "always"
  // (see useScribbles) re-pulls fresh data on every navigation into the page.
  const queriesEnabled = !authLoading && !!user;
  const {
    data: allScribbles = [],
    isLoading: scribblesLoading,
    isError: scribblesError,
  } = useScribbles(queriesEnabled);
  const { data: trashed = [] } = useTrashedScribbles(queriesEnabled);
  const isLoading = queriesEnabled && scribblesLoading;
  const error = scribblesError ? "Could not load your library. Please try again." : null;
  const trashCount = trashed.length;

  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery);
  const [sortBy, setSortBy] = useState<SortOption>("updated");
  const [currentView, setCurrentView] = useState<SavedViewKey>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // Apply an optimistic/authoritative update to the shared ["scribbles"] cache.
  const patchScribblesCache = (updater: (prev: DBScribble[]) => DBScribble[]) =>
    qc.setQueryData<DBScribble[]>(queryKeys.scribbles, (prev) => updater(prev ?? []));

  const folderCounts = useMemo(() => {
    const counts = new Map<string, number>();
    allScribbles.forEach((s) => {
      if (!s.folder) return;
      counts.set(s.folder, (counts.get(s.folder) ?? 0) + 1);
    });
    return counts;
  }, [allScribbles]);

  const folders = useMemo(
    () => Array.from(folderCounts.keys()).sort((a, b) => a.localeCompare(b)),
    [folderCounts]
  );

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push(`/auth?redirectTo=${encodeURIComponent("/scribble")}`);
    }
    // Data loading is handled by the useScribbles/useTrashedScribbles queries.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [currentView, deferredSearch, sortBy]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (!stored) return;
    if (["all", "recent", "starred", "unfoldered"].includes(stored)) {
      setCurrentView(stored as SavedViewKey);
      return;
    }
    if (stored.startsWith("folder:")) {
      const name = stored.slice("folder:".length);
      if (folders.includes(name)) setCurrentView(stored as SavedViewKey);
    }
  }, [folders]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(VIEW_STORAGE_KEY, currentView);
  }, [currentView]);

  useEffect(() => {
    if (isFolderView(currentView) && !folders.includes(folderNameOf(currentView))) {
      setCurrentView("all");
    }
  }, [currentView, folders]);

  const viewCounts = useMemo(() => {
    const cutoff = recentCutoff();
    return {
      all: allScribbles.length,
      recent: allScribbles.filter((s) => new Date(s.updated_at).getTime() >= cutoff).length,
      starred: allScribbles.filter((s) => s.is_starred).length,
      unfoldered: allScribbles.filter((s) => !s.folder).length,
    };
  }, [allScribbles]);

  const filtered = useMemo(() => {
    const cutoff = recentCutoff();
    const q = deferredSearch.trim().toLowerCase();
    let list = allScribbles.filter((s) => {
      if (currentView === "recent") return new Date(s.updated_at).getTime() >= cutoff;
      if (currentView === "starred") return s.is_starred;
      if (currentView === "unfoldered") return !s.folder;
      if (isFolderView(currentView)) return s.folder === folderNameOf(currentView);
      return true;
    });
    if (q) {
      list = list.filter((s) => {
        const content = (s.edited_text || s.original_formatted_text || "").toLowerCase();
        return (
          s.title.toLowerCase().includes(q) ||
          content.includes(q) ||
          (s.folder ?? "").toLowerCase().includes(q)
        );
      });
    }
    list.sort((l, r) => {
      switch (sortBy) {
        case "created":
          return new Date(r.created_at).getTime() - new Date(l.created_at).getTime();
        case "length":
          return (
            (r.edited_text || r.original_formatted_text || "").length -
            (l.edited_text || l.original_formatted_text || "").length
          );
        case "title":
          return l.title.localeCompare(r.title);
        default:
          return new Date(r.updated_at).getTime() - new Date(l.updated_at).getTime();
      }
    });
    return list;
  }, [allScribbles, currentView, deferredSearch, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paged = useMemo(
    () => filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [filtered, currentPage]
  );

  const selectedCount = selectedIds.size;
  const pageSelectionState = useMemo(() => {
    if (paged.length === 0) return "none";
    const onPage = paged.filter((s) => selectedIds.has(s.id)).length;
    if (onPage === 0) return "none";
    if (onPage === paged.length) return "all";
    return "some";
  }, [paged, selectedIds]);

  const activeViewLabel = useMemo(() => {
    if (isFolderView(currentView)) return folderNameOf(currentView);
    return SYSTEM_VIEWS.find((v) => v.id === currentView)?.label ?? "Library";
  }, [currentView]);

  function refreshTrash() {
    void qc.invalidateQueries({ queryKey: queryKeys.trashedScribbles });
  }

  function toggleSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (pageSelectionState === "all") paged.forEach((s) => next.delete(s.id));
      else paged.forEach((s) => next.add(s.id));
      return next;
    });
  }

  async function handleToggleStar(s: DBScribble, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const newStarred = !s.is_starred;
    patchScribblesCache((prev) =>
      prev.map((item) => (item.id === s.id ? { ...item, is_starred: newStarred } : item))
    );
    const { data, error: e2 } = await scribblesService.toggleStar(s.id, newStarred);
    if (e2 || !data) {
      patchScribblesCache((prev) =>
        prev.map((item) => (item.id === s.id ? { ...item, is_starred: s.is_starred } : item))
      );
      toast({ title: "Couldn't update star", variant: "destructive" });
      return;
    }
    patchScribblesCache((prev) => mergeScribbles(prev, [data]));
  }

  async function handleDeleteOne(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm("Move this Scribble to trash?")) return;
    const { error: e2 } = await scribblesService.deleteScribble(id);
    if (e2) {
      toast({ title: "Couldn't move Scribble to trash", variant: "destructive" });
      return;
    }
    patchScribblesCache((prev) => prev.filter((s) => s.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    refreshTrash();
  }

  async function applyBulkUpdate(
    updates: Parameters<typeof scribblesService.updateScribbles>[1],
    successMessage: string
  ) {
    if (selectedCount === 0) return;
    setIsApplying(true);
    const ids = Array.from(selectedIds);
    const { data, error: e2 } = await scribblesService.updateScribbles(ids, updates);
    if (e2 || !data) {
      toast({ title: "Bulk action failed", variant: "destructive" });
      setIsApplying(false);
      return;
    }
    patchScribblesCache((prev) => mergeScribbles(prev, data));
    setSelectedIds(new Set());
    toast({ title: successMessage, description: `${data.length} Scribble${data.length === 1 ? "" : "s"} updated.` });
    setIsApplying(false);
  }

  async function handleDeleteSelected() {
    if (selectedCount === 0) return;
    if (!window.confirm(`Move ${selectedCount} selected Scribbles to trash?`)) return;
    setIsApplying(true);
    const ids = Array.from(selectedIds);
    const { data, error: e2 } = await scribblesService.deleteScribbles(ids);
    if (e2 || !data) {
      toast({ title: "Couldn't move Scribbles to trash", variant: "destructive" });
      setIsApplying(false);
      return;
    }
    const removed = new Set(selectedIds);
    patchScribblesCache((prev) => prev.filter((s) => !removed.has(s.id)));
    setSelectedIds(new Set());
    refreshTrash();
    toast({ title: "Moved to trash", description: `${data.length} Scribble${data.length === 1 ? "" : "s"} moved.` });
    setIsApplying(false);
  }

  async function handleCreateFolder() {
    const name = newFolderName.trim();
    if (!name) {
      toast({ title: "Folder name required", variant: "destructive" });
      return;
    }
    if (selectedCount === 0) {
      toast({ title: "Select Scribbles first", description: "Folders are created when you move Scribbles into them.", variant: "destructive" });
      return;
    }
    await applyBulkUpdate({ folder: name }, "Folder created");
    setCurrentView(`folder:${name}`);
    setNewFolderName("");
  }

  if (isLoading || authLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: v2.cream }}>
        <Spinner />
      </main>
    );
  }

  const firstName =
    (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "S";

  return (
    <main style={{ background: v2.cream, color: v2.ink, minHeight: "100vh", fontFamily: "var(--font-figtree), system-ui" }}>
      <V2WebHeader
        active="LIBRARY"
        right={
          <>
            <V2Caps>{firstName.toUpperCase()}</V2Caps>
            <V2Avatar size={32} initial={firstName.charAt(0).toUpperCase()} />
          </>
        }
      />

      <section className="px-6 md:px-14 pt-16 md:pt-20 pb-10 md:pb-12">
        <V2Caps>
          YOUR LIBRARY · {allScribbles.length} SCRIBBLE{allScribbles.length === 1 ? "" : "S"}
          {trashCount > 0 ? ` · ${trashCount} IN TRASH` : ""}
        </V2Caps>
        <h1
          className="mt-3"
          style={{
            fontFamily: v2Serif,
            fontSize: "clamp(48px, 9vw, 84px)",
            lineHeight: 0.96,
            letterSpacing: "-0.025em",
            fontWeight: 500,
          }}
        >
          Everything you <em style={{ fontStyle: "italic", color: v2.accent }}>kept</em>.
        </h1>
        <p className="mt-7 max-w-xl text-[16px] leading-relaxed" style={{ color: v2.inkSoft }}>
          Search by what you said, where you said it from, or when. The library is yours — Oscar
          only helps you find your way back.
        </p>

        <div
          className="mt-8 flex items-center gap-4 max-w-2xl"
          style={{
            background: v2.cream2,
            border: `1px solid ${v2.rule}`,
            borderRadius: 999,
            padding: "13px 22px",
          }}
        >
          <Search className="h-4 w-4" style={{ color: v2.inkFaint }} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="What did I say about pricing?"
            className="flex-1 bg-transparent outline-none"
            style={{ fontSize: 15, color: v2.ink }}
          />
          <V2Mono style={{ fontSize: 10, color: v2.inkFaint, letterSpacing: "0.16em" }}>⌘K</V2Mono>
        </div>

        <div className="mt-6 flex items-center gap-3 flex-wrap">
          <button
            onClick={() => router.push("/recording")}
            className="inline-flex items-center gap-3 rounded-full px-5 py-2.5 text-[14px] font-medium"
            style={{ background: v2.ink, color: v2.cream }}
          >
            <span className="inline-block rounded-full" style={{ height: 7, width: 7, background: v2.accent }} />
            New Scribble
          </button>
          <button
            onClick={() => setIsTrashOpen(true)}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px]"
            style={{ border: `1px solid ${v2.rule}`, color: v2.inkSoft }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Trash
            {trashCount > 0 && (
              <V2Mono style={{ fontSize: 10, color: v2.accent, marginLeft: 2 }}>{trashCount}</V2Mono>
            )}
          </button>
        </div>
      </section>

      <section className="px-6 md:px-14 pt-8 md:pt-10 pb-6" style={{ borderTop: `1px solid ${v2.rule}` }}>
        <div className="grid grid-cols-12 gap-6 md:gap-10 items-start">
          <div className="col-span-12 md:col-span-3">
            <V2Caps>SAVED VIEWS</V2Caps>
            <div className="mt-4 space-y-1">
              {SYSTEM_VIEWS.map((v) => {
                const isActive = currentView === v.id;
                const count = viewCounts[v.id];
                return (
                  <button
                    key={v.id}
                    onClick={() => setCurrentView(v.id)}
                    className="w-full flex items-center justify-between py-1.5 text-left transition"
                    style={{ color: isActive ? v2.ink : v2.inkSoft, fontWeight: isActive ? 500 : 400, fontSize: 13 }}
                  >
                    <span className="flex items-center gap-2.5">
                      {isActive && <span style={{ color: v2.accent }}>→</span>}
                      {v.label}
                    </span>
                    <V2Mono style={{ fontSize: 11, color: v2.inkFaint }}>{count}</V2Mono>
                  </button>
                );
              })}
            </div>

            <div className="mt-8">
              <V2Caps>FOLDERS</V2Caps>
              <div className="mt-4 flex items-center gap-2">
                <input
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !isApplying && handleCreateFolder()}
                  placeholder="New folder"
                  className="flex-1 bg-transparent outline-none py-1.5 text-[13px]"
                  style={{ borderBottom: `1px solid ${v2.rule}`, color: v2.ink }}
                />
                <button
                  onClick={() => void handleCreateFolder()}
                  disabled={isApplying}
                  className="rounded-full p-1.5 transition"
                  style={{ color: v2.accent }}
                  title="Create folder from selection"
                >
                  {isApplying ? <Spinner className="h-3.5 w-3.5" /> : <FolderPlus className="h-3.5 w-3.5" />}
                </button>
              </div>
              {folders.length === 0 ? (
                <p className="mt-3 text-[12px]" style={{ color: v2.inkFaint }}>
                  No folders yet.
                </p>
              ) : (
                <div className="mt-3 space-y-1">
                  {folders.map((name) => {
                    const isActive = currentView === `folder:${name}`;
                    return (
                      <button
                        key={name}
                        onClick={() => setCurrentView(`folder:${name}`)}
                        className="w-full flex items-center justify-between py-1.5 text-left"
                        style={{
                          color: isActive ? v2.ink : v2.inkSoft,
                          fontWeight: isActive ? 500 : 400,
                          fontSize: 13,
                        }}
                      >
                        <span className="flex items-center gap-2.5 truncate">
                          {isActive && <span style={{ color: v2.accent }}>→</span>}
                          <Folder className="h-3.5 w-3.5" />
                          <span className="truncate">{name}</span>
                        </span>
                        <V2Mono style={{ fontSize: 11, color: v2.inkFaint }}>{folderCounts.get(name) ?? 0}</V2Mono>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="col-span-12 md:col-span-9">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
              <div className="flex items-center gap-2 flex-wrap">
                <V2Caps>FILTER</V2Caps>
                <span
                  style={{
                    fontFamily: v2Serif,
                    fontSize: 18,
                    fontWeight: 500,
                    color: v2.ink,
                    letterSpacing: "-0.005em",
                  }}
                >
                  {activeViewLabel}
                </span>
                <span style={{ fontSize: 13, color: v2.inkFaint, marginLeft: 8 }}>
                  · {filtered.length} result{filtered.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={toggleSelectPage}
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px]"
                  style={{ border: `1px solid ${v2.rule}`, color: v2.inkSoft }}
                >
                  {pageSelectionState === "all" ? (
                    <CheckSquare className="h-3.5 w-3.5" style={{ color: v2.accent }} />
                  ) : (
                    <Square className="h-3.5 w-3.5" />
                  )}
                  {pageSelectionState === "all" ? "Clear page" : "Select page"}
                </button>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="rounded-full px-3 py-1.5 text-[12px] bg-transparent outline-none"
                  style={{ border: `1px solid ${v2.rule}`, color: v2.inkSoft, fontFamily: v2Mono }}
                >
                  <option value="updated">Recently updated</option>
                  <option value="created">Recently created</option>
                  <option value="length">Longest first</option>
                  <option value="title">Title A–Z</option>
                </select>
              </div>
            </div>

            {error && (
              <div
                className="mb-6 px-4 py-3 rounded-lg text-[13px]"
                style={{ background: "rgba(184,98,61,0.08)", border: `1px solid ${v2.accent}`, color: v2.accent }}
              >
                {error}
              </div>
            )}

            {selectedCount > 0 && (
              <div
                className="mb-6 p-4 rounded-lg flex flex-wrap items-center gap-3 justify-between"
                style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}
              >
                <V2Caps color={v2.accent}>
                  {selectedCount} SELECTED
                </V2Caps>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => void applyBulkUpdate({ is_starred: true }, "Starred")}
                    disabled={isApplying}
                    className="rounded-full px-3 py-1.5 text-[12px]"
                    style={{ border: `1px solid ${v2.rule}`, color: v2.inkSoft }}
                  >
                    Star
                  </button>
                  <button
                    onClick={() => void applyBulkUpdate({ is_starred: false }, "Unstarred")}
                    disabled={isApplying}
                    className="rounded-full px-3 py-1.5 text-[12px]"
                    style={{ border: `1px solid ${v2.rule}`, color: v2.inkSoft }}
                  >
                    Unstar
                  </button>
                  <button
                    onClick={() => void applyBulkUpdate({ folder: null }, "Removed from folder")}
                    disabled={isApplying}
                    className="rounded-full px-3 py-1.5 text-[12px]"
                    style={{ border: `1px solid ${v2.rule}`, color: v2.inkSoft }}
                  >
                    Clear folder
                  </button>
                  <button
                    onClick={() => void handleDeleteSelected()}
                    disabled={isApplying}
                    className="rounded-full px-3 py-1.5 text-[12px]"
                    style={{ background: v2.accent, color: v2.cream }}
                  >
                    Move to trash
                  </button>
                </div>
              </div>
            )}

            {allScribbles.length === 0 ? (
              <div className="py-20 text-center">
                <V2Caps color={v2.accent}>YOUR LIBRARY · DAY ONE</V2Caps>
                <h3
                  className="mt-3"
                  style={{
                    fontFamily: v2Serif,
                    fontSize: 56,
                    lineHeight: 0.98,
                    letterSpacing: "-0.025em",
                    fontWeight: 500,
                  }}
                >
                  Nothing here<br />
                  <em style={{ color: v2.accent }}>yet</em>.
                </h3>
                <p
                  className="mt-6 mx-auto max-w-md text-[15px] leading-relaxed"
                  style={{ color: v2.inkSoft }}
                >
                  Make your first Scribble. Oscar will clean, title, and file it here.
                </p>
                <button
                  onClick={() => router.push("/recording")}
                  className="mt-8 rounded-full px-6 py-3 text-[14px] font-medium inline-flex items-center gap-2.5"
                  style={{ background: v2.ink, color: v2.cream }}
                >
                  <span
                    className="inline-block rounded-full"
                    style={{ height: 7, width: 7, background: v2.accent }}
                  />
                  Record a Scribble
                </button>
              </div>
            ) : paged.length === 0 ? (
              <div className="py-20 text-center">
                <V2Caps>NOTHING MATCHES THIS VIEW</V2Caps>
                <p className="mt-4 text-[15px]" style={{ color: v2.inkSoft }}>
                  Try a different saved view or clear the search.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setCurrentView("all");
                  }}
                  className="mt-6 rounded-full px-4 py-2 text-[13px]"
                  style={{ border: `1px solid ${v2.rule}`, color: v2.inkSoft }}
                >
                  Reset filters
                </button>
              </div>
            ) : (
              <div>
                {paged.map((s) => {
                  const isSelected = selectedIds.has(s.id);
                  return (
                    <article
                      key={s.id}
                      className="grid grid-cols-12 gap-4 md:gap-10 py-7"
                      style={{
                        borderTop: `1px solid ${v2.rule}`,
                        background: isSelected ? "rgba(184,98,61,0.04)" : "transparent",
                      }}
                    >
                      <div className="col-span-12 md:col-span-2 flex items-start gap-3">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            toggleSelection(s.id);
                          }}
                          aria-label={isSelected ? "Deselect" : "Select"}
                          style={{ color: isSelected ? v2.accent : v2.inkFaint }}
                          className="mt-1 shrink-0"
                        >
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </button>
                        <div>
                          <V2Mono style={{ fontSize: 12, color: v2.ink }}>
                            {formatDateLong(s.updated_at)}
                          </V2Mono>
                          <div className="mt-1">
                            <V2Source
                              name={s.folder ? s.folder.toUpperCase() : "SCRIBBLE"}
                              kind={s.is_starred ? "STARRED" : undefined}
                            />
                          </div>
                        </div>
                      </div>
                      <Link
                        href={`/scribble/${s.id}`}
                        className="col-span-12 md:col-span-9 group"
                      >
                        <h3
                          style={{
                            fontFamily: v2Serif,
                            fontSize: 22,
                            lineHeight: 1.25,
                            letterSpacing: "-0.01em",
                            fontWeight: 500,
                          }}
                        >
                          {s.title || "Untitled Scribble"}
                        </h3>
                        <p
                          className="mt-1.5 text-[13px] leading-relaxed"
                          style={{ color: v2.inkSoft, maxWidth: 720 }}
                        >
                          {previewOf(s)}
                        </p>
                      </Link>
                      <div className="col-span-12 md:col-span-1 flex md:justify-end items-start gap-2">
                        <button
                          onClick={(e) => void handleToggleStar(s, e)}
                          className="p-1.5 rounded-full transition"
                          style={{
                            color: s.is_starred ? v2.accent : v2.inkFaint,
                          }}
                          title={s.is_starred ? "Unstar" : "Star"}
                        >
                          <Star
                            className="h-4 w-4"
                            style={s.is_starred ? { fill: v2.accent } : undefined}
                          />
                        </button>
                        <button
                          onClick={(e) => void handleDeleteOne(s.id, e)}
                          className="p-1.5 rounded-full transition"
                          style={{ color: v2.inkFaint }}
                          title="Move to trash"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </article>
                  );
                })}

                {totalPages > 1 && (
                  <div
                    className="mt-10 pt-6 flex items-center justify-between"
                    style={{ borderTop: `1px solid ${v2.rule}` }}
                  >
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="rounded-full px-3 py-1.5 text-[12px] disabled:opacity-40"
                      style={{ border: `1px solid ${v2.rule}`, color: v2.inkSoft }}
                    >
                      ← Previous
                    </button>
                    <V2Mono style={{ fontSize: 11, color: v2.inkFaint, letterSpacing: "0.1em" }}>
                      PAGE {currentPage} / {totalPages}
                    </V2Mono>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="rounded-full px-3 py-1.5 text-[12px] disabled:opacity-40"
                      style={{ border: `1px solid ${v2.rule}`, color: v2.inkSoft }}
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <TrashSheet
        open={isTrashOpen}
        onOpenChange={setIsTrashOpen}
        onRestore={() => {
          void qc.invalidateQueries({ queryKey: queryKeys.scribbles });
          refreshTrash();
        }}
      />
    </main>
  );
}
