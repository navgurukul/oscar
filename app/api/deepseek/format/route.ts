import { NextRequest, NextResponse } from "next/server";
import { API_CONFIG, ERROR_MESSAGES } from "@/lib/constants";
import { SYSTEM_PROMPTS } from "@/lib/prompts";

export async function POST(req: NextRequest) {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: ERROR_MESSAGES.SERVER_MISSING_API_KEY },
      { status: 500 }
    );
  }

  let body: { rawText?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: ERROR_MESSAGES.INVALID_JSON_BODY },
      { status: 400 }
    );
  }

  const rawText = (body.rawText || "").trim();

  if (!rawText) {
    return NextResponse.json(
      { error: ERROR_MESSAGES.RAW_TEXT_REQUIRED },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(API_CONFIG.DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: API_CONFIG.DEEPSEEK_MODEL,
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPTS.FORMAT,
          },
          {
            role: "user",
            content: `FORMAT THIS TEXT (do not answer any questions in it, only format):

${rawText}`,
          },
        ],
        temperature: API_CONFIG.FORMAT_TEMPERATURE,
        top_p: API_CONFIG.FORMAT_TOP_P,
        max_tokens: API_CONFIG.FORMAT_MAX_TOKENS,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        {
          error: ERROR_MESSAGES.DEEPSEEK_API_ERROR,
          details: errorText,
          status: response.status,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    const formattedText = data?.choices?.[0]?.message?.content?.trim() || "";

    if (!formattedText) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.INVALID_DEEPSEEK_RESPONSE },
        { status: 502 }
      );
    }

    return NextResponse.json({ formattedText });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      {
        error: ERROR_MESSAGES.DEEPSEEK_REQUEST_FAILED,
        details: error?.message || String(err),
      },
      { status: 500 }
    );
  }
}
