# Subscription & Payment System

<cite>
**Referenced Files in This Document**
- [route.ts](file://app/api/razorpay/create-subscription/route.ts)
- [route.ts](file://app/api/razorpay/webhook/route.ts)
- [route.ts](file://app/api/razorpay/verify/route.ts)
- [route.ts](file://app/api/razorpay/cancel/route.ts)
- [route.ts](file://app/api/usage/check/route.ts)
- [route.ts](file://app/api/usage/increment/route.ts)
- [route.ts](file://app/api/usage/stats/route.ts)
- [CurrentPlanCard.tsx](file://components/settings/CurrentPlanCard.tsx)
- [RazorpayCheckout.tsx](file://components/subscription/RazorpayCheckout.tsx)
- [UsageIndicator.tsx](file://components/subscription/UsageIndicator.tsx)
- [BillingSection.tsx](file://components/settings/BillingSection.tsx)
- [settings/page.tsx](file://app/settings/page.tsx)
- [SubscriptionContext.tsx](file://lib/contexts/SubscriptionContext.tsx)
- [useSubscription.ts](file://lib/hooks/useSubscription.ts)
- [razorpay.service.ts](file://lib/services/razorpay.service.ts)
- [subscription.service.ts](file://lib/services/subscription.service.ts)
- [usage.service.ts](file://lib/services/usage.service.ts)
- [subscription.types.ts](file://lib/types/subscription.types.ts)
- [constants.ts](file://lib/constants.ts)
- [001_subscriptions.sql](file://supabase/migrations/001_subscriptions.sql)
- [002_atomic_usage_increment.sql](file://supabase/migrations/002_atomic_usage_increment.sql)
- [supabase-migration-starred.sql](file://supabase-migration-starred.sql)
- [supabase-migration-feedback.sql](file://supabase-migration-feedback.sql)
</cite>

## Update Summary
**Changes Made**
- Added new subscription upgrade card functionality with enhanced status display
- Enhanced subscription management with multi-section settings integration
- Improved subscription status detection with comprehensive status handling
- Added usage stats API endpoint for centralized subscription data
- Integrated subscription context provider for real-time status updates
- Enhanced billing section with current plan card and usage indicators

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Enhanced Subscription Management](#enhanced-subscription-management)
7. [Multi-Section Settings Integration](#multi-section-settings-integration)
8. [Improved Subscription Status Detection](#improved-subscription-status-detection)
9. [Usage Stats API Endpoint](#usage-stats-api-endpoint)
10. [Subscription Context Provider](#subscription-context-provider)
11. [Enhanced Idempotency Handling](#enhanced-idempotency-handling)
12. [Atomic Usage Operations](#atomic-usage-operations)
13. [Starred Note Functionality](#starred-note-functionality)
14. [Dependency Analysis](#dependency-analysis)
15. [Performance Considerations](#performance-considerations)
16. [Troubleshooting Guide](#troubleshooting-guide)
17. [Conclusion](#conclusion)
18. [Appendices](#appendices)

## Introduction
This document explains the subscription and payment system built with Razorpay for usage-based billing. The system has been enhanced with improved idempotency handling, atomic usage operations, new starred note functionality, and comprehensive subscription management features. It covers subscription management, pricing tiers, payment processing, usage tracking, rate limiting, and consumption monitoring. The enhanced webhook verification processes ensure reliable event processing, while atomic usage increment operations prevent race conditions in concurrent scenarios.

## Project Structure
The system is organized around:
- API routes for payment lifecycle (create subscription, verify payment, cancel, webhook, usage stats)
- Frontend components for pricing and usage visualization
- Services for Razorpay integration, subscription state, and usage tracking
- Supabase database schema and helper functions for persistence and idempotency
- Enhanced usage enforcement with pre-flight checks
- New starred note functionality with dedicated database support
- Multi-section settings integration with subscription context management

```mermaid
graph TB
subgraph "Frontend"
PC["PricingCard.tsx"]
RC["RazorpayCheckout.tsx"]
UI["UsageIndicator.tsx"]
BS["BillingSection.tsx"]
CPC["CurrentPlanCard.tsx"]
SP["Settings Page"]
SC["SubscriptionContext"]
US["useSubscription Hook"]
NS["Notes UI<br/>with Star Support"]
end
subgraph "API Routes"
CS["create-subscription/route.ts"]
VER["verify/route.ts"]
CAN["cancel/route.ts"]
WH["webhook/route.ts"]
UC["usage/check/route.ts"]
UIP["usage/increment/route.ts"]
STATS["usage/stats/route.ts"]
end
subgraph "Services"
RS["razorpay.service.ts"]
SS["subscription.service.ts"]
USvc["usage.service.ts"]
end
subgraph "Backend Data"
DB["Supabase DB<br/>subscriptions, usage_tracking, webhook_events, notes"]
FN["Helper Functions<br/>get_current_month_year, get_monthly_usage, increment_recording_usage"]
end
SP --> CPC
SP --> BS
BS --> UI
BS --> CAN
CPC --> RC
CPC --> CAN
SC --> STATS
US --> STATS
CS --> RS
VER --> RS
CAN --> RS
WH --> SS
WH --> RS
UC --> USvc
UIP --> USvc
STATS --> SS
STATS --> USvc
USvc --> DB
NS --> DB
SS --> DB
RS --> DB
```

**Diagram sources**
- [CurrentPlanCard.tsx:1-133](file://components/settings/CurrentPlanCard.tsx#L1-L133)
- [BillingSection.tsx:1-203](file://components/settings/BillingSection.tsx#L1-L203)
- [settings/page.tsx:1-190](file://app/settings/page.tsx#L1-L190)
- [SubscriptionContext.tsx:1-208](file://lib/contexts/SubscriptionContext.tsx#L1-L208)
- [useSubscription.ts:1-162](file://lib/hooks/useSubscription.ts#L1-L162)
- [route.ts:1-125](file://app/api/razorpay/create-subscription/route.ts#L1-L125)
- [route.ts:1-103](file://app/api/razorpay/verify/route.ts#L1-L103)
- [route.ts:1-92](file://app/api/razorpay/cancel/route.ts#L1-L92)
- [route.ts:1-303](file://app/api/razorpay/webhook/route.ts#L1-L303)
- [route.ts:1-66](file://app/api/usage/check/route.ts#L1-L66)
- [route.ts:1-69](file://app/api/usage/increment/route.ts#L1-L69)
- [route.ts:1-65](file://app/api/usage/stats/route.ts#L1-L65)
- [razorpay.service.ts:1-188](file://lib/services/razorpay.service.ts#L1-L188)
- [subscription.service.ts:1-280](file://lib/services/subscription.service.ts#L1-L280)
- [usage.service.ts:1-241](file://lib/services/usage.service.ts#L1-L241)
- [001_subscriptions.sql:1-206](file://supabase/migrations/001_subscriptions.sql#L1-L206)
- [002_atomic_usage_increment.sql:1-30](file://supabase/migrations/002_atomic_usage_increment.sql#L1-L30)

**Section sources**
- [route.ts:1-125](file://app/api/razorpay/create-subscription/route.ts#L1-L125)
- [route.ts:1-303](file://app/api/razorpay/webhook/route.ts#L1-L303)
- [route.ts:1-103](file://app/api/razorpay/verify/route.ts#L1-L103)
- [route.ts:1-92](file://app/api/razorpay/cancel/route.ts#L1-L92)
- [route.ts:1-66](file://app/api/usage/check/route.ts#L1-L66)
- [route.ts:1-69](file://app/api/usage/increment/route.ts#L1-L69)
- [route.ts:1-65](file://app/api/usage/stats/route.ts#L1-L65)
- [CurrentPlanCard.tsx:1-133](file://components/settings/CurrentPlanCard.tsx#L1-L133)
- [BillingSection.tsx:1-203](file://components/settings/BillingSection.tsx#L1-L203)
- [settings/page.tsx:1-190](file://app/settings/page.tsx#L1-L190)
- [SubscriptionContext.tsx:1-208](file://lib/contexts/SubscriptionContext.tsx#L1-L208)
- [useSubscription.ts:1-162](file://lib/hooks/useSubscription.ts#L1-L162)
- [razorpay.service.ts:1-188](file://lib/services/razorpay.service.ts#L1-L188)
- [subscription.service.ts:1-280](file://lib/services/subscription.service.ts#L1-L280)
- [usage.service.ts:1-241](file://lib/services/usage.service.ts#L1-L241)
- [001_subscriptions.sql:1-206](file://supabase/migrations/001_subscriptions.sql#L1-L206)
- [002_atomic_usage_increment.sql:1-30](file://supabase/migrations/002_atomic_usage_increment.sql#L1-L30)

## Core Components
- **Enhanced Razorpay integration service**: Improved webhook signature verification with constant-time comparison, enhanced security measures, and better error handling.
- **Robust subscription service**: Manages subscription records with improved status handling and atomic operations for subscription state updates.
- **Atomic usage service**: Tracks monthly recording counts with Postgres function-based atomic increments, preventing race conditions in concurrent scenarios.
- **Comprehensive API routes**: Secure endpoints with enhanced rate limiting, improved error handling, and better validation.
- **Enhanced frontend components**: Pricing cards, checkout flows, usage indicators, and billing sections with improved user experience.
- **Multi-section settings integration**: Comprehensive settings page with lazy-loaded sections and real-time subscription status updates.
- **Enhanced subscription context management**: Centralized subscription state management with automatic refetching and real-time updates.
- **Starred note functionality**: New database schema and service methods for marking notes as favorites with proper authorization.

**Section sources**
- [razorpay.service.ts:151-187](file://lib/services/razorpay.service.ts#L151-L187)
- [subscription.service.ts:1-280](file://lib/services/subscription.service.ts#L1-L280)
- [usage.service.ts:67-122](file://lib/services/usage.service.ts#L67-L122)
- [route.ts:42-181](file://app/api/razorpay/webhook/route.ts#L42-L181)
- [route.ts:18-69](file://app/api/usage/increment/route.ts#L18-L69)
- [CurrentPlanCard.tsx:1-133](file://components/settings/CurrentPlanCard.tsx#L1-L133)
- [BillingSection.tsx:1-203](file://components/settings/BillingSection.tsx#L1-L203)
- [settings/page.tsx:1-190](file://app/settings/page.tsx#L1-L190)
- [SubscriptionContext.tsx:1-208](file://lib/contexts/SubscriptionContext.tsx#L1-L208)
- [useSubscription.ts:1-162](file://lib/hooks/useSubscription.ts#L1-L162)
- [supabase-migration-starred.sql:1-23](file://supabase-migration-starred.sql#L1-L23)

## Architecture Overview
The system integrates frontend components with serverless API routes, which delegate to services that call the Razorpay SDK and interact with Supabase. Enhanced webhook processing ensures reliable event handling with improved idempotency and security measures. The multi-section settings integration provides a comprehensive user experience with real-time subscription status updates.

```mermaid
sequenceDiagram
participant User as "User"
participant Settings as "Settings Page"
participant SC as "SubscriptionContext"
participant API as "usage/stats/route.ts"
participant SS as "subscription.service.ts"
participant US as "usage.service.ts"
User->>Settings : "Open Settings"
Settings->>SC : "Initialize context"
SC->>API : "GET /api/usage/stats"
API->>SS : "getOrCreateSubscription(user.id)"
API->>US : "getUsageStats(user.id)"
SS-->>API : "Subscription data"
US-->>API : "Usage stats"
API-->>SC : "Combined data"
SC-->>Settings : "Real-time subscription status"
Settings->>Settings : "Display CurrentPlanCard & BillingSection"
```

**Diagram sources**
- [settings/page.tsx:60-190](file://app/settings/page.tsx#L60-L190)
- [SubscriptionContext.tsx:55-131](file://lib/contexts/SubscriptionContext.tsx#L55-L131)
- [route.ts:14-65](file://app/api/usage/stats/route.ts#L14-L65)
- [subscription.service.ts:1-280](file://lib/services/subscription.service.ts#L1-L280)
- [usage.service.ts:1-241](file://lib/services/usage.service.ts#L1-L241)

## Detailed Component Analysis

### Enhanced Subscription Management
- **Enhanced subscription lifecycle**:
  - Creation: API route authenticates the user, ensures a subscription record exists, creates a Razorpay customer if needed, and creates a subscription for the selected billing cycle.
  - Verification: After payment, the frontend verifies the signature server-side with improved security, fetches the latest subscription state, and updates the local record.
  - Cancellation: The API cancels the subscription at the end of the billing period and updates local status.
  - **Enhanced webhooks**: The webhook handler validates signatures using constant-time comparison, prevents duplicates using Razorpay's unique event IDs, and updates subscription status and periods.
  - **Enhanced status detection**: Comprehensive status handling including active, cancelled, expired, and past_due states with proper UI representation.

```mermaid
flowchart TD
Start(["User initiates subscription"]) --> GetSub["Get or create subscription record"]
GetSub --> HasCustomer{"Has Razorpay customer?"}
HasCustomer --> |No| CreateCustomer["Create Razorpay customer"]
HasCustomer --> |Yes| CreateSub["Create subscription (monthly/yearly)"]
CreateCustomer --> CreateSub
CreateSub --> Checkout["Frontend opens Razorpay checkout"]
Checkout --> Verify["Verify payment signature with constant-time comparison"]
Verify --> Update["Update subscription from Razorpay entity"]
Update --> Status["Enhanced status detection:<br/>active, cancelled, expired, past_due"]
Status --> Active["Subscription active (pro) or remains free"]
Active --> End(["Done"])
```

**Diagram sources**
- [route.ts:1-125](file://app/api/razorpay/create-subscription/route.ts#L1-L125)
- [route.ts:1-103](file://app/api/razorpay/verify/route.ts#L1-L103)
- [route.ts:1-92](file://app/api/razorpay/cancel/route.ts#L1-L92)
- [route.ts:74-155](file://app/api/razorpay/webhook/route.ts#L74-L155)
- [razorpay.service.ts:151-187](file://lib/services/razorpay.service.ts#L151-L187)
- [subscription.service.ts:1-280](file://lib/services/subscription.service.ts#L1-L280)

**Section sources**
- [route.ts:1-125](file://app/api/razorpay/create-subscription/route.ts#L1-L125)
- [route.ts:1-103](file://app/api/razorpay/verify/route.ts#L1-L103)
- [route.ts:1-92](file://app/api/razorpay/cancel/route.ts#L1-L92)
- [route.ts:74-155](file://app/api/razorpay/webhook/route.ts#L74-L155)
- [subscription.service.ts:1-280](file://lib/services/subscription.service.ts#L1-L280)

### Enhanced Subscription Management
- **Enhanced subscription lifecycle**:
  - Creation: API route authenticates the user, ensures a subscription record exists, creates a Razorpay customer if needed, and creates a subscription for the selected billing cycle.
  - Verification: After payment, the frontend verifies the signature server-side with improved security, fetches the latest subscription state, and updates the local record.
  - Cancellation: The API cancels the subscription at the end of the billing period and updates local status.
  - **Enhanced webhooks**: The webhook handler validates signatures using constant-time comparison, prevents duplicates using Razorpay's unique event IDs, and updates subscription status and periods.

```mermaid
flowchart TD
Start(["User initiates subscription"]) --> GetSub["Get or create subscription record"]
GetSub --> HasCustomer{"Has Razorpay customer?"}
HasCustomer --> |No| CreateCustomer["Create Razorpay customer"]
HasCustomer --> |Yes| CreateSub["Create subscription (monthly/yearly)"]
CreateCustomer --> CreateSub
CreateSub --> Checkout["Frontend opens Razorpay checkout"]
Checkout --> Verify["Verify payment signature with constant-time comparison"]
Verify --> Update["Update subscription from Razorpay entity"]
Update --> Active["Subscription active (pro) or remains free"]
Active --> End(["Done"])
```

**Diagram sources**
- [route.ts:1-125](file://app/api/razorpay/create-subscription/route.ts#L1-L125)
- [route.ts:1-103](file://app/api/razorpay/verify/route.ts#L1-L103)
- [route.ts:1-92](file://app/api/razorpay/cancel/route.ts#L1-L92)
- [route.ts:74-155](file://app/api/razorpay/webhook/route.ts#L74-L155)
- [razorpay.service.ts:151-187](file://lib/services/razorpay.service.ts#L151-L187)
- [subscription.service.ts:1-280](file://lib/services/subscription.service.ts#L1-L280)

**Section sources**
- [route.ts:1-125](file://app/api/razorpay/create-subscription/route.ts#L1-L125)
- [route.ts:1-103](file://app/api/razorpay/verify/route.ts#L1-L103)
- [route.ts:1-92](file://app/api/razorpay/cancel/route.ts#L1-L92)
- [route.ts:74-155](file://app/api/razorpay/webhook/route.ts#L74-L155)
- [subscription.service.ts:1-280](file://lib/services/subscription.service.ts#L1-L280)

### Pricing Tier Configuration
- **Tiers**: free and pro.
- **Billing cycles**: monthly and yearly.
- **Enhanced pricing constants**: Define monthly/yearly rates and savings percentages with improved configuration management.
- **PricingCard**: Displays prices, highlights popular plans, and disables actions for the current plan with better user feedback.

```mermaid
classDiagram
class PricingCard {
+props : tier, price, billingCycle, features, highlighted, currentTier, onSelect, isLoading, currency
+render()
}
class Constants {
+PRICING.MONTHLY
+PRICING.YEARLY
+PRICING_USD.MONTHLY
+PRICING_USD.YEARLY
}
PricingCard --> Constants : "uses"
```

**Diagram sources**
- [CurrentPlanCard.tsx:1-133](file://components/settings/CurrentPlanCard.tsx#L1-L133)
- [constants.ts:252-268](file://lib/constants.ts#L252-L268)

**Section sources**
- [CurrentPlanCard.tsx:1-133](file://components/settings/CurrentPlanCard.tsx#L1-L133)
- [constants.ts:252-268](file://lib/constants.ts#L252-L268)

### Enhanced Payment Processing Workflows
- **Improved frontend checkout**:
  - Loads Razorpay script dynamically with enhanced error handling.
  - Calls the create-subscription endpoint to obtain a subscriptionId and key.
  - Opens the checkout modal and handles callbacks with better user feedback.
  - Verifies the payment server-side with constant-time signature verification and navigates on success.
- **Enhanced backend verification**:
  - Validates signatures using HMAC-SHA256 with constant-time comparison to prevent timing attacks.
  - Fetches subscription details from Razorpay with improved error handling.
  - Updates local subscription record with enhanced logging and debugging capabilities.

```mermaid
sequenceDiagram
participant FE as "RazorpayCheckout.tsx"
participant API1 as "create-subscription/route.ts"
participant API2 as "verify/route.ts"
participant RS as "razorpay.service.ts"
participant SS as "subscription.service.ts"
FE->>API1 : "POST {planType}"
API1->>RS : "createCustomer/createSubscription"
API1-->>FE : "{subscriptionId, razorpayKeyId}"
FE->>FE : "Open checkout"
FE->>API2 : "POST {paymentId, subscriptionId, signature}"
API2->>RS : "verifyPaymentSignature (constant-time)"
API2->>RS : "fetchSubscription"
API2->>SS : "updateFromRazorpaySubscription"
API2-->>FE : "{success, subscription}"
```

**Diagram sources**
- [RazorpayCheckout.tsx:1-210](file://components/subscription/RazorpayCheckout.tsx#L1-L210)
- [route.ts:1-125](file://app/api/razorpay/create-subscription/route.ts#L1-L125)
- [route.ts:1-103](file://app/api/razorpay/verify/route.ts#L1-L103)
- [razorpay.service.ts:122-149](file://lib/services/razorpay.service.ts#L122-L149)
- [subscription.service.ts:1-280](file://lib/services/subscription.service.ts#L1-L280)

**Section sources**
- [RazorpayCheckout.tsx:1-210](file://components/subscription/RazorpayCheckout.tsx#L1-L210)
- [route.ts:1-125](file://app/api/razorpay/create-subscription/route.ts#L1-L125)
- [route.ts:1-103](file://app/api/razorpay/verify/route.ts#L1-L103)
- [razorpay.service.ts:122-149](file://lib/services/razorpay.service.ts#L122-L149)
- [subscription.service.ts:1-280](file://lib/services/subscription.service.ts#L1-L280)

### Enhanced Usage Tracking, Rate Limiting, and Consumption Monitoring
- **Atomic usage tracking**:
  - **Enhanced monthly recording counts** stored per user-month using Postgres functions.
  - **Atomic increment operations** prevent race conditions with INSERT ... ON CONFLICT DO UPDATE patterns.
  - **Fallback mechanisms** ensure graceful degradation when advanced features are unavailable.
  - **Usage service** checks limits and computes remaining quotas with improved error handling.
- **Enhanced rate limiting**:
  - Payment endpoints enforce per-user and per-IP limits to prevent abuse with configurable thresholds.
  - **Pre-flight checks** prevent free users from exceeding monthly limits before processing.
- **Improved consumption monitoring**:
  - **Enhanced UsageIndicator** renders progress bars and messages based on current usage vs limits with better visual feedback.
  - **Comprehensive BillingSection** aggregates usage metrics and presents actionable info with improved user experience.

```mermaid
flowchart TD
A["Start recording"] --> B["GET /api/usage/check (pre-flight)"]
B --> C{"Allowed?"}
C --> |No| D["Return 402 Payment Required"]
C --> |Yes| E["POST /api/usage/increment"]
E --> F["Atomic increment via Postgres function"]
F --> G["INSERT ... ON CONFLICT DO UPDATE"]
G --> H["Return new count with constant-time operations"]
H --> I["Render enhanced UsageIndicator in UI"]
```

**Diagram sources**
- [route.ts:1-66](file://app/api/usage/check/route.ts#L1-L66)
- [route.ts:1-69](file://app/api/usage/increment/route.ts#L1-L69)
- [usage.service.ts:67-122](file://lib/services/usage.service.ts#L67-L122)
- [UsageIndicator.tsx:1-101](file://components/subscription/UsageIndicator.tsx#L1-L101)
- [001_subscriptions.sql:135-154](file://supabase/migrations/001_subscriptions.sql#L135-L154)
- [002_atomic_usage_increment.sql:1-30](file://supabase/migrations/002_atomic_usage_increment.sql#L1-L30)

**Section sources**
- [route.ts:1-66](file://app/api/usage/check/route.ts#L1-L66)
- [route.ts:1-69](file://app/api/usage/increment/route.ts#L1-L69)
- [usage.service.ts:67-122](file://lib/services/usage.service.ts#L67-L122)
- [UsageIndicator.tsx:1-101](file://components/subscription/UsageIndicator.tsx#L1-L101)
- [constants.ts:240-247](file://lib/constants.ts#L240-L247)
- [001_subscriptions.sql:135-154](file://supabase/migrations/001_subscriptions.sql#L135-L154)
- [002_atomic_usage_increment.sql:1-30](file://supabase/migrations/002_atomic_usage_increment.sql#L1-L30)

### Enhanced Webhook Processing
- **Improved signature verification** using webhook secret with constant-time comparison to prevent timing attacks.
- **Enhanced idempotency** via dedicated table storing processed events using Razorpay's unique event IDs as primary keys.
- **Advanced event routing** by type to appropriate handlers (activated, charged, cancelled, halted, paused, resumed, completed/expired).
- **Robust status transitions** update local subscription tier and periods with improved error handling.
- **Enhanced error tracking** with detailed error messages and manual retry capabilities.

```mermaid
sequenceDiagram
participant RP as "Razorpay"
participant API as "webhook/route.ts"
participant RS as "razorpay.service.ts"
participant SS as "subscription.service.ts"
participant DB as "Supabase DB"
RP->>API : "POST webhook with signature"
API->>RS : "verifyWebhookSignature (constant-time)"
API->>DB : "Check idempotency using razorpay_event_id"
API->>API : "Parse payload and route by event"
API->>SS : "handleWebhookStatusChange / updateFromRazorpaySubscription"
SS->>DB : "Upsert subscription with enhanced logging"
API-->>RP : "200 OK with error tracking"
```

**Diagram sources**
- [route.ts:42-181](file://app/api/razorpay/webhook/route.ts#L42-L181)
- [razorpay.service.ts:151-187](file://lib/services/razorpay.service.ts#L151-L187)
- [subscription.service.ts:1-280](file://lib/services/subscription.service.ts#L1-L280)
- [001_subscriptions.sql:98-121](file://supabase/migrations/001_subscriptions.sql#L98-L121)

**Section sources**
- [route.ts:42-181](file://app/api/razorpay/webhook/route.ts#L42-L181)
- [razorpay.service.ts:151-187](file://lib/services/razorpay.service.ts#L151-L187)
- [subscription.service.ts:1-280](file://lib/services/subscription.service.ts#L1-L280)
- [001_subscriptions.sql:98-121](file://supabase/migrations/001_subscriptions.sql#L98-L121)

### Authentication and User Limits
- **Enhanced authentication** with improved user session management and authorization checks.
- **Improved free tier enforcement** with pre-flight usage checks and better error messaging.
- **Pro tier benefits** with unlimited quotas and enhanced feature access.
- **Enhanced UI integration** with BillingSection and UsageIndicator reflecting current limits and remaining usage with improved user feedback.

**Section sources**
- [route.ts:1-125](file://app/api/razorpay/create-subscription/route.ts#L1-L125)
- [route.ts:1-66](file://app/api/usage/check/route.ts#L1-L66)
- [usage.service.ts:1-241](file://lib/services/usage.service.ts#L1-L241)
- [BillingSection.tsx:1-203](file://components/settings/BillingSection.tsx#L1-L203)
- [UsageIndicator.tsx:1-101](file://components/subscription/UsageIndicator.tsx#L1-L101)

## Enhanced Subscription Management
The system now features comprehensive subscription management with enhanced status detection and user interface components.

### New Subscription Upgrade Card Functionality
- **CurrentPlanCard component**: Displays current subscription status with enhanced visual indicators
- **Status badges**: Color-coded badges for active, cancelled, and expired states
- **Upgrade prompts**: Clear call-to-action buttons for free users to upgrade to Pro
- **Billing details**: Shows billing cycle and next billing date for active subscriptions
- **Cancellation handling**: Proper handling of cancelled subscriptions with access until date display

### Enhanced Status Detection
- **Comprehensive status handling**: Supports active, cancelled, expired, and past_due subscription states
- **Visual status indicators**: Dynamic color coding (green for active, yellow for cancelling, red for expired)
- **State-specific UI**: Different UI treatments based on subscription status
- **Proper date formatting**: Localized date display for billing periods

```mermaid
flowchart TD
Status["Subscription Status"] --> Active{"Active?"}
Active --> |Yes| ActiveBadge["Green Badge: Active"]
Active --> |No| Cancelled{"Cancelled?"}
Cancelled --> |Yes| CancelledBadge["Yellow Badge: Cancelling"]
Cancelled --> |No| Expired{"Expired?"}
Expired --> |Yes| ExpiredBadge["Red Badge: Expired"]
Expired --> |No| PastDue{"Past Due?"}
PastDue --> |Yes| PastDueBadge["Red Badge: Past Due"]
PastDue --> |No| Other["Other Status"]
```

**Diagram sources**
- [CurrentPlanCard.tsx:67-82](file://components/settings/CurrentPlanCard.tsx#L67-L82)

**Section sources**
- [CurrentPlanCard.tsx:1-133](file://components/settings/CurrentPlanCard.tsx#L1-L133)
- [settings/page.tsx:160-175](file://app/settings/page.tsx#L160-L175)

## Multi-Section Settings Integration
The system now provides a comprehensive multi-section settings interface with real-time subscription management.

### Settings Page Architecture
- **Lazy-loaded sections**: Vocabulary, Billing, Account, and Data & Privacy sections
- **Tab-based navigation**: Desktop: vertical tabs, Mobile: dropdown selector
- **Real-time updates**: Subscription status automatically refreshes
- **Centralized context**: Single source of truth for subscription data

### Enhanced Billing Section
- **CurrentPlanCard integration**: Displays current subscription status prominently
- **Usage indicators**: Comprehensive usage tracking for recordings, notes, and vocabulary
- **Upgrade benefits**: Clear presentation of Pro plan advantages for free users
- **Cancellation flow**: Modal-based cancellation with confirmation and status updates

### Settings Navigation
- **Desktop layout**: Fixed sidebar with active state highlighting
- **Mobile responsiveness**: Dropdown selector for mobile devices
- **Section-specific icons**: Lucide icons for visual identification
- **Route integration**: Direct navigation to external pricing page

```mermaid
sequenceDiagram
participant User as "User"
participant Settings as "Settings Page"
participant Tabs as "Tab Navigation"
participant Section as "Active Section"
User->>Settings : "Open Settings"
Settings->>Tabs : "Initialize with 'billing' active"
Tabs->>Section : "Load BillingSection"
Section->>Section : "Display CurrentPlanCard & Usage"
User->>Tabs : "Switch to Vocabulary"
Tabs->>Section : "Lazy-load VocabularySection"
```

**Diagram sources**
- [settings/page.tsx:60-190](file://app/settings/page.tsx#L60-L190)
- [BillingSection.tsx:104-199](file://components/settings/BillingSection.tsx#L104-L199)

**Section sources**
- [settings/page.tsx:1-190](file://app/settings/page.tsx#L1-L190)
- [BillingSection.tsx:1-203](file://components/settings/BillingSection.tsx#L1-L203)

## Improved Subscription Status Detection
The system now provides comprehensive subscription status detection with enhanced accuracy and user feedback.

### Enhanced Status Types
- **RazorpaySubscriptionStatus**: Complete enumeration of all Razorpay subscription states
- **Status mapping**: Proper TypeScript typing for subscription status values
- **UI state management**: Real-time status updates in the user interface
- **Error handling**: Graceful handling of edge cases and unknown states

### Status Display Logic
- **Active subscriptions**: Green badge with "Active" label
- **Cancelled subscriptions**: Yellow badge with "Cancelling" label
- **Expired/Completed**: Red badge with capitalized status
- **Past due**: Red badge with "Past Due" label
- **Default states**: Safe fallback values for undefined states

### Integration with Context Provider
- **Real-time updates**: Subscription status automatically updates via context
- **Automatic refetching**: Context provider periodically refreshes subscription data
- **Error boundaries**: Proper error handling for failed status fetches
- **Loading states**: Graceful loading indicators during status updates

**Section sources**
- [subscription.types.ts:14-23](file://lib/types/subscription.types.ts#L14-L23)
- [CurrentPlanCard.tsx:8-17](file://components/settings/CurrentPlanCard.tsx#L8-L17)
- [SubscriptionContext.tsx:18-45](file://lib/contexts/SubscriptionContext.tsx#L18-L45)

## Usage Stats API Endpoint
A new centralized API endpoint provides comprehensive subscription and usage statistics in a single request.

### API Endpoint: GET /api/usage/stats
- **Purpose**: Returns consolidated subscription and usage statistics
- **Authentication**: Requires user authentication via Supabase
- **Data aggregation**: Combines subscription data with usage statistics
- **Real-time updates**: Provides current subscription status and usage limits

### Response Structure
- **Tier information**: Current subscription tier (free/pro)
- **Status tracking**: Subscription status with enhanced state handling
- **Billing details**: Billing cycle and period end dates
- **Usage statistics**: Current recordings, notes, and vocabulary counts
- **Limit information**: Usage limits and remaining quotas
- **Feature flags**: Boolean flags for feature availability

### Integration Benefits
- **Reduced API calls**: Single endpoint replaces multiple individual requests
- **Consistent data**: Ensures subscription and usage data consistency
- **Performance optimization**: Minimizes network overhead for settings pages
- **Real-time accuracy**: Provides current subscription state and usage limits

```mermaid
sequenceDiagram
participant Client as "Client"
participant API as "usage/stats/route.ts"
participant Auth as "Supabase Auth"
participant SubSvc as "subscription.service.ts"
participant UsageSvc as "usage.service.ts"
Client->>API : "GET /api/usage/stats"
API->>Auth : "Authenticate user"
API->>SubSvc : "getOrCreateSubscription(userId)"
API->>UsageSvc : "getUsageStats(userId)"
SubSvc-->>API : "Subscription data"
UsageSvc-->>API : "Usage statistics"
API-->>Client : "Combined usage stats response"
```

**Diagram sources**
- [route.ts:14-65](file://app/api/usage/stats/route.ts#L14-L65)
- [subscription.service.ts:1-280](file://lib/services/subscription.service.ts#L1-L280)
- [usage.service.ts:1-241](file://lib/services/usage.service.ts#L1-L241)

**Section sources**
- [route.ts:1-65](file://app/api/usage/stats/route.ts#L1-L65)
- [subscription.types.ts:135-147](file://lib/types/subscription.types.ts#L135-L147)

## Subscription Context Provider
A centralized context provider manages subscription state with automatic updates and real-time synchronization.

### Context Provider Features
- **Centralized state management**: Single source of truth for subscription data
- **Automatic refetching**: Periodic updates to ensure data freshness
- **Error handling**: Graceful error management with user feedback
- **Loading states**: Proper loading indicators during data fetching
- **Hook integration**: Custom hooks for easy component integration

### Provider Configuration
- **Initial state**: Default values for subscription data and usage limits
- **Auth integration**: Automatic updates based on authentication state
- **Data normalization**: Consistent data formatting across components
- **Computed values**: Derived values like remaining quotas and feature flags

### Hook Implementation
- **Custom hook**: Simplified interface for component integration
- **State management**: Automatic state updates and re-rendering
- **Error boundaries**: Proper error handling and user feedback
- **Loading states**: Graceful handling of loading and error states

```mermaid
flowchart TD
AuthProvider["SubscriptionProvider"] --> Context["React Context"]
Context --> Components["Connected Components"]
Components --> UsageStats["Usage Stats Display"]
Components --> BillingSection["Billing Section"]
Components --> CurrentPlan["Current Plan Card"]
AuthProvider --> AutoRefetch["Automatic Refetching"]
AutoRefetch --> Context
```

**Diagram sources**
- [SubscriptionContext.tsx:55-194](file://lib/contexts/SubscriptionContext.tsx#L55-L194)
- [useSubscription.ts:40-161](file://lib/hooks/useSubscription.ts#L40-L161)

**Section sources**
- [SubscriptionContext.tsx:1-208](file://lib/contexts/SubscriptionContext.tsx#L1-L208)
- [useSubscription.ts:1-162](file://lib/hooks/useSubscription.ts#L1-L162)

## Enhanced Idempotency Handling
The system now implements robust idempotency handling for webhook processing:

### Key Enhancements
- **Unique Event ID Usage**: Instead of composite account_id + created_at keys, the system now uses Razorpay's unique `event.id` field as the primary idempotency key.
- **Improved Collision Prevention**: Second-level granularity in previous approaches could cause collisions when multiple events fired simultaneously; unique event IDs eliminate this risk.
- **Enhanced Storage Strategy**: Dedicated `webhook_events` table with unique constraints on `razorpay_event_id` ensures no duplicate processing.
- **Better Error Tracking**: Comprehensive error logging and manual retry capabilities for failed webhook processing.

### Implementation Details
The webhook handler now performs the following enhanced steps:
1. Extracts Razorpay's unique event ID from the payload
2. Checks for existing processed events using the unique ID
3. Stores unprocessed events with detailed metadata
4. Processes events based on type with enhanced error handling
5. Marks events as processed with timestamps

**Section sources**
- [route.ts:74-104](file://app/api/razorpay/webhook/route.ts#L74-L104)
- [001_subscriptions.sql:98-121](file://supabase/migrations/001_subscriptions.sql#L98-L121)
- [razorpay.service.ts:151-187](file://lib/services/razorpay.service.ts#L151-L187)

## Atomic Usage Operations
The system now implements atomic usage increment operations to prevent race conditions:

### Key Enhancements
- **PostgreSQL Function Implementation**: Custom `increment_recording_usage` function performs atomic upsert operations.
- **Race Condition Prevention**: Single-statement operations eliminate the read-then-write race condition.
- **Graceful Degradation**: Application fallback logic ensures system continues operating even if advanced features aren't deployed.
- **Enhanced Security**: Function-level security with service_role grants prevents unauthorized access.

### Implementation Details
The atomic increment operation follows this pattern:
1. Uses `INSERT ... ON CONFLICT DO UPDATE` syntax
2. Performs increment in the database layer
3. Returns the new count atomically
4. Includes proper error handling and fallback mechanisms

The function signature supports both parameterized and simplified usage patterns, with security restrictions ensuring only authorized service accounts can execute the operation.

**Section sources**
- [usage.service.ts:67-122](file://lib/services/usage.service.ts#L67-L122)
- [001_subscriptions.sql:135-154](file://supabase/migrations/001_subscriptions.sql#L135-L154)
- [002_atomic_usage_increment.sql:1-30](file://supabase/migrations/002_atomic_usage_increment.sql#L1-L30)

## Starred Note Functionality
The system now includes comprehensive starred note functionality:

### Database Schema Enhancement
- **New Column**: `is_starred` boolean column with default false value
- **Index Optimization**: Partial index on `is_starred = true` for efficient filtering
- **RLS Policy**: Enhanced UPDATE policy allowing users to toggle their own note stars
- **Documentation**: Clear comments explaining the starred functionality purpose

### Service Implementation
- **toggleStar Method**: Atomic toggle operation for starring/unstarring notes
- **Optimistic UI Updates**: Immediate UI feedback with rollback on failure
- **Consistent State Management**: Synchronization with actual database values

### Frontend Integration
- **Star Button Components**: Interactive star buttons in both list and detail views
- **Visual Feedback**: Color-changing stars with proper hover states
- **Accessibility**: Proper ARIA labels and keyboard navigation support

**Section sources**
- [supabase-migration-starred.sql:1-23](file://supabase-migration-starred.sql#L1-L23)
- [notes.service.ts:95-109](file://lib/services/notes.service.ts#L95-L109)
- [page.tsx:167-188](file://app/notes/page.tsx#L167-L188)
- [page.tsx:215-236](file://app/notes/[id]/page.tsx#L215-L236)

## Dependency Analysis
- **Enhanced API routes** depend on Supabase client and services with improved error handling.
- **Robust services** encapsulate domain logic with enhanced security and atomic operations.
- **Improved components** depend on services and constants for rendering and behavior with better user experience.
- **Expanded database schema** defines relationships and policies with enhanced security and performance optimizations.
- **New starred note functionality** integrates seamlessly with existing note management systems.
- **Multi-section settings** integrate with subscription context for real-time updates.
- **Usage stats API** provides centralized data access for subscription and usage information.

```mermaid
graph LR
CS["create-subscription/route.ts"] --> RS["razorpay.service.ts<br/>(enhanced)"]
CS --> SS["subscription.service.ts"]
VER["verify/route.ts"] --> RS
VER --> SS
CAN["cancel/route.ts"] --> RS
CAN --> SS
WH["webhook/route.ts"] --> RS
WH --> SS
UC["usage/check/route.ts"] --> US["usage.service.ts<br/>(atomic ops)"]
UIP["usage/increment/route.ts"] --> US
STATS["usage/stats/route.ts"] --> SS
STATS --> US
SC["SubscriptionContext.tsx"] --> STATS
US --> DB["Supabase DB<br/>(enhanced)"]
PC["PricingCard.tsx"] --> CONST["constants.ts"]
UI["UsageIndicator.tsx"] --> CONST
BS["BillingSection.tsx"] --> UI
CPC["CurrentPlanCard.tsx"] --> CONST
SP["Settings Page"] --> CPC
SP --> BS
NS["Notes UI"] --> DB
```

**Diagram sources**
- [route.ts:1-125](file://app/api/razorpay/create-subscription/route.ts#L1-L125)
- [route.ts:1-103](file://app/api/razorpay/verify/route.ts#L1-L103)
- [route.ts:1-92](file://app/api/razorpay/cancel/route.ts#L1-L92)
- [route.ts:1-303](file://app/api/razorpay/webhook/route.ts#L1-L303)
- [route.ts:1-66](file://app/api/usage/check/route.ts#L1-L66)
- [route.ts:1-69](file://app/api/usage/increment/route.ts#L1-L69)
- [route.ts:1-65](file://app/api/usage/stats/route.ts#L1-L65)
- [SubscriptionContext.tsx:1-208](file://lib/contexts/SubscriptionContext.tsx#L1-L208)
- [CurrentPlanCard.tsx:1-133](file://components/settings/CurrentPlanCard.tsx#L1-L133)
- [settings/page.tsx:1-190](file://app/settings/page.tsx#L1-L190)
- [razorpay.service.ts:1-188](file://lib/services/razorpay.service.ts#L1-L188)
- [subscription.service.ts:1-280](file://lib/services/subscription.service.ts#L1-L280)
- [usage.service.ts:1-241](file://lib/services/usage.service.ts#L1-L241)
- [PricingCard.tsx:1-163](file://components/subscription/PricingCard.tsx#L1-L163)
- [UsageIndicator.tsx:1-101](file://components/subscription/UsageIndicator.tsx#L1-L101)
- [constants.ts:1-314](file://lib/constants.ts#L1-L314)

**Section sources**
- [route.ts:1-125](file://app/api/razorpay/create-subscription/route.ts#L1-L125)
- [route.ts:1-103](file://app/api/razorpay/verify/route.ts#L1-L103)
- [route.ts:1-92](file://app/api/razorpay/cancel/route.ts#L1-L92)
- [route.ts:1-303](file://app/api/razorpay/webhook/route.ts#L1-L303)
- [route.ts:1-66](file://app/api/usage/check/route.ts#L1-L66)
- [route.ts:1-69](file://app/api/usage/increment/route.ts#L1-L69)
- [route.ts:1-65](file://app/api/usage/stats/route.ts#L1-L65)
- [SubscriptionContext.tsx:1-208](file://lib/contexts/SubscriptionContext.tsx#L1-L208)
- [CurrentPlanCard.tsx:1-133](file://components/settings/CurrentPlanCard.tsx#L1-L133)
- [settings/page.tsx:1-190](file://app/settings/page.tsx#L1-L190)
- [razorpay.service.ts:1-188](file://lib/services/razorpay.service.ts#L1-L188)
- [subscription.service.ts:1-280](file://lib/services/subscription.service.ts#L1-L280)
- [usage.service.ts:1-241](file://lib/services/usage.service.ts#L1-L241)
- [constants.ts:1-314](file://lib/constants.ts#L1-L314)

## Performance Considerations
- **Enhanced helper functions** for usage operations minimize round-trips with atomic database operations.
- **Improved webhook processing** idempotency reduces redundant work with unique event ID tracking.
- **Better rate limits** on payment endpoints prevent spam and reduce cost exposure with configurable thresholds.
- **Atomic operations** eliminate race conditions and improve data consistency.
- **Optimized database queries** with proper indexing and security policies.
- **Graceful degradation** ensures system continues operating during feature deployment transitions.
- **Lazy loading** reduces initial bundle size and improves perceived performance.
- **Centralized data access** minimizes redundant API calls and improves caching efficiency.

## Troubleshooting Guide
Common issues and enhanced resolutions:
- **Enhanced payment failures**:
  - Verify signatures on the backend using constant-time comparison; ensure webhook secrets and key IDs are configured.
  - Check subscription status transitions and logs for halted/pending events with improved error tracking.
  - **New**: Monitor webhook_events table for duplicate processing attempts.
- **Enhanced subscription cancellations**:
  - Confirm cancellation at cycle end and verify local status reflects the change with improved logging.
  - **New**: Check webhook event processing status for cancellation confirmation.
- **Enhanced usage quota enforcement**:
  - Ensure atomic usage increments and checks are executed before recording with proper error handling.
  - Validate free tier limits and pro tier bypass logic with improved pre-flight checks.
  - **New**: Monitor atomic operation performance and fallback mechanisms.
- **Webhook idempotency issues**:
  - **New**: Verify unique event ID handling and check for duplicate processing attempts.
  - **New**: Review webhook_events table for proper event tracking and error states.
- **Settings page issues**:
  - **New**: Verify subscription context provider initialization and data fetching.
  - **New**: Check lazy loading of settings sections and tab navigation.
  - **New**: Ensure real-time subscription status updates are working correctly.

**Section sources**
- [route.ts:74-181](file://app/api/razorpay/webhook/route.ts#L74-L181)
- [route.ts:1-92](file://app/api/razorpay/cancel/route.ts#L1-L92)
- [route.ts:1-66](file://app/api/usage/check/route.ts#L1-L66)
- [route.ts:1-69](file://app/api/usage/increment/route.ts#L1-L69)
- [route.ts:1-65](file://app/api/usage/stats/route.ts#L1-L65)
- [usage.service.ts:67-122](file://lib/services/usage.service.ts#L67-L122)
- [razorpay.service.ts:151-187](file://lib/services/razorpay.service.ts#L151-L187)
- [001_subscriptions.sql:98-121](file://supabase/migrations/001_subscriptions.sql#L98-L121)
- [settings/page.tsx:60-190](file://app/settings/page.tsx#L60-L190)

## Conclusion
The enhanced system provides a robust, extensible foundation for Razorpay-powered subscriptions with usage-based billing. Key improvements include enhanced webhook idempotency handling, atomic usage operations preventing race conditions, comprehensive starred note functionality, and sophisticated subscription management features. The system enforces limits effectively, offers clear UI indicators, maintains reliable synchronization via enhanced webhooks, and provides graceful degradation capabilities. The new multi-section settings integration with real-time subscription status updates enhances the user experience significantly. The modular design allows easy extension to additional plans, currencies, and usage categories while maintaining security and performance standards.

## Appendices

### Enhanced Database Schema Overview
- **subscriptions**: stores user subscription state, Razorpay identifiers, tier, billing cycle, and period timestamps with enhanced security policies.
- **usage_tracking**: tracks monthly recording counts per user-month with atomic increment operations and enhanced indexing.
- **webhook_events**: stores webhook payloads and processing status for idempotency with unique event ID tracking.
- **notes**: enhanced with starred functionality and feedback collection capabilities.
- **Enhanced helper functions**: compute current month-year, perform atomic usage increments, and fetch monthly usage with improved performance.

```mermaid
erDiagram
USERS {
uuid id PK
}
SUBSCRIPTIONS {
uuid id PK
uuid user_id FK
text razorpay_customer_id
text razorpay_subscription_id UK
text razorpay_plan_id
text tier
text billing_cycle
text status
timestamptz current_period_start
timestamptz current_period_end
timestamptz created_at
timestamptz updated_at
}
USAGE_TRACKING {
uuid id PK
uuid user_id FK
text month_year
int recording_count
timestamptz created_at
timestamptz updated_at
}
WEBHOOK_EVENTS {
uuid id PK
text razorpay_event_id UK
text event_type
boolean processed
jsonb payload
text error_message
timestamptz created_at
timestamptz processed_at
}
NOTES {
uuid id PK
uuid user_id FK
text title
text content
boolean is_starred
timestamptz created_at
timestamptz updated_at
}
USERS ||--|| SUBSCRIPTIONS : "owns"
USERS ||--o{ USAGE_TRACKING : "has usage"
USERS ||--o{ NOTES : "owns"
```

**Diagram sources**
- [001_subscriptions.sql:1-206](file://supabase/migrations/001_subscriptions.sql#L1-L206)
- [supabase-migration-starred.sql:1-23](file://supabase-migration-starred.sql#L1-L23)

**Section sources**
- [001_subscriptions.sql:1-206](file://supabase/migrations/001_subscriptions.sql#L1-L206)
- [supabase-migration-starred.sql:1-23](file://supabase-migration-starred.sql#L1-L23)

### Enhanced API Reference: Payment Endpoints
- **POST /api/razorpay/create-subscription**
  - Purpose: Create a Razorpay subscription for the authenticated user.
  - Body: { planType: "monthly" | "yearly" }
  - Response: { subscriptionId: string, razorpayKeyId: string }
- **POST /api/razorpay/verify**
  - Purpose: Verify payment signature and update subscription with enhanced security.
  - Body: { razorpay_payment_id, razorpay_subscription_id, razorpay_signature }
  - Response: { success: boolean, subscription?: DBSubscription }
- **POST /api/razorpay/cancel**
  - Purpose: Cancel subscription at period end.
  - Response: { success: boolean, currentPeriodEnd: string | null }
- **POST /api/razorpay/webhook**
  - Purpose: Process Razorpay webhook events with enhanced idempotency.
  - Headers: x-razorpay-signature
  - Response: { received: true } or { received: true, error: string }
- **GET /api/usage/check**
  - Purpose: Pre-flight check for recording limits with enhanced validation.
  - Response: { canRecord: boolean, current: number, remaining: number, limit: number }
- **POST /api/usage/increment**
  - Purpose: Atomically increment usage count with enhanced race condition prevention.
  - Response: { success: boolean, recordingsThisMonth: number, remaining: number | null, canRecord: boolean }
- **GET /api/usage/stats**
  - Purpose: Get comprehensive subscription and usage statistics with enhanced data aggregation.
  - Response: UsageStatsResponse with tier, status, billing details, and usage metrics

**Section sources**
- [route.ts:1-125](file://app/api/razorpay/create-subscription/route.ts#L1-L125)
- [route.ts:1-103](file://app/api/razorpay/verify/route.ts#L1-L103)
- [route.ts:1-92](file://app/api/razorpay/cancel/route.ts#L1-L92)
- [route.ts:1-303](file://app/api/razorpay/webhook/route.ts#L1-L303)
- [route.ts:1-66](file://app/api/usage/check/route.ts#L1-L66)
- [route.ts:1-69](file://app/api/usage/increment/route.ts#L1-L69)
- [route.ts:1-65](file://app/api/usage/stats/route.ts#L1-L65)

### Enhanced Types and Constants
- **SubscriptionTier**: "free" | "pro"
- **BillingCycle**: "monthly" | "yearly"
- **RazorpaySubscriptionStatus**: union of Razorpay statuses with enhanced validation
- **Enhanced pricing constants**: monthly/yearly rates and savings with improved configuration
- **Enhanced rate limits**: per-endpoint configurations with configurable thresholds
- **New starred note types**: DBNote with is_starred boolean and toggle operations
- **Enhanced subscription config**: FREE_MONTHLY_RECORDINGS, FREE_MAX_NOTES, FREE_MAX_VOCABULARY constants
- **UsageStatsResponse**: comprehensive subscription and usage statistics response type

**Section sources**
- [subscription.types.ts:1-306](file://lib/types/subscription.types.ts#L1-L306)
- [constants.ts:240-314](file://lib/constants.ts#L240-L314)
- [supabase-migration-starred.sql:1-23](file://supabase-migration-starred.sql#L1-L23)