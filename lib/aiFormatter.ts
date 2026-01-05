// AI formatting to structure the transcribed text - AudioPen style
// This function formats raw transcribed text into clean, structured notes

export async function formatWithAI(rawText: string): Promise<string> {
  try {
    // Try Deepseek API first, fallback to AudioPen-style formatting
    const formatted = await formatWithDeepseek(rawText)
    return formatted
  } catch (error) {
    console.error('Error in AI formatting:', error)
    // Fallback to AudioPen-style formatting
    try {
      return await formatAudioPenStyle(rawText)
    } catch (fallbackError) {
      return formatBasic(rawText)
    }
  }
}

// Deepseek API integration - BETTER PROMPT, NO LIMITS
export async function formatWithDeepseek(rawText: string): Promise<string> {
  const DEEPSEEK_API_KEY = "sk-4a59b3ee436944f5b3d1ef4e49b7ddc4" // Apni API key yahan dalein
  
  try {
    const response = await fetch(
      'https://api.deepseek.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            {
              role: "system",
              content: `You are an expert transcription formatter. Your job is to transform raw speech-to-text into polished, professional notes.

FORMATTING RULES:
1. Remove ALL filler words (um, uh, like, you know, basically, actually, etc.)
2. Fix grammar errors and sentence structure
3. Add proper punctuation (periods, commas, question marks)
4. Capitalize properly (names, start of sentences, acronyms)
5. Break into clear paragraphs (3-4 sentences each)
6. Preserve the original language (Hindi/Hinglish/English as spoken)
7. Keep the exact meaning - don't add or remove information
8. For meeting notes: organize into sections (Discussion Points, Action Items, Questions)
9. For lists or steps: use bullet points with • symbol
10. Make it natural and readable - like professional notes

OUTPUT FORMAT:
- Return ONLY the formatted text
- No explanations, no quotes, no metadata
- Clean, professional, ready-to-use notes
- Natural flow and easy to read`
            },
            {
              role: "user",
              content: `Format this transcribed speech into clean, professional notes. Remove filler words, fix grammar, add punctuation, and make it readable. Keep the original language and meaning intact.

TRANSCRIPTION:
${rawText}

FORMATTED NOTES:`
            }
          ],
          temperature: 0.3,
          top_p: 0.95,
          max_tokens: 4096, // Paid API - koi limit nahi
          stream: false
        }),
      }
    )
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Deepseek API error: ${response.status}`, errorText)
      throw new Error(`Deepseek API request failed: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (data.choices && data.choices[0] && data.choices[0].message) {
      const formattedText = data.choices[0].message.content.trim()
      
      // Remove any markdown code blocks if present
      const cleaned = formattedText
        .replace(/^```[\w]*\n/, '')
        .replace(/\n```$/, '')
        .trim()
      
      return cleaned
    } else {
      throw new Error('Invalid response format from Deepseek API')
    }
  } catch (error: any) {
    console.warn('Deepseek API error, using fallback formatting:', error.message)
    throw error
  }
}

// AudioPen-style formatting - clean and natural
async function formatAudioPenStyle(text: string): Promise<string> {
  if (!text || !text.trim()) {
    return text
  }

  // Clean up the text first
  let cleaned = text
    .replace(/\s+/g, ' ') // Multiple spaces to single space
    .replace(/\s+([,.!?])/g, '$1') // Remove space before punctuation
    .replace(/([,.!?])([^\s])/g, '$1 $2') // Add space after punctuation
    .trim()

  // Split into sentences
  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0)

  if (sentences.length === 0) {
    return cleaned
  }

  // Detect content type
  const isMeeting = /meeting|discuss|agenda|action|follow-up|team|project/i.test(cleaned)
  const isList = /first|second|third|then|next|also|additionally|finally|pehle|phir|baad|uske/i.test(cleaned)
  const hasQuestions = /\?/g.test(cleaned)
  const hasActionItems = /need to|should|must|will|going to|plan to|karna|hoga|chahiye/i.test(cleaned)

  // Format based on content type
  if (isMeeting && (hasActionItems || isList)) {
    return formatMeetingStyle(sentences)
  } else if (isList || sentences.length > 5) {
    return formatListStyle(sentences)
  } else {
    return formatNaturalStyle(sentences)
  }
}

// Natural paragraph style - AudioPen default
function formatNaturalStyle(sentences: string[]): string {
  let result = ''
  let currentParagraph: string[] = []
  
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i]
    currentParagraph.push(sentence)
    
    // Start new paragraph after 3-4 sentences or on topic change
    const shouldBreak = 
      currentParagraph.length >= 4 ||
      (i < sentences.length - 1 && isTopicChange(sentence, sentences[i + 1]))
    
    if (shouldBreak || i === sentences.length - 1) {
      result += currentParagraph.join(' ') + '\n\n'
      currentParagraph = []
    }
  }
  
  return result.trim()
}

// List style for structured content
function formatListStyle(sentences: string[]): string {
  const result = sentences
    .map(s => {
      // Remove list markers if already present
      const cleaned = s.replace(/^[-•*]\s*/, '').trim()
      return `• ${cleaned}`
    })
    .join('\n')
  
  return result
}

// Meeting notes style
function formatMeetingStyle(sentences: string[]): string {
  let result = ''
  const actionItems: string[] = []
  const discussion: string[] = []
  const questions: string[] = []
  const other: string[] = []

  sentences.forEach(sentence => {
    const lower = sentence.toLowerCase()
    if (/\?/.test(sentence)) {
      questions.push(sentence)
    } else if (/need to|should|must|will|going to|plan to|action|task|todo|karna|hoga|chahiye/i.test(lower)) {
      actionItems.push(sentence.replace(/^(I|we|they|you|main|hum)\s+/i, ''))
    } else if (/discuss|talk|review|decide|decided|agreed|baat|charcha/i.test(lower)) {
      discussion.push(sentence)
    } else {
      other.push(sentence)
    }
  })

  if (discussion.length > 0) {
    result += 'Key Discussion Points:\n\n'
    discussion.forEach(point => {
      result += `• ${point}\n`
    })
    result += '\n'
  }

  if (actionItems.length > 0) {
    result += 'Action Items:\n\n'
    actionItems.forEach(item => {
      result += `• ${item}\n`
    })
    result += '\n'
  }

  if (questions.length > 0) {
    result += 'Questions:\n\n'
    questions.forEach(q => {
      result += `• ${q}\n`
    })
    result += '\n'
  }

  if (other.length > 0) {
    result += 'Notes:\n\n'
    other.forEach(note => {
      result += `${note}\n\n`
    })
  }

  return result.trim() || sentences.join(' ')
}

// Check if there's a topic change between sentences
function isTopicChange(sentence1: string, sentence2: string): boolean {
  const transitionWords = ['however', 'but', 'also', 'additionally', 'furthermore', 'meanwhile', 'next', 'then', 'now', 'lekin', 'par', 'aur', 'phir']
  const lower2 = sentence2.toLowerCase()
  return transitionWords.some(word => lower2.startsWith(word))
}

function formatBasic(text: string): string {
  // Very basic formatting fallback
  return text
    .split(/[.!?]+/)
    .filter(s => s.trim().length > 0)
    .map(s => `• ${s.trim()}`)
    .join('\n')
}