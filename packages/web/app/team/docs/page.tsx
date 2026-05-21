"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { Spinner } from "@/components/ui/spinner";
import { DocumentUploader } from "@/components/documents/DocumentUploader";
import { documentsService } from "@/lib/services/documents.service";
import { ROUTES } from "@/lib/constants";
import type { OrgDocument, Organization } from "@oscar/shared/types";
import {
  v2,
  v2Serif,
  V2Caps,
  V2Mono,
  V2TeamHeader,
} from "@/components/v2/V2Primitives";

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso)
    .toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
    .toUpperCase();
}

export default function DocsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [docs, setDocs] = useState<OrgDocument[]>([]);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

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
    if (authLoading || !user) return;
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

  const filtered = useMemo(() => {
    if (!activeTag) return docs;
    return docs.filter((d) => d.tags.includes(activeTag));
  }, [docs, activeTag]);

  if (authLoading) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ background: v2.cream }}
      >
        <Spinner />
      </main>
    );
  }

  return (
    <main
      style={{
        background: v2.cream,
        color: v2.ink,
        minHeight: "100vh",
        fontFamily: "var(--font-figtree), system-ui",
      }}
    >
      <V2TeamHeader active="DOCS" org={organization?.name || "Workspace"} />

      <section className="px-6 md:px-14 pt-12 md:pt-14 pb-8 md:pb-10">
        <V2Caps>WORKSPACE DOCS · {docs.length}</V2Caps>
        <h1
          className="mt-3"
          style={{
            fontFamily: v2Serif,
            fontSize: "clamp(40px, 7vw, 68px)",
            lineHeight: 0.96,
            letterSpacing: "-0.025em",
            fontWeight: 500,
          }}
        >
          Everything we&rsquo;ve <em style={{ fontStyle: "italic", color: v2.accent }}>written</em>{" "}
          together.
        </h1>

        <div className="mt-8">
          <DocumentUploader onUploaded={onUploaded} />
        </div>

        <div
          className="mt-8 flex items-center gap-3 max-w-xl rounded-full pl-5 pr-4 py-2.5"
          style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}
        >
          <Search className="h-4 w-4" style={{ color: v2.inkFaint }} />
          <input
            placeholder="Search title, summary, content..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent outline-none text-[14px]"
            style={{ color: v2.ink }}
          />
        </div>

        {allTags.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTag(null)}
              className="rounded-full px-3 py-1 text-[11px] transition"
              style={{
                background: activeTag === null ? v2.ink : "transparent",
                color: activeTag === null ? v2.cream : v2.inkSoft,
                border: `1px solid ${activeTag === null ? v2.ink : v2.rule}`,
              }}
            >
              All
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className="rounded-full px-3 py-1 text-[11px] transition"
                style={{
                  background: activeTag === tag ? v2.accent : "transparent",
                  color: activeTag === tag ? v2.cream : v2.accent,
                  border: `1px solid ${activeTag === tag ? v2.accent : v2.rule}`,
                }}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="px-6 md:px-14 pb-16 md:pb-20">
        {loading ? (
          <div className="py-12 flex justify-center">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-[14px]" style={{ color: v2.inkSoft }}>
            {debounced || activeTag
              ? "No documents match your filters."
              : "No documents yet. Drop a file above to start."}
          </div>
        ) : (
          <div>
            {filtered.map((doc) => (
              <Link
                key={doc.id}
                href={`/team/docs/${doc.id}`}
                className="grid grid-cols-12 gap-4 md:gap-6 py-5"
                style={{ borderTop: `1px solid ${v2.rule}` }}
              >
                <div className="col-span-12 md:col-span-2">
                  <V2Mono style={{ fontSize: 11, color: v2.ink }}>
                    {formatDate(doc.created_at)}
                  </V2Mono>
                </div>
                <div className="col-span-12 md:col-span-7">
                  <h3
                    style={{
                      fontFamily: v2Serif,
                      fontSize: 19,
                      fontWeight: 500,
                      letterSpacing: "-0.005em",
                    }}
                  >
                    {doc.title}
                  </h3>
                  {(doc.summary || doc.extracted_text) && (
                    <p
                      className="mt-1.5 text-[13px] leading-relaxed line-clamp-2"
                      style={{ color: v2.inkSoft }}
                    >
                      {doc.summary || doc.extracted_text?.slice(0, 220)}
                    </p>
                  )}
                  {doc.tags.length > 0 && (
                    <div className="mt-2 flex items-center gap-3">
                      {doc.tags.slice(0, 4).map((tag) => (
                        <span key={tag} style={{ fontSize: 11, color: v2.accent }}>
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="col-span-12 md:col-span-3 text-right">
                  <V2Mono style={{ fontSize: 11, color: v2.inkFaint }}>
                    {formatSize(doc.size_bytes)}
                  </V2Mono>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
