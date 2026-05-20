"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Sparkles, FileText, Loader2, Copy, Download, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { documentsService } from "@/lib/services/documents.service";
import { isOrgFeatureEnabled } from "@/lib/featureFlags";
import type { OrgDocument } from "@oscar/shared/types";

type Tone = "neutral" | "concise" | "executive" | "casual" | "technical";

interface Props {
  scribbleId: string;
  scribbleTitle: string;
  shared: boolean;
  bodyOverride?: string;
}

export function PublishDialog({ scribbleId, scribbleTitle, shared, bodyOverride }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [docs, setDocs] = useState<OrgDocument[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [tone, setTone] = useState<Tone>("neutral");
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState("");
  const [copied, setCopied] = useState(false);

  const loadDocs = useCallback(async () => {
    try {
      const { items } = await documentsService.list();
      setDocs(items);
    } catch (err) {
      console.error("[publish] load docs failed", err);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadDocs();
  }, [open, loadDocs]);

  const toggleDoc = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const generate = useCallback(async () => {
    setBusy(true);
    setOutput("");
    try {
      const res = await fetch("/api/ai/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scribbleId,
          title: scribbleTitle,
          text: bodyOverride,
          tone,
          documentIds: selectedIds.length > 0 ? selectedIds : undefined,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(text || "Publish failed");
      }
      const json = (await res.json()) as { markdown: string };
      setOutput(json.markdown);
      toast({ title: "Draft ready", description: "Review and copy or download." });
    } catch (err) {
      toast({
        title: "Publish failed",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }, [bodyOverride, scribbleId, scribbleTitle, selectedIds, tone, toast]);

  const copy = useCallback(async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [output]);

  const download = useCallback(() => {
    if (!output) return;
    const blob = new Blob([output], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${scribbleTitle.replace(/[^a-z0-9-]+/gi, "-") || "scribble"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [output, scribbleTitle]);

  const docOptions = useMemo(
    () =>
      docs.map((d) => ({
        id: d.id,
        title: d.title,
        tags: d.tags,
      })),
    [docs]
  );

  if (!isOrgFeatureEnabled() || !shared) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className="p-2 rounded-lg text-cyan-400 hover:bg-cyan-400/10 transition-all duration-300"
          aria-label="Publish to workspace"
        >
          <Sparkles className="w-4 h-4" />
        </button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="bg-slate-950 border-l border-slate-800 text-white w-full sm:max-w-xl overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            Publish to workspace
          </SheetTitle>
          <SheetDescription className="text-slate-400">
            Polish this scribble into a long-form draft. Anchor on workspace documents to keep claims grounded.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 mt-5">
          <div className="space-y-2">
            <Label className="text-gray-300">Tone</Label>
            <Select value={tone} onValueChange={(v) => setTone(v as Tone)}>
              <SelectTrigger className="bg-slate-900 border-slate-800 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-cyan-700/30 text-white">
                <SelectItem value="neutral">Neutral</SelectItem>
                <SelectItem value="concise">Concise</SelectItem>
                <SelectItem value="executive">Executive</SelectItem>
                <SelectItem value="casual">Casual</SelectItem>
                <SelectItem value="technical">Technical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Anchor documents (optional)</Label>
            {docOptions.length === 0 ? (
              <p className="text-slate-500 text-xs">
                No documents in your workspace yet. Add one in the Documents tab.
              </p>
            ) : (
              <ul className="max-h-48 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900">
                {docOptions.map((d) => {
                  const checked = selectedIds.includes(d.id);
                  return (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => toggleDoc(d.id)}
                        className={`w-full text-left px-3 py-2 flex items-center justify-between gap-3 hover:bg-slate-800 transition-colors ${
                          checked ? "bg-cyan-500/10" : ""
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                          <span className="text-sm text-white truncate">{d.title}</span>
                        </span>
                        <span className="flex items-center gap-2 flex-shrink-0">
                          {d.tags.slice(0, 2).map((t) => (
                            <Badge
                              key={t}
                              variant="outline"
                              className="border-cyan-700/30 text-cyan-300 text-[10px] py-0"
                            >
                              {t}
                            </Badge>
                          ))}
                          {checked && <Check className="w-4 h-4 text-cyan-400" />}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <Button
            onClick={() => void generate()}
            disabled={busy}
            className="w-full bg-cyan-500 hover:bg-cyan-600 text-white"
          >
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Drafting...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" /> Generate draft
              </>
            )}
          </Button>

          {output && (
            <div className="space-y-3">
              <Label className="text-gray-300">Draft (Markdown)</Label>
              <Textarea
                value={output}
                onChange={(e) => setOutput(e.target.value)}
                className="bg-slate-900 border-slate-800 text-slate-100 font-mono text-sm min-h-[260px]"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => void copy()}
                  className="border-cyan-700/40 text-gray-200 hover:bg-slate-800"
                >
                  {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                  Copy
                </Button>
                <Button
                  variant="outline"
                  onClick={download}
                  className="border-cyan-700/40 text-gray-200 hover:bg-slate-800"
                >
                  <Download className="w-4 h-4 mr-2" /> Download .md
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
