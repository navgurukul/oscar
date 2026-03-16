# API Reference

<cite>
**Referenced Files in This Document**
- [route.ts](file://app/api/deepseek/format/route.ts)
- [route.ts](file://app/api/deepseek/title/route.ts)
- [route.ts](file://app/api/deepseek/translate/route.ts)
- [route.ts](file://app/api/deepseek/format-email/route.ts)
- [route.ts](file://app/api/razorpay/create-subscription/route.ts)
- [route.ts](file://app/api/razorpay/webhook/route.ts)
- [route.ts](file://app/api/usage/check/route.ts)
- [route.ts](file://app/api/usage/increment/route.ts)
- [route.ts](file://app/api/usage/stats/route.ts)
- [constants.ts](file://lib/constants.ts)
- [prompts.ts](file://lib/prompts.ts)
- [rate-limit.ts](file://lib/middleware/rate-limit.ts)
- [razorpay.service.ts](file://lib/services/razorpay.service.ts)
- [subscription.service.ts](file://lib/services/subscription.service.ts)
- [usage.service.ts](file://lib/services/usage.service.ts)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)
10. [Appendices](#appendices)

## Introduction
This document describes OSCAR’s REST API surface, covering public and internal endpoints used by the frontend and integrations. It focuses on:
- Authentication and authorization
- HTTP methods, URL patterns, request/response schemas
- Error handling, status codes, and rate limiting
- Security controls (API keys, input validation, prompt injection protections)
- Usage tracking and quotas
- Payment and subscription APIs powered by Razorpay
- Client implementation guidelines and best practices

## Project Structure
The API routes are located under app/api/<provider>/<operation>/route.ts. Supporting logic resides in lib/services, lib/middleware, and lib/constants.

```mermaid
graph TB
subgraph "API Routes"
A1["/api/deepseek/format"]
A2["/api/deepseek/title"]
A3["/api/deepseek/translate"]
A4["/api/deepseek/format-email"]
A5["/api/razorpay/create-subscription"]
A6["/api/razorpay/webhook"]
A7["/api/usage/check"]
A8["/api/usage/increment"]
A9["/api/usage/stats"]
end
subgraph "Services"
S1["usage.service.ts"]
S2["subscription.service.ts"]
S3["razorpay.service.ts"]
end
subgraph "Middleware"
M1["rate-limit.ts"]
end
subgraph "Shared"
C1["constants.ts"]
P1["prompts.ts"]
end
A1 --> S1
A2 --> S1
A3 --> S1
A4 --> S1
A7 --> S1
A8 --> S1
A9 --> S1
A5 --> S2
A6 --> S2
A5 --> S3
A6 --> S3
A1 --> M1
A2 --> M1
A3 --> M1
A4 --> M1
A5 --> M1
A6 --> M1
A1 --> C1
A2 --> C1
A3 --> C1
A4 --> C1
A1 --> P1
A2 --> P1
A3 --> P1
A4 --> P1
```

**Diagram sources**
- [route.ts](file://app/api/deepseek/format/route.ts#L1-L181)
- [route.ts](file://app/api/deepseek/title/route.ts#L1-L165)
- [route.ts](file://app/api/deepseek/translate/route.ts#L1-L171)
- [route.ts](file://app/api/deepseek/format-email/route.ts#L1-L167)
- [route.ts](file://app/api/razorpay/create-subscription/route.ts#L1-L125)
- [route.ts](file://app/api/razorpay/webhook/route.ts#L1-L300)
- [route.ts](file://app/api/usage/check/route.ts#L1-L66)
- [route.ts](file://app/api/usage/increment/route.ts#L1-L70)
- [route.ts](file://app/api/usage/stats/route.ts#L1-L65)
- [usage.service.ts](file://lib/services/usage.service.ts#L1-L222)
- [subscription.service.ts](file://lib/services/subscription.service.ts#L1-L280)
- [razorpay.service.ts](file://lib/services/razorpay.service.ts#L1-L175)
- [rate-limit.ts](file://lib/middleware/rate-limit.ts#L1-L264)
- [constants.ts](file://lib/constants.ts#L1-L314)
- [prompts.ts](file://lib/prompts.ts#L1-L458)

**Section sources**
- [route.ts](file://app/api/deepseek/format/route.ts#L1-L181)
- [route.ts](file://app/api/deepseek/title/route.ts#L1-L165)
- [route.ts](file://app/api/deepseek/translate/route.ts#L1-L171)
- [route.ts](file://app/api/deepseek/format-email/route.ts#L1-L167)
- [route.ts](file://app/api/razorpay/create-subscription/route.ts#L1-L125)
- [route.ts](file://app/api/razorpay/webhook/route.ts#L1-L300)
- [route.ts](file://app/api/usage/check/route.ts#L1-L66)
- [route.ts](file://app/api/usage/increment/route.ts#L1-L70)
- [route.ts](file://app/api/usage/stats/route.ts#L1-L65)
- [constants.ts](file://lib/constants.ts#L1-L314)

## Core Components
- Authentication: All protected endpoints require a valid Supabase session. Requests must include the Supabase auth cookie/session.
- Rate Limiting: Enforced per-user per-endpoint with sliding windows. Limits vary by endpoint category.
- Input Validation: Strict validation and sanitization to prevent prompt injection and enforce required fields.
- External Services: DeepSeek chat completions for AI tasks; Razorpay for payments and webhooks.

**Section sources**
- [route.ts](file://app/api/deepseek/format/route.ts#L39-L48)
- [route.ts](file://app/api/deepseek/title/route.ts#L39-L48)
- [route.ts](file://app/api/deepseek/translate/route.ts#L41-L50)
- [route.ts](file://app/api/deepseek/format-email/route.ts#L36-L45)
- [rate-limit.ts](file://lib/middleware/rate-limit.ts#L176-L192)
- [prompts.ts](file://lib/prompts.ts#L34-L85)

## Architecture Overview
High-level flow for AI endpoints:
- Client authenticates via Supabase.
- Server validates inputs and applies rate limits.
- Server builds a secure prompt and forwards to DeepSeek.
- Responses are parsed and returned to the client.

```mermaid
sequenceDiagram
participant C as "Client"
participant S as "Next.js Route"
participant RL as "Rate Limiter"
participant DB as "Supabase"
participant AI as "DeepSeek API"
C->>S : "POST /api/... (JSON)"
S->>DB : "getUser()"
DB-->>S : "User"
S->>RL : "applyRateLimit(userId, endpoint, config)"
RL-->>S : "Allowed or 429"
S->>S : "validateUserInput() + wrapUserInput()"
S->>AI : "Chat Completions"
AI-->>S : "Response"
S-->>C : "JSON result or error"
```

**Diagram sources**
- [route.ts](file://app/api/deepseek/format/route.ts#L39-L181)
- [route.ts](file://app/api/deepseek/title/route.ts#L39-L165)
- [route.ts](file://app/api/deepseek/translate/route.ts#L41-L171)
- [route.ts](file://app/api/deepseek/format-email/route.ts#L36-L167)
- [rate-limit.ts](file://lib/middleware/rate-limit.ts#L176-L192)
- [prompts.ts](file://lib/prompts.ts#L93-L96)

## Detailed Component Analysis

### AI Formatting API
- Method: POST
- URL: /api/deepseek/format
- Purpose: Transform raw transcripts into clean, formatted English text.
- Authentication: Required (Supabase session).
- Rate Limit: Category “ai-format”.
- Request JSON
  - rawText: string (required)
- Response JSON
  - formattedText: string
- Errors
  - 400: Missing/invalid JSON, missing rawText, input validation failure
  - 401: Unauthorized
  - 429: Rate limit exceeded
  - 500: Server missing API key, request failed
  - 502: Invalid AI response
- Security
  - Input validated and wrapped in delimiters.
  - Uses custom vocabulary from user profile to improve recognition.
  - AI model and parameters configured centrally.

```mermaid
sequenceDiagram
participant C as "Client"
participant R as "format/route.ts"
participant RL as "rate-limit.ts"
participant DB as "Supabase"
participant AI as "DeepSeek"
C->>R : "POST {rawText}"
R->>DB : "getUser()"
R->>RL : "applyRateLimit('ai-format')"
R->>R : "validateUserInput + wrapUserInput"
R->>AI : "Chat Completions"
AI-->>R : "choices[0].message.content"
R-->>C : "{formattedText}"
```

**Diagram sources**
- [route.ts](file://app/api/deepseek/format/route.ts#L39-L181)
- [rate-limit.ts](file://lib/middleware/rate-limit.ts#L176-L192)
- [prompts.ts](file://lib/prompts.ts#L93-L96)

**Section sources**
- [route.ts](file://app/api/deepseek/format/route.ts#L1-L181)
- [prompts.ts](file://lib/prompts.ts#L101-L216)
- [constants.ts](file://lib/constants.ts#L75-L98)
- [rate-limit.ts](file://lib/middleware/rate-limit.ts#L276-L298)

### Title Generation API
- Method: POST
- URL: /api/deepseek/title
- Purpose: Generate a concise title from content.
- Authentication: Required.
- Rate Limit: Category “ai-title”.
- Request JSON
  - text: string (required)
- Response JSON
  - title: string
- Errors
  - 400: Missing/invalid JSON, missing text, input validation failure
  - 401: Unauthorized
  - 429: Rate limit exceeded
  - 500: Server missing API key, request failed
  - 502: Invalid AI response

**Section sources**
- [route.ts](file://app/api/deepseek/title/route.ts#L1-L165)
- [prompts.ts](file://lib/prompts.ts#L221-L231)
- [constants.ts](file://lib/constants.ts#L93-L97)
- [rate-limit.ts](file://lib/middleware/rate-limit.ts#L284-L288)

### Translation API
- Method: POST
- URL: /api/deepseek/translate
- Purpose: Translate text to English or Hindi.
- Authentication: Required.
- Rate Limit: Category “ai-translate”.
- Request JSON
  - text: string (required)
  - targetLanguage: "en" | "hi" (default "en")
- Response JSON
  - translatedText: string
- Errors
  - 400: Missing/invalid JSON, missing text, invalid targetLanguage
  - 401: Unauthorized
  - 429: Rate limit exceeded
  - 500: Server missing API key, request failed
  - 502: Empty response from translation

**Section sources**
- [route.ts](file://app/api/deepseek/translate/route.ts#L1-L171)
- [prompts.ts](file://lib/prompts.ts#L236-L253)
- [rate-limit.ts](file://lib/middleware/rate-limit.ts#L294-L298)

### Email Formatting API
- Method: POST
- URL: /api/deepseek/format-email
- Purpose: Convert a note into a Gmail-ready email body; optionally reference a title.
- Authentication: Required.
- Rate Limit: Category “ai-format-email”.
- Request JSON
  - rawText: string (required)
  - title: string (optional)
- Response JSON
  - formattedText: string
- Errors
  - 400: Missing/invalid JSON, missing rawText, input validation failure
  - 401: Unauthorized
  - 429: Rate limit exceeded
  - 500: Server missing API key, request failed
  - 502: Invalid AI response

**Section sources**
- [route.ts](file://app/api/deepseek/format-email/route.ts#L1-L167)
- [prompts.ts](file://lib/prompts.ts#L259-L284)
- [rate-limit.ts](file://lib/middleware/rate-limit.ts#L289-L293)

### Usage APIs

#### Check Usage Limit
- Method: GET
- URL: /api/usage/check
- Purpose: Pre-flight check to determine if a user can record this month.
- Authentication: Required.
- Response JSON
  - canRecord: boolean
  - current: number
  - remaining: number | 0
  - limit: number | null
  - upgradeRequired: boolean (when limit reached)
- Errors
  - 401: Unauthorized
  - 402: Payment required (limit exceeded for free tier)
  - 500: Internal server error

**Section sources**
- [route.ts](file://app/api/usage/check/route.ts#L1-L66)
- [usage.service.ts](file://lib/services/usage.service.ts#L117-L137)
- [constants.ts](file://lib/constants.ts#L243-L247)

#### Increment Usage
- Method: POST
- URL: /api/usage/increment
- Purpose: Enforce monthly recording limit before incrementing usage.
- Authentication: Required.
- Response JSON
  - success: boolean
  - recordingsThisMonth: number
  - remaining: number
  - canRecord: boolean
- Errors
  - 401: Unauthorized
  - 402: Payment required (limit exceeded)
  - 500: Internal server error

**Section sources**
- [route.ts](file://app/api/usage/increment/route.ts#L1-L70)
- [usage.service.ts](file://lib/services/usage.service.ts#L71-L103)

#### Usage Stats
- Method: GET
- URL: /api/usage/stats
- Purpose: Retrieve subscription and usage statistics for the user.
- Authentication: Required.
- Response JSON
  - tier: "free" | "pro"
  - status: string
  - billingCycle: "monthly" | "yearly" | null
  - currentPeriodEnd: string | null
  - recordingsThisMonth: number
  - recordingsLimit: number | null
  - notesCount: number
  - notesLimit: number | null
  - isProUser: boolean
  - canRecord: boolean
  - canCreateNote: boolean
- Errors
  - 401: Unauthorized
  - 500: Internal server error

**Section sources**
- [route.ts](file://app/api/usage/stats/route.ts#L1-L65)
- [usage.service.ts](file://lib/services/usage.service.ts#L186-L221)

### Payment and Webhook APIs

#### Create Subscription
- Method: POST
- URL: /api/razorpay/create-subscription
- Purpose: Create a Razorpay subscription for the authenticated user.
- Authentication: Required.
- Request JSON
  - planType: "monthly" | "yearly" (required)
- Response JSON
  - subscriptionId: string
  - razorpayKeyId: string
- Errors
  - 400: Invalid plan type
  - 401: Unauthorized
  - 429: Rate limit exceeded
  - 500: Internal server error

**Section sources**
- [route.ts](file://app/api/razorpay/create-subscription/route.ts#L1-L125)
- [subscription.service.ts](file://lib/services/subscription.service.ts#L65-L123)
- [razorpay.service.ts](file://lib/services/razorpay.service.ts#L48-L94)
- [rate-limit.ts](file://lib/middleware/rate-limit.ts#L301-L305)

#### Razorpay Webhook
- Method: POST
- URL: /api/razorpay/webhook
- Purpose: Handle Razorpay webhook events for subscription lifecycle.
- Authentication: None (signature verified server-side).
- Headers
  - x-razorpay-signature: string (required)
- Request Body: Raw JSON payload from Razorpay.
- Response JSON
  - received: true
  - error?: string (on processing failure)
- Security
  - Validates webhook signature using HMAC-SHA256 with webhook secret.
  - Idempotency: Stores event by account_id_created_at to avoid duplicates.
  - Processes events: activated/authenticated, charged, cancelled, halted/pending, paused, resumed, completed/expired.
- Errors
  - 400: Missing/invalid signature
  - 500: Internal server error

```mermaid
sequenceDiagram
participant RP as "Razorpay"
participant W as "webhook/route.ts"
participant RL as "rate-limit.ts"
participant DB as "Supabase (admin)"
participant SVC as "subscription.service.ts"
RP->>W : "POST /api/razorpay/webhook (raw body + signature)"
W->>RL : "applyRateLimit('payment-webhook')"
W->>W : "verifyWebhookSignature()"
W->>DB : "check idempotency (webhook_events)"
W->>SVC : "updateFromRazorpaySubscription(...) or status change"
W-->>RP : "{received : true}"
```

**Diagram sources**
- [route.ts](file://app/api/razorpay/webhook/route.ts#L42-L178)
- [rate-limit.ts](file://lib/middleware/rate-limit.ts#L307-L312)
- [subscription.service.ts](file://lib/services/subscription.service.ts#L148-L232)

**Section sources**
- [route.ts](file://app/api/razorpay/webhook/route.ts#L1-L300)
- [razorpay.service.ts](file://lib/services/razorpay.service.ts#L149-L162)
- [subscription.service.ts](file://lib/services/subscription.service.ts#L148-L232)

## Dependency Analysis
- AI endpoints depend on:
  - Supabase for authentication
  - Rate limiter middleware
  - DeepSeek API via HTTPS
  - Prompts utilities for safety and customization
- Payment endpoints depend on:
  - Razorpay SDK and secrets
  - Supabase admin client for idempotent updates
- Usage endpoints depend on:
  - Supabase admin client for enforcing limits and counting notes

```mermaid
graph LR
F["format/route.ts"] --> RL["rate-limit.ts"]
T["title/route.ts"] --> RL
X["translate/route.ts"] --> RL
E["format-email/route.ts"] --> RL
CS["create-subscription/route.ts"] --> RS["razorpay.service.ts"]
WH["webhook/route.ts"] --> RS
CS --> SS["subscription.service.ts"]
WH --> SS
UC["usage/check/route.ts"] --> US["usage.service.ts"]
UI["usage/increment/route.ts"] --> US
US["usage/stats/route.ts"] --> SS
US --> SS2["subscription.service.ts"]
```

**Diagram sources**
- [route.ts](file://app/api/deepseek/format/route.ts#L1-L181)
- [route.ts](file://app/api/deepseek/title/route.ts#L1-L165)
- [route.ts](file://app/api/deepseek/translate/route.ts#L1-L171)
- [route.ts](file://app/api/deepseek/format-email/route.ts#L1-L167)
- [route.ts](file://app/api/razorpay/create-subscription/route.ts#L1-L125)
- [route.ts](file://app/api/razorpay/webhook/route.ts#L1-L300)
- [route.ts](file://app/api/usage/check/route.ts#L1-L66)
- [route.ts](file://app/api/usage/increment/route.ts#L1-L70)
- [route.ts](file://app/api/usage/stats/route.ts#L1-L65)
- [rate-limit.ts](file://lib/middleware/rate-limit.ts#L1-L264)
- [razorpay.service.ts](file://lib/services/razorpay.service.ts#L1-L175)
- [subscription.service.ts](file://lib/services/subscription.service.ts#L1-L280)
- [usage.service.ts](file://lib/services/usage.service.ts#L1-L222)

**Section sources**
- [constants.ts](file://lib/constants.ts#L75-L98)
- [prompts.ts](file://lib/prompts.ts#L1-L458)

## Performance Considerations
- Timeout handling: AI requests use AbortController with a 30-second timeout to avoid hanging requests.
- Rate limiting: Prevents abuse and protects external API costs; clients should honor Retry-After and back off.
- Caching: Not implemented at the API level; consider caching stable prompts or sanitized vocabulary per user session.
- Monitoring: Log rate limit hits, AI errors, and webhook processing outcomes. Track latency for AI calls.

**Section sources**
- [route.ts](file://app/api/deepseek/format/route.ts#L15-L37)
- [route.ts](file://app/api/deepseek/title/route.ts#L15-L37)
- [route.ts](file://app/api/deepseek/translate/route.ts#L12-L34)
- [route.ts](file://app/api/deepseek/format-email/route.ts#L12-L34)
- [rate-limit.ts](file://lib/middleware/rate-limit.ts#L143-L166)

## Troubleshooting Guide
Common issues and resolutions:
- Unauthorized Access
  - Symptom: 401 Unauthorized
  - Cause: Missing/invalid Supabase session
  - Action: Re-authenticate and retry
- Rate Limit Exceeded
  - Symptom: 429 with X-RateLimit-* headers
  - Cause: Too many requests within the time window
  - Action: Back off using Retry-After; reduce request frequency
- Invalid JSON or Missing Fields
  - Symptom: 400 Bad Request
  - Cause: Malformed body or missing required fields
  - Action: Validate request payload before sending
- AI Service Errors
  - Symptom: 500/502 with AI-related messages
  - Cause: Missing API key, upstream failure, empty response
  - Action: Check environment variables and retry
- Payment/Webhook Issues
  - Symptom: 400 signature errors or delayed status updates
  - Cause: Missing/invalid signature or duplicate events
  - Action: Verify webhook secret and idempotency key; inspect stored events

**Section sources**
- [route.ts](file://app/api/deepseek/format/route.ts#L77-L82)
- [route.ts](file://app/api/deepseek/title/route.ts#L60-L65)
- [route.ts](file://app/api/deepseek/translate/route.ts#L61-L67)
- [route.ts](file://app/api/deepseek/format-email/route.ts#L56-L62)
- [route.ts](file://app/api/razorpay/webhook/route.ts#L59-L70)
- [rate-limit.ts](file://lib/middleware/rate-limit.ts#L143-L166)

## Conclusion
OSCAR’s API provides secure, rate-limited access to AI-powered text formatting, title generation, translation, and email formatting, alongside robust usage tracking and payment/webhook handling. Clients should implement retries with exponential backoff, respect rate limits, and ensure strong input validation and secure API key management.

## Appendices

### Authentication and Authorization
- All protected endpoints require a valid Supabase session.
- Unauthenticated requests fall back to IP-based identifiers for rate limiting.

**Section sources**
- [route.ts](file://app/api/deepseek/format/route.ts#L40-L48)
- [rate-limit.ts](file://lib/middleware/rate-limit.ts#L244-L263)

### Rate Limiting Policies
- AI endpoints: 20/min (format), 30/min (title), 15/min (format-email), 15/min (translate)
- Payment endpoints: 5 per 15 minutes
- Webhooks: 100 per minute
- Headers on 429: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After

**Section sources**
- [constants.ts](file://lib/constants.ts#L276-L313)
- [rate-limit.ts](file://lib/middleware/rate-limit.ts#L143-L166)

### Security Controls
- Input validation and sanitization to prevent prompt injection.
- Delimited user content to isolate instructions from data.
- API key management for external services (server-side only).
- Webhook signature verification to prevent spoofing.

**Section sources**
- [prompts.ts](file://lib/prompts.ts#L34-L85)
- [prompts.ts](file://lib/prompts.ts#L93-L96)
- [route.ts](file://app/api/deepseek/format/route.ts#L75-L82)
- [route.ts](file://app/api/razorpay/webhook/route.ts#L64-L70)

### Client Implementation Guidelines
- Use HTTPS and include the Supabase session cookie for authenticated endpoints.
- Implement exponential backoff on 429 and 5xx responses.
- Validate request bodies before sending to reduce 400 errors.
- For webhooks, verify signatures and implement idempotency checks.

[No sources needed since this section provides general guidance]