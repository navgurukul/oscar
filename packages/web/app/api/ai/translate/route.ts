import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { API_CONFIG, ERROR_MESSAGES, RATE_LIMITS } from "@/lib/constants";
import { SYSTEM_PROMPTS } from "@/lib/prompts";
import {
  applyRateLimit,
  getClientIdentifier,
} from "@/lib/middleware/rate-limit";
import {
  parseJsonBody,
  validateAndWrapInput,
} from "@/lib/server/ai-route";
import { getMercuryApiKey, mercuryGenerateText } from "@/lib/server/mercury";

const REQUEST_TIMEOUT_MS = 15000;

type TranslateRequestBody = {
  text?: unknown;
  targetLanguage?: unknown;
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
  }

  const clientId = getClientIdentifier(user.id, req);
  const rateLimitResult = await applyRateLimit(clientId, "ai-translate", RATE_LIMITS.AI_TRANSLATE);
  if (rateLimitResult) return rateLimitResult;

  let apiKey: string;
  try {
    apiKey = getMercuryApiKey();
  } catch {
    return NextResponse.json({ error: ERROR_MESSAGES.SERVER_MISSING_API_KEY }, { status: 500 });
  }

  const bodyResult = await parseJsonBody<TranslateRequestBody>(req);
  if (!bodyResult.success) return bodyResult.response;

  const inputResult = validateAndWrapInput(bodyResult.data.text, {
    requiredError: ERROR_MESSAGES.NO_TEXT_PROVIDED_FOR_TRANSLATION,
    tagName: "text",
  });
  if (!inputResult.success) return inputResult.response;

  const rawTargetLanguage = bodyResult.data.targetLanguage;
  const targetLanguage = rawTargetLanguage === undefined ? "en" : rawTargetLanguage;
  if (
    typeof targetLanguage !== "string" ||
    (targetLanguage !== "en" && targetLanguage !== "hi")
  ) {
    return NextResponse.json(
      { error: "targetLanguage must be 'en' or 'hi'" },
      { status: 400 }
    );
  }

  const languageLabel = targetLanguage === "hi" ? "Hindi" : "English";

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
    });
    return NextResponse.json({ translatedText });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { error: ERROR_MESSAGES.AI_REQUEST_FAILED, details: error?.message || String(err) },
      { status: 500 }
    );
  }
}
