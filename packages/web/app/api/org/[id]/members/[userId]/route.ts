import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/orgRoutes";
import {
  getMemberRole,
  removeMember,
  updateMemberRole,
} from "@/lib/server/organization";
import type { OrganizationRole } from "@oscar/shared/types";

type Ctx = { params: Promise<{ id: string; userId: string }> };

function isRole(value: unknown): value is OrganizationRole {
  return value === "owner" || value === "admin" || value === "member";
}

export async function DELETE(_req: Request, context: Ctx) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { id, userId } = await context.params;

  const callerRole = await getMemberRole(auth.user.id, id);
  if (callerRole !== "owner" && callerRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const targetRole = await getMemberRole(userId, id);
  if (targetRole === "owner") {
    return NextResponse.json({ error: "Cannot remove owner" }, { status: 400 });
  }

  const ok = await removeMember(id, userId);
  if (!ok) {
    return NextResponse.json({ error: "Failed to remove" }, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}

export async function PATCH(request: Request, context: Ctx) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { id, userId } = await context.params;

  const callerRole = await getMemberRole(auth.user.id, id);
  if (callerRole !== "owner") {
    return NextResponse.json({ error: "Only owner can change roles" }, { status: 403 });
  }

  let body: { role?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!isRole(body.role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  if (body.role === "owner") {
    return NextResponse.json({ error: "Owner transfer not supported here" }, { status: 400 });
  }

  const ok = await updateMemberRole(id, userId, body.role);
  if (!ok) {
    return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
