import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/orgRoutes";
import { getMemberRole, updateOrganization } from "@/lib/server/organization";

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

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  const updated = await updateOrganization(id, patch as Parameters<typeof updateOrganization>[1]);
  if (!updated) {
    return NextResponse.json({ error: "Update failed (slug may be taken)" }, { status: 500 });
  }
  return NextResponse.json(updated);
}
