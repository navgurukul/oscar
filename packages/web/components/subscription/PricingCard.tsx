"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { PRICING, PRICING_USD } from "@/lib/constants";
import type {
  SubscriptionTier,
  BillingCycle,
} from "@/lib/types/subscription.types";
import type { Currency } from "@/lib/constants";

interface PricingCardProps {
  tier: SubscriptionTier;
  price: number;
  billingCycle: BillingCycle;
  features: string[];
  highlighted?: boolean;
  currentTier?: SubscriptionTier;
  currentStatus?: string;
  onSelect: () => void;
  isLoading?: boolean;
  currency?: Currency;
}

export function PricingCard({
  tier,
  price,
  billingCycle,
  features,
  highlighted = false,
  currentTier,
  currentStatus,
  onSelect,
  isLoading = false,
  currency = "INR",
}: PricingCardProps) {
  // A plan is current only if tiers match AND status is active
  // This prevents showing "Current Plan" for cancelled subscriptions
  const isCurrentPlan = tier === currentTier && currentStatus === "active";
  const isFree = tier === "free";
  const pricingConfig = currency === "USD" ? PRICING_USD : PRICING;
  const monthlyEquivalent =
    billingCycle === "yearly" && !isFree
      ? (pricingConfig.YEARLY / 12).toFixed(2)
      : null;
  const currencySymbol = currency === "USD" ? "$" : "₹";

  return (
    <Card
      className={cn(
        "relative bg-slate-900 rounded-2xl shadow-xl flex flex-col",
        highlighted
          ? "border-cyan-500/50 ring-1 ring-cyan-500/50"
          : "border-cyan-700/30"
      )}
    >
      {/* Popular badge */}
      {highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="px-3 py-1 text-xs font-medium bg-cyan-500 text-white rounded-full">
            Most Popular
          </span>
        </div>
      )}

      {/* Header */}
      <CardHeader>
        <div className="text-center">
          <h3 className="text-xl font-bold text-white mb-2">
            {tier === "free" ? "Free" : "Pro"}
          </h3>
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-4xl font-bold text-white">
              {isFree
                ? `${currencySymbol}0`
                : billingCycle === "yearly" && monthlyEquivalent
                ? `${currencySymbol}${monthlyEquivalent}`
                : `${currencySymbol}${price}`}
            </span>
            <span className="text-gray-400">/month</span>
          </div>
          {!isFree && billingCycle === "yearly" && (
            <>
              <p className="text-xs text-gray-500 mt-1">
                {currencySymbol}
                {price} billed annually
              </p>
              <p className="text-sm text-cyan-400 mt-1">
                Save {pricingConfig.YEARLY_SAVINGS_PERCENT}% vs monthly
              </p>
            </>
          )}
          {!isFree && currency === "USD" && (
            <p className="text-xs text-gray-500 mt-2">
              Charged in INR (₹
              {currency === "USD" && billingCycle === "monthly" ? "99" : "990"})
            </p>
          )}
        </div>
      </CardHeader>

      {/* Features */}
      <CardContent className="flex-grow flex flex-col">
        <ul className="space-y-3 mb-8 flex-grow">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start gap-3">
              <Check className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
              <span className="text-gray-300 text-sm">{feature}</span>
            </li>
          ))}
        </ul>

        {/* CTA Button */}
        <Button
          onClick={onSelect}
          disabled={isCurrentPlan || isLoading}
          className={cn(
            "w-full",
            highlighted
              ? "bg-cyan-500 hover:bg-cyan-600 text-white"
              : "bg-gray-800 hover:bg-gray-700 text-white",
            isCurrentPlan && "opacity-50 cursor-not-allowed"
          )}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Processing...
            </span>
          ) : isCurrentPlan ? (
            "Current Plan"
          ) : isFree ? (
            "Get Started"
          ) : (
            "Upgrade to Pro"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
