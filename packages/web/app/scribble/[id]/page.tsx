"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { scribblesService } from "@/lib/services/scribbles.service";
import { queryKeys } from "@/lib/hooks/queries/keys";
import { useHasTeam } from "@/lib/hooks/queries/useActiveOrg";
import { feedbackService } from "@/lib/services/feedback.service";
import { storageService } from "@/lib/services/storage.service";
import { aiService } from "@/lib/services/ai.service";
import { ROUTES } from "@/lib/constants";
import { ScribbleEditorSkeleton } from "@/components/results/ScribbleEditorSkeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Copy,
  Download,
  Share2,
  Mail,
  MessageCircle,
  FileText,
  FileCode,
  Languages,
  ListChecks,
  BookOpen,
  Star,
  Mic,
  Printer,
} from "lucide-react";
import { useAIEmailFormatting } from "@/lib/hooks/useAIEmailFormatting";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/contexts/AuthContext";
import { FeedbackWidget } from "@/components/results/FeedbackWidget";
import { ShareDialog } from "@/components/org/ShareDialog";
import { PublishDialog } from "@/components/org/PublishDialog";
import type { DBScribble, FeedbackReason } from "@/lib/types/scribble.types";
import {
  v2,
  v2Serif,
  v2Mono,
  V2Caps,
  V2Mono,
  V2Wordmark,
} from "@/components/v2/V2Primitives";

type Mode = "normal" | "email" | "translate" | "summary" | "bullets";
const MODES: Array<{ id: Mode; icon: typeof FileText; label: string; desc: string }> = [
  { id: "normal", icon: FileText, label: "Scribble", desc: "Your clean working draft" },
  { id: "email", icon: Mail, label: "Email", desc: "Send-ready draft" },
  { id: "bullets", icon: ListChecks, label: "Bullets", desc: "Quick key points" },
  { id: "summary", icon: BookOpen, label: "Summary", desc: "Condensed overview" },
  { id: "translate", icon: Languages, label: "Translate", desc: "Change language" },
];

function formatDate(iso: string) {
  return new Date(iso)
    .toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .toUpperCase();
}

