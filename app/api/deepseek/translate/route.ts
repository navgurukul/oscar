import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { API_CONFIG, ERROR_MESSAGES, RATE_LIMITS } from "@/lib/constants";
import { SYSTEM_PROMPTS, validateUserInput, wrapUserInput } from "@/lib/prompts";
import {
  applyRateLimit,
  getClientIdentifier,
} from "@/lib/middleware/rate-limit";

const REQUEST_TIMEOUT_MS = 30000; // 30 seconds

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request to AI service timed out");
    }
    throw error;
  }
}

type TranslateRequestBody = {
  text?: string;
  targetLanguage?: "en" | "hi";
};

export async function POST(req: NextRequest) {
  // Check authentication
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
  }

  // Apply rate limiting
  const clientId = getClientIdentifier(user.id, req);
  const rateLimitResult = applyRateLimit(
    clientId,
    "ai-translate",
    RATE_LIMITS.AI_TRANSLATE
  );
  if (rateLimitResult) return rateLimitResult;

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: ERROR_MESSAGES.SERVER_MISSING_API_KEY },
      { status: 500 }
    );
  }

  let body: TranslateRequestBody;
  try {
    body = (await req.json()) as TranslateRequestBody;
  } catch {
    return NextResponse.json(
      { error: ERROR_MESSAGES.INVALID_JSON_BODY },
      { status: 400 }
    );
  }

  const text = (body.text || "").trim();
  const targetLanguage = body.targetLanguage || "en";

  if (!text) {
    return NextResponse.json(
      { error: ERROR_MESSAGES.NO_TEXT_PROVIDED_FOR_TRANSLATION },
      { status: 400 }
    );
  }

  if (targetLanguage !== "en" && targetLanguage !== "hi") {
    return NextResponse.json(
      { error: "targetLanguage must be 'en' or 'hi'" },
      { status: 400 }
    );
  }

  // SECURITY: Validate user input for prompt injection attempts
  const validation = validateUserInput(text);
  if (!validation.isValid) {
    console.warn(`Prompt injection attempt detected (${validation.severity}): ${validation.warning}`);
    return NextResponse.json(
      { 
        error: "Input validation failed",
        details: validation.warning 
      },
      { status: 400 }
    );
  }

  const languageLabel = targetLanguage === "hi" ? "Hindi" : "English";

  try {
    // SECURITY: Wrap user input in explicit delimiters
    const secureUserContent = wrapUserInput(text, 'text');
    
    const response = await fetchWithTimeout(API_CONFIG.DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: API_CONFIG.DEEPSEEK_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPTS.TRANSLATE },
          {
            role: "user",
            content: `TARGET LANGUAGE: ${languageLabel}\n\n${secureUserContent}`,
          },
        ],
        temperature: 0.2,
        top_p: 0.9,
        max_tokens: 8192,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        {
          error: ERROR_MESSAGES.DEEPSEEK_API_ERROR,
          details: errorText,
          status: response.status,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    const translatedText = data?.choices?.[0]?.message?.content?.trim() || "";

    if (!translatedText) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.EMPTY_RESPONSE_FROM_TRANSLATION },
        { status: 502 }
      );
    }

    return NextResponse.json({ translatedText });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      {
        error: ERROR_MESSAGES.DEEPSEEK_REQUEST_FAILED,
        details: error?.message || String(err),
      },
      { status: 500 }
    );
  }
}
