import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/orgRoutes";
import { getMemberRole } from "@/lib/server/organization";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Ctx) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;

  const role = await getMemberRole(auth.user.id, id);
  if (role !== "owner" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? "50") || 50));

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("share_audit")
    .select("*")
    .eq("organization_id", id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[org] audit list failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const actorIds = Array.from(
    new Set(rows.map((r) => r.actor_user_id).filter((v): v is string => !!v))
  );
  const actors = new Map<string, { name: string | null; email: string | null }>();
  if (actorIds.length > 0) {
    const { data: usersData } = await supabase.auth.admin.listUsers({ perPage: 200 });
    for (const u of usersData?.users ?? []) {
      if (!actorIds.includes(u.id)) continue;
      actors.set(u.id, {
        email: u.email ?? null,
        name:
          (u.user_metadata?.full_name as string | undefined) ??
          (u.user_metadata?.name as string | undefined) ??
          null,
      });
    }
  }

  return NextResponse.json({
    items: rows.map((r) => ({
      ...r,
      actor_name: r.actor_user_id ? actors.get(r.actor_user_id)?.name ?? null : null,
      actor_email: r.actor_user_id ? actors.get(r.actor_user_id)?.email ?? null : null,
    })),
  });
}
