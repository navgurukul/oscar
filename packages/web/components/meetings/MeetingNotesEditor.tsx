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
        HTMLAttributes: { class: "text-cyan-400 underline" },
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
          "prose prose-sm prose-invert max-w-none focus:outline-none min-h-[160px] px-4 py-3 text-slate-200 leading-relaxed",
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

  const btnBase =
    "p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition-colors";
  const btnActive = "text-cyan-400 bg-slate-700/70";

  return (
    <div className="space-y-3">
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-cyan-500/30 transition-all">
        <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-slate-700 bg-slate-800/60">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`${btnBase} ${editor.isActive("heading", { level: 1 }) ? btnActive : ""}`}
            title="Heading 1"
          >
            <Heading1 size={14} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`${btnBase} ${editor.isActive("heading", { level: 2 }) ? btnActive : ""}`}
            title="Heading 2"
          >
            <Heading2 size={14} />
          </button>
          <div className="w-px h-4 bg-slate-700 mx-1" />
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`${btnBase} ${editor.isActive("bold") ? btnActive : ""}`}
            title="Bold"
          >
            <Bold size={14} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`${btnBase} ${editor.isActive("italic") ? btnActive : ""}`}
            title="Italic"
          >
            <Italic size={14} />
          </button>
          <div className="w-px h-4 bg-slate-700 mx-1" />
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`${btnBase} ${editor.isActive("bulletList") ? btnActive : ""}`}
            title="Bullet list"
          >
            <List size={14} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`${btnBase} ${editor.isActive("orderedList") ? btnActive : ""}`}
            title="Numbered list"
          >
            <ListOrdered size={14} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            className={`${btnBase} ${editor.isActive("taskList") ? btnActive : ""}`}
            title="Task list"
          >
            <ListChecks size={14} />
          </button>
          <div className="w-px h-4 bg-slate-700 mx-1" />
          <button
            type="button"
            onClick={promptLink}
            className={`${btnBase} ${editor.isActive("link") ? btnActive : ""}`}
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
