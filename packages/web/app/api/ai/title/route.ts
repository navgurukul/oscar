import { NextRequest, NextResponse } from "next/server";
import { API_CONFIG, ERROR_MESSAGES, RATE_LIMITS } from "@/lib/constants";
import { SYSTEM_PROMPTS, USER_PROMPTS } from "@/lib/prompts";
import { buildOrgContext } from "@/lib/server/orgContext";
import { isOrgFeatureEnabled } from "@/lib/featureFlags";
import {
  applyRateLimit,
  getClientIdentifier,
} from "@/lib/middleware/rate-limit";
import {
  applyCors,
  authenticateRequest,
  corsPreflightResponse,
  generateText,
  getGeminiApiKey,
  parseJsonBody,
  validateAndWrapInput,
} from "@/lib/server/ai-route";

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
    apiKey = getGeminiApiKey();
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

  let systemPrompt: string = SYSTEM_PROMPTS.TITLE;
  if (isOrgFeatureEnabled()) {
    const orgCtx = await buildOrgContext(user.id, { includeDocs: false });
    if (orgCtx.vocabulary.length > 0) {
      const vocabLine = orgCtx.vocabulary
        .slice(0, 30)
        .map((v) => v.term)
        .join(", ");
      systemPrompt = `${SYSTEM_PROMPTS.TITLE}\n\nPrefer these exact spellings when applicable: ${vocabLine}.`;
    }
  }

  try {
    const title = await generateText({
      apiKey,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `${USER_PROMPTS.TITLE_TEMPLATE}${inputResult.wrappedText}` },
      ],
      temperature: API_CONFIG.TITLE_TEMPERATURE,
      topP: API_CONFIG.TITLE_TOP_P,
      maxTokens: API_CONFIG.TITLE_MAX_TOKENS,
      timeoutMs: REQUEST_TIMEOUT_MS,
    });
    return applyCors(NextResponse.json({ title }));
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
