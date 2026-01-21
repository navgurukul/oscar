"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useSubscriptionContext } from "@/lib/contexts/SubscriptionContext";
import { UsageIndicator } from "@/components/subscription/UsageIndicator";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { PRICING } from "@/lib/constants";
import {
  Crown,
  CreditCard,
  Calendar,
  AlertTriangle,
  Check,
  Loader2,
} from "lucide-react";

export default function BillingPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const {
    status,
    billingCycle,
    currentPeriodEnd,
    recordingsThisMonth,
    recordingsLimit,
    notesCount,
    notesLimit,
    isProUser,
    isLoading: subscriptionLoading,
    refetch,
  } = useSubscriptionContext();

  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Redirect to auth if not logged in
  if (!authLoading && !user) {
    router.push("/auth?redirectTo=/billing");
    return null;
  }

  const isLoading = authLoading || subscriptionLoading;

  const handleCancelSubscription = async () => {
    setIsCancelling(true);

    try {
      const response = await fetch("/api/razorpay/cancel", {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to cancel subscription");
      }

      toast({
        title: "Subscription Cancelled",
        description:
          "Your subscription will remain active until the end of the billing period.",
      });

      setShowCancelConfirm(false);
      refetch();
    } catch (error) {
      console.error("Cancel error:", error);
      toast({
        title: "Cancellation Failed",
        description:
          error instanceof Error ? error.message : "Please try again later",
        variant: "destructive",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Billing & Subscription
          </h1>
          <p className="text-gray-400">
            Manage your subscription and view usage
          </p>
        </div>

        {/* Current Plan Card */}
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
                    {status === "cancelled"
                      ? "Access until"
                      : "Next billing date"}
                  </span>
                  <span className="text-white">
                    {formatDate(currentPeriodEnd)}
                  </span>
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
                      onClick={() => setShowCancelConfirm(true)}
                      className="border-gray-700 text-gray-300 hover:bg-gray-800"
                    >
                      Cancel Subscription
                    </Button>
                  )}
                </>
              ) : (
                <Button
                  onClick={() => router.push("/pricing")}
                  className="bg-cyan-500 hover:bg-cyan-600 text-white"
                >
                  Upgrade to Pro
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Usage Stats */}
        <Card className="bg-slate-900 border-cyan-700/30 rounded-2xl shadow-xl">
          <CardHeader>
            <h2 className="text-lg font-bold text-white">Usage</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <UsageIndicator
                type="recordings"
                current={recordingsThisMonth}
                limit={recordingsLimit}
                variant="full"
              />
              <UsageIndicator
                type="notes"
                current={notesCount}
                limit={notesLimit}
                variant="full"
              />
            </div>
          </CardContent>
        </Card>

        {/* Pro Benefits (for free users) */}
        {!isProUser && (
          <Card className="bg-slate-900 border-cyan-500/50 rounded-2xl shadow-xl ring-1 ring-cyan-500/50">
            <CardHeader>
              <h2 className="text-lg font-bold text-white">
                Why Upgrade to Pro?
              </h2>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 mb-6">
                <li className="flex items-center gap-3 text-gray-300">
                  <Check className="w-5 h-5 text-cyan-400" />
                  Unlimited recordings every month
                </li>
                <li className="flex items-center gap-3 text-gray-300">
                  <Check className="w-5 h-5 text-cyan-400" />
                  Store unlimited notes forever
                </li>
                <li className="flex items-center gap-3 text-gray-300">
                  <Check className="w-5 h-5 text-cyan-400" />
                  Priority AI processing
                </li>
                <li className="flex items-center gap-3 text-gray-300">
                  <Check className="w-5 h-5 text-cyan-400" />
                  Priority customer support
                </li>
              </ul>
              <Button
                onClick={() => router.push("/pricing")}
                className="w-full bg-cyan-500 hover:bg-cyan-600 text-white"
              >
                Upgrade Now - Starting at ₹{PRICING.MONTHLY}/month
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Cancel Confirmation Modal */}
        {showCancelConfirm && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <Card className="bg-slate-900 border-cyan-700/30 rounded-2xl shadow-xl max-w-md w-full">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 text-yellow-400" />
                  </div>
                  <h2 className="text-xl font-bold text-white">
                    Cancel Subscription?
                  </h2>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400 mb-6">
                  Are you sure you want to cancel? You&apos;ll lose access to Pro
                  features at the end of your billing period on{" "}
                  <span className="text-white">
                    {formatDate(currentPeriodEnd)}
                  </span>
                  .
                </p>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowCancelConfirm(false)}
                    className="flex-1 border-gray-700"
                    disabled={isCancelling}
                  >
                    Keep Subscription
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleCancelSubscription}
                    className="flex-1"
                    disabled={isCancelling}
                  >
                    {isCancelling ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Yes, Cancel"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </main>
  );
}
