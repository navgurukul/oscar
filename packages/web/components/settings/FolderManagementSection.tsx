"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FolderPlus, Trash2, Edit2, Check, X } from "lucide-react";
import { notesService } from "@/lib/services/notes.service";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { DBNote } from "@/lib/types/note.types";

export default function FolderManagementSection() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromNotes = searchParams.get("from") === "notes";
  const { toast } = useToast();
  const [folders, setFolders] = useState<string[]>([]);
  const [allNotes, setAllNotes] = useState<DBNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newFolderName, setNewFolderName] = useState("");
  const [targetNoteId, setTargetNoteId] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    loadFolders();
    loadNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadFolders = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await notesService.getFolders();
      if (!error && data) {
        setFolders(data);
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to load folders.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadNotes = async () => {
    try {
      const { data, error } = await notesService.getNotes();
      if (!error && data) {
        setAllNotes(data);
      }
    } catch {
      // Silent fail for notes loading
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast({
        title: "Error",
        description: "Folder name cannot be empty.",
        variant: "destructive",
      });
      return;
    }

    if (!targetNoteId) {
      toast({
        title: "Error",
        description: "Please select a note to assign to this folder.",
        variant: "destructive",
      });
      return;
    }

    if (folders.includes(newFolderName.trim())) {
      toast({
        title: "Error",
        description: "Folder already exists.",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingFolder(true);
    try {
      const { data, error } = await notesService.updateNote(targetNoteId, {
        folder: newFolderName.trim(),
      });

      if (!error && data) {
        setFolders([...folders, newFolderName.trim()]);
        setAllNotes((prev) =>
          prev.map((n) => (n.id === data.id ? { ...n, folder: data.folder } : n))
        );
        setNewFolderName("");
        setTargetNoteId("");
        toast({
          title: "Success",
          description: `Folder "${newFolderName.trim()}" created and assigned to note.`,
        });
        // Redirect back to notes if coming from notes page
        if (fromNotes) {
          setTimeout(() => {
            router.push("/notes");
          }, 500);
        }
      } else {
        toast({
          title: "Error",
          description: "Failed to create folder.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to create folder.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const handleRenameFolder = async (oldName: string) => {
    if (!editValue.trim()) {
      toast({
        title: "Error",
        description: "Folder name cannot be empty.",
        variant: "destructive",
      });
      return;
    }

    if (folders.includes(editValue.trim()) && editValue.trim() !== oldName) {
      toast({
        title: "Error",
        description: "Folder name already exists.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Update all notes with old folder name to new folder name
      const notesInFolder = allNotes.filter((n) => n.folder === oldName);

      for (const note of notesInFolder) {
        await notesService.updateNote(note.id, {
          folder: editValue.trim(),
        });
      }

      setFolders(folders.map((f) => (f === oldName ? editValue.trim() : f)));
      setAllNotes((prev) =>
        prev.map((n) =>
          n.folder === oldName ? { ...n, folder: editValue.trim() } : n
        )
      );
      setEditingFolder(null);
      setEditValue("");
      toast({
        title: "Success",
        description: `Folder renamed to "${editValue.trim()}"`,
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to rename folder.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteFolder = async (folderName: string) => {
    try {
      // Remove folder from all notes
      const notesInFolder = allNotes.filter((n) => n.folder === folderName);

      for (const note of notesInFolder) {
        await notesService.updateNote(note.id, {
          folder: null,
        });
      }

      setFolders(folders.filter((f) => f !== folderName));
      setAllNotes((prev) =>
        prev.map((n) =>
          n.folder === folderName ? { ...n, folder: null } : n
        )
      );
      toast({
        title: "Success",
        description: `Folder "${folderName}" deleted.`,
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete folder.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Create New Folder */}
      <Card className="bg-slate-900 border-cyan-700/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <FolderPlus className="w-5 h-5 text-cyan-500" />
            Create New Folder
          </CardTitle>
          <CardDescription className="text-gray-400">
            Create a folder and assign it to a note
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex gap-2 items-stretch">
              <Input
                placeholder="e.g., Work"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && !isCreatingFolder && handleCreateFolder()
                }
                className="bg-slate-800 border-slate-700 text-gray-300 focus:border-cyan-500 flex-1"
              />

              <Select value={targetNoteId} onValueChange={setTargetNoteId}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-gray-300 w-[200px]">
                  <SelectValue placeholder="Select note..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700 text-gray-300 max-h-64 overflow-y-auto">
                  {allNotes.length === 0 ? (
                    <SelectItem value="no-notes" disabled>
                      No notes available
                    </SelectItem>
                  ) : (
                    allNotes.map((note) => (
                      <SelectItem key={note.id} value={note.id}>
                        {(note.title || "Untitled Note").slice(0, 50)}
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
                  !targetNoteId ||
                  allNotes.length === 0
                }
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                <FolderPlus className="w-4 h-4" />
                {isCreatingFolder ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Folders List */}
      <Card className="bg-slate-900 border-cyan-700/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <FolderPlus className="w-5 h-5 text-cyan-500" />
            Your Folders
          </CardTitle>
          <CardDescription className="text-gray-400">
            {folders.length === 0
              ? "No folders yet. Create one to get started!"
              : `${folders.length} folder${folders.length !== 1 ? "s" : ""} created`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-gray-400 text-sm">Loading folders...</div>
          ) : folders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-cyan-700/30 rounded-lg">
              <FolderPlus className="w-12 h-12 text-gray-600 mb-3" />
              <p className="text-gray-400 font-medium mb-1">No folders yet</p>
              <p className="text-gray-500 text-sm text-center">
                Start by creating a folder and assigning it to a note.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {folders.map((folder) => {
                const notesCount = allNotes.filter(
                  (n) => n.folder === folder
                ).length;
                return (
                  <div
                    key={folder}
                    className="flex items-center justify-between bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 hover:border-cyan-500/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {editingFolder === folder ? (
                        <Input
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleRenameFolder(folder);
                            } else if (e.key === "Escape") {
                              setEditingFolder(null);
                              setEditValue("");
                            }
                          }}
                          className="bg-slate-700 border-slate-600 text-gray-200 focus:border-cyan-500"
                        />
                      ) : (
                        <div className="flex flex-col">
                          <span className="text-gray-300 font-medium">
                            {folder}
                          </span>
                          <span className="text-xs text-gray-500">
                            {notesCount} note{notesCount !== 1 ? "s" : ""}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {editingFolder === folder ? (
                        <>
                          <button
                            onClick={() => handleRenameFolder(folder)}
                            className="p-2 rounded-lg text-cyan-400 hover:bg-cyan-500/10 transition-colors"
                            title="Save"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingFolder(null);
                              setEditValue("");
                            }}
                            className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/5 transition-colors"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setEditingFolder(folder);
                              setEditValue(folder);
                            }}
                            className="p-2 rounded-lg text-gray-500 hover:text-cyan-400 hover:bg-cyan-500/5 transition-colors"
                            title="Rename folder"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button
                                className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/5 transition-colors"
                                title="Delete folder"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-slate-900 border-slate-700">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-white">
                                  Delete folder?
                                </AlertDialogTitle>
                                <AlertDialogDescription className="text-gray-400">
                                  This will remove the &quot;{folder}&quot; folder from all{" "}
                                  {notesCount} note{notesCount !== 1 ? "s" : ""}.
                                  Notes will still exist but won&apos;t be organized by
                                  this folder.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="bg-slate-800 text-white border-slate-700 hover:bg-slate-700">
                                  Cancel
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteFolder(folder)}
                                  className="bg-red-600 hover:bg-red-700 text-white"
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
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
