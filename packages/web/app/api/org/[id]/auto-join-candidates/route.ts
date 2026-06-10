import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/orgRoutes";
import { getMemberRole } from "@/lib/server/organization";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";

// GET — list existing users whose email matches the org's auto_join_email_domain
// but who aren't members yet. Used by Settings UI to offer "Add them all".
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;

  const role = await getMemberRole(auth.user.id, id);
  if (role !== "owner" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("list_auto_join_candidates", {
    p_org_id: id,
  });
  if (error) {
    console.error("[org] list_auto_join_candidates failed", error);
    return NextResponse.json({ error: "Failed to list candidates" }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}

// POST — backfill: add a batch of users as Members of the org.
// Body: { user_ids: string[] }. Owner/admin only.
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;

  const role = await getMemberRole(auth.user.id, id);
  if (role !== "owner" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { user_ids?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.user_ids) || body.user_ids.length === 0) {
    return NextResponse.json({ error: "user_ids must be a non-empty array" }, { status: 400 });
  }

  const userIds = body.user_ids.filter(
    (v): v is string => typeof v === "string" && v.length > 0
  );
  if (userIds.length === 0) {
    return NextResponse.json({ error: "user_ids must contain valid UUIDs" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("backfill_auto_join_members", {
    p_org_id: id,
    p_user_ids: userIds,
  });
  if (error) {
    console.error("[org] backfill_auto_join_members failed", error);
    return NextResponse.json({ error: "Backfill failed" }, { status: 500 });
  }

  return NextResponse.json({ added: (data as number | null) ?? 0 });
}
