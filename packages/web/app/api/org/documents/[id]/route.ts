import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/orgRoutes";
import { getActiveOrg, getMemberRole } from "@/lib/server/organization";
import {
  deleteDocument,
  getDocument,
  getDocumentDownloadUrl,
  updateDocument,
} from "@/lib/server/documents";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: Ctx) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const active = await getActiveOrg(auth.user.id);
  if (!active) return NextResponse.json({ error: "No workspace" }, { status: 400 });
  const { id } = await context.params;

  const doc = await getDocument(id, active.organization.id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const download_url = doc.storage_path
    ? await getDocumentDownloadUrl(doc.storage_path)
    : null;
  return NextResponse.json({ ...doc, download_url });
}

export async function PATCH(request: Request, context: Ctx) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const active = await getActiveOrg(auth.user.id);
  if (!active) return NextResponse.json({ error: "No workspace" }, { status: 400 });
  const { id } = await context.params;

  const doc = await getDocument(id, active.organization.id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const role = await getMemberRole(auth.user.id, active.organization.id);
  const isUploader = doc.uploaded_by === auth.user.id;
  const isAdmin = role === "owner" || role === "admin";
  if (!isUploader && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { title?: string; tags?: string[]; summary?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const patch: Record<string, unknown> = {};
  if (typeof body.title === "string" && body.title.trim()) patch.title = body.title.trim();
  if (Array.isArray(body.tags)) {
    patch.tags = body.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 12);
  }
  if (typeof body.summary === "string") patch.summary = body.summary.trim();

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }
  const updated = await updateDocument(id, patch as Parameters<typeof updateDocument>[1]);
  if (!updated) return NextResponse.json({ error: "Update failed" }, { status: 500 });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, context: Ctx) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const active = await getActiveOrg(auth.user.id);
  if (!active) return NextResponse.json({ error: "No workspace" }, { status: 400 });
  const { id } = await context.params;

  const doc = await getDocument(id, active.organization.id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const role = await getMemberRole(auth.user.id, active.organization.id);
  const isUploader = doc.uploaded_by === auth.user.id;
  const isAdmin = role === "owner" || role === "admin";
  if (!isUploader && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ok = await deleteDocument(id);
  if (!ok) return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
