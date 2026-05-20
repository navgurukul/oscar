import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/orgRoutes";
import { acceptInvite } from "@/lib/server/organization";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const token = body.token?.trim();
  if (!token) {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }

  const orgId = await acceptInvite({
    token,
    userId: auth.user.id,
    userEmail: auth.user.email ?? "",
  });
  if (!orgId) {
    return NextResponse.json(
      { error: "Invite invalid, expired, or already accepted" },
      { status: 400 }
    );
  }
  return NextResponse.json({ organization_id: orgId });
}
