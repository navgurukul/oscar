import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/orgRoutes";
import { getMemberRole } from "@/lib/server/organization";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";

type Ctx = { params: Promise<{ id: string }> };

function currentMonthYear(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function recentMonths(count: number): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

export async function GET(_request: Request, context: Ctx) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;

  const role = await getMemberRole(auth.user.id, id);
  if (role !== "owner" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const months = recentMonths(6);
  const currentMonth = currentMonthYear();

  // Per-member recordings — group by user_id over the current month's usage
  // rows. Each member's row joins to the org-wide row by user_id but our
  // current model only stores one (org, month) row with attribution = inserter.
  // So we count from scribbles + streams instead since those are per-user.
  // Member tally derived from scribbles.user_id is a decent proxy.
  const memberCounts = new Map<string, number>();

  const { data: scribbleRows } = await supabase
    .from("scribbles")
    .select("user_id, created_at")
    .eq("organization_id", id)
    .gte("created_at", `${currentMonth}-01`)
    .is("deleted_at", null);

  for (const row of scribbleRows ?? []) {
    memberCounts.set(row.user_id, (memberCounts.get(row.user_id) ?? 0) + 1);
  }

  // Aggregates for sidebar tiles
  const [
    { count: sharedScribbles },
    { count: sharedMeetings },
    { count: docCount },
    { count: memberCount },
    { data: usageSeries },
  ] = await Promise.all([
    supabase
      .from("scribbles")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", id)
      .eq("shared_with_org", true)
      .is("deleted_at", null),
    supabase
      .from("meetings")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", id)
      .eq("shared_with_org", true),
    supabase
      .from("documents")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", id),
    supabase
      .from("organization_members")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", id),
    supabase
      .from("usage_tracking")
      .select("month_year, recording_count")
      .eq("organization_id", id)
      .in("month_year", months),
  ]);

  const usageByMonth = new Map<string, number>(
    (usageSeries ?? []).map((u) => [u.month_year, u.recording_count])
  );

  // Resolve member names for the per-member table.
  const memberIds = Array.from(memberCounts.keys());
  const memberInfo = new Map<string, { name: string | null; email: string | null }>();
  if (memberIds.length > 0) {
    const { data: usersData } = await supabase.auth.admin.listUsers({ perPage: 200 });
    for (const u of usersData?.users ?? []) {
      if (!memberIds.includes(u.id)) continue;
      memberInfo.set(u.id, {
        email: u.email ?? null,
        name:
          (u.user_metadata?.full_name as string | undefined) ??
          (u.user_metadata?.name as string | undefined) ??
          null,
      });
    }
  }

  return NextResponse.json({
    member_count: memberCount ?? 0,
    shared_scribbles: sharedScribbles ?? 0,
    shared_meetings: sharedMeetings ?? 0,
    document_count: docCount ?? 0,
    monthly_recordings: months.map((m) => ({
      month: m,
      count: usageByMonth.get(m) ?? 0,
    })),
    member_scribbles_this_month: Array.from(memberCounts.entries())
      .map(([user_id, count]) => ({
        user_id,
        count,
        name: memberInfo.get(user_id)?.name ?? null,
        email: memberInfo.get(user_id)?.email ?? null,
      }))
      .sort((a, b) => b.count - a.count),
  });
}
