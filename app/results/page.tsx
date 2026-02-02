"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useNoteStorage } from "@/lib/hooks/useNoteStorage";
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
import { Mail, MessageCircle, Share2 } from "lucide-react";
import { Separator } from "@radix-ui/react-separator";

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
  const { isLoading, formattedNote, rawText, title, updateFormattedNote } =
    useNoteStorage();

  const [showRawTranscript, setShowRawTranscript] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [noteId, setNoteId] = useState<string | null>(null);
  const [isCopying, setIsCopying] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Language / translation state (post-recording)
  const [selectedLanguage, setSelectedLanguage] = useState<
    "original" | "en" | "hi"
  >("original");
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedNote, setTranslatedNote] = useState<string | null>(null);
  const [translatedRaw, setTranslatedRaw] = useState<string | null>(null);

  // Feedback state
  const [isFeedbackSubmitting, setIsFeedbackSubmitting] = useState(false);
  const [hasFeedbackSubmitted, setHasFeedbackSubmitted] = useState(false);
  const [feedbackValue, setFeedbackValue] = useState<boolean | null>(null);

  useEffect(() => {
    const storedNoteId = storageService.getCurrentNoteId();
    if (storedNoteId) {
      setNoteId(storedNoteId);
    }
  }, []);

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
      const textToCopy = isEditing ? editedText : formattedNote;
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
      const textToDownload = isEditing ? editedText : formattedNote;
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
      setSelectedLanguage("original");
      setTranslatedNote(null);
      setTranslatedRaw(null);
      return;
    }

    if (isTranslating) return;
    const baseNote = (isEditing ? editedText : formattedNote) || "";
    const baseRaw = rawText || "";
    if (!baseNote && !baseRaw) return;

    setIsTranslating(true);
    try {
      const noteRes = baseNote
        ? await aiService.translateText(baseNote, lang)
        : { success: true as const, translatedText: "" };
      const rawRes = baseRaw
        ? await aiService.translateText(baseRaw, lang)
        : { success: true as const, translatedText: "" };

      if (!noteRes.success || !rawRes.success) {
        toast({
          title: "Translation failed",
          description: "Could not translate right now. Please try again.",
          variant: "destructive",
        });
        return;
      }

      setSelectedLanguage(lang);
      setTranslatedNote(noteRes.translatedText || "");
      setTranslatedRaw(rawRes.translatedText || "");
      toast({
        title: "Language updated",
        description: lang === "hi" ? "Switched to Hindi." : "Switched to English.",
      });
    } finally {
      setIsTranslating(false);
    }
  };

  const handleShareNote = async () => {
    setIsShareModalOpen(true);
  };

  // Build a formal email body for Gmail and mailto
  const buildFormalEmailBody = (shareTitle: string, content: string) => {
    const lines = [] as string[];
    lines.push("Dear Sir/Madam,");
    lines.push("");
    lines.push(
      `I hope you're well. Please find the note titled \"${shareTitle}\" below for your review.`
    );
    lines.push("");
    lines.push("— Note");
    lines.push("");
    lines.push(content.trim());
    lines.push("");
    lines.push("Best regards,");
    lines.push("Oscar Notes");
    return lines.join("\n");
  };

  const handleStartEditing = () => {
    setIsEditing(true);
  };

  const handleCancelEditing = () => {
    setEditedText(formattedNote);
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    if (!noteId) {
      toast({
        title: "Error",
        description: "Could not save changes - note not found in database.",
        variant: "destructive",
      });
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

      toast({
        title: "Saved!",
        description: "Your changes have been saved.",
      });
      setIsEditing(false);
    }
    setIsSaving(false);
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

  return (
    <main className="flex flex-col items-center px-4 pt-8 pb-24">
      <div className="w-full max-w-2xl flex flex-col items-center gap-8 mt-16">
        <div className="text-center space-y-2 mt-8">
          <h1 className="text-4xl font-bold text-white">
            {UI_STRINGS.RESULTS_TITLE}
          </h1>
        </div>

        {/* Language selector (translate after recording) */}
        <div className="w-full max-w-[650px] flex items-center justify-end gap-3">
          <label className="text-sm text-gray-400">Transcript language:</label>
          <select
            value={selectedLanguage}
            onChange={(e) =>
              applyLanguage(e.target.value as "original" | "en" | "hi")
            }
            disabled={isTranslating}
            className="bg-slate-800 border border-slate-700 text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
          >
            <option value="original">Original</option>
            <option value="en">English</option>
            <option value="hi">Hindi</option>
          </select>
        </div>

        <NoteEditor
          formattedNote={
            isEditing ? editedText : translatedNote ?? formattedNote
          }
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

      <NoteActions />

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

            <div className="mt-4 grid grid-cols-1 gap-3">
              {/* WhatsApp */}
              <button
                onClick={async () => {
                  const textToShare = (isEditing ? editedText : formattedNote) || "";
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

              {/* Gmail (Formal) */}
              <button
                onClick={() => {
                  const textToShare = (isEditing ? editedText : formattedNote) || "";
                  const shareTitle = title || UI_STRINGS.UNTITLED_NOTE;
                  const subject = encodeURIComponent(shareTitle);
                  const body = encodeURIComponent(
                    buildFormalEmailBody(shareTitle, textToShare)
                  );
                  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}&tf=1`;
                  window.open(gmailUrl, "_blank", "noopener,noreferrer");
                  setIsShareModalOpen(false);
                }}
                className="w-full flex items-center gap-3 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors border border-cyan-700/30"
              >
                <Mail className="w-5 h-5" />
                <div className="flex flex-col items-start">
                  <span>Gmail</span>
                  <span className="text-xs text-gray-400">Formal email format</span>
                </div>
              </button>

              {/* Default Email Client (Formal) */}
              <button
                onClick={() => {
                  const textToShare = (isEditing ? editedText : formattedNote) || "";
                  const shareTitle = title || UI_STRINGS.UNTITLED_NOTE;
                  const subject = encodeURIComponent(shareTitle);
                  const body = encodeURIComponent(
                    buildFormalEmailBody(shareTitle, textToShare)
                  );
                  window.location.href = `mailto:?subject=${subject}&body=${body}`;
                  setIsShareModalOpen(false);
                }}
                className="w-full flex items-center gap-3 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors border border-cyan-700/30"
              >
                <Mail className="w-5 h-5" />
                <div className="flex flex-col items-start">
                  <span>Email (Default Client)</span>
                  <span className="text-xs text-gray-400">Formal email format</span>
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
                      await (navigator as any).share({ title: shareTitle, text: payload });
                      setIsShareModalOpen(false);
                    } catch (e) {
                      // user cancelled
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