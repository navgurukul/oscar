import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/orgRoutes";
import { createOrganization, listMemberships } from "@/lib/server/organization";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const memberships = await listMemberships(auth.user.id);
  return NextResponse.json(memberships);
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  let body: { name?: string; slug?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const org = await createOrganization(
    auth.user.id,
    auth.user.email ?? "",
    name,
    body.slug?.trim() || undefined
  );
  if (!org) {
    return NextResponse.json({ error: "Could not create org" }, { status: 500 });
  }
  return NextResponse.json(org, { status: 201 });
}
