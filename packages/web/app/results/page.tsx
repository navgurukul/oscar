"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useScribbleStorage } from "@/lib/hooks/useScribbleStorage";
import { useAIEmailFormatting } from "@/lib/hooks/useAIEmailFormatting";
import { useAuth } from "@/lib/contexts/AuthContext";
import { storageService } from "@/lib/services/storage.service";
import { scribblesService } from "@/lib/services/scribbles.service";
import { queryKeys } from "@/lib/hooks/queries/keys";
import { feedbackService } from "@/lib/services/feedback.service";
import { aiService } from "@/lib/services/ai.service";
import { Spinner } from "@/components/ui/spinner";
import { ROUTES, UI_STRINGS } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import type { FeedbackReason } from "@/lib/types/scribble.types";
import {
  Mail,
  MessageCircle,
  Share2,
  FileText,
  Languages,
  ListChecks,
  BookOpen,
  Star,
} from "lucide-react";
import { FeedbackWidget } from "@/components/results/FeedbackWidget";
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
  { id: "normal", icon: FileText, label: "Scribble", desc: "Clean working draft" },
  { id: "email", icon: Mail, label: "Email", desc: "Send-ready" },
  { id: "bullets", icon: ListChecks, label: "Bullets", desc: "Key points" },
  { id: "summary", icon: BookOpen, label: "Summary", desc: "Condensed" },
  { id: "translate", icon: Languages, label: "Translate", desc: "Language" },
];

