/**
 * Razorpay Webhook Handler
 * POST /api/razorpay/webhook
 *
 * Handles Razorpay webhook events for subscription lifecycle
 */

import { NextRequest, NextResponse } from "next/server";
import { razorpayService } from "@/lib/services/razorpay.service";
import { subscriptionService } from "@/lib/services/subscription.service";
import {
  applyRateLimit,
  getClientIdentifier,
} from "@/lib/middleware/rate-limit";
import { RATE_LIMITS } from "@/lib/constants";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { getActiveOrg } from "@/lib/server/organization";
import type {
  RazorpayWebhookPayload,
  RazorpaySubscriptionStatus,
  RazorpaySubscriptionEntity,
} from "@/lib/types/subscription.types";

/**
 * Determines which org + user owns a Razorpay subscription event.
 * Reads `organization_id` from the notes when present (Phase 4+ subs), falls
 * back to looking up the user's active org for legacy subs that only carry
 * `user_id`.
 */
async function resolveSubscriptionOwners(
  subscription: RazorpaySubscriptionEntity
): Promise<{ organizationId: string | null; userId: string | null }> {
  const orgId = subscription.notes?.organization_id ?? null;
  const userId = subscription.notes?.user_id ?? null;
  if (orgId) {
    return { organizationId: orgId, userId };
  }
  if (userId) {
    const active = await getActiveOrg(userId);
    return { organizationId: active?.organization.id ?? null, userId };
  }
  return { organizationId: null, userId: null };
}

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting based on IP to prevent DoS attacks
    // Note: Legitimate Razorpay webhooks should never hit this limit
    const clientId = getClientIdentifier(undefined, request);
    const rateLimitResult = await applyRateLimit(
      clientId,
      "payment-webhook",
      RATE_LIMITS.PAYMENT_WEBHOOK
    );
    if (rateLimitResult) return rateLimitResult;
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
    // Use Razorpay's own unique event ID as the idempotency key.
    // The previous `account_id + created_at` composite had second-level
    // granularity and could collide when two events fired in the same second.
    const eventId = payload.id;
    const eventType = payload.event;

    console.log(`Processing webhook event: ${eventType} (${eventId})`);

    const supabase = getSupabaseAdmin();

    // Check for duplicate event (idempotency)
    const existingEventResult = await supabase
      .from("webhook_events")
      .select("id, processed")
      .eq("razorpay_event_id", eventId)
      .single();
    const existingEvent = existingEventResult.data as
      | { id: string; processed: boolean }
      | null;

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
  const { organizationId, userId } = await resolveSubscriptionOwners(subscription);
  if (!organizationId) {
    console.error(
      "[webhook] activated: could not resolve organization for subscription",
      subscription.id
    );
    return;
  }

  await subscriptionService.updateOrgFromRazorpaySubscription(
    subscription,
    organizationId,
    userId ?? ""
  );
  console.log(`Subscription activated for org ${organizationId}`);
}

/**
 * Handle subscription charged (recurring payment)
 */
async function handleSubscriptionCharged(
  subscription: RazorpaySubscriptionEntity
) {
  // Look up our local row to discover the org id (which is the authoritative
  // pointer in Phase 4). Fall back to notes for newly-created subs that have
  // not been mirrored yet.
  const { data: localRow } = await subscriptionService.getByRazorpaySubscriptionId(
    subscription.id
  );

  let organizationId = localRow?.organization_id ?? null;
  let userId = localRow?.user_id ?? null;
  if (!organizationId) {
    const resolved = await resolveSubscriptionOwners(subscription);
    organizationId = resolved.organizationId;
    userId = resolved.userId ?? userId;
  }
  if (!organizationId) {
    console.error(
      "[webhook] charged: could not resolve organization for subscription",
      subscription.id
    );
    return;
  }

  await subscriptionService.updateOrgFromRazorpaySubscription(
    subscription,
    organizationId,
    userId ?? ""
  );
  console.log(`Subscription charged for org ${organizationId}`);
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
