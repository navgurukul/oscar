import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Server missing DEEPSEEK_API_KEY' },
      { status: 500 }
    )
  }

  let body: { rawText?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const rawText = (body.rawText || '').trim()
  if (!rawText) {
    return NextResponse.json(
      { error: 'rawText is required' },
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
            content: `You are an expert transcription formatter. Your job is to transform raw speech-to-text into polished, professional notes.

CRITICAL RULES:
1. PRESERVE ALL CONTENT - Never remove or skip any part of the transcript, even if it seems like rambling at the start
2. Keep the complete meaning - every sentence must be included in some form
3. Only remove filler words (um, uh, like, you know, basically, actually) - NOT complete sentences
4. Fix grammar errors and improve sentence structure
5. Add proper punctuation (periods, commas, question marks)
6. Capitalize properly (names, start of sentences, acronyms)
7. Break into clear paragraphs (3-4 sentences each)
8. Preserve the original language (Hindi/Hinglish/English as spoken)
9. For meeting notes: organize into sections (Discussion Points, Action Items, Questions)
10. For lists or steps: use bullet points with • symbol
11. Make it natural and readable - like professional notes

IMPORTANT: Transform the ENTIRE transcript from start to finish. Don't skip the beginning or ending.

EXAMPLE:
Raw: "um so like I'm testing this okay so the main point is we need to uh finish the project by Friday"
Formatted: "I'm testing this. The main point is we need to finish the project by Friday."
❌ WRONG: "The main point is we need to finish the project by Friday." (deleted the testing part)
✅ CORRECT: "I'm testing this. The main point is we need to finish the project by Friday." (kept everything)


OUTPUT FORMAT:
- Return ONLY the formatted text
- No explanations, no quotes, no metadata
- Clean, professional, ready-to-use notes
- Natural flow and easy to read
- Include ALL content from the original transcript`
            },
          {
            role: 'user',
            content: `Format this transcribed speech into clean, professional notes. Keep meaning and language intact.\n\nTRANSCRIPTION:\n${rawText}\n\nFORMATTED NOTES:`,
          },
        ],
        temperature: 0.3,
        top_p: 0.95,
        max_tokens: 4096,
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
    const formattedText = data?.choices?.[0]?.message?.content?.trim() || ''
    if (!formattedText) {
      return NextResponse.json(
        { error: 'Invalid Deepseek response' },
        { status: 502 }
      )
    }

    return NextResponse.json({ formattedText })
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Deepseek request failed', details: err?.message || String(err) },
      { status: 500 }
    )
  }
}