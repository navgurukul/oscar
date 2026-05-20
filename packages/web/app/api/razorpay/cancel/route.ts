/**
 * Cancel Subscription API Route
 * POST /api/razorpay/cancel
 *
 * Cancels the user's subscription at period end
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { razorpayService } from "@/lib/services/razorpay.service";
import { subscriptionService } from "@/lib/services/subscription.service";
import { getActiveOrg, getMemberRole } from "@/lib/server/organization";

export async function POST() {
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

    // Phase 4: gate cancellation behind workspace admin/owner role.
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
        { error: "Only workspace owners or admins can cancel billing" },
        { status: 403 }
      );
    }

    // Get the org's subscription
    const { data: subscription, error: subError } =
      await subscriptionService.getOrgSubscription(active.organization.id);

    if (subError) {
      console.error("Error fetching subscription:", subError);
      return NextResponse.json(
        { error: "Failed to fetch subscription" },
        { status: 500 }
      );
    }

    if (!subscription) {
      return NextResponse.json(
        { error: "No subscription found" },
        { status: 404 }
      );
    }

    if (!subscription.razorpay_subscription_id) {
      return NextResponse.json(
        { error: "No active Razorpay subscription to cancel" },
        { status: 400 }
      );
    }

    if (subscription.tier === "free") {
      return NextResponse.json(
        { error: "You are on the free tier" },
        { status: 400 }
      );
    }

    // Cancel subscription at period end
    try {
      await razorpayService.cancelSubscription(
        subscription.razorpay_subscription_id,
        true // Cancel at cycle end
      );

      // Update the org subscription status
      await subscriptionService.updateOrgSubscription(active.organization.id, {
        status: "cancelled",
      });

      return NextResponse.json({
        success: true,
        message:
          "Subscription will be cancelled at the end of the billing period",
        currentPeriodEnd: subscription.current_period_end,
      });
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      return NextResponse.json(
        { error: "Failed to cancel subscription" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Cancel subscription error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
