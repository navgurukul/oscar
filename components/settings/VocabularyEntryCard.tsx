"use client";

import { motion } from "motion/react";
import { Trash2, Edit2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DBVocabularyEntry } from "@/lib/types/vocabulary.types";

export interface EditState {
  term: string;
  pronunciation: string;
  context: string;
}

interface VocabularyEntryCardProps {
  entry: DBVocabularyEntry;
  isEditing: boolean;
  editState: EditState;
  onStartEdit: (entry: DBVocabularyEntry) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string) => void;
  onDelete: (id: string, term: string) => void;
  onEditStateChange: (field: keyof EditState, value: string) => void;
}

export function VocabularyEntryCard({
  entry,
  isEditing,
  editState,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onEditStateChange,
}: VocabularyEntryCardProps) {
  if (isEditing) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="bg-slate-800 rounded-lg p-3 border border-slate-700"
      >
        <div className="space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Input
              type="text"
              value={editState.term}
              onChange={(e) => onEditStateChange("term", e.target.value)}
              placeholder="Term"
              maxLength={100}
              className="bg-slate-900 border-slate-600 text-white text-sm h-8 focus-visible:ring-cyan-500"
            />
            <Input
              type="text"
              value={editState.pronunciation}
              onChange={(e) => onEditStateChange("pronunciation", e.target.value)}
              placeholder="Sounds like"
              maxLength={100}
              className="bg-slate-900 border-slate-600 text-white text-sm h-8 focus-visible:ring-cyan-500"
            />
            <Input
              type="text"
              value={editState.context}
              onChange={(e) => onEditStateChange("context", e.target.value)}
              placeholder="Category"
              maxLength={50}
              className="bg-slate-900 border-slate-600 text-white text-sm h-8 focus-visible:ring-cyan-500"
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => onSaveEdit(entry.id)}
              className="bg-cyan-600 hover:bg-cyan-700 text-white"
            >
              <Check className="w-4 h-4 mr-1" />
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onCancelEdit}
              className="text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="bg-slate-800 rounded-lg p-3 border border-slate-700"
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-medium">{entry.term}</span>
            {entry.context && (
              <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded">
                {entry.context}
              </span>
            )}
          </div>
          {entry.pronunciation && (
            <p className="text-gray-400 text-sm mt-1">
              Sounds like: {entry.pronunciation}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={() => onStartEdit(entry)}
            className="p-2 text-gray-400 hover:text-cyan-400 transition-colors"
            title="Edit"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(entry.id, entry.term)}
            className="p-2 text-gray-400 hover:text-red-400 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
