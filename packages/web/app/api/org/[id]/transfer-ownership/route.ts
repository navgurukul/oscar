import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/orgRoutes";
import { getMemberRole, transferOwnership } from "@/lib/server/organization";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Ctx) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;

  const callerRole = await getMemberRole(auth.user.id, id);
  if (callerRole !== "owner") {
    return NextResponse.json(
      { error: "Only the current owner can transfer ownership" },
      { status: 403 }
    );
  }

  let body: { user_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const newOwnerId = typeof body.user_id === "string" ? body.user_id : "";
  if (!newOwnerId) {
    return NextResponse.json({ error: "user_id required" }, { status: 400 });
  }
  if (newOwnerId === auth.user.id) {
    return NextResponse.json({ error: "You are already the owner" }, { status: 400 });
  }

  const result = await transferOwnership(id, auth.user.id, newOwnerId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
