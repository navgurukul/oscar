"use client";

import { useCallback, useRef, useState } from "react";
import { UploadCloud, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { documentsService } from "@/lib/services/documents.service";
import type { OrgDocument } from "@oscar/shared/types";

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
      className={`rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
        dragging ? "border-cyan-400 bg-cyan-400/5" : "border-slate-700 bg-slate-900"
      }`}
    >
      <UploadCloud className="w-7 h-7 text-cyan-400 mx-auto mb-2" />
      <p className="text-white text-sm font-medium mb-1">Drop a file to add it</p>
      <p className="text-slate-500 text-xs mb-3">PDF, DOCX, Markdown, or plain text · up to 10 MB</p>
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
      <Button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="bg-cyan-500 hover:bg-cyan-600 text-white"
      >
        {busy ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Uploading...
          </>
        ) : (
          "Choose file"
        )}
      </Button>
    </div>
  );
}
