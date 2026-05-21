"use client";

import { motion } from "motion/react";
import { Trash2, Edit2, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { DBVocabularyEntry } from "@/lib/types/vocabulary.types";
import { v2, v2Serif, V2Caps } from "@/components/v2/V2Primitives";

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
        className="py-3"
        style={{ borderBottom: `1px solid ${v2.rule}` }}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <Input
            type="text"
            value={editState.term}
            onChange={(e) => onEditStateChange("term", e.target.value)}
            placeholder="Term"
            maxLength={100}
            className="text-sm h-8"
            style={{ background: v2.cream2, border: `1px solid ${v2.rule}`, color: v2.ink }}
          />
          <Input
            type="text"
            value={editState.pronunciation}
            onChange={(e) => onEditStateChange("pronunciation", e.target.value)}
            placeholder="Sounds like"
            maxLength={100}
            className="text-sm h-8"
            style={{ background: v2.cream2, border: `1px solid ${v2.rule}`, color: v2.ink }}
          />
          <Input
            type="text"
            value={editState.context}
            onChange={(e) => onEditStateChange("context", e.target.value)}
            placeholder="Category"
            maxLength={50}
            className="text-sm h-8"
            style={{ background: v2.cream2, border: `1px solid ${v2.rule}`, color: v2.ink }}
          />
        </div>
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => onSaveEdit(entry.id)}
            className="text-[12px] rounded-full px-3 py-1 font-medium inline-flex items-center gap-1.5"
            style={{ background: v2.ink, color: v2.cream }}
          >
            <Check className="w-3 h-3" /> Save
          </button>
          <button
            onClick={onCancelEdit}
            className="text-[12px] rounded-full px-3 py-1 inline-flex items-center gap-1.5"
            style={{ border: `1px solid ${v2.rule}`, color: v2.inkSoft }}
          >
            <X className="w-3 h-3" /> Cancel
          </button>
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
      className="flex items-center justify-between py-3 group"
      style={{ borderBottom: `1px solid ${v2.rule}` }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span
            style={{
              fontFamily: v2Serif,
              fontSize: 17,
              fontWeight: 500,
              color: v2.ink,
              letterSpacing: "-0.005em",
            }}
          >
            {entry.term}
          </span>
          {entry.context && <V2Caps>{entry.context.toUpperCase()}</V2Caps>}
        </div>
        {entry.pronunciation && (
          <p className="mt-0.5 text-[12px]" style={{ color: v2.inkSoft }}>
            Sounds like: {entry.pronunciation}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 ml-3 opacity-60 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onStartEdit(entry)}
          className="p-1.5 rounded-full transition-colors"
          style={{ color: v2.inkFaint }}
          title="Edit"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onDelete(entry.id, entry.term)}
          className="p-1.5 rounded-full transition-colors"
          style={{ color: v2.inkFaint }}
          title="Remove"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
}
