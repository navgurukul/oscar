"use client";

import { useState, useEffect, useCallback } from "react";
import { AnimatePresence } from "motion/react";
import { BookOpen } from "lucide-react";
import { vocabularyService } from "@/lib/services/vocabulary.service";
import { useToast } from "@/hooks/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { UpgradePrompt } from "@/components/subscription/UpgradePrompt";
import { VocabularyForm } from "./VocabularyForm";
import { VocabularyEntryCard, type EditState } from "./VocabularyEntryCard";
import type { DBVocabularyEntry } from "@/lib/types/vocabulary.types";
import { SUBSCRIPTION_CONFIG } from "@/lib/constants";

const MAX_VOCABULARY_ENTRIES = 50;

interface VocabularySectionProps {
  userId: string;
  isProUser: boolean;
}

export function VocabularySection({ userId, isProUser }: VocabularySectionProps) {
  const { toast } = useToast();

  const [vocabulary, setVocabulary] = useState<DBVocabularyEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({
    term: "",
    pronunciation: "",
    context: "",
  });

  // Load vocabulary on mount
  useEffect(() => {
    async function loadVocabulary() {
      setIsLoading(true);
      const { data, error } = await vocabularyService.getVocabulary();

      if (error) {
        toast({
          title: "Failed to load vocabulary",
          description: "Please refresh the page to try again.",
          variant: "destructive",
        });
      } else {
        setVocabulary(data || []);
      }
      setIsLoading(false);
    }

    loadVocabulary();
  }, [toast]);

  const handleAddEntry = useCallback(
    async (data: { term: string; pronunciation: string; context: string }): Promise<boolean> => {
      if (!data.term) {
        toast({
          title: "Term is required",
          description: "Please enter a term to add.",
          variant: "destructive",
        });
        return false;
      }

      // Free tier vocabulary limit enforcement
      if (!isProUser && vocabulary.length >= SUBSCRIPTION_CONFIG.FREE_MAX_VOCABULARY) {
        setShowUpgradePrompt(true);
        return false;
      }

      // Absolute max entries guard
      if (vocabulary.length >= MAX_VOCABULARY_ENTRIES) {
        toast({
          title: "Vocabulary limit reached",
          description: `You can only add up to ${MAX_VOCABULARY_ENTRIES} entries.`,
          variant: "destructive",
        });
        return false;
      }

      setIsAdding(true);
      const { data: newEntry, error } = await vocabularyService.addVocabularyEntry({
        user_id: userId,
        term: data.term,
        pronunciation: data.pronunciation || null,
        context: data.context || null,
      });

      if (error) {
        const isDuplicate = error.message?.includes("duplicate");
        toast({
          title: isDuplicate ? "Term already exists" : "Failed to add entry",
          description: isDuplicate
            ? "This term is already in your vocabulary."
            : "Please try again.",
          variant: "destructive",
        });
        setIsAdding(false);
        return false;
      }

      if (newEntry) {
        setVocabulary((prev) => [newEntry, ...prev]);
        toast({
          title: "Entry added",
          description: `"${newEntry.term}" has been added to your vocabulary.`,
        });
      }
      setIsAdding(false);
      return true;
    },
    [userId, isProUser, vocabulary.length, toast]
  );

  const handleDeleteEntry = useCallback(
    async (id: string, term: string) => {
      const { error } = await vocabularyService.deleteVocabularyEntry(id);

      if (error) {
        toast({
          title: "Failed to delete entry",
          description: "Please try again.",
          variant: "destructive",
        });
      } else {
        setVocabulary((prev) => prev.filter((v) => v.id !== id));
        toast({
          title: "Entry deleted",
          description: `"${term}" has been removed from your vocabulary.`,
        });
      }
    },
    [toast]
  );

  const startEditing = useCallback((entry: DBVocabularyEntry) => {
    setEditingId(entry.id);
    setEditState({
      term: entry.term,
      pronunciation: entry.pronunciation || "",
      context: entry.context || "",
    });
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingId(null);
    setEditState({ term: "", pronunciation: "", context: "" });
  }, []);

  const handleUpdateEntry = useCallback(
    async (id: string) => {
      if (!editState.term.trim()) {
        toast({
          title: "Term is required",
          description: "Please enter a term.",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await vocabularyService.updateVocabularyEntry(id, {
        term: editState.term.trim(),
        pronunciation: editState.pronunciation.trim() || null,
        context: editState.context.trim() || null,
      });

      if (error) {
        toast({
          title: "Failed to update entry",
          description: "Please try again.",
          variant: "destructive",
        });
      } else if (data) {
        setVocabulary((prev) => prev.map((v) => (v.id === id ? data : v)));
        cancelEditing();
        toast({
          title: "Entry updated",
          description: `"${data.term}" has been updated.`,
        });
      }
    },
    [editState, cancelEditing, toast]
  );

  const handleEditStateChange = useCallback((field: keyof EditState, value: string) => {
    setEditState((prev) => ({ ...prev, [field]: value }));
  }, []);

  const maxEntries = isProUser ? MAX_VOCABULARY_ENTRIES : SUBSCRIPTION_CONFIG.FREE_MAX_VOCABULARY;

  return (
    <>
      <div className="bg-slate-900 rounded-2xl border border-cyan-700/30 p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-cyan-400" />
            <h2 className="text-xl font-semibold text-white">Custom Vocabulary</h2>
          </div>
          <span className="text-sm text-gray-400">
            {vocabulary.length}/{maxEntries} entries
          </span>
        </div>

        <p className="text-gray-400 text-sm mb-6">
          Add names, technical terms, or abbreviations that are often misrecognized. These will be
          used to improve speech-to-text accuracy.
        </p>

        {/* Add Form */}
        <VocabularyForm onSubmit={handleAddEntry} isLoading={isAdding} />

        {/* Vocabulary List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner className="text-cyan-500" />
          </div>
        ) : vocabulary.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-slate-700 rounded-lg">
            <BookOpen className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No custom vocabulary yet</p>
            <p className="text-gray-500 text-sm mt-1">
              Start by adding frequently used names or technical terms.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {vocabulary.map((entry) => (
                <VocabularyEntryCard
                  key={entry.id}
                  entry={entry}
                  isEditing={editingId === entry.id}
                  editState={editState}
                  onStartEdit={startEditing}
                  onCancelEdit={cancelEditing}
                  onSaveEdit={handleUpdateEntry}
                  onDelete={handleDeleteEntry}
                  onEditStateChange={handleEditStateChange}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Upgrade prompt for vocabulary limit (free tier) */}
      {showUpgradePrompt && (
        <UpgradePrompt
          limitType="vocabulary"
          currentUsage={vocabulary.length}
          onClose={() => setShowUpgradePrompt(false)}
        />
      )}
    </>
  );
}

export default VocabularySection;
