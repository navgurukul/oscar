/**
 * Razorpay Webhook Handler
 * POST /api/razorpay/webhook
 *
 * Handles Razorpay webhook events for subscription lifecycle
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { razorpayService } from "@/lib/services/razorpay.service";
import { subscriptionService } from "@/lib/services/subscription.service";
import type {
  RazorpayWebhookPayload,
  RazorpaySubscriptionStatus,
  RazorpaySubscriptionEntity,
} from "@/lib/types/subscription.types";

/**
 * Get Supabase admin client for webhook processing
 */
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();

    // Get signature from header
    const signature = request.headers.get("x-razorpay-signature");

    if (!signature) {
      console.error("Missing webhook signature");
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    // Verify webhook signature
    const isValid = razorpayService.verifyWebhookSignature(rawBody, signature);

    if (!isValid) {
      console.error("Invalid webhook signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // Parse webhook payload
    const payload: RazorpayWebhookPayload = JSON.parse(rawBody);
    const eventId = `${payload.account_id}_${payload.created_at}`;
    const eventType = payload.event;

    console.log(`Processing webhook event: ${eventType} (${eventId})`);

    const supabase = getSupabaseAdmin();

    // Check for duplicate event (idempotency)
    const { data: existingEvent } = await supabase
      .from("webhook_events")
      .select("id, processed")
      .eq("razorpay_event_id", eventId)
      .single();

    if (existingEvent?.processed) {
      console.log(`Event ${eventId} already processed, skipping`);
      return NextResponse.json({ received: true });
    }

    // Store event for idempotency tracking
    if (!existingEvent) {
      await supabase.from("webhook_events").insert({
        razorpay_event_id: eventId,
        event_type: eventType,
        payload: payload as unknown as Record<string, unknown>,
        processed: false,
      });
    }

    try {
      // Process based on event type
      const subscription = payload.payload.subscription?.entity;

      if (!subscription) {
        console.log("No subscription entity in webhook payload");
        await markEventProcessed(supabase, eventId);
        return NextResponse.json({ received: true });
      }

      switch (eventType) {
        case "subscription.authenticated":
        case "subscription.activated":
          await handleSubscriptionActivated(subscription);
          break;

        case "subscription.charged":
          await handleSubscriptionCharged(subscription);
          break;

        case "subscription.cancelled":
          await handleSubscriptionCancelled(subscription);
          break;

        case "subscription.halted":
        case "subscription.pending":
          await handleSubscriptionFailed(subscription);
          break;

        case "subscription.paused":
          await handleSubscriptionPaused(subscription);
          break;

        case "subscription.resumed":
          await handleSubscriptionResumed(subscription);
          break;

        case "subscription.completed":
        case "subscription.expired":
          await handleSubscriptionEnded(subscription);
          break;

        default:
          console.log(`Unhandled event type: ${eventType}`);
      }

      // Mark event as processed
      await markEventProcessed(supabase, eventId);

      return NextResponse.json({ received: true });
    } catch (processingError) {
      console.error("Error processing webhook:", processingError);

      // Mark event with error
      await supabase
        .from("webhook_events")
        .update({
          error_message:
            processingError instanceof Error
              ? processingError.message
              : "Unknown error",
        })
        .eq("razorpay_event_id", eventId);

      // Still return 200 to prevent Razorpay from retrying
      // We'll handle failures manually
      return NextResponse.json({ received: true, error: "Processing failed" });
    }
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Mark webhook event as processed
 */
async function markEventProcessed(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  eventId: string
) {
  await supabase
    .from("webhook_events")
    .update({
      processed: true,
      processed_at: new Date().toISOString(),
    })
    .eq("razorpay_event_id", eventId);
}

/**
 * Handle subscription activated/authenticated
 */
async function handleSubscriptionActivated(
  subscription: RazorpaySubscriptionEntity
) {
  const userId = subscription.notes?.user_id;

  if (!userId) {
    console.error("No user_id in subscription notes");
    return;
  }

  await subscriptionService.updateFromRazorpaySubscription(
    subscription,
    userId
  );
  console.log(`Subscription activated for user ${userId}`);
}

/**
 * Handle subscription charged (recurring payment)
 */
async function handleSubscriptionCharged(
  subscription: RazorpaySubscriptionEntity
) {
  // Update current period dates
  const { data } = await subscriptionService.getByRazorpaySubscriptionId(
    subscription.id
  );

  if (data) {
    await subscriptionService.updateFromRazorpaySubscription(
      subscription,
      data.user_id
    );
    console.log(`Subscription charged for user ${data.user_id}`);
  }
}

/**
 * Handle subscription cancelled
 */
async function handleSubscriptionCancelled(
  subscription: RazorpaySubscriptionEntity
) {
  await subscriptionService.handleWebhookStatusChange(
    subscription.id,
    "cancelled" as RazorpaySubscriptionStatus
  );
  console.log(`Subscription cancelled: ${subscription.id}`);
}

/**
 * Handle subscription halted/pending (payment failed)
 */
async function handleSubscriptionFailed(
  subscription: RazorpaySubscriptionEntity
) {
  await subscriptionService.handleWebhookStatusChange(
    subscription.id,
    subscription.status
  );
  console.log(`Subscription payment failed: ${subscription.id}`);
}

/**
 * Handle subscription paused
 */
async function handleSubscriptionPaused(
  subscription: RazorpaySubscriptionEntity
) {
  await subscriptionService.handleWebhookStatusChange(
    subscription.id,
    "paused" as RazorpaySubscriptionStatus
  );
  console.log(`Subscription paused: ${subscription.id}`);
}

/**
 * Handle subscription resumed
 */
async function handleSubscriptionResumed(
  subscription: RazorpaySubscriptionEntity
) {
  await subscriptionService.handleWebhookStatusChange(
    subscription.id,
    "active" as RazorpaySubscriptionStatus
  );
  console.log(`Subscription resumed: ${subscription.id}`);
}

/**
 * Handle subscription completed/expired
 */
async function handleSubscriptionEnded(
  subscription: RazorpaySubscriptionEntity
) {
  await subscriptionService.handleWebhookStatusChange(
    subscription.id,
    subscription.status
  );
  console.log(`Subscription ended: ${subscription.id}`);
}
