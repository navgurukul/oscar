"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BarChart3, Users, FileText, Mic, BookOpen } from "lucide-react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { Spinner } from "@/components/ui/spinner";
import { organizationService } from "@/lib/services/organization.service";
import { ROUTES } from "@/lib/constants";
import { isOrgFeatureEnabled } from "@/lib/featureFlags";
import type { ActiveOrganization } from "@oscar/shared/types";

interface AnalyticsResponse {
  member_count: number;
  shared_scribbles: number;
  shared_meetings: number;
  document_count: number;
  monthly_recordings: Array<{ month: string; count: number }>;
  member_scribbles_this_month: Array<{
    user_id: string;
    count: number;
    name: string | null;
    email: string | null;
  }>;
}

function formatMonth(month: string): string {
  const [year, m] = month.split("-").map((s) => Number(s));
  return new Date(year, m - 1, 1).toLocaleDateString(undefined, {
    month: "short",
    year: "2-digit",
  });
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div className="flex items-center gap-2 text-slate-400 text-xs uppercase tracking-wide">
        <Icon className="w-4 h-4 text-cyan-400" />
        {label}
      </div>
      <p className="mt-2 text-white text-2xl font-semibold">{value}</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [active, setActive] = useState<ActiveOrganization | null>(null);
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const current = await organizationService.current();
      setActive(current);
      if (!current) return;
      const res = await fetch(`/api/org/${current.organization.id}/analytics`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as AnalyticsResponse;
      setData(json);
    } catch (err) {
      console.error("[analytics] load failed", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOrgFeatureEnabled()) return;
    if (authLoading) return;
    if (!user) {
      router.push(`${ROUTES.AUTH}?redirectTo=${ROUTES.ORG_SETTINGS}/analytics`);
      return;
    }
    void load();
  }, [authLoading, user, router, load]);

  const maxMonthlyRecordings = useMemo(() => {
    if (!data?.monthly_recordings.length) return 0;
    return Math.max(...data.monthly_recordings.map((m) => m.count), 1);
  }, [data]);

  const maxMemberCount = useMemo(() => {
    if (!data?.member_scribbles_this_month.length) return 1;
    return Math.max(...data.member_scribbles_this_month.map((m) => m.count), 1);
  }, [data]);

  if (!isOrgFeatureEnabled()) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <p className="text-gray-400">Analytics requires the organization feature flag.</p>
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
        <p className="text-gray-300">Only owners or admins can view analytics.</p>
      </main>
    );
  }

  if (!data || !active) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <p className="text-gray-300">No data yet.</p>
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
            <BarChart3 className="w-7 h-7 text-cyan-400" />
            Analytics
          </h1>
          <p className="text-gray-400">Usage for {active.organization.name}.</p>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Members" value={data.member_count} icon={Users} />
          <StatCard label="Shared scribbles" value={data.shared_scribbles} icon={FileText} />
          <StatCard label="Shared meetings" value={data.shared_meetings} icon={Mic} />
          <StatCard label="Documents" value={data.document_count} icon={BookOpen} />
        </div>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-3">
          <h2 className="text-white font-semibold">Recordings — last 6 months</h2>
          <div className="space-y-2">
            {data.monthly_recordings.map((m) => (
              <div key={m.month} className="flex items-center gap-3">
                <span className="w-14 text-xs text-slate-400">{formatMonth(m.month)}</span>
                <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-cyan-500"
                    style={{ width: `${(m.count / maxMonthlyRecordings) * 100}%` }}
                  />
                </div>
                <span className="w-10 text-right text-xs text-slate-300">{m.count}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-3">
          <h2 className="text-white font-semibold">
            Scribbles created this month, by member
          </h2>
          {data.member_scribbles_this_month.length === 0 ? (
            <p className="text-slate-400 text-sm">No scribbles yet this month.</p>
          ) : (
            <ul className="space-y-2">
              {data.member_scribbles_this_month.map((m) => (
                <li key={m.user_id} className="flex items-center gap-3 text-sm">
                  <span className="flex-1 text-white truncate">
                    {m.name ?? m.email ?? m.user_id}
                  </span>
                  <div className="w-32 h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-cyan-500"
                      style={{ width: `${(m.count / maxMemberCount) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-xs text-slate-300">{m.count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
