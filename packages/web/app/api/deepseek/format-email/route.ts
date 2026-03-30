import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { API_CONFIG, ERROR_MESSAGES, RATE_LIMITS } from "@/lib/constants";
import {
  SYSTEM_PROMPTS,
  validateUserInput,
  wrapUserInput,
  sanitizeUserInput,
} from "@/lib/prompts";
import {
  applyRateLimit,
  getClientIdentifier,
} from "@/lib/middleware/rate-limit";

const REQUEST_TIMEOUT_MS = 12000; // ✅ was 30s — tighter timeout matches lower token limit

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
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

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
  }

  const clientId = getClientIdentifier(user.id, req);
  const rateLimitResult = applyRateLimit(clientId, "ai-format-email", RATE_LIMITS.AI_FORMAT_EMAIL);
  if (rateLimitResult) return rateLimitResult;

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: ERROR_MESSAGES.SERVER_MISSING_API_KEY }, { status: 500 });
  }

  let body: { rawText?: string; title?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: ERROR_MESSAGES.INVALID_JSON_BODY }, { status: 400 });
  }

  const rawText = (body.rawText || "").trim();
  const title = (body.title || "").trim();

  if (!rawText) {
    return NextResponse.json({ error: ERROR_MESSAGES.RAW_TEXT_REQUIRED }, { status: 400 });
  }

  const validation = validateUserInput(rawText);
  if (!validation.isValid) {
    console.warn(`Prompt injection attempt (${validation.severity}): ${validation.warning}`);
    return NextResponse.json(
      { error: "Input validation failed", details: validation.warning },
      { status: 400 }
    );
  }

  try {
    const secureUserContent = wrapUserInput(rawText, "content");
    const sanitizedTitle = sanitizeUserInput(title);

    // ✅ Stream the response for perceived speed
    const response = await fetchWithTimeout(API_CONFIG.GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: API_CONFIG.GROQ_MODEL_FAST,
        messages: [
          {
            role: "system",
            // ✅ Explicitly forbid markdown fences — removes need for post-cleanup
            content: `${SYSTEM_PROMPTS.EMAIL_FORMAT}\nReturn plain text only. Do NOT wrap output in markdown code blocks or backticks.`,
          },
          {
            role: "user",
            content: `Convert this note into a Gmail-ready formal email body. If a title is provided, reference it in the intro naturally.\n\nTitle: ${sanitizedTitle || "(none)"}\n\n${secureUserContent}`,
          },
        ],
        temperature: API_CONFIG.FORMAT_TEMPERATURE,
        top_p: API_CONFIG.FORMAT_TOP_P,
        max_tokens: API_CONFIG.FORMAT_EMAIL_MAX_TOKENS ?? 2048, // ✅ was 8192
        stream: true, // ✅ was false
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: ERROR_MESSAGES.DEEPSEEK_API_ERROR, details: errorText, status: response.status },
        { status: response.status }
      );
    }

    // ✅ Stream chunks directly to client as they arrive
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed === "data: [DONE]") continue;
              if (!trimmed.startsWith("data: ")) continue;

              try {
                const json = JSON.parse(trimmed.slice(6));
                const chunk = json?.choices?.[0]?.delta?.content || "";
                if (chunk) {
                  controller.enqueue(encoder.encode(chunk));
                }
              } catch {
                // skip malformed chunk
              }
            }
          }
        } finally {
          controller.close();
          reader.releaseLock();
        }
      },
    });

    // ✅ Return as a text stream — client reads it progressively
    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { error: ERROR_MESSAGES.DEEPSEEK_REQUEST_FAILED, details: error?.message || String(err) },
      { status: 500 }
    );
  }
}
