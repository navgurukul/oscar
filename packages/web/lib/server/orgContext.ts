// Server-side org context builder. Used by AI routes (format, title,
// transform, publish) to inject workspace vocabulary + reference documents
// into the system prompt. Phase 3 deliberately uses a recency heuristic for
// doc selection; pgvector-based retrieval lands in Phase 5.

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

export interface PeopleAliasRow {
  canonical_name: string;
  role?: string | null;
  aliases?: string[] | null;
  phonetic_aliases?: string[] | null;
  common_asr_errors?: string[] | null;
  email?: string | null;
}

export interface TermRow {
  canonical_term: string;
  category: string;
  definition_or_context?: string | null;
  confidence?: number | null;
  aliases?: string[] | null;
}

export interface ChunkRow {
  document_id: string;
  content: string;
}

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
  queryText?: string;
  minSimilarity?: number;
}

function compileStreamPrompt(matchedPeople: PeopleAliasRow[], matchedTerms: TermRow[]): string {
  if (matchedPeople.length === 0 && matchedTerms.length === 0) return "";
  
  let block = "## Organization Context Guidelines\n";
  block += "Use these spelling, name, and terminology guidelines when cleaning up the transcript:\n\n";
  
  if (matchedPeople.length > 0) {
    block += "### People & Names\n";
    matchedPeople.forEach((p) => {
      let line = `- Name: "${p.canonical_name}"`;
      if (p.role) line += `, Role: ${p.role}`;
      const allAliases = [...(p.aliases || []), ...(p.phonetic_aliases || [])];
      if (allAliases.length > 0) line += ` (Aliases/sounds like: ${allAliases.join(", ")})`;
      block += line + "\n";
    });
    block += "\n";
  }
  
  if (matchedTerms.length > 0) {
    block += "### Terms & Vocabulary\n";
    matchedTerms.forEach((t) => {
      let line = `- "${t.canonical_term}" [${t.category}]`;
      if (t.definition_or_context) line += ` — ${t.definition_or_context}`;
      block += line + "\n";
    });
  }
  
  return block.trim();
}

function compileScribblePrompt(
  matchedPeople: PeopleAliasRow[],
  matchedTerms: TermRow[],
  chunks: ChunkRow[],
  maxChars: number
): string {
  let block = "## Organization Context Guidelines\n";
  block += "Use these spelling, name, and terminology guidelines when cleaning up the transcript:\n\n";
  
  let currentChars = block.length;
  
  let peopleBlock = "";
  if (matchedPeople.length > 0) {
    peopleBlock += "### People & Names\n";
    matchedPeople.forEach((p) => {
      let line = `- Name: "${p.canonical_name}"`;
      if (p.role) line += `, Role: ${p.role}`;
      const allAliases = [...(p.aliases || []), ...(p.phonetic_aliases || [])];
      if (allAliases.length > 0) line += ` (Aliases: ${allAliases.join(", ")})`;
      peopleBlock += line + "\n";
    });
    peopleBlock += "\n";
  }
  
  let termsBlock = "";
  if (matchedTerms.length > 0) {
    termsBlock += "### Terms & Vocabulary\n";
    matchedTerms.forEach((t) => {
      let line = `- "${t.canonical_term}" [${t.category}]`;
      if (t.definition_or_context) line += ` — ${t.definition_or_context}`;
      termsBlock += line + "\n";
    });
    termsBlock += "\n";
  }
  
  block += peopleBlock + termsBlock;
  currentChars = block.length;
  
  if (chunks.length > 0) {
    let chunksBlock = "### Relevant Document Excerpts\n";
    chunksBlock += "Treat these excerpts as authoritative background context:\n\n";
    
    let addedChunks = 0;
    for (const chunk of chunks) {
      const excerpt = `Excerpt from Document:\n"""\n${chunk.content}\n"""\n\n`;
      if (currentChars + chunksBlock.length + excerpt.length > maxChars) {
        break;
      }
      chunksBlock += excerpt;
      addedChunks++;
    }
    
    if (addedChunks > 0) {
      block += chunksBlock;
    }
  }
  
  return block.trim();
}

function compileMinutesPrompt(
  allPeople: PeopleAliasRow[],
  matchedTerms: TermRow[],
  chunks: ChunkRow[],
  maxChars: number
): string {
  let block = "## Organization Context & Meeting Minutes Guidelines\n";
  block += "Treat these details as authoritative spelling and meeting metadata guidelines:\n\n";
  
  let currentChars = block.length;
  
  let peopleBlock = "";
  if (allPeople.length > 0) {
    peopleBlock += "### Full Attendee Registry\n";
    allPeople.forEach((p) => {
      let line = `- "${p.canonical_name}"`;
      if (p.email) line += ` <${p.email}>`;
      if (p.role) line += ` (Role: ${p.role})`;
      const allAliases = [...(p.aliases || []), ...(p.phonetic_aliases || [])];
      if (allAliases.length > 0) line += ` [Aliases: ${allAliases.join(", ")}]`;
      peopleBlock += line + "\n";
    });
    peopleBlock += "\n";
  }
  
  let termsBlock = "";
  if (matchedTerms.length > 0) {
    termsBlock += "### Terms & Vocabulary\n";
    matchedTerms.forEach((t) => {
      let line = `- "${t.canonical_term}" [${t.category}]`;
      if (t.definition_or_context) line += ` — ${t.definition_or_context}`;
      termsBlock += line + "\n";
    });
    termsBlock += "\n";
  }
  
  block += peopleBlock + termsBlock;
  currentChars = block.length;
  
  if (chunks.length > 0) {
    let chunksBlock = "### Relevant Document Context\n";
    chunksBlock += "Use the following context to resolve facts or terminology from the meeting:\n\n";
    
    let addedChunks = 0;
    for (const chunk of chunks) {
      const excerpt = `Excerpt from Document:\n"""\n${chunk.content}\n"""\n\n`;
      if (currentChars + chunksBlock.length + excerpt.length > maxChars) {
        break;
      }
      chunksBlock += excerpt;
      addedChunks++;
    }
    
    if (addedChunks > 0) {
      block += chunksBlock;
    }
  }
  
  return block.trim();
}

