"use client";

import { useCallback, useRef, useState } from "react";
import { UploadCloud, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { documentsService } from "@/lib/services/documents.service";
import type { OrgDocument } from "@oscar/shared/types";
import { v2, V2Caps } from "@/components/v2/V2Primitives";

interface Props {
  onUploaded?: (doc: OrgDocument) => void;
}

const ACCEPT = ".pdf,.docx,.md,.txt";

export function DocumentUploader({ onUploaded }: Props) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const upload = useCallback(
    async (file: File) => {
      setBusy(true);
      try {
        const doc = await documentsService.upload(file);
        toast({ title: "Document added", description: doc.title });
        onUploaded?.(doc);
      } catch (err) {
        toast({
          title: "Upload failed",
          description: err instanceof Error ? err.message : "Try again.",
          variant: "destructive",
        });
      } finally {
        setBusy(false);
      }
    },
    [onUploaded, toast]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) void upload(file);
      }}
      className="rounded-2xl p-6 md:p-7 text-center transition-colors"
      style={{
        background: dragging ? "rgba(184,98,61,0.06)" : v2.cream2,
        border: `2px dashed ${dragging ? v2.accent : v2.rule}`,
      }}
    >
      <UploadCloud
        className="w-7 h-7 mx-auto mb-3"
        style={{ color: dragging ? v2.accent : v2.inkFaint }}
      />
      <V2Caps color={v2.accent}>DROP A FILE TO ADD IT</V2Caps>
      <p className="mt-2 text-[12px]" style={{ color: v2.inkSoft }}>
        PDF, DOCX, Markdown, or plain text · up to 10 MB
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="mt-5 text-[13px] rounded-full px-5 py-2.5 font-medium inline-flex items-center gap-2 disabled:opacity-50"
        style={{ background: v2.ink, color: v2.cream }}
      >
        {busy ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Uploading…
          </>
        ) : (
          "Choose file"
        )}
      </button>
    </div>
  );
}
