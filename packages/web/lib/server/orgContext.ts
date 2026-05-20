// Server-side org context builder. Used by AI routes (format, title,
// transform, publish) to inject workspace vocabulary + reference documents
// into the system prompt. Phase 3 deliberately uses a recency heuristic for
// doc selection; pgvector-based retrieval lands in Phase 5.

import { createHash } from "crypto";
import { getSupabaseAdmin } from "./supabase-admin";
import { getActiveOrg } from "./organization";
import { embedText, isEmbeddingsEnabled } from "./embeddings";

export interface VocabularyTerm {
  term: string;
  pronunciation: string | null;
  context: string | null;
  organization_id: string | null;
}

export interface DocContextEntry {
  id: string;
  title: string;
  summary: string | null;
  tags: string[];
  excerpt: string;
}

export interface OrgContextResult {
  organizationId: string | null;
  organizationName: string | null;
  vocabulary: VocabularyTerm[];
  docs: DocContextEntry[];
  promptBlock: string;
  docsPromptBlock: string;
  cacheKey: string | null;
}

const DEFAULT_DOC_TOKEN_BUDGET = 4000;
const CHARS_PER_TOKEN = 4;
const DEFAULT_DOC_LIMIT = 5;
const VOCAB_LIMIT = 200;

const empty: OrgContextResult = {
  organizationId: null,
  organizationName: null,
  vocabulary: [],
  docs: [],
  promptBlock: "",
  docsPromptBlock: "",
  cacheKey: null,
};

export interface BuildOrgContextOptions {
  documentIds?: string[];
  includeDocs?: boolean;
  includeVocab?: boolean;
  docTokenBudget?: number;
  docLimit?: number;
  /**
   * Optional query text used to drive semantic retrieval over the org's
   * documents. When provided AND embeddings are enabled, buildOrgContext
   * embeds the query and ranks docs by cosine similarity instead of recency.
   * Ignored when documentIds is set (explicit selection wins).
   */
  queryText?: string;
  /** Minimum cosine similarity to keep a semantic match. Default 0.55. */
  minSimilarity?: number;
}

function fingerprint(parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16);
}

function truncateExcerpt(text: string, maxChars: number): string {
  if (!text) return "";
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxChars) return cleaned;
  return `${cleaned.slice(0, maxChars).trimEnd()}…`;
}

function buildVocabSection(
  vocabulary: VocabularyTerm[],
  orgLabel: string
): string {
  if (vocabulary.length === 0) return "";
  const items = vocabulary
    .map((v) => {
      const scope = v.organization_id ? "team" : "personal";
      let line = `- "${v.term}" [${scope}]`;
      if (v.pronunciation) line += ` (pronounced: ${v.pronunciation})`;
      if (v.context) line += ` — ${v.context}`;
      return line;
    })
    .join("\n");
  return (
    `## Organization vocabulary (${orgLabel})\n` +
    `Use these spellings exactly when the speaker likely means them.\n${items}`
  );
}

function buildDocsSection(
  docs: DocContextEntry[],
  orgLabel: string
): string {
  if (docs.length === 0) return "";
  const blocks = docs
    .map((d) => {
      const head = `### ${d.title}${d.tags.length ? ` — ${d.tags.join(", ")}` : ""}`;
      const summary = d.summary ? `**Summary:** ${d.summary}\n\n` : "";
      return `${head}\n${summary}${d.excerpt}`;
    })
    .join("\n\n---\n\n");
  return (
    `## Reference documents (${orgLabel})\n` +
    `Treat these as authoritative background context. Cite by title when you draw on them.\n\n${blocks}`
  );
}

