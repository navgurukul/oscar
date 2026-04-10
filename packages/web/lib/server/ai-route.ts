import { NextResponse } from "next/server";
import { API_CONFIG, ERROR_MESSAGES } from "@/lib/constants";
import { validateUserInput, wrapUserInput } from "@/lib/prompts";

type GroqRole = "system" | "user" | "assistant";

export interface GroqMessage {
  role: GroqRole;
  content: string;
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

export function getGroqApiKey(): string {
  const apiKey = process.env.GROQ_API_KEY?.trim();

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

export async function fetchGroqChatCompletion({
  apiKey,
  messages,
  maxTokens,
  temperature,
  topP,
  stream,
  timeoutMs,
  model = API_CONFIG.GROQ_MODEL_FAST,
}: {
  apiKey: string;
  messages: GroqMessage[];
  maxTokens: number;
  temperature?: number;
  topP?: number;
  stream: boolean;
  timeoutMs: number;
  model?: string;
}): Promise<Response> {
  return fetchWithTimeout(
    API_CONFIG.GROQ_API_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        top_p: topP,
        max_tokens: maxTokens,
        stream,
      }),
    },
    timeoutMs
  );
}

export async function pipeGroqStreamToController(
  response: Response,
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder
): Promise<void> {
  const reader = response.body?.getReader();

  if (!reader) {
    throw new Error(ERROR_MESSAGES.INVALID_GROQ_RESPONSE);
  }

  const decoder = new TextDecoder();
  let buffer = "";

  const processLine = (line: string) => {
    const trimmed = line.trim();

    if (!trimmed || trimmed === "data: [DONE]" || !trimmed.startsWith("data: ")) {
      return;
    }

    try {
      const json = JSON.parse(trimmed.slice(6));
      const chunk = json?.choices?.[0]?.delta?.content;

      if (typeof chunk === "string" && chunk) {
        controller.enqueue(encoder.encode(chunk));
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

export async function readGroqTextResponse(response: Response): Promise<string> {
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data?.choices?.[0]?.message?.content;
  const cleaned = stripMarkdownCodeFences(
    typeof content === "string" ? content : ""
  );

  if (!cleaned) {
    throw new Error(ERROR_MESSAGES.INVALID_GROQ_RESPONSE);
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
