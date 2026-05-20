// Desktop org context builder. Mirrors the web's buildOrgContext but reads
// straight off the Supabase client (RLS already lets a member see their own
// + their org's vocabulary and the org's documents). Result is cached in
// memory for ~5 min so each pill dictation does not re-fetch.

import { supabase } from "../supabase";

interface VocabRow {
  term: string;
  pronunciation: string | null;
  context: string | null;
  organization_id: string | null;
  user_id: string;
}

interface DocRow {
  id: string;
  title: string;
  summary: string | null;
  tags: string[] | null;
  extracted_text: string | null;
  updated_at: string;
}

interface OrgRow {
  id: string;
  name: string;
}

interface CachedContext {
  block: string;
  fetchedAt: number;
  organizationId: string | null;
  organizationName: string | null;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const VOCAB_LIMIT = 200;
const DEFAULT_DOC_LIMIT = 3;
const MAX_EXCERPT_CHARS = 1200;

let cached: CachedContext | null = null;

function truncate(text: string, max: number): string {
  if (!text) return "";
  const cleaned = text.replace(/\s+/g, " ").trim();
  return cleaned.length > max ? `${cleaned.slice(0, max).trimEnd()}…` : cleaned;
}

function buildVocabSection(rows: VocabRow[], orgLabel: string): string {
  if (rows.length === 0) return "";
  const items = rows
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

function buildDocsSection(rows: DocRow[], orgLabel: string): string {
  if (rows.length === 0) return "";
  const blocks = rows
    .map((d) => {
      const head = `### ${d.title}${d.tags && d.tags.length ? ` — ${d.tags.join(", ")}` : ""}`;
      const summary = d.summary ? `**Summary:** ${d.summary}\n\n` : "";
      const excerpt = truncate(d.extracted_text ?? "", MAX_EXCERPT_CHARS);
      return `${head}\n${summary}${excerpt}`;
    })
    .join("\n\n---\n\n");
  return (
    `## Reference documents (${orgLabel})\n` +
    `Treat these as authoritative background context.\n\n${blocks}`
  );
}

async function fetchActiveOrg(): Promise<OrgRow | null> {
  const { data: active } = await supabase
    .from("user_active_org")
    .select("organization_id")
    .maybeSingle();
  const orgId = (active as { organization_id?: string } | null)?.organization_id;
  if (!orgId) return null;
  const { data: org } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", orgId)
    .maybeSingle();
  return (org as OrgRow | null) ?? null;
}

async function fetchVocab(): Promise<VocabRow[]> {
  // RLS already restricts to the caller's user-private + their org's terms.
  // No explicit filter needed — keep the query simple.
  const { data, error } = await supabase
    .from("user_vocabulary")
    .select("term, pronunciation, context, organization_id, user_id")
    .order("created_at", { ascending: false })
    .limit(VOCAB_LIMIT);
  if (error) {
    console.warn("[orgContext] vocab fetch failed", error);
    return [];
  }
  return (data ?? []) as VocabRow[];
}

async function fetchDocs(orgId: string, limit: number): Promise<DocRow[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("id, title, summary, tags, extracted_text, updated_at")
    .eq("organization_id", orgId)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.warn("[orgContext] docs fetch failed", error);
    return [];
  }
  return (data ?? []) as DocRow[];
}

export const orgContextService = {
  invalidate(): void {
    cached = null;
  },

  /**
   * Returns the prompt-ready context block for the active workspace. Empty
   * string when the user has no active org or both vocab + docs come back empty.
   * Safe to await on every AI call — cached for 5 minutes per session.
   */
  async getBlock(options: { docLimit?: number } = {}): Promise<{
    block: string;
    organizationId: string | null;
    organizationName: string | null;
  }> {
    const now = Date.now();
    if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
      return {
        block: cached.block,
        organizationId: cached.organizationId,
        organizationName: cached.organizationName,
      };
    }

    try {
      const org = await fetchActiveOrg();
      if (!org) {
        cached = { block: "", fetchedAt: now, organizationId: null, organizationName: null };
        return { block: "", organizationId: null, organizationName: null };
      }

      const [vocab, docs] = await Promise.all([
        fetchVocab(),
        fetchDocs(org.id, options.docLimit ?? DEFAULT_DOC_LIMIT),
      ]);

      const orgLabel = `for ${org.name}`;
      const sections = [buildVocabSection(vocab, orgLabel), buildDocsSection(docs, orgLabel)]
        .filter(Boolean)
        .join("\n\n");

      cached = {
        block: sections,
        fetchedAt: now,
        organizationId: org.id,
        organizationName: org.name,
      };
      return { block: sections, organizationId: org.id, organizationName: org.name };
    } catch (err) {
      console.warn("[orgContext] build failed", err);
      return { block: "", organizationId: null, organizationName: null };
    }
  },
};
