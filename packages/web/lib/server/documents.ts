import { randomUUID } from "crypto";
import { getSupabaseAdmin } from "./supabase-admin";
import { parseDocument } from "./documentParse";
import { buildDocumentEmbeddingInput, embedText } from "./embeddings";
import { generateText, getGeminiApiKey } from "./ai-route";
import { API_CONFIG } from "../constants";

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

export function chunkTextSemantically(text: string, maxSize: number = 1800): string[] {
  if (!text) return [];
  const cleanedText = text.trim();
  const headerRegex = /\n(?=#{1,6}\s+)/g;
  const sections = cleanedText.split(headerRegex);
  const chunks: string[] = [];
  let currentChunk = "";
  for (const section of sections) {
    const sectionText = section.trim();
    if (!sectionText) continue;
    if ((currentChunk + "\n\n" + sectionText).length <= maxSize) {
      currentChunk = currentChunk ? currentChunk + "\n\n" + sectionText : sectionText;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      if (sectionText.length > maxSize) {
        const paragraphs = sectionText.split(/\n{2,}/);
        currentChunk = "";
        for (const paragraph of paragraphs) {
          const paraText = paragraph.trim();
          if (!paraText) continue;
          if ((currentChunk + "\n\n" + paraText).length <= maxSize) {
            currentChunk = currentChunk ? currentChunk + "\n\n" + paraText : paraText;
          } else {
            if (currentChunk) {
              chunks.push(currentChunk);
            }
            if (paraText.length > maxSize) {
              const sentences = paraText.match(/[^.!?]+[.!?]+(\s|$)/g) || [paraText];
              currentChunk = "";
              for (const sentence of sentences) {
                const sentenceText = sentence.trim();
                if (!sentenceText) continue;
                if ((currentChunk + " " + sentenceText).length <= maxSize) {
                  currentChunk = currentChunk ? currentChunk + " " + sentenceText : sentenceText;
                } else {
                  if (currentChunk) {
                    chunks.push(currentChunk);
                  }
                  currentChunk = sentenceText;
                }
              }
            } else {
              currentChunk = paraText;
            }
          }
        }
      } else {
        currentChunk = sectionText;
      }
    }
  }
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  return chunks;
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

  // 1. Auto-Summarization (best-effort)
  let summary: string | null = null;
  if (parsed.text.trim()) {
    try {
      const apiKey = getGeminiApiKey();
      summary = await generateText({
        apiKey,
        messages: [
          {
            role: "system",
            content: "You are a precise document summarizer. Output only a 2-4 sentence summary of the document, nothing else. Do not use markdown code blocks or formatting.",
          },
          {
            role: "user",
            content: `Document Title: ${title}\n\nDocument Text:\n${parsed.text.slice(0, 100000)}`,
          },
        ],
        maxTokens: 300,
        temperature: 0.2,
        model: API_CONFIG.GEMINI_MODEL_FAST,
        timeoutMs: 15000,
      });
    } catch (err) {
      console.warn("[documents] auto-summarization failed (continuing):", err);
    }
  }

  // 2. Document Embedding (best-effort)
  let embedding: number[] | null = null;
  try {
    const input = buildDocumentEmbeddingInput({
      title,
      summary,
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
      summary,
      ...(embedding ? { embedding: toVectorLiteral(embedding) } : {}),
    })
    .select("*")
    .single();

  if (error || !data) {
    await supabase.storage.from(BUCKET).remove([key]).catch(() => undefined);
    return { error: error?.message ?? "Insert failed" };
  }

  // 3. Text Chunking, Chunk Embeddings & Entity Extraction (Post-insert, best-effort)
  if (parsed.text.trim()) {
    // A: Chunking & Chunk Embedding
    try {
      const chunks = chunkTextSemantically(parsed.text);
      const chunkPromises = chunks.map(async (content, i) => {
        let chunkEmbedding: number[] | null = null;
        try {
          chunkEmbedding = await embedText(content);
        } catch (err) {
          console.warn(`[documents] chunk embedding failed for index ${i}:`, err);
        }
        return {
          document_id: data.id,
          organization_id: params.organizationId,
          chunk_index: i,
          content,
          chunk_embedding: chunkEmbedding ? toVectorLiteral(chunkEmbedding) : null,
        };
      });

      const chunkRows = await Promise.all(chunkPromises);
      const { error: chunkErr } = await supabase
        .from("document_chunks")
        .insert(chunkRows.map(row => ({
          document_id: row.document_id,
          organization_id: row.organization_id,
          chunk_index: row.chunk_index,
          content: row.content,
          ...(row.chunk_embedding ? { chunk_embedding: row.chunk_embedding } : {})
        })));
      if (chunkErr) {
        console.error("[documents] inserting chunks failed:", chunkErr);
      }
    } catch (err) {
      console.error("[documents] chunking/embedding pipeline failed:", err);
    }

    // B: Entity Extraction
    try {
      const apiKey = getGeminiApiKey();
      const extractionPrompt = `Analyze the following document and extract:
1. Organization terms: acronyms, products, projects, tools, and technical terminology.
2. Organization people: names of people, their emails, roles, and any common aliases (e.g. short names, nicknames), phonetic aliases (how their name sounds), or common ASR (Speech-to-Text) errors for their name.

Output the result as a JSON object matching the following structure:
{
  "terms": [
    {
      "canonical_term": "OSCAR",
      "aliases": ["Oscar App", "Oscar Voice"],
      "category": "product",
      "definition_or_context": "The AI voice note application.",
      "confidence": 0.95
    }
  ],
  "people": [
    {
      "canonical_name": "Apeksha",
      "email": "apeksha@company.com",
      "role": "Lead Engineer",
      "aliases": ["Apu"],
      "phonetic_aliases": ["Apeksha", "Apex-a"],
      "common_asr_errors": ["A picture", "Apeksha", "Opiksha"]
    }
  ]
}

Ensure the output is valid JSON. Do not include any explanations, markdown code blocks, or text before/after the JSON.`;

      const jsonStr = await generateText({
        apiKey,
        messages: [
          { role: "system", content: "You are a precise entity extraction assistant. You output only valid JSON." },
          { role: "user", content: `${extractionPrompt}\n\nDocument Title: ${title}\n\nDocument Text:\n${parsed.text.slice(0, 50000)}` }
        ],
        maxTokens: 2048,
        temperature: 0.1,
        model: API_CONFIG.GEMINI_MODEL_FAST,
        timeoutMs: 25000,
      });

      const extractedData = JSON.parse(jsonStr);

      if (extractedData.terms && Array.isArray(extractedData.terms)) {
        for (const term of extractedData.terms) {
          if (!term.canonical_term || !term.category) continue;
          const category = ['acronym', 'product', 'project', 'tool', 'terminology'].includes(term.category)
            ? term.category
            : 'terminology';
          await supabase.from("org_terms").upsert({
            organization_id: params.organizationId,
            canonical_term: term.canonical_term,
            aliases: term.aliases || [],
            category,
            definition_or_context: term.definition_or_context || null,
            confidence: term.confidence || 1.0,
          }, { onConflict: "organization_id,canonical_term" });
        }
      }

      if (extractedData.people && Array.isArray(extractedData.people)) {
        for (const person of extractedData.people) {
          if (!person.canonical_name) continue;
          await supabase.from("org_people_aliases").upsert({
            organization_id: params.organizationId,
            canonical_name: person.canonical_name,
            email: person.email || null,
            role: person.role || null,
            aliases: person.aliases || [],
            phonetic_aliases: person.phonetic_aliases || [],
            common_asr_errors: person.common_asr_errors || [],
          }, { onConflict: "organization_id,canonical_name" });
        }
      }
    } catch (err) {
      console.error("[documents] entity extraction failed:", err);
    }
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
