import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/orgRoutes";
import { getMemberRole, listMembers } from "@/lib/server/organization";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;

  const role = await getMemberRole(auth.user.id, id);
  if (!role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const members = await listMembers(id);
  return NextResponse.json(members);
}
