// AI formatting to structure the transcribed text - AudioPen style
// This function formats raw transcribed text into clean, structured notes

export async function formatWithAI(rawText: string): Promise<string> {
  try {
    // Try Gemini API first, fallback to AudioPen-style formatting
    const formatted = await formatWithOpenAI(rawText)
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
  const isList = /first|second|third|then|next|also|additionally|finally/i.test(cleaned)
  const hasQuestions = /\?/g.test(cleaned)
  const hasActionItems = /need to|should|must|will|going to|plan to/i.test(cleaned)

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
    } else if (/need to|should|must|will|going to|plan to|action|task|todo/i.test(lower)) {
      actionItems.push(sentence.replace(/^(I|we|they|you)\s+/i, ''))
    } else if (/discuss|talk|review|decide|decided|agreed/i.test(lower)) {
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
  const transitionWords = ['however', 'but', 'also', 'additionally', 'furthermore', 'meanwhile', 'next', 'then', 'now']
  const lower2 = sentence2.toLowerCase()
  return transitionWords.some(word => lower2.startsWith(word))
}

// Rule-based formatting (placeholder - replace with actual AI)
async function formatTextWithRules(text: string): Promise<string> {
  // Detect if it's a meeting or general notes
  const isMeeting = /meeting|discuss|agenda|action|follow-up/i.test(text)
  
  if (isMeeting) {
    return formatMeetingNotes(text)
  } else {
    return formatGeneralNotes(text)
  }
}

function formatMeetingNotes(text: string): string {
  let formatted = 'Meeting Notes Summary\n\n'
  
  // Extract key discussion points
  const discussionKeywords = ['discuss', 'talk about', 'review', 'decide', 'plan']
  const hasDiscussion = discussionKeywords.some(keyword => text.toLowerCase().includes(keyword))
  
  if (hasDiscussion) {
    formatted += 'Key Discussion Points:\n'
    // Simple extraction - in production, use AI to identify actual points
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20)
    sentences.slice(0, 3).forEach(sentence => {
      formatted += `• ${sentence.trim()}\n`
    })
    formatted += '\n'
  }
  
  // Extract action items
  const actionKeywords = ['need to', 'should', 'must', 'action', 'task', 'todo']
  const actionSentences = text.split(/[.!?]+/).filter(s => 
    actionKeywords.some(keyword => s.toLowerCase().includes(keyword))
  )
  
  if (actionSentences.length > 0) {
    formatted += 'Action Items:\n'
    actionSentences.slice(0, 5).forEach(sentence => {
      formatted += `• ${sentence.trim()}\n`
    })
    formatted += '\n'
  }
  
  // Next steps
  const nextStepsKeywords = ['next', 'follow up', 'later', 'tomorrow', 'next week']
  const nextStepsSentences = text.split(/[.!?]+/).filter(s =>
    nextStepsKeywords.some(keyword => s.toLowerCase().includes(keyword))
  )
  
  if (nextStepsSentences.length > 0) {
    formatted += 'Next Steps:\n'
    formatted += `${nextStepsSentences[0].trim()}\n\n`
  }
  
  // Important notes
  const importantKeywords = ['important', 'remember', 'note', 'critical']
  const importantSentences = text.split(/[.!?]+/).filter(s =>
    importantKeywords.some(keyword => s.toLowerCase().includes(keyword))
  )
  
  if (importantSentences.length > 0) {
    formatted += 'Important:\n'
    formatted += `${importantSentences[0].trim()}\n`
  }
  
  return formatted || text
}

function formatGeneralNotes(text: string): string {
  // For general notes, add basic structure
  let formatted = 'Notes\n\n'
  
  // Split into paragraphs if there are natural breaks
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0)
  
  if (paragraphs.length > 1) {
    paragraphs.forEach((para, index) => {
      formatted += `${para.trim()}\n\n`
    })
  } else {
    // Single paragraph - add bullet points for long sentences
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10)
    if (sentences.length > 3) {
      sentences.forEach(sentence => {
        formatted += `• ${sentence.trim()}\n`
      })
    } else {
      formatted = text
    }
  }
  
  return formatted
}

function formatBasic(text: string): string {
  // Very basic formatting fallback
  return text
    .split(/[.!?]+/)
    .filter(s => s.trim().length > 0)
    .map(s => `• ${s.trim()}`)
    .join('\n')
}

// Gemini API integration - SHORTENED PROMPT
export async function formatWithOpenAI(rawText: string, apiKey?: string): Promise<string> {
  const GEMINI_API_KEY = "AIzaSyDSWKJJyFjqkc65OSUiPIs8nvBcqMOFu-g"
  
  // Retry function with exponential backoff
  const retryWithBackoff = async (attempt: number = 0): Promise<string> => {
    const maxRetries = 2
    const baseDelay = 1000 // 1 second
    
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Format this voice transcript into clean notes:

- Fix grammar, punctuation, remove filler words (um, uh, like)
- For meetings: use sections (Key Points, Action Items, Questions, Next Steps)
- For lists: use bullet points
- For general notes: natural paragraphs (3-4 sentences each)
- Keep dates, names, numbers exact
- Return ONLY formatted text

Transcript:
${rawText}`
                  }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.3,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 2048,
            },
          }),
        }
      )
      
      // Handle rate limiting (429) - immediately fallback, no retry
      if (response.status === 429) {
        // Silently fallback to AudioPen formatting
        throw new Error('RATE_LIMIT')
      }
      
      if (!response.ok) {
        const errorText = await response.text()
        
        // If it's a client error (4xx) that's not rate limiting, don't retry
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          console.warn(`Gemini API client error (${response.status}), using fallback`)
          throw new Error(`API_ERROR_${response.status}`)
        }
        
        // For server errors (5xx), retry
        if (response.status >= 500 && attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt)
          console.log(`Server error, retrying after ${delay}ms (attempt ${attempt + 1}/${maxRetries})`)
          await new Promise(resolve => setTimeout(resolve, delay))
          return retryWithBackoff(attempt + 1)
        }
        
        throw new Error(`Gemini API request failed: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        const formattedText = data.candidates[0].content.parts[0].text
        return formattedText
      } else {
        throw new Error('Invalid response format from Gemini API')
      }
    } catch (error: any) {
      // If rate limited or max retries reached, use fallback immediately
      if (error.message === 'RATE_LIMIT' || attempt >= maxRetries) {
        throw error
      }
      
      // Retry on network errors or server errors
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt)
        console.log(`Retrying after ${delay}ms (attempt ${attempt + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, delay))
        return retryWithBackoff(attempt + 1)
      }
      
      throw error
    }
  }
  
  try {
    return await retryWithBackoff()
  } catch (error: any) {
    // Silently fallback to AudioPen-style formatting
    // No need to log errors for rate limits - fallback works perfectly
    if (error.message !== 'RATE_LIMIT') {
      console.warn('Gemini API unavailable, using fallback formatting')
    }
    return formatAudioPenStyle(rawText)
  }
}