/**
 * Razorpay API Service
 * Server-side only - handles all Razorpay API interactions
 */

import Razorpay from "razorpay";
import crypto from "crypto";
import type {
  RazorpaySubscriptionEntity,
  BillingCycle,
} from "@/lib/types/subscription.types";

// Initialize Razorpay instance
const getRazorpayInstance = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error("Razorpay API keys not configured");
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
};

/**
 * Get the plan ID based on billing cycle
 */
const getPlanId = (billingCycle: BillingCycle): string => {
  const planId =
    billingCycle === "monthly"
      ? process.env.RAZORPAY_PLAN_MONTHLY
      : process.env.RAZORPAY_PLAN_YEARLY;

  if (!planId) {
    throw new Error(`Razorpay plan ID not configured for ${billingCycle}`);
  }

  return planId;
};

export const razorpayService = {
  /**
   * Create a Razorpay customer
   */
  async createCustomer(
    name: string,
    email: string,
    contact?: string
  ): Promise<{ id: string }> {
    const razorpay = getRazorpayInstance();

    const customer = await razorpay.customers.create({
      name,
      email,
      contact: contact || undefined,
      fail_existing: 0, // Return existing customer if email matches
    });

    return { id: customer.id };
  },

  /**
   * Create a subscription for a customer
   */
  async createSubscription(
    customerId: string,
    billingCycle: BillingCycle,
    userId: string
  ): Promise<RazorpaySubscriptionEntity> {
    const razorpay = getRazorpayInstance();
    const planId = getPlanId(billingCycle);

    // Use type assertion to handle Razorpay SDK type limitations
    const subscriptionOptions = {
      plan_id: planId,
      customer_id: customerId,
      quantity: 1,
      total_count: billingCycle === "monthly" ? 12 : 1, // 12 months or 1 year
      customer_notify: 1,
      notes: {
        user_id: userId,
        billing_cycle: billingCycle,
      },
    } as Parameters<typeof razorpay.subscriptions.create>[0];

    const subscription = await razorpay.subscriptions.create(
      subscriptionOptions
    );

    return subscription as unknown as RazorpaySubscriptionEntity;
  },

  /**
   * Fetch subscription details from Razorpay
   */
  async fetchSubscription(
    subscriptionId: string
  ): Promise<RazorpaySubscriptionEntity> {
    const razorpay = getRazorpayInstance();
    const subscription = await razorpay.subscriptions.fetch(subscriptionId);
    return subscription as unknown as RazorpaySubscriptionEntity;
  },

  /**
   * Cancel a subscription at period end
   */
  async cancelSubscription(
    subscriptionId: string,
    cancelAtCycleEnd: boolean = true
  ): Promise<RazorpaySubscriptionEntity> {
    const razorpay = getRazorpayInstance();
    const subscription = await razorpay.subscriptions.cancel(
      subscriptionId,
      cancelAtCycleEnd
    );
    return subscription as unknown as RazorpaySubscriptionEntity;
  },

  /**
   * Verify payment signature after checkout
   * Signature = HMAC-SHA256(razorpay_payment_id|razorpay_subscription_id, key_secret)
   */
  verifyPaymentSignature(
    razorpayPaymentId: string,
    razorpaySubscriptionId: string,
    razorpaySignature: string
  ): boolean {
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keySecret) {
      throw new Error("Razorpay key secret not configured");
    }

    const generatedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(`${razorpayPaymentId}|${razorpaySubscriptionId}`)
      .digest("hex");

    return generatedSignature === razorpaySignature;
  },

  /**
   * Verify webhook signature
   * Signature = HMAC-SHA256(request_body, webhook_secret)
   */
  verifyWebhookSignature(body: string, signature: string): boolean {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      throw new Error("Razorpay webhook secret not configured");
    }

    const generatedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(body)
      .digest("hex");

    return generatedSignature === signature;
  },

  /**
   * Get the public key ID for client-side
   */
  getPublicKeyId(): string {
    const keyId = process.env.RAZORPAY_KEY_ID;
    if (!keyId) {
      throw new Error("Razorpay key ID not configured");
    }
    return keyId;
  },
};
