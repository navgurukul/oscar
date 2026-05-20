"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, Trash2, Save, Tag as TagIcon } from "lucide-react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { isOrgFeatureEnabled } from "@/lib/featureFlags";
import type { OrgDocumentWithDownload } from "@oscar/shared/types";

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
    if (!isOrgFeatureEnabled()) return;
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

  if (!isOrgFeatureEnabled()) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <p className="text-gray-400">Document library requires the organization feature flag.</p>
      </main>
    );
  }

  if (authLoading || loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Spinner className="text-cyan-500" />
      </main>
    );
  }

  if (!doc) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-4 gap-3">
        <p className="text-gray-300">Document not found.</p>
        <Link href="/team/docs" className="text-cyan-400 hover:text-cyan-300">
          ← Back to documents
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 pt-28 pb-24 max-w-3xl mx-auto">
      <Link
        href="/team/docs"
        className="inline-flex items-center text-sm text-slate-400 hover:text-cyan-300 mb-4"
      >
        <ArrowLeft className="w-4 h-4 mr-1" /> All documents
      </Link>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-5">
        <div className="space-y-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-xl font-semibold text-white bg-transparent border-slate-800"
          />
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>{doc.mime_type ?? "Unknown type"}</span>
            <span>{new Date(doc.created_at).toLocaleString()}</span>
            {doc.download_url && (
              <a
                href={doc.download_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-cyan-400 hover:text-cyan-300"
              >
                <Download className="w-3 h-3 mr-1" /> original
              </a>
            )}
          </div>
        </div>

        {doc.summary && (
          <div className="rounded-xl border border-cyan-700/30 bg-cyan-500/5 p-4 text-slate-200 text-sm">
            <p className="text-cyan-300 text-xs uppercase tracking-wide mb-1">Summary</p>
            <p>{doc.summary}</p>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-slate-500">Tags</p>
          <div className="flex items-center gap-2">
            <Input
              placeholder="design, onboarding, api..."
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className="bg-slate-800 border-slate-700 text-white text-sm"
            />
            <Button
              onClick={saveMeta}
              disabled={savingMeta}
              className="bg-cyan-500 hover:bg-cyan-600 text-white"
            >
              <Save className="w-4 h-4 mr-2" /> Save
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {doc.tags.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="border-cyan-700/40 text-cyan-300"
              >
                <TagIcon className="w-3 h-3 mr-1" /> {tag}
              </Badge>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Extracted text</p>
          <Textarea
            readOnly
            value={doc.extracted_text ?? "(empty)"}
            className="bg-slate-950 border-slate-800 text-slate-200 text-sm font-mono min-h-[320px]"
          />
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              <Trash2 className="w-4 h-4 mr-2" /> Delete document
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="bg-slate-900 border-slate-800 text-white">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this document?</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-400">
                It will be removed from the workspace immediately. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-slate-800 text-white border-slate-700">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => void remove()}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </main>
  );
}
