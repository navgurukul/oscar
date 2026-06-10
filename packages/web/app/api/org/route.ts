import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/orgRoutes";
import { createOrganization, listMemberships } from "@/lib/server/organization";
import { isGenericEmailDomain } from "@/lib/server/emailDomains";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const memberships = await listMemberships(auth.user.id);
  return NextResponse.json(memberships);
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  let body: { name?: string; slug?: string; auto_join_email_domain?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  // Validate auto-join domain if supplied. Same rules as PATCH: must match
  // owner's email domain, can't be a generic provider. Silently dropped on
  // mismatch — creation still succeeds, just without auto-join enabled.
  let autoJoinDomain: string | null = null;
  if (body.auto_join_email_domain) {
    const raw = String(body.auto_join_email_domain).trim().toLowerCase();
    const domain = raw.startsWith("@") ? raw.slice(1) : raw;
    const ownerDomain = (auth.user.email ?? "").split("@")[1]?.toLowerCase() ?? "";
    const shapeOk = /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain);
    if (
      shapeOk &&
      !isGenericEmailDomain(domain) &&
      ownerDomain === domain
    ) {
      autoJoinDomain = domain;
    }
  }

  const org = await createOrganization(
    auth.user.id,
    auth.user.email ?? "",
    name,
    body.slug?.trim() || undefined,
    autoJoinDomain
  );
  if (!org) {
    return NextResponse.json({ error: "Could not create org" }, { status: 500 });
  }
  return NextResponse.json(org, { status: 201 });
}
