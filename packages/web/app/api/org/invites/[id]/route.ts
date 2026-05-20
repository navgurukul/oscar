import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/orgRoutes";
import { getMemberRole, revokeInvite } from "@/lib/server/organization";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;

  const supabase = getSupabaseAdmin();
  const { data: invite } = await supabase
    .from("organization_invites")
    .select("organization_id")
    .eq("id", id)
    .maybeSingle();
  if (!invite) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const role = await getMemberRole(auth.user.id, invite.organization_id);
  if (role !== "owner" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ok = await revokeInvite(invite.organization_id, id);
  if (!ok) {
    return NextResponse.json({ error: "Failed to revoke" }, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}
