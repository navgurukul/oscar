import { NextResponse } from "next/server";
import { API_CONFIG, ERROR_MESSAGES } from "@/lib/constants";
import { validateUserInput, wrapUserInput } from "@/lib/prompts";

type AIRole = "system" | "user" | "assistant";

export interface AIMessage {
  role: AIRole;
  content: string;
}

interface GeminiPart {
  text: string;
}

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

interface GeminiSystemInstruction {
  parts: GeminiPart[];
}

interface GeminiGenerationConfig {
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
}

interface GeminiRequestBody {
  systemInstruction?: GeminiSystemInstruction;
  contents: GeminiContent[];
  generationConfig?: GeminiGenerationConfig;
}

export async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
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

export async function parseJsonBody<T>(
  request: Request
): Promise<{ success: true; data: T } | { success: false; response: NextResponse }> {
  try {
    return {
      success: true,
      data: (await request.json()) as T,
    };
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

  if (!apiKey) {
    throw new Error(ERROR_MESSAGES.SERVER_MISSING_API_KEY);
  }

  return apiKey;
}

export function validateAndWrapInput(
  value: unknown,
  {
    requiredError,
    tagName,
  }: {
    requiredError: string;
    tagName: string;
  }
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
        {
          error: "Input validation failed",
          details: validation.warning,
        },
        { status: 400 }
      ),
    };
  }

  return {
    success: true,
    text,
    wrappedText: wrapUserInput(text, tagName),
  };
}

function buildGeminiBody(
  messages: AIMessage[],
  generationConfig: GeminiGenerationConfig
): GeminiRequestBody {
  const systemParts: GeminiPart[] = [];
  const contents: GeminiContent[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      systemParts.push({ text: msg.content });
      continue;
    }
    contents.push({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    });
  }

  const body: GeminiRequestBody = { contents, generationConfig };
  if (systemParts.length > 0) {
    body.systemInstruction = { parts: systemParts };
  }
  return body;
}

export async function fetchGeminiGenerateContent({
  apiKey,
  messages,
  maxTokens,
  temperature,
  topP,
  stream,
  timeoutMs,
  model = API_CONFIG.GEMINI_MODEL_FAST,
}: {
  apiKey: string;
  messages: AIMessage[];
  maxTokens: number;
  temperature?: number;
  topP?: number;
  stream: boolean;
  timeoutMs: number;
  model?: string;
}): Promise<Response> {
  const endpoint = stream ? "streamGenerateContent?alt=sse" : "generateContent";
  const url = `${API_CONFIG.GEMINI_API_BASE_URL}/models/${model}:${endpoint}`;

  const body = buildGeminiBody(messages, {
    temperature,
    topP,
    maxOutputTokens: maxTokens,
  });

  return fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
    },
    timeoutMs
  );
}

interface GeminiStreamChunk {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
}

export async function pipeGeminiStreamToController(
  response: Response,
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder
): Promise<void> {
  const reader = response.body?.getReader();

  if (!reader) {
    throw new Error(ERROR_MESSAGES.INVALID_AI_RESPONSE);
  }

  const decoder = new TextDecoder();
  let buffer = "";

  const processLine = (line: string) => {
    const trimmed = line.trim();

    if (!trimmed || !trimmed.startsWith("data: ")) {
      return;
    }

    const payload = trimmed.slice(6);
    if (payload === "[DONE]") return;

    try {
      const json = JSON.parse(payload) as GeminiStreamChunk;
      const parts = json?.candidates?.[0]?.content?.parts;
      if (!Array.isArray(parts)) return;

      for (const part of parts) {
        if (typeof part?.text === "string" && part.text) {
          controller.enqueue(encoder.encode(part.text));
        }
      }
    } catch {
      // Ignore malformed SSE chunks from the upstream provider.
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        processLine(line);
      }
    }

    if (buffer.trim()) {
      processLine(buffer);
    }
  } finally {
    reader.releaseLock();
  }
}

interface GeminiNonStreamResponse {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
}

export async function readGeminiTextResponse(response: Response): Promise<string> {
  const data = (await response.json()) as GeminiNonStreamResponse;
  const parts = data?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts)
    ? parts.map((p) => (typeof p?.text === "string" ? p.text : "")).join("")
    : "";
  const cleaned = stripMarkdownCodeFences(text);

  if (!cleaned) {
    throw new Error(ERROR_MESSAGES.INVALID_AI_RESPONSE);
  }

  return cleaned;
}

export function stripMarkdownCodeFences(text: string): string {
  return text
    .replace(/^```[\w]*\n/, "")
    .replace(/\n```$/, "")
    .trim();
}

export function createPlainTextStreamResponse(
  stream: ReadableStream<Uint8Array>
) {
  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
