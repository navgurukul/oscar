"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { Spinner } from "@/components/ui/spinner";
import { organizationService } from "@/lib/services/organization.service";
import { ROUTES } from "@/lib/constants";
import { isOrgFeatureEnabled } from "@/lib/featureFlags";
import type { ActiveOrganization } from "@oscar/shared/types";
import {
  v2,
  v2Serif,
  v2Mono,
  V2Caps,
  V2Mono,
  V2Avatar,
  V2TeamHeader,
} from "@/components/v2/V2Primitives";

interface AuditRow {
  id: string;
  organization_id: string;
  actor_user_id: string | null;
  kind: "scribble" | "meeting";
  target_id: string;
  action: "shared" | "unshared";
  created_at: string;
  actor_name: string | null;
  actor_email: string | null;
}

type FilterKind = "all" | "shared" | "unshared" | "scribble" | "meeting";

function formatTime(iso: string) {
  return new Date(iso)
    .toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    .toUpperCase();
}

function KindGlyph({ kind }: { kind: "scribble" | "meeting" }) {
  if (kind === "meeting") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="6" width="13" height="12" rx="1.5" stroke={v2.inkSoft} strokeWidth="1.4" />
        <path d="M16 10l5-3v10l-5-3" stroke={v2.inkSoft} strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M5 4h11l3 3v13H5z" stroke={v2.inkSoft} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M8 10h8M8 14h8M8 18h5" stroke={v2.inkSoft} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export default function AuditLogPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [active, setActive] = useState<ActiveOrganization | null>(null);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKind>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const current = await organizationService.current();
      setActive(current);
      if (!current) {
        setRows([]);
        return;
      }
      const res = await fetch(`/api/org/${current.organization.id}/audit?limit=200`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as { items: AuditRow[] };
      setRows(json.items);
    } catch (err) {
      console.error("[audit] load failed", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOrgFeatureEnabled()) return;
    if (authLoading) return;
    if (!user) {
      router.push(`${ROUTES.AUTH}?redirectTo=${ROUTES.ORG_SETTINGS}/audit`);
      return;
    }
    void load();
  }, [authLoading, user, router, load]);

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "shared" || filter === "unshared") {
      return rows.filter((r) => r.action === filter);
    }
    return rows.filter((r) => r.kind === filter);
  }, [rows, filter]);

  const counts = useMemo(() => {
    return {
      shared: rows.filter((r) => r.action === "shared").length,
      unshared: rows.filter((r) => r.action === "unshared").length,
      scribbles: rows.filter((r) => r.kind === "scribble").length,
      meetings: rows.filter((r) => r.kind === "meeting").length,
    };
  }, [rows]);

  if (!isOrgFeatureEnabled()) {
    return (
      <main
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: v2.cream, color: v2.ink }}
      >
        <p style={{ color: v2.inkSoft }}>Audit log requires the organization feature flag.</p>
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

  if (active && active.role !== "owner" && active.role !== "admin") {
    return (
      <main
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: v2.cream, color: v2.ink }}
      >
        <p style={{ color: v2.inkSoft }}>Only owners or admins can view the audit log.</p>
      </main>
    );
  }

  const orgName = active?.organization.name ?? "Workspace";

  const chips: Array<[FilterKind, string]> = [
    ["all", "ALL"],
    ["shared", `SHARED · ${counts.shared}`],
    ["unshared", `UNSHARED · ${counts.unshared}`],
    ["scribble", `SCRIBBLES · ${counts.scribbles}`],
    ["meeting", `MINUTES · ${counts.meetings}`],
  ];

  return (
    <main
      style={{
        background: v2.cream,
        color: v2.ink,
        minHeight: "100vh",
        fontFamily: "var(--font-figtree), system-ui",
      }}
    >
      <V2TeamHeader active="SETTINGS" org={orgName} />

      <section className="px-6 md:px-14 pt-12 md:pt-14 pb-10">
        <Link href={ROUTES.ORG_SETTINGS}>
          <V2Caps>← BACK TO ORG SETTINGS</V2Caps>
        </Link>
        <h1
          className="mt-3"
          style={{
            fontFamily: v2Serif,
            fontSize: "clamp(40px, 6vw, 56px)",
            lineHeight: 0.98,
            letterSpacing: "-0.025em",
            fontWeight: 500,
          }}
        >
          Who shared <em style={{ fontStyle: "italic", color: v2.accent }}>what</em>, and when.
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed max-w-xl" style={{ color: v2.inkSoft }}>
          Every share / unshare action on Scribbles and Minutes inside {orgName}. Newest first.
        </p>
      </section>

      <section className="px-6 md:px-14 pb-20">
        {rows.length === 0 ? (
          <div className="py-16 text-center text-[14px]" style={{ color: v2.inkSoft }}>
            Nothing logged yet. Activity will appear here as members share content with the
            workspace.
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 flex-wrap mb-7">
              {chips.map(([key, label]) => {
                const isActive = filter === key;
                return (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    className="text-[11px] rounded-full px-3.5 py-1.5"
                    style={{
                      border: `1px solid ${isActive ? v2.ink : v2.rule}`,
                      color: isActive ? v2.cream : v2.inkSoft,
                      background: isActive ? v2.ink : "transparent",
                      fontFamily: v2Mono,
                      letterSpacing: "0.14em",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
              <V2Mono style={{ fontSize: 11, color: v2.inkFaint, marginLeft: "auto" }}>
                SHOWING {filtered.length} OF {rows.length}
              </V2Mono>
            </div>

            <ul className="space-y-px list-none p-0" style={{ borderTop: `1px solid ${v2.rule}` }}>
              {filtered.map((r) => {
                const actor = r.actor_name ?? r.actor_email ?? "Unknown member";
                const targetHref =
                  r.kind === "scribble"
                    ? `${ROUTES.SCRIBBLE}/${r.target_id}`
                    : `${ROUTES.MEETINGS}?meeting=${r.target_id}`;
                return (
                  <li
                    key={r.id}
                    className="grid grid-cols-12 gap-2 md:gap-4 items-center py-4"
                    style={{ borderBottom: `1px solid ${v2.rule}` }}
                  >
                    <V2Mono
                      style={{
                        fontSize: 11,
                        color: v2.ink,
                        gridColumn: "span 6 / span 6",
                        letterSpacing: "0.06em",
                      }}
                    >
                      <span className="md:hidden">{formatTime(r.created_at)}</span>
                    </V2Mono>
                    <V2Mono
                      style={{
                        fontSize: 11,
                        color: v2.ink,
                        gridColumn: "span 2 / span 2",
                        letterSpacing: "0.06em",
                      }}
                    >
                      <span className="hidden md:inline">{formatTime(r.created_at)}</span>
                    </V2Mono>
                    <div className="col-span-12 md:col-span-3 flex items-center gap-2.5">
                      <V2Avatar size={22} initial={actor.charAt(0).toUpperCase()} />
                      <span className="truncate" style={{ fontSize: 13, color: v2.ink }}>
                        {actor}
                      </span>
                    </div>
                    <div className="col-span-4 md:col-span-1">
                      <V2Mono
                        style={{
                          fontSize: 10.5,
                          letterSpacing: "0.16em",
                          textTransform: "uppercase",
                          color: r.action === "shared" ? v2.accent : "#8c2f25",
                        }}
                      >
                        {r.action === "shared" ? "↗ SHARED" : "↙ UNSHARED"}
                      </V2Mono>
                    </div>
                    <Link
                      href={targetHref}
                      className="col-span-7 md:col-span-5 flex items-center gap-2.5 min-w-0 hover:opacity-80"
                    >
                      <KindGlyph kind={r.kind} />
                      <span
                        style={{
                          fontSize: 14,
                          color: v2.ink,
                          fontFamily: v2Serif,
                          fontWeight: 500,
                          letterSpacing: "-0.005em",
                        }}
                        className="truncate"
                      >
                        Open {r.kind}
                      </span>
                    </Link>
                    <div className="col-span-1 text-right">
                      <V2Mono style={{ fontSize: 11, color: v2.inkFaint }}>→</V2Mono>
                    </div>
                  </li>
                );
              })}
            </ul>

            <p className="mt-7" style={{ fontFamily: v2Mono, fontSize: 11, color: v2.inkFaint }}>
              Older events archive after 12 months.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
