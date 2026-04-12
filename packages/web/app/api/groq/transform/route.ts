import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { API_CONFIG, ERROR_MESSAGES, RATE_LIMITS } from "@/lib/constants";
import { SYSTEM_PROMPTS, sanitizeUserInput } from "@/lib/prompts";
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

const REQUEST_TIMEOUT_MS = 12000;
const TRANSFORM_MODES = new Set(["summary", "bullets"]);

type TransformMode = "summary" | "bullets";

function getSystemPrompt(mode: TransformMode) {
  return mode === "summary"
    ? SYSTEM_PROMPTS.SUMMARY_TRANSFORM
    : SYSTEM_PROMPTS.BULLETS_TRANSFORM;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
  }

  const clientId = getClientIdentifier(user.id, req);
  const rateLimitResult = await applyRateLimit(
    clientId,
    "ai-transform",
    RATE_LIMITS.AI_TRANSFORM
  );
  if (rateLimitResult) return rateLimitResult;

  let apiKey: string;
  try {
    apiKey = getGroqApiKey();
  } catch {
    return NextResponse.json(
      { error: ERROR_MESSAGES.SERVER_MISSING_API_KEY },
      { status: 500 }
    );
  }

  const bodyResult = await parseJsonBody<{
    text?: unknown;
    mode?: unknown;
    title?: unknown;
  }>(req);
  if (!bodyResult.success) {
    return bodyResult.response;
  }

  const rawMode =
    typeof bodyResult.data.mode === "string" ? bodyResult.data.mode.trim() : "";
  if (!TRANSFORM_MODES.has(rawMode)) {
    return NextResponse.json(
      { error: "Invalid transform mode." },
      { status: 400 }
    );
  }

  const mode = rawMode as TransformMode;

  const inputResult = validateAndWrapInput(bodyResult.data.text, {
    requiredError: ERROR_MESSAGES.TEXT_REQUIRED,
    tagName: "content",
  });
  if (!inputResult.success) {
    return inputResult.response;
  }

  const sanitizedTitle = sanitizeUserInput(
    getOptionalTrimmedString(bodyResult.data.title) ?? ""
  );

  try {
    const response = await fetchGroqChatCompletion({
      apiKey,
      messages: [
        {
          role: "system",
          content: `${getSystemPrompt(mode)}\nReturn plain text only. Do NOT wrap output in markdown code blocks or backticks.`,
        },
        {
          role: "user",
          content: [
            `Transform mode: ${mode}`,
            `Title: ${sanitizedTitle || "(none)"}`,
            inputResult.wrappedText,
          ].join("\n\n"),
        },
      ],
      temperature: API_CONFIG.FORMAT_TEMPERATURE,
      topP: API_CONFIG.FORMAT_TOP_P,
      maxTokens: API_CONFIG.FORMAT_TRANSFORM_MAX_TOKENS,
      stream: true,
      timeoutMs: REQUEST_TIMEOUT_MS,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        {
          error: ERROR_MESSAGES.GROQ_API_ERROR,
          details: errorText,
          status: response.status,
        },
        { status: response.status }
      );
    }

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
      {
        error: ERROR_MESSAGES.GROQ_REQUEST_FAILED,
        details: error?.message || String(err),
      },
      { status: 500 }
    );
  }
}
