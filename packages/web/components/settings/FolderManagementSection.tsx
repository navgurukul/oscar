"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Trash2, Edit2, Check, X, Plus } from "lucide-react";
import { scribblesService } from "@/lib/services/scribbles.service";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { DBScribble } from "@/lib/types/scribble.types";
import { v2, v2Serif, V2Caps, V2Mono } from "@/components/v2/V2Primitives";

export default function FolderManagementSection() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromScribbles = searchParams.get("from") === "scribbles";
  const { toast } = useToast();
  const [folders, setFolders] = useState<string[]>([]);
  const [allScribbles, setAllScribbles] = useState<DBScribble[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newFolderName, setNewFolderName] = useState("");
  const [targetScribbleId, setTargetScribbleId] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    loadFolders();
    loadScribbles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadFolders = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await scribblesService.getFolders();
      if (!error && data) setFolders(data);
    } catch {
      toast({ title: "Failed to load folders", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const loadScribbles = async () => {
    try {
      const { data, error } = await scribblesService.getScribbles();
      if (!error && data) setAllScribbles(data);
    } catch {
      /* ignore */
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast({ title: "Folder name required", variant: "destructive" });
      return;
    }
    if (!targetScribbleId) {
      toast({ title: "Select a Scribble", description: "Folders are created when you place a Scribble inside.", variant: "destructive" });
      return;
    }
    if (folders.includes(newFolderName.trim())) {
      toast({ title: "Folder already exists", variant: "destructive" });
      return;
    }
    setIsCreatingFolder(true);
    try {
      const { data, error } = await scribblesService.updateScribble(targetScribbleId, {
        folder: newFolderName.trim(),
      });
      if (!error && data) {
        setFolders([...folders, newFolderName.trim()]);
        setAllScribbles((prev) =>
          prev.map((n) => (n.id === data.id ? { ...n, folder: data.folder } : n))
        );
        setNewFolderName("");
        setTargetScribbleId("");
        toast({ title: "Folder created" });
        if (fromScribbles) {
          setTimeout(() => router.push("/scribble"), 500);
        }
      } else {
        toast({ title: "Failed to create folder", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to create folder", variant: "destructive" });
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const handleRenameFolder = async (oldName: string) => {
    if (!editValue.trim()) {
      toast({ title: "Folder name required", variant: "destructive" });
      return;
    }
    if (folders.includes(editValue.trim()) && editValue.trim() !== oldName) {
      toast({ title: "Folder already exists", variant: "destructive" });
      return;
    }
    try {
      const scribblesInFolder = allScribbles.filter((n) => n.folder === oldName);
      const { error } = await scribblesService.updateScribbles(
        scribblesInFolder.map((s) => s.id),
        { folder: editValue.trim() }
      );
      if (error) throw error;
      setFolders(folders.map((f) => (f === oldName ? editValue.trim() : f)));
      setAllScribbles((prev) =>
        prev.map((n) => (n.folder === oldName ? { ...n, folder: editValue.trim() } : n))
      );
      setEditingFolder(null);
      setEditValue("");
      toast({ title: "Folder renamed" });
    } catch {
      toast({ title: "Failed to rename folder", variant: "destructive" });
    }
  };

  const handleDeleteFolder = async (folderName: string) => {
    try {
      const scribblesInFolder = allScribbles.filter((n) => n.folder === folderName);
      const { error } = await scribblesService.updateScribbles(
        scribblesInFolder.map((s) => s.id),
        { folder: null }
      );
      if (error) throw error;
      setFolders(folders.filter((f) => f !== folderName));
      setAllScribbles((prev) =>
        prev.map((n) => (n.folder === folderName ? { ...n, folder: null } : n))
      );
      toast({ title: "Folder deleted" });
    } catch {
      toast({ title: "Failed to delete folder", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-10">
      {/* Create */}
      <div
        className="rounded-lg p-6"
        style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}
      >
        <V2Caps>CREATE NEW FOLDER</V2Caps>
        <p className="mt-2 text-[12px]" style={{ color: v2.inkSoft }}>
          Folders are created when you move at least one Scribble into them.
        </p>
        <div className="mt-4 flex gap-2 items-center flex-wrap">
          <Input
            placeholder="e.g. Pricing"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !isCreatingFolder && handleCreateFolder()}
            className="flex-1 min-w-[180px]"
            style={{ background: v2.cream, border: `1px solid ${v2.rule}`, color: v2.ink }}
          />
          <Select value={targetScribbleId} onValueChange={setTargetScribbleId}>
            <SelectTrigger
              className="w-[220px]"
              style={{ background: v2.cream, border: `1px solid ${v2.rule}`, color: v2.ink }}
            >
              <SelectValue placeholder="Select a Scribble…" />
            </SelectTrigger>
            <SelectContent
              className="max-h-64 overflow-y-auto"
              style={{ background: v2.cream, border: `1px solid ${v2.rule}`, color: v2.ink }}
            >
              {allScribbles.length === 0 ? (
                <SelectItem value="no-scribbles" disabled>
                  No Scribbles available
                </SelectItem>
              ) : (
                allScribbles.map((scribble) => (
                  <SelectItem key={scribble.id} value={scribble.id}>
                    {(scribble.title || "Untitled Scribble").slice(0, 50)}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <button
            onClick={handleCreateFolder}
            disabled={
              isCreatingFolder ||
              !newFolderName.trim() ||
              !targetScribbleId ||
              allScribbles.length === 0
            }
            className="text-[12px] rounded-full px-4 py-2 font-medium inline-flex items-center gap-1.5 disabled:opacity-40"
            style={{ background: v2.ink, color: v2.cream }}
          >
            {isCreatingFolder ? (
              <span
                className="w-3.5 h-3.5 border-2 rounded-full animate-spin inline-block"
                style={{ borderColor: v2.cream, borderTopColor: "transparent" }}
              />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            Create
          </button>
        </div>
      </div>

      {/* List */}
      <div className="pt-7" style={{ borderTop: `1px solid ${v2.rule}` }}>
        <V2Caps>
          YOUR FOLDERS · {folders.length}
          {folders.length > 0 ? ` · ${allScribbles.filter((s) => s.folder).length} SCRIBBLES FILED` : ""}
        </V2Caps>
        {isLoading ? (
          <p className="mt-6 text-[14px]" style={{ color: v2.inkSoft }}>
            Loading folders…
          </p>
        ) : folders.length === 0 ? (
          <div
            className="mt-6 rounded-lg p-10 text-center"
            style={{ background: v2.cream2, border: `1px dashed ${v2.rule}` }}
          >
            <p style={{ fontFamily: v2Serif, fontSize: 22, fontWeight: 500, letterSpacing: "-0.005em" }}>
              No folders yet.
            </p>
            <p className="mt-2 text-[13px]" style={{ color: v2.inkSoft }}>
              Create one above to start organizing your Scribbles.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
            {folders.map((folder) => {
              const scribblesCount = allScribbles.filter((n) => n.folder === folder).length;
              const isEditing = editingFolder === folder;
              return (
                <div
                  key={folder}
                  className="rounded-lg p-6 group"
                  style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}
                >
                  <div className="flex items-baseline justify-between">
                    {isEditing ? (
                      <Input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRenameFolder(folder);
                          else if (e.key === "Escape") {
                            setEditingFolder(null);
                            setEditValue("");
                          }
                        }}
                        className="text-lg"
                        style={{ background: v2.cream, border: `1px solid ${v2.rule}`, color: v2.ink, fontFamily: v2Serif }}
                      />
                    ) : (
                      <h3
                        style={{
                          fontFamily: v2Serif,
                          fontSize: 26,
                          fontWeight: 500,
                          color: v2.ink,
                          letterSpacing: "-0.015em",
                        }}
                      >
                        {folder}
                      </h3>
                    )}
                    <V2Mono style={{ fontSize: 13, color: v2.accent }}>{scribblesCount}</V2Mono>
                  </div>
                  <div className="mt-5 flex items-center justify-between">
                    <V2Caps>{scribblesCount === 1 ? "1 SCRIBBLE FILED" : `${scribblesCount} SCRIBBLES FILED`}</V2Caps>
                    <div className="flex items-center gap-1">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => handleRenameFolder(folder)}
                            className="p-1.5 rounded-full"
                            style={{ color: v2.accent }}
                            title="Save"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingFolder(null);
                              setEditValue("");
                            }}
                            className="p-1.5 rounded-full"
                            style={{ color: v2.inkFaint }}
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setEditingFolder(folder);
                              setEditValue(folder);
                            }}
                            className="p-1.5 rounded-full"
                            style={{ color: v2.inkFaint }}
                            title="Rename"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button
                                className="p-1.5 rounded-full"
                                style={{ color: v2.inkFaint }}
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent
                              style={{
                                background: v2.cream,
                                border: `1px solid ${v2.rule}`,
                                color: v2.ink,
                              }}
                            >
                              <AlertDialogHeader>
                                <AlertDialogTitle
                                  style={{
                                    fontFamily: v2Serif,
                                    fontSize: 24,
                                    fontWeight: 500,
                                    letterSpacing: "-0.01em",
                                  }}
                                >
                                  Delete folder?
                                </AlertDialogTitle>
                                <AlertDialogDescription style={{ color: v2.inkSoft }}>
                                  This will remove the &ldquo;{folder}&rdquo; folder from{" "}
                                  {scribblesCount} Scribble{scribblesCount !== 1 ? "s" : ""}.
                                  Scribbles stay, but lose their folder.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel
                                  style={{
                                    background: "transparent",
                                    border: `1px solid ${v2.rule}`,
                                    color: v2.inkSoft,
                                  }}
                                >
                                  Cancel
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteFolder(folder)}
                                  style={{ background: "#8c2f25", color: v2.cream }}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
