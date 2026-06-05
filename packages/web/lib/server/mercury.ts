// Mercury 2 (Inception Labs) client for the web AI routes. Mercury is the
// generation backend for all Scribble + stream features; Gemini is now reserved
// for Minutes (meeting-enhance) and embeddings only.
//
// The API is OpenAI-compatible (`/chat/completions`), so this mirrors the Gemini
// helpers in ai-route.ts (`generateText` / `startGeminiStream`) one-for-one —
// same param shape and the same `{ pipe }` streaming handle — so route handlers
// swap backends with a near-trivial diff.
//
// Mercury-specific quirks handled here, learned from the desktop ai-process edge
// function (packages/desktop/supabase/functions/ai-process/index.ts):
//   - Temperature < 0.5 is rejected (auto-clamped to 0.75 with a warning), so we
//     clamp up to MERCURY_MIN_TEMPERATURE. Callers keep their existing low/zero
//     temps; output is marginally less deterministic than Gemini at 0.0.
//   - Mercury spends reasoning tokens from the same budget before emitting
//     output. On tight caps (e.g. the 64-token title budget) that starves the
//     completion to empty, so we default reasoning_effort to "minimal".

import { ERROR_MESSAGES } from "@/lib/constants";
import { type AIMessage, stripMarkdownCodeFences } from "./ai-route";

const MERCURY_API_BASE_URL = "https://api.inceptionlabs.ai/v1";
export const MERCURY_MODEL = "mercury-2";
const MERCURY_MIN_TEMPERATURE = 0.5;
const RETRY_MAX = 2;
const RETRY_BASE_MS = 1000;

export type MercuryReasoningEffort = "minimal" | "low" | "medium" | "high";

export interface MercuryCallParams {
  apiKey: string;
  messages: AIMessage[];
  maxTokens: number;
  temperature?: number;
  topP?: number;
  model?: string;
  reasoningEffort?: MercuryReasoningEffort;
  timeoutMs: number;
}

export function getMercuryApiKey(): string {
  const apiKey = process.env.MERCURY_API_KEY?.trim();
  if (!apiKey) throw new Error(ERROR_MESSAGES.SERVER_MISSING_API_KEY);
  return apiKey;
}

function clampTemperature(temperature?: number): number {
  if (typeof temperature !== "number" || Number.isNaN(temperature)) {
    return MERCURY_MIN_TEMPERATURE;
  }
  return Math.max(temperature, MERCURY_MIN_TEMPERATURE);
}

// 408/429/5xx are transient; 4xx auth/validation errors are not worth retrying.
function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function backoff(attempt: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, RETRY_BASE_MS * 2 ** attempt));
}

function buildRequestBody(params: MercuryCallParams, stream: boolean): string {
  return JSON.stringify({
    model: params.model ?? MERCURY_MODEL,
    messages: params.messages.map((m) => ({ role: m.role, content: m.content })),
    max_tokens: params.maxTokens,
    temperature: clampTemperature(params.temperature),
    ...(typeof params.topP === "number" ? { top_p: params.topP } : {}),
    reasoning_effort: params.reasoningEffort ?? "minimal",
    ...(stream ? { stream: true } : {}),
  });
}

async function fetchMercury(params: MercuryCallParams, stream: boolean): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), params.timeoutMs);
  try {
    return await fetch(`${MERCURY_API_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
      },
      body: buildRequestBody(params, stream),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Non-streaming completion. Retries transient failures with exponential backoff,
 * strips stray markdown fences, and throws on an empty completion — matching the
 * Gemini `generateText` contract the routes already rely on.
 */
export async function mercuryGenerateText(params: MercuryCallParams): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= RETRY_MAX; attempt++) {
    let response: Response;
    try {
      response = await fetchMercury(params, false);
    } catch (err) {
      // Network error or timeout (AbortError). Retry while budget remains.
      lastError = err as Error;
      if (attempt < RETRY_MAX) {
        await backoff(attempt);
        continue;
      }
      break;
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      lastError = new Error(`Mercury API error ${response.status}: ${body}`);
      if (isRetryableStatus(response.status) && attempt < RETRY_MAX) {
        await backoff(attempt);
        continue;
      }
      throw lastError;
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    const text = typeof content === "string" ? content.trim() : "";
    if (!text) throw new Error(ERROR_MESSAGES.INVALID_AI_RESPONSE);
    return stripMarkdownCodeFences(text);
  }

  throw lastError ?? new Error(ERROR_MESSAGES.AI_REQUEST_FAILED);
}

export type PendingMercuryStream = {
  pipe: (
    controller: ReadableStreamDefaultController<Uint8Array>,
    encoder: TextEncoder
  ) => Promise<void>;
};

/**
 * Streaming completion. The request is fired immediately (like
 * `startGeminiStream`) so callers can launch several chunk streams in parallel
 * and pipe them sequentially. `pipe` parses the OpenAI-style SSE frames and
 * enqueues each `delta.content` token onto the controller.
 */
export function startMercuryStream(params: MercuryCallParams): PendingMercuryStream {
  const responsePromise = fetchMercury(params, true);

  return {
    async pipe(controller, encoder) {
      const response = await responsePromise;
      if (!response.ok || !response.body) {
        const body = response.body ? await response.text().catch(() => "") : "";
        throw new Error(`Mercury API error ${response.status}: ${body}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // SSE frames are newline-delimited; process complete lines and keep
          // any trailing partial line in the buffer for the next chunk.
          let newlineIndex: number;
          while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, newlineIndex).trim();
            buffer = buffer.slice(newlineIndex + 1);
            if (!line || !line.startsWith("data:")) continue;

            const payload = line.slice(5).trim();
            if (payload === "[DONE]") return;

            try {
              const json = JSON.parse(payload);
              const delta = json?.choices?.[0]?.delta?.content;
              if (typeof delta === "string" && delta) {
                controller.enqueue(encoder.encode(delta));
              }
            } catch {
              // Ignore a malformed or partial SSE frame; the next read may
              // complete it (though we already buffer on newline boundaries).
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    },
  };
}
