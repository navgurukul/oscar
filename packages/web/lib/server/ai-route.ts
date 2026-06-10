import { GoogleGenerativeAI, type GenerationConfig } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { API_CONFIG, ERROR_MESSAGES, SUBSCRIPTION_CONFIG } from "@/lib/constants";
import { validateUserInput, wrapUserInput } from "@/lib/prompts";
import { createClient } from "@/lib/supabase/server";
import { usageService } from "@/lib/services/usage.service";

// Absolute ceiling on any single AI-route input. The expensive routes (format)
// fan out one model stream per chunk, so an uncapped transcript is a cost-
// amplification vector — one rate-limit token, unbounded parallel spend. 12k
// chars (~2k words / ~15 min of speech) is a generous single-Scribble bound and
// mirrors the publish route's cap. Longer input is rejected, not silently
// truncated, so the user knows to split the recording.
export const MAX_AI_INPUT_CHARS = 12000;

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
  {
    requiredError,
    tagName,
    maxLength = MAX_AI_INPUT_CHARS,
  }: { requiredError: string; tagName: string; maxLength?: number }
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

  if (text.length > maxLength) {
    return {
      success: false,
      response: NextResponse.json(
        {
          error: "Input too large",
          details: `Text exceeds the ${maxLength.toLocaleString()}-character limit. Split it into shorter recordings.`,
        },
        { status: 413 }
      ),
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

// ── Usage quota ──────────────────────────────────────────────────────────────
// Server-side enforcement of the free-tier monthly recording quota. The counter
// itself is incremented authoritatively in the format route (see that route),
// so a tampered client cannot earn unlimited AI spend by skipping the old
// client-driven /api/usage/increment call. Returns a 402 response when the org
// is over quota, or null to proceed. Pro orgs always pass.
export async function enforceRecordingQuota(
  userId: string
): Promise<NextResponse | null> {
  const { allowed, current } = await usageService.canUserRecord(userId);
  if (allowed) return null;
  return NextResponse.json(
    {
      error: "Monthly Scribble limit reached",
      message:
        "You've reached your free monthly Scribble limit. Upgrade to Pro for unlimited Scribbles.",
      current,
      remaining: 0,
      upgradeRequired: true,
      limit: SUBSCRIPTION_CONFIG.FREE_ORG_MONTHLY_RECORDINGS,
    },
    { status: 402 }
  );
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
  // gemini-2.5-flash reasons by default and spends those thinking tokens from
  // the same maxOutputTokens budget. A tight cap (e.g. the short title budget)
  // can be consumed entirely by thinking, leaving an empty answer that trips
  // the `if (!text) throw` below and 500s the route. Pin thinkingBudget=0 to
  // disable reasoning so the whole budget reaches the answer — same fix the
  // meeting-enhance edge function applies. The installed
  // @google/generative-ai@0.24.1 has no thinkingConfig in its types but
  // forwards unknown generationConfig fields to the REST API verbatim, hence
  // the widened type.
  const generationConfig: GenerationConfig & {
    thinkingConfig?: { thinkingBudget: number };
  } = {
    temperature,
    topP,
    maxOutputTokens: maxTokens,
    thinkingConfig: { thinkingBudget: 0 },
  };

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
