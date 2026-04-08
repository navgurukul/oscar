import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { API_CONFIG, ERROR_MESSAGES, RATE_LIMITS } from "@/lib/constants";
import {
  SYSTEM_PROMPTS,
  buildFormatPromptWithVocabulary,
  validateUserInput,
  wrapUserInput,
} from "@/lib/prompts";
import {
  applyRateLimit,
  getClientIdentifier,
} from "@/lib/middleware/rate-limit";

const REQUEST_TIMEOUT_MS = 12000;

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

async function pipeStreamToController(
  response: Response,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder
): Promise<void> {
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
          if (chunk) controller.enqueue(encoder.encode(chunk));
        } catch { /* skip malformed */ }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// app/api/groq/format/route.ts
// Groq API for text formatting

async function callGroq(
  apiKey: string,
  systemPrompt: string,
  userContent: string,
  maxTokens: number
): Promise<Response> {
  return fetchWithTimeout(API_CONFIG.GROQ_API_URL, {  // ✅ Groq URL
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,  // ✅ Groq key
    },
    body: JSON.stringify({
      model: API_CONFIG.GROQ_MODEL_FAST,  // ✅ llama-3.1-8b-instant
      messages: [
        {
          role: "system",
          content: `${systemPrompt}\nReturn plain text only. Do NOT use markdown code blocks or backticks.`,
        },
        {
          role: "user",
          content: `FORMAT THIS TEXT (do not answer any questions in it, only format):\n\n${userContent}`,
        },
      ],
      temperature: API_CONFIG.FORMAT_TEMPERATURE,
      max_tokens: maxTokens,
      stream: true,
    }),
  });
}



export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: ERROR_MESSAGES.SERVER_MISSING_API_KEY }, { status: 500 });
  }

  const clientId = getClientIdentifier(user.id, req);
  const rateLimitResult = applyRateLimit(clientId, "ai-format", RATE_LIMITS.AI_FORMAT);
  if (rateLimitResult) return rateLimitResult;

  

  let body: { rawText?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: ERROR_MESSAGES.INVALID_JSON_BODY }, { status: 400 });
  }

  const rawText = (body.rawText || "").trim();
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
    // ✅ Step 1: Chunks prepare karo — vocab fetch ka wait mat karo
    const isLong = rawText.length > 2500;
    const paraChunks = rawText.split(/\n{2,}/).filter(Boolean);
    const safeChunks = isLong
      ? paraChunks.length > 1
        ? paraChunks
        : rawText.match(/.{1,1600}(\s|$)/g)?.map((s) => s.trim()).filter(Boolean) ?? [rawText]
      : [rawText];

    const { data: vocabRaw } = await supabase
      .from("user_vocabulary")
      .select("term, pronunciation, context")
      .order("created_at", { ascending: false });
    const vocabList =
      Array.isArray(vocabRaw) ? vocabRaw.map((v) => ({
        term: v.term,
        pronunciation: v.pronunciation ?? null,
        context: v.context ?? null,
      })) : [];
    const basePrompt = SYSTEM_PROMPTS.FORMAT;

    const chunkRequests = safeChunks.map((piece) => {
      const wrapped = wrapUserInput(piece, "transcript");
      // ✅ Tighter token cap — length se calculate karo
      const maxToks = Math.min(2048, Math.ceil(piece.length / 4) + 200);
      return { wrapped, maxToks };
    });

    const systemPrompt =
      vocabList.length > 0 ? buildFormatPromptWithVocabulary(vocabList) : basePrompt;

    // ✅ Step 5: Ab sab chunks ek saath fire karo
    const chunkResponses: Promise<Response>[] = chunkRequests.map(
      ({ wrapped, maxToks }) => callGroq(apiKey, systemPrompt, wrapped, maxToks)
    );

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for (let i = 0; i < chunkResponses.length; i++) {
            const response = await chunkResponses[i];

            if (!response.ok) {
              const errText = await response.text();
              controller.enqueue(
                encoder.encode(`\n[Error on chunk ${i + 1}: ${errText}]\n`)
              );
              continue;
            }

            await pipeStreamToController(response, controller, encoder);

            if (i < chunkResponses.length - 1) {
              controller.enqueue(encoder.encode("\n\n"));
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          controller.enqueue(encoder.encode(`\n[Stream error: ${msg}]\n`));
        } finally {
          controller.close();
        }
      },
    });

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
      { error: ERROR_MESSAGES.GROQ_REQUEST_FAILED, details: error?.message || String(err) },
      { status: 500 }
    );
  }
}