function textContainsWord(text: string, term: string): boolean {
  if (!text || !term) return false;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`\\b${escaped}\\b`, "i");
  return regex.test(text);
}

export const ContextCompiler = {
  async compile(params: {
    userId: string;
    rawTranscript: string;
    profile: "stream" | "scribble" | "minutes";
  }): Promise<{
    block: string;
    organizationId: string | null;
    organizationName: string | null;
    matchedPeople: PeopleAliasRow[];
    matchedTerms: TermRow[];
    matchedChunks: ChunkRow[];
  }> {
    const active = await getActiveOrg(params.userId);
    if (!active) {
      return {
        block: "",
        organizationId: null,
        organizationName: null,
        matchedPeople: [],
        matchedTerms: [],
        matchedChunks: [],
      };
    }

    const orgId = active.organization.id;
    const orgName = active.organization.name;
    const supabase = getSupabaseAdmin();
    const query = params.rawTranscript || "";

    const [peopleResult, termsResult] = await Promise.all([
      supabase.from("org_people_aliases").select("*").eq("organization_id", orgId),
      supabase.from("org_terms").select("*").eq("organization_id", orgId),
    ]);

    const people: PeopleAliasRow[] = peopleResult.data || [];
    const terms: TermRow[] = termsResult.data || [];

    const matchedPeople: PeopleAliasRow[] = [];
    const matchedTerms: TermRow[] = [];

    if (query.trim()) {
      for (const p of people) {
        let matched = false;
        if (textContainsWord(query, p.canonical_name)) {
          matched = true;
        } else {
          const aliases = p.aliases || [];
          const phonetic = p.phonetic_aliases || [];
          const asr = p.common_asr_errors || [];
          for (const val of [...aliases, ...phonetic, ...asr]) {
            if (textContainsWord(query, val)) {
              matched = true;
              break;
            }
          }
        }
        if (matched) {
          matchedPeople.push(p);
        }
      }

      for (const t of terms) {
        let matched = false;
        if (textContainsWord(query, t.canonical_term)) {
          matched = true;
        } else {
          const aliases = t.aliases || [];
          for (const val of aliases) {
            if (textContainsWord(query, val)) {
              matched = true;
              break;
            }
          }
        }
        if (matched) {
          matchedTerms.push(t);
        }
      }
    }

    let matchedChunks: ChunkRow[] = [];
    if (query.trim() && isEmbeddingsEnabled()) {
      try {
        const queryEmbedding = await embedText(query);
        const { data: chunks, error } = await supabase.rpc("match_document_chunks", {
          p_query_embedding: `[${queryEmbedding.join(",")}]`,
          p_organization_id: orgId,
          p_match_count: 10,
          p_min_score: 0.55,
        });
        if (!error && chunks) {
          matchedChunks = chunks;
        } else if (error) {
          console.warn("[orgContext] match_document_chunks RPC failed:", error);
        }
      } catch (err) {
        console.warn("[orgContext] embedding/similarity search failed:", err);
      }
    }

    let block = "";
    if (params.profile === "stream") {
      const highConfTerms = matchedTerms.filter(t => (t.confidence ?? 1.0) >= 0.7);
      block = compileStreamPrompt(matchedPeople, highConfTerms);
    } else if (params.profile === "scribble") {
      block = compileScribblePrompt(matchedPeople, matchedTerms, matchedChunks, 4800);
    } else if (params.profile === "minutes") {
      block = compileMinutesPrompt(people, matchedTerms, matchedChunks, 12000);
    }

    return {
      block,
      organizationId: orgId,
      organizationName: orgName,
      matchedPeople: params.profile === "minutes" ? people : matchedPeople,
      matchedTerms,
      matchedChunks,
    };
  }
};

export async function buildOrgContext(
  userId: string,
  options: BuildOrgContextOptions = {}
): Promise<OrgContextResult> {
  const active = await getActiveOrg(userId);
  if (!active) return empty;

  const orgId = active.organization.id;
  const query = options.queryText || "";

  let profile: "stream" | "scribble" | "minutes" = "scribble";
  if (options.docTokenBudget && options.docTokenBudget <= 700) {
    profile = "stream";
  }

  const compiled = await ContextCompiler.compile({
    userId,
    rawTranscript: query,
    profile,
  });

  return {
    organizationId: compiled.organizationId,
    organizationName: compiled.organizationName,
    vocabulary: compiled.matchedTerms.map((t) => ({
      term: t.canonical_term,
      pronunciation: t.aliases?.[0] || null,
      context: t.definition_or_context || null,
      organization_id: compiled.organizationId,
    })),
    docs: compiled.matchedChunks.map((c) => ({
      id: c.document_id,
      title: "Document Excerpt",
      summary: null,
      tags: [],
      excerpt: c.content,
    })),
    promptBlock: compiled.block,
    docsPromptBlock: compiled.block,
    cacheKey: `org:${orgId}:ctx:compiled`,
  };
}

export function joinSystemPrompt(base: string, contextBlock: string): string {
  if (!contextBlock) return base;
  return `${contextBlock}\n\n---\n\n${base}`;
}