export default function ResultsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { isLoading, formattedScribble, rawText, title, updateFormattedScribble } =
    useScribbleStorage();

  // Keep the library's React Query cache in sync after a write so the saved /
  // re-filed scribble shows up in /scribble without a hard refresh.
  const invalidateLibrary = (includeFolders = false) => {
    void qc.invalidateQueries({ queryKey: queryKeys.scribbles });
    if (includeFolders) void qc.invalidateQueries({ queryKey: queryKeys.folders });
  };

  const [editedText, setEditedText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [scribbleId, setScribbleId] = useState<string | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareSubject, setShareSubject] = useState<string | null>(null);
  const { formatText: gmailFormatText } = useAIEmailFormatting();
  const [isScribbleSaved, setIsScribbleSaved] = useState(false);
  const [isStarred, setIsStarred] = useState(false);

  const [activeMode, setActiveMode] = useState<Mode>("normal");
  const [modeContent, setModeContent] = useState<Record<string, string>>({});
  const [modeSource, setModeSource] = useState<Record<string, string>>({});
  const [isLoadingMode, setIsLoadingMode] = useState(false);
  const [activeTab, setActiveTab] = useState<"scribble" | "transcript">("scribble");

  const [selectedLanguage, setSelectedLanguage] = useState<"original" | "en" | "hi">("original");
  const [isTranslating, setIsTranslating] = useState(false);
  const translationCacheRef = useRef<Map<string, string>>(new Map());
  const translateControllerRef = useRef<AbortController | null>(null);

  const [isFeedbackSubmitting, setIsFeedbackSubmitting] = useState(false);
  const [hasFeedbackSubmitted, setHasFeedbackSubmitted] = useState(false);
  const [feedbackValue, setFeedbackValue] = useState<boolean | null>(null);

  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [availableFolders, setAvailableFolders] = useState<string[]>([]);
  const [newFolderName, setNewFolderName] = useState("");

  useEffect(() => {
    const stored = storageService.getCurrentScribbleId();
    if (stored) {
      setScribbleId(stored);
      void loadScribbleDetails(stored);
    }
    void loadAvailableFolders();
  }, []);

  const loadScribbleDetails = async (id: string) => {
    const { data, error } = await scribblesService.getScribbleById(id);
    if (!error && data) {
      setSelectedFolder(data.folder);
      setIsStarred(data.is_starred ?? false);
    }
  };

  const loadAvailableFolders = async () => {
    const { data, error } = await scribblesService.getFolders();
    if (!error && data) setAvailableFolders(data);
  };

  useEffect(() => {
    if (formattedScribble) setEditedText(formattedScribble);
  }, [formattedScribble]);

  useEffect(() => {
    setSelectedLanguage("original");
    setModeContent({});
    setModeSource({});
    setActiveMode("normal");
  }, [formattedScribble, rawText, title]);

  useEffect(() => {
    if (!isLoading && !formattedScribble && !rawText) router.push(ROUTES.HOME);
  }, [isLoading, formattedScribble, rawText, router]);

  const getBaseText = () => {
    if (activeMode === "normal") return editedText || formattedScribble || rawText || "";
    return formattedScribble || rawText || "";
  };

  const handleSelectMode = async (next: Mode) => {
    if (next === "normal") {
      setActiveMode("normal");
      setEditedText(formattedScribble || "");
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
      const res = await gmailFormatText(baseText, title || UI_STRINGS.UNTITLED_SCRIBBLE);
      result = res.success ? res.formattedText || baseText : baseText;
    } else {
      const res = await aiService.transformText(baseText, next, title || UI_STRINGS.UNTITLED_SCRIBBLE);
      result = res.success ? res.formattedText || baseText : baseText;
    }
    setModeContent((p) => ({ ...p, [next]: result }));
    setModeSource((p) => ({ ...p, [next]: baseText }));
    setEditedText(result);
    setIsLoadingMode(false);
  };

  const applyLanguage = async (lang: "original" | "en" | "hi") => {
    if (lang === "original") {
      translateControllerRef.current?.abort();
      translateControllerRef.current = null;
      setSelectedLanguage("original");
      setModeContent((p) => ({ ...p, translate: "" }));
      setEditedText(formattedScribble || "");
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
          description: res.error || "Could not translate.",
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

  const currentText = () =>
    activeMode === "normal"
      ? editedText || ""
      : modeContent[activeMode] || editedText || "";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(currentText());
    toast({ title: "Copied", description: "Scribble copied to clipboard." });
  };

  const handleDownload = () => {
    const blob = new Blob([currentText()], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = UI_STRINGS.SCRIBBLE_FILENAME;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSaveEdit = async () => {
    if (!editedText) return;
    if (!scribbleId) {
      updateFormattedScribble(editedText);
      if (activeMode !== "normal") setModeContent((p) => ({ ...p, [activeMode]: editedText }));
      return;
    }
    setIsSaving(true);
    const { error } = await scribblesService.updateScribble(scribbleId, { edited_text: editedText });
    if (error) toast({ title: "Save failed", variant: "destructive" });
    else {
      updateFormattedScribble(editedText);
      if (activeMode !== "normal") setModeContent((p) => ({ ...p, [activeMode]: editedText }));
      invalidateLibrary();
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
      if (scribbleId) {
        saveResult = await scribblesService.updateScribble(scribbleId, {
          title: title || "Untitled Scribble",
          raw_text: rawText || "",
          original_formatted_text: formattedScribble || "",
          edited_text: editedText || undefined,
        });
      } else {
        const quotaRes = await fetch("/api/usage/check?type=scribble");
        if (quotaRes.status === 402) {
          const data = await quotaRes.json();
          toast({
            title: "Scribble limit reached",
            description: data.message || "Upgrade for unlimited scribbles.",
            variant: "destructive",
          });
          setIsSaving(false);
          return;
        }
        saveResult = await scribblesService.createScribble({
          user_id: user.id,
          title: title || "Untitled Scribble",
          raw_text: rawText || "",
          original_formatted_text: formattedScribble || "",
        });
      }
      const { data, error } = saveResult;
      if (error) throw error;
      if (data) {
        setScribbleId(data.id);
        storageService.setCurrentScribbleId(data.id);
        setIsScribbleSaved(true);
        invalidateLibrary(true);
        toast({ title: "Saved", description: "Scribble saved to the cloud." });
      }
    } catch (err) {
      console.error("Save failed:", err);
      toast({
        title: "Save failed",
        description:
          err instanceof Error && err.message ? err.message : "Could not save.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStar = async () => {
    if (!scribbleId) {
      toast({ title: "Save first", description: "Star a Scribble after saving.", variant: "destructive" });
      return;
    }
    const next = !isStarred;
    setIsStarred(next);
    const { error } = await scribblesService.toggleStar(scribbleId, next);
    if (error) {
      setIsStarred(!next);
      toast({ title: "Failed to star", variant: "destructive" });
    } else {
      invalidateLibrary();
    }
  };

  const handleUpdateFolder = async (folderName: string | null) => {
    if (!scribbleId) return;
    const { error } = await scribblesService.updateScribble(scribbleId, { folder: folderName });
    if (error) {
      toast({ title: "Folder update failed", variant: "destructive" });
    } else {
      setSelectedFolder(folderName);
      if (folderName && !availableFolders.includes(folderName)) {
        setAvailableFolders([...availableFolders, folderName]);
      }
      invalidateLibrary(true);
      toast({ title: folderName ? `Filed to ${folderName}` : "Removed from folder" });
    }
  };

  const handleFeedbackSubmit = async (helpful: boolean, reasons?: FeedbackReason[]) => {
    if (!scribbleId) {
      toast({ title: "Save first", variant: "destructive" });
      return;
    }
    setIsFeedbackSubmitting(true);
    const { success, error } = await feedbackService.submitFeedback(scribbleId, helpful, reasons);
    if (error || !success) toast({ title: "Feedback failed", variant: "destructive" });
    else {
      setHasFeedbackSubmitted(true);
      setFeedbackValue(helpful);
      toast({ title: "Thanks!" });
    }
    setIsFeedbackSubmitting(false);
  };

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: v2.cream }}>
        <Spinner />
      </main>
    );
  }

  const displayText =
    activeMode === "normal" ? editedText : modeContent[activeMode] || editedText;

  return (
    <main style={{ background: v2.cream, color: v2.ink, minHeight: "100vh", fontFamily: "var(--font-figtree), system-ui" }}>
      <header
        className="flex items-center justify-between px-6 md:px-14 py-6"
        style={{ borderBottom: `1px solid ${v2.rule}` }}
      >
        <div className="flex items-center gap-6">
          <V2Wordmark />
          <Link href="/scribble">
            <V2Caps>← LIBRARY</V2Caps>
          </Link>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {scribbleId && (
            <button
              onClick={() => void handleToggleStar()}
              className="rounded-full p-2"
              style={{ color: isStarred ? v2.accent : v2.inkFaint }}
              title={isStarred ? "Unstar" : "Star"}
            >
              <Star className="h-4 w-4" style={isStarred ? { fill: v2.accent } : undefined} />
            </button>
          )}
          <button
            onClick={handleCopy}
            className="text-[12px] rounded-full px-3.5 py-1.5"
            style={{ color: v2.inkSoft, border: `1px solid ${v2.rule}` }}
          >
            Copy
          </button>
          <button
            onClick={handleDownload}
            className="text-[12px] rounded-full px-3.5 py-1.5"
            style={{ color: v2.inkSoft, border: `1px solid ${v2.rule}` }}
          >
            Download
          </button>
          <button
            onClick={() => {
              setShareSubject(title || UI_STRINGS.UNTITLED_SCRIBBLE);
              setIsShareModalOpen(true);
            }}
            className="text-[12px] rounded-full px-3.5 py-1.5 inline-flex items-center gap-1.5"
            style={{ color: v2.inkSoft, border: `1px solid ${v2.rule}` }}
          >
            <Share2 className="h-3 w-3" /> Share
          </button>
          {!isScribbleSaved && (
            <button
              onClick={() => void handleSaveToDatabase()}
              disabled={isSaving}
              className="text-[12px] rounded-full px-4 py-1.5 font-medium disabled:opacity-50"
              style={{ background: v2.ink, color: v2.cream }}
            >
              {isSaving ? "Saving…" : "Save Scribble"}
            </button>
          )}
        </div>
      </header>

      <article className="px-6 md:px-14 pt-12 md:pt-14 pb-20 mx-auto" style={{ maxWidth: 1180 }}>
        <V2Caps color={v2.accent}>READY · CLEAN COPY</V2Caps>
        <h1
          className="mt-3"
          style={{
            fontFamily: v2Serif,
            fontSize: "clamp(40px, 6vw, 60px)",
            lineHeight: 1.0,
            letterSpacing: "-0.025em",
            fontWeight: 500,
          }}
        >
          {title || (
            <em style={{ fontStyle: "italic", color: v2.accent }}>{UI_STRINGS.RESULTS_TITLE}</em>
          )}
        </h1>

        <div className="mt-10 grid grid-cols-12 gap-8 md:gap-14">
          <div
            className="col-span-12 lg:col-span-8"
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
                className="space-y-5 pr-0 md:pr-10"
                style={{ fontFamily: v2Serif, fontSize: 18, lineHeight: 1.65, color: v2.ink }}
              >
                {(rawText || "No transcript available.").split("\n").map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            ) : (
              <textarea
                value={displayText || ""}
                onChange={(e) => setEditedText(e.target.value)}
                onBlur={handleSaveEdit}
                placeholder="Your Scribble will appear here..."
                className="w-full bg-transparent outline-none resize-none pr-0 md:pr-10"
                style={{
                  fontFamily: v2Serif,
                  fontSize: 18,
                  lineHeight: 1.65,
                  color: v2.ink,
                  minHeight: 360,
                }}
              />
            )}
          </div>

          <aside className="col-span-12 lg:col-span-4 space-y-8">
            <div>
              <V2Caps color={v2.accent}>OSCAR&rsquo;S MARGIN</V2Caps>
              <p
                className="mt-3"
                style={{ fontFamily: v2Serif, fontSize: 21, lineHeight: 1.4, letterSpacing: "-0.005em" }}
              >
                Cleaned and titled. <em style={{ fontStyle: "italic", color: v2.accent }}>Save it</em> to
                organize, share, or reshape.
              </p>
            </div>

            <div>
              <V2Caps>RESHAPE</V2Caps>
              <div
                className="mt-3 rounded-md p-4"
                style={{ background: v2.cream2 }}
              >
                {MODES.map((m) => {
                  const isActive = activeMode === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => void handleSelectMode(m.id)}
                      className="flex items-center gap-3 py-1.5 w-full text-left"
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
                      {isTranslating && selectedLanguage === l.id ? <Spinner className="w-3 h-3" /> : l.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {scribbleId && (
              <div>
                <V2Caps>FOLDER</V2Caps>
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  {selectedFolder ? (
                    <button
                      onClick={() => handleUpdateFolder(null)}
                      className="rounded-full px-3 py-1.5 text-[12px] inline-flex items-center gap-2"
                      style={{ background: v2.accentSoft, color: v2.accent }}
                    >
                      {selectedFolder}
                      <span style={{ opacity: 0.7 }}>×</span>
                    </button>
                  ) : (
                    <span className="text-[12px]" style={{ color: v2.inkFaint }}>
                      Not filed yet
                    </span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {availableFolders
                    .filter((f) => f !== selectedFolder)
                    .map((f) => (
                      <button
                        key={f}
                        onClick={() => handleUpdateFolder(f)}
                        className="rounded-full px-3 py-1 text-[11px]"
                        style={{ border: `1px solid ${v2.rule}`, color: v2.inkSoft }}
                      >
                        {f}
                      </button>
                    ))}
                  <div className="flex items-center gap-1">
                    <input
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newFolderName.trim()) {
                          handleUpdateFolder(newFolderName.trim());
                          setNewFolderName("");
                        }
                      }}
                      placeholder="+ new folder"
                      className="bg-transparent outline-none text-[11px] px-2 py-1"
                      style={{ borderBottom: `1px solid ${v2.rule}`, width: 120, color: v2.ink }}
                    />
                  </div>
                </div>
              </div>
            )}

            {scribbleId && (
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
            )}
          </aside>
        </div>

        <div
          className="mt-14 pt-7 flex items-center justify-between flex-wrap gap-3"
          style={{ borderTop: `1px solid ${v2.rule}` }}
        >
          <V2Caps>{isScribbleSaved ? "SAVED · ALL CHANGES SYNCED" : "READY TO SAVE"}</V2Caps>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => router.push("/recording")}
              className="text-[13px] rounded-full px-4 py-2"
              style={{ border: `1px solid ${v2.rule}`, color: v2.inkSoft }}
            >
              Discard & record again
            </button>
            {!isScribbleSaved && (
              <button
                onClick={() => void handleSaveToDatabase()}
                disabled={isSaving}
                className="text-[13px] rounded-full px-5 py-2.5 font-medium disabled:opacity-50"
                style={{ background: v2.ink, color: v2.cream }}
              >
                {isSaving ? "Saving…" : "Save Scribble"}
              </button>
            )}
            {isScribbleSaved && (
              <Link
                href="/scribble"
                className="text-[13px] rounded-full px-5 py-2.5 font-medium"
                style={{ background: v2.ink, color: v2.cream }}
              >
                Open library →
              </Link>
            )}
          </div>
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
              <button onClick={() => setIsShareModalOpen(false)} style={{ color: v2.inkFaint }}>
                ✕
              </button>
            </div>

            <div className="mt-2">
              <V2Caps>EMAIL SUBJECT</V2Caps>
              <input
                value={shareSubject ?? (title || UI_STRINGS.UNTITLED_SCRIBBLE)}
                onChange={(e) => setShareSubject(e.target.value)}
                className="mt-2 w-full bg-transparent outline-none py-2 text-[14px]"
                style={{ borderBottom: `1px solid ${v2.ruleHard}`, color: v2.ink, fontFamily: v2Mono }}
              />
            </div>

            <div className="mt-5 grid grid-cols-1 gap-2.5">
              <button
                onClick={() => {
                  const payload = `${title || ""}\n\n${currentText()}`.trim();
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
                  const subject = encodeURIComponent(shareSubject ?? (title || UI_STRINGS.UNTITLED_SCRIBBLE));
                  const body = encodeURIComponent(currentText());
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
                  const subject = encodeURIComponent(shareSubject ?? (title || UI_STRINGS.UNTITLED_SCRIBBLE));
                  const body = encodeURIComponent(currentText());
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
