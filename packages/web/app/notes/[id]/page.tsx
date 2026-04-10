"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { notesService } from "@/lib/services/notes.service";
import { feedbackService } from "@/lib/services/feedback.service";
import { storageService } from "@/lib/services/storage.service";
import { aiService } from "@/lib/services/ai.service";
import { ROUTES } from "@/lib/constants";
import { NoteEditorSkeleton } from "@/components/results/NoteEditorSkeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Copy,
  Download,
  Share2,
  Mail,
  MessageCircle,
  FileText,
  Languages,
  ListChecks,
  BookOpen,
  Star,
  ThumbsUp,
  ThumbsDown,
  Mic,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { useAIEmailFormatting } from "@/lib/hooks/useAIEmailFormatting";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/contexts/AuthContext";
import type { DBNote, FeedbackReason } from "@/lib/types/note.types";

export default function NoteDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id as string;
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [note, setNote] = useState<DBNote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editedText, setEditedText] = useState("");
  const [activeTab, setActiveTab] = useState<"transcript" | "ai-notes">("ai-notes");
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareSubject, setShareSubject] = useState<string | null>(null);
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
      setEditedText(note.edited_text || note.original_formatted_text || "");
      return;
    }

    const baseNote = editedText || note.edited_text || note.original_formatted_text || "";
    if (!baseNote) return;

    if (isTranslating && translateControllerRef.current) {
      translateControllerRef.current.abort();
    }

    const noteKey = `${lang}|note|${baseNote}`;
    const cachedNote = translationCacheNoteRef.current.get(noteKey);

    if (cachedNote) {
      setSelectedLanguage(lang);
      setModeContent(prev => ({ ...prev, translate: cachedNote }));
      setEditedText(cachedNote);
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
      setEditedText(noteText);

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

  const handleSaveEdit = async () => {
    if (!note || !editedText) return;
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
      if (activeMode !== "normal") {
        setModeContent(prev => ({ ...prev, [activeMode]: editedText }));
      }
    }
    setIsSaving(false);
  };

  const handleCopy = async () => {
    const text = activeMode === "normal"
      ? (editedText || note?.edited_text || note?.original_formatted_text || "")
      : (modeContent[activeMode] || editedText || note?.edited_text || note?.original_formatted_text || "");
    await navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Note copied to clipboard.",
    });
  };

  const handleDownload = () => {
    if (!note) return;
    const text = activeMode === "normal"
      ? (editedText || note.edited_text || note.original_formatted_text)
      : (modeContent[activeMode] || editedText || note.edited_text || note.original_formatted_text);
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
      </motion.div>

      {/* Mode Selection Bar (Floating) */}
      <div className="flex flex-col items-center gap-1.5 w-full mb-4">
        <p className="text-sm text-gray-400 font-medium">Convert your note into <span className="text-base font-bold text-cyan-400">→</span></p>
        <TooltipProvider>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center bg-slate-900/80 backdrop-blur-md border border-white/5 rounded-xl p-1 shadow-2xl z-10"
          >
            {[
              { id: "normal", icon: FileText, label: "Note", desc: "Clean structured note" },
              { id: "email", icon: Mail, label: "Email", desc: "Send-ready draft" },
              { id: "bullets", icon: ListChecks, label: "Bullets", desc: "Quick key points" },
              { id: "summary", icon: BookOpen, label: "Summary", desc: "Condensed overview" },
              { id: "translate", icon: Languages, label: "Translate", desc: "Change language" }
            ].map((mode) => (
              <Tooltip key={mode.id} delayDuration={200}>
                <TooltipTrigger asChild>
                  <button
                    onClick={async () => {
                      if (mode.id === "normal") {
                        setActiveMode("normal");
                        setEditedText(note.edited_text || note.original_formatted_text || "");
                        return;
                      }

                      setActiveMode(mode.id as typeof activeMode);
                      const baseText = editedText || note.edited_text || note.original_formatted_text || note.raw_text || "";

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
                        setEditedText(resultText);
                        setIsLoadingMode(false);
                      } else if (mode.id !== "translate") {
                        setEditedText(modeContent[mode.id] || baseText);
                      }
                    }}
                    className={`flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-300 ${
                      activeMode === mode.id 
                        ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20" 
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {isLoadingMode && activeMode === mode.id ? (
                      <Spinner className="w-5 h-5" />
                    ) : (
                      <mode.icon className="w-5 h-5" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-slate-900 border border-cyan-500 text-cyan-400 rounded-md px-3 py-2">
                  <p className="text-sm"><span className="font-semibold">{mode.label}</span> — {mode.desc}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </motion.div>
        </TooltipProvider>

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
                className={`p-2 rounded-lg transition-all duration-300 ${note.is_starred ? 'text-cyan-400 bg-cyan-400/10' : 'text-gray-500 hover:text-cyan-400 hover:bg-cyan-400/5'}`}
                title="Star note"
              >
                <Star className={`w-4 h-4 ${note.is_starred ? 'fill-cyan-400' : ''}`} />
              </button>
              {isSaving && <Spinner className="w-4 h-4 text-cyan-500" />}
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
          <div className="w-16 h-0.5 bg-cyan-500/80 rounded-full mb-4" />

          {/* Tabs */}
          <div className="flex gap-1 mb-4">
            <button
              onClick={() => setActiveTab("transcript")}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "transcript"
                  ? "bg-cyan-500/10 text-cyan-400"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              Transcript
            </button>
            <button
              onClick={() => setActiveTab("ai-notes")}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "ai-notes"
                  ? "bg-cyan-500/10 text-cyan-400"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              AI Notes
            </button>
          </div>

          {/* Tab Content */}
          <div className="min-h-[120px]">
            {activeTab === "transcript" ? (
              <div className="text-gray-300 text-base leading-relaxed whitespace-pre-wrap">
                {note.raw_text || "No transcript available."}
              </div>
            ) : (
              <textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                onBlur={handleSaveEdit}
                placeholder="AI-formatted notes will appear here..."
                className="w-full bg-transparent text-base text-gray-300 leading-relaxed focus:outline-none resize-none border-none p-0 min-h-[120px] max-h-[500px] overflow-y-auto placeholder:text-gray-600"
              />
            )}
          </div>

          <div className="flex border-white/5 border-t mt-4 pt-4 justify-end">
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
              className="bg-cyan-500/5 hover:bg-cyan-500/15 gap-2 text-cyan-400 px-4 py-2 rounded-lg font-medium text-xs transition-all duration-300 flex items-center border border-cyan-500/10 group"
              title="Continue recording and append to this note"
            >
              <Mic className="w-3 h-3" />
              <span>Append to notes</span>
            </button>
          </div>
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
      </motion.div>

      {/* Share Modal */}
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
                value={shareSubject ?? (note.title || "Untitled Note")}
                onChange={(e) => setShareSubject(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder="Subject"
              />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3">
              {/* WhatsApp */}
              <button
                onClick={() => {
                  const bodyText = activeMode === "normal"
                    ? editedText || ""
                    : modeContent[activeMode] || editedText || "";
                  const payload = `${note.title || "Untitled Note"}\n\n${bodyText}`.trim();
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
                  const subjectText = shareSubject ?? (note.title || "Untitled Note");
                  const subject = encodeURIComponent(subjectText);
                  const bodyText = activeMode === "normal"
                    ? editedText || ""
                    : modeContent[activeMode] || editedText || "";
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
                  <span className="text-xs text-gray-400">Uses current transcript content</span>
                </div>
              </button>

              {/* Default Email Client */}
              <button
                onClick={() => {
                  const subjectText = shareSubject ?? (note.title || "Untitled Note");
                  const subject = encodeURIComponent(subjectText);
                  const bodyText = activeMode === "normal"
                    ? editedText || ""
                    : modeContent[activeMode] || editedText || "";
                  const body = encodeURIComponent(bodyText);
                  window.location.href = `mailto:?subject=${subject}&body=${body}`;
                  setIsShareModalOpen(false);
                }}
                className="w-full flex items-center gap-3 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors border border-cyan-700/30"
              >
                <Mail className="w-5 h-5" />
                <div className="flex flex-col items-start">
                  <span>Email (Default Client)</span>
                  <span className="text-xs text-gray-400">Uses current transcript content</span>
                </div>
              </button>

              {/* Native Share (if available) */}
              {typeof navigator !== "undefined" && "share" in navigator && (
                <button
                  onClick={async () => {
                    const bodyText = activeMode === "normal"
                      ? editedText || ""
                      : modeContent[activeMode] || editedText || "";
                    const shareTitle = note.title || "Untitled Note";
                    const payload = `${shareTitle}\n\n${bodyText}`.trim();
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
                  <span>More Options…{isSharing && "…"}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
