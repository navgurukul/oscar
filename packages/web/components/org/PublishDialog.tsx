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
          className="p-2 rounded-full transition-all duration-200"
          style={{ color: "#b8623d" }}
          aria-label="Publish to workspace"
        >
          <Sparkles className="w-4 h-4" />
        </button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl overflow-y-auto"
        style={{ background: "#f7f4ee", borderLeft: "1px solid #e5e0d6", color: "#1a1816" }}
      >
        <SheetHeader>
          <SheetTitle
            className="flex items-center gap-2"
            style={{
              fontFamily: '"EB Garamond", Georgia, serif',
              fontSize: 24,
              fontWeight: 500,
              letterSpacing: "-0.01em",
              color: "#1a1816",
            }}
          >
            <Sparkles className="w-5 h-5" style={{ color: "#b8623d" }} />
            Publish to workspace
          </SheetTitle>
          <SheetDescription style={{ color: "#5a5852" }}>
            Polish this Scribble into a long-form draft. Anchor on workspace documents to keep claims grounded.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 mt-5">
          <div className="space-y-2">
            <Label
              style={{
                fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "#8b8780",
                fontSize: 10,
              }}
            >
              TONE
            </Label>
            <Select value={tone} onValueChange={(v) => setTone(v as Tone)}>
              <SelectTrigger
                style={{ background: "#efeae0", border: "1px solid #e5e0d6", color: "#1a1816" }}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent style={{ background: "#f7f4ee", border: "1px solid #e5e0d6", color: "#1a1816" }}>
                <SelectItem value="neutral">Neutral</SelectItem>
                <SelectItem value="concise">Concise</SelectItem>
                <SelectItem value="executive">Executive</SelectItem>
                <SelectItem value="casual">Casual</SelectItem>
                <SelectItem value="technical">Technical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label
              style={{
                fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "#8b8780",
                fontSize: 10,
              }}
            >
              ANCHOR DOCUMENTS (OPTIONAL)
            </Label>
            {docOptions.length === 0 ? (
              <p className="text-xs" style={{ color: "#8b8780" }}>
                No documents in your workspace yet. Add one in the Documents tab.
              </p>
            ) : (
              <ul
                className="max-h-48 overflow-y-auto rounded-lg"
                style={{ background: "#efeae0", border: "1px solid #e5e0d6" }}
              >
                {docOptions.map((d) => {
                  const checked = selectedIds.includes(d.id);
                  return (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => toggleDoc(d.id)}
                        className="w-full text-left px-3 py-2 flex items-center justify-between gap-3 transition-colors"
                        style={{
                          background: checked ? "rgba(184,98,61,0.10)" : "transparent",
                          color: "#1a1816",
                        }}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <FileText
                            className="w-4 h-4 flex-shrink-0"
                            style={{ color: "#b8623d" }}
                          />
                          <span className="text-sm truncate">{d.title}</span>
                        </span>
                        <span className="flex items-center gap-2 flex-shrink-0">
                          {d.tags.slice(0, 2).map((t) => (
                            <Badge
                              key={t}
                              variant="outline"
                              className="text-[10px] py-0"
                              style={{ border: "1px solid #b8623d", color: "#b8623d" }}
                            >
                              {t}
                            </Badge>
                          ))}
                          {checked && <Check className="w-4 h-4" style={{ color: "#b8623d" }} />}
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
            className="w-full"
            style={{ background: "#1a1816", color: "#f7f4ee" }}
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
              <Label
                style={{
                  fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "#8b8780",
                  fontSize: 10,
                }}
              >
                DRAFT (MARKDOWN)
              </Label>
              <Textarea
                value={output}
                onChange={(e) => setOutput(e.target.value)}
                className="font-mono text-sm min-h-[260px]"
                style={{ background: "#efeae0", border: "1px solid #e5e0d6", color: "#1a1816" }}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => void copy()}
                  style={{ background: "transparent", border: "1px solid #e5e0d6", color: "#5a5852" }}
                >
                  {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                  Copy
                </Button>
                <Button
                  variant="outline"
                  onClick={download}
                  style={{ background: "transparent", border: "1px solid #e5e0d6", color: "#5a5852" }}
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
