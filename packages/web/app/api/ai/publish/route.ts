import { NextRequest, NextResponse } from "next/server";
import { API_CONFIG, ERROR_MESSAGES, RATE_LIMITS } from "@/lib/constants";
import { sanitizeUserInput, wrapUserInput } from "@/lib/prompts";
import {
  applyRateLimit,
  getClientIdentifier,
} from "@/lib/middleware/rate-limit";
import {
  applyCors,
  authenticateRequest,
  corsPreflightResponse,
  generateText,
  getGeminiApiKey,
  parseJsonBody,
} from "@/lib/server/ai-route";
import { buildOrgContext } from "@/lib/server/orgContext";
import { usageService } from "@/lib/services/usage.service";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";

const REQUEST_TIMEOUT_MS = 20000;
const MAX_INPUT_CHARS = 12_000;

type Tone = "neutral" | "concise" | "executive" | "casual" | "technical";
const TONES: Record<Tone, string> = {
  neutral: "Polished, even tone. Faithful to the speaker. Default to short paragraphs.",
  concise: "Tight, scannable, short paragraphs and bullet lists where appropriate.",
  executive: "Tone for senior stakeholders: leading TL;DR, decisions surfaced first, crisp language.",
  casual: "Warm, first-person voice. Conversational, but still organised.",
  technical: "Engineer-facing rewrite. Surface concrete artefacts, code-fenced snippets where helpful.",
};

const PUBLISH_SYSTEM = `You are a senior writer publishing an internal post for an organisation.
You receive a raw spoken note and (optionally) reference documents. Your job is to produce a polished long-form draft in **Markdown**.

Rules:
- Stay faithful to the speaker. Do not invent facts.
- If reference documents are provided, draw on them and cite by document title (e.g. "(see *Onboarding Playbook*)").
- Structure: short TL;DR (1–2 sentences) → headings or sections → an optional next-step list.
- Use Markdown formatting (##, **bold**, bullet lists). No HTML.
- Do NOT add a preamble like "Here is the polished draft". Start directly with the content.
- Do NOT fabricate quotes or attributions.`;

export function OPTIONS() {
  return corsPreflightResponse();
}

export async function POST(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  let apiKey: string;
  try {
    apiKey = getGeminiApiKey();
  } catch {
    return applyCors(
      NextResponse.json({ error: ERROR_MESSAGES.SERVER_MISSING_API_KEY }, { status: 500 })
    );
  }

  const clientId = getClientIdentifier(user.id, req);
  const rateLimitResult = await applyRateLimit(clientId, "ai-publish", RATE_LIMITS.AI_TRANSFORM);
  if (rateLimitResult) return applyCors(rateLimitResult);

  const bodyResult = await parseJsonBody<{
    scribbleId?: unknown;
    text?: unknown;
    title?: unknown;
    documentIds?: unknown;
    tone?: unknown;
  }>(req);
  if (!bodyResult.success) return applyCors(bodyResult.response);

  const scribbleId = typeof bodyResult.data.scribbleId === "string" ? bodyResult.data.scribbleId : "";
  if (!scribbleId) {
    return applyCors(NextResponse.json({ error: "scribbleId required" }, { status: 400 }));
  }

  const documentIds = Array.isArray(bodyResult.data.documentIds)
    ? bodyResult.data.documentIds.filter((id): id is string => typeof id === "string")
    : undefined;

  const tone = (typeof bodyResult.data.tone === "string" && (bodyResult.data.tone as Tone) in TONES
    ? (bodyResult.data.tone as Tone)
    : "neutral") as Tone;

  const limit = await usageService.canUserRecord(user.id);
  if (!limit.allowed) {
    return applyCors(
      NextResponse.json(
        { error: "Monthly publish/recording limit reached", upgradeRequired: true },
        { status: 402 }
      )
    );
  }

  const admin = getSupabaseAdmin();
  const { data: scribble, error: fetchErr } = await admin
    .from("scribbles")
    .select("id, user_id, title, edited_text, original_formatted_text, raw_text, shared_with_org, organization_id")
    .eq("id", scribbleId)
    .maybeSingle();

  if (fetchErr) {
    return applyCors(NextResponse.json({ error: fetchErr.message }, { status: 500 }));
  }
  if (!scribble || scribble.user_id !== user.id) {
    return applyCors(NextResponse.json({ error: "Not found" }, { status: 404 }));
  }
  if (!scribble.shared_with_org) {
    return applyCors(
      NextResponse.json(
        { error: "Share this scribble with the workspace before publishing." },
        { status: 400 }
      )
    );
  }

  const overrideText = typeof bodyResult.data.text === "string" ? bodyResult.data.text : "";
  const overrideTitle = typeof bodyResult.data.title === "string" ? bodyResult.data.title : "";
  const bodySource =
    overrideText ||
    scribble.edited_text ||
    scribble.original_formatted_text ||
    scribble.raw_text ||
    "";
  if (!bodySource.trim()) {
    return applyCors(NextResponse.json({ error: "Scribble has no body to publish" }, { status: 400 }));
  }
  const truncated = bodySource.length > MAX_INPUT_CHARS ? bodySource.slice(0, MAX_INPUT_CHARS) : bodySource;
  const safeBody = wrapUserInput(truncated, "transcript");
  const safeTitle = sanitizeUserInput((overrideTitle || scribble.title || "Untitled").slice(0, 200));

  const orgCtx = await buildOrgContext(user.id, {
    documentIds,
    docLimit: documentIds ? documentIds.length : 5,
    docTokenBudget: 4000,
    queryText: `${safeTitle}\n\n${bodySource}`,
  });
  const contextBlock = orgCtx.promptBlock
    ? `\n\n---\n\n${orgCtx.promptBlock}`
    : "";

  try {
    const markdown = await generateText({
      apiKey,
      messages: [
        {
          role: "system",
          content: `${PUBLISH_SYSTEM}\n\nTone preset: ${tone} — ${TONES[tone]}${contextBlock}`,
        },
        {
          role: "user",
          content: [
            `Publish this internal scribble for ${orgCtx.organizationName ?? "the workspace"}.`,
            `Title hint: "${safeTitle}"`,
            "Body (raw):",
            safeBody,
          ].join("\n\n"),
        },
      ],
      temperature: API_CONFIG.FORMAT_TEMPERATURE,
      maxTokens: 2400,
      timeoutMs: REQUEST_TIMEOUT_MS,
    });

    await usageService.incrementRecordingUsage(user.id).catch((err) => {
      console.error("[publish] usage increment failed", err);
    });

    return applyCors(
      NextResponse.json({
        markdown,
        tone,
        context_cache_key: orgCtx.cacheKey,
        docs_used: orgCtx.docs.map((d) => ({ id: d.id, title: d.title })),
      })
    );
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
