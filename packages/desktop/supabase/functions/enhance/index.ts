import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

interface EnhanceRequest {
  text: string;
  tone: "none" | "professional" | "casual" | "friendly";
}

interface EnhanceResponse {
  enhanced: string;
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── Auth: verify JWT from Supabase Auth ───────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Parse body ────────────────────────────────────────────────────────────
    const { text, tone = "none" }: EnhanceRequest = await req.json();

    if (!text || typeof text !== "string" || text.trim() === "") {
      return new Response(JSON.stringify({ error: "Missing or empty 'text' field." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Build prompt ──────────────────────────────────────────────────────────
    const toneInstruction = {
      professional: "Rewrite the text in a professional, formal tone suitable for business communication.",
      casual:       "Rewrite the text in a relaxed, casual, conversational tone.",
      friendly:     "Rewrite the text in a warm, friendly, and approachable tone.",
      none:         "Clean up the text only — do not change the tone.",
    }[tone] ?? "Clean up the text only — do not change the tone.";

    const systemPrompt =
      `You are an expert transcription editor with deep knowledge of technology, software development, and general domain-specific terminology. ` +
      `Your job is to clean up speech-to-text output that may contain recognition errors, filler words, and awkward phrasing. ` +
      `Follow these instructions precisely:\n\n` +

      `1. FILLER WORD REMOVAL: Remove all filler words and verbal tics, including: uh, um, uh-huh, hmm, like (when used as a filler), you know, you know what I mean, I mean, sort of, kind of, basically, literally, actually (when used as a filler), right (when used as a filler), okay so, so yeah, anyway.\n\n` +

      `2. PHONETIC MISRECOGNITION CORRECTION: Speech-to-text engines frequently mishear words. Apply contextual reasoning to identify and fix these errors. Common patterns:\n` +
      `   - Technology/framework names (e.g. "wrecked" or "react" → "React", "Tori" or "tory" → "Tauri", "next yes" → "Next.js", "view" → "Vue", "rust" → "Rust", "cargo" → "Cargo", "sequel" → "SQL", "nosql" → "NoSQL", "docker" → "Docker", "kubernetes" or "cube" → "Kubernetes")\n` +
      `   - Company/product names (e.g. "get hub" → "GitHub", "bit bucket" → "Bitbucket", "open a eye" → "OpenAI", "deep seek" → "DeepSeek", "ver sell" → "Vercel", "rail way" → "Railway", "supa base" → "Supabase")\n` +
      `   - Technical terms (e.g. "a p i" → "API", "you eye" → "UI", "you ex" → "UX", "see ess es" → "CSS", "jay ess" → "JS", "type script" → "TypeScript")\n` +
      `   - General phonetic swaps where the misheard word makes no grammatical sense in context\n\n` +

      `3. CONTEXTUAL WORD SENSE: Read the full sentence and paragraph before correcting individual words. (e.g. "we need to right the function" → "we need to write the function")\n\n` +

      `4. DOMAIN-SPECIFIC INTELLIGENCE: Preserve and correctly capitalise known proper nouns, brand names, acronyms, and technical jargon.\n\n` +

      `5. MINIMAL INTERVENTION: Make only the corrections necessary. Do not paraphrase, summarise, or change the speaker's intended meaning.\n\n` +

      `6. GRAMMAR AND FLOW: Fix subject-verb agreement, tense consistency, punctuation, and sentence boundaries.\n\n` +

      `7. TONE: ${toneInstruction}\n\n` +

      `Return ONLY the corrected text. No explanations, no bullet points, no commentary, no surrounding quotes.`;

    // ── Call Groq ─────────────────────────────────────────────────────────
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) {
      return new Response(JSON.stringify({ error: "GROQ_API_KEY is not configured on the server." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: text },
        ],
        max_tokens: 1024,
        temperature: 0.3,
      }),
    });

    if (!upstream.ok) {
      const errBody = await upstream.text();
      return new Response(
        JSON.stringify({ error: `Groq API error ${upstream.status}: ${errBody}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await upstream.json();
    const enhanced: string = data?.choices?.[0]?.message?.content?.trim() ?? text;

    // ── Log usage ─────────────────────────────────────────────────────────────
    // Fire-and-forget: don't block the response on a DB write
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    serviceClient
      .from("usage_logs")
      .insert({
        user_id: user.id,
        input_chars: text.length,
        output_chars: enhanced.length,
        tone,
      })
      .then(({ error }) => {
        if (error) console.warn("[usage] insert failed:", error.message);
      });

    return new Response(JSON.stringify({ enhanced } satisfies EnhanceResponse), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[enhance] unhandled error:", err);
    return new Response(JSON.stringify({ error: `Internal error: ${(err as Error).message}` }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
