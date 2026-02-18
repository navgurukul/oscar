/**
 * Create Subscription API Route
 * POST /api/razorpay/create-subscription
 *
 * Creates a Razorpay subscription for the authenticated user
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { razorpayService } from "@/lib/services/razorpay.service";
import { subscriptionService } from "@/lib/services/subscription.service";
import {
  applyRateLimit,
  getClientIdentifier,
} from "@/lib/middleware/rate-limit";
import { RATE_LIMITS } from "@/lib/constants";
import type {
  CreateSubscriptionRequest,
  CreateSubscriptionResponse,
  BillingCycle,
} from "@/lib/types/subscription.types";

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Apply rate limiting - prevent subscription spam
    const clientId = getClientIdentifier(user.id, request);
    const rateLimitResult = applyRateLimit(
      clientId,
      "payment-create-subscription",
      RATE_LIMITS.PAYMENT_CREATE_SUBSCRIPTION
    );
    if (rateLimitResult) return rateLimitResult;

    // Parse request body
    const body: CreateSubscriptionRequest = await request.json();
    const { planType } = body;

    // Validate plan type
    if (!planType || !["monthly", "yearly"].includes(planType)) {
      return NextResponse.json(
        { error: "Invalid plan type. Must be 'monthly' or 'yearly'" },
        { status: 400 }
      );
    }

    const billingCycle: BillingCycle = planType;

    // Get or create subscription record
    const { data: subscription, error: subError } =
      await subscriptionService.getOrCreateSubscription(user.id);

    if (subError) {
      console.error("Error getting subscription:", subError);
      return NextResponse.json(
        { error: "Failed to get subscription record" },
        { status: 500 }
      );
    }

    // Get or create Razorpay customer
    let razorpayCustomerId = subscription?.razorpay_customer_id;

    if (!razorpayCustomerId) {
      try {
        const customer = await razorpayService.createCustomer(
          user.email || "User",
          user.email || ""
        );
        razorpayCustomerId = customer.id;

        // Store customer ID
        await subscriptionService.updateRazorpayCustomerId(
          user.id,
          razorpayCustomerId
        );
      } catch (error) {
        console.error("Error creating Razorpay customer:", error);
        return NextResponse.json(
          { error: "Failed to create customer" },
          { status: 500 }
        );
      }
    }

    // Create Razorpay subscription
    try {
      const razorpaySubscription = await razorpayService.createSubscription(
        razorpayCustomerId,
        billingCycle,
        user.id
      );

      const response: CreateSubscriptionResponse = {
        subscriptionId: razorpaySubscription.id,
        razorpayKeyId: razorpayService.getPublicKeyId(),
      };

      return NextResponse.json(response);
    } catch (error) {
      console.error("Error creating Razorpay subscription:", error);
      return NextResponse.json(
        { error: "Failed to create subscription" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Create subscription error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
