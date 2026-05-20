"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Search, Tag as TagIcon } from "lucide-react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DocumentUploader } from "@/components/documents/DocumentUploader";
import { documentsService } from "@/lib/services/documents.service";
import { ROUTES } from "@/lib/constants";
import { isOrgFeatureEnabled } from "@/lib/featureFlags";
import type { OrgDocument, Organization } from "@oscar/shared/types";

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function DocsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [docs, setDocs] = useState<OrgDocument[]>([]);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  const load = useCallback(async (search?: string) => {
    setLoading(true);
    try {
      const { items, organization } = await documentsService.list({ search });
      setDocs(items);
      setOrganization(organization);
    } catch (err) {
      console.error("[docs] load failed", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOrgFeatureEnabled()) return;
    if (authLoading) return;
    if (!user) {
      router.push(`${ROUTES.AUTH}?redirectTo=${ROUTES.TEAM}/docs`);
      return;
    }
    void load();
  }, [authLoading, user, router, load]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!isOrgFeatureEnabled() || authLoading || !user) return;
    void load(debounced);
  }, [debounced, load, authLoading, user]);

  const onUploaded = useCallback((doc: OrgDocument) => {
    setDocs((prev) => [doc, ...prev]);
  }, []);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const d of docs) d.tags.forEach((t) => set.add(t));
    return Array.from(set).sort();
  }, [docs]);

  if (!isOrgFeatureEnabled()) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <p className="text-gray-400">Document library requires the organization feature flag.</p>
      </main>
    );
  }

  if (authLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Spinner className="text-cyan-500" />
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 pt-28 pb-24 max-w-3xl mx-auto">
      <header className="mb-6 space-y-1">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <FileText className="w-7 h-7 text-cyan-400" />
          Documents
        </h1>
        <p className="text-slate-400 text-sm">
          {organization
            ? `Reference library for ${organization.name}. Anything you add here can anchor AI rewrites.`
            : "Join a workspace to add documents."}
        </p>
      </header>

      <div className="mb-6">
        <DocumentUploader onUploaded={onUploaded} />
      </div>

      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <Input
          placeholder="Search title, summary, or content..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 bg-slate-900 border-slate-800 text-white"
        />
      </div>

      {allTags.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {allTags.map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className="border-cyan-700/40 text-cyan-300 cursor-pointer hover:bg-cyan-500/10"
              onClick={() => setQuery(tag)}
            >
              <TagIcon className="w-3 h-3 mr-1" /> {tag}
            </Badge>
          ))}
        </div>
      )}

      {loading ? (
        <div className="py-12 flex justify-center">
          <Spinner className="text-cyan-500" />
        </div>
      ) : docs.length === 0 ? (
        <div className="py-12 text-center text-slate-400 text-sm">
          {debounced ? "No documents match your search." : "No documents yet. Drop a file above to start."}
        </div>
      ) : (
        <ul className="space-y-3">
          {docs.map((doc) => (
            <li key={doc.id}>
              <Link
                href={`/team/docs/${doc.id}`}
                className="block rounded-2xl border border-slate-800 bg-slate-900 p-5 hover:border-cyan-700/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h2 className="text-white font-semibold leading-tight truncate">{doc.title}</h2>
                  <span className="text-xs text-slate-500 flex-shrink-0">
                    {formatDate(doc.created_at)}
                  </span>
                </div>
                {doc.summary ? (
                  <p className="text-slate-400 text-sm line-clamp-2">{doc.summary}</p>
                ) : doc.extracted_text ? (
                  <p className="text-slate-400 text-sm line-clamp-2">
                    {doc.extracted_text.slice(0, 240)}
                  </p>
                ) : null}
                <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
                  <span>{formatSize(doc.size_bytes)}</span>
                  {doc.tags.slice(0, 4).map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="border-cyan-700/30 text-cyan-300 text-[10px] py-0"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
