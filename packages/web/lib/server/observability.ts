// Server-side LLM telemetry → PostHog ($ai_generation events).
//
// Lives on the web side on purpose: desktop dictation/format/title all proxy
// through these same /api/ai/* routes (see ai-backend-consolidation), so
// instrumenting here captures AI telemetry for web AND desktop from one place.
// distinctId is the Supabase user id, so desktop calls attribute correctly.
//
// PRIVACY (metadata-only decision): this NEVER receives or emits transcripts,
// prompts, or completions — only token counts, char lengths, latency, model,
// route, and success/failure. Errors are reduced to a bounded set of stable
// codes (classifyAiError) so a raw message can never smuggle content. Do not add
// prompt/response bodies here without first switching PostHog to EU + privacy.
//
// SERVERLESS + LATENCY: on Amplify/Lambda the function can freeze right after the
// response, so we flush on every capture (flushAt: 1) AND await it. But the await
// is on the user's critical path (dictation paste, title, translate), so the
// client is built with no retries + a tight request timeout, and the flush is
// raced against FLUSH_TIMEOUT_MS — a slow/unreachable ingest endpoint can never
// add more than that to an AI response. Telemetry failures are swallowed.
//
// COVERAGE: the non-streaming Mercury routes are instrumented (title, translate,
// dictation-cleanup). The streaming routes (format, transform, format-email via
// startMercuryStream) are NOT yet — capturing their token usage means parsing
// the final SSE usage frame and flushing after the response body closes, which
// is unreliable on Lambda. That's a focused follow-up, deliberately out of this
// first cut so the streaming/serverless-flush path isn't risked here.

import { PostHog } from "posthog-node";
import { MERCURY_MODEL } from "./mercury";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
// Server-side INGESTION host (not the dashboard/ui host). Kept distinct from the
// client's NEXT_PUBLIC_POSTHOG_UI_HOST so the documented .env value for one can't
// silently break the other. US region default.
const POSTHOG_INGEST_HOST =
  process.env.POSTHOG_HOST || "https://us.i.posthog.com";
const FLUSH_TIMEOUT_MS = 1500;

// Mercury is not in any vendor price table; cost is only computed when the team
// supplies its per-1M-token price via env. Unset → cost is OMITTED (never 0):
// Number("") is 0, not NaN, so we must guard on the raw string being present.
const rawInPrice = process.env.MERCURY_PRICE_PER_1M_INPUT_USD;
const rawOutPrice = process.env.MERCURY_PRICE_PER_1M_OUTPUT_USD;
const MERCURY_IN_PRICE = rawInPrice ? Number(rawInPrice) : NaN;
const MERCURY_OUT_PRICE = rawOutPrice ? Number(rawOutPrice) : NaN;

let client: PostHog | null = null;

function getClient(): PostHog | null {
  if (!POSTHOG_KEY) return null;
  if (!client) {
    client = new PostHog(POSTHOG_KEY, {
      host: POSTHOG_INGEST_HOST,
      flushAt: 1,
      flushInterval: 0,
      // Never let telemetry stack retry backoff onto the user's AI response.
      requestTimeout: FLUSH_TIMEOUT_MS,
      fetchRetryCount: 0,
    });
  }
  return client;
}

function mercuryCostUsd(
  inputTokens?: number,
  outputTokens?: number,
): number | undefined {
  if (!Number.isFinite(MERCURY_IN_PRICE) || !Number.isFinite(MERCURY_OUT_PRICE)) {
    return undefined;
  }
  const inCost = ((inputTokens ?? 0) / 1_000_000) * MERCURY_IN_PRICE;
  const outCost = ((outputTokens ?? 0) / 1_000_000) * MERCURY_OUT_PRICE;
  return inCost + outCost;
}

/**
 * Reduce any thrown AI error to a bounded, content-free code. Makes the
 * metadata-only guarantee structural rather than relying on Mercury happening to
 * keep its error messages clean. The full message stays in server logs only.
 */
export function classifyAiError(err: unknown): string {
  const e = err as { name?: string; message?: string } | undefined;
  const name = e?.name ?? "";
  const msg = e?.message ?? "";
  if (name === "AbortError" || /timeout|aborted/i.test(msg)) return "timeout";
  const status = msg.match(/Mercury API error (\d{3})/)?.[1];
  if (status) {
    if (status === "429") return "mercury_429";
    if (status.startsWith("5")) return "mercury_5xx";
    return "mercury_4xx";
  }
  if (/invalid.*response/i.test(msg)) return "invalid_response";
  if (/api key/i.test(msg)) return "missing_api_key";
  return "unknown";
}

export interface LLMTelemetry {
  userId: string;
  route: string;
  provider: "mercury" | "gemini";
  model?: string;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  inputChars?: number;
  outputChars?: number;
  isError?: boolean;
  /** Raw caught error — reduced to a bounded code internally, never sent as-is. */
  error?: unknown;
  /** Gemini supplies cost directly; Mercury derives it from env price. */
  costUsd?: number;
}

/**
 * Emit one `$ai_generation` event. Safe to await on a response path: it never
 * throws and is bounded to ~FLUSH_TIMEOUT_MS even if ingestion is unreachable.
 * Call it AFTER the model response, passing only metadata.
 */
export async function captureLLM(t: LLMTelemetry): Promise<void> {
  const ph = getClient();
  if (!ph) return;

  const model = t.model ?? (t.provider === "mercury" ? MERCURY_MODEL : "gemini-2.5-flash");
  const costUsd =
    t.costUsd ??
    (t.provider === "mercury"
      ? mercuryCostUsd(t.inputTokens, t.outputTokens)
      : undefined);
  const errorKind = t.error !== undefined ? classifyAiError(t.error) : undefined;

  try {
    ph.capture({
      distinctId: t.userId,
      event: "$ai_generation",
      properties: {
        $ai_model: model,
        $ai_provider: t.provider,
        $ai_latency: t.latencyMs / 1000,
        $ai_is_error: t.isError ?? false,
        ...(t.inputTokens !== undefined ? { $ai_input_tokens: t.inputTokens } : {}),
        ...(t.outputTokens !== undefined ? { $ai_output_tokens: t.outputTokens } : {}),
        ...(costUsd !== undefined ? { $ai_total_cost_usd: costUsd } : {}),
        // Custom, content-free dimensions for slicing in PostHog.
        oscar_route: t.route,
        ...(t.inputChars !== undefined ? { oscar_input_chars: t.inputChars } : {}),
        ...(t.outputChars !== undefined ? { oscar_output_chars: t.outputChars } : {}),
        ...(errorKind ? { oscar_error_kind: errorKind } : {}),
      },
    });
    // Bound the await: a stalled ingest endpoint can't delay the AI response.
    const flushed = ph.flush().catch(() => {});
    await Promise.race([
      flushed,
      new Promise<void>((resolve) => setTimeout(resolve, FLUSH_TIMEOUT_MS)),
    ]);
  } catch {
    // Telemetry must never break an AI response.
  }
}
