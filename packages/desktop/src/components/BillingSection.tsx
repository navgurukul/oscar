import { useState, useEffect, useCallback } from "react";
import { CreditCard, Check, Loader2, Calendar, Zap, Crown } from "lucide-react";
import { supabase } from "../supabase";
import { openUrl } from "@tauri-apps/plugin-opener";

type SubscriptionStatus = "active" | "cancelled" | "expired" | "past_due" | null;

interface BillingSectionProps {
  userId: string;
  userEmail: string;
}

interface SubscriptionData {
  status: SubscriptionStatus;
  billingCycle: "monthly" | "yearly" | null;
  currentPeriodEnd: string | null;
  recordingsThisMonth: number;
  recordingsLimit: number | null;
  vocabularyCount: number;
  vocabularyLimit: number | null;
}

const FREE_RECORDINGS_LIMIT = 50;
const FREE_VOCABULARY_LIMIT = 5;
const PRO_RECORDINGS_LIMIT = 1000;
const PRO_VOCABULARY_LIMIT = 50;

export function BillingSection({ userId, userEmail }: BillingSectionProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionData>({
    status: null,
    billingCycle: null,
    currentPeriodEnd: null,
    recordingsThisMonth: 0,
    recordingsLimit: FREE_RECORDINGS_LIMIT,
    vocabularyCount: 0,
    vocabularyLimit: FREE_VOCABULARY_LIMIT,
  });
  const [isUpgrading, setIsUpgrading] = useState(false);

  useEffect(() => {
    loadSubscriptionData();
  }, [userId]);

  const loadSubscriptionData = async () => {
    setIsLoading(true);
    try {
      // Get subscription status
      const { data: subData } = await supabase
        .from("subscriptions")
        .select("status, billing_cycle, current_period_end")
        .eq("user_id", userId)
        .maybeSingle();

      // Get recordings count for this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      const { count: recordingsCount } = await supabase
        .from("recordings")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", startOfMonth.toISOString());

      // Get vocabulary count
      const { count: vocabCount } = await supabase
        .from("user_vocabulary")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      const isPro = subData?.status === "active";

      setSubscription({
        status: subData?.status || null,
        billingCycle: subData?.billing_cycle || null,
        currentPeriodEnd: subData?.current_period_end || null,
        recordingsThisMonth: recordingsCount || 0,
        recordingsLimit: isPro ? PRO_RECORDINGS_LIMIT : FREE_RECORDINGS_LIMIT,
        vocabularyCount: vocabCount || 0,
        vocabularyLimit: isPro ? PRO_VOCABULARY_LIMIT : FREE_VOCABULARY_LIMIT,
      });
    } catch (e) {
      console.error("Failed to load subscription data:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpgrade = useCallback(async () => {
    setIsUpgrading(true);
    try {
      // Open pricing page in browser
      await openUrl("https://oscar-ai.app/pricing");
    } catch (e) {
      console.error("Failed to open pricing:", e);
    } finally {
      setIsUpgrading(false);
    }
  }, []);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getUsagePercentage = (current: number, limit: number | null) => {
    if (!limit) return 0;
    return Math.min((current / limit) * 100, 100);
  };

  const isProUser = subscription.status === "active";

  if (isLoading) {
    return (
      <div className="billing-section loading">
        <Loader2 size={32} className="spin" />
      </div>
    );
  }

  return (
    <div className="billing-section">
      {/* Current Plan Card */}
      <div className={`plan-card ${isProUser ? "pro" : "free"}`}>
        <div className="plan-header">
          <div className="plan-icon">
            {isProUser ? <Crown size={24} /> : <Zap size={24} />}
          </div>
          <div className="plan-info">
            <h3>{isProUser ? "Pro Plan" : "Free Plan"}</h3>
            {isProUser && subscription.billingCycle && (
              <span className="plan-badge">{subscription.billingCycle}</span>
            )}
          </div>
        </div>

        {isProUser ? (
          <div className="plan-details">
            <div className="plan-detail">
              <Calendar size={16} />
              <span>Renews on {formatDate(subscription.currentPeriodEnd)}</span>
            </div>
            <div className="plan-status active">
              <Check size={14} />
              Active
            </div>
          </div>
        ) : (
          <div className="plan-details">
            <p className="plan-description">
              Upgrade to Pro for unlimited recordings, vocabulary entries, and priority AI processing.
            </p>
            <button
              className="upgrade-btn"
              onClick={handleUpgrade}
              disabled={isUpgrading}
            >
              {isUpgrading ? (
                <>
                  <Loader2 size={16} className="spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Crown size={16} />
                  Upgrade to Pro
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Usage Stats */}
      <div className="usage-card">
        <h4>
          <CreditCard size={18} />
          Usage This Month
        </h4>

        <div className="usage-items">
          {/* Recordings Usage */}
          <div className="usage-item">
            <div className="usage-header">
              <span className="usage-label">Recordings</span>
              <span className="usage-value">
                {subscription.recordingsThisMonth} / {subscription.recordingsLimit === PRO_RECORDINGS_LIMIT ? "Unlimited" : subscription.recordingsLimit}
              </span>
            </div>
            <div className="usage-bar">
              <div
                className={`usage-fill ${getUsagePercentage(subscription.recordingsThisMonth, subscription.recordingsLimit) > 80 ? "warning" : ""}`}
                style={{
                  width: `${getUsagePercentage(subscription.recordingsThisMonth, subscription.recordingsLimit)}%`,
                }}
              />
            </div>
          </div>

          {/* Vocabulary Usage */}
          <div className="usage-item">
            <div className="usage-header">
              <span className="usage-label">Vocabulary Entries</span>
              <span className="usage-value">
                {subscription.vocabularyCount} / {subscription.vocabularyLimit === PRO_VOCABULARY_LIMIT ? "Unlimited" : subscription.vocabularyLimit}
              </span>
            </div>
            <div className="usage-bar">
              <div
                className={`usage-fill ${getUsagePercentage(subscription.vocabularyCount, subscription.vocabularyLimit) > 80 ? "warning" : ""}`}
                style={{
                  width: `${getUsagePercentage(subscription.vocabularyCount, subscription.vocabularyLimit)}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Pro Benefits (for free users) */}
      {!isProUser && (
        <div className="benefits-card">
          <h4>Why Upgrade to Pro?</h4>
          <ul className="benefits-list">
            <li>
              <Check size={16} />
              <span>Unlimited recordings every month</span>
            </li>
            <li>
              <Check size={16} />
              <span>Up to {PRO_VOCABULARY_LIMIT} vocabulary entries</span>
            </li>
            <li>
              <Check size={16} />
              <span>Priority AI processing</span>
            </li>
            <li>
              <Check size={16} />
              <span>Priority customer support</span>
            </li>
            <li>
              <Check size={16} />
              <span>Early access to new features</span>
            </li>
          </ul>
        </div>
      )}

      {/* Account Info */}
      <div className="account-card">
        <h4>Account</h4>
        <div className="account-info">
          <span className="account-label">Email</span>
          <span className="account-value">{userEmail}</span>
        </div>
      </div>
    </div>
  );
}
