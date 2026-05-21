"use client";

import { useState } from "react";
import type {
  MeetingAttendee,
  MeetingTypeHint,
} from "@oscar/shared/types";
import { X } from "lucide-react";
import { v2 } from "@/components/v2/V2Primitives";

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

  const labelStyle = { color: v2.inkFaint, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase" as const };
  const inputStyle = {
    background: v2.cream,
    border: `1px solid ${v2.rule}`,
    color: v2.ink,
  };

  return (
    <div className="p-5 sm:p-6 space-y-4" style={{ borderTop: `1px solid ${v2.rule}` }}>
      <div className="space-y-1.5">
        <label className="text-xs font-medium" style={labelStyle}>Title</label>
        <input
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none transition-all duration-150"
          style={inputStyle}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium" style={labelStyle}>Type</label>
        <div className="flex flex-wrap gap-2">
          {MEETING_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setEditType(t.value)}
              className="px-3 py-1 rounded-full text-xs font-medium transition-colors duration-150"
              style={
                editType === t.value
                  ? { background: v2.accentSoft, color: v2.accent, border: `1px solid ${v2.accent}` }
                  : { background: v2.cream2, color: v2.inkSoft, border: `1px solid ${v2.rule}` }
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium" style={labelStyle}>Attendees</label>
        <div className="flex flex-wrap gap-1.5">
          {editAttendees.map((a, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs"
              style={{ background: v2.cream2, color: v2.ink, border: `1px solid ${v2.rule}` }}
            >
              {a.name || a.email}
              <button
                onClick={() => removeAttendee(i)}
                className="transition-colors"
                style={{ color: v2.inkFaint }}
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
            className="flex-1 rounded-xl px-3 py-1.5 text-xs focus:outline-none transition-all duration-150"
            style={inputStyle}
          />
          <button
            onClick={addAttendee}
            className="px-3 py-1.5 text-xs rounded-lg transition-colors duration-150"
            style={{ background: v2.cream2, color: v2.ink, border: `1px solid ${v2.rule}` }}
          >
            Add
          </button>
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-2">
        <button
          onClick={onCancel}
          disabled={saving}
          className="px-3 py-1.5 text-sm rounded-lg transition-colors duration-150"
          style={{ color: v2.inkSoft }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-1.5 text-sm rounded-lg disabled:opacity-50 transition-colors duration-150"
          style={{ background: v2.ink, color: v2.cream }}
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
