"use client";

import { PRICING } from "@/lib/constants";
import { v2, v2Serif, V2Caps, V2Mono } from "@/components/v2/V2Primitives";

type SubscriptionStatus = "active" | "cancelled" | "expired" | "past_due";

interface CurrentPlanCardProps {
  isProUser: boolean;
  status: SubscriptionStatus;
  billingCycle: "monthly" | "yearly" | null;
  currentPeriodEnd: string | null;
  onCancelClick: () => void;
  onUpgradeClick: () => void;
}

function formatDate(dateString: string | null) {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function CurrentPlanCard({
  isProUser,
  status,
  billingCycle,
  currentPeriodEnd,
  onCancelClick,
  onUpgradeClick,
}: CurrentPlanCardProps) {
  const statusLabel =
    status === "active"
      ? "ACTIVE"
      : status === "cancelled"
      ? "CANCELLING"
      : status.toUpperCase();
  const statusColor =
    status === "active" ? v2.accent : status === "cancelled" ? v2.danger : v2.danger;

  return (
    <section
      className="grid grid-cols-12 gap-6 md:gap-10"
      style={{ borderTop: `1px solid ${v2.rule}`, paddingTop: 24 }}
    >
      <div className="col-span-12 md:col-span-3">
        <V2Caps>CURRENT PLAN</V2Caps>
      </div>
      <div
        className="col-span-12 md:col-span-9 rounded-lg p-7"
        style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <V2Caps color={isProUser ? v2.accent : v2.inkFaint}>
              {isProUser ? `PRO · ${(billingCycle ?? "monthly").toUpperCase()}` : "FREE"}
            </V2Caps>
            <div className="mt-2 flex items-baseline gap-3 flex-wrap">
              <span
                style={{
                  fontFamily: v2Serif,
                  fontSize: 48,
                  fontWeight: 500,
                  letterSpacing: "-0.025em",
                }}
              >
                {isProUser
                  ? `₹${billingCycle === "monthly" ? PRICING.MONTHLY : PRICING.YEARLY}`
                  : "₹0"}
              </span>
              <span style={{ fontSize: 13, color: v2.inkSoft }}>
                {isProUser
                  ? `per ${billingCycle === "monthly" ? "month" : "year"}`
                  : "forever"}
              </span>
            </div>
            {isProUser ? (
              <p className="mt-3 text-[13px]" style={{ color: v2.inkSoft }}>
                {status === "cancelled" ? "Access until" : "Next billing date"} ·{" "}
                <span style={{ color: v2.ink }}>{formatDate(currentPeriodEnd)}</span>
              </p>
            ) : (
              <p className="mt-3 text-[13px]" style={{ color: v2.inkSoft, maxWidth: 400 }}>
                Enough to feel the difference. Upgrade for unlimited.
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {isProUser ? (
              <V2Caps color={statusColor}>{statusLabel}</V2Caps>
            ) : (
              <button
                onClick={onUpgradeClick}
                className="text-[12px] rounded-full px-4 py-2 font-medium"
                style={{ background: v2.ink, color: v2.cream }}
              >
                Upgrade to Pro
              </button>
            )}
          </div>
        </div>

        {isProUser && status !== "cancelled" && (
          <div
            className="mt-7 pt-5 flex items-center justify-between flex-wrap gap-3"
            style={{ borderTop: `1px solid ${v2.rule}` }}
          >
            <V2Mono style={{ fontSize: 11, color: v2.inkFaint }}>
              Renews automatically — cancel anytime.
            </V2Mono>
            <button
              onClick={onCancelClick}
              className="text-[12px] rounded-full px-4 py-2"
              style={{ border: "1px solid #d6b3a8", color: "#8c2f25" }}
            >
              Cancel subscription
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
