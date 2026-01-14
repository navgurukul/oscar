import { NextRequest, NextResponse } from 'next/server'
import { API_CONFIG, ERROR_MESSAGES } from '@/lib/constants'
import { SYSTEM_PROMPTS, USER_PROMPTS } from '@/lib/prompts'

export async function POST(req: NextRequest) {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: ERROR_MESSAGES.SERVER_MISSING_API_KEY },
      { status: 500 }
    )
  }

  let body: { text?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: ERROR_MESSAGES.INVALID_JSON_BODY },
      { status: 400 }
    )
  }

  const text = (body.text || '').trim()
  if (!text) {
    return NextResponse.json(
      { error: ERROR_MESSAGES.TEXT_REQUIRED },
      { status: 400 }
    )
  }

  try {
    const response = await fetch(API_CONFIG.DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: API_CONFIG.DEEPSEEK_MODEL,
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPTS.TITLE,
          },
          {
            role: 'user',
            content: `${USER_PROMPTS.TITLE_TEMPLATE}${text}`,
          },
        ],
        temperature: API_CONFIG.TITLE_TEMPERATURE,
        top_p: API_CONFIG.TITLE_TOP_P,
        max_tokens: API_CONFIG.TITLE_MAX_TOKENS,
        stream: false,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { error: ERROR_MESSAGES.DEEPSEEK_API_ERROR, details: errorText, status: response.status },
        { status: response.status }
      )
    }

    const data = await response.json()
    const content = data?.choices?.[0]?.message?.content?.trim() || ''
    if (!content) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.INVALID_DEEPSEEK_RESPONSE },
        { status: 502 }
      )
    }

    // Strip potential markdown code fences
    const title = content.replace(/^```[\w]*\n/, '').replace(/\n```$/, '').trim()
    return NextResponse.json({ title })
  } catch (err: any) {
    return NextResponse.json(
      { error: ERROR_MESSAGES.DEEPSEEK_REQUEST_FAILED, details: err?.message || String(err) },
      { status: 500 }
    )
  }
}