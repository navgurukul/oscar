/**
 * Subscription Service
 * Handles subscription business logic and database operations
 */

import { createClient } from "@supabase/supabase-js";
import type {
  DBSubscription,
  DBSubscriptionInsert,
  DBSubscriptionUpdate,
  RazorpaySubscriptionEntity,
  RazorpaySubscriptionStatus,
  BillingCycle,
} from "@/lib/types/subscription.types";

/**
 * Get Supabase admin client (bypasses RLS)
 * Used for webhook updates that need to modify any user's data
 */
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log("[getSupabaseAdmin] URL exists:", !!supabaseUrl);
  console.log("[getSupabaseAdmin] Service key exists:", !!serviceRoleKey);
  console.log("[getSupabaseAdmin] Service key length:", serviceRoleKey?.length || 0);

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase admin credentials not configured");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export const subscriptionService = {
  /**
   * Get user's subscription record
   * Returns null if no subscription exists
   */
  async getUserSubscription(
    userId: string
  ): Promise<{ data: DBSubscription | null; error: Error | null }> {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error && error.code === "PGRST116") {
      // No rows found - not an error, just no subscription
      return { data: null, error: null };
    }

    return { data, error: error as Error | null };
  },

  /**
   * Get or create a subscription record for user
   * Creates a free tier subscription if none exists
   * Also handles expired cancelled subscriptions by resetting to free tier
   */
  async getOrCreateSubscription(
    userId: string
  ): Promise<{ data: DBSubscription | null; error: Error | null }> {
    const { data: existing, error: fetchError } =
      await this.getUserSubscription(userId);

    if (fetchError) {
      return { data: null, error: fetchError };
    }

    if (existing) {
      // Check if subscription is cancelled and period has ended
      if (
        existing.status === "cancelled" &&
        existing.current_period_end &&
        new Date(existing.current_period_end) < new Date()
      ) {
        // Period has ended, downgrade to free tier
        const supabase = getSupabaseAdmin();
        const { data: updated, error: updateError } = await supabase
          .from("subscriptions")
          .update({
            tier: "free",
            status: "active",
            razorpay_subscription_id: null,
            razorpay_customer_id: null,
            razorpay_plan_id: null,
            billing_cycle: null,
            current_period_start: null,
            current_period_end: null,
          })
          .eq("user_id", userId)
          .select()
          .single();

        if (updateError) {
          return { data: null, error: updateError as Error };
        }

        return { data: updated, error: null };
      }

      return { data: existing, error: null };
    }

    // Create new free tier subscription
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("subscriptions")
      .insert({
        user_id: userId,
        tier: "free",
        status: "active",
      } as DBSubscriptionInsert)
      .select()
      .single();

    return { data, error: error as Error | null };
  },

  /**
   * Update subscription record
   */
  async updateSubscription(
    userId: string,
    updates: DBSubscriptionUpdate
  ): Promise<{ data: DBSubscription | null; error: Error | null }> {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("subscriptions")
      .update(updates)
      .eq("user_id", userId)
      .select()
      .single();

    return { data, error: error as Error | null };
  },

  /**
   * Update subscription from Razorpay subscription entity
   * Called from webhook handler
   */
  async updateFromRazorpaySubscription(
    razorpaySubscription: RazorpaySubscriptionEntity,
    userId: string
  ): Promise<{ data: DBSubscription | null; error: Error | null }> {
    const supabase = getSupabaseAdmin();

    // Determine tier based on status
    const isActiveTier = ["active", "authenticated", "created"].includes(
      razorpaySubscription.status
    );
    const tier = isActiveTier ? "pro" : "free";

    // Determine billing cycle from plan notes or subscription
    const billingCycle =
      (razorpaySubscription.notes?.billing_cycle as BillingCycle) || undefined;

    const updates: DBSubscriptionUpdate = {
      razorpay_subscription_id: razorpaySubscription.id,
      razorpay_customer_id: razorpaySubscription.customer_id,
      razorpay_plan_id: razorpaySubscription.plan_id,
      tier,
      billing_cycle: billingCycle,
      status: razorpaySubscription.status,
      current_period_start: razorpaySubscription.current_start
        ? new Date(razorpaySubscription.current_start * 1000).toISOString()
        : undefined,
      current_period_end: razorpaySubscription.current_end
        ? new Date(razorpaySubscription.current_end * 1000).toISOString()
        : undefined,
    };

    // Try to update existing subscription
    const { data: existingData, error: existingError } = await supabase
      .from("subscriptions")
      .update(updates)
      .eq("user_id", userId)
      .select()
      .single();

    if (!existingError) {
      return { data: existingData, error: null };
    }

    // If no existing subscription, create one
    if (existingError.code === "PGRST116") {
      const { data, error } = await supabase
        .from("subscriptions")
        .insert({
          user_id: userId,
          ...updates,
        } as DBSubscriptionInsert)
        .select()
        .single();

      return { data, error: error as Error | null };
    }

    return { data: null, error: existingError as Error };
  },

  /**
   * Handle subscription status changes from webhooks
   */
  async handleWebhookStatusChange(
    razorpaySubscriptionId: string,
    newStatus: RazorpaySubscriptionStatus
  ): Promise<{ data: DBSubscription | null; error: Error | null }> {
    const supabase = getSupabaseAdmin();

    // Determine tier based on new status
    const isActiveTier = ["active", "authenticated"].includes(newStatus);
    const tier = isActiveTier ? "pro" : "free";

    const { data, error } = await supabase
      .from("subscriptions")
      .update({
        status: newStatus,
        tier,
      })
      .eq("razorpay_subscription_id", razorpaySubscriptionId)
      .select()
      .single();

    return { data, error: error as Error | null };
  },

  /**
   * Check if user is on pro tier
   */
  async isProUser(userId: string): Promise<boolean> {
    try {
      console.log("[isProUser] Checking for user:", userId);
      const { data } = await this.getUserSubscription(userId);
      console.log("[isProUser] Subscription data:", data);
      const isPro = data?.tier === "pro" && data?.status === "active";
      console.log("[isProUser] Is pro:", isPro);
      return isPro;
    } catch (error) {
      console.error("[isProUser] Error:", error);
      throw error;
    }
  },

  /**
   * Get subscription by Razorpay subscription ID
   */
  async getByRazorpaySubscriptionId(
    razorpaySubscriptionId: string
  ): Promise<{ data: DBSubscription | null; error: Error | null }> {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("razorpay_subscription_id", razorpaySubscriptionId)
      .single();

    if (error && error.code === "PGRST116") {
      return { data: null, error: null };
    }

    return { data, error: error as Error | null };
  },

  /**
   * Store or update Razorpay customer ID
   */
  async updateRazorpayCustomerId(
    userId: string,
    razorpayCustomerId: string
  ): Promise<{ error: Error | null }> {
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from("subscriptions")
      .update({ razorpay_customer_id: razorpayCustomerId })
      .eq("user_id", userId);

    return { error: error as Error | null };
  },
};
