import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/orgRoutes";
import { getActiveOrg } from "@/lib/server/organization";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Ctx) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;

  let body: { shared_with_org?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body.shared_with_org !== "boolean") {
    return NextResponse.json({ error: "shared_with_org boolean required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: scribble, error: fetchErr } = await admin
    .from("scribbles")
    .select("id, user_id")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }
  if (!scribble || scribble.user_id !== auth.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let organizationId: string | null = null;
  if (body.shared_with_org) {
    const active = await getActiveOrg(auth.user.id);
    if (!active) {
      return NextResponse.json({ error: "No active workspace" }, { status: 400 });
    }
    organizationId = active.organization.id;
  }

  const { data, error } = await admin
    .from("scribbles")
    .update({
      shared_with_org: body.shared_with_org,
      organization_id: organizationId,
      shared_at: body.shared_with_org ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .select("id, shared_with_org, organization_id, shared_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
