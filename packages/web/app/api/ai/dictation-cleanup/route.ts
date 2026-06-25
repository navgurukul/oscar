import { NextRequest, NextResponse } from "next/server";
import { ERROR_MESSAGES, RATE_LIMITS } from "@/lib/constants";
import {
  applyRateLimit,
  getClientIdentifier,
} from "@/lib/middleware/rate-limit";
import {
  applyCors,
  authenticateRequest,
  corsPreflightResponse,
  getOptionalTrimmedString,
  getTrimmedString,
  MAX_AI_INPUT_CHARS,
  parseJsonBody,
} from "@/lib/server/ai-route";
import { getMercuryApiKey, mercuryGenerateText } from "@/lib/server/mercury";
import {
  applyOrgRewriteRules,
  applyStreamPolish,
  buildStreamCleanupPrompt,
  dictationCleanupMaxTokens,
  isRewriteStyle,
  looksLikeRefusal,
  looksLikeTrivialHallucination,
  type DictationContextSnapshot,
  type DictationRoutingResult,
} from "@/lib/server/streamCleanup";

// Web mirror of the desktop ai-process edge function's `transcribe_cleanup`
// path. Lets desktop dictation run on the same Amplify Mercury route as
// Scribble (one key, one Mercury client). See ai-backend-consolidation.html
// (Plan A) and lib/server/streamCleanup.ts for the source-of-truth note.
//
// Non-streaming on purpose: the desktop pill pastes the whole cleaned string at
// once, so there is nothing to stream — it returns { text, timing } like the
// edge function did.

const REQUEST_TIMEOUT_MS = 12000;

interface DictationServerTiming {
  edgeTotalMs: number;
  mercuryMs: number;
  mercuryHeadersMs: number;
  cacheHitPct: number;
}

function emptyResponse(timing: DictationServerTiming): NextResponse {
  return applyCors(NextResponse.json({ text: "", timing }));
}

export function OPTIONS() {
  return corsPreflightResponse();
}

export async function POST(req: NextRequest) {
  const tStart = performance.now();

  const authResult = await authenticateRequest(req);
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  const bodyResult = await parseJsonBody<{
    text?: unknown;
    mode?: unknown;
    context?: DictationContextSnapshot;
    routing?: DictationRoutingResult;
    stylePreset?: unknown;
    orgContextBlock?: unknown;
    language?: unknown;
    warmup?: unknown;
  }>(req);
  if (!bodyResult.success) return applyCors(bodyResult.response);

  const zeroTiming: DictationServerTiming = {
    edgeTotalMs: Math.round(performance.now() - tStart),
    mercuryMs: 0,
    mercuryHeadersMs: 0,
    cacheHitPct: 0,
  };

  // Prewarm ping: auth already booted the Lambda + Supabase auth client, so
  // return before any Mercury/quota work. The desktop fires this during the
  // Whisper window so the cold-start is paid off the cleanup critical path.
  if (bodyResult.data.warmup === true) {
    return emptyResponse(zeroTiming);
  }

  const clientId = getClientIdentifier(user.id, req);
  const rateLimitResult = await applyRateLimit(
    clientId,
    "ai-dictation-cleanup",
    RATE_LIMITS.AI_DICTATION_CLEANUP,
  );
  if (rateLimitResult) return applyCors(rateLimitResult);

  let apiKey: string;
  try {
    apiKey = getMercuryApiKey();
  } catch {
    return applyCors(
      NextResponse.json({ error: ERROR_MESSAGES.SERVER_MISSING_API_KEY }, { status: 500 }),
    );
  }

  // Only the dictation cleanup mode is served here; other ai-process modes
  // (meeting fallback summary/bullets/notes) stay on the edge function.
  const mode = getTrimmedString(bodyResult.data.mode) || "transcribe_cleanup";
  if (mode !== "transcribe_cleanup") {
    return applyCors(
      NextResponse.json({ error: "Unsupported cleanup mode." }, { status: 400 }),
    );
  }

  // Deliberately NOT running the prompt-injection validator here: the edge path
  // never did, the cleanup system prompt is hardened against following
  // instructions in the transcript, and dictation is arbitrary free speech that
  // the validator would false-reject. Length is still capped.
  const text = getTrimmedString(bodyResult.data.text);
  if (!text) {
    return applyCors(
      NextResponse.json({ error: ERROR_MESSAGES.TEXT_REQUIRED }, { status: 400 }),
    );
  }
  if (text.length > MAX_AI_INPUT_CHARS) {
    return applyCors(
      NextResponse.json(
        {
          error: "Input too large",
          details: `Text exceeds the ${MAX_AI_INPUT_CHARS.toLocaleString()}-character limit.`,
        },
        { status: 413 },
      ),
    );
  }

  // Pure silence / punctuation-only is the Whisper-hallucination signal — return
  // empty before spending a Mercury round-trip, matching the edge short-circuit.
  if (looksLikeTrivialHallucination(text)) {
    return emptyResponse(zeroTiming);
  }

  const stylePreset = getOptionalTrimmedString(bodyResult.data.stylePreset);
  const language = getOptionalTrimmedString(bodyResult.data.language);
  const suppliedOrgContext =
    typeof bodyResult.data.orgContextBlock === "string"
      ? bodyResult.data.orgContextBlock.trim()
      : "";

  const rewrite = isRewriteStyle(stylePreset);
  const { system: baseSystem, user: prompt } = buildStreamCleanupPrompt(
    text,
    bodyResult.data.routing,
    stylePreset,
    language,
  );
  // Append the org-context block AFTER the base prompt (the cleanup prompt
  // refers to "the Organization Context block ... below") — matches the edge
  // function's ordering exactly, NOT joinSystemPrompt's context-first layout.
  const system = suppliedOrgContext
    ? `${baseSystem}\n\n---\n\n${suppliedOrgContext}`
    : baseSystem;

  try {
    const tMercury0 = performance.now();
    const raw = await mercuryGenerateText({
      apiKey,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      maxTokens: dictationCleanupMaxTokens(text.length, rewrite),
      // Cleanup runs with reasoning off (the tight token cap would otherwise be
      // eaten by thinking); the rewrite mode gets a little. Temperature mirrors
      // the edge values (Mercury rejects < 0.5).
      reasoningEffort: rewrite ? "low" : "minimal",
      temperature: rewrite ? 0.6 : 0.5,
      timeoutMs: REQUEST_TIMEOUT_MS,
    });
    const tMercuryDone = performance.now();

    const polished = applyStreamPolish(raw);
    const corrected = suppliedOrgContext
      ? applyOrgRewriteRules(polished, suppliedOrgContext).trim()
      : polished;

    const timing: DictationServerTiming = {
      edgeTotalMs: Math.round(tMercuryDone - tStart),
      mercuryMs: Math.round(tMercuryDone - tMercury0),
      mercuryHeadersMs: 0,
      cacheHitPct: 0,
    };

    // Empty or chatty-refusal output is the silence path — paste nothing.
    if (!corrected || looksLikeRefusal(corrected)) {
      return emptyResponse(timing);
    }

    return applyCors(NextResponse.json({ text: corrected, timing }));
  } catch (err: unknown) {
    const error = err as Error;
    return applyCors(
      NextResponse.json(
        { error: ERROR_MESSAGES.AI_REQUEST_FAILED, details: error?.message || String(err) },
        { status: 500 },
      ),
    );
  }
}
