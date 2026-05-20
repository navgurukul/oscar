import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/orgRoutes";
import { getActiveOrg, getMemberRole } from "@/lib/server/organization";
import {
  listDocuments,
  uploadDocument,
} from "@/lib/server/documents";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/markdown",
  "text/plain",
  "",
]);

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const active = await getActiveOrg(auth.user.id);
  if (!active) return NextResponse.json({ items: [] });

  const url = new URL(request.url);
  const search = url.searchParams.get("q") ?? undefined;
  const tag = url.searchParams.get("tag") ?? undefined;
  const items = await listDocuments(active.organization.id, { search, tag });
  return NextResponse.json({ items, organization: active.organization });
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const active = await getActiveOrg(auth.user.id);
  if (!active) {
    return NextResponse.json({ error: "No active workspace" }, { status: 400 });
  }
  const role = await getMemberRole(auth.user.id, active.organization.id);
  if (!role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file field required" }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File must be 1 byte – 10 MB" }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: `Unsupported file type: ${file.type}` }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const titleField = formData.get("title");
  const title = typeof titleField === "string" ? titleField : undefined;

  const result = await uploadDocument({
    organizationId: active.organization.id,
    userId: auth.user.id,
    buffer,
    filename: file.name,
    mimeType: file.type,
    title,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result, { status: 201 });
}
