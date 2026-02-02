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

      // Update subscription in database
      const { data: updatedSubscription, error: updateError } =
        await subscriptionService.updateFromRazorpaySubscription(
          razorpaySubscription,
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
