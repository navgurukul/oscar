"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useNoteStorage } from "@/lib/hooks/useNoteStorage";
import { useAIEmailFormatting } from "@/lib/hooks/useAIEmailFormatting";
import { useAuth } from "@/lib/contexts/AuthContext";
import { storageService } from "@/lib/services/storage.service";
import { notesService } from "@/lib/services/notes.service";
import { feedbackService } from "@/lib/services/feedback.service";
import { aiService } from "@/lib/services/ai.service";
import { NoteEditorSkeleton } from "@/components/results/NoteEditorSkeleton";
import { NoteActions } from "@/components/results/NoteActions";
import { Spinner } from "@/components/ui/spinner";
import { ROUTES, UI_STRINGS } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import type { FeedbackReason } from "@/lib/types/note.types";
import {
  Mail,
  MessageCircle,
  Share2,
  FileText,
  FolderPlus,
  X,
  Check,
  Plus,
  Languages,
  ListChecks,
  BookOpen,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

// Lazy load the NoteEditor component
const NoteEditor = dynamic(
  () =>
    import("@/components/results/NoteEditor").then((mod) => ({
      default: mod.NoteEditor,
    })),
  {
    loading: () => <NoteEditorSkeleton />,
    ssr: false,
  }
);

export default function ResultsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const { isLoading, formattedNote, rawText, title, updateFormattedNote } =
    useNoteStorage();

  const [showRawTranscript, setShowRawTranscript] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editedText, setEditedText] = useState("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [noteId, setNoteId] = useState<string | null>(null);
  const [isCopying, setIsCopying] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [isSharing, setIsSharing] = useState<boolean>(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [shareSubject, setShareSubject] = useState<string | null>(null);
  const {
    formatText: gmailFormatText,
  } = useAIEmailFormatting();
  const [isNoteSaved, setIsNoteSaved] = useState<boolean>(false);

  // New Mode states
  const [activeMode, setActiveMode] = useState<"normal" | "email" | "translate" | "summary" | "bullets">("normal");
  const [modeContent, setModeContent] = useState<Record<string, string>>({});
  const [isLoadingMode, setIsLoadingMode] = useState(false);

  // Language / translation state (post-recording)
  const [selectedLanguage, setSelectedLanguage] = useState<
    "original" | "en" | "hi"
  >("original");
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedNote, setTranslatedNote] = useState<string | null>(null);
  const [translatedRaw, setTranslatedRaw] = useState<string | null>(null);

  // Translation caching and cancellation
  const translationCacheNoteRef = useRef<Map<string, string>>(new Map());
  const translationCacheRawRef = useRef<Map<string, string>>(new Map());
  const translateControllerRef = useRef<AbortController | null>(null);

  // Feedback state
  const [isFeedbackSubmitting, setIsFeedbackSubmitting] = useState(false);
  const [hasFeedbackSubmitted, setHasFeedbackSubmitted] = useState(false);
  const [feedbackValue, setFeedbackValue] = useState<boolean | null>(null);

  // Folder state
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [availableFolders, setAvailableFolders] = useState<string[]>([]);
  const [isAddingNewFolder, setIsAddingNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  useEffect(() => {
    const storedNoteId = storageService.getCurrentNoteId();
    if (storedNoteId) {
      setNoteId(storedNoteId);
      loadNoteDetails(storedNoteId);
    }
    loadAvailableFolders();
  }, []);

  const loadNoteDetails = async (id: string) => {
    const { data, error } = await notesService.getNoteById(id);
    if (!error && data) {
      setSelectedFolder(data.folder);
    }
  };

  const loadAvailableFolders = async () => {
    const { data, error } = await notesService.getFolders();
    if (!error && data) {
      setAvailableFolders(data);
    }
  };

  const handleUpdateFolder = async (folderName: string | null) => {
    if (!noteId) return;

    const { error } = await notesService.updateNote(noteId, {
      folder: folderName,
    });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update folder.",
        variant: "destructive",
      });
    } else {
      setSelectedFolder(folderName);
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
    if (formattedNote) {
      setEditedText(formattedNote);
    }
  }, [formattedNote]);

  // If base content changes, reset translation state
  useEffect(() => {
    setSelectedLanguage("original");
    setTranslatedNote(null);
    setTranslatedRaw(null);
  }, [formattedNote, rawText, title]);

  useEffect(() => {
    if (!isLoading && !formattedNote && !rawText) {
      router.push(ROUTES.HOME);
    }
  }, [isLoading, formattedNote, rawText, router]);

  const handleCopyNote = async () => {
    if (isCopying) return;

    setIsCopying(true);
    try {
      const textToCopy = isEditing
        ? editedText
        : activeMode === "normal"
        ? formattedNote || ""
        : modeContent[activeMode] || formattedNote || "";
      await navigator.clipboard.writeText(textToCopy);
      toast({
        title: "Copied!",
        description: "Note copied to clipboard.",
      });
    } catch (error) {
      console.error("Failed to copy:", error);
      toast({
        title: "Copy Failed",
        description: "Could not copy to clipboard.",
        variant: "destructive",
      });
    } finally {
      setIsCopying(false);
    }
  };

  const handleDownloadNote = () => {
    if (isDownloading) return;

    setIsDownloading(true);
    try {
      const textToDownload = isEditing
        ? editedText
        : activeMode === "normal"
        ? formattedNote || ""
        : modeContent[activeMode] || formattedNote || "";
      const blob = new Blob([textToDownload], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = UI_STRINGS.NOTE_FILENAME;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Downloaded!",
        description: "Note saved to your device.",
      });
    } catch (error) {
      console.error("Failed to download:", error);
      toast({
        title: "Download Failed",
        description: "Could not download the file.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const applyLanguage = async (lang: "original" | "en" | "hi") => {
    if (lang === "original") {
      // Cancel any in-flight translation
      translateControllerRef.current?.abort();
      translateControllerRef.current = null;
      setSelectedLanguage("original");
      setTranslatedNote(null);
      setTranslatedRaw(null);
      setModeContent(prev => ({ ...prev, translate: "" }));
      if (isEditing) setEditedText(formattedNote || "");
      return;
    }

    // Always translate the simple content, not other modes.
    const baseNote = (isEditing && activeMode === "normal" ? editedText : formattedNote) || "";
    const baseRaw = rawText || "";
    if (!baseNote && !baseRaw) return;

    // Abort any previous translation in-flight
    if (isTranslating && translateControllerRef.current) {
      translateControllerRef.current.abort();
    }

    // Build cache keys
    const noteKey = baseNote ? `${lang}|note|${baseNote}` : "";
    const rawKey = baseRaw ? `${lang}|raw|${baseRaw}` : "";

    // If both are cached, apply instantly
    const cachedNote = noteKey ? translationCacheNoteRef.current.get(noteKey) : "";
    const cachedRaw = rawKey ? translationCacheRawRef.current.get(rawKey) : "";
    if ((baseNote ? !!cachedNote : true) && (baseRaw ? !!cachedRaw : true)) {
      setSelectedLanguage(lang);
      setTranslatedNote(cachedNote || "");
      setTranslatedRaw(cachedRaw || "");
      toast({
        title: "Language updated",
        description: lang === "hi" ? "Switched to Hindi." : "Switched to English.",
      });
      return;
    }

    // Start new translation with cancellation support
    const controller = new AbortController();
    translateControllerRef.current = controller;
    setIsTranslating(true);
    try {
      const [noteRes, rawRes] = await Promise.all([
        baseNote
          ? cachedNote
            ? Promise.resolve({ success: true as const, translatedText: cachedNote })
            : aiService.translateText(baseNote, lang, controller.signal)
          : Promise.resolve({ success: true as const, translatedText: "" }),
        baseRaw
          ? cachedRaw
            ? Promise.resolve({ success: true as const, translatedText: cachedRaw })
            : aiService.translateText(baseRaw, lang, controller.signal)
          : Promise.resolve({ success: true as const, translatedText: "" }),
      ]);

      if (!noteRes.success || !rawRes.success) {
        // If aborted, silently return without error toast
        if (controller.signal.aborted) {
          return;
        }
        toast({
          title: "Translation failed",
          description: "Could not translate right now. Please try again.",
          variant: "destructive",
        });
        return;
      }

      const noteText = noteRes.translatedText || "";
      const rawTextTranslated = rawRes.translatedText || "";

      // Update cache
      if (noteKey && noteText) translationCacheNoteRef.current.set(noteKey, noteText);
      if (rawKey && rawTextTranslated) translationCacheRawRef.current.set(rawKey, rawTextTranslated);

      setSelectedLanguage(lang);
      setTranslatedNote(noteText);
      setTranslatedRaw(rawTextTranslated);
      
      // Update modeContent for translate mode
      setModeContent(prev => ({ ...prev, translate: noteText }));
      if (isEditing) setEditedText(noteText);

      toast({
        title: "Language updated",
        description: lang === "hi" ? "Switched to Hindi." : "Switched to English.",
      });

      // Background prefetch opposite language for snappier subsequent switches
      const oppositeLang = lang === "hi" ? "en" : "hi";
      const oppNoteKey = baseNote ? `${oppositeLang}|note|${baseNote}` : "";
      const oppRawKey = baseRaw ? `${oppositeLang}|raw|${baseRaw}` : "";
      setTimeout(async () => {
        try {
          if (baseNote && oppNoteKey && !translationCacheNoteRef.current.has(oppNoteKey)) {
            const res = await aiService.translateText(baseNote, oppositeLang);
            if (res.success && res.translatedText) {
              translationCacheNoteRef.current.set(oppNoteKey, res.translatedText);
            }
          }
          if (baseRaw && oppRawKey && !translationCacheRawRef.current.has(oppRawKey)) {
            const res = await aiService.translateText(baseRaw, oppositeLang);
            if (res.success && res.translatedText) {
              translationCacheRawRef.current.set(oppRawKey, res.translatedText);
            }
          }
        } catch {
          // ignore background prefetch errors
        }
      }, 200);
    } finally {
      setIsTranslating(false);
      // Clear controller reference after completion
      if (translateControllerRef.current === controller) {
        translateControllerRef.current = null;
      }
    }
  };

  const handleShareNote = async () => {
    // Initialize editable subject with current title when opening
    setShareSubject(title || UI_STRINGS.UNTITLED_NOTE);
    setIsShareModalOpen(true);
  };

  // Build a formal email body for Gmail and mailto


  const handleStartEditing = async () => {
    setIsEditing(true);
    const baseText = (modeContent[activeMode] || (activeMode === "translate" ? translatedNote : null) || formattedNote || rawText || "");
    setEditedText(baseText);
  };

  const handleCancelEditing = () => {
    const base = modeContent[activeMode] || (activeMode === "translate" ? translatedNote : null) || formattedNote;
    setEditedText(base || "");
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    if (!noteId) {
      // If not saved to DB yet, just update local state
      updateFormattedNote(editedText);
      
      // Update modeContent cache for current mode
      if (activeMode !== "normal") {
        setModeContent(prev => ({ ...prev, [activeMode]: editedText }));
      }
      
      toast({
        title: "Updated!",
        description: "Your changes have been saved locally.",
      });
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    const { error } = await notesService.updateNote(noteId, {
      edited_text: editedText,
    });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to save changes. Please try again.",
        variant: "destructive",
      });
    } else {
      // Update session storage and internal state to keep UI in sync
      updateFormattedNote(editedText);
      
      // Update modeContent cache for current mode
      if (activeMode !== "normal") {
        setModeContent(prev => ({ ...prev, [activeMode]: editedText }));
      }

      toast({
        title: "Saved!",
        description: "Your changes have been saved.",
      });
      setIsEditing(false);
    }
    setIsSaving(false);
  };

  const handleSaveToDatabase = async () => {
    if (!user) {
      router.push(`/auth?redirectTo=${encodeURIComponent(ROUTES.RESULTS)}`);
      return;
    }

    setIsSaving(true);
    try {
      let saveResult;

      if (noteId) {
        // Update existing note if we have an ID
        saveResult = await notesService.updateNote(noteId, {
          title: title || "Untitled Note",
          raw_text: rawText || "",
          original_formatted_text: formattedNote || "",
          edited_text: isEditing ? editedText : undefined,
        });
      } else {
        // Create new note
        saveResult = await notesService.createNote({
          user_id: user.id,
          title: title || "Untitled Note",
          raw_text: rawText || "",
          original_formatted_text: formattedNote || "",
        });
      }

      const { data: savedNote, error: saveError } = saveResult;

      if (saveError) {
        throw saveError;
      }

      if (savedNote) {
        setNoteId(savedNote.id);
        storageService.setCurrentNoteId(savedNote.id);
        setIsNoteSaved(true);
        toast({
          title: "Saved!",
          description: "Your note has been saved to the cloud.",
        });
      }
    } catch (error) {
      console.error("Failed to save note to database:", error);
      toast({
        title: "Save Failed",
        description: "Could not save to cloud. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleFeedbackSubmit = async (
    helpful: boolean,
    reasons?: FeedbackReason[]
  ) => {
    if (!noteId) {
      toast({
        title: "Error",
        description: "Could not submit feedback - note not found.",
        variant: "destructive",
      });
      return;
    }

    setIsFeedbackSubmitting(true);
    const { success, error } = await feedbackService.submitFeedback(
      noteId,
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

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="flex items-center justify-center mb-4">
            <Spinner className="text-cyan-500" />
          </div>
          <p className="text-gray-300">{UI_STRINGS.LOADING_NOTE}</p>
        </div>
      </main>
    );
  }

  const displayText = activeMode === "normal"
    ? (isEditing ? editedText : formattedNote)
    : (modeContent[activeMode] || (isEditing ? editedText : formattedNote));

  return (
    <main className="flex flex-col items-center px-4 pt-8 pb-24 min-h-screen bg-[#020617] text-white overflow-x-hidden">
      <div className="w-full max-w-2xl flex flex-col items-center gap-6 mt-16">
        <div className="text-center space-y-4 w-full">
          <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight">
            {title || UI_STRINGS.RESULTS_TITLE}
          </h1>

          {/* Folder Management Section */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex flex-wrap justify-center items-center gap-2">
              {selectedFolder ? (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30 px-3 py-1 text-sm flex items-center gap-2">
                    <FolderPlus className="w-3.5 h-3.5" />
                    {selectedFolder}
                    <button 
                      onClick={() => handleUpdateFolder(null)}
                      className="hover:text-cyan-200 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                </div>
              ) : (
                <span className="text-gray-500 text-sm">No folder assigned</span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-2">
              {!isAddingNewFolder ? (
                <div className="flex items-center gap-2 overflow-x-auto max-w-[90vw] no-scrollbar pb-1">
                  {availableFolders.filter(f => f !== selectedFolder).map(folder => (
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
                  <button
                    onClick={handleAddNewFolder}
                    className="p-1 hover:text-cyan-400 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setIsAddingNewFolder(false)}
                    className="p-1 hover:text-red-400 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mode Selection Bar (Floating) */}
        <div className="flex flex-col items-center gap-4 w-full">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center bg-slate-900/80 backdrop-blur-md border border-white/5 rounded-xl p-1 shadow-2xl z-10"
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
                    if (isEditing) setEditedText(formattedNote || "");
                    return;
                  }
                  
                  setActiveMode(mode.id as typeof activeMode);
                  const baseText = (isEditing ? editedText : formattedNote) || rawText || "";
                  
                  if (!modeContent[mode.id] && mode.id !== "translate") {
                    setIsLoadingMode(true);
                    let resultText = baseText;
                    if (mode.id === "email") {
                      const res = await gmailFormatText(baseText, title || "Untitled Note");
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
                className="flex items-center gap-2 bg-slate-900/50 backdrop-blur-sm border border-white/5 rounded-full p-1 shadow-xl"
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

        {/* Inline subject editor when Email mode + editing */}
        {activeMode === "email" && isEditing && (
          <div className="w-full max-w-[650px]">
            <label className="text-sm text-gray-400 block mb-1">Email subject</label>
            <input
              type="text"
              value={shareSubject ?? (title || UI_STRINGS.UNTITLED_NOTE)}
              onChange={(e) => setShareSubject(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="Subject"
            />
          </div>
        )}

        <NoteEditor
          formattedNote={displayText || ""}
          title={title || UI_STRINGS.UNTITLED_NOTE}
          onCopy={handleCopyNote}
          onDownload={handleDownloadNote}
          onShare={handleShareNote}
          showRawTranscript={showRawTranscript}
          onToggleTranscript={() => setShowRawTranscript(!showRawTranscript)}
          rawText={translatedRaw ?? rawText}
          isEditing={isEditing}
          onStartEditing={handleStartEditing}
          onCancelEditing={handleCancelEditing}
          onSaveEdit={handleSaveEdit}
          onTextChange={setEditedText}
          isSaving={isSaving}
          canEdit={!!noteId}
          isCopying={isCopying}
          isDownloading={isDownloading}
          isSharing={isSharing}
          onFeedbackSubmit={handleFeedbackSubmit}
          isFeedbackSubmitting={isFeedbackSubmitting}
          hasFeedbackSubmitted={hasFeedbackSubmitted}
          feedbackValue={feedbackValue}
          showFeedback={!!noteId}
        />
      </div>

      <NoteActions 
        onSave={handleSaveToDatabase} 
        isSaving={isSaving} 
        showSave={!isNoteSaved} 
      />

      {/* Share Options Modal */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsShareModalOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-cyan-700/30 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Share2 className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 className="text-lg font-semibold text-white">Share note</h3>
                  <p className="text-sm text-gray-400">Choose a destination</p>
                </div>
              </div>
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="text-gray-400 hover:text-white text-xl"
                aria-label="Close share dialog"
              >
                ✕
              </button>
            </div>
            <Separator className="bg-cyan-700/30" />

            {/* Subject input */}
            <div className="mt-4">
              <label className="text-sm text-gray-400 block mb-1">Email subject</label>
              <input
                type="text"
                value={shareSubject ?? (title || UI_STRINGS.UNTITLED_NOTE)}
                onChange={(e) => setShareSubject(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder="Subject"
              />
            </div>

            {/* Removed Gmail toggle/preview. Share will use editor content if already email-formatted. */}

            <div className="mt-4 grid grid-cols-1 gap-3">
              {/* WhatsApp */}
              <button
                onClick={async () => {
                  const textToShare = (isEditing ? editedText : (translatedNote ?? formattedNote)) || "";
                  const shareTitle = title || UI_STRINGS.UNTITLED_NOTE;
                  const payload = `${shareTitle}\n\n${textToShare}`.trim();
                  const url = `https://wa.me/?text=${encodeURIComponent(payload)}`;
                  window.open(url, "_blank", "noopener,noreferrer");
                  setIsShareModalOpen(false);
                }}
                className="w-full flex items-center gap-3 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors border border-cyan-700/30"
              >
                <MessageCircle className="w-5 h-5" />
                <span>WhatsApp</span>
              </button>

              {/* Gmail */}
              <button
                onClick={() => {
              const shareTitle = title || UI_STRINGS.UNTITLED_NOTE;
              const subjectText = shareSubject ?? shareTitle;
              const subject = encodeURIComponent(subjectText);
              const bodyText = isEditing
                ? editedText
                : activeMode === "normal"
                ? formattedNote || ""
                : modeContent[activeMode] || formattedNote || "";
                  const body = encodeURIComponent(bodyText);
                  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}&tf=1`;
                  window.open(gmailUrl, "_blank", "noopener,noreferrer");
                  setIsShareModalOpen(false);
                }}
                className="w-full flex items-center gap-3 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors border border-cyan-700/30"
              >
                <Mail className="w-5 h-5" />
                <div className="flex flex-col items-start">
                  <span>Gmail</span>
                  <span className="text-xs text-gray-400">Uses editor content (AI formatted if applied)</span>
                </div>
              </button>

              {/* Default Email Client */}
              <button
                onClick={() => {
              const shareTitle = title || UI_STRINGS.UNTITLED_NOTE;
              const subjectText = shareSubject ?? shareTitle;
              const subject = encodeURIComponent(subjectText);
              const bodyText = isEditing
                ? editedText
                : activeMode === "normal"
                ? formattedNote || ""
                : modeContent[activeMode] || formattedNote || "";
                  const body = encodeURIComponent(bodyText);
                  window.location.href = `mailto:?subject=${subject}&body=${body}`;
                  setIsShareModalOpen(false);
                }}
                className="w-full flex items-center gap-3 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors border border-cyan-700/30"
              >
                <Mail className="w-5 h-5" />
                <div className="flex flex-col items-start">
                  <span>Email (Default Client)</span>
                  <span className="text-xs text-gray-400">Uses editor content (AI formatted if applied)</span>
                </div>
              </button>

              {/* Native Share (if available) */}
              {typeof navigator !== "undefined" && "share" in navigator && (
                <button
                  onClick={async () => {
                    const textToShare = (isEditing ? editedText : formattedNote) || "";
                    const shareTitle = title || UI_STRINGS.UNTITLED_NOTE;
                    const payload = `${shareTitle}\n\n${textToShare}`.trim();
                    try {
                      setIsSharing(true);
                      const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
                      await nav.share?.({ title: shareTitle, text: payload });
                      setIsShareModalOpen(false);
                    } catch {
                      // user may have cancelled
                    } finally {
                      setIsSharing(false);
                    }
                  }}
                  className="w-full flex items-center gap-3 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors border border-cyan-700/30"
                >
                  <Share2 className="w-5 h-5" />
                  <span>More Options…</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}