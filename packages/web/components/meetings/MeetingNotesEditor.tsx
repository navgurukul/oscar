"use client";

import { useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Markdown } from "tiptap-markdown";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  ListChecks,
  Heading1,
  Heading2,
  Link2,
} from "lucide-react";
import { v2 } from "@/components/v2/V2Primitives";

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
  const [saving, setSaving] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: "Write meeting notes…",
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "underline", style: `color: ${v2.accent}` },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Markdown.configure({
        html: false,
        tightLists: true,
        bulletListMarker: "-",
        linkify: true,
        breaks: true,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none focus:outline-none min-h-[160px] px-4 py-3 leading-relaxed",
        style: `color: ${v2.ink}`,
      },
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!editor) return;
    const md = editor.storage as unknown as Record<string, { getMarkdown?: () => string }>;
    const current = md.markdown?.getMarkdown?.() ?? "";
    if (current !== value) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) return null;

  async function handleSave() {
    if (!editor) return;
    setSaving(true);
    try {
      const md = editor.storage as unknown as Record<string, { getMarkdown?: () => string }>;
      const markdown = md.markdown?.getMarkdown?.() ?? editor.getText();
      await onSave(markdown);
    } finally {
      setSaving(false);
    }
  }

  function promptLink() {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  const btnBase = "p-1.5 rounded-md transition-colors";
  const btnInactive = { color: v2.inkSoft };
  const btnActive = { color: v2.accent, background: v2.accentSoft };

  return (
    <div className="space-y-3">
      <div
        className="rounded-xl overflow-hidden transition-all"
        style={{ background: v2.cream, border: `1px solid ${v2.rule}` }}
      >
        <div
          className="flex items-center gap-0.5 px-2 py-1.5"
          style={{ borderBottom: `1px solid ${v2.rule}`, background: v2.cream2 }}
        >
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={btnBase}
            style={editor.isActive("heading", { level: 1 }) ? btnActive : btnInactive}
            title="Heading 1"
          >
            <Heading1 size={14} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={btnBase}
            style={editor.isActive("heading", { level: 2 }) ? btnActive : btnInactive}
            title="Heading 2"
          >
            <Heading2 size={14} />
          </button>
          <div className="w-px h-4 mx-1" style={{ background: v2.rule }} />
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={btnBase}
            style={editor.isActive("bold") ? btnActive : btnInactive}
            title="Bold"
          >
            <Bold size={14} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={btnBase}
            style={editor.isActive("italic") ? btnActive : btnInactive}
            title="Italic"
          >
            <Italic size={14} />
          </button>
          <div className="w-px h-4 mx-1" style={{ background: v2.rule }} />
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={btnBase}
            style={editor.isActive("bulletList") ? btnActive : btnInactive}
            title="Bullet list"
          >
            <List size={14} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={btnBase}
            style={editor.isActive("orderedList") ? btnActive : btnInactive}
            title="Numbered list"
          >
            <ListOrdered size={14} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            className={btnBase}
            style={editor.isActive("taskList") ? btnActive : btnInactive}
            title="Task list"
          >
            <ListChecks size={14} />
          </button>
          <div className="w-px h-4 mx-1" style={{ background: v2.rule }} />
          <button
            type="button"
            onClick={promptLink}
            className={btnBase}
            style={editor.isActive("link") ? btnActive : btnInactive}
            title="Link"
          >
            <Link2 size={14} />
          </button>
        </div>
        <EditorContent editor={editor} />
      </div>
      <div className="flex gap-2 justify-end">
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
