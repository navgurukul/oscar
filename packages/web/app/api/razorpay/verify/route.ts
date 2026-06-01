/**
 * Verify Payment API Route
 * POST /api/razorpay/verify
 *
 * Verifies payment signature after Razorpay checkout
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
import type { VerifyPaymentRequest } from "@/lib/types/subscription.types";

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

    const rateLimitResult = await applyRateLimit(
      getClientIdentifier(user.id, request),
      "payment-verify",
      RATE_LIMITS.PAYMENT_VERIFY
    );
    if (rateLimitResult) return rateLimitResult;

    // Parse request body
    const body: VerifyPaymentRequest = await request.json();
    const {
      razorpay_payment_id,
      razorpay_subscription_id,
      razorpay_signature,
    } = body;

    // Validate required fields
    if (
      !razorpay_payment_id ||
      !razorpay_subscription_id ||
      !razorpay_signature
    ) {
      return NextResponse.json(
        { error: "Missing required payment verification fields" },
        { status: 400 }
      );
    }

    // Verify signature
    const isValid = razorpayService.verifyPaymentSignature(
      razorpay_payment_id,
      razorpay_subscription_id,
      razorpay_signature
    );

    if (!isValid) {
      console.error("Invalid payment signature");
      return NextResponse.json(
        { error: "Invalid payment signature" },
        { status: 400 }
      );
    }

    // Fetch subscription details from Razorpay
    try {
      const razorpaySubscription = await razorpayService.fetchSubscription(
        razorpay_subscription_id
      );

      // Phase 4 ownership check: prefer the workspace id baked into the
      // subscription notes, fall back to user_id for legacy subs. Either way
      // the caller must be a member of the workspace that owns the sub.
      const noteOrgId = razorpaySubscription.notes?.organization_id;
      const noteUserId = razorpaySubscription.notes?.user_id;
      let organizationId: string | null = null;

      if (noteOrgId) {
        const { getMemberRole } = await import("@/lib/server/organization");
        const role = await getMemberRole(user.id, noteOrgId);
        if (!role) {
          console.error(
            `Verify mismatch: subscription ${razorpay_subscription_id} belongs to org ${noteOrgId} but user ${user.id} is not a member`
          );
          return NextResponse.json(
            { error: "Subscription does not belong to your workspace" },
            { status: 403 }
          );
        }
        organizationId = noteOrgId;
      } else {
        if (!noteUserId || noteUserId !== user.id) {
          console.error(
            `Verify mismatch: subscription ${razorpay_subscription_id} legacy user ${noteUserId}, caller ${user.id}`
          );
          return NextResponse.json(
            { error: "Subscription does not belong to this account" },
            { status: 403 }
          );
        }
        const { getActiveOrg } = await import("@/lib/server/organization");
        const active = await getActiveOrg(user.id);
        organizationId = active?.organization.id ?? null;
      }

      if (!organizationId) {
        return NextResponse.json(
          { error: "Unable to resolve workspace for subscription" },
          { status: 400 }
        );
      }

      // Update subscription in database
      const { data: updatedSubscription, error: updateError } =
        await subscriptionService.updateOrgFromRazorpaySubscription(
          razorpaySubscription,
          organizationId,
          user.id
        );

      if (updateError) {
        console.error("Error updating subscription:", updateError);
        return NextResponse.json(
          { error: "Failed to update subscription" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Payment verified successfully",
        subscription: updatedSubscription,
      });
    } catch (error) {
      console.error("Error fetching subscription from Razorpay:", error);
      return NextResponse.json(
        { error: "Failed to verify subscription" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Payment verification error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
