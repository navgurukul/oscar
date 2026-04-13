"use client";

import { useState } from "react";
import type {
  MeetingAttendee,
  MeetingTypeHint,
} from "@oscar/shared/types";
import { X } from "lucide-react";

const MEETING_TYPES: { value: MeetingTypeHint; label: string }[] = [
  { value: "auto", label: "Meeting" },
  { value: "discovery", label: "Discovery" },
  { value: "1on1", label: "1-on-1" },
  { value: "standup", label: "Stand-up" },
  { value: "general", label: "General" },
];

interface MeetingMetadataEditorProps {
  title: string;
  attendees: MeetingAttendee[];
  typeHint: MeetingTypeHint;
  onSave: (data: {
    meetingTitle: string;
    attendeesCompact: string;
    attendeesFull: MeetingAttendee[];
    meetingTypeHint: MeetingTypeHint;
  }) => Promise<void>;
  onCancel: () => void;
}

export function MeetingMetadataEditor({
  title,
  attendees,
  typeHint,
  onSave,
  onCancel,
}: MeetingMetadataEditorProps) {
  const [editTitle, setEditTitle] = useState(title);
  const [editAttendees, setEditAttendees] = useState<MeetingAttendee[]>(attendees);
  const [editType, setEditType] = useState<MeetingTypeHint>(typeHint);
  const [newAttendee, setNewAttendee] = useState("");
  const [saving, setSaving] = useState(false);

  function addAttendee() {
    const raw = newAttendee.trim();
    if (!raw) return;

    // Parse "Name <email>" or plain email
    const match = raw.match(/^(.+?)\s*<(.+?)>$/);
    const attendee: MeetingAttendee = match
      ? { name: match[1].trim(), email: match[2].trim() }
      : { name: raw, email: "" };

    setEditAttendees((prev) => [...prev, attendee]);
    setNewAttendee("");
  }

  function removeAttendee(index: number) {
    setEditAttendees((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const compact = editAttendees
        .map((a) => a.name || a.email)
        .filter(Boolean)
        .join(", ");
      await onSave({
        meetingTitle: editTitle,
        attendeesCompact: compact,
        attendeesFull: editAttendees,
        meetingTypeHint: editType,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-5 sm:p-6 space-y-4 border-t border-slate-800">
      {/* Title */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-500">Title</label>
        <input
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/30 transition-all duration-150"
        />
      </div>

      {/* Meeting type */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-500">Type</label>
        <div className="flex flex-wrap gap-2">
          {MEETING_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setEditType(t.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors duration-150 ${
                editType === t.value
                  ? "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40"
                  : "bg-slate-800 text-slate-400 hover:text-slate-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Attendees */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-500">Attendees</label>
        <div className="flex flex-wrap gap-1.5">
          {editAttendees.map((a, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 rounded-full text-xs text-slate-300"
            >
              {a.name || a.email}
              <button
                onClick={() => removeAttendee(i)}
                className="text-slate-500 hover:text-red-400 transition-colors"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newAttendee}
            onChange={(e) => setNewAttendee(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addAttendee()}
            placeholder="Add attendee (Name <email>)"
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 transition-all duration-150"
          />
          <button
            onClick={addAttendee}
            className="px-3 py-1.5 text-xs bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors duration-150"
          >
            Add
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end pt-2">
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
