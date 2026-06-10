import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/orgRoutes";
import { getMemberRole, updateOrganization } from "@/lib/server/organization";
import { isGenericEmailDomain } from "@/lib/server/emailDomains";

function validateAutoJoinDomain(
  value: string | null | undefined,
  ownerEmail: string
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (value === null || value === undefined || value === "") {
    return { ok: true, value: null };
  }
  const trimmed = String(value).trim().toLowerCase();
  if (!trimmed) return { ok: true, value: null };

  // Strip leading "@" if user typed "@navgurukul.org"
  const domain = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;

  // Basic shape check: must look like a domain (has a dot, no spaces)
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
    return { ok: false, error: "Enter a valid domain like 'navgurukul.org'." };
  }

  if (isGenericEmailDomain(domain)) {
    return {
      ok: false,
      error: "Generic email domains (gmail.com, yahoo.com, etc.) can't be claimed.",
    };
  }

  // Domain must match the owner's email domain — prevents claiming domains
  // you don't own.
  const ownerDomain = ownerEmail.split("@")[1]?.toLowerCase() ?? "";
  if (ownerDomain !== domain) {
    return {
      ok: false,
      error: `Domain must match your email (${ownerDomain || "your email domain"}).`,
    };
  }

  return { ok: true, value: domain };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;

  const role = await getMemberRole(auth.user.id, id);
  if (role !== "owner" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    name?: string;
    slug?: string;
    logo_url?: string | null;
    auto_publish_minutes?: boolean;
    default_meeting_visibility?: string;
    auto_join_email_domain?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string") patch.name = body.name.trim();
  if (typeof body.slug === "string") {
    const slug = body.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
    if (slug) patch.slug = slug;
  }
  if (body.logo_url !== undefined) patch.logo_url = body.logo_url;
  if (typeof body.auto_publish_minutes === "boolean") {
    patch.auto_publish_minutes = body.auto_publish_minutes;
  }
  if (
    body.default_meeting_visibility === "private" ||
    body.default_meeting_visibility === "org" ||
    body.default_meeting_visibility === "public"
  ) {
    patch.default_meeting_visibility = body.default_meeting_visibility;
  }
  if (body.auto_join_email_domain !== undefined) {
    // Only owners can set/change the auto-join domain. Admins inherit org
    // update rights but auto-join controls org membership policy, which is
    // owner-only.
    if (role !== "owner") {
      return NextResponse.json(
        { error: "Only the owner can change auto-join settings." },
        { status: 403 }
      );
    }
    const validation = validateAutoJoinDomain(body.auto_join_email_domain, auth.user.email ?? "");
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    patch.auto_join_email_domain = validation.value;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  const updated = await updateOrganization(id, patch as Parameters<typeof updateOrganization>[1]);
  if (!updated) {
    return NextResponse.json({ error: "Update failed (slug may be taken)" }, { status: 500 });
  }
  return NextResponse.json(updated);
}
