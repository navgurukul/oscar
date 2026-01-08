import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Server missing DEEPSEEK_API_KEY' },
      { status: 500 }
    )
  }

  let body: { text?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const text = (body.text || '').trim()
  if (!text) {
    return NextResponse.json(
      { error: 'text is required' },
      { status: 400 }
    )
  }

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content:
              'You generate short, descriptive titles. Keep original language. Plain text, no quotes. Prefer 4–10 words. Title Case if English; natural casing for Hindi/Hinglish.',
          },
          {
            role: 'user',
            content:
              `Create a concise title (max ~60 chars) for this content. Return ONLY the title.\n\nContent:\n${text}`,
          },
        ],
        temperature: 0.3,
        top_p: 0.9,
        max_tokens: 64,
        stream: false,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { error: 'Deepseek API error', details: errorText, status: response.status },
        { status: response.status }
      )
    }

    const data = await response.json()
    const content = data?.choices?.[0]?.message?.content?.trim() || ''
    if (!content) {
      return NextResponse.json(
        { error: 'Invalid Deepseek response' },
        { status: 502 }
      )
    }

    // Strip potential markdown code fences
    const title = content.replace(/^```[\w]*\n/, '').replace(/\n```$/, '').trim()
    return NextResponse.json({ title })
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Deepseek request failed', details: err?.message || String(err) },
      { status: 500 }
    )
  }
}