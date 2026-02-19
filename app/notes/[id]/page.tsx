"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { notesService } from "@/lib/services/notes.service";
import { feedbackService } from "@/lib/services/feedback.service";
import { NoteEditorSkeleton } from "@/components/results/NoteEditorSkeleton";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Copy,
  Download,
  Edit3,
  Save,
  X,
  Share2,
  Mail,
  MessageCircle,
  FileText,
} from "lucide-react";
import { useAIEmailFormatting } from "@/lib/hooks/useAIEmailFormatting";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/contexts/AuthContext";
import type { DBNote, FeedbackReason } from "@/lib/types/note.types";

// Lazy load the FeedbackWidget
const FeedbackWidget = dynamic(
  () =>
    import("@/components/results/FeedbackWidget").then((mod) => ({
      default: mod.FeedbackWidget,
    })),
  {
    loading: () => (
      <div className="mt-4 h-20 bg-slate-900 border border-cyan-700/30 rounded-xl animate-pulse" />
    ),
    ssr: false,
  }
);

export default function NoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [id, setId] = useState<string>("");

  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  const [note, setNote] = useState<DBNote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedText, setEditedText] = useState("");
  const [showRawTranscript, setShowRawTranscript] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  // const [isSharing, setIsSharing] = useState(false);
  const [shareSubject, setShareSubject] = useState<string | null>(null);
  // Gmail AI format now applies directly to the main editor text (no separate box)
  const { isFormatting: isGmailFormatting, formatText: gmailFormatText } =
    useAIEmailFormatting();
  const [isGmailMode, setIsGmailMode] = useState(false);
  const [gmailBody, setGmailBody] = useState<string | null>(null);

  // Feedback state
  const [isFeedbackSubmitting, setIsFeedbackSubmitting] = useState(false);
  const [hasFeedbackSubmitted, setHasFeedbackSubmitted] = useState(false);
  const [feedbackValue, setFeedbackValue] = useState<boolean | null>(null);

  useEffect(() => {
    const loadNote = async () => {
      if (!id) return;
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
        // Set existing feedback state
        if (data.feedback_helpful !== null) {
          setHasFeedbackSubmitted(true);
          setFeedbackValue(data.feedback_helpful);
        }
      }
      setIsLoading(false);
    };

    loadNote();
  }, [id, router, user]);

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
      setIsEditing(false);
      toast({
        title: "Saved!",
        description: "Your changes have been saved.",
      });
    }
    setIsSaving(false);
  };

  const handleCopy = async () => {
    const text = note?.edited_text || note?.original_formatted_text || "";
    await navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Note copied to clipboard.",
    });
  };

  const handleDownload = () => {
    if (!note) return;
    const text = note.edited_text || note.original_formatted_text;
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

  const displayText = isGmailMode
    ? gmailBody || ""
    : note.edited_text || note.original_formatted_text;

  return (
    <main className="flex flex-col items-center px-5 pt-8 pb-24">
      <div className="w-full max-w-xl flex flex-col items-center gap-8 mt-16">
        {/* Header with Back Button */}

        {/* <div className="flex-1 text-center">
          <h1 className="text-3xl font-bold text-white">
            {note.title || "Untitled Note"}
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {formatDate(note.created_at)}
          </p>
        </div> */}
        <div className="w-10" />

        <div className="flex bg-slate-800 border border-slate-700 rounded-lg overflow-hidden ml-auto mr-2">
          <button
            onClick={() => {
              setIsGmailMode(false);
              if (isEditing) {
                const base =
                  note.edited_text || note.original_formatted_text || "";
                setEditedText(base);
              }
            }}
            className={`px-3 py-2 text-sm ${
              !isGmailMode ? "bg-cyan-600 text-white" : "text-gray-300"
            }`}
          >
            <FileText className="w-4 h-4" />
          </button>
          <button
            onClick={async () => {
              setIsGmailMode(true);
              setShareSubject(note.title || "Untitled Note");
              const baseText =
                note.edited_text ||
                note.original_formatted_text ||
                note.raw_text ||
                "";
              if (!gmailBody) {
                const res = await gmailFormatText(
                  baseText,
                  note.title || "Untitled Note"
                );
                const emailBody = res.success
                  ? res.formattedText || baseText
                  : baseText;
                setGmailBody(emailBody);
                if (isEditing) {
                  setEditedText(emailBody);
                }
              } else {
                if (isEditing) {
                  setEditedText(gmailBody);
                }
              }
            }}
            className={`px-3 py-2 text-sm flex items-center gap-1 ${
              isGmailMode ? "bg-cyan-600 text-white" : "text-gray-300"
            }`}
          >
            {isGmailFormatting ? (
              <Spinner className="w-4 h-4 text-cyan-500" />
            ) : (
              <Mail className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Note Editor Card */}
        <div className="w-full max-w-[800px]">
          <Card className="bg-slate-900 border-cyan-700/30 rounded-t-2xl shadow-xl overflow-hidden">
            <CardHeader>
              {/* Title and Actions */}
              <div className="flex gap-6 justify-between items-start">
                <div className="mb-2">
                  <h2 className="text-xl font-semibold text-white truncate">
                    {note.title || "Untitled Note"}
                  </h2>
                  <p className="text-gray-400 text-sm">
                    {formatDate(note.created_at)}
                  </p>
                </div>

                <div className="hidden md:flex items-center">
                  <div className="flex">
                    {isEditing ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleSaveEdit}
                          disabled={isSaving}
                          className="text-cyan-500 hover:text-cyan-300"
                        >
                          {isSaving ? (
                            <Spinner className="w-4 h-4" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setIsEditing(false);
                            setEditedText(
                              note.edited_text || note.original_formatted_text
                            );
                          }}
                          disabled={isSaving}
                          className="text-gray-400 hover:text-white"
                        >
                          <X className="w-5 h-5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        {/* Simple/Gmail mode toggle */}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setIsEditing(true);
                            if (isGmailMode) {
                              setShareSubject(note.title || "Untitled Note");
                            }
                          }}
                          className="text-gray-400 hover:text-cyan-500"
                        >
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCopy}
                          className="text-gray-400 hover:text-cyan-500"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleDownload}
                          className="text-gray-400 hover:text-cyan-500"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShareSubject(note.title || "Untitled Note");
                            setIsShareModalOpen(true);
                          }}
                          className="text-gray-400 hover:text-cyan-500"
                        >
                          <Share2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <Separator className="w-24 h-0.5 bg-cyan-500" />
            </CardHeader>

            <CardContent>
              {isEditing ? (
                <>
                  {isGmailMode && (
                    <div className="mb-3">
                      <label className="text-sm text-gray-400 block mb-1">
                        Email subject
                      </label>
                      <input
                        type="text"
                        value={shareSubject ?? (note.title || "Untitled Note")}
                        onChange={(e) => setShareSubject(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        placeholder="Subject"
                      />
                    </div>
                  )}
                  <textarea
                    value={editedText}
                    onChange={(e) => setEditedText(e.target.value)}
                    className="w-full min-h-[250px] bg-slate-800 text-gray-300 rounded-lg p-4 resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-slate-700"
                    autoFocus
                  />
                </>
              ) : (
                <div className="text-md text-start text-gray-300 whitespace-pre-wrap">
                  {displayText}
                </div>
              )}

              {/* Mobile Action Buttons */}
              <div className="flex md:hidden justify-center items-center mt-6 border-slate-700/50">
                <div className="flex gap-4 items-center">
                  {/* Simple/Gmail toggle for mobile */}

                  {isEditing ? (
                    <>
                      {isGmailMode && (
                        <div className="w-full">
                          <label className="text-sm text-gray-400 block mb-1">
                            Email subject
                          </label>
                          <input
                            type="text"
                            value={
                              shareSubject ?? (note.title || "Untitled Note")
                            }
                            onChange={(e) => setShareSubject(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            placeholder="Subject"
                          />
                        </div>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSaveEdit}
                        disabled={isSaving}
                        className="text-cyan-500 hover:text-cyan-400 flex flex-col items-center gap-1 h-auto py-2"
                      >
                        {isSaving ? (
                          <Spinner className="w-5 h-5" />
                        ) : (
                          <Save className="w-5 h-5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setIsEditing(false);
                          setEditedText(
                            note.edited_text || note.original_formatted_text
                          );
                        }}
                        disabled={isSaving}
                        className="text-gray-400 hover:text-white flex flex-col items-center gap-1 h-auto py-2"
                      >
                        <X className="w-5 h-5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsEditing(true)}
                        className="text-gray-400 hover:text-cyan-500 flex flex-col items-center gap-1 h-auto py-2"
                      >
                        <Edit3 className="w-5 h-5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCopy}
                        className="text-gray-400 hover:text-cyan-500 flex flex-col items-center gap-1 h-auto py-2"
                      >
                        <Copy className="w-5 h-5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleDownload}
                        className="text-gray-400 hover:text-cyan-500 flex flex-col items-center gap-1 h-auto py-2"
                      >
                        <Download className="w-5 h-5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShareSubject(note.title || "Untitled Note");
                          setIsShareModalOpen(true);
                        }}
                        className="text-gray-400 hover:text-cyan-500 flex flex-col items-center gap-1 h-auto py-2"
                      >
                        <Share2 className="w-5 h-5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

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
                      <h3 className="text-lg font-semibold text-white">
                        Share note
                      </h3>
                      <p className="text-sm text-gray-400">
                        Choose a destination
                      </p>
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
                  <label className="text-sm text-gray-400 block mb-1">
                    Email subject
                  </label>
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
                    onClick={async () => {
                      const textToShare = displayText || "";
                      const shareTitle = note.title || "Untitled Note";
                      const payload = `${shareTitle}\n\n${textToShare}`.trim();
                      const url = `https://wa.me/?text=${encodeURIComponent(
                        payload
                      )}`;
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
                      const shareTitle = note.title || "Untitled Note";
                      const subjectText = shareSubject ?? shareTitle;
                      const subject = encodeURIComponent(subjectText);
                      const bodyText = isEditing
                        ? editedText
                        : isGmailMode
                        ? gmailBody || ""
                        : note.edited_text ||
                          note.original_formatted_text ||
                          "";
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
                      <span className="text-xs text-gray-400">
                        Active mode content (Gmail or formal)
                      </span>
                    </div>
                  </button>

                  {/* Default Email Client */}
                  <button
                    onClick={() => {
                      const shareTitle = note.title || "Untitled Note";
                      const subjectText = shareSubject ?? shareTitle;
                      const subject = encodeURIComponent(subjectText);
                      const bodyText = isEditing
                        ? editedText
                        : isGmailMode
                        ? gmailBody || ""
                        : note.edited_text ||
                          note.original_formatted_text ||
                          "";
                      const body = encodeURIComponent(bodyText);
                      window.location.href = `mailto:?subject=${subject}&body=${body}`;
                      setIsShareModalOpen(false);
                    }}
                    className="w-full flex items-center gap-3 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors border border-cyan-700/30"
                  >
                    <Mail className="w-5 h-5" />
                    <div className="flex flex-col items-start">
                      <span>Email (Default Client)</span>
                      <span className="text-xs text-gray-400">
                        Active mode content (Gmail or formal)
                      </span>
                    </div>
                  </button>

                  {/* Web Share API */}
                  {typeof navigator !== "undefined" && "share" in navigator && (
                    <button
                      onClick={async () => {
                        const textToShare = displayText || "";
                        const shareTitle = note.title || "Untitled Note";
                        const payload =
                          `${shareTitle}\n\n${textToShare}`.trim();
                        try {
                          // setIsSharing(true);
                          const nav = navigator as Navigator & {
                            share?: (data: ShareData) => Promise<void>;
                          };
                          await nav.share?.({
                            title: shareTitle,
                            text: payload,
                          });
                          setIsShareModalOpen(false);
                        } catch {
                          // user may have cancelled
                        } finally {
                          // setIsSharing(false);
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

          {/* Feedback Widget */}
          <div className="mt-4">
            <FeedbackWidget
              onSubmit={handleFeedbackSubmit}
              isSubmitting={isFeedbackSubmitting}
              hasSubmitted={hasFeedbackSubmitted}
              submittedValue={feedbackValue}
            />
          </div>

          {/* Raw Transcript - Slide In/Out with Framer Motion */}
          <AnimatePresence mode="wait">
            {showRawTranscript ? (
              <motion.div
                key="transcript-visible"
                initial={{ opacity: 0, scaleY: 0, y: 0 }}
                animate={{ opacity: 1, scaleY: 1, y: 0 }}
                exit={{ opacity: 0, scaleY: 0, y: 0 }}
                transition={{
                  duration: 0.3,
                  ease: "easeInOut",
                }}
                style={{ originY: 0 }}
              >
                <div className="flex justify-center">
                  <Card className="bg-white border-none rounded-t-none rounded-b-2xl shadow-xl w-full max-w-[90%]">
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        {/* Raw Transcript Text */}
                        <div className="text-gray-800 text-md whitespace-pre-wrap leading-relaxed">
                          {note.raw_text || "No transcript available."}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Hide Button - Below Raw Transcript with Delayed Animation */}
                <motion.div
                  initial={{ opacity: 0, y: 0 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 0 }}
                  transition={{
                    duration: 0.2,
                    ease: "easeOut",
                    delay: 0.2,
                  }}
                  className="flex justify-center"
                >
                  <button
                    onClick={() => setShowRawTranscript(false)}
                    className="bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-700 hover:to-cyan-800 text-white font-medium py-2.5 px-10 transition-all duration-300 ease-in-out shadow-lg hover:shadow-xl flex items-center justify-center gap-2 rounded-b-2xl"
                  >
                    <span className="text-sm">hide original transcript</span>
                  </button>
                </motion.div>
              </motion.div>
            ) : (
              <motion.div
                key="transcript-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: 0.2,
                  ease: "easeOut",
                }}
                className="flex justify-center"
              >
                <button
                  onClick={() => setShowRawTranscript(true)}
                  className="bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-700 hover:to-cyan-800 text-white font-medium py-2.5 px-10 transition-all duration-300 ease-in-out shadow-lg hover:shadow-xl flex items-center justify-center gap-2 rounded-b-2xl"
                >
                  <span className="text-sm">view original transcript</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}
