import { NextResponse } from "next/server";
import { getOrigin, requireAuth } from "@/lib/server/orgRoutes";
import {
  createInvite,
  getMemberRole,
  listInvites,
} from "@/lib/server/organization";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { isEmailEnabled, sendInviteEmail } from "@/lib/server/email";
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

  // Best-effort email when the invite is email-pinned and Resend is configured.
  // Failures are surfaced as `email_status` so the UI can fall back to "share
  // the link manually" instead of pretending mail went out.
  let email_status: "sent" | "skipped" | "failed" = "skipped";
  let email_error: string | null = null;
  if (email && isEmailEnabled()) {
    const admin = getSupabaseAdmin();
    const { data: orgRow } = await admin
      .from("organizations")
      .select("name")
      .eq("id", orgId)
      .maybeSingle();

    const inviterName =
      (auth.user.user_metadata?.full_name as string | undefined) ??
      (auth.user.user_metadata?.name as string | undefined) ??
      null;

    const result = await sendInviteEmail({
      toEmail: email,
      organizationName: orgRow?.name ?? "your team",
      inviterName,
      inviterEmail: auth.user.email ?? null,
      inviteUrl: invite.url,
      expiresAt: invite.expires_at,
    });

    if (result.ok) {
      email_status = "sent";
    } else {
      email_status = "failed";
      email_error = result.reason;
      console.warn("[invite] email delivery failed", result.reason);
    }
  }

  return NextResponse.json({ ...invite, email_status, email_error }, { status: 201 });
}
