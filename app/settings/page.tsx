"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Trash2, Edit2, Check, X, BookOpen } from "lucide-react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { vocabularyService } from "@/lib/services/vocabulary.service";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import type { DBVocabularyEntry } from "@/lib/types/vocabulary.types";
import { ROUTES } from "@/lib/constants";

const MAX_VOCABULARY_ENTRIES = 50;

export default function SettingsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [vocabulary, setVocabulary] = useState<DBVocabularyEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  // Form state for new entry
  const [newTerm, setNewTerm] = useState("");
  const [newPronunciation, setNewPronunciation] = useState("");
  const [newContext, setNewContext] = useState("");

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTerm, setEditTerm] = useState("");
  const [editPronunciation, setEditPronunciation] = useState("");
  const [editContext, setEditContext] = useState("");

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`${ROUTES.AUTH}?redirectTo=${ROUTES.SETTINGS}`);
    }
  }, [user, authLoading, router]);

  // Load vocabulary on mount
  useEffect(() => {
    async function loadVocabulary() {
      if (!user) return;

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

    if (user) {
      loadVocabulary();
    }
  }, [user, toast]);

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newTerm.trim()) {
      toast({
        title: "Term is required",
        description: "Please enter a term to add.",
        variant: "destructive",
      });
      return;
    }

    if (vocabulary.length >= MAX_VOCABULARY_ENTRIES) {
      toast({
        title: "Vocabulary limit reached",
        description: `You can only add up to ${MAX_VOCABULARY_ENTRIES} entries.`,
        variant: "destructive",
      });
      return;
    }

    setIsAdding(true);
    const { data, error } = await vocabularyService.addVocabularyEntry({
      user_id: user!.id,
      term: newTerm.trim(),
      pronunciation: newPronunciation.trim() || null,
      context: newContext.trim() || null,
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
    } else if (data) {
      setVocabulary([data, ...vocabulary]);
      setNewTerm("");
      setNewPronunciation("");
      setNewContext("");
      toast({
        title: "Entry added",
        description: `"${data.term}" has been added to your vocabulary.`,
      });
    }
    setIsAdding(false);
  };

  const handleDeleteEntry = async (id: string, term: string) => {
    const { error } = await vocabularyService.deleteVocabularyEntry(id);

    if (error) {
      toast({
        title: "Failed to delete entry",
        description: "Please try again.",
        variant: "destructive",
      });
    } else {
      setVocabulary(vocabulary.filter((v) => v.id !== id));
      toast({
        title: "Entry deleted",
        description: `"${term}" has been removed from your vocabulary.`,
      });
    }
  };

  const startEditing = (entry: DBVocabularyEntry) => {
    setEditingId(entry.id);
    setEditTerm(entry.term);
    setEditPronunciation(entry.pronunciation || "");
    setEditContext(entry.context || "");
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditTerm("");
    setEditPronunciation("");
    setEditContext("");
  };

  const handleUpdateEntry = async (id: string) => {
    if (!editTerm.trim()) {
      toast({
        title: "Term is required",
        description: "Please enter a term.",
        variant: "destructive",
      });
      return;
    }

    const { data, error } = await vocabularyService.updateVocabularyEntry(id, {
      term: editTerm.trim(),
      pronunciation: editPronunciation.trim() || null,
      context: editContext.trim() || null,
    });

    if (error) {
      toast({
        title: "Failed to update entry",
        description: "Please try again.",
        variant: "destructive",
      });
    } else if (data) {
      setVocabulary(vocabulary.map((v) => (v.id === id ? data : v)));
      cancelEditing();
      toast({
        title: "Entry updated",
        description: `"${data.term}" has been updated.`,
      });
    }
  };

  if (authLoading || !user) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Spinner className="text-cyan-500" />
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center px-4 pt-8 pb-24">
      <div className="w-full max-w-2xl mt-16">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
          <p className="text-gray-400">
            Manage your custom vocabulary for better speech recognition
          </p>
        </div>

        {/* Vocabulary Section */}
        <div className="bg-slate-900 rounded-2xl border border-cyan-700/30 p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <BookOpen className="w-5 h-5 text-cyan-400" />
              <h2 className="text-xl font-semibold text-white">
                Custom Vocabulary
              </h2>
            </div>
            <span className="text-sm text-gray-400">
              {vocabulary.length}/{MAX_VOCABULARY_ENTRIES} entries
            </span>
          </div>

          <p className="text-gray-400 text-sm mb-6">
            Add names, technical terms, or abbreviations that are often
            misrecognized. These will be used to improve speech-to-text
            accuracy.
          </p>

          {/* Add Form */}
          <form onSubmit={handleAddEntry} className="mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <div>
                <label
                  htmlFor="term"
                  className="block text-xs font-medium text-gray-400 mb-1"
                >
                  Term *
                </label>
                <input
                  id="term"
                  type="text"
                  value={newTerm}
                  onChange={(e) => setNewTerm(e.target.value)}
                  placeholder="e.g., Sourav"
                  maxLength={100}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-colors text-sm"
                />
              </div>
              <div>
                <label
                  htmlFor="pronunciation"
                  className="block text-xs font-medium text-gray-400 mb-1"
                >
                  Sounds like
                </label>
                <input
                  id="pronunciation"
                  type="text"
                  value={newPronunciation}
                  onChange={(e) => setNewPronunciation(e.target.value)}
                  placeholder="e.g., Shourabh, Saurav"
                  maxLength={100}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-colors text-sm"
                />
              </div>
              <div>
                <label
                  htmlFor="context"
                  className="block text-xs font-medium text-gray-400 mb-1"
                >
                  Category
                </label>
                <input
                  id="context"
                  type="text"
                  value={newContext}
                  onChange={(e) => setNewContext(e.target.value)}
                  placeholder="e.g., Person, Tech Term"
                  maxLength={50}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-colors text-sm"
                />
              </div>
            </div>
            <div className="text-end">
              <Button
                type="submit"
                disabled={isAdding || !newTerm.trim()}
                className="bg-cyan-600 hover:bg-cyan-700 text-white font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAdding ? (
                  <span className="flex items-center gap-2">
                    <Spinner className="w-4 h-4" />
                    Adding...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Add Entry
                  </span>
                )}
              </Button>
            </div>
          </form>

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
                  <motion.div
                    key={entry.id}
                    layout
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="bg-slate-800 rounded-lg p-3 border border-slate-700"
                  >
                    {editingId === entry.id ? (
                      // Edit mode
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <input
                            type="text"
                            value={editTerm}
                            onChange={(e) => setEditTerm(e.target.value)}
                            placeholder="Term"
                            maxLength={100}
                            className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          />
                          <input
                            type="text"
                            value={editPronunciation}
                            onChange={(e) =>
                              setEditPronunciation(e.target.value)
                            }
                            placeholder="Sounds like"
                            maxLength={100}
                            className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          />
                          <input
                            type="text"
                            value={editContext}
                            onChange={(e) => setEditContext(e.target.value)}
                            placeholder="Category"
                            maxLength={50}
                            className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleUpdateEntry(entry.id)}
                            className="bg-cyan-600 hover:bg-cyan-700 text-white"
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={cancelEditing}
                            className="text-gray-400 hover:text-white"
                          >
                            <X className="w-4 h-4 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // Display mode
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white font-medium">
                              {entry.term}
                            </span>
                            {entry.context && (
                              <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded">
                                {entry.context}
                              </span>
                            )}
                          </div>
                          {entry.pronunciation && (
                            <p className="text-gray-400 text-sm mt-0.5">
                              Sounds like: {entry.pronunciation}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <button
                            onClick={() => startEditing(entry)}
                            className="p-2 text-gray-400 hover:text-cyan-400 transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() =>
                              handleDeleteEntry(entry.id, entry.term)
                            }
                            className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
