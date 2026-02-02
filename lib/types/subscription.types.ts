/**
 * Subscription and payment related type definitions
 * For Razorpay integration
 */

// ============================================
// Subscription Types
// ============================================

export type SubscriptionTier = "free" | "pro";

export type BillingCycle = "monthly" | "yearly";

export type RazorpaySubscriptionStatus =
  | "created"
  | "authenticated"
  | "active"
  | "pending"
  | "halted"
  | "cancelled"
  | "completed"
  | "expired"
  | "paused";

/**
 * Database subscription record
 */
export interface DBSubscription {
  id: string;
  user_id: string;
  razorpay_customer_id: string | null;
  razorpay_subscription_id: string | null;
  razorpay_plan_id: string | null;
  tier: SubscriptionTier;
  billing_cycle: BillingCycle | null;
  status: RazorpaySubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Payload for creating a new subscription record
 */
export interface DBSubscriptionInsert {
  user_id: string;
  razorpay_customer_id?: string;
  razorpay_subscription_id?: string;
  razorpay_plan_id?: string;
  tier?: SubscriptionTier;
  billing_cycle?: BillingCycle;
  status?: RazorpaySubscriptionStatus;
  current_period_start?: string;
  current_period_end?: string;
}

/**
 * Payload for updating a subscription record
 */
export interface DBSubscriptionUpdate {
  razorpay_customer_id?: string;
  razorpay_subscription_id?: string;
  razorpay_plan_id?: string;
  tier?: SubscriptionTier;
  billing_cycle?: BillingCycle;
  status?: RazorpaySubscriptionStatus;
  current_period_start?: string;
  current_period_end?: string;
}

// ============================================
// Usage Types
// ============================================

/**
 * Database usage tracking record
 */
export interface DBUsageTracking {
  id: string;
  user_id: string;
  month_year: string;
  recording_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * Usage information for display
 */
export interface UsageInfo {
  recordingsThisMonth: number;
  recordingsLimit: number | null; // null = unlimited (pro)
  notesCount: number;
  notesLimit: number | null; // null = unlimited (pro)
}

/**
 * Combined subscription and usage data
 */
export interface SubscriptionWithUsage {
  subscription: DBSubscription;
  usage: UsageInfo;
  isProUser: boolean;
  canRecord: boolean;
  canCreateNote: boolean;
  remainingRecordings: number | null;
  remainingNotes: number | null;
}

// ============================================
// API Response Types
// ============================================

/**
 * Response from create-subscription endpoint
 */
export interface CreateSubscriptionResponse {
  subscriptionId: string;
  razorpayKeyId: string;
}

/**
 * Response from verify endpoint
 */
export interface VerifyPaymentResponse {
  success: boolean;
  message: string;
  subscription?: DBSubscription;
}

/**
 * Response from usage stats endpoint
 */
export interface UsageStatsResponse {
  tier: SubscriptionTier;
  status: RazorpaySubscriptionStatus;
  billingCycle: BillingCycle | null;
  currentPeriodEnd: string | null;
  recordingsThisMonth: number;
  recordingsLimit: number | null;
  notesCount: number;
  notesLimit: number | null;
  isProUser: boolean;
  canRecord: boolean;
  canCreateNote: boolean;
}

/**
 * Request body for verify endpoint
 */
export interface VerifyPaymentRequest {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
}

/**
 * Request body for create-subscription endpoint
 */
export interface CreateSubscriptionRequest {
  planType: "monthly" | "yearly";
}

// ============================================
// Webhook Types
// ============================================

/**
 * Database webhook event record
 */
export interface DBWebhookEvent {
  id: string;
  razorpay_event_id: string;
  event_type: string;
  processed: boolean;
  payload: Record<string, unknown>;
  error_message: string | null;
  created_at: string;
  processed_at: string | null;
}

/**
 * Razorpay webhook payload structure
 */
export interface RazorpayWebhookPayload {
  entity: "event";
  account_id: string;
  event: string;
  contains: string[];
  payload: {
    subscription?: {
      entity: RazorpaySubscriptionEntity;
    };
    payment?: {
      entity: RazorpayPaymentEntity;
    };
  };
  created_at: number;
}

/**
 * Razorpay subscription entity from API/webhook
 */
export interface RazorpaySubscriptionEntity {
  id: string;
  entity: "subscription";
  plan_id: string;
  customer_id: string;
  status: RazorpaySubscriptionStatus;
  current_start: number;
  current_end: number;
  ended_at: number | null;
  quantity: number;
  notes: Record<string, string>;
  charge_at: number;
  offer_id: string | null;
  short_url: string;
  has_scheduled_changes: boolean;
  change_scheduled_at: number | null;
  source: string;
  payment_method: string;
  created_at: number;
  expire_by: number | null;
  customer_notify: number;
  remaining_count: number | null;
  paid_count: number;
  total_count: number | null;
}

/**
 * Razorpay payment entity from API/webhook
 */
export interface RazorpayPaymentEntity {
  id: string;
  entity: "payment";
  amount: number;
  currency: string;
  status: string;
  order_id: string | null;
  invoice_id: string | null;
  international: boolean;
  method: string;
  amount_refunded: number;
  refund_status: string | null;
  captured: boolean;
  description: string;
  card_id: string | null;
  bank: string | null;
  wallet: string | null;
  vpa: string | null;
  email: string;
  contact: string;
  customer_id: string;
  notes: Record<string, string>;
  fee: number;
  tax: number;
  error_code: string | null;
  error_description: string | null;
  error_source: string | null;
  error_step: string | null;
  error_reason: string | null;
  acquirer_data: Record<string, string>;
  created_at: number;
}

// ============================================
// Component Props Types
// ============================================

/**
 * Props for UpgradePrompt component
 */
export interface UpgradePromptProps {
  limitType: "recordings" | "notes";
  currentUsage: number;
  limit: number;
  onClose: () => void;
  onUpgrade: () => void;
}

/**
 * Props for UsageIndicator component
 */
export interface UsageIndicatorProps {
  type: "recordings" | "notes" | "vocabulary";
  current: number;
  limit: number | null;
  variant?: "compact" | "full";
}

/**
 * Props for PricingCard component
 */
export interface PricingCardProps {
  tier: SubscriptionTier;
  price: number;
  billingCycle: BillingCycle;
  features: string[];
  highlighted?: boolean;
  currentTier?: SubscriptionTier;
  onSelect: () => void;
  isLoading?: boolean;
}
