import { useState, useEffect, useCallback } from "react";
import { BookOpen, Plus, Trash2, Edit2, Check, X, Loader2 } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { supabase } from "../supabase";
import { SUBSCRIPTION_CONFIG } from "@oscar/shared/constants";

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

  // Load vocabulary and check subscription
  useEffect(() => {
    loadVocabulary();
    checkSubscription();
  }, [userId]);

  const checkSubscription = async () => {
    try {
      const { data } = await supabase
        .from("subscriptions")
        .select("status")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();
      setIsProUser(!!data);
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

  const handleAddEntry = useCallback(async () => {
    if (!term.trim()) return;
    
    // Check free tier limit
    if (
      !isProUser &&
      vocabulary.length >= SUBSCRIPTION_CONFIG.FREE_MAX_VOCABULARY
    ) {
      alert(
        `Free users can only add up to ${SUBSCRIPTION_CONFIG.FREE_MAX_VOCABULARY} vocabulary entries. Upgrade to Pro for unlimited entries.`,
      );
      return;
    }

    setIsAdding(true);
    try {
      const { data, error } = await supabase
        .from("user_vocabulary")
        .insert({
          user_id: userId,
          term: term.trim(),
          pronunciation: pronunciation.trim() || null,
          context: context.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setVocabulary((prev) => [data, ...prev]);
        setTerm("");
        setPronunciation("");
        setContext("");
      }
    } catch (e) {
      console.error("Failed to add entry:", e);
      alert("Failed to add entry. Please try again.");
    } finally {
      setIsAdding(false);
    }
  }, [userId, term, pronunciation, context, vocabulary.length, isProUser]);

  const handleDeleteEntry = useCallback(async (id: string) => {
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
  }, [userId]);

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

  const handleUpdateEntry = useCallback(async (id: string) => {
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
  }, [editTerm, editPronunciation, editContext, cancelEditing, userId]);

  const maxEntries = isProUser ? null : SUBSCRIPTION_CONFIG.FREE_MAX_VOCABULARY;

  return (
    <div className="vocabulary-section">
      <div className="vocabulary-header">
        <div className="vocabulary-title-row">
          <BookOpen className="vocabulary-icon" size={20} />
          <h3>Custom Vocabulary</h3>
        </div>
        <span className="vocabulary-count">
          {vocabulary.length}/{maxEntries ?? "Unlimited"} entries
        </span>
      </div>

      <p className="vocabulary-description">
        Add names, terms, or abbreviations that are often misrecognized.
      </p>

      {/* Add Form */}
      <div className="vocabulary-form">
        <div className="vocabulary-form-row">
          <div className="vocabulary-input-group">
            <label>Term *</label>
            <input
              type="text"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="e.g., Sourav"
              maxLength={100}
              onKeyDown={(e) => e.key === "Enter" && handleAddEntry()}
            />
          </div>
          <div className="vocabulary-input-group">
            <label>Sounds like</label>
            <input
              type="text"
              value={pronunciation}
              onChange={(e) => setPronunciation(e.target.value)}
              placeholder="e.g., Shourabh"
              maxLength={100}
            />
          </div>
          <div className="vocabulary-input-group">
            <label>Category</label>
            <input
              type="text"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="e.g., Person"
              maxLength={50}
            />
          </div>
          <button
            className="vocabulary-add-btn"
            onClick={handleAddEntry}
            disabled={isAdding || !term.trim()}
          >
            {isAdding ? (
              <Loader2 size={18} className="spin" />
            ) : (
              <Plus size={18} />
            )}
            <span className="vocabulary-add-label">Add</span>
          </button>
        </div>
      </div>

      {/* Vocabulary List */}
      {isLoading ? (
        <div className="vocabulary-loading">
          <Loader2 size={24} className="spin" />
        </div>
      ) : vocabulary.length === 0 ? (
        <div className="vocabulary-empty">
          <BookOpen size={32} className="vocabulary-empty-icon" />
          <p>No custom vocabulary yet</p>
          <span>Start by adding frequently used names or technical terms.</span>
        </div>
      ) : (
        <div className="vocabulary-list">
          {vocabulary.map((entry) => (
            <div key={entry.id} className="vocabulary-item">
              {editingId === entry.id ? (
                <div className="vocabulary-edit-row">
                  <div className="vocabulary-edit-inputs">
                    <input
                      type="text"
                      value={editTerm}
                      onChange={(e) => setEditTerm(e.target.value)}
                      placeholder="Term"
                      maxLength={100}
                    />
                    <input
                      type="text"
                      value={editPronunciation}
                      onChange={(e) => setEditPronunciation(e.target.value)}
                      placeholder="Sounds like"
                      maxLength={100}
                    />
                    <input
                      type="text"
                      value={editContext}
                      onChange={(e) => setEditContext(e.target.value)}
                      placeholder="Category"
                      maxLength={50}
                    />
                  </div>
                  <div className="vocabulary-edit-actions">
                    <button onClick={() => handleUpdateEntry(entry.id)} className="save-btn">
                      <Check size={16} />
                    </button>
                    <button onClick={cancelEditing} className="cancel-btn">
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="vocabulary-item-content">
                  <div className="vocabulary-item-info">
                    <div className="vocabulary-item-main">
                      <span className="vocabulary-term">{entry.term}</span>
                      {entry.context && (
                        <span className="vocabulary-context">{entry.context}</span>
                      )}
                    </div>
                    {entry.pronunciation && (
                      <p className="vocabulary-pronunciation">
                        Sounds like: {entry.pronunciation}
                      </p>
                    )}
                  </div>
                  <div className="vocabulary-item-actions">
                    <button onClick={() => startEditing(entry)} title="Edit">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleDeleteEntry(entry.id)} title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!isProUser &&
        vocabulary.length >= SUBSCRIPTION_CONFIG.FREE_MAX_VOCABULARY && (
        <div className="vocabulary-upgrade-prompt">
          <p>You've reached the free tier limit.</p>
          <button
            className="upgrade-btn"
            onClick={() => {
              openUrl(PRICING_URL).catch((error) => {
                console.error("Failed to open pricing:", error);
              });
            }}
          >
            View Pro Plans
          </button>
        </div>
      )}
    </div>
  );
}