export async function buildOrgContext(
  userId: string,
  options: BuildOrgContextOptions = {}
): Promise<OrgContextResult> {
  const active = await getActiveOrg(userId);
  if (!active) return empty;

  const orgId = active.organization.id;
  const supabase = getSupabaseAdmin();
  const includeVocab = options.includeVocab ?? true;
  const includeDocs = options.includeDocs ?? true;
  const docLimit = options.docLimit ?? DEFAULT_DOC_LIMIT;
  const docTokenBudget = options.docTokenBudget ?? DEFAULT_DOC_TOKEN_BUDGET;
  const maxExcerptChars = Math.max(
    400,
    Math.floor((docTokenBudget * CHARS_PER_TOKEN) / Math.max(docLimit, 1))
  );

  let vocabulary: VocabularyTerm[] = [];
  if (includeVocab) {
    const { data } = await supabase
      .from("user_vocabulary")
      .select("term, pronunciation, context, organization_id, user_id, created_at")
      .or(`user_id.eq.${userId},organization_id.eq.${orgId}`)
      .order("created_at", { ascending: false })
      .limit(VOCAB_LIMIT);
    vocabulary = (data ?? []).map((row) => ({
      term: row.term,
      pronunciation: row.pronunciation ?? null,
      context: row.context ?? null,
      organization_id: row.organization_id ?? null,
    }));
  }

  let docs: DocContextEntry[] = [];
  if (includeDocs) {
    const trimmedQuery = options.queryText?.trim() ?? "";
    const useSemantic =
      !options.documentIds?.length &&
      trimmedQuery.length >= 24 &&
      isEmbeddingsEnabled();

    if (useSemantic) {
      try {
        const queryEmbedding = await embedText(trimmedQuery);
        const { data: matches, error: matchError } = await supabase.rpc("match_documents", {
          p_query_embedding: `[${queryEmbedding.join(",")}]`,
          p_organization_id: orgId,
          p_match_count: docLimit,
          p_min_score: options.minSimilarity ?? 0.55,
        });
        if (matchError) {
          console.warn("[orgContext] match_documents failed, falling back:", matchError);
        } else if (matches && matches.length > 0) {
          docs = matches.slice(0, docLimit).map((row: {
            id: string;
            title: string;
            summary: string | null;
            tags: string[] | null;
            extracted_text: string | null;
          }) => ({
            id: row.id,
            title: row.title,
            summary: row.summary,
            tags: row.tags ?? [],
            excerpt: truncateExcerpt(row.extracted_text ?? "", maxExcerptChars),
          }));
        }
      } catch (err) {
        console.warn("[orgContext] semantic retrieval threw, falling back:", err);
      }
    }

    // Recency / explicit-id fallback. Runs when semantic path is disabled,
    // returns nothing, or fails — guaranteeing the format prompt still gets
    // some context.
    if (docs.length === 0) {
      let docQuery = supabase
        .from("documents")
        .select("id, title, summary, tags, extracted_text, updated_at")
        .eq("organization_id", orgId);

      if (options.documentIds && options.documentIds.length > 0) {
        docQuery = docQuery.in("id", options.documentIds);
      } else {
        docQuery = docQuery.order("updated_at", { ascending: false }).limit(docLimit);
      }

      const { data } = await docQuery;
      docs = (data ?? []).slice(0, docLimit).map((row) => ({
        id: row.id,
        title: row.title,
        summary: row.summary ?? null,
        tags: row.tags ?? [],
        excerpt: truncateExcerpt(row.extracted_text ?? "", maxExcerptChars),
      }));
    }
  }

  const cacheKey = fingerprint([
    `org:${orgId}`,
    `vocab:${vocabulary.length}`,
    `docs:${docs.map((d) => d.id).join(",") || "none"}`,
  ]);

  const orgLabel = active.organization.name
    ? `for ${active.organization.name}`
    : "for this workspace";
  const vocabSection = buildVocabSection(vocabulary, orgLabel);
  const docsSection = buildDocsSection(docs, orgLabel);

  return {
    organizationId: orgId,
    organizationName: active.organization.name,
    vocabulary,
    docs,
    promptBlock: [vocabSection, docsSection].filter(Boolean).join("\n\n"),
    docsPromptBlock: docsSection,
    cacheKey: `org:${orgId}:ctx:v${cacheKey}`,
  };
}

export function joinSystemPrompt(base: string, contextBlock: string): string {
  if (!contextBlock) return base;
  return `${contextBlock}\n\n---\n\n${base}`;
}
