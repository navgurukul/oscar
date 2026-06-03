import { useState, useEffect, useCallback } from "react";
import { BookOpen, Edit2, Check, X, Loader2 } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { supabase } from "../supabase";
import {
  SUBSCRIPTION_CONFIG,
  getSubscriptionEntitlement,
} from "@oscar/shared/constants";
import { Group, EmptyPanel } from "./SettingsTab";

interface VocabularyEntry {
  id: string;
  term: string;
  pronunciation: string | null;
  context: string | null;
  created_at: string;
}

interface VocabularySectionProps {
  userId: string;
}

const WEB_APP_URL =
  import.meta.env.VITE_WEB_APP_URL ?? "https://oscar.samyarth.org";
const PRICING_URL = `${WEB_APP_URL}/pricing`;

const RULE = "#e5e0d6"; // cream-300

// Curated suggestions — clicking one adds it as a term right away.
const SUGGESTED = [
  "NavGurukul",
  "Razorpay",
  "standup",
  "Scribble",
  "Tauri",
  "Whisper",
];

export function VocabularySection({ userId }: VocabularySectionProps) {
  const [vocabulary, setVocabulary] = useState<VocabularyEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isProUser, setIsProUser] = useState(false);

  // Form state
  const [term, setTerm] = useState("");
  const [pronunciation, setPronunciation] = useState("");
  const [context, setContext] = useState("");

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTerm, setEditTerm] = useState("");
  const [editPronunciation, setEditPronunciation] = useState("");
  const [editContext, setEditContext] = useState("");

  useEffect(() => {
    loadVocabulary();
    checkSubscription();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const checkSubscription = async () => {
    try {
      const { data } = await supabase
        .from("subscriptions")
        .select("tier, status, current_period_end")
        .eq("user_id", userId)
        .maybeSingle();
      setIsProUser(
        getSubscriptionEntitlement({
          tier: data?.tier,
          status: data?.status,
          currentPeriodEnd: data?.current_period_end,
        }).isPro,
      );
    } catch {
      setIsProUser(false);
    }
  };

  const loadVocabulary = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_vocabulary")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setVocabulary(data || []);
    } catch (e) {
      console.error("Failed to load vocabulary:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const atFreeLimit =
    !isProUser && vocabulary.length >= SUBSCRIPTION_CONFIG.FREE_MAX_VOCABULARY;

  // Core insert — shared by the form and the suggestion chips.
  const insertEntry = useCallback(
    async (
      rawTerm: string,
      rawPron: string,
      rawContext: string,
    ): Promise<boolean> => {
      const t = rawTerm.trim();
      if (!t) return false;

      if (atFreeLimit) {
        alert(
          `Free users can add up to ${SUBSCRIPTION_CONFIG.FREE_MAX_VOCABULARY} vocabulary entries. Upgrade to Pro for unlimited entries.`,
        );
        return false;
      }

      setIsAdding(true);
      try {
        const { data, error } = await supabase
          .from("user_vocabulary")
          .insert({
            user_id: userId,
            term: t,
            pronunciation: rawPron.trim() || null,
            context: rawContext.trim() || null,
          })
          .select()
          .single();

        if (error) throw error;
        if (data) {
          setVocabulary((prev) => [data, ...prev]);
          return true;
        }
        return false;
      } catch (e) {
        console.error("Failed to add entry:", e);
        alert("Failed to add entry. Please try again.");
        return false;
      } finally {
        setIsAdding(false);
      }
    },
    [userId, atFreeLimit],
  );

  const handleAddEntry = useCallback(async () => {
    const ok = await insertEntry(term, pronunciation, context);
    if (ok) {
      setTerm("");
      setPronunciation("");
      setContext("");
    }
  }, [insertEntry, term, pronunciation, context]);

  const handleAddSuggestion = useCallback(
    (word: string) => {
      void insertEntry(word, "", "");
    },
    [insertEntry],
  );

  const handleDeleteEntry = useCallback(
    async (id: string) => {
      try {
        const { error } = await supabase
          .from("user_vocabulary")
          .delete()
          .eq("id", id)
          .eq("user_id", userId);

        if (error) throw error;
        setVocabulary((prev) => prev.filter((v) => v.id !== id));
      } catch (e) {
        console.error("Failed to delete entry:", e);
        alert("Failed to delete entry.");
      }
    },
    [userId],
  );

  const startEditing = useCallback((entry: VocabularyEntry) => {
    setEditingId(entry.id);
    setEditTerm(entry.term);
    setEditPronunciation(entry.pronunciation || "");
    setEditContext(entry.context || "");
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingId(null);
    setEditTerm("");
    setEditPronunciation("");
    setEditContext("");
  }, []);

  const handleUpdateEntry = useCallback(
    async (id: string) => {
      if (!editTerm.trim()) return;
      try {
        const { data, error } = await supabase
          .from("user_vocabulary")
          .update({
            term: editTerm.trim(),
            pronunciation: editPronunciation.trim() || null,
            context: editContext.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id)
          .eq("user_id", userId)
          .select()
          .single();

        if (error) throw error;
        if (data) {
          setVocabulary((prev) => prev.map((v) => (v.id === id ? data : v)));
          cancelEditing();
        }
      } catch (e) {
        console.error("Failed to update entry:", e);
        alert("Failed to update entry.");
      }
    },
    [editTerm, editPronunciation, editContext, cancelEditing, userId],
  );

  const maxEntries = isProUser ? null : SUBSCRIPTION_CONFIG.FREE_MAX_VOCABULARY;
  const existing = new Set(vocabulary.map((v) => v.term.toLowerCase()));
  const suggestions = SUGGESTED.filter((s) => !existing.has(s.toLowerCase()));

  return (
    <div className="st-content">
      <span className="st-content-eyebrow">SETTINGS · VOCABULARY</span>
      <h2 className="st-content-title">
        Words Oscar should <em>know</em>.
      </h2>
      <p className="mt-3 max-w-xl text-[13.5px] leading-relaxed text-ink-soft">
        Names, jargon, file paths — the words Whisper would otherwise miss.
        Oscar treats this as the canonical spelling.
      </p>

      {/* Add — pill */}
      <div className="mt-7">
        <div className="flex items-center gap-3 rounded-full pl-5 pr-2 py-1.5 bg-cream-200 border border-cream-300">
          <span className="font-mono text-[11px] tracking-[0.06em] uppercase text-ink-faint shrink-0">
            Add a word
          </span>
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="e.g. Linear, Tauri, hi-fi"
            maxLength={100}
            onKeyDown={(e) => e.key === "Enter" && handleAddEntry()}
            className="flex-1 min-w-0 bg-transparent outline-none border-none py-1.5 text-[14px] text-ink"
          />
          <button
            type="button"
            onClick={handleAddEntry}
            disabled={isAdding || !term.trim()}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[12px] font-medium bg-ink text-cream border-none cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isAdding ? <Loader2 size={12} className="animate-spin" /> : null}
            Add
          </button>
        </div>

        {/* Optional refinement fields — revealed once a term is typed */}
        {term.trim() && (
          <div className="mt-2.5 flex gap-2.5">
            <input
              value={pronunciation}
              onChange={(e) => setPronunciation(e.target.value)}
              placeholder="Sounds like (optional)"
              maxLength={100}
              className="flex-1 min-w-0 rounded-lg px-3 py-2 text-[13px] text-ink bg-cream-50 border border-cream-300 outline-none focus:border-ink-faint"
            />
            <input
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Category (optional)"
              maxLength={50}
              className="flex-1 min-w-0 rounded-lg px-3 py-2 text-[13px] text-ink bg-cream-50 border border-cream-300 outline-none focus:border-ink-faint"
            />
          </div>
        )}
      </div>

      {/* List / empty */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-ink-faint">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : vocabulary.length === 0 ? (
        <div className="mt-7">
          <EmptyPanel
            icon={<BookOpen size={17} strokeWidth={1.6} />}
            title="Your vocabulary is empty."
            body="Add the words you say that get transcribed wrong — teammates’ names, product terms, code symbols. Oscar will spell them right every time."
          />
          {suggestions.length > 0 && (
            <div className="mt-7">
              <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-faint">
                SUGGESTED
              </span>
              <div className="mt-3 flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleAddSuggestion(s)}
                    disabled={isAdding || atFreeLimit}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] text-ink bg-cream border border-cream-400 cursor-pointer hover:border-ink-faint transition-colors disabled:opacity-50"
                  >
                    <span className="text-terracotta">+</span> {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <Group title={`YOUR VOCABULARY · ${vocabulary.length} WORD${vocabulary.length === 1 ? "" : "S"}`}>
          <div>
            {vocabulary.map((entry, i) => {
              const last = i === vocabulary.length - 1;
              if (editingId === entry.id) {
                return (
                  <div
                    key={entry.id}
                    className="flex items-center gap-2 py-3"
                    style={{ borderBottom: last ? "none" : `1px solid ${RULE}` }}
                  >
                    <input
                      value={editTerm}
                      onChange={(e) => setEditTerm(e.target.value)}
                      placeholder="Term"
                      maxLength={100}
                      className="flex-1 min-w-0 rounded-lg px-2.5 py-1.5 text-[14px] text-ink bg-cream-50 border border-cream-300 outline-none focus:border-ink-faint"
                    />
                    <input
                      value={editPronunciation}
                      onChange={(e) => setEditPronunciation(e.target.value)}
                      placeholder="Sounds like"
                      maxLength={100}
                      className="flex-1 min-w-0 rounded-lg px-2.5 py-1.5 text-[13px] text-ink bg-cream-50 border border-cream-300 outline-none focus:border-ink-faint"
                    />
                    <input
                      value={editContext}
                      onChange={(e) => setEditContext(e.target.value)}
                      placeholder="Category"
                      maxLength={50}
                      className="w-28 shrink-0 rounded-lg px-2.5 py-1.5 text-[13px] text-ink bg-cream-50 border border-cream-300 outline-none focus:border-ink-faint"
                    />
                    <button
                      type="button"
                      onClick={() => handleUpdateEntry(entry.id)}
                      title="Save"
                      className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-full bg-ink text-cream border-none cursor-pointer"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditing}
                      title="Cancel"
                      className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-full border border-cream-300 bg-transparent text-ink-soft cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              }
              return (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-3 py-3 group"
                  style={{ borderBottom: last ? "none" : `1px solid ${RULE}` }}
                >
                  <div className="min-w-0 flex items-baseline gap-3 flex-wrap">
                    <span
                      className="font-serif font-medium text-ink"
                      style={{ fontSize: 17, letterSpacing: "-0.005em" }}
                    >
                      {entry.term}
                    </span>
                    {entry.context && (
                      <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-faint">
                        {entry.context}
                      </span>
                    )}
                    {entry.pronunciation && (
                      <span className="text-[12px] text-ink-soft">
                        sounds like “{entry.pronunciation}”
                      </span>
                    )}
                  </div>
                  <div className="shrink-0 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => startEditing(entry)}
                      title="Edit"
                      className="text-ink-faint hover:text-ink bg-transparent border-none cursor-pointer transition-colors"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteEntry(entry.id)}
                      className="text-[11px] text-ink-faint hover:text-[#8c2f25] bg-transparent border-none cursor-pointer transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Group>
      )}

      {atFreeLimit && (
        <div className="mt-6 rounded-lg p-5 flex items-center justify-between gap-6 bg-cream-200 border border-cream-300">
          <p className="text-[13px] text-ink-soft">
            You’ve reached the free limit of {maxEntries} entries.
          </p>
          <button
            type="button"
            onClick={() => {
              openUrl(PRICING_URL).catch((error) => {
                console.error("Failed to open pricing:", error);
              });
            }}
            className="shrink-0 inline-flex items-center rounded-full px-4 py-2 text-[12px] font-medium bg-ink text-cream border-none cursor-pointer transition-opacity hover:opacity-90"
          >
            View Pro plans
          </button>
        </div>
      )}
    </div>
  );
}
