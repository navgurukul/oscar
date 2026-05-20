import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/orgRoutes";
import { setActiveOrg } from "@/lib/server/organization";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  let body: { organization_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const orgId = body.organization_id;
  if (!orgId) {
    return NextResponse.json({ error: "organization_id required" }, { status: 400 });
  }
  const ok = await setActiveOrg(auth.user.id, orgId);
  if (!ok) {
    return NextResponse.json({ error: "Not a member of this org" }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}
