import { NextRequest, NextResponse } from "next/server";
import { API_CONFIG, ERROR_MESSAGES, RATE_LIMITS } from "@/lib/constants";
import { SYSTEM_PROMPTS } from "@/lib/prompts";
import {
  applyRateLimit,
  getClientIdentifier,
} from "@/lib/middleware/rate-limit";
import {
  applyCors,
  authenticateRequest,
  corsPreflightResponse,
  enforceRecordingQuota,
  parseJsonBody,
  validateAndWrapInput,
} from "@/lib/server/ai-route";
import {
  getMercuryApiKey,
  mercuryGenerateText,
  type MercuryUsage,
} from "@/lib/server/mercury";
import { captureLLM } from "@/lib/server/observability";

const REQUEST_TIMEOUT_MS = 15000;

type TranslateRequestBody = {
  text?: unknown;
  targetLanguage?: unknown;
};

export function OPTIONS() {
  return corsPreflightResponse();
}

export async function POST(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  const clientId = getClientIdentifier(user.id, req);
  const rateLimitResult = await applyRateLimit(clientId, "ai-translate", RATE_LIMITS.AI_TRANSLATE);
  if (rateLimitResult) return applyCors(rateLimitResult);

  let apiKey: string;
  try {
    apiKey = getMercuryApiKey();
  } catch {
    return applyCors(
      NextResponse.json({ error: ERROR_MESSAGES.SERVER_MISSING_API_KEY }, { status: 500 })
    );
  }

  const bodyResult = await parseJsonBody<TranslateRequestBody>(req);
  if (!bodyResult.success) return applyCors(bodyResult.response);

  const inputResult = validateAndWrapInput(bodyResult.data.text, {
    requiredError: ERROR_MESSAGES.NO_TEXT_PROVIDED_FOR_TRANSLATION,
    tagName: "text",
  });
  if (!inputResult.success) return applyCors(inputResult.response);

  // Block further AI spend once the org is over its free monthly quota.
  const quotaResponse = await enforceRecordingQuota(user.id);
  if (quotaResponse) return applyCors(quotaResponse);

  const rawTargetLanguage = bodyResult.data.targetLanguage;
  const targetLanguage = rawTargetLanguage === undefined ? "en" : rawTargetLanguage;
  if (
    typeof targetLanguage !== "string" ||
    (targetLanguage !== "en" && targetLanguage !== "hi")
  ) {
    return applyCors(
      NextResponse.json(
        { error: "targetLanguage must be 'en' or 'hi'" },
        { status: 400 }
      )
    );
  }

  const languageLabel = targetLanguage === "hi" ? "Hindi" : "English";

  const t0 = performance.now();
  let usage: MercuryUsage = {};
  try {
    const translatedText = await mercuryGenerateText({
      apiKey,
      messages: [
        { role: "system", content: SYSTEM_PROMPTS.TRANSLATE },
        { role: "user", content: `TARGET LANGUAGE: ${languageLabel}\n\n${inputResult.wrappedText}` },
      ],
      temperature: API_CONFIG.TRANSLATE_TEMPERATURE,
      maxTokens: API_CONFIG.TRANSLATE_MAX_TOKENS,
      timeoutMs: REQUEST_TIMEOUT_MS,
      onUsage: (u) => { usage = u; },
    });
    await captureLLM({
      userId: user.id,
      route: "translate",
      provider: "mercury",
      latencyMs: performance.now() - t0,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      inputChars: inputResult.text.length,
      outputChars: translatedText.length,
    });
    return applyCors(NextResponse.json({ translatedText }));
  } catch (err: unknown) {
    const error = err as Error;
    await captureLLM({
      userId: user.id,
      route: "translate",
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
