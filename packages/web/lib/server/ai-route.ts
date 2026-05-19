import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { API_CONFIG, ERROR_MESSAGES } from "@/lib/constants";
import { validateUserInput, wrapUserInput } from "@/lib/prompts";
import { createClient } from "@/lib/supabase/server";

export type AIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

// ── CORS ───────────────────────────────────────────────────────────────────
// AI routes accept Bearer-token requests from the desktop app (cross-origin)
// in addition to same-origin cookie sessions from the web app. Auth is the
// gate; CORS is permissive on purpose.

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export function applyCors(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

export function corsPreflightResponse(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// ── Auth ───────────────────────────────────────────────────────────────────
// Returns both the user identity and a Supabase client whose subsequent queries
// run with that user's RLS context — Bearer header for desktop, cookie session
// for web. Callers should use the returned client for any authenticated query.

type AuthenticatedUser = { id: string; email: string | null };
type AuthSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type AuthResult =
  | { success: true; user: AuthenticatedUser; supabase: AuthSupabaseClient }
  | { success: false; response: NextResponse };

function createBearerClient(token: string): AuthSupabaseClient {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: { getAll: () => [], setAll: () => {} },
      global: { headers: { Authorization: `Bearer ${token}` } },
    }
  );
}

export async function authenticateRequest(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) {
      const supabase = createBearerClient(token);
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data.user) {
        return {
          success: true,
          user: { id: data.user.id, email: data.user.email ?? null },
          supabase,
        };
      }
    }
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    return {
      success: true,
      user: { id: user.id, email: user.email ?? null },
      supabase,
    };
  }

  return {
    success: false,
    response: applyCors(
      NextResponse.json({ error: "Unauthorized access" }, { status: 401 })
    ),
  };
}

// ── Request helpers ────────────────────────────────────────────────────────

export async function parseJsonBody<T>(
  request: Request
): Promise<{ success: true; data: T } | { success: false; response: NextResponse }> {
  try {
    return { success: true, data: (await request.json()) as T };
  } catch {
    return {
      success: false,
      response: NextResponse.json(
        { error: ERROR_MESSAGES.INVALID_JSON_BODY },
        { status: 400 }
      ),
    };
  }
}

export function getTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function getOptionalTrimmedString(value: unknown): string | undefined {
  const text = getTrimmedString(value);
  return text || undefined;
}

export function getGeminiApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error(ERROR_MESSAGES.SERVER_MISSING_API_KEY);
  return apiKey;
}

export function validateAndWrapInput(
  value: unknown,
  { requiredError, tagName }: { requiredError: string; tagName: string }
):
  | { success: true; text: string; wrappedText: string }
  | { success: false; response: NextResponse } {
  const text = getTrimmedString(value);
  if (!text) {
    return {
      success: false,
      response: NextResponse.json({ error: requiredError }, { status: 400 }),
    };
  }

  const validation = validateUserInput(text);
  if (!validation.isValid) {
    console.warn(
      `Prompt injection attempt (${validation.severity}): ${validation.warning}`
    );
    return {
      success: false,
      response: NextResponse.json(
        { error: "Input validation failed", details: validation.warning },
        { status: 400 }
      ),
    };
  }

  return { success: true, text, wrappedText: wrapUserInput(text, tagName) };
}

// ── Response helpers ───────────────────────────────────────────────────────

export function stripMarkdownCodeFences(text: string): string {
  return text
    .replace(/^```[\w]*\n/, "")
    .replace(/\n```$/, "")
    .trim();
}

export function createPlainTextStreamResponse(stream: ReadableStream<Uint8Array>) {
  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

// ── Gemini SDK helpers ─────────────────────────────────────────────────────

const RETRY_MAX = 2;
const RETRY_BASE_MS = 1000;

function buildModel(
  apiKey: string,
  messages: AIMessage[],
  model: string,
  timeoutMs: number
) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const systemMsg = messages.find((m) => m.role === "system");
  return genAI.getGenerativeModel(
    { model, ...(systemMsg ? { systemInstruction: systemMsg.content } : {}) },
    { timeout: timeoutMs }
  );
}

function buildContents(messages: AIMessage[]) {
  return messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? ("model" as const) : ("user" as const),
      parts: [{ text: m.content }],
    }));
}

function isRetryable(err: unknown): boolean {
  const msg = (err as Error)?.message ?? "";
  return !msg.includes("[400]") && !msg.includes("[401]") && !msg.includes("[403]");
}

export async function generateText({
  apiKey,
  messages,
  maxTokens,
  temperature,
  topP,
  model = API_CONFIG.GEMINI_MODEL_FAST,
  timeoutMs,
}: {
  apiKey: string;
  messages: AIMessage[];
  maxTokens: number;
  temperature?: number;
  topP?: number;
  model?: string;
  timeoutMs: number;
}): Promise<string> {
  const geminiModel = buildModel(apiKey, messages, model, timeoutMs);
  const contents = buildContents(messages);
  const generationConfig = { temperature, topP, maxOutputTokens: maxTokens };

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= RETRY_MAX; attempt++) {
    try {
      const result = await geminiModel.generateContent({ contents, generationConfig });
      const text = result.response.text().trim();
      if (!text) throw new Error(ERROR_MESSAGES.INVALID_AI_RESPONSE);
      return stripMarkdownCodeFences(text);
    } catch (err) {
      lastError = err as Error;
      if (!isRetryable(err) || attempt === RETRY_MAX) break;
      await new Promise((r) => setTimeout(r, RETRY_BASE_MS * 2 ** attempt));
    }
  }
  throw lastError!;
}

export type PendingGeminiStream = {
  pipe: (
    controller: ReadableStreamDefaultController<Uint8Array>,
    encoder: TextEncoder
  ) => Promise<void>;
};

export function startGeminiStream({
  apiKey,
  messages,
  maxTokens,
  temperature,
  topP,
  model = API_CONFIG.GEMINI_MODEL_FAST,
  timeoutMs,
}: {
  apiKey: string;
  messages: AIMessage[];
  maxTokens: number;
  temperature?: number;
  topP?: number;
  model?: string;
  timeoutMs: number;
}): PendingGeminiStream {
  const geminiModel = buildModel(apiKey, messages, model, timeoutMs);
  const resultPromise = geminiModel.generateContentStream({
    contents: buildContents(messages),
    generationConfig: { temperature, topP, maxOutputTokens: maxTokens },
  });

  return {
    async pipe(controller, encoder) {
      const result = await resultPromise;
      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) controller.enqueue(encoder.encode(text));
      }
    },
  };
}
