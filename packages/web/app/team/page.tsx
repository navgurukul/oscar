"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Mic, Users, Filter } from "lucide-react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ROUTES } from "@/lib/constants";
import { isOrgFeatureEnabled } from "@/lib/featureFlags";
import type { Organization } from "@oscar/shared/types";

type FeedKind = "scribble" | "meeting";

interface FeedItem {
  kind: FeedKind;
  id: string;
  title: string;
  preview: string;
  created_at: string;
  user_id: string;
  author_name: string | null;
  author_email: string | null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function TeamFeedPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [kindFilter, setKindFilter] = useState<FeedKind | "all">("all");
  const [authorFilter, setAuthorFilter] = useState<string | "all">("all");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/team/feed", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load feed");
      const json = (await res.json()) as { items: FeedItem[]; organization: Organization | null };
      setItems(json.items);
      setOrganization(json.organization);
    } catch (err) {
      console.error("[team feed] load failed", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOrgFeatureEnabled()) return;
    if (authLoading) return;
    if (!user) {
      router.push(`${ROUTES.AUTH}?redirectTo=${ROUTES.TEAM}`);
      return;
    }
    void load();
  }, [authLoading, user, router, load]);

  const authors = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) {
      const label = item.author_name ?? item.author_email ?? "Unknown";
      map.set(item.user_id, label);
    }
    return Array.from(map.entries());
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (kindFilter !== "all" && it.kind !== kindFilter) return false;
      if (authorFilter !== "all" && it.user_id !== authorFilter) return false;
      if (q) {
        const hay = `${it.title} ${it.preview} ${it.author_name ?? ""} ${it.author_email ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, kindFilter, authorFilter, query]);

  if (!isOrgFeatureEnabled()) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <p className="text-gray-400">Team feed requires the organization feature flag.</p>
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

  return (
    <main className="min-h-screen px-4 pt-28 pb-24 max-w-3xl mx-auto">
      <header className="mb-6 space-y-1">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Users className="w-7 h-7 text-cyan-400" />
          Team feed
        </h1>
        <p className="text-slate-400 text-sm">
          {organization
            ? `Scribbles and meetings shared with ${organization.name}.`
            : "Join a workspace to see shared content."}
        </p>
      </header>

      <div className="mb-5 flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Search the feed..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="bg-slate-900 border-slate-800 text-white"
        />
        <Select value={kindFilter} onValueChange={(v) => setKindFilter(v as FeedKind | "all")}>
          <SelectTrigger className="w-full sm:w-36 bg-slate-900 border-slate-800 text-white">
            <Filter className="w-4 h-4 mr-2 text-cyan-400" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-cyan-700/30 text-white">
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="scribble">Scribbles</SelectItem>
            <SelectItem value="meeting">Meetings</SelectItem>
          </SelectContent>
        </Select>
        <Select value={authorFilter} onValueChange={setAuthorFilter}>
          <SelectTrigger className="w-full sm:w-48 bg-slate-900 border-slate-800 text-white">
            <SelectValue placeholder="All authors" />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-cyan-700/30 text-white">
            <SelectItem value="all">All authors</SelectItem>
            {authors.map(([id, label]) => (
              <SelectItem key={id} value={id}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center text-slate-400 text-sm">
          {items.length === 0
            ? "Nothing shared yet. Open a scribble or meeting and tap the share icon to publish it here."
            : "No items match your filters."}
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((item) => {
            const href =
              item.kind === "scribble"
                ? `${ROUTES.SCRIBBLE}/${item.id}`
                : `${ROUTES.MEETINGS}?meeting=${item.id}`;
            const Icon = item.kind === "scribble" ? FileText : Mic;
            return (
              <li key={`${item.kind}:${item.id}`}>
                <Link
                  href={href}
                  className="block rounded-2xl border border-slate-800 bg-slate-900 p-5 hover:border-cyan-700/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h2 className="text-white font-semibold leading-tight truncate">
                      <Icon className="w-4 h-4 inline mr-2 -mt-0.5 text-cyan-400" />
                      {item.title}
                    </h2>
                    <span className="text-xs text-slate-500 flex-shrink-0">
                      {formatDate(item.created_at)}
                    </span>
                  </div>
                  {item.preview && (
                    <p className="text-slate-400 text-sm line-clamp-2">{item.preview}</p>
                  )}
                  <div className="mt-3 text-xs text-slate-500">
                    by {item.author_name ?? item.author_email ?? "Unknown"}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
