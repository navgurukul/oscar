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
import {
  getMercuryApiKey,
  mercuryGenerateText,
  type MercuryUsage,
} from "@/lib/server/mercury";
import { captureLLM } from "@/lib/server/observability";
import { ContextCompiler } from "@/lib/server/orgContext";
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
    resolveOrgContext?: unknown;
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

  // Org-context block resolution. Two client contracts coexist:
  //   - Legacy: the desktop precomputes the block via a separate POST to
  //     /api/ai/context and ships it as `orgContextBlock`. We use it as-is and
  //     do NOT compile — so for every shipped client this route is byte-for-byte
  //     unchanged.
  //   - Folded: newer clients OMIT the block and set `resolveOrgContext: true`,
  //     letting us compile it here in-process. That collapses the formerly
  //     separate client → /api/ai/context round-trip into this one request
  //     (the latency win). `text` IS the same raw transcript getBlock matched
  //     against, and ContextCompiler.compile is deterministic, so the resolved
  //     block is identical to what the context route would have returned.
  // Compile failure degrades to an empty block exactly like the client getBlock
  // did (swallow-and-continue), so a context error never blocks the cleanup.
  let orgBlock = suppliedOrgContext;
  if (!orgBlock && bodyResult.data.resolveOrgContext === true) {
    try {
      const compiled = await ContextCompiler.compile({
        userId: user.id,
        rawTranscript: text,
        profile: "stream",
      });
      orgBlock = compiled.block;
    } catch (err) {
      console.warn(
        "[dictation-cleanup] org-context compile failed; cleaning without it",
        err,
      );
      orgBlock = "";
    }
  }

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
  const system = orgBlock
    ? `${baseSystem}\n\n---\n\n${orgBlock}`
    : baseSystem;

  let usage: MercuryUsage = {};
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
      onUsage: (u) => { usage = u; },
    });
    const tMercuryDone = performance.now();

    const polished = applyStreamPolish(raw);
    const corrected = orgBlock
      ? applyOrgRewriteRules(polished, orgBlock).trim()
      : polished;

    const timing: DictationServerTiming = {
      edgeTotalMs: Math.round(tMercuryDone - tStart),
      mercuryMs: Math.round(tMercuryDone - tMercury0),
      mercuryHeadersMs: 0,
      cacheHitPct: 0,
    };

    await captureLLM({
      userId: user.id,
      route: "dictation-cleanup",
      provider: "mercury",
      latencyMs: timing.mercuryMs,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      inputChars: text.length,
      outputChars: corrected.length,
    });

    // Empty or chatty-refusal output is the silence path — paste nothing.
    if (!corrected || looksLikeRefusal(corrected)) {
      return emptyResponse(timing);
    }

    return applyCors(NextResponse.json({ text: corrected, timing }));
  } catch (err: unknown) {
    const error = err as Error;
    await captureLLM({
      userId: user.id,
      route: "dictation-cleanup",
      provider: "mercury",
      latencyMs: Math.round(performance.now() - tStart),
      inputChars: text.length,
      isError: true,
      error: err,
    });
    return applyCors(
      NextResponse.json(
        { error: ERROR_MESSAGES.AI_REQUEST_FAILED, details: error?.message || String(err) },
        { status: 500 },
      ),
    );
  }
}
