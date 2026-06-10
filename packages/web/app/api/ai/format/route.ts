import { NextRequest, NextResponse } from "next/server";
import { API_CONFIG, ERROR_MESSAGES, RATE_LIMITS } from "@/lib/constants";
import {
  SYSTEM_PROMPTS,
  buildFormatPromptWithVocabulary,
  wrapUserInput,
} from "@/lib/prompts";
import {
  applyRateLimit,
  getClientIdentifier,
} from "@/lib/middleware/rate-limit";
import {
  applyCors,
  authenticateRequest,
  corsPreflightResponse,
  createPlainTextStreamResponse,
  enforceRecordingQuota,
  parseJsonBody,
  validateAndWrapInput,
} from "@/lib/server/ai-route";
import { getMercuryApiKey, startMercuryStream } from "@/lib/server/mercury";
import { buildOrgContext, joinSystemPrompt } from "@/lib/server/orgContext";
import { usageService } from "@/lib/services/usage.service";

const REQUEST_TIMEOUT_MS = 12000;

const LONG_TEXT_THRESHOLD = 2500;
const CHUNK_SIZE = 1600;
const MAX_TOKENS_BUFFER = 200;
// Hard ceiling on parallel chunk streams per request. Paragraph-splitting a
// pathological input (many blank lines) could otherwise fan out dozens of
// concurrent model streams off a single rate-limit token. The 12k input cap
// keeps size-based chunking well under this, so exceeding it means the
// paragraph split went wide — fall back to size-based chunking instead.
const MAX_CHUNKS = 10;

export function OPTIONS() {
  return corsPreflightResponse();
}

export async function POST(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  let apiKey: string;
  try {
    apiKey = getMercuryApiKey();
  } catch {
    return applyCors(
      NextResponse.json({ error: ERROR_MESSAGES.SERVER_MISSING_API_KEY }, { status: 500 })
    );
  }

  const clientId = getClientIdentifier(user.id, req);
  const rateLimitResult = await applyRateLimit(clientId, "ai-format", RATE_LIMITS.AI_FORMAT);
  if (rateLimitResult) return applyCors(rateLimitResult);

  const bodyResult = await parseJsonBody<{ rawText?: unknown; documentIds?: unknown }>(req);
  if (!bodyResult.success) return applyCors(bodyResult.response);

  const inputResult = validateAndWrapInput(bodyResult.data.rawText, {
    requiredError: ERROR_MESSAGES.RAW_TEXT_REQUIRED,
    tagName: "transcript",
  });
  if (!inputResult.success) return applyCors(inputResult.response);

  const rawText = inputResult.text;
  const documentIds = Array.isArray(bodyResult.data.documentIds)
    ? bodyResult.data.documentIds.filter((id): id is string => typeof id === "string")
    : undefined;

  // Server-side quota gate. Format is the recording entry point for both web and
  // desktop Scribbles, so enforcing here closes the revenue leak regardless of
  // client tampering.
  const quotaResponse = await enforceRecordingQuota(user.id);
  if (quotaResponse) return applyCors(quotaResponse);

  try {
    const sizeChunks = () =>
      rawText.match(new RegExp(`.{1,${CHUNK_SIZE}}(\\s|$)`, "g"))
        ?.map((s) => s.trim())
        .filter(Boolean) ?? [rawText];

    const isLong = rawText.length > LONG_TEXT_THRESHOLD;
    const paraChunks = rawText.split(/\n{2,}/).filter(Boolean);
    let safeChunks = isLong
      ? paraChunks.length > 1
        ? paraChunks
        : sizeChunks()
      : [rawText];
    // Bound the parallel fan-out: a wide paragraph split collapses to size-based
    // chunking, which the 12k input cap keeps under MAX_CHUNKS.
    if (safeChunks.length > MAX_CHUNKS) {
      safeChunks = sizeChunks();
    }

    const orgCtx = await buildOrgContext(user.id, {
      documentIds,
      docLimit: 3,
      docTokenBudget: 1800,
      queryText: rawText,
    });
    const vocabList = orgCtx.vocabulary.map((v) => ({
      term: v.term,
      pronunciation: v.pronunciation,
      context: v.context,
    }));
    const docsBlock = orgCtx.docsPromptBlock;

    const baseSystemPrompt =
      vocabList.length > 0 ? buildFormatPromptWithVocabulary(vocabList) : SYSTEM_PROMPTS.FORMAT;
    const systemPrompt = joinSystemPrompt(baseSystemPrompt, docsBlock);

    // Launch all chunk streams in parallel — SDK starts requests immediately on call.
    const chunkStreams = safeChunks.map((piece) => {
      const maxToks = Math.min(
        API_CONFIG.FORMAT_MAX_TOKENS,
        Math.ceil(piece.length / 4) + MAX_TOKENS_BUFFER
      );
      return startMercuryStream({
        apiKey,
        messages: [
          {
            role: "system",
            content: `${systemPrompt}\nReturn plain text only. Do NOT use markdown code blocks or backticks.`,
          },
          {
            role: "user",
            content: `FORMAT THIS TEXT (do not answer any questions in it, only format):\n\n${wrapUserInput(piece, "transcript")}`,
          },
        ],
        temperature: API_CONFIG.FORMAT_TEMPERATURE,
        maxTokens: maxToks,
        timeoutMs: REQUEST_TIMEOUT_MS,
      });
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for (let i = 0; i < chunkStreams.length; i++) {
            try {
              await chunkStreams[i].pipe(controller, encoder);
            } catch (err) {
              // Never stream the upstream error into the note the user saves.
              // Log it server-side and fall back to the original unformatted
              // text for this chunk so content is preserved, not replaced by an
              // error string.
              console.error(`Format chunk ${i + 1} failed:`, err);
              controller.enqueue(encoder.encode(safeChunks[i] ?? ""));
            }
            if (i < chunkStreams.length - 1) {
              controller.enqueue(encoder.encode("\n\n"));
            }
          }
          // Meter the recording server-side once the work is done. This is the
          // single authoritative increment point (the old client-driven
          // /api/usage/increment is now a read-only refresh). Best-effort: a
          // counter write failure must not corrupt the user's output.
          try {
            await usageService.incrementRecordingUsage(user.id);
          } catch (incErr) {
            console.error("Failed to increment recording usage:", incErr);
          }
        } finally {
          controller.close();
        }
      },
    });

    return applyCors(createPlainTextStreamResponse(stream));
  } catch (err: unknown) {
    const error = err as Error;
    return applyCors(
      NextResponse.json(
        { error: ERROR_MESSAGES.AI_REQUEST_FAILED, details: error?.message || String(err) },
        { status: 500 }
      )
    );
  }
}
