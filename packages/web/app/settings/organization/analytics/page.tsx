"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { Spinner } from "@/components/ui/spinner";
import { organizationService } from "@/lib/services/organization.service";
import { ROUTES } from "@/lib/constants";
import type { ActiveOrganization } from "@oscar/shared/types";
import {
  v2,
  v2Serif,
  V2Caps,
  V2Mono,
  V2Avatar,
} from "@/components/v2/V2Primitives";
import {
  createOrgSettingsSections,
  V2OrgSettingsShell,
} from "@/components/v2/V2OrgSettingsShell";

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
  return new Date(year, m - 1, 1)
    .toLocaleDateString(undefined, { month: "short", year: "2-digit" })
    .toUpperCase();
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
    if (authLoading) return;
    if (!user) {
      router.push(`${ROUTES.AUTH}?redirectTo=${ROUTES.ORG_SETTINGS}/analytics`);
      return;
    }
    void load();
  }, [authLoading, user, router, load]);

  useEffect(() => {
    if (active && !active.hasTeam) {
      router.replace(ROUTES.SETTINGS);
    }
  }, [active, router]);

  const maxMonthlyRecordings = useMemo(() => {
    if (!data?.monthly_recordings.length) return 0;
    return Math.max(...data.monthly_recordings.map((m) => m.count), 1);
  }, [data]);

  const maxMemberCount = useMemo(() => {
    if (!data?.member_scribbles_this_month.length) return 1;
    return Math.max(...data.member_scribbles_this_month.map((m) => m.count), 1);
  }, [data]);

  const downloadCsv = useCallback(() => {
    if (!data || !active) return;
    const rows = [
      ["metric", "value"],
      ["members", data.member_count],
      ["shared_scribbles", data.shared_scribbles],
      ["shared_meetings", data.shared_meetings],
      ["workspace_docs", data.document_count],
      [],
      ["month", "recordings"],
      ...data.monthly_recordings.map((m) => [m.month, m.count]),
      [],
      ["member", "email", "scribbles_this_month"],
      ...data.member_scribbles_this_month.map((m) => [
        m.name ?? "",
        m.email ?? "",
        m.count,
      ]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${active.organization.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "workspace"}-analytics.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [active, data]);

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

  if (active && !active.hasTeam) {
    return null;
  }

  if (active && active.role !== "owner" && active.role !== "admin") {
    return (
      <main
        className="min-h-screen flex flex-col items-center justify-center gap-5 px-4 text-center"
        style={{ background: v2.cream, color: v2.ink }}
      >
        <p style={{ color: v2.inkSoft }}>Only owners or admins can view analytics.</p>
        <Link href={ROUTES.ORG_SETTINGS} className="inline-block hover:opacity-80">
          <V2Caps>← BACK TO ORG SETTINGS</V2Caps>
        </Link>
      </main>
    );
  }

  if (!data || !active) {
    return (
      <main
        className="min-h-screen flex flex-col items-center justify-center gap-5 px-4 text-center"
        style={{ background: v2.cream, color: v2.ink }}
      >
        <p style={{ color: v2.inkSoft }}>No data yet.</p>
        <Link href={ROUTES.ORG_SETTINGS} className="inline-block hover:opacity-80">
          <V2Caps>← BACK TO ORG SETTINGS</V2Caps>
        </Link>
      </main>
    );
  }

  return (
    <V2OrgSettingsShell
      active="analytics"
      orgName={active.organization.name}
      eyebrow="ORG SETTINGS · ANALYTICS"
      title={
        <>
          What the workspace has been{" "}
          <em style={{ fontStyle: "italic", color: v2.accent }}>saying</em>.
        </>
      }
      lead={`Usage across ${active.organization.name}. Owners and admins only. Numbers refresh hourly.`}
      sections={createOrgSettingsSections({
        active: "analytics",
        memberCount: data.member_count,
      })}
    >
      <div className="space-y-10">
        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ["MEMBERS", data.member_count],
            ["SHARED SCRIBBLES", data.shared_scribbles],
            ["SHARED MEETINGS", data.shared_meetings],
            ["WORKSPACE DOCS", data.document_count],
          ].map(([k, v]) => (
            <div
              key={k as string}
              className="rounded-lg p-5"
              style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}
            >
              <V2Caps>{k as string}</V2Caps>
              <div
                className="mt-3"
                style={{
                  fontFamily: v2Serif,
                  fontSize: 44,
                  lineHeight: 1,
                  fontWeight: 500,
                  letterSpacing: 0,
                  color: v2.ink,
                }}
              >
                {v}
              </div>
            </div>
          ))}
        </div>

        {/* Recordings — last 6 months */}
        <div
          className="grid grid-cols-12 gap-6 md:gap-10"
          style={{ borderTop: `1px solid ${v2.rule}`, paddingTop: 28 }}
        >
          <div className="col-span-12 md:col-span-3">
            <V2Caps>RECORDINGS</V2Caps>
            <p className="mt-2 text-[13px] leading-relaxed" style={{ color: v2.inkSoft }}>
              Across all members. Last six months.
            </p>
          </div>
          <div className="col-span-12 md:col-span-9">
            {data.monthly_recordings.length === 0 ? (
              <p className="text-[14px]" style={{ color: v2.inkSoft }}>
                No recordings yet.
              </p>
            ) : (
              <div className="flex items-end gap-3 md:gap-5" style={{ height: 220 }}>
                {data.monthly_recordings.map((mo, i) => {
                  const isLast = i === data.monthly_recordings.length - 1;
                  return (
                    <div key={mo.month} className="flex-1 flex flex-col items-center">
                      <V2Mono style={{ fontSize: 11, color: v2.ink, marginBottom: 6 }}>
                        {mo.count}
                      </V2Mono>
                      <div
                        style={{
                          width: "100%",
                          height: `${(mo.count / maxMonthlyRecordings) * 100}%`,
                          background: isLast ? v2.accent : v2.inkSoft,
                          borderRadius: "2px 2px 0 0",
                          transition: "all 0.3s ease",
                        }}
                      />
                      <V2Caps>{formatMonth(mo.month)}</V2Caps>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Per-member scribbles this month */}
        <div
          className="grid grid-cols-12 gap-6 md:gap-10"
          style={{ borderTop: `1px solid ${v2.rule}`, paddingTop: 28 }}
        >
          <div className="col-span-12 md:col-span-3">
            <V2Caps>BY MEMBER · THIS MONTH</V2Caps>
            <p className="mt-2 text-[13px] leading-relaxed" style={{ color: v2.inkSoft }}>
              Scribbles created this month. Members who never recorded are hidden.
            </p>
          </div>
          <div className="col-span-12 md:col-span-9 space-y-3">
            {data.member_scribbles_this_month.length === 0 ? (
              <p className="text-[14px]" style={{ color: v2.inkSoft }}>
                No scribbles yet this month.
              </p>
            ) : (
              data.member_scribbles_this_month.map((m) => {
                const name = m.name ?? m.email ?? m.user_id;
                return (
                  <div key={m.user_id} className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-3" style={{ width: 200 }}>
                      <V2Avatar size={26} initial={name.charAt(0).toUpperCase()} />
                      <span
                        className="truncate"
                        style={{ fontSize: 14, color: v2.ink, maxWidth: 160 }}
                      >
                        {name}
                      </span>
                    </div>
                    <div
                      className="flex-1 rounded-full overflow-hidden"
                      style={{ height: 6, background: v2.rule, minWidth: 80 }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${(m.count / maxMemberCount) * 100}%`,
                          background: v2.accent,
                        }}
                      />
                    </div>
                    <V2Mono style={{ fontSize: 12, color: v2.ink, width: 36, textAlign: "right" }}>
                      {m.count}
                    </V2Mono>
                    <V2Caps>{m.count >= 20 ? "HEAVY" : m.count >= 10 ? "STEADY" : "LIGHT"}</V2Caps>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Export */}
        <div
          className="grid grid-cols-12 gap-6 md:gap-10"
          style={{ borderTop: `1px solid ${v2.rule}`, paddingTop: 28 }}
        >
          <div className="col-span-12 md:col-span-3">
            <V2Caps>EXPORT</V2Caps>
          </div>
          <div className="col-span-12 md:col-span-9 flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={downloadCsv}
              className="text-[12px] rounded-full px-4 py-2"
              style={{ border: `1px solid ${v2.rule}`, color: v2.inkSoft }}
            >
              Download CSV
            </button>
            <V2Mono style={{ fontSize: 11, color: v2.inkFaint, marginLeft: "auto" }}>
              ROUTE · /SETTINGS/ORGANIZATION/ANALYTICS
            </V2Mono>
          </div>
        </div>
      </div>
    </V2OrgSettingsShell>
  );
}
