"use client";

import { useState } from "react";

interface MeetingNotesEditorProps {
  value: string;
  onSave: (value: string) => Promise<void>;
  onCancel: () => void;
}

export function MeetingNotesEditor({
  value,
  onSave,
  onCancel,
}: MeetingNotesEditorProps) {
  const [text, setText] = useState(value);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(text);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 leading-relaxed placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 resize-y transition-all duration-150"
      />
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          disabled={saving}
          className="px-3 py-1.5 text-sm text-slate-400 hover:text-white rounded-lg transition-colors duration-150"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-1.5 text-sm bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 disabled:opacity-50 transition-colors duration-150"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
