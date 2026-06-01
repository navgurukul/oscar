import { NextRequest, NextResponse } from "next/server";
import { applyCors, authenticateRequest, corsPreflightResponse, parseJsonBody } from "@/lib/server/ai-route";
import { ContextCompiler } from "@/lib/server/orgContext";
import {
  applyRateLimit,
  getClientIdentifier,
} from "@/lib/middleware/rate-limit";
import { RATE_LIMITS } from "@/lib/constants";

export function OPTIONS() {
  return corsPreflightResponse();
}

export async function POST(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  const rateLimitResult = await applyRateLimit(
    getClientIdentifier(user.id, req),
    "ai-context",
    RATE_LIMITS.AI_CONTEXT
  );
  if (rateLimitResult) return applyCors(rateLimitResult);

  const bodyResult = await parseJsonBody<{ rawTranscript?: unknown; profile?: unknown }>(req);
  if (!bodyResult.success) return applyCors(bodyResult.response);

  const rawTranscript = typeof bodyResult.data.rawTranscript === "string" ? bodyResult.data.rawTranscript.trim() : "";
  const profileInput = typeof bodyResult.data.profile === "string" ? bodyResult.data.profile.trim() : "scribble";

  if (!["stream", "scribble", "minutes"].includes(profileInput)) {
    return applyCors(
      NextResponse.json({ error: "Invalid profile type" }, { status: 400 })
    );
  }

  const profile = profileInput as "stream" | "scribble" | "minutes";

  try {
    const compiled = await ContextCompiler.compile({
      userId: user.id,
      rawTranscript,
      profile,
    });
    return applyCors(NextResponse.json(compiled));
  } catch (err: unknown) {
    const error = err as Error;
    return applyCors(
      NextResponse.json(
        { error: "Context compilation failed", details: error?.message || String(err) },
        { status: 500 }
      )
    );
  }
}
