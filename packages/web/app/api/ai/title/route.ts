import { NextRequest, NextResponse } from "next/server";
import { API_CONFIG, ERROR_MESSAGES, RATE_LIMITS } from "@/lib/constants";
import { SYSTEM_PROMPTS, USER_PROMPTS } from "@/lib/prompts";
import {
  applyRateLimit,
  getClientIdentifier,
} from "@/lib/middleware/rate-limit";
import {
  applyCors,
  authenticateRequest,
  corsPreflightResponse,
  parseJsonBody,
  validateAndWrapInput,
} from "@/lib/server/ai-route";
import {
  getMercuryApiKey,
  mercuryGenerateText,
  type MercuryUsage,
} from "@/lib/server/mercury";
import { captureLLM } from "@/lib/server/observability";

const REQUEST_TIMEOUT_MS = 12000;

export function OPTIONS() {
  return corsPreflightResponse();
}

export async function POST(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  const clientId = getClientIdentifier(user.id, req);
  const rateLimitResult = await applyRateLimit(clientId, "ai-title", RATE_LIMITS.AI_TITLE);
  if (rateLimitResult) return applyCors(rateLimitResult);

  let apiKey: string;
  try {
    apiKey = getMercuryApiKey();
  } catch {
    return applyCors(
      NextResponse.json({ error: ERROR_MESSAGES.SERVER_MISSING_API_KEY }, { status: 500 })
    );
  }

  const bodyResult = await parseJsonBody<{ text?: unknown }>(req);
  if (!bodyResult.success) return applyCors(bodyResult.response);

  const inputResult = validateAndWrapInput(bodyResult.data.text, {
    requiredError: ERROR_MESSAGES.TEXT_REQUIRED,
    tagName: "content",
  });
  if (!inputResult.success) return applyCors(inputResult.response);

  // NOTE: org-context lookup was removed here. buildOrgContext() was called
  // with no queryText, so vocabulary matching never ran and it always returned
  // an empty list — the spelling-hint branch below was dead, yet it cost ~7
  // Supabase round-trips on the (serial) title path. Titles don't need org
  // vocabulary; drop the call entirely.
  const t0 = performance.now();
  let usage: MercuryUsage = {};
  try {
    const title = await mercuryGenerateText({
      apiKey,
      messages: [
        { role: "system", content: SYSTEM_PROMPTS.TITLE },
        { role: "user", content: `${USER_PROMPTS.TITLE_TEMPLATE}${inputResult.wrappedText}` },
      ],
      temperature: API_CONFIG.TITLE_TEMPERATURE,
      topP: API_CONFIG.TITLE_TOP_P,
      maxTokens: API_CONFIG.TITLE_MAX_TOKENS,
      timeoutMs: REQUEST_TIMEOUT_MS,
      onUsage: (u) => { usage = u; },
    });
    await captureLLM({
      userId: user.id,
      route: "title",
      provider: "mercury",
      latencyMs: performance.now() - t0,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      outputChars: title.length,
    });
    return applyCors(NextResponse.json({ title }));
  } catch (err: unknown) {
    const error = err as Error;
    await captureLLM({
      userId: user.id,
      route: "title",
      provider: "mercury",
      latencyMs: performance.now() - t0,
      isError: true,
      error: err,
    });
    return applyCors(
      NextResponse.json(
        { error: ERROR_MESSAGES.AI_REQUEST_FAILED, details: error?.message || String(err) },
        { status: 500 }
      )
    );
  }
}
