import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/orgRoutes";
import { getActiveOrg } from "@/lib/server/organization";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import {
  isVisibility,
  mintPublicShareToken,
  type Visibility,
} from "@/lib/server/shareTokens";
import {
  applyRateLimit,
  getClientIdentifier,
} from "@/lib/middleware/rate-limit";
import { RATE_LIMITS } from "@/lib/constants";

type Ctx = { params: Promise<{ id: string }> };

interface ShareBody {
  visibility?: Visibility;
  // Phase 2 back-compat: callers that still send a boolean get mapped to
  // visibility 'org' (true) or 'private' (false).
  shared_with_org?: boolean;
}

function deriveVisibility(body: ShareBody): Visibility | null {
  if (isVisibility(body.visibility)) return body.visibility;
  if (typeof body.shared_with_org === "boolean") {
    return body.shared_with_org ? "org" : "private";
  }
  return null;
}

export async function PATCH(request: NextRequest, context: Ctx) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;

  const rateLimitResult = await applyRateLimit(
    getClientIdentifier(auth.user.id, request),
    "scribble-share",
    RATE_LIMITS.SHARE_LINK
  );
  if (rateLimitResult) return rateLimitResult;

  let body: ShareBody;
  try {
    body = (await request.json()) as ShareBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const visibility = deriveVisibility(body);
  if (!visibility) {
    return NextResponse.json(
      { error: "visibility ('private'|'org'|'public') or shared_with_org required" },
      { status: 400 }
    );
  }

  const admin = getSupabaseAdmin();
  const { data: scribble, error: fetchErr } = await admin
    .from("scribbles")
    .select("id, user_id, public_share_token, visibility, organization_id")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }
  if (!scribble || scribble.user_id !== auth.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Resolve organization_id when the new visibility implies workspace
  // exposure. Public visibility also needs an org pointer so the audit
  // trigger writes a row.
  let organizationId: string | null = scribble.organization_id ?? null;
  if (visibility !== "private") {
    if (!organizationId) {
      const active = await getActiveOrg(auth.user.id);
      if (!active) {
        return NextResponse.json({ error: "No active workspace" }, { status: 400 });
      }
      organizationId = active.organization.id;
    }
  } else {
    organizationId = null;
  }

  // Mint a token on first transition to 'public'. Re-use existing token if
  // the row was already public (toggling org → public → org → public should
  // be allowed but Phase 6 chooses to rotate the link on every re-publish
  // so a previously-shared URL stops working after a revoke).
  let publicShareToken: string | null = scribble.public_share_token ?? null;
  if (visibility === "public") {
    if (!publicShareToken) publicShareToken = mintPublicShareToken();
  } else {
    publicShareToken = null;
  }

  const sharedWithOrg = visibility !== "private";

  const { data, error } = await admin
    .from("scribbles")
    .update({
      visibility,
      public_share_token: publicShareToken,
      shared_with_org: sharedWithOrg,
      organization_id: organizationId,
      shared_at: sharedWithOrg ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .select(
      "id, visibility, public_share_token, shared_with_org, organization_id, shared_at"
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
