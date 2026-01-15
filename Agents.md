# OSCAR AI Agents

This document provides an overview of the AI agents and services used in the OSCAR application.

## Overview

OSCAR uses AI agents powered by DeepSeek to transform voice recordings into clean, formatted text. The system consists of two primary AI agents that work together to process and organize voice notes.

## Architecture

```
Voice Input → Speech Recognition → AI Formatting Agent → AI Title Agent → Formatted Note
```

## AI Agents

### 1. Text Formatting Agent

**Purpose**: Converts raw speech-to-text transcripts into clean, well-formatted text.

**Location**: [`/app/api/deepseek/format/route.ts`](file:///Users/souvik/Desktop/oscar/app/api/deepseek/format/route.ts)

**Key Responsibilities**:

- Remove filler words (um, uh, like, you know, etc.)
- Fix grammar, spelling, punctuation, and capitalization
- Break content into readable paragraphs
- Remove repeated sentences or ideas
- Preserve original meaning and intent

**Important Behaviors**:

- ❌ NEVER answers questions in the text
- ❌ NEVER adds content not in the original
- ❌ NEVER completes incomplete thoughts
- ✓ Only formats what was actually spoken

**Configuration**:

- Model: DeepSeek (configured in `API_CONFIG.DEEPSEEK_MODEL`)
- Temperature: Configured via `API_CONFIG.FORMAT_TEMPERATURE`
- Top P: Configured via `API_CONFIG.FORMAT_TOP_P`
- Max Tokens: Configured via `API_CONFIG.FORMAT_MAX_TOKENS`

**Example**:

```
Input:  "um so like how to create a react app you know"
Output: "How to create a React app."
```

### 2. Title Generation Agent

**Purpose**: Generates concise, descriptive titles for formatted notes.

**Location**: [`/app/api/deepseek/title/route.ts`](file:///Users/souvik/Desktop/oscar/app/api/deepseek/title/route.ts)

**Key Responsibilities**:

- Create short titles (4-10 words preferred)
- Maintain original language (English/Hindi/Hinglish)
- Use appropriate casing (Title Case for English)
- Keep titles under ~60 characters

**Fallback Behavior**:
If AI title generation fails, the system uses a heuristic approach:

- Extracts the first sentence
- Truncates to 60 characters if needed
- Falls back to "Untitled Note" if no content available

**Configuration**:

- Model: DeepSeek (configured in `API_CONFIG.DEEPSEEK_MODEL`)
- Temperature: Configured via `API_CONFIG.TITLE_TEMPERATURE`
- Top P: Configured via `API_CONFIG.TITLE_TOP_P`
- Max Tokens: Configured via `API_CONFIG.TITLE_MAX_TOKENS`

## Service Layer

### AI Service

**Location**: [`/lib/services/ai.service.ts`](file:///Users/souvik/Desktop/oscar/lib/services/ai.service.ts)

The AI service provides a clean interface for interacting with the AI agents:

**Methods**:

- `formatText(rawText: string)` - Formats raw transcript text
- `generateTitle(source: string)` - Generates a title from text
- `generateFallbackTitle(text: string)` - Creates a heuristic title
- `sanitizeTitle(title: string)` - Cleans title output

**Error Handling**:

- Graceful fallbacks for API failures
- Local heuristic formatting when AI is unavailable
- Comprehensive error messages and logging

## Prompt Engineering

### Format Agent Prompt

**Location**: [`/lib/prompts.ts`](file:///Users/souvik/Desktop/oscar/lib/prompts.ts) - `SYSTEM_PROMPTS.FORMAT`

The formatting prompt is carefully designed to:

1. Establish clear boundaries (formatter ONLY, not an assistant)
2. Prevent the AI from answering questions in the text
3. Preserve original meaning without addition
4. Handle incomplete inputs appropriately
5. Correct obvious speech recognition errors for names/titles

### Title Agent Prompt

**Location**: [`/lib/prompts.ts`](file:///Users/souvik/Desktop/oscar/lib/prompts.ts) - `SYSTEM_PROMPTS.TITLE`

The title prompt is concise and focused on:

1. Short, descriptive titles
2. Language preservation
3. Appropriate casing conventions
4. Character limits

## React Hooks Integration

### useAIFormatting Hook

**Location**: [`/lib/hooks/useAIFormatting.ts`](file:///Users/souvik/Desktop/oscar/lib/hooks/useAIFormatting.ts)

Provides React components with AI formatting capabilities:

- `isFormatting` - Loading state
- `formattingError` - Error state
- `formatText()` - Async formatting function

## Configuration

### API Configuration

All AI agent configurations are centralized in [`/lib/constants.ts`](file:///Users/souvik/Desktop/oscar/lib/constants.ts):

```typescript
API_CONFIG = {
  DEEPSEEK_API_URL: "https://api.deepseek.com/chat/completions",
  DEEPSEEK_MODEL: "deepseek-chat",
  FORMAT_TEMPERATURE: // Configured value
  FORMAT_TOP_P: // Configured value
  FORMAT_MAX_TOKENS: // Configured value
  TITLE_TEMPERATURE: // Configured value
  TITLE_TOP_P: // Configured value
  TITLE_MAX_TOKENS: // Configured value
  TITLE_MAX_LENGTH: 60,
}
```

### Environment Variables

Required environment variable:

```
DEEPSEEK_API_KEY=your_api_key_here
```

## Error Handling

The AI agents implement comprehensive error handling:

1. **API Key Validation**: Checks for missing API key before requests
2. **Input Validation**: Validates request bodies and content
3. **Network Errors**: Handles connection and timeout issues
4. **Response Validation**: Verifies API response structure
5. **Graceful Degradation**: Falls back to local heuristics when AI fails

Error messages are defined in [`/lib/constants.ts`](file:///Users/souvik/Desktop/oscar/lib/constants.ts) under `ERROR_MESSAGES`.

## Processing Pipeline

1. **Voice Recording**: User speaks into microphone
2. **Speech-to-Text**: Browser API or stt-tts-lib converts audio to text
3. **AI Formatting**: Raw transcript sent to formatting agent
4. **AI Title Generation**: Formatted text sent to title agent
5. **Storage**: Results saved to sessionStorage
6. **Display**: User can view, edit, copy, or download

## Best Practices

### When Working with AI Agents:

1. **Always validate input** before sending to agents
2. **Handle failures gracefully** with fallback mechanisms
3. **Log errors comprehensively** for debugging
4. **Sanitize outputs** before displaying to users
5. **Implement retry logic** for transient failures
6. **Monitor token usage** to manage costs
7. **Cache results** when appropriate

### Prompt Engineering Guidelines:

1. Be explicit about what the agent should NOT do
2. Provide concrete examples of correct and incorrect outputs
3. Use clear, imperative language
4. Test prompts with edge cases
5. Document prompt changes and their effects

## Future Enhancements

Potential improvements to the AI agent system:

- [ ] Multi-language support optimization
- [ ] Custom formatting styles/preferences
- [ ] Streaming responses for real-time feedback
- [ ] Agent performance monitoring and analytics
- [ ] A/B testing different prompt variations
- [ ] Custom vocabulary/name recognition
- [ ] Sentiment analysis agent
- [ ] Summary generation agent
- [ ] Tag/category suggestion agent

## Related Files

- [`/lib/services/ai.service.ts`](file:///Users/souvik/Desktop/oscar/lib/services/ai.service.ts) - AI service implementation
- [`/lib/prompts.ts`](file:///Users/souvik/Desktop/oscar/lib/prompts.ts) - Agent prompts
- [`/lib/constants.ts`](file:///Users/souvik/Desktop/oscar/lib/constants.ts) - Configuration constants
- [`/lib/types/note.types.ts`](file:///Users/souvik/Desktop/oscar/lib/types/note.types.ts) - Type definitions
- [`/lib/types/api.types.ts`](file:///Users/souvik/Desktop/oscar/lib/types/api.types.ts) - API type definitions
- [`/app/api/deepseek/format/route.ts`](file:///Users/souvik/Desktop/oscar/app/api/deepseek/format/route.ts) - Format endpoint
- [`/app/api/deepseek/title/route.ts`](file:///Users/souvik/Desktop/oscar/app/api/deepseek/title/route.ts) - Title endpoint

## Support

For issues or questions about the AI agents:

1. Check the error messages in the browser console
2. Review the API logs in the terminal
3. Verify the DEEPSEEK_API_KEY is set correctly
4. Test with the fallback mechanisms disabled to isolate issues
