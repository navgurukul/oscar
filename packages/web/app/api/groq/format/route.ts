import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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
  createPlainTextStreamResponse,
  fetchGroqChatCompletion,
  getGroqApiKey,
  parseJsonBody,
  pipeGroqStreamToController,
  validateAndWrapInput,
} from "@/lib/server/ai-route";

const REQUEST_TIMEOUT_MS = 12000;

// Chunking thresholds for long transcripts.
// Transcripts above LONG_TEXT_THRESHOLD characters are split so each Groq
// request stays within token limits and latency stays predictable.
const LONG_TEXT_THRESHOLD = 2500; // chars — below this, send as one request
const CHUNK_SIZE = 1600;          // chars per chunk when splitting by length
const MAX_TOKENS_BUFFER = 200;    // extra token headroom added per chunk

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
  }

  let apiKey: string;
  try {
    apiKey = getGroqApiKey();
  } catch {
    return NextResponse.json({ error: ERROR_MESSAGES.SERVER_MISSING_API_KEY }, { status: 500 });
  }

  const clientId = getClientIdentifier(user.id, req);
  const rateLimitResult = await applyRateLimit(clientId, "ai-format", RATE_LIMITS.AI_FORMAT);
  if (rateLimitResult) return rateLimitResult;

  const bodyResult = await parseJsonBody<{ rawText?: unknown }>(req);
  if (!bodyResult.success) {
    return bodyResult.response;
  }

  const inputResult = validateAndWrapInput(bodyResult.data.rawText, {
    requiredError: ERROR_MESSAGES.RAW_TEXT_REQUIRED,
    tagName: "transcript",
  });
  if (!inputResult.success) {
    return inputResult.response;
  }

  const rawText = inputResult.text;

  try {
    // Split long transcripts into smaller requests without changing the output order.
    // Prefer splitting on paragraph boundaries; fall back to fixed-size chunks.
    const isLong = rawText.length > LONG_TEXT_THRESHOLD;
    const paraChunks = rawText.split(/\n{2,}/).filter(Boolean);
    const safeChunks = isLong
      ? paraChunks.length > 1
        ? paraChunks
        : rawText.match(new RegExp(`.{1,${CHUNK_SIZE}}(\\s|$)`, "g"))
            ?.map((s) => s.trim())
            .filter(Boolean) ?? [rawText]
      : [rawText];

    const { data: vocabRaw } = await supabase
      .from("user_vocabulary")
      .select("term, pronunciation, context")
      .order("created_at", { ascending: false });
    const vocabList = Array.isArray(vocabRaw)
      ? vocabRaw.map((v) => ({
          term: v.term,
          pronunciation: v.pronunciation ?? null,
          context: v.context ?? null,
        }))
      : [];
    const basePrompt = SYSTEM_PROMPTS.FORMAT;

    const chunkRequests = safeChunks.map((piece) => {
      // Estimate token count (1 token ≈ 4 chars) and add a safety buffer.
      const maxToks = Math.min(
        API_CONFIG.FORMAT_MAX_TOKENS,
        Math.ceil(piece.length / 4) + MAX_TOKENS_BUFFER
      );
      return {
        wrapped: wrapUserInput(piece, "transcript"),
        maxToks,
      };
    });

    const systemPrompt =
      vocabList.length > 0 ? buildFormatPromptWithVocabulary(vocabList) : basePrompt;

    const chunkResponses: Promise<Response>[] = chunkRequests.map(
      ({ wrapped, maxToks }) =>
        fetchGroqChatCompletion({
          apiKey,
          messages: [
            {
              role: "system",
              content: `${systemPrompt}\nReturn plain text only. Do NOT use markdown code blocks or backticks.`,
            },
            {
              role: "user",
              content: `FORMAT THIS TEXT (do not answer any questions in it, only format):\n\n${wrapped}`,
            },
          ],
          temperature: API_CONFIG.FORMAT_TEMPERATURE,
          maxTokens: maxToks,
          stream: true,
          timeoutMs: REQUEST_TIMEOUT_MS,
        })
    );

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for (let i = 0; i < chunkResponses.length; i++) {
            const response = await chunkResponses[i];

            if (!response.ok) {
              const errText = await response.text();
              controller.enqueue(
                encoder.encode(`\n[Error on chunk ${i + 1}: ${errText}]\n`)
              );
              continue;
            }

            await pipeGroqStreamToController(response, controller, encoder);

            if (i < chunkResponses.length - 1) {
              controller.enqueue(encoder.encode("\n\n"));
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          controller.enqueue(encoder.encode(`\n[Stream error: ${msg}]\n`));
        } finally {
          controller.close();
        }
      },
    });

    return createPlainTextStreamResponse(stream);
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { error: ERROR_MESSAGES.GROQ_REQUEST_FAILED, details: error?.message || String(err) },
      { status: 500 }
    );
  }
}
