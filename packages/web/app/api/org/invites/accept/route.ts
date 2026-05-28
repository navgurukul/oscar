import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/orgRoutes";
import { acceptInvite } from "@/lib/server/organization";
import {
  applyRateLimit,
  getClientIdentifier,
} from "@/lib/middleware/rate-limit";
import { RATE_LIMITS } from "@/lib/constants";

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const rateLimitResult = await applyRateLimit(
    getClientIdentifier(auth.user.id, request),
    "org-invite-accept",
    RATE_LIMITS.ORG_INVITE
  );
  if (rateLimitResult) return rateLimitResult;

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
