"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Trash2, Save, Tag as TagIcon } from "lucide-react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { documentsService } from "@/lib/services/documents.service";
import { ROUTES } from "@/lib/constants";
import type { OrgDocumentWithDownload } from "@oscar/shared/types";
import {
  v2,
  v2Serif,
  V2Caps,
  V2Mono,
  V2Avatar,
  V2TeamHeader,
} from "@/components/v2/V2Primitives";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DocumentViewerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const [doc, setDoc] = useState<OrgDocumentWithDownload | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [savingMeta, setSavingMeta] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await documentsService.get(id);
      setDoc(data);
      setTitle(data.title);
      setTagsInput(data.tags.join(", "));
    } catch (err) {
      console.error("[doc] load failed", err);
      toast({
        title: "Could not load document",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push(`${ROUTES.AUTH}?redirectTo=/team/docs/${id}`);
      return;
    }
    void load();
  }, [authLoading, user, router, load, id]);

  const saveMeta = useCallback(async () => {
    if (!doc) return;
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    setSavingMeta(true);
    try {
      const updated = await documentsService.update(doc.id, {
        title: title.trim() || doc.title,
        tags,
      });
      setDoc({ ...updated, download_url: doc.download_url });
      toast({ title: "Saved" });
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSavingMeta(false);
    }
  }, [doc, tagsInput, title, toast]);

  const remove = useCallback(async () => {
    if (!doc) return;
    try {
      await documentsService.remove(doc.id);
      toast({ title: "Document removed" });
      router.push("/team/docs");
    } catch (err) {
      toast({
        title: "Delete failed",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    }
  }, [doc, router, toast]);

  if (authLoading || loading) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ background: v2.cream }}
      >
        <Spinner />
      </main>
    );
  }

  if (!doc) {
    return (
      <main
        className="min-h-screen flex flex-col items-center justify-center px-4 gap-3"
        style={{ background: v2.cream, color: v2.ink }}
      >
        <p style={{ color: v2.inkSoft }}>Document not found.</p>
        <Link href="/team/docs" style={{ color: v2.accent }}>
          ← Back to documents
        </Link>
      </main>
    );
  }

  const wordCount = (doc.extracted_text ?? "").trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(wordCount / 220));

  return (
    <main
      style={{
        background: v2.cream,
        color: v2.ink,
        minHeight: "100vh",
        fontFamily: "var(--font-figtree), system-ui",
      }}
    >
      <V2TeamHeader active="DOCS" />

      <article className="mx-auto px-6 md:px-14 py-10 md:py-14" style={{ maxWidth: 1080 }}>
        <Link href="/team/docs">
          <V2Caps>← BACK TO DOCS · WORKSPACE</V2Caps>
        </Link>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => void saveMeta()}
          className="mt-3 w-full bg-transparent outline-none"
          style={{
            fontFamily: v2Serif,
            fontSize: "clamp(40px, 7vw, 64px)",
            lineHeight: 0.96,
            letterSpacing: "-0.025em",
            fontWeight: 500,
            color: v2.ink,
          }}
        />

        <div className="mt-5 flex items-center gap-4 md:gap-6 flex-wrap">
          <div className="flex items-center gap-2.5">
            <V2Avatar size={26} initial="W" />
            <span style={{ fontSize: 13, color: v2.ink }}>Workspace doc</span>
          </div>
          <V2Caps>
            POSTED {formatDate(doc.created_at).toUpperCase()} ·{" "}
            {wordCount > 0 ? `${wordCount} WORDS · ${minutes} MIN READ` : (doc.mime_type ?? "DOCUMENT")}
          </V2Caps>
          {doc.download_url && (
            <a
              href={doc.download_url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto inline-flex items-center gap-1.5 text-[12px] rounded-full px-3.5 py-1.5"
              style={{ border: `1px solid ${v2.rule}`, color: v2.inkSoft }}
            >
              <Download className="w-3 h-3" /> Original
            </a>
          )}
        </div>

        <div className="mt-12 grid grid-cols-12 gap-8 md:gap-10">
          <div className="col-span-12 lg:col-span-8">
            {doc.summary && (
              <p
                style={{
                  fontFamily: v2Serif,
                  fontSize: 24,
                  lineHeight: 1.45,
                  color: v2.ink,
                  letterSpacing: "-0.005em",
                }}
              >
                {doc.summary}
              </p>
            )}

            <div className="mt-10">
              <V2Caps>EXTRACTED TEXT</V2Caps>
              <Textarea
                readOnly
                value={doc.extracted_text ?? "(empty)"}
                className="mt-3 text-sm font-mono"
                style={{
                  background: v2.cream2,
                  border: `1px solid ${v2.rule}`,
                  color: v2.ink,
                  minHeight: 360,
                }}
              />
            </div>
          </div>

          <aside
            className="col-span-12 lg:col-span-4 space-y-8"
            style={{ borderLeft: `1px solid ${v2.rule}`, paddingLeft: 24 }}
          >
            <div>
              <V2Caps>TAGS</V2Caps>
              <div className="mt-2 flex items-center gap-2">
                <Input
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="design, onboarding, api…"
                  className="text-sm flex-1"
                  style={{
                    background: v2.cream2,
                    border: `1px solid ${v2.rule}`,
                    color: v2.ink,
                  }}
                />
                <button
                  onClick={() => void saveMeta()}
                  disabled={savingMeta}
                  className="rounded-full p-2 disabled:opacity-50"
                  style={{ color: v2.accent }}
                  title="Save tags"
                >
                  <Save className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {doc.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px]"
                    style={{ border: `1px solid ${v2.rule}`, color: v2.accent }}
                  >
                    <TagIcon className="w-3 h-3" /> {tag}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <V2Caps>METADATA</V2Caps>
              <div className="mt-3 space-y-2 text-[13px]" style={{ color: v2.inkSoft }}>
                <div className="flex justify-between">
                  <span>Created</span>
                  <V2Mono style={{ fontSize: 11, color: v2.ink }}>
                    {formatDate(doc.created_at)}
                  </V2Mono>
                </div>
                {doc.mime_type && (
                  <div className="flex justify-between">
                    <span>Type</span>
                    <V2Mono style={{ fontSize: 11, color: v2.ink }}>{doc.mime_type}</V2Mono>
                  </div>
                )}
                {doc.size_bytes && (
                  <div className="flex justify-between">
                    <span>Size</span>
                    <V2Mono style={{ fontSize: 11, color: v2.ink }}>
                      {(doc.size_bytes / 1024).toFixed(0)} KB
                    </V2Mono>
                  </div>
                )}
              </div>
            </div>

            <div>
              <V2Caps color={v2.danger}>DANGER</V2Caps>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    className="mt-2 inline-flex items-center gap-2 text-[12px] rounded-full px-4 py-2"
                    style={{ border: `1px solid ${v2.dangerSoft}`, color: v2.danger }}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete document
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent
                  style={{
                    background: v2.cream,
                    border: `1px solid ${v2.rule}`,
                    color: v2.ink,
                  }}
                >
                  <AlertDialogHeader>
                    <AlertDialogTitle
                      style={{
                        fontFamily: v2Serif,
                        fontSize: 24,
                        fontWeight: 500,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      Delete this document?
                    </AlertDialogTitle>
                    <AlertDialogDescription style={{ color: v2.inkSoft }}>
                      It will be removed from the workspace immediately. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel
                      style={{ background: "transparent", border: `1px solid ${v2.rule}`, color: v2.inkSoft }}
                    >
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => void remove()}
                      style={{ background: v2.danger, color: v2.cream }}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </aside>
        </div>
      </article>
    </main>
  );
}
