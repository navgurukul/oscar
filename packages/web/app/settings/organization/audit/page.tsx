"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShieldCheck, FileText, Mic, Share2, Lock } from "lucide-react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { Spinner } from "@/components/ui/spinner";
import { organizationService } from "@/lib/services/organization.service";
import { ROUTES } from "@/lib/constants";
import { isOrgFeatureEnabled } from "@/lib/featureFlags";
import type { ActiveOrganization } from "@oscar/shared/types";

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

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AuditLogPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [active, setActive] = useState<ActiveOrganization | null>(null);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (!isOrgFeatureEnabled()) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <p className="text-gray-400">Audit log requires the organization feature flag.</p>
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

  if (active && active.role !== "owner" && active.role !== "admin") {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <p className="text-gray-300">Only owners or admins can view the audit log.</p>
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center px-4 pt-8 pb-24">
      <div className="w-full max-w-3xl mt-16 space-y-6">
        <Link
          href={ROUTES.ORG_SETTINGS}
          className="inline-flex items-center text-sm text-slate-400 hover:text-cyan-300"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Workspace settings
        </Link>

        <header className="space-y-1">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <ShieldCheck className="w-7 h-7 text-cyan-400" />
            Audit log
          </h1>
          <p className="text-gray-400">
            Every share / unshare action on scribbles and meetings in {active?.organization.name ?? "this workspace"}.
          </p>
        </header>

        {rows.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            Nothing logged yet. Activity will appear here as members share content with the workspace.
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => {
              const Icon = r.kind === "scribble" ? FileText : Mic;
              const ActionIcon = r.action === "shared" ? Share2 : Lock;
              const actor = r.actor_name ?? r.actor_email ?? "Unknown member";
              const targetHref =
                r.kind === "scribble"
                  ? `${ROUTES.SCRIBBLE}/${r.target_id}`
                  : `${ROUTES.MEETINGS}?meeting=${r.target_id}`;
              return (
                <li
                  key={r.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3"
                >
                  <ActionIcon
                    className={`w-4 h-4 flex-shrink-0 ${
                      r.action === "shared" ? "text-cyan-400" : "text-amber-300"
                    }`}
                  />
                  <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="text-white truncate">
                      <span className="font-medium">{actor}</span>{" "}
                      <span className="text-slate-400">
                        {r.action === "shared" ? "shared a" : "unshared a"} {r.kind}
                      </span>
                    </p>
                    <Link
                      href={targetHref}
                      className="text-xs text-cyan-400 hover:text-cyan-300 truncate block"
                    >
                      Open {r.kind}
                    </Link>
                  </div>
                  <span className="text-xs text-slate-500 flex-shrink-0">
                    {formatTime(r.created_at)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
