"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { PRICING, PRICING_USD } from "@/lib/constants";
import { v2, v2Serif } from "@/components/v2/V2Primitives";
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
  const isCurrentPlan = tier === currentTier && currentStatus === "active";
  const isFree = tier === "free";
  const pricingConfig = currency === "USD" ? PRICING_USD : PRICING;
  const monthlyEquivalent =
    billingCycle === "yearly" && !isFree
      ? (pricingConfig.YEARLY / 12).toFixed(2)
      : null;
  const currencySymbol = currency === "USD" ? "$" : "₹";

  const cardBg = highlighted ? v2.ink : v2.cream;
  const cardFg = highlighted ? v2.cream : v2.ink;
  const softFg = highlighted ? v2.accentSoft : v2.inkSoft;
  const faintFg = highlighted ? v2.accentSoft : v2.inkFaint;
  const borderColor = highlighted ? v2.ink : v2.rule;

  return (
    <Card
      className="relative rounded-2xl flex flex-col"
      style={{
        background: cardBg,
        color: cardFg,
        border: `1px solid ${borderColor}`,
        boxShadow: "0 1px 2px rgba(26,24,22,0.04)",
      }}
    >
      {highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span
            className="px-3 py-1 text-[10px] font-semibold rounded-full"
            style={{
              background: v2.accent,
              color: v2.cream,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            Most Popular
          </span>
        </div>
      )}

      <CardHeader>
        <div className="text-center">
          <h3
            className="mb-2"
            style={{
              fontFamily: v2Serif,
              fontSize: 24,
              fontWeight: 500,
              letterSpacing: "-0.015em",
              color: cardFg,
            }}
          >
            {tier === "free" ? "Free" : "Pro"}
          </h3>
          <div className="flex items-baseline justify-center gap-1">
            <span
              style={{
                fontFamily: v2Serif,
                fontSize: 40,
                fontWeight: 500,
                letterSpacing: "-0.02em",
                color: cardFg,
              }}
            >
              {isFree
                ? `${currencySymbol}0`
                : billingCycle === "yearly" && monthlyEquivalent
                ? `${currencySymbol}${monthlyEquivalent}`
                : `${currencySymbol}${price}`}
            </span>
            <span style={{ color: softFg }}>/month</span>
          </div>
          {!isFree && billingCycle === "yearly" && (
            <>
              <p className="text-xs mt-1" style={{ color: faintFg }}>
                {currencySymbol}
                {price} billed annually
              </p>
              <p className="text-sm mt-1" style={{ color: highlighted ? v2.accentSoft : v2.accent }}>
                Save {pricingConfig.YEARLY_SAVINGS_PERCENT}% vs monthly
              </p>
            </>
          )}
          {!isFree && currency === "USD" && (
            <p className="text-xs mt-2" style={{ color: faintFg }}>
              Charged in INR (₹
              {billingCycle === "monthly" ? PRICING.MONTHLY : PRICING.YEARLY})
            </p>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-grow flex flex-col">
        <ul className="space-y-3 mb-8 flex-grow">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start gap-3">
              <Check
                className="w-5 h-5 shrink-0 mt-0.5"
                style={{ color: highlighted ? v2.accentSoft : v2.accent }}
              />
              <span className="text-sm" style={{ color: cardFg }}>{feature}</span>
            </li>
          ))}
        </ul>

        <Button
          onClick={onSelect}
          disabled={isCurrentPlan || isLoading}
          className="w-full rounded-full"
          style={{
            background: highlighted ? v2.cream : v2.ink,
            color: highlighted ? v2.ink : v2.cream,
            opacity: isCurrentPlan ? 0.5 : 1,
            cursor: isCurrentPlan ? "not-allowed" : undefined,
          }}
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
