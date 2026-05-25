"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { UsageIndicator } from "@/components/subscription/UsageIndicator";
import { useToast } from "@/hooks/use-toast";
import { vocabularyService } from "@/lib/services/vocabulary.service";
import { CurrentPlanCard } from "./CurrentPlanCard";
import { CancelSubscriptionModal } from "./CancelSubscriptionModal";
import { SUBSCRIPTION_CONFIG } from "@/lib/constants";
import { v2, v2Serif, V2Caps } from "@/components/v2/V2Primitives";

type SubscriptionStatus = "active" | "cancelled" | "expired" | "past_due";

interface BillingSectionProps {
  status: SubscriptionStatus;
  billingCycle: "monthly" | "yearly" | null;
  currentPeriodEnd: string | null;
  recordingsThisMonth: number;
  recordingsLimit: number | null;
  scribblesCount: number;
  scribblesLimit: number | null;
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
  scribblesCount,
  scribblesLimit,
  isProUser,
  isLoading,
  onRefetch,
}: BillingSectionProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [vocabularyCount, setVocabularyCount] = useState(0);

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
      const response = await fetch("/api/razorpay/cancel", { method: "POST" });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to cancel subscription");
      }
      toast({
        title: "Subscription cancelled",
        description: "Your subscription stays active until the end of the billing period.",
      });
      setShowCancelConfirm(false);
      onRefetch();
    } catch (error) {
      console.error("Cancel error:", error);
      toast({
        title: "Cancellation failed",
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
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: v2.accent }} />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-12">
        <CurrentPlanCard
          isProUser={isProUser}
          status={status}
          billingCycle={billingCycle}
          currentPeriodEnd={currentPeriodEnd}
          onCancelClick={() => setShowCancelConfirm(true)}
          onUpgradeClick={handleUpgradeClick}
        />

        {/* Usage */}
        <section
          className="grid grid-cols-12 gap-6 md:gap-10"
          style={{ borderTop: `1px solid ${v2.rule}`, paddingTop: 24 }}
        >
          <div className="col-span-12 md:col-span-3">
            <V2Caps>USAGE</V2Caps>
          </div>
          <div
            className="col-span-12 md:col-span-9 rounded-lg p-6 space-y-6"
            style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}
          >
            <UsageIndicator
              type="recordings"
              current={recordingsThisMonth}
              limit={recordingsLimit}
              variant="full"
            />
            <UsageIndicator
              type="scribbles"
              current={scribblesCount}
              limit={scribblesLimit}
              variant="full"
            />
            <UsageIndicator
              type="vocabulary"
              current={vocabularyCount}
              limit={isProUser ? null : SUBSCRIPTION_CONFIG.FREE_MAX_VOCABULARY}
              variant="full"
            />
          </div>
        </section>

        {/* Pro Benefits — for free users */}
        {!isProUser && (
          <section
            className="grid grid-cols-12 gap-6 md:gap-10"
            style={{ borderTop: `1px solid ${v2.rule}`, paddingTop: 24 }}
          >
            <div className="col-span-12 md:col-span-3">
              <V2Caps>WHY PRO</V2Caps>
            </div>
            <div
              className="col-span-12 md:col-span-9 rounded-lg p-7"
              style={{ background: v2.ink, color: v2.cream }}
            >
              <V2Caps color={v2.accentSoft}>WHAT YOU&rsquo;LL GET</V2Caps>
              <ul
                className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-[14px] list-none p-0"
                style={{ fontFamily: v2Serif }}
              >
                {[
                  "Unlimited Scribble recordings",
                  "Unlimited Scribbles",
                  "Unlimited vocabulary entries",
                  "Priority AI processing",
                  "Priority customer support",
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <span style={{ color: v2.accent, fontSize: 14 }}>·</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={handleUpgradeClick}
                className="mt-7 rounded-full px-5 py-2.5 text-[13px] font-medium"
                style={{ background: v2.cream, color: v2.ink }}
              >
                Upgrade to Pro
              </button>
            </div>
          </section>
        )}
      </div>

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
