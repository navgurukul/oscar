"use client";

import { Crown, CreditCard, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { PRICING } from "@/lib/constants";

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
  if (!dateString) return "N/A";
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
  return (
    <Card className="bg-slate-900 border-cyan-700/30 rounded-2xl shadow-xl">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                isProUser ? "bg-cyan-500/20" : "bg-gray-800"
              }`}
            >
              <Crown
                className={`w-6 h-6 ${
                  isProUser ? "text-cyan-400" : "text-gray-400"
                }`}
              />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {isProUser ? "Pro Plan" : "Free Plan"}
              </h2>
              <p className="text-gray-400 text-sm">
                {isProUser
                  ? `₹${
                      billingCycle === "monthly"
                        ? PRICING.MONTHLY
                        : PRICING.YEARLY
                    }/${billingCycle === "monthly" ? "month" : "year"}`
                  : "No payment required"}
              </p>
            </div>
          </div>
          {isProUser && (
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                status === "active"
                  ? "bg-green-500/20 text-green-400"
                  : status === "cancelled"
                  ? "bg-yellow-500/20 text-yellow-400"
                  : "bg-red-500/20 text-red-400"
              }`}
            >
              {status === "active"
                ? "Active"
                : status === "cancelled"
                ? "Cancelling"
                : status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Subscription Details */}
        {isProUser && (
          <div className="space-y-3 mb-6 pb-6 border-b border-gray-800">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400 flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Billing cycle
              </span>
              <span className="text-white">
                {billingCycle === "monthly" ? "Monthly" : "Yearly"}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {status === "cancelled" ? "Access until" : "Next billing date"}
              </span>
              <span className="text-white">{formatDate(currentPeriodEnd)}</span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {isProUser ? (
            <>
              {status !== "cancelled" && (
                <Button
                  variant="outline"
                  onClick={onCancelClick}
                  className="border-gray-700 text-gray-300 hover:bg-gray-800"
                >
                  Cancel Subscription
                </Button>
              )}
            </>
          ) : (
            <Button
              onClick={onUpgradeClick}
              className="bg-cyan-500 hover:bg-cyan-600 text-white"
            >
              Upgrade to Pro
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
