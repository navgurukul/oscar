import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type Mode =
  | "transcribe_cleanup"
  | "cleanup"
  | "summary"
  | "bullets"
  | "email"
  | "meeting_general"
  | "meeting_standup"
  | "meeting_1on1"
  | "meeting_brainstorm"
  | "meeting_custom";

interface AIProcessRequest {
  text: string;
  mode: Mode;
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
  "meeting_general",
  "meeting_standup",
  "meeting_1on1",
  "meeting_brainstorm",
  "meeting_custom",
]);

function buildPrompt(mode: Mode, text: string): { system: string; user: string } {
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
      case "meeting_general":
        return (
          "You are a meeting notes assistant. The transcript may be in Hinglish (Hindi words " +
          "in Roman script mixed with English), understand both and produce notes in clear English.\n\n" +
          "Analyze the following meeting transcript and produce structured meeting notes with these sections:\n" +
          "## Key Discussion Points\n" +
          "## Decisions Made\n" +
          "## Action Items\n" +
          "(include owner if mentioned and deadline if mentioned)\n" +
          "## Follow-ups\n\n" +
          "Output only the structured notes in markdown format:\n\n" +
          text
        );
      case "meeting_standup":
        return (
          "You are a standup meeting notes assistant. The transcript may be in Hinglish (Hindi words " +
          "in Roman script mixed with English), understand both and produce notes in clear English.\n\n" +
          "Analyze the following standup transcript and produce structured notes with these sections:\n" +
          "## What Was Done (Yesterday/Recently)\n" +
          "## What's Being Worked On (Today/Next)\n" +
          "## Blockers & Risks\n\n" +
          "If multiple people spoke, organize by person. Output only the structured notes in markdown:\n\n" +
          text
        );
      case "meeting_1on1":
        return (
          "You are a 1:1 meeting notes assistant. The transcript may be in Hinglish (Hindi words " +
          "in Roman script mixed with English), understand both and produce notes in clear English.\n\n" +
          "Analyze the following 1:1 meeting transcript and produce structured notes with these sections:\n" +
          "## Discussion Points\n" +
          "## Feedback & Recognition\n" +
          "## Action Items\n" +
          "(include owner and deadline if mentioned)\n" +
          "## Follow-ups for Next Meeting\n\n" +
          "Output only the structured notes in markdown format:\n\n" +
          text
        );
      case "meeting_brainstorm":
        return (
          "You are a brainstorming session notes assistant. The transcript may be in Hinglish (Hindi words " +
          "in Roman script mixed with English), understand both and produce notes in clear English.\n\n" +
          "Analyze the following brainstorm transcript and produce structured notes with these sections:\n" +
          "## Ideas Generated\n" +
          "(list each idea with a brief description)\n" +
          "## Key Themes\n" +
          "## Top Ideas (Ranked by Discussion Energy)\n" +
          "## Next Steps\n\n" +
          "Output only the structured notes in markdown format:\n\n" +
          text
        );
      case "meeting_custom":
        return (
          "You are a meeting notes assistant. The transcript may be in Hinglish (Hindi words " +
          "in Roman script mixed with English), understand both and produce notes in clear English.\n\n" +
          "Analyze the following meeting transcript and produce structured meeting notes following " +
          "the instructions included in the text. Output only the structured notes in markdown format:\n\n" +
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

    const { text, mode }: AIProcessRequest = await req.json();
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

    const { system, user: prompt } = buildPrompt(mode, text);

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
