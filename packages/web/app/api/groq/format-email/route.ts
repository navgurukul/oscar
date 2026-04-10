import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { API_CONFIG, ERROR_MESSAGES, RATE_LIMITS } from "@/lib/constants";
import {
  SYSTEM_PROMPTS,
  sanitizeUserInput,
} from "@/lib/prompts";
import {
  applyRateLimit,
  getClientIdentifier,
} from "@/lib/middleware/rate-limit";
import {
  createPlainTextStreamResponse,
  fetchGroqChatCompletion,
  getGroqApiKey,
  getOptionalTrimmedString,
  parseJsonBody,
  pipeGroqStreamToController,
  validateAndWrapInput,
} from "@/lib/server/ai-route";

const REQUEST_TIMEOUT_MS = 12000; // ✅ was 30s — tighter timeout matches lower token limit

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
  }

  const clientId = getClientIdentifier(user.id, req);
  const rateLimitResult = applyRateLimit(clientId, "ai-format-email", RATE_LIMITS.AI_FORMAT_EMAIL);
  if (rateLimitResult) return rateLimitResult;

  let apiKey: string;
  try {
    apiKey = getGroqApiKey();
  } catch {
    return NextResponse.json({ error: ERROR_MESSAGES.SERVER_MISSING_API_KEY }, { status: 500 });
  }

  const bodyResult = await parseJsonBody<{ rawText?: unknown; title?: unknown }>(req);
  if (!bodyResult.success) {
    return bodyResult.response;
  }

  const inputResult = validateAndWrapInput(bodyResult.data.rawText, {
    requiredError: ERROR_MESSAGES.RAW_TEXT_REQUIRED,
    tagName: "content",
  });
  if (!inputResult.success) {
    return inputResult.response;
  }

  try {
    const sanitizedTitle = sanitizeUserInput(
      getOptionalTrimmedString(bodyResult.data.title) ?? ""
    );

    // ✅ Stream the response for perceived speed
    const response = await fetchGroqChatCompletion({
      apiKey,
      messages: [
        {
          role: "system",
          content: `${SYSTEM_PROMPTS.EMAIL_FORMAT}\nReturn plain text only. Do NOT wrap output in markdown code blocks or backticks.`,
        },
        {
          role: "user",
          content: `Convert this note into a Gmail-ready formal email body. If a title is provided, reference it in the intro naturally.\n\nTitle: ${sanitizedTitle || "(none)"}\n\n${inputResult.wrappedText}`,
        },
      ],
      temperature: API_CONFIG.FORMAT_TEMPERATURE,
      topP: API_CONFIG.FORMAT_TOP_P,
      maxTokens: API_CONFIG.FORMAT_EMAIL_MAX_TOKENS ?? 2048,
      stream: true,
      timeoutMs: REQUEST_TIMEOUT_MS,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: ERROR_MESSAGES.GROQ_API_ERROR, details: errorText, status: response.status },
        { status: response.status }
      );
    }

    // ✅ Stream chunks directly to client as they arrive
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          await pipeGroqStreamToController(response, controller, encoder);
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
