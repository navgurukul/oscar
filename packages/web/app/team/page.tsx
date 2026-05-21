"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { Spinner } from "@/components/ui/spinner";
import { ROUTES } from "@/lib/constants";
import { isOrgFeatureEnabled } from "@/lib/featureFlags";
import type { Organization } from "@oscar/shared/types";
import {
  v2,
  v2Serif,
  V2Caps,
  V2Mono,
  V2TeamHeader,
} from "@/components/v2/V2Primitives";

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
  return new Date(iso)
    .toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
    .toUpperCase();
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
      <main
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: v2.cream, color: v2.ink }}
      >
        <p style={{ color: v2.inkSoft }}>Team feed requires the organization feature flag.</p>
      </main>
    );
  }

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

  return (
    <main
      style={{
        background: v2.cream,
        color: v2.ink,
        minHeight: "100vh",
        fontFamily: "var(--font-figtree), system-ui",
      }}
    >
      <V2TeamHeader active="FEED" org={organization?.name || "Workspace"} />

      <div className="grid grid-cols-12 gap-6 md:gap-10 px-6 md:px-14 py-10 md:py-14">
        <aside className="col-span-12 md:col-span-3">
          <V2Caps>WORKSPACE</V2Caps>
          <div className="mt-4 space-y-3 text-[13px]">
            <button
              onClick={() => setKindFilter("all")}
              className="w-full flex items-center justify-between"
              style={{
                color: kindFilter === "all" ? v2.ink : v2.inkSoft,
                fontWeight: kindFilter === "all" ? 500 : 400,
              }}
            >
              <span>{kindFilter === "all" ? "→ " : ""}Feed</span>
              <V2Mono style={{ fontSize: 11, color: v2.inkFaint }}>{items.length}</V2Mono>
            </button>
            <button
              onClick={() => setKindFilter("scribble")}
              className="w-full flex items-center justify-between"
              style={{
                color: kindFilter === "scribble" ? v2.ink : v2.inkSoft,
                fontWeight: kindFilter === "scribble" ? 500 : 400,
              }}
            >
              <span>{kindFilter === "scribble" ? "→ " : ""}Scribbles</span>
              <V2Mono style={{ fontSize: 11, color: v2.inkFaint }}>
                {items.filter((i) => i.kind === "scribble").length}
              </V2Mono>
            </button>
            <button
              onClick={() => setKindFilter("meeting")}
              className="w-full flex items-center justify-between"
              style={{
                color: kindFilter === "meeting" ? v2.ink : v2.inkSoft,
                fontWeight: kindFilter === "meeting" ? 500 : 400,
              }}
            >
              <span>{kindFilter === "meeting" ? "→ " : ""}Meetings</span>
              <V2Mono style={{ fontSize: 11, color: v2.inkFaint }}>
                {items.filter((i) => i.kind === "meeting").length}
              </V2Mono>
            </button>
          </div>

          {authors.length > 0 && (
            <div className="mt-9 pt-6" style={{ borderTop: `1px solid ${v2.rule}` }}>
              <V2Caps>AUTHORS · {authors.length}</V2Caps>
              <div className="mt-4 space-y-2 text-[13px]">
                <button
                  onClick={() => setAuthorFilter("all")}
                  className="w-full text-left"
                  style={{
                    color: authorFilter === "all" ? v2.ink : v2.inkSoft,
                    fontWeight: authorFilter === "all" ? 500 : 400,
                  }}
                >
                  {authorFilter === "all" ? "→ " : ""}Everyone
                </button>
                {authors.map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setAuthorFilter(id)}
                    className="w-full text-left truncate"
                    style={{
                      color: authorFilter === id ? v2.ink : v2.inkSoft,
                      fontWeight: authorFilter === id ? 500 : 400,
                    }}
                  >
                    {authorFilter === id ? "→ " : ""}
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        <main className="col-span-12 md:col-span-9">
          <V2Caps>
            {organization?.name?.toUpperCase() || "WORKSPACE"} · FEED
          </V2Caps>
          <h1
            className="mt-2"
            style={{
              fontFamily: v2Serif,
              fontSize: "clamp(36px, 6vw, 56px)",
              lineHeight: 0.98,
              letterSpacing: "-0.025em",
              fontWeight: 500,
            }}
          >
            What the team <em style={{ fontStyle: "italic", color: v2.accent }}>shipped</em>.
          </h1>

          <div
            className="mt-8 flex items-center gap-3 max-w-md rounded-full pl-5 pr-4 py-2"
            style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}
          >
            <V2Mono style={{ fontSize: 11, color: v2.inkFaint }}>SEARCH</V2Mono>
            <input
              placeholder="Search the feed..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent outline-none text-[14px]"
              style={{ color: v2.ink }}
            />
          </div>

          {filtered.length === 0 ? (
            <div className="py-16 text-center text-[14px]" style={{ color: v2.inkSoft }}>
              {items.length === 0
                ? "Nothing shared yet. Share a Scribble or Meeting to publish here."
                : "No items match your filters."}
            </div>
          ) : (
            <div className="mt-10">
              {filtered.map((item) => {
                const href =
                  item.kind === "scribble"
                    ? `${ROUTES.SCRIBBLE}/${item.id}`
                    : `${ROUTES.MEETINGS}?meeting=${item.id}`;
                return (
                  <Link
                    key={`${item.kind}:${item.id}`}
                    href={href}
                    className="grid grid-cols-12 gap-4 md:gap-6 py-6"
                    style={{ borderTop: `1px solid ${v2.rule}` }}
                  >
                    <div className="col-span-12 md:col-span-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          style={{
                            display: "inline-block",
                            height: 28,
                            width: 28,
                            borderRadius: 999,
                            background: v2.cream2,
                            color: v2.ink,
                            fontFamily: v2Serif,
                            fontWeight: 500,
                            fontSize: 13,
                            textAlign: "center",
                            lineHeight: "28px",
                          }}
                        >
                          {(item.author_name ?? item.author_email ?? "?").charAt(0).toUpperCase()}
                        </span>
                        <span style={{ fontSize: 13, color: v2.ink }}>
                          {item.author_name ?? item.author_email ?? "Unknown"}
                        </span>
                      </div>
                      <V2Caps>
                        {formatDate(item.created_at)} ·{" "}
                        {item.kind === "scribble" ? "SCRIBBLE" : "MINUTES"}
                      </V2Caps>
                    </div>
                    <div className="col-span-12 md:col-span-9">
                      <h3
                        style={{
                          fontFamily: v2Serif,
                          fontSize: 22,
                          fontWeight: 500,
                          letterSpacing: "-0.005em",
                          lineHeight: 1.25,
                        }}
                      >
                        {item.title}
                      </h3>
                      {item.preview && (
                        <p
                          className="mt-2 text-[14px] leading-relaxed"
                          style={{ color: v2.inkSoft, maxWidth: 720 }}
                        >
                          {item.preview}
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </main>
  );
}
