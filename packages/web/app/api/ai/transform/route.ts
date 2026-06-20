import { NextRequest, NextResponse } from "next/server";
import { API_CONFIG, ERROR_MESSAGES, RATE_LIMITS } from "@/lib/constants";
import { SYSTEM_PROMPTS, sanitizeUserInput } from "@/lib/prompts";
import {
  applyRateLimit,
  getClientIdentifier,
} from "@/lib/middleware/rate-limit";
import {
  applyCors,
  authenticateRequest,
  corsPreflightResponse,
  createPlainTextStreamResponse,
  enforceRecordingQuota,
  getOptionalTrimmedString,
  parseJsonBody,
  validateAndWrapInput,
} from "@/lib/server/ai-route";
import { getMercuryApiKey, startMercuryStream } from "@/lib/server/mercury";
import { buildOrgContext, joinSystemPrompt } from "@/lib/server/orgContext";

const REQUEST_TIMEOUT_MS = 12000;
const TRANSFORM_MODES = new Set(["summary", "bullets"]);

type TransformMode = "summary" | "bullets";

function getSystemPrompt(mode: TransformMode) {
  return mode === "summary"
    ? SYSTEM_PROMPTS.SUMMARY_TRANSFORM
    : SYSTEM_PROMPTS.BULLETS_TRANSFORM;
}

// Optional reshape modifiers, orthogonal to the structural mode (summary/
// bullets). They map to plain directive lines appended to the system prompt so
// the desktop Transform screen (TONE / LENGTH / AUDIENCE controls) can steer
// the rewrite without forking the prompt logic. All are optional — omitting
// them reproduces the original summary/bullets behaviour.
type Tone = "as_said" | "formal" | "casual" | "teammate";
const TONES: Record<Tone, string> = {
  as_said: "Keep the speaker's original tone and voice.",
  formal: "Make the tone more formal and professional.",
  casual: "Make the tone more casual and relaxed.",
  teammate: "Write it as a direct, collegial message to a teammate.",
};

type Length = "original" | "shorter" | "bullets" | "headline";
const LENGTHS: Record<Length, string> = {
  original: "Preserve roughly the original length.",
  shorter: "Make it noticeably shorter and tighter.",
  bullets: "Render it as a concise bulleted list.",
  headline: "Reduce it to a single headline sentence.",
};

type Audience = "team" | "customers" | "investors";
const AUDIENCES: Record<Audience, string> = {
  team: "Write for an internal team audience.",
  customers: "Write for customers — clear and jargon-free.",
  investors: "Write for investors — lead with outcomes and metrics.",
};

function pickDirective<T extends string>(
  value: unknown,
  map: Record<T, string>
): string | null {
  if (typeof value !== "string") return null;
  const key = value.trim() as T;
  return key in map ? map[key] : null;
}

export function OPTIONS() {
  return corsPreflightResponse();
}

export async function POST(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  const clientId = getClientIdentifier(user.id, req);
  const rateLimitResult = await applyRateLimit(clientId, "ai-transform", RATE_LIMITS.AI_TRANSFORM);
  if (rateLimitResult) return applyCors(rateLimitResult);

  let apiKey: string;
  try {
    apiKey = getMercuryApiKey();
  } catch {
    return applyCors(
      NextResponse.json({ error: ERROR_MESSAGES.SERVER_MISSING_API_KEY }, { status: 500 })
    );
  }

  const bodyResult = await parseJsonBody<{
    text?: unknown;
    mode?: unknown;
    title?: unknown;
    documentIds?: unknown;
    tone?: unknown;
    length?: unknown;
    audience?: unknown;
  }>(req);
  if (!bodyResult.success) return applyCors(bodyResult.response);

  const rawMode = typeof bodyResult.data.mode === "string" ? bodyResult.data.mode.trim() : "";
  if (!TRANSFORM_MODES.has(rawMode)) {
    return applyCors(NextResponse.json({ error: "Invalid transform mode." }, { status: 400 }));
  }
  const mode = rawMode as TransformMode;

  const inputResult = validateAndWrapInput(bodyResult.data.text, {
    requiredError: ERROR_MESSAGES.TEXT_REQUIRED,
    tagName: "content",
  });
  if (!inputResult.success) return applyCors(inputResult.response);

  // Block further AI spend once the org is over its free monthly quota.
  const quotaResponse = await enforceRecordingQuota(user.id);
  if (quotaResponse) return applyCors(quotaResponse);

  const sanitizedTitle = sanitizeUserInput(
    getOptionalTrimmedString(bodyResult.data.title) ?? ""
  );

  const documentIds = Array.isArray(bodyResult.data.documentIds)
    ? bodyResult.data.documentIds.filter((id): id is string => typeof id === "string")
    : undefined;

  // Optional reshape directives — only those provided are appended.
  const directives = [
    pickDirective<Tone>(bodyResult.data.tone, TONES),
    pickDirective<Length>(bodyResult.data.length, LENGTHS),
    pickDirective<Audience>(bodyResult.data.audience, AUDIENCES),
  ].filter((d): d is string => Boolean(d));
  const directiveBlock = directives.length
    ? `\n\nApply these reshape directives:\n${directives.map((d) => `- ${d}`).join("\n")}`
    : "";

  const orgCtx = await buildOrgContext(user.id, {
    documentIds,
    docLimit: 4,
    docTokenBudget: 2400,
    queryText: inputResult.text,
  });
  const orgPromptBlock = orgCtx.promptBlock;

  try {
    const baseSystem = `${getSystemPrompt(mode)}${directiveBlock}\nReturn plain text only. Do NOT wrap output in markdown code blocks or backticks.`;
    const systemPrompt = joinSystemPrompt(baseSystem, orgPromptBlock);
    const pending = startMercuryStream({
      apiKey,
      messages: [
        {
          role: "system",
          content: systemPrompt,
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
      timeoutMs: REQUEST_TIMEOUT_MS,
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          await pending.pipe(controller, encoder);
        } finally {
          controller.close();
        }
      },
    });

    return applyCors(createPlainTextStreamResponse(stream));
  } catch (err: unknown) {
    const error = err as Error;
    return applyCors(
      NextResponse.json(
        { error: ERROR_MESSAGES.AI_REQUEST_FAILED, details: error?.message || String(err) },
        { status: 500 }
      )
    );
  }
}
