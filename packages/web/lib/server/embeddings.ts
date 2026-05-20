// Gemini text-embedding-004 wrapper. Emits 768-dim vectors that line up with
// the pgvector column declared in migration 011. Caller should clamp input
// length — Gemini embeds happily up to ~2k tokens; we keep things smaller
// because we feed (title + summary + truncated extract).

import { GoogleGenerativeAI } from "@google/generative-ai";
import { getGeminiApiKey } from "./ai-route";

const EMBED_MODEL = "text-embedding-004";
const MAX_INPUT_CHARS = 8000;

let cachedClient: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (cachedClient) return cachedClient;
  cachedClient = new GoogleGenerativeAI(getGeminiApiKey());
  return cachedClient;
}

export function isEmbeddingsEnabled(): boolean {
  try {
    getGeminiApiKey();
    return true;
  } catch {
    return false;
  }
}

function trim(text: string): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length > MAX_INPUT_CHARS ? collapsed.slice(0, MAX_INPUT_CHARS) : collapsed;
}

/**
 * Returns a 768-dim Gemini embedding for the supplied text. Throws on empty
 * input or API failure; callers that must not block (eg. upload pipeline)
 * should wrap in try/catch and proceed without embedding.
 */
export async function embedText(text: string): Promise<number[]> {
  const trimmed = trim(text);
  if (!trimmed) {
    throw new Error("embedText: empty input");
  }
  const model = getClient().getGenerativeModel({ model: EMBED_MODEL });
  const result = await model.embedContent(trimmed);
  const values = result.embedding?.values;
  if (!values || values.length === 0) {
    throw new Error("embedText: empty embedding response");
  }
  return values;
}

export function buildDocumentEmbeddingInput(params: {
  title: string;
  summary?: string | null;
  extractedText?: string | null;
}): string {
  const parts = [
    params.title,
    params.summary?.trim() ?? "",
    (params.extractedText ?? "").slice(0, 6000),
  ];
  return parts.filter(Boolean).join("\n\n");
}
