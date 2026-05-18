import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { API_CONFIG, ERROR_MESSAGES, RATE_LIMITS } from "@/lib/constants";
import { SYSTEM_PROMPTS, USER_PROMPTS } from "@/lib/prompts";
import {
  applyRateLimit,
  getClientIdentifier,
} from "@/lib/middleware/rate-limit";
import {
  generateText,
  getGeminiApiKey,
  parseJsonBody,
  validateAndWrapInput,
} from "@/lib/server/ai-route";

const REQUEST_TIMEOUT_MS = 12000;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
  }

  const clientId = getClientIdentifier(user.id, req);
  const rateLimitResult = await applyRateLimit(clientId, "ai-title", RATE_LIMITS.AI_TITLE);
  if (rateLimitResult) return rateLimitResult;

  let apiKey: string;
  try {
    apiKey = getGeminiApiKey();
  } catch {
    return NextResponse.json({ error: ERROR_MESSAGES.SERVER_MISSING_API_KEY }, { status: 500 });
  }

  const bodyResult = await parseJsonBody<{ text?: unknown }>(req);
  if (!bodyResult.success) return bodyResult.response;

  const inputResult = validateAndWrapInput(bodyResult.data.text, {
    requiredError: ERROR_MESSAGES.TEXT_REQUIRED,
    tagName: "content",
  });
  if (!inputResult.success) return inputResult.response;

  try {
    const title = await generateText({
      apiKey,
      messages: [
        { role: "system", content: SYSTEM_PROMPTS.TITLE },
        { role: "user", content: `${USER_PROMPTS.TITLE_TEMPLATE}${inputResult.wrappedText}` },
      ],
      temperature: API_CONFIG.TITLE_TEMPERATURE,
      topP: API_CONFIG.TITLE_TOP_P,
      maxTokens: API_CONFIG.TITLE_MAX_TOKENS,
      timeoutMs: REQUEST_TIMEOUT_MS,
    });
    return NextResponse.json({ title });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { error: ERROR_MESSAGES.AI_REQUEST_FAILED, details: error?.message || String(err) },
      { status: 500 }
    );
  }
}
