import { randomUUID } from "crypto";
import { getSupabaseAdmin } from "./supabase-admin";
import { parseDocument } from "./documentParse";
import { buildDocumentEmbeddingInput, embedText } from "./embeddings";

const BUCKET = "org-documents";

export interface DocumentRow {
  id: string;
  organization_id: string;
  uploaded_by: string | null;
  title: string;
  source_kind: "upload" | "url" | "paste";
  source_url: string | null;
  storage_path: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  extracted_text: string | null;
  summary: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export async function uploadDocument(params: {
  organizationId: string;
  userId: string;
  buffer: Buffer;
  filename: string;
  mimeType: string;
  title?: string;
}): Promise<DocumentRow | { error: string }> {
  const supabase = getSupabaseAdmin();
  const ext = params.filename.includes(".")
    ? params.filename.split(".").pop()?.toLowerCase()
    : "";
  const key = `${params.organizationId}/${randomUUID()}${ext ? `.${ext}` : ""}`;

  let parsed;
  try {
    parsed = await parseDocument(params.buffer, params.mimeType, params.filename);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Parse failed" };
  }

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(key, params.buffer, {
      contentType: parsed.mimeType,
      upsert: false,
    });
  if (uploadErr) {
    return { error: uploadErr.message };
  }

  const title =
    params.title?.trim() ||
    params.filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() ||
    "Untitled document";

  // Best-effort embedding before insert so retrieval can use it immediately.
  // A failure here must NOT block the upload — fall back to recency ranking
  // until a later backfill fills the column in.
  let embedding: number[] | null = null;
  try {
    const input = buildDocumentEmbeddingInput({
      title,
      extractedText: parsed.text,
    });
    if (input.trim()) {
      embedding = await embedText(input);
    }
  } catch (err) {
    console.warn("[documents] embedding generation failed (continuing):", err);
  }

  const { data, error } = await supabase
    .from("documents")
    .insert({
      organization_id: params.organizationId,
      uploaded_by: params.userId,
      title,
      source_kind: "upload",
      storage_path: key,
      mime_type: parsed.mimeType,
      size_bytes: params.buffer.byteLength,
      extracted_text: parsed.text,
      ...(embedding ? { embedding: toVectorLiteral(embedding) } : {}),
    })
    .select("*")
    .single();

  if (error || !data) {
    await supabase.storage.from(BUCKET).remove([key]).catch(() => undefined);
    return { error: error?.message ?? "Insert failed" };
  }
  return data as DocumentRow;
}

// pgvector accepts arrays as `[0.1, 0.2, ...]` string literals over the
// REST API. Serializing in JS keeps the supabase-js types happy and side-
// steps the missing vector type definitions.
function toVectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}

/**
 * One-shot backfill: embeds every document in an org that does not yet have
 * an embedding. Returns the count successfully embedded. Designed to be
 * safe to re-run.
 */
export async function backfillDocumentEmbeddings(
  organizationId: string,
  limit: number = 50
): Promise<{ embedded: number; skipped: number }> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("documents")
    .select("id, title, summary, extracted_text")
    .eq("organization_id", organizationId)
    .is("embedding", null)
    .limit(limit);
  if (error) {
    console.error("[documents] backfill list failed", error);
    return { embedded: 0, skipped: 0 };
  }
  let embedded = 0;
  let skipped = 0;
  for (const row of data ?? []) {
    try {
      const input = buildDocumentEmbeddingInput({
        title: row.title,
        summary: row.summary,
        extractedText: row.extracted_text,
      });
      if (!input.trim()) {
        skipped += 1;
        continue;
      }
      const vec = await embedText(input);
      const { error: updateErr } = await supabase
        .from("documents")
        .update({ embedding: toVectorLiteral(vec) })
        .eq("id", row.id);
      if (updateErr) {
        skipped += 1;
        console.warn("[documents] backfill update failed", updateErr);
      } else {
        embedded += 1;
      }
    } catch (err) {
      skipped += 1;
      console.warn("[documents] backfill embed failed", err);
    }
  }
  return { embedded, skipped };
}

export async function listDocuments(
  organizationId: string,
  options: { search?: string; tag?: string } = {}
): Promise<DocumentRow[]> {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("documents")
    .select("*")
    .eq("organization_id", organizationId);

  if (options.search?.trim()) {
    const escaped = options.search.trim().replace(/'/g, "''");
    query = query.textSearch("search_tsv", escaped, {
      type: "websearch",
      config: "english",
    });
  } else {
    query = query.order("created_at", { ascending: false });
  }
  if (options.tag) {
    query = query.contains("tags", [options.tag]);
  }
  const { data, error } = await query.limit(100);
  if (error) {
    console.error("[documents] list failed", error);
    return [];
  }
  return (data ?? []) as DocumentRow[];
}

export async function getDocument(
  id: string,
  organizationId: string
): Promise<DocumentRow | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  return (data as DocumentRow) ?? null;
}

export async function updateDocument(
  id: string,
  patch: Partial<Pick<DocumentRow, "title" | "tags" | "summary">>
): Promise<DocumentRow | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("documents")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) {
    console.error("[documents] update failed", error);
    return null;
  }
  return data as DocumentRow;
}

export async function deleteDocument(id: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data: doc } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) {
    console.error("[documents] delete failed", error);
    return false;
  }
  if (doc?.storage_path) {
    await supabase.storage.from(BUCKET).remove([doc.storage_path]).catch(() => undefined);
  }
  return true;
}

export async function getDocumentDownloadUrl(
  storagePath: string,
  ttlSeconds = 60 * 5
): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, ttlSeconds);
  if (error || !data) {
    console.error("[documents] signed url failed", error);
    return null;
  }
  return data.signedUrl;
}
