import { supabase } from "../supabase";

export type DesktopAIMode =
  | "transcribe_cleanup"
  | "cleanup"
  | "summary"
  | "bullets"
  | "email"
  | "meeting_general"
  | "meeting_standup"
  | "meeting_1on1"
  | "meeting_brainstorm"
  | "meeting_custom"
  | "meeting_reduce_chunk"
  | "meeting_reduce_merge";

interface AIProcessResponse {
  text?: string;
  error?: string;
}

async function extractInvokeError(error: unknown): Promise<string> {
  const fallback =
    error instanceof Error ? error.message : "AI request failed.";
  const context = (error as { context?: unknown } | null)?.context;

  if (context instanceof Response) {
    try {
      const contentType = context.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const body = (await context.json()) as { error?: string; details?: string };
        return body.error || body.details || fallback;
      }

      const text = await context.text();
      return text.trim() || fallback;
    } catch {
      return fallback;
    }
  }

  if (typeof context === "string" && context.trim()) {
    return context.trim();
  }

  return fallback;
}

export const aiService = {
  async processText(text: string, mode: DesktopAIMode): Promise<string> {
    if (!text.trim()) {
      throw new Error("No text provided for AI processing.");
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("AI features require a valid OSCAR sign-in.");
    }

    const { data, error } = await supabase.functions.invoke<AIProcessResponse>(
      "ai-process",
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: { text, mode },
      },
    );

    if (error) {
      throw new Error(await extractInvokeError(error));
    }

    const processedText = data?.text?.trim();
    if (!processedText) {
      throw new Error(data?.error || "AI returned an empty response.");
    }

    return processedText;
  },
};
