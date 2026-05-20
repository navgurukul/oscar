import { NextResponse } from "next/server";
import { getOrigin, requireAuth } from "@/lib/server/orgRoutes";
import {
  createInvite,
  getMemberRole,
  listInvites,
} from "@/lib/server/organization";
import type { InvitedRole } from "@oscar/shared/types";

function isInvitedRole(value: unknown): value is InvitedRole {
  return value === "admin" || value === "member";
}

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const orgId = new URL(request.url).searchParams.get("organization_id");
  if (!orgId) {
    return NextResponse.json({ error: "organization_id required" }, { status: 400 });
  }
  const role = await getMemberRole(auth.user.id, orgId);
  if (role !== "owner" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const invites = await listInvites(orgId);
  return NextResponse.json(invites);
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  let body: { organization_id?: string; email?: string | null; role?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const orgId = body.organization_id;
  if (!orgId) {
    return NextResponse.json({ error: "organization_id required" }, { status: 400 });
  }
  const callerRole = await getMemberRole(auth.user.id, orgId);
  if (callerRole !== "owner" && callerRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const role: InvitedRole = isInvitedRole(body.role) ? body.role : "member";
  const email = body.email?.toString().trim().toLowerCase() || null;

  const invite = await createInvite({
    organizationId: orgId,
    invitedBy: auth.user.id,
    email,
    role,
    origin: getOrigin(request),
  });
  if (!invite) {
    return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });
  }
  return NextResponse.json(invite, { status: 201 });
}
