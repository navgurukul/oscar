/**
 * Subscription Service
 * Handles subscription business logic and database operations
 */

import type {
  DBSubscription,
  DBSubscriptionInsert,
  DBSubscriptionUpdate,
  RazorpaySubscriptionEntity,
  RazorpaySubscriptionStatus,
  BillingCycle,
} from "@/lib/types/subscription.types";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import {
  getSubscriptionEntitlement,
  isActiveProSubscriptionStatus,
  isCancelledSubscriptionInGracePeriod,
} from "@/lib/constants";
import { getActiveOrg } from "@/lib/server/organization";

/**
 * Resolves a user id to their active organization id. Returns null when the
 * user has no membership row yet (should not happen after ensure_default_org,
 * but we guard so the user-keyed wrappers degrade gracefully).
 */
async function resolveUserOrgId(userId: string): Promise<string | null> {
  const active = await getActiveOrg(userId);
  return active?.organization.id ?? null;
}

export const subscriptionService = {
  /**
   * Get the active org's subscription row. Org-scoped path used by Phase 4+.
   */
  async getOrgSubscription(
    organizationId: string
  ): Promise<{ data: DBSubscription | null; error: Error | null }> {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      return { data: null, error: error as Error };
    }
    return { data, error: null };
  },

  /**
   * Get-or-create the active org's subscription row. Pass the user id of the
   * inserting member so the legacy user_id column stays populated; that field
   * is only an attribution pointer now.
   */
  async getOrCreateOrgSubscription(
    organizationId: string,
    createdByUserId: string
  ): Promise<{ data: DBSubscription | null; error: Error | null }> {
    const { data: existing, error: fetchError } =
      await this.getOrgSubscription(organizationId);
    if (fetchError) {
      return { data: null, error: fetchError };
    }

    if (existing) {
      if (
        existing.status === "cancelled" &&
        existing.current_period_end &&
        new Date(existing.current_period_end) < new Date()
      ) {
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
          .eq("organization_id", organizationId)
          .select()
          .single();
        return { data: updated, error: updateError as Error | null };
      }
      return { data: existing, error: null };
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("subscriptions")
      .insert({
        organization_id: organizationId,
        user_id: createdByUserId,
        tier: "free",
        status: "active",
      } as DBSubscriptionInsert)
      .select()
      .single();
    return { data, error: error as Error | null };
  },

  /**
   * Update org subscription row by org id.
   */
  async updateOrgSubscription(
    organizationId: string,
    updates: DBSubscriptionUpdate
  ): Promise<{ data: DBSubscription | null; error: Error | null }> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("subscriptions")
      .update(updates)
      .eq("organization_id", organizationId)
      .select()
      .single();
    return { data, error: error as Error | null };
  },

  /**
   * True if the org's subscription is on the Pro tier. Honours the
   * cancellation grace period so members keep paid access through the
   * already-paid window after the owner cancels.
   */
  async isOrgPro(organizationId: string): Promise<boolean> {
    const { data } = await this.getOrgSubscription(organizationId);
    return getSubscriptionEntitlement({
      tier: data?.tier,
      status: data?.status,
      currentPeriodEnd: data?.current_period_end,
    }).isPro;
  },

  /**
   * Persist a Razorpay subscription entity against an org row.
   */
  async updateOrgFromRazorpaySubscription(
    razorpaySubscription: RazorpaySubscriptionEntity,
    organizationId: string,
    createdByUserId: string
  ): Promise<{ data: DBSubscription | null; error: Error | null }> {
    const supabase = getSupabaseAdmin();

    const currentPeriodStart = razorpaySubscription.current_start
      ? new Date(razorpaySubscription.current_start * 1000).toISOString()
      : undefined;
    const currentPeriodEnd = razorpaySubscription.current_end
      ? new Date(razorpaySubscription.current_end * 1000).toISOString()
      : undefined;

    // Tier respects the grace period for cancellations: a cancelled sub stays
    // on Pro until current_period_end so members keep access through the
    // already-paid window.
    const tier =
      isActiveProSubscriptionStatus(razorpaySubscription.status) ||
      isCancelledSubscriptionInGracePeriod({
        status: razorpaySubscription.status,
        currentPeriodEnd,
      })
        ? "pro"
        : "free";

    const billingCycle =
      (razorpaySubscription.notes?.billing_cycle as BillingCycle) || undefined;

    const updates: DBSubscriptionUpdate = {
      razorpay_subscription_id: razorpaySubscription.id,
      razorpay_customer_id: razorpaySubscription.customer_id,
      razorpay_plan_id: razorpaySubscription.plan_id,
      tier,
      billing_cycle: billingCycle,
      status: razorpaySubscription.status,
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
    };

    const { data: existing } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (existing) {
      const { data, error } = await supabase
        .from("subscriptions")
        .update(updates)
        .eq("organization_id", organizationId)
        .select()
        .single();
      return { data, error: error as Error | null };
    }

    const { data, error } = await supabase
      .from("subscriptions")
      .insert({
        organization_id: organizationId,
        user_id: createdByUserId,
        ...updates,
      } as DBSubscriptionInsert)
      .select()
      .single();
    return { data, error: error as Error | null };
  },

  /**
   * Get user's subscription record by routing through their active org.
   * Kept for back-compat with code paths that still pass userId.
   */
  async getUserSubscription(
    userId: string
  ): Promise<{ data: DBSubscription | null; error: Error | null }> {
    const orgId = await resolveUserOrgId(userId);
    if (!orgId) return { data: null, error: null };
    return this.getOrgSubscription(orgId);
  },

  /**
   * Back-compat: route legacy user-keyed callers through the active org.
   */
  async getOrCreateSubscription(
    userId: string
  ): Promise<{ data: DBSubscription | null; error: Error | null }> {
    const orgId = await resolveUserOrgId(userId);
    if (!orgId) return { data: null, error: null };
    return this.getOrCreateOrgSubscription(orgId, userId);
  },

  /**
   * Back-compat: route legacy user-keyed callers to the org row.
   */
  async updateSubscription(
    userId: string,
    updates: DBSubscriptionUpdate
  ): Promise<{ data: DBSubscription | null; error: Error | null }> {
    const orgId = await resolveUserOrgId(userId);
    if (!orgId) return { data: null, error: new Error("No active workspace for user") };
    return this.updateOrgSubscription(orgId, updates);
  },

  /**
   * Back-compat: route legacy user-keyed callers to the org row.
   */
  async updateFromRazorpaySubscription(
    razorpaySubscription: RazorpaySubscriptionEntity,
    userId: string
  ): Promise<{ data: DBSubscription | null; error: Error | null }> {
    const orgId = await resolveUserOrgId(userId);
    if (!orgId) return { data: null, error: new Error("No active workspace for user") };
    return this.updateOrgFromRazorpaySubscription(razorpaySubscription, orgId, userId);
  },

  /**
   * Handle subscription status changes from webhooks
   */
  async handleWebhookStatusChange(
    razorpaySubscriptionId: string,
    newStatus: RazorpaySubscriptionStatus
  ): Promise<{ data: DBSubscription | null; error: Error | null }> {
    const supabase = getSupabaseAdmin();

    const { data: existing, error: fetchError } = await supabase
      .from("subscriptions")
      .select("tier, current_period_end")
      .eq("razorpay_subscription_id", razorpaySubscriptionId)
      .maybeSingle();

    if (fetchError) {
      return { data: null, error: fetchError as Error };
    }

    const tier =
      isActiveProSubscriptionStatus(newStatus) ||
      isCancelledSubscriptionInGracePeriod({
        tier: existing?.tier,
        status: newStatus,
        currentPeriodEnd: existing?.current_period_end,
      })
        ? "pro"
        : "free";

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
   * Check if user is on pro tier (via their active workspace).
   */
  async isProUser(userId: string): Promise<boolean> {
    const orgId = await resolveUserOrgId(userId);
    if (!orgId) return false;
    return this.isOrgPro(orgId);
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
   * Store or update Razorpay customer ID for the user's active org row.
   */
  async updateRazorpayCustomerId(
    userId: string,
    razorpayCustomerId: string
  ): Promise<{ error: Error | null }> {
    const orgId = await resolveUserOrgId(userId);
    if (!orgId) return { error: new Error("No active workspace for user") };
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("subscriptions")
      .update({ razorpay_customer_id: razorpayCustomerId })
      .eq("organization_id", orgId);
    return { error: error as Error | null };
  },
};
