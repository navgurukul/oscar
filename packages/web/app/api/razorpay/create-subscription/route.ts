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
import { getActiveOrg, getMemberRole } from "@/lib/server/organization";
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
    const rateLimitResult = await applyRateLimit(
      clientId,
      "payment-create-subscription",
      RATE_LIMITS.PAYMENT_CREATE_SUBSCRIPTION
    );
    if (rateLimitResult) return rateLimitResult;

    // Parse request body
    let body: CreateSubscriptionRequest;
    try {
      body = (await request.json()) as CreateSubscriptionRequest;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const planType =
      typeof body.planType === "string" ? body.planType : undefined;

    // Validate plan type
    if (!planType || !["monthly", "yearly"].includes(planType)) {
      return NextResponse.json(
        { error: "Invalid plan type. Must be 'monthly' or 'yearly'" },
        { status: 400 }
      );
    }

    const billingCycle: BillingCycle = planType;

    // Phase 4: subscriptions are org-scoped. Resolve the caller's active
    // workspace and gate on admin/owner role — only admins can attach a
    // payment plan to a workspace.
    const active = await getActiveOrg(user.id);
    if (!active) {
      return NextResponse.json(
        { error: "No active workspace" },
        { status: 400 }
      );
    }
    const role = await getMemberRole(user.id, active.organization.id);
    if (role !== "owner" && role !== "admin") {
      return NextResponse.json(
        { error: "Only workspace owners or admins can manage billing" },
        { status: 403 }
      );
    }

    // Get or create the org's subscription record
    const { data: subscription, error: subError } =
      await subscriptionService.getOrCreateOrgSubscription(active.organization.id, user.id);

    if (subError) {
      console.error("Error getting org subscription:", subError);
      return NextResponse.json(
        { error: "Failed to get subscription record" },
        { status: 500 }
      );
    }

    // Create a fresh Razorpay customer for the org and persist its id.
    const provisionCustomer = async (): Promise<string> => {
      const customer = await razorpayService.createCustomer(
        active.organization.name || user.email || "Workspace",
        user.email || ""
      );
      await subscriptionService.updateOrgSubscription(active.organization.id, {
        razorpay_customer_id: customer.id,
      });
      return customer.id;
    };

    // Get or create Razorpay customer (one customer per org)
    let razorpayCustomerId = subscription?.razorpay_customer_id;

    if (!razorpayCustomerId) {
      try {
        razorpayCustomerId = await provisionCustomer();
      } catch (error) {
        console.error("Error creating Razorpay customer:", error);
        return NextResponse.json(
          { error: "Failed to create customer" },
          { status: 500 }
        );
      }
    }

    // Create Razorpay subscription stamped with both org id and user id.
    //
    // A stored customer id can be orphaned when the Razorpay account/keys are
    // rotated — the old customer no longer exists under the new account and
    // Razorpay rejects the create with 400 "the id provided does not exist".
    // Detect that, mint a fresh customer, and retry once so the org self-heals
    // instead of being permanently wedged on a stale id.
    const createSub = (customerId: string) =>
      razorpayService.createSubscription(
        customerId,
        billingCycle,
        user.id,
        active.organization.id
      );

    try {
      let razorpaySubscription;
      try {
        razorpaySubscription = await createSub(razorpayCustomerId);
      } catch (error) {
        if (razorpayService.isCustomerNotFoundError(error)) {
          console.warn(
            `Stale Razorpay customer ${razorpayCustomerId} for org ${active.organization.id}; recreating and retrying.`
          );
          razorpayCustomerId = await provisionCustomer();
          razorpaySubscription = await createSub(razorpayCustomerId);
        } else {
          throw error;
        }
      }

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
