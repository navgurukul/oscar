import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type Mode =
  | "transcribe_cleanup"
  | "cleanup"
  | "summary"
  | "bullets"
  | "email";

type DictationCategory =
  | "default"
  | "ide"
  | "email"
  | "docs"
  | "chat"
  | "browser";

type DictationContextSource = "app" | "site" | "fallback";

interface DictationContextSnapshot {
  platform: string;
  appName: string;
  appId?: string | null;
  processName?: string | null;
  windowTitle?: string | null;
  siteHost?: string | null;
  siteTitle?: string | null;
  capturedAt: string;
}

interface DictationRoutingResult {
  category: DictationCategory;
  appKey: string;
  source: DictationContextSource;
  confidence: "high" | "medium" | "low";
  promptVersion: string;
}

interface AIProcessRequest {
  text: string;
  mode: Mode;
  context?: DictationContextSnapshot;
  routing?: DictationRoutingResult;
}

interface AIProcessResponse {
  text: string;
}

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const VALID_MODES = new Set<Mode>([
  "transcribe_cleanup",
  "cleanup",
  "summary",
  "bullets",
  "email",
]);

const VALID_CATEGORIES = new Set<DictationCategory>([
  "default",
  "ide",
  "email",
  "docs",
  "chat",
  "browser",
]);

function sanitizeOneLine(value?: string | null): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function getRoutingCategory(
  routing?: DictationRoutingResult,
): DictationCategory {
  if (routing && VALID_CATEGORIES.has(routing.category)) {
    return routing.category;
  }

  return "default";
}

function buildContextSummary(
  context?: DictationContextSnapshot,
  routing?: DictationRoutingResult,
): string {
  if (!context && !routing) {
    return "No app context provided.";
  }

  const lines = [
    `Platform: ${sanitizeOneLine(context?.platform) || "unknown"}`,
    `Active app: ${sanitizeOneLine(context?.appName) || "unknown"}`,
    `App ID: ${sanitizeOneLine(context?.appId) || "unknown"}`,
    `Process: ${sanitizeOneLine(context?.processName) || "unknown"}`,
    `Site host: ${sanitizeOneLine(context?.siteHost) || "unknown"}`,
    `Site title: ${sanitizeOneLine(context?.siteTitle) || "unknown"}`,
    `Detected category: ${sanitizeOneLine(routing?.category) || "default"}`,
    `App key: ${sanitizeOneLine(routing?.appKey) || "default"}`,
    `Context source: ${sanitizeOneLine(routing?.source) || "fallback"}`,
    `Prompt version: ${sanitizeOneLine(routing?.promptVersion) || "unknown"}`,
  ];

  return lines.join("\n");
}

function buildContextAwareCleanupPrompt(
  text: string,
  context?: DictationContextSnapshot,
  routing?: DictationRoutingResult,
): { system: string; user: string } {
  const category = getRoutingCategory(routing);
  const system =
    "You are a precise dictation formatter. Output only cleaned text with no preamble, no explanation, and no markdown fences. " +
    "Do not answer questions. Do not add facts. Do not invent missing details. Preserve URLs, file paths, code symbols, ticket IDs, CLI flags, names, and technical terms exactly when they appear. " +
    "Remove filler words, fix grammar, capitalization, and punctuation, and make the text immediately usable in the active app. " +
    "The transcript may contain Hinglish (Hindi words written in Roman script mixed with English). Understand both languages, but keep the user's original language unless cleanup requires a light correction.";

  const categoryInstruction = (() => {
    switch (category) {
      case "ide":
        return "IDE mode: keep output terse and task-like. Preserve code tokens, errors, commands, filenames, and stack traces. If the user clearly dictated multiple steps or requirements, use compact bullets.";
      case "email":
        return "Email mode: produce polished professional prose. Keep requests and action items explicit. Do not invent a salutation or sign-off unless the user dictated one.";
      case "docs":
        return "Docs mode: produce polished prose. When the transcript implies sections, ordered points, or bullets, format them clearly.";
      case "chat":
        return "Chat mode: keep output compact, conversational, and send-ready. Short utterances should stay short.";
      case "browser":
        return "Browser mode: use minimal cleanup. Preserve search-query or form-fill intent. Short utterances should stay short and should not be expanded into full prose.";
      default:
        return "Default mode: clean the transcript faithfully without changing tone or structure more than needed.";
    }
  })();

  const user = [
    "Clean this dictated text for the detected app context.",
    categoryInstruction,
    "",
    "Context:",
    buildContextSummary(context, routing),
    "",
    "Transcript:",
    text,
  ].join("\n");

  return { system, user };
}

function buildPrompt(
  mode: Mode,
  text: string,
  context?: DictationContextSnapshot,
  routing?: DictationRoutingResult,
): { system: string; user: string } {
  if (mode === "transcribe_cleanup") {
    return buildContextAwareCleanupPrompt(text, context, routing);
  }

  const system =
    "You are a precise transcript assistant. Follow instructions exactly. " +
    "Output only the requested content with no preamble, no explanations, no meta-commentary. " +
    "The transcript may contain Hinglish (Hindi words written in Roman script mixed with English). " +
    "Understand both languages and always produce the output in clear English.";

  const user = (() => {
    switch (mode) {
      case "transcribe_cleanup":
        return (
          "Fix any transcription errors, grammar, punctuation, and remove filler words " +
          "(um, uh, like, you know) in the text below. Preserve the original meaning " +
          "and wording as much as possible. Output only the corrected text:\n\n" +
          text
        );
      case "cleanup":
        return (
          "Clean up the following text, fix grammar, remove filler words, and improve " +
          "readability. Keep the meaning intact. Output only the cleaned text:\n\n" +
          text
        );
      case "summary":
        return (
          "Write a 3-5 sentence summary of the following text. Output only the summary:\n\n" +
          text
        );
      case "bullets":
        return (
          "Extract the key points from the following text as a concise bullet list. " +
          "Output only the bullets:\n\n" +
          text
        );
      case "email":
        return (
          "Rewrite the following text as a clear, professional, ready-to-send email. " +
          "Output only the email body:\n\n" +
          text
        );
      default:
        return text;
    }
  })();

  return { system, user };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Missing bearer token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser(accessToken);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { text, mode, context, routing }: AIProcessRequest = await req.json();
    if (!text || typeof text !== "string" || !text.trim()) {
      return new Response(JSON.stringify({ error: "Missing or empty 'text' field." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!mode) {
      return new Response(JSON.stringify({ error: "Missing 'mode' field." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!VALID_MODES.has(mode)) {
      return new Response(JSON.stringify({ error: "Unsupported AI processing mode." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const groqApiKey = Deno.env.get("GROQ_API_KEY");
    if (!groqApiKey) {
      return new Response(JSON.stringify({ error: "GROQ_API_KEY is not configured on the server." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { system, user: prompt } = buildPrompt(mode, text, context, routing);

    const upstream = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        max_tokens: 2048,
        temperature: 0.3,
        stream: false,
      }),
    });

    if (!upstream.ok) {
      const errBody = await upstream.text();
      return new Response(
        JSON.stringify({ error: `Groq API error ${upstream.status}: ${errBody}` }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const data = await upstream.json();
    const output = data?.choices?.[0]?.message?.content?.trim();

    if (!output) {
      return new Response(JSON.stringify({ error: "Empty response from AI service." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ text: output } satisfies AIProcessResponse), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[ai-process] unhandled error:", err);
    return new Response(JSON.stringify({ error: `Internal error: ${(err as Error).message}` }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
