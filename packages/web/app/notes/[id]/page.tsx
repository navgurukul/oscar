"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { notesService } from "@/lib/services/notes.service";
import { feedbackService } from "@/lib/services/feedback.service";
import { storageService } from "@/lib/services/storage.service";
import { aiService } from "@/lib/services/ai.service";
import { ROUTES } from "@/lib/constants";
import { NoteEditorSkeleton } from "@/components/results/NoteEditorSkeleton";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import {
  Copy,
  Download,
  Edit3,
  Save,
  X,
  Share2,
  Mail,
  FileText,
  Languages,
  ListChecks,
  BookOpen,
  Star,
  FolderPlus,
  Plus,
  Check,
  ThumbsUp,
  ThumbsDown,
  Mic,
} from "lucide-react";
import { useAIEmailFormatting } from "@/lib/hooks/useAIEmailFormatting";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { DBNote, FeedbackReason } from "@/lib/types/note.types";

export default function NoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [id, setId] = useState<string | null>(null);
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [note, setNote] = useState<DBNote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedText, setEditedText] = useState("");
  const [showRawTranscript, setShowRawTranscript] = useState(false);
  const [, setIsShareModalOpen] = useState(false);
  // const [isSharing, setIsSharing] = useState(false);
  // Gmail AI format now applies directly to the main editor text (no separate box)
  const { formatText: gmailFormatText } =
    useAIEmailFormatting();
  const [activeMode, setActiveMode] = useState<"normal" | "email" | "translate" | "summary" | "bullets">("normal");
  const [modeContent, setModeContent] = useState<Record<string, string>>({});
  const [isLoadingMode, setIsLoadingMode] = useState(false);

  // Translation states
  const [selectedLanguage, setSelectedLanguage] = useState<"original" | "en" | "hi">("original");
  const [isTranslating, setIsTranslating] = useState(false);
  const translationCacheNoteRef = useRef<Map<string, string>>(new Map());
  const translateControllerRef = useRef<AbortController | null>(null);

  const applyLanguage = async (lang: "original" | "en" | "hi") => {
    if (!note) return;
    
    if (lang === "original") {
      translateControllerRef.current?.abort();
      translateControllerRef.current = null;
      setSelectedLanguage("original");
      setModeContent(prev => ({ ...prev, translate: "" }));
      if (isEditing) setEditedText(note.edited_text || note.original_formatted_text || "");
      return;
    }

    const baseNote = note.edited_text || note.original_formatted_text || "";
    if (!baseNote) return;

    if (isTranslating && translateControllerRef.current) {
      translateControllerRef.current.abort();
    }

    const noteKey = `${lang}|note|${baseNote}`;
    const cachedNote = translationCacheNoteRef.current.get(noteKey);

    if (cachedNote) {
      setSelectedLanguage(lang);
      setModeContent(prev => ({ ...prev, translate: cachedNote }));
      if (isEditing) setEditedText(cachedNote);
      toast({
        title: "Language updated",
        description: lang === "hi" ? "Switched to Hindi." : "Switched to English.",
      });
      return;
    }

    const controller = new AbortController();
    translateControllerRef.current = controller;
    setIsTranslating(true);
    try {
      const res = await aiService.translateText(baseNote, lang, controller.signal);

      if (!res.success) {
        if (controller.signal.aborted) return;
        toast({
          title: "Translation failed",
          description: res.error || "Could not translate right now.",
          variant: "destructive",
        });
        if (res.error && res.error.toLowerCase().includes("sign in")) {
          router.push(ROUTES.AUTH);
        }
        return;
      }

      const noteText = res.translatedText || "";
      translationCacheNoteRef.current.set(noteKey, noteText);

      setSelectedLanguage(lang);
      setModeContent(prev => ({ ...prev, translate: noteText }));
      if (isEditing) setEditedText(noteText);

      toast({
        title: "Language updated",
        description: lang === "hi" ? "Switched to Hindi." : "Switched to English.",
      });
    } finally {
      setIsTranslating(false);
      if (translateControllerRef.current === controller) {
        translateControllerRef.current = null;
      }
    }
  };

  // Feedback state
  const [, setIsFeedbackSubmitting] = useState(false);
  const [hasFeedbackSubmitted, setHasFeedbackSubmitted] = useState(false);
  const [feedbackValue, setFeedbackValue] = useState<boolean | null>(null);

  // Star state
  const [isStarring, setIsStarring] = useState(false);

  // Folder state
  const [availableFolders, setAvailableFolders] = useState<string[]>([]);
  const [isAddingNewFolder, setIsAddingNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  useEffect(() => {
    const initializeParams = async () => {
      const resolvedParams = await params;
      setId(resolvedParams.id);
    };
    initializeParams();
    loadAvailableFolders();
  }, [params]);

  const loadAvailableFolders = async () => {
    const { data, error } = await notesService.getFolders();
    if (!error && data) {
      setAvailableFolders(data);
    }
  };

  const handleUpdateFolder = async (folderName: string | null) => {
    if (!id || !note) return;

    const { error, data } = await notesService.updateNote(id, {
      folder: folderName,
    });

    if (error || !data) {
      toast({
        title: "Error",
        description: "Failed to update folder.",
        variant: "destructive",
      });
    } else {
      setNote(data);
      if (folderName && !availableFolders.includes(folderName)) {
        setAvailableFolders([...availableFolders, folderName]);
      }
      toast({
        title: "Success",
        description: folderName ? `Added to folder "${folderName}"` : "Removed from folder",
      });
    }
  };

  const handleAddNewFolder = () => {
    if (newFolderName.trim()) {
      handleUpdateFolder(newFolderName.trim());
      setIsAddingNewFolder(false);
      setNewFolderName("");
    }
  };

  useEffect(() => {
    const loadNote = async () => {
      if (!id) return;
      if (authLoading) return;
      if (!user) {
        router.push(`/auth?redirectTo=${encodeURIComponent(`/notes/${id}`)}`);
        return;
      }
      setIsLoading(true);
      const { data, error } = await notesService.getNoteById(id);
      if (error || !data) {
        router.push("/notes");
      } else if (user && data.user_id !== user.id) {
        // Ownership check
        router.push("/notes");
      } else {
        setNote(data);
        setEditedText(data.edited_text || data.original_formatted_text);
        // Set current note ID and raw text in storage for "Continue Recording" support
        storageService.setCurrentNoteId(data.id);
        storageService.updateRawText(data.raw_text);
        storageService.saveNote(
          data.original_formatted_text,
          data.raw_text,
          data.title
        );
        // Set existing feedback state
        if (data.feedback_helpful !== null) {
          setHasFeedbackSubmitted(true);
          setFeedbackValue(data.feedback_helpful);
        }
      }
      setIsLoading(false);
    };

    loadNote();
  }, [id, router, user, authLoading]);

  const handleStartEditing = () => {
    setIsEditing(true);
    const baseText = modeContent[activeMode] || (activeMode === "translate" ? modeContent["translate"] : null) || note?.edited_text || note?.original_formatted_text || "";
    setEditedText(baseText);
  };

  const handleCancelEditing = () => {
    const base = modeContent[activeMode] || (activeMode === "translate" ? modeContent["translate"] : null) || note?.edited_text || note?.original_formatted_text;
    setEditedText(base || "");
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    if (!note) return;
    setIsSaving(true);

    const { error } = await notesService.updateNote(note.id, {
      edited_text: editedText,
    });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to save changes. Please try again.",
        variant: "destructive",
      });
    } else {
      setNote({ ...note, edited_text: editedText });
      
      // Update modeContent cache for current mode
      if (activeMode !== "normal") {
        setModeContent(prev => ({ ...prev, [activeMode]: editedText }));
      }

      setIsEditing(false);
      toast({
        title: "Saved!",
        description: "Your changes have been saved.",
      });
    }
    setIsSaving(false);
  };

  const handleCopy = async () => {
    const text = isEditing 
      ? editedText 
      : activeMode === "normal"
      ? (note?.edited_text || note?.original_formatted_text || "")
      : (modeContent[activeMode] || note?.edited_text || note?.original_formatted_text || "");
    await navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Note copied to clipboard.",
    });
  };

  const handleDownload = () => {
    if (!note) return;
    const text = isEditing 
      ? editedText 
      : activeMode === "normal"
      ? (note.edited_text || note.original_formatted_text)
      : (modeContent[activeMode] || note.edited_text || note.original_formatted_text);
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${note.title.replace(/[^a-z0-9]/gi, "_")}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const handleFeedbackSubmit = async (
    helpful: boolean,
    reasons?: FeedbackReason[]
  ) => {
    if (!note) {
      toast({
        title: "Error",
        description: "Could not submit feedback - note not found.",
        variant: "destructive",
      });
      return;
    }

    setIsFeedbackSubmitting(true);
    const { success, error } = await feedbackService.submitFeedback(
      note.id,
      helpful,
      reasons
    );

    if (error || !success) {
      toast({
        title: "Error",
        description: "Failed to submit feedback. Please try again.",
        variant: "destructive",
      });
    } else {
      setHasFeedbackSubmitted(true);
      setFeedbackValue(helpful);
      toast({
        title: "Thanks!",
        description: "Your feedback helps us improve.",
      });
    }
    setIsFeedbackSubmitting(false);
  };

  const handleToggleStar = async () => {
    if (!note || isStarring) return;
    const currentNote = note;
    const newStarred = !currentNote.is_starred;
    setIsStarring(true);
    // Optimistic update
    setNote((prev) => prev ? { ...prev, is_starred: newStarred } : prev);
    const { data, error } = await notesService.toggleStar(currentNote.id, newStarred);
    if (error || !data) {
      // Revert on failure
      setNote((prev) => prev ? { ...prev, is_starred: currentNote.is_starred } : prev);
      toast({
        title: "Error",
        description: "Failed to update star. Please try again.",
        variant: "destructive",
      });
    } else {
      // Sync with actual DB value
      setNote((prev) => prev ? { ...prev, is_starred: data.is_starred } : prev);
    }
    setIsStarring(false);
  };

  if (isLoading) {
    return (
      <main className="flex flex-col items-center px-4 pt-8 pb-24">
        <div className="w-full max-w-xl flex flex-col items-center gap-8 mt-16">
          <div className="w-9" />
          <NoteEditorSkeleton />
        </div>
      </main>
    );
  }

  if (!note) {
    return null;
  }

  const displayText = activeMode === "normal"
    ? (note.edited_text || note.original_formatted_text)
    : (modeContent[activeMode] || note.edited_text || note.original_formatted_text);

  return (
    <main className="min-h-screen bg-[#020617] text-white flex flex-col items-center pt-16 pb-32 px-4 relative overflow-x-hidden">
      {/* Note Header Info (Centered) */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-3xl text-center mb-8 space-y-3"
      >
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          {note.title || "Untitled Note"}
        </h1>
        <p className="text-gray-500 text-sm font-medium">
          {formatDate(note.created_at)}
        </p>

        {/* Folders / Tags Section (Centered Pills) */}
        <div className="flex flex-wrap justify-center items-center gap-2 pt-1">
          {note.folder && (
            <Badge variant="secondary" className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30 px-3 py-1 rounded-full text-xs flex items-center gap-2 group">
              <FolderPlus className="w-3 h-3" />
              {note.folder}
              <button 
                onClick={() => handleUpdateFolder(null)}
                className="hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          
          <div className="flex items-center gap-2">
            {!isAddingNewFolder ? (
              <div className="flex items-center gap-2">
                {availableFolders.filter(f => f !== note.folder).slice(0, 2).map(folder => (
                  <button
                    key={folder}
                    onClick={() => handleUpdateFolder(folder)}
                    className="text-[11px] px-3 py-1 rounded-full bg-slate-900 border border-white/5 text-gray-500 hover:text-cyan-400 hover:border-cyan-500/30 transition-all whitespace-nowrap"
                  >
                    {folder}
                  </button>
                ))}
                <button
                  onClick={() => setIsAddingNewFolder(true)}
                  className="text-[11px] px-3 py-1 rounded-full bg-cyan-500/5 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/10 transition-all flex items-center gap-1 font-medium"
                >
                  <Plus className="w-3 h-3" />
                  New
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 bg-slate-900/80 border border-cyan-500/30 rounded-full px-2 py-0.5 animate-in fade-in zoom-in duration-200">
                <Input
                  autoFocus
                  placeholder="Folder..."
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddNewFolder()}
                  className="h-6 w-24 bg-transparent border-none text-[11px] focus-visible:ring-0 placeholder:text-gray-600 p-0"
                />
                <button onClick={handleAddNewFolder} className="p-1 hover:text-cyan-400 transition-colors">
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setIsAddingNewFolder(false)} className="p-1 hover:text-red-400 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Mode Selection Bar (Floating) */}
      <div className="flex flex-col items-center gap-4 w-full">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center bg-slate-900/80 backdrop-blur-md border border-white/5 rounded-xl p-1 mb-2 shadow-2xl z-10"
        >
          {[
            { id: "normal", icon: FileText, label: "Normal" },
            { id: "email", icon: Mail, label: "Email" },
            { id: "bullets", icon: ListChecks, label: "Bullets" },
            { id: "summary", icon: BookOpen, label: "Summary" },
            { id: "translate", icon: Languages, label: "Translate" }
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={async () => {
                if (mode.id === "normal") {
                  setActiveMode("normal");
                  if (isEditing) setEditedText(note.edited_text || note.original_formatted_text || "");
                  return;
                }
                
                setActiveMode(mode.id as typeof activeMode);
                const baseText = note.edited_text || note.original_formatted_text || note.raw_text || "";

                if (!modeContent[mode.id] && mode.id !== "translate") {
                  setIsLoadingMode(true);
                  let resultText = baseText;
                  if (mode.id === "email") {
                    const res = await gmailFormatText(baseText, note.title || "Untitled Note");
                    resultText = res.success ? res.formattedText || baseText : baseText;
                  } else if (mode.id === "bullets") {
                    resultText = baseText.split('\n').filter(l => l.trim()).map(l => `• ${l.trim()}`).join('\n');
                  } else if (mode.id === "summary") {
                    const sentences = baseText.match(/[^.!?]+[.!?]+/g) || [baseText];
                    resultText = sentences.slice(0, 3).join(' ').trim() || baseText.substring(0, 200) + '...';
                  }
                  setModeContent(prev => ({ ...prev, [mode.id]: resultText }));
                  if (isEditing) setEditedText(resultText);
                  setIsLoadingMode(false);
                } else {
                  if (isEditing && mode.id !== "translate") setEditedText(modeContent[mode.id] || baseText);
                }
              }}
              className={`flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-300 ${
                activeMode === mode.id 
                  ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20" 
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
              title={mode.label}
            >
              {isLoadingMode && activeMode === mode.id ? (
                <Spinner className="w-5 h-5" />
              ) : (
                <mode.icon className="w-5 h-5" />
              )}
            </button>
          ))}
        </motion.div>

        {/* Translation Dropdown - only when translate mode is active */}
        <AnimatePresence>
          {activeMode === "translate" && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-2 bg-slate-900/50 backdrop-blur-sm border border-white/5 rounded-full p-1 shadow-xl mb-4"
            >
              {[
                { id: "original", label: "Original" },
                { id: "en", label: "English" },
                { id: "hi", label: "Hindi" }
              ].map((lang) => (
                <button
                  key={lang.id}
                  onClick={() => applyLanguage(lang.id as "original" | "en" | "hi")}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                    selectedLanguage === lang.id
                      ? "bg-cyan-500 text-slate-950 shadow-lg"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {isTranslating && selectedLanguage === lang.id ? (
                    <Spinner className="w-3 h-3" />
                  ) : (
                    lang.label
                  )}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main Note Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="w-full max-w-3xl"
      >
        <div className="bg-[#0f172a]/60 backdrop-blur-sm border border-white/5 rounded-3xl p-6 md:p-8 shadow-2xl relative group overflow-hidden">
          {/* Subtle Glow Effect */}
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-cyan-500/5 blur-[80px] rounded-full pointer-events-none" />
          
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
            <div className="space-y-1.5">
              <h2 className="text-xl font-bold text-white leading-tight">
                {note.title || "Untitled Note"}
              </h2>
              <p className="text-gray-500 text-xs font-medium">
                {formatDate(note.created_at)}
              </p>
            </div>

            {/* Action Icons */}
            <div className="flex items-center gap-1 self-end md:self-start">
              <button 
                onClick={handleToggleStar}
                className={`p-2 rounded-lg transition-all duration-300 ${note.is_starred ? 'text-yellow-400 bg-yellow-400/10' : 'text-gray-500 hover:text-yellow-400 hover:bg-yellow-400/5'}`}
                title="Star note"
              >
                <Star className={`w-4 h-4 ${note.is_starred ? 'fill-yellow-400' : ''}`} />
              </button>
              <button 
                onClick={() => {
                  if (isEditing) handleCancelEditing();
                  else handleStartEditing();
                }}
                className={`p-2 rounded-lg transition-all duration-300 ${isEditing ? 'text-cyan-400 bg-cyan-400/10' : 'text-gray-500 hover:text-cyan-400 hover:bg-cyan-400/5'}`}
                title="Edit note"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button 
                onClick={handleCopy}
                className="p-2 rounded-lg text-gray-500 hover:text-cyan-400 hover:bg-cyan-400/5 transition-all duration-300"
                title="Copy text"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button 
                onClick={handleDownload}
                className="p-2 rounded-lg text-gray-500 hover:text-cyan-400 hover:bg-cyan-400/5 transition-all duration-300"
                title="Download txt"
              >
                <Download className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setIsShareModalOpen(true)}
                className="p-2 rounded-lg text-gray-500 hover:text-cyan-400 hover:bg-cyan-400/5 transition-all duration-300"
                title="Share"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Cyan Underline */}
          <div className="w-16 h-0.5 bg-cyan-500/80 rounded-full mb-6" />

          {/* Note Content Area */}
          <div className="relative min-h-[120px]">
            {isEditing ? (
              <textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className="w-full bg-slate-900/50 border border-cyan-500/30 rounded-xl p-4 text-gray-200 leading-relaxed focus:outline-none focus:ring-1 focus:ring-cyan-500/20 min-h-[200px] resize-none"
                placeholder="Write your note here..."
              />
            ) : (
              <div className="text-gray-300 text-base leading-relaxed whitespace-pre-wrap font-medium">
                {displayText || "No content available."}
              </div>
            )}

            {isEditing && (
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} className="text-gray-400 hover:text-white">
                  Cancel
                </Button>
                <Button onClick={handleSaveEdit} size="sm" disabled={isSaving} className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold px-6">
                  {isSaving ? <Spinner className="mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Save
                </Button>
              </div>
            )}
          </div>

          {!isEditing && (
            <div className=" flex   border-white/5 border-t-4px  mt-4 pt-4">
              <button 
                onClick={() => {
                  const raw = note.raw_text;
                  if (!raw) {
                    toast({
                      title: "Error",
                      description: "Original recording not found. Cannot continue.",
                      variant: "destructive"
                    });
                    return;
                  }
                  storageService.updateRawText(raw);
                  storageService.setCurrentNoteId(note.id);
                  storageService.setContinueMode(true);
                  router.push("/recording");
                }}
                className="bg-cyan-500/10 hover:bg-cyan-500/20 gap-3 text-cyan-400 px-8 py-3 rounded-full font-bold text-sm transition-all duration-300 flex items-center  border border-cyan-500/20 group hover:-translate-y-1"
              >
                <div className="bg-cyan-500 text-slate-950 p-1.5 rounded-full group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(6,182,212,0.5)]">
                  <Mic className="w-4 h-4" />
                </div>
                <span>Append to notes</span>
              </button>
            </div>
          )}
        </div>

        {/* Feedback Section (Below Card) */}
        <div className="mt-4 bg-[#0f172a]/40 border border-white/5 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-gray-400 text-sm font-medium">Was this formatting helpful?</p>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => handleFeedbackSubmit(true)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-300 ${hasFeedbackSubmitted && feedbackValue === true ? 'bg-cyan-500 text-slate-950' : 'bg-slate-900/50 text-gray-400 hover:text-white hover:bg-slate-800'}`}
            >
              <ThumbsUp className="w-4 h-4" />
              <span className="font-semibold text-sm">Yes</span>
            </button>
            <button 
              onClick={() => handleFeedbackSubmit(false)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-300 ${hasFeedbackSubmitted && feedbackValue === false ? 'bg-red-500/20 text-red-400' : 'bg-slate-900/50 text-gray-400 hover:text-white hover:bg-slate-800'}`}
            >
              <ThumbsDown className="w-4 h-4" />
              <span className="font-semibold text-sm">No</span>
            </button>
          </div>
        </div>

        {/* View Original Transcript Button */}
        <div className="flex justify-center mt-4">
          <button 
            onClick={() => setShowRawTranscript(!showRawTranscript)}
            className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 px-6 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 hover:-translate-y-0.5"
          >
            {showRawTranscript ? "hide original transcript" : "view original transcript"}
          </button>
        </div>

        {/* Raw Transcript (Collapsible) */}
        <AnimatePresence>
          {showRawTranscript && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 w-full overflow-hidden"
            >
              <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-6">
                <h3 className="text-gray-500 font-bold uppercase tracking-widest text-xs mb-4">Original Recording</h3>
                <div className="text-gray-400 leading-relaxed italic text-sm">
                  &ldquo;{note.raw_text}&rdquo;
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </main>
  );
}
