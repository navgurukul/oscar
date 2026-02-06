"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { UsageIndicator } from "@/components/subscription/UsageIndicator";
import { useToast } from "@/hooks/use-toast";
import { vocabularyService } from "@/lib/services/vocabulary.service";
import { CurrentPlanCard } from "./CurrentPlanCard";
import { CancelSubscriptionModal } from "./CancelSubscriptionModal";
import { PRICING, SUBSCRIPTION_CONFIG } from "@/lib/constants";

type SubscriptionStatus = "active" | "cancelled" | "expired" | "past_due";

interface BillingSectionProps {
  status: SubscriptionStatus;
  billingCycle: "monthly" | "yearly" | null;
  currentPeriodEnd: string | null;
  recordingsThisMonth: number;
  recordingsLimit: number | null;
  notesCount: number;
  notesLimit: number | null;
  isProUser: boolean;
  isLoading: boolean;
  onRefetch: () => void;
}

export function BillingSection({
  status,
  billingCycle,
  currentPeriodEnd,
  recordingsThisMonth,
  recordingsLimit,
  notesCount,
  notesLimit,
  isProUser,
  isLoading,
  onRefetch,
}: BillingSectionProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [vocabularyCount, setVocabularyCount] = useState(0);

  // Fetch vocabulary count on mount
  useEffect(() => {
    async function fetchVocabularyCount() {
      const { count } = await vocabularyService.getVocabularyCount();
      setVocabularyCount(count || 0);
    }
    fetchVocabularyCount();
  }, []);

  const handleCancelSubscription = useCallback(async () => {
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
      onRefetch();
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
  }, [onRefetch, toast]);

  const handleUpgradeClick = useCallback(() => {
    router.push("/pricing");
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Current Plan Card */}
        <CurrentPlanCard
          isProUser={isProUser}
          status={status}
          billingCycle={billingCycle}
          currentPeriodEnd={currentPeriodEnd}
          onCancelClick={() => setShowCancelConfirm(true)}
          onUpgradeClick={handleUpgradeClick}
        />

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
              <UsageIndicator
                type="vocabulary"
                current={vocabularyCount}
                limit={isProUser ? null : SUBSCRIPTION_CONFIG.FREE_MAX_VOCABULARY}
                variant="full"
              />
            </div>
          </CardContent>
        </Card>

        {/* Pro Benefits (for free users) */}
        {!isProUser && (
          <Card className="bg-slate-900 border-cyan-500/50 rounded-2xl shadow-xl ring-1 ring-cyan-500/50">
            <CardHeader>
              <h2 className="text-lg font-bold text-white">Why Upgrade to Pro?</h2>
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
                  Unlimited vocabulary entries
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
                onClick={handleUpgradeClick}
                className="w-full bg-cyan-500 hover:bg-cyan-600 text-white"
              >
                Upgrade Now - Starting at ₹{PRICING.MONTHLY}/month
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Cancel Confirmation Modal */}
      <CancelSubscriptionModal
        isOpen={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        onConfirm={handleCancelSubscription}
        isLoading={isCancelling}
        periodEnd={currentPeriodEnd}
      />
    </>
  );
}

export default BillingSection;