export default function ScribbleDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id as string;
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const hasTeam = useHasTeam();

  // Reconcile the library's React Query cache so edits/stars made here are
  // reflected in /scribble without a hard refresh.
  const invalidateLibrary = () =>
    void qc.invalidateQueries({ queryKey: queryKeys.scribbles });

  const [scribble, setScribble] = useState<DBScribble | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editedText, setEditedText] = useState("");
  const [activeTab, setActiveTab] = useState<"transcript" | "scribble">("scribble");
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareSubject, setShareSubject] = useState<string | null>(null);
  const { formatText: gmailFormatText } = useAIEmailFormatting();
  const [activeMode, setActiveMode] = useState<Mode>("normal");
  const [modeContent, setModeContent] = useState<Record<string, string>>({});
  const [modeSource, setModeSource] = useState<Record<string, string>>({});
  const [isLoadingMode, setIsLoadingMode] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<"original" | "en" | "hi">("original");
  const [isTranslating, setIsTranslating] = useState(false);
  const translationCacheRef = useRef<Map<string, string>>(new Map());
  const translateControllerRef = useRef<AbortController | null>(null);

  const [isFeedbackSubmitting, setIsFeedbackSubmitting] = useState(false);
  const [hasFeedbackSubmitted, setHasFeedbackSubmitted] = useState(false);
  const [feedbackValue, setFeedbackValue] = useState<boolean | null>(null);
  const [isStarring, setIsStarring] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      if (authLoading) return;
      if (!user) {
        router.push(`/auth?redirectTo=${encodeURIComponent(`/scribble/${id}`)}`);
        return;
      }
      setIsLoading(true);
      let { data, error } = await scribblesService.getScribbleById(id);
      // Read-after-write / transient miss: retry once before giving up so a
      // momentary empty read doesn't look like the scribble "disappeared".
      if (error || !data) {
        await new Promise((resolve) => setTimeout(resolve, 600));
        ({ data, error } = await scribblesService.getScribbleById(id));
      }
      if (error) {
        toast({
          title: "Couldn't load that scribble",
          description: "Something went wrong — refreshing usually fixes it.",
          variant: "destructive",
        });
        router.push("/scribble");
      } else if (!data) {
        toast({
          title: "Scribble not available",
          description: "It may have been moved to trash or no longer exists.",
        });
        router.push("/scribble");
      } else if (user && data.user_id !== user.id) {
        router.push("/scribble");
      } else {
        setScribble(data);
        setEditedText(data.edited_text || data.original_formatted_text);
        storageService.setCurrentScribbleId(data.id);
        storageService.updateRawText(data.raw_text);
        storageService.saveScribble(data.original_formatted_text, data.raw_text, data.title);
        if (data.feedback_helpful !== null) {
          setHasFeedbackSubmitted(true);
          setFeedbackValue(data.feedback_helpful);
        }
      }
      setIsLoading(false);
    };
    load();
  }, [id, router, user, authLoading, toast]);

  useEffect(() => {
    setModeContent({});
    setModeSource({});
    setActiveMode("normal");
    setSelectedLanguage("original");
  }, [scribble?.id, scribble?.updated_at]);

  const getBaseText = () => {
    if (!scribble) return "";
    if (activeMode === "normal") {
      return (
        editedText ||
        scribble.edited_text ||
        scribble.original_formatted_text ||
        scribble.raw_text ||
        ""
      );
    }
    return (
      scribble.edited_text || scribble.original_formatted_text || scribble.raw_text || ""
    );
  };

  const handleSelectMode = async (next: Mode) => {
    if (!scribble) return;
    if (next === "normal") {
      setActiveMode("normal");
      setEditedText(scribble.edited_text || scribble.original_formatted_text || "");
      return;
    }
    setActiveMode(next);
    if (next === "translate") return;

    const baseText = getBaseText();
    const fresh = modeContent[next] && modeSource[next] === baseText;
    if (fresh) {
      setEditedText(modeContent[next] || baseText);
      return;
    }
    setIsLoadingMode(true);
    let result = baseText;
    if (next === "email") {
      const res = await gmailFormatText(baseText, scribble.title || "Untitled Scribble");
      result = res.success ? res.formattedText || baseText : baseText;
    } else {
      const res = await aiService.transformText(baseText, next, scribble.title || "Untitled Scribble");
      result = res.success ? res.formattedText || baseText : baseText;
    }
    setModeContent((p) => ({ ...p, [next]: result }));
    setModeSource((p) => ({ ...p, [next]: baseText }));
    setEditedText(result);
    setIsLoadingMode(false);
  };

  const applyLanguage = async (lang: "original" | "en" | "hi") => {
    if (!scribble) return;
    if (lang === "original") {
      translateControllerRef.current?.abort();
      translateControllerRef.current = null;
      setSelectedLanguage("original");
      setModeContent((p) => ({ ...p, translate: "" }));
      setEditedText(scribble.edited_text || scribble.original_formatted_text || "");
      return;
    }
    const baseScribble = getBaseText();
    if (!baseScribble) return;
    if (isTranslating && translateControllerRef.current) translateControllerRef.current.abort();

    const key = `${lang}|${baseScribble}`;
    const cached = translationCacheRef.current.get(key);
    if (cached) {
      setSelectedLanguage(lang);
      setModeContent((p) => ({ ...p, translate: cached }));
      setEditedText(cached);
      return;
    }
    const controller = new AbortController();
    translateControllerRef.current = controller;
    setIsTranslating(true);
    try {
      const res = await aiService.translateText(baseScribble, lang, controller.signal);
      if (!res.success) {
        if (controller.signal.aborted) return;
        toast({
          title: "Translation failed",
          description: res.error || "Could not translate right now.",
          variant: "destructive",
        });
        if (res.error?.toLowerCase().includes("sign in")) router.push(ROUTES.AUTH);
        return;
      }
      const text = res.translatedText || "";
      translationCacheRef.current.set(key, text);
      setSelectedLanguage(lang);
      setModeContent((p) => ({ ...p, translate: text }));
      setEditedText(text);
    } finally {
      setIsTranslating(false);
      if (translateControllerRef.current === controller) translateControllerRef.current = null;
    }
  };

  const handleSaveEdit = async () => {
    if (!scribble || !editedText) return;
    // Reshape views (bullets/summary/email/translate) are derived, session-only
    // representations. Blurring the textarea in one of those modes must NOT
    // overwrite the canonical edited_text — persist to the in-memory mode buffer
    // instead. Only the normal view is the note.
    if (activeMode !== "normal") {
      setModeContent((p) => ({ ...p, [activeMode]: editedText }));
      return;
    }
    setIsSaving(true);
    const { error } = await scribblesService.updateScribble(scribble.id, { edited_text: editedText });
    if (error) {
      toast({ title: "Save failed", variant: "destructive" });
    } else {
      setScribble({ ...scribble, edited_text: editedText });
      invalidateLibrary();
    }
    setIsSaving(false);
  };

  const currentText = () =>
    activeMode === "normal"
      ? editedText || scribble?.edited_text || scribble?.original_formatted_text || ""
      : modeContent[activeMode] ||
        editedText ||
        scribble?.edited_text ||
        scribble?.original_formatted_text ||
        "";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(currentText());
    toast({ title: "Copied", description: "Scribble copied to clipboard." });
  };

  const handleDownload = () => {
    if (!scribble) return;
    const blob = new Blob([currentText()], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${scribble.title.replace(/[^a-z0-9]/gi, "_")}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadMarkdown = () => {
    if (!scribble) return;
    const date = new Date(scribble.created_at).toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const md = `# ${scribble.title || "Untitled Scribble"}\n\n_${date}_\n\n---\n\n${currentText()}`;
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${scribble.title.replace(/[^a-z0-9]/gi, "_")}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrintPDF = () => window.print();

  const handleToggleStar = async () => {
    if (!scribble || isStarring) return;
    const current = scribble;
    const next = !current.is_starred;
    setIsStarring(true);
    setScribble((p) => (p ? { ...p, is_starred: next } : p));
    const { data, error } = await scribblesService.toggleStar(current.id, next);
    if (error || !data) {
      setScribble((p) => (p ? { ...p, is_starred: current.is_starred } : p));
      toast({ title: "Failed to update star", variant: "destructive" });
    } else {
      setScribble((p) => (p ? { ...p, is_starred: data.is_starred } : p));
      invalidateLibrary();
    }
    setIsStarring(false);
  };

  const handleFeedbackSubmit = async (helpful: boolean, reasons?: FeedbackReason[]) => {
    if (!scribble) return;
    setIsFeedbackSubmitting(true);
    const { success, error } = await feedbackService.submitFeedback(scribble.id, helpful, reasons);
    if (error || !success) {
      toast({ title: "Feedback failed", variant: "destructive" });
    } else {
      setHasFeedbackSubmitted(true);
      setFeedbackValue(helpful);
      toast({ title: "Thanks!", description: "Your feedback helps us improve." });
    }
    setIsFeedbackSubmitting(false);
  };

  if (isLoading) {
    return (
      <main className="min-h-screen px-6 md:px-14 pt-10 pb-24" style={{ background: v2.cream }}>
        <ScribbleEditorSkeleton />
      </main>
    );
  }

  if (!scribble) return null;

  return (
    <main style={{ background: v2.cream, color: v2.ink, minHeight: "100vh", fontFamily: "var(--font-figtree), system-ui" }}>
      <header
        className="flex items-center justify-between px-6 md:px-14 py-6"
        style={{ borderBottom: `1px solid ${v2.rule}` }}
      >
        <div className="flex items-center gap-6">
          <V2Wordmark />
          <Link href="/scribble">
            <V2Caps>← BACK TO LIBRARY</V2Caps>
          </Link>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleToggleStar}
            className="rounded-full p-2"
            style={{ color: scribble.is_starred ? v2.accent : v2.inkFaint }}
            title={scribble.is_starred ? "Unstar" : "Star"}
          >
            <Star className="h-4 w-4" style={scribble.is_starred ? { fill: v2.accent } : undefined} />
          </button>
          <button
            onClick={handleCopy}
            className="text-[12px] rounded-full px-3.5 py-1.5 inline-flex items-center gap-1.5"
            style={{ color: v2.inkSoft, border: `1px solid ${v2.rule}` }}
          >
            <Copy className="h-3 w-3" /> Copy
          </button>
          <button
            onClick={handleDownload}
            className="text-[12px] rounded-full px-3.5 py-1.5 inline-flex items-center gap-1.5"
            style={{ color: v2.inkSoft, border: `1px solid ${v2.rule}` }}
          >
            <Download className="h-3 w-3" /> .txt
          </button>
          <button
            onClick={handleDownloadMarkdown}
            className="text-[12px] rounded-full px-3.5 py-1.5 inline-flex items-center gap-1.5"
            style={{ color: v2.inkSoft, border: `1px solid ${v2.rule}` }}
          >
            <FileCode className="h-3 w-3" /> .md
          </button>
          <button
            onClick={handlePrintPDF}
            className="text-[12px] rounded-full px-3.5 py-1.5 inline-flex items-center gap-1.5"
            style={{ color: v2.inkSoft, border: `1px solid ${v2.rule}` }}
          >
            <Printer className="h-3 w-3" /> Print
          </button>
          <button
            onClick={() => setIsShareModalOpen(true)}
            className="text-[12px] rounded-full px-3.5 py-1.5 inline-flex items-center gap-1.5"
            style={{ color: v2.inkSoft, border: `1px solid ${v2.rule}` }}
          >
            <Share2 className="h-3 w-3" /> Share
          </button>
          <ShareDialog
            kind="scribble"
            id={scribble.id}
            visibility={scribble.visibility ?? (scribble.shared_with_org ? "org" : "private")}
            publicShareToken={scribble.public_share_token ?? null}
            allowOrgShare={hasTeam}
            onChange={(next) =>
              setScribble((prev) =>
                prev
                  ? {
                      ...prev,
                      visibility: next.visibility,
                      public_share_token: next.public_share_token,
                      shared_with_org: next.visibility !== "private",
                    }
                  : prev
              )
            }
          />
          {scribble.shared_with_org && hasTeam && (
            <PublishDialog
              scribbleId={scribble.id}
              scribbleTitle={scribble.title || "Scribble"}
              shared={scribble.shared_with_org ?? false}
              bodyOverride={editedText || undefined}
            />
          )}
          {isSaving && <Spinner className="w-4 h-4" />}
        </div>
      </header>

      <article className="px-6 md:px-14 py-10 md:py-14">
        <V2Caps>
          SCRIBBLE · {formatDate(scribble.created_at)}
          {scribble.folder ? ` · IN ${scribble.folder.toUpperCase()}` : ""}
        </V2Caps>
        <h1
          className="mt-3"
          style={{
            fontFamily: v2Serif,
            fontSize: "clamp(40px, 6vw, 60px)",
            lineHeight: 1.0,
            letterSpacing: "-0.025em",
            fontWeight: 500,
            maxWidth: 940,
          }}
        >
          {scribble.title || (
            <em style={{ fontStyle: "italic", color: v2.accent }}>Untitled Scribble</em>
          )}
        </h1>

        <div className="mt-10 grid grid-cols-12 gap-8 md:gap-14">
          <div
            className="col-span-12 lg:col-span-7"
            style={{ borderRight: `1px solid ${v2.rule}`, paddingRight: 0 }}
          >
            <div className="flex items-center gap-3 flex-wrap mb-5">
              <V2Caps>{activeTab === "transcript" ? "YOUR VOICE · UNEDITED" : "SCRIBBLE"}</V2Caps>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => setActiveTab("scribble")}
                  className="rounded-full px-3 py-1 text-[11px] font-medium"
                  style={{
                    background: activeTab === "scribble" ? v2.ink : "transparent",
                    color: activeTab === "scribble" ? v2.cream : v2.inkSoft,
                    border: `1px solid ${activeTab === "scribble" ? v2.ink : v2.rule}`,
                  }}
                >
                  Scribble
                </button>
                <button
                  onClick={() => setActiveTab("transcript")}
                  className="rounded-full px-3 py-1 text-[11px] font-medium"
                  style={{
                    background: activeTab === "transcript" ? v2.ink : "transparent",
                    color: activeTab === "transcript" ? v2.cream : v2.inkSoft,
                    border: `1px solid ${activeTab === "transcript" ? v2.ink : v2.rule}`,
                  }}
                >
                  Raw
                </button>
              </div>
            </div>

            {activeTab === "transcript" ? (
              <div
                className="space-y-5 pr-0 md:pr-12"
                style={{
                  fontFamily: v2Serif,
                  fontSize: 19,
                  lineHeight: 1.65,
                  color: v2.ink,
                }}
              >
                {(scribble.raw_text || "No transcript available.").split("\n").map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            ) : (
              <textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                onBlur={handleSaveEdit}
                placeholder="Your Scribble will appear here..."
                className="w-full bg-transparent outline-none resize-none pr-0 md:pr-12"
                style={{
                  fontFamily: v2Serif,
                  fontSize: 19,
                  lineHeight: 1.65,
                  color: v2.ink,
                  minHeight: 480,
                }}
              />
            )}

            <div className="mt-8 pt-6 flex justify-end" style={{ borderTop: `1px solid ${v2.rule}` }}>
              <button
                onClick={() => {
                  const raw = scribble.raw_text;
                  if (!raw) {
                    toast({
                      title: "Error",
                      description: "Original recording not found.",
                      variant: "destructive",
                    });
                    return;
                  }
                  storageService.updateRawText(raw);
                  storageService.setCurrentScribbleId(scribble.id);
                  storageService.setContinueMode(true);
                  router.push("/recording");
                }}
                className="rounded-full px-4 py-2 text-[12px] inline-flex items-center gap-2"
                style={{ background: v2.accentSoft, color: v2.accent }}
              >
                <Mic className="h-3 w-3" />
                Continue Recording
              </button>
            </div>
          </div>

          <aside className="col-span-12 lg:col-span-5 space-y-9">
            <div className="flex items-center gap-3">
              <V2Caps color={v2.accent} size={11}>
                OSCAR&rsquo;S MARGIN
              </V2Caps>
              <span style={{ flex: 1, height: 1, background: v2.rule }} />
            </div>

            <div>
              <V2Caps>ASK OSCAR TO RESHAPE</V2Caps>
              <div
                className="mt-3 rounded-md p-5"
                style={{ background: v2.cream2 }}
              >
                <div className="grid grid-cols-1 gap-2.5">
                  {MODES.map((m) => {
                    const isActive = activeMode === m.id;
                    return (
                      <button
                        key={m.id}
                        onClick={() => void handleSelectMode(m.id)}
                        className="flex items-center gap-3 py-1.5 text-left"
                        style={{ color: isActive ? v2.accent : v2.ink, fontSize: 13 }}
                      >
                        <span style={{ color: v2.accent }}>→</span>
                        {isLoadingMode && isActive ? <Spinner className="w-3.5 h-3.5" /> : <m.icon className="h-3.5 w-3.5" />}
                        <span style={{ fontWeight: isActive ? 500 : 400 }}>{m.label}</span>
                        <V2Mono style={{ fontSize: 10, color: v2.inkFaint, marginLeft: "auto" }}>
                          {m.desc}
                        </V2Mono>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {activeMode === "translate" && (
              <div>
                <V2Caps>LANGUAGE</V2Caps>
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  {[
                    { id: "original" as const, label: "Original" },
                    { id: "en" as const, label: "English" },
                    { id: "hi" as const, label: "Hindi" },
                  ].map((l) => (
                    <button
                      key={l.id}
                      onClick={() => applyLanguage(l.id)}
                      disabled={isTranslating && selectedLanguage !== l.id}
                      className="rounded-full px-4 py-1.5 text-[12px] font-medium transition disabled:opacity-50"
                      style={{
                        background: selectedLanguage === l.id ? v2.ink : "transparent",
                        color: selectedLanguage === l.id ? v2.cream : v2.inkSoft,
                        border: `1px solid ${selectedLanguage === l.id ? v2.ink : v2.rule}`,
                      }}
                    >
                      {isTranslating && selectedLanguage === l.id ? (
                        <Spinner className="w-3 h-3" />
                      ) : (
                        l.label
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <V2Caps>FEEDBACK</V2Caps>
              <div className="mt-3">
                <FeedbackWidget
                  onSubmit={handleFeedbackSubmit}
                  isSubmitting={isFeedbackSubmitting}
                  hasSubmitted={hasFeedbackSubmitted}
                  submittedValue={feedbackValue}
                />
              </div>
            </div>
          </aside>
        </div>
      </article>

      {isShareModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div
            className="absolute inset-0"
            style={{ background: "rgba(15,13,10,0.55)" }}
            onClick={() => setIsShareModalOpen(false)}
          />
          <div
            className="relative w-full max-w-md rounded-2xl p-6 shadow-2xl"
            style={{ background: v2.cream, border: `1px solid ${v2.rule}`, color: v2.ink }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <V2Caps color={v2.accent}>SHARE</V2Caps>
                <h3
                  className="mt-1"
                  style={{
                    fontFamily: v2Serif,
                    fontSize: 24,
                    fontWeight: 500,
                    letterSpacing: "-0.01em",
                  }}
                >
                  Send this Scribble
                </h3>
              </div>
              <button
                onClick={() => setIsShareModalOpen(false)}
                style={{ color: v2.inkFaint }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="mt-2">
              <V2Caps>EMAIL SUBJECT</V2Caps>
              <input
                type="text"
                value={shareSubject ?? (scribble.title || "Untitled Scribble")}
                onChange={(e) => setShareSubject(e.target.value)}
                className="mt-2 w-full bg-transparent outline-none py-2 text-[14px]"
                style={{ borderBottom: `1px solid ${v2.ruleHard}`, color: v2.ink, fontFamily: v2Mono }}
              />
            </div>

            <div className="mt-5 grid grid-cols-1 gap-2.5">
              <button
                onClick={() => {
                  const bodyText = activeMode === "normal" ? editedText || "" : modeContent[activeMode] || editedText || "";
                  const payload = `${scribble.title || "Untitled Scribble"}\n\n${bodyText}`.trim();
                  window.open(`https://wa.me/?text=${encodeURIComponent(payload)}`, "_blank", "noopener,noreferrer");
                  setIsShareModalOpen(false);
                }}
                className="w-full flex items-center gap-3 py-3 px-4 rounded-lg text-left"
                style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}
              >
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp</span>
              </button>
              <button
                onClick={() => {
                  const subject = encodeURIComponent(shareSubject ?? (scribble.title || "Untitled Scribble"));
                  const bodyText = activeMode === "normal" ? editedText || "" : modeContent[activeMode] || editedText || "";
                  const body = encodeURIComponent(bodyText);
                  window.open(
                    `https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}&tf=1`,
                    "_blank",
                    "noopener,noreferrer"
                  );
                  setIsShareModalOpen(false);
                }}
                className="w-full flex items-center gap-3 py-3 px-4 rounded-lg text-left"
                style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}
              >
                <Mail className="w-4 h-4" />
                <span>Gmail</span>
              </button>
              <button
                onClick={() => {
                  const subject = encodeURIComponent(shareSubject ?? (scribble.title || "Untitled Scribble"));
                  const bodyText = activeMode === "normal" ? editedText || "" : modeContent[activeMode] || editedText || "";
                  const body = encodeURIComponent(bodyText);
                  window.location.href = `mailto:?subject=${subject}&body=${body}`;
                  setIsShareModalOpen(false);
                }}
                className="w-full flex items-center gap-3 py-3 px-4 rounded-lg text-left"
                style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}
              >
                <Mail className="w-4 h-4" />
                <span>Email · default client</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
