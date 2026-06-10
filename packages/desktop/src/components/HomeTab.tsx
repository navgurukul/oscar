import { useMemo, useState } from "react";
import { Copy, FilePlus2, Check, MessageSquarePlus } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import type { LocalTranscript } from "../types/scribble.types";

interface HomeTabProps {
  userName: string;
  userId: string;
  totalScribbles?: number;
  localTranscripts: LocalTranscript[];
  onDeleteTranscript: (id: string) => void;
  onClearAllTranscripts: () => void;
  onSaveAsScribble?: (transcript: LocalTranscript) => Promise<void> | void;
  /** Persist free-text feedback for a dictation (writes a stream row). */
  onSubmitFeedback?: (
    transcript: LocalTranscript,
    feedback: string,
  ) => Promise<void> | void;
}

function Caps({
  children,
  className = "",
  tone = "faint",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "faint" | "ink" | "terra";
}) {
  const toneClass =
    tone === "terra"
      ? "text-terracotta"
      : tone === "ink"
        ? "text-ink"
        : "text-ink-faint";
  return (
    <span
      className={`font-mono text-[10px] tracking-[0.18em] uppercase ${toneClass} ${className}`}
    >
      {children}
    </span>
  );
}

function formatHeroDate(d: Date) {
  const day = d.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase();
  const month = d.toLocaleDateString(undefined, { month: "short" }).toUpperCase();
  const date = d.getDate();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${day} · ${month} ${date} · ${time}`;
}

function formatEventTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function sourceLabel(t: LocalTranscript): string {
  if (t.dictation_app_key) return t.dictation_app_key.replace(/[-_]/g, " ").toUpperCase();
  return "DICTATED";
}

function isFresh(iso: string): boolean {
  const created = new Date(iso).getTime();
  return Date.now() - created < 60_000;
}

function HomeTab({
  userName,
  totalScribbles,
  localTranscripts,
  onDeleteTranscript,
  onClearAllTranscripts,
  onSaveAsScribble,
  onSubmitFeedback,
}: HomeTabProps) {
  const firstName = userName?.split(" ")[0] || "";
  const today = new Date();
  const heroLabel = formatHeroDate(today);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  // Per-row feedback state: which row's box is open, its draft text, and the
  // in-flight / just-sent row ids (keyed by transcript id like copy/save above).
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSubmittingId, setFeedbackSubmittingId] = useState<string | null>(
    null,
  );
  const [feedbackSentId, setFeedbackSentId] = useState<string | null>(null);

  const openFeedback = (t: LocalTranscript) => {
    setFeedbackId(t.id);
    setFeedbackText("");
  };

  const cancelFeedback = () => {
    setFeedbackId(null);
    setFeedbackText("");
  };

  const submitFeedback = async (t: LocalTranscript) => {
    const trimmed = feedbackText.trim();
    if (!onSubmitFeedback || !trimmed || feedbackSubmittingId) return;
    setFeedbackSubmittingId(t.id);
    try {
      await onSubmitFeedback(t, trimmed);
      setFeedbackId(null);
      setFeedbackText("");
      setFeedbackSentId(t.id);
      window.setTimeout(() => {
        setFeedbackSentId((curr) => (curr === t.id ? null : curr));
      }, 2000);
    } catch (e) {
      console.warn("[home] submit feedback failed:", e);
    } finally {
      setFeedbackSubmittingId((curr) => (curr === t.id ? null : curr));
    }
  };

  const handleCopy = async (t: LocalTranscript) => {
    try {
      await invoke("copy_to_clipboard", { text: t.text });
    } catch (e) {
      console.warn("[home] copy failed:", e);
    }
    setCopiedId(t.id);
    window.setTimeout(() => {
      setCopiedId((curr) => (curr === t.id ? null : curr));
    }, 1500);
  };

  const handleSaveAsScribble = async (t: LocalTranscript) => {
    if (!onSaveAsScribble || savingId) return;
    setSavingId(t.id);
    try {
      await onSaveAsScribble(t);
      setSavedId(t.id);
      window.setTimeout(() => {
        setSavedId((curr) => (curr === t.id ? null : curr));
      }, 1500);
    } catch (e) {
      console.warn("[home] save as scribble failed:", e);
    } finally {
      setSavingId((curr) => (curr === t.id ? null : curr));
    }
  };

  // Aggregate stats from local transcripts
  const stats = useMemo(() => {
    const captures = localTranscripts.length;
    const sources = new Set<string>();
    let words = 0;
    for (const t of localTranscripts) {
      if (t.dictation_app_key) sources.add(t.dictation_app_key);
      words += (t.text || "").split(/\s+/).filter(Boolean).length;
    }
    return { captures, sourceCount: sources.size, words };
  }, [localTranscripts]);

  const hasCaptures = localTranscripts.length > 0;

  return (
    <div className="relative flex flex-1 flex-col overflow-y-auto bg-cream">
      <div className="mx-auto w-full max-w-[820px] px-10 pt-14 pb-24">
        {/* Editorial hero — time-spine listening surface */}
        <div className="pb-9">
          <Caps>{heroLabel}</Caps>
          <h1
            className="mt-2.5 font-serif font-medium leading-[0.98] tracking-[-0.025em] text-ink"
            style={{ fontSize: 56 }}
          >
            {firstName ? (
              <>
                Today,{" "}
                <em className="italic text-terracotta">{firstName}</em>
                <br />listened.
              </>
            ) : (
              <>
                Today, you{" "}
                <em className="italic text-terracotta">listened</em>.
              </>
            )}
          </h1>

          <p className="mt-5 max-w-md text-[14px] leading-relaxed text-ink-soft">
            {hasCaptures ? (
              <>
                {stats.captures} {stats.captures === 1 ? "capture" : "captures"}
                {stats.sourceCount > 0 ? (
                  <>
                    {" · "}
                    {stats.sourceCount} {stats.sourceCount === 1 ? "app" : "apps"}
                  </>
                ) : null}
                {stats.words > 0 ? (
                  <>
                    {" · "}
                    {stats.words.toLocaleString()} words dictated
                  </>
                ) : null}
                {typeof totalScribbles === "number" ? (
                  <>
                    {" · "}
                    {totalScribbles} in library
                  </>
                ) : null}
              </>
            ) : (
              <>Hold Ctrl+Space anywhere on screen. Oscar listens, cleans, and pastes back where you were.</>
            )}
          </p>

          <div className="mt-7 flex items-center gap-4">
            <div className="inline-flex items-center gap-2.5 rounded-full px-5 py-2.5 bg-ink text-cream">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-terracotta" />
              <span className="font-mono text-[11px] tracking-[0.06em] text-cream-200">
                CTRL+SPACE
              </span>
              <span className="text-[13px]">to listen</span>
            </div>
            <span className="text-[13px] text-ink-soft">· into any app</span>
          </div>
        </div>

        {/* Spine */}
        <div className="pt-10 border-t border-cream-300">
          <div className="flex items-baseline justify-between mb-8">
            <Caps>THE DAY, IN ORDER</Caps>
            {hasCaptures && (
              <button
                type="button"
                onClick={onClearAllTranscripts}
                className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-faint hover:text-ink-soft bg-transparent border-none cursor-pointer transition-colors"
              >
                CLEAR ALL
              </button>
            )}
          </div>

          {!hasCaptures ? (
            <div className="py-16 text-center">
              <p className="font-serif text-[20px] text-ink-soft leading-snug">
                Nothing yet today.
              </p>
              <p className="mt-2 text-[13px] text-ink-faint">
                Your captures will show up here, in time order.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {localTranscripts.map((t) => {
                const time = formatEventTime(t.createdAt);
                const source = sourceLabel(t);
                const live = isFresh(t.createdAt);
                const isCopied = copiedId === t.id;
                const isSaving = savingId === t.id;
                const isSaved = savedId === t.id;
                const isFeedbackOpen = feedbackId === t.id;
                const isFeedbackSubmitting = feedbackSubmittingId === t.id;
                const isFeedbackSent = feedbackSentId === t.id;
                return (
                  <article key={t.id} className="grid grid-cols-12 gap-4 group">
                    <div className="col-span-2 pt-0.5">
                      <span className="font-mono text-[12px] text-ink tracking-[0.02em]">
                        {time}
                      </span>
                      <div className="mt-0.5">
                        <span
                          className={`font-mono text-[9px] tracking-[0.16em] uppercase ${
                            live ? "text-terracotta" : "text-ink-faint"
                          }`}
                        >
                          {source}
                        </span>
                      </div>
                    </div>
                    <div className="col-span-10 pb-4 border-b border-cream-300">
                      <p
                        className="font-serif text-ink m-0"
                        style={{
                          fontSize: 14.5,
                          lineHeight: 1.5,
                          textWrap: "pretty" as const,
                        }}
                      >
                        {t.text}
                      </p>
                      <div className="mt-2.5 flex items-center gap-3 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => void handleCopy(t)}
                          className="inline-flex items-center gap-1.5 bg-transparent border-none p-0 cursor-pointer"
                        >
                          {isCopied ? (
                            <Check size={11} className="text-terracotta" />
                          ) : (
                            <Copy size={11} className="text-ink-soft" />
                          )}
                          <span
                            className={`font-mono text-[10px] tracking-[0.14em] uppercase transition-colors ${
                              isCopied ? "text-terracotta" : "text-ink-soft"
                            }`}
                          >
                            {isCopied ? "COPIED" : "COPY"}
                          </span>
                        </button>
                        {onSaveAsScribble && (
                          <button
                            type="button"
                            onClick={() => void handleSaveAsScribble(t)}
                            disabled={isSaving}
                            className="inline-flex items-center gap-1.5 bg-transparent border-none p-0 cursor-pointer disabled:opacity-60"
                          >
                            {isSaved ? (
                              <Check size={11} className="text-terracotta" />
                            ) : (
                              <FilePlus2 size={11} className="text-ink-faint" />
                            )}
                            <span
                              className={`font-mono text-[10px] tracking-[0.14em] uppercase transition-colors ${
                                isSaved ? "text-terracotta" : "text-ink-faint"
                              }`}
                            >
                              {isSaving ? "SAVING…" : isSaved ? "SAVED" : "SAVE"}
                            </span>
                          </button>
                        )}
                        {onSubmitFeedback && (
                          <button
                            type="button"
                            onClick={() =>
                              isFeedbackOpen ? cancelFeedback() : openFeedback(t)
                            }
                            disabled={isFeedbackSubmitting}
                            className="inline-flex items-center gap-1.5 bg-transparent border-none p-0 cursor-pointer disabled:opacity-60"
                          >
                            {isFeedbackSent ? (
                              <Check size={11} className="text-terracotta" />
                            ) : (
                              <MessageSquarePlus
                                size={11}
                                className={
                                  isFeedbackOpen
                                    ? "text-terracotta"
                                    : "text-ink-faint"
                                }
                              />
                            )}
                            <span
                              className={`font-mono text-[10px] tracking-[0.14em] uppercase transition-colors ${
                                isFeedbackSent || isFeedbackOpen
                                  ? "text-terracotta"
                                  : "text-ink-faint"
                              }`}
                            >
                              {isFeedbackSent ? "SENT" : "FEEDBACK"}
                            </span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onDeleteTranscript(t.id)}
                          className="bg-transparent border-none p-0 cursor-pointer"
                        >
                          <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-faint hover:text-terracotta transition-colors">
                            DISMISS
                          </span>
                        </button>
                      </div>
                      {isFeedbackOpen && (
                        <div className="mt-3">
                          <textarea
                            autoFocus
                            value={feedbackText}
                            onChange={(e) => setFeedbackText(e.target.value)}
                            onKeyDown={(e) => {
                              if (
                                e.key === "Enter" &&
                                (e.metaKey || e.ctrlKey)
                              ) {
                                e.preventDefault();
                                void submitFeedback(t);
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                cancelFeedback();
                              }
                            }}
                            placeholder="What worked, what didn't? Saved with this dictation's transcript."
                            rows={3}
                            className="w-full resize-none rounded-md border border-cream-300 bg-cream px-3 py-2 font-sans text-[13px] leading-relaxed text-ink outline-none focus:border-terracotta/60"
                          />
                          <div className="mt-2 flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => void submitFeedback(t)}
                              disabled={
                                isFeedbackSubmitting || !feedbackText.trim()
                              }
                              className="font-mono text-[10px] tracking-[0.14em] uppercase text-terracotta bg-transparent border-none p-0 cursor-pointer disabled:text-ink-faint disabled:opacity-60"
                            >
                              {isFeedbackSubmitting ? "SENDING…" : "SEND FEEDBACK"}
                            </button>
                            <button
                              type="button"
                              onClick={cancelFeedback}
                              disabled={isFeedbackSubmitting}
                              className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-faint hover:text-ink transition-colors bg-transparent border-none p-0 cursor-pointer"
                            >
                              CANCEL
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default HomeTab;
