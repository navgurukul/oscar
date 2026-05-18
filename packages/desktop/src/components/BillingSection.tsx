import { useState, useEffect, useCallback } from "react";
import {
  Check,
  Loader2,
  Crown,
  Calendar,
  CreditCard,
} from "lucide-react";
import { supabase } from "../supabase";
import { openUrl } from "@tauri-apps/plugin-opener";
import { SUBSCRIPTION_CONFIG, PRICING } from "@oscar/shared/constants";

type SubscriptionStatus =
  | "active"
  | "cancelled"
  | "expired"
  | "past_due"
  | null;

interface BillingSectionProps {
  userId: string;
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

const WEB_APP_URL =
  import.meta.env.VITE_WEB_APP_URL ?? "https://oscar.samyarth.org";
const PRICING_URL = `${WEB_APP_URL}/pricing`;
const SETTINGS_URL = `${WEB_APP_URL}/settings`;

function formatDate(dateString: string | null) {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function openExternal(url: string) {
  void openUrl(url).catch((e) =>
    console.error("Failed to open external link:", e),
  );
}

export function BillingSection({ userId }: BillingSectionProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionData>({
    status: null,
    billingCycle: null,
    currentPeriodEnd: null,
    recordingsThisMonth: 0,
    recordingsLimit: SUBSCRIPTION_CONFIG.FREE_MONTHLY_RECORDINGS,
    vocabularyCount: 0,
    vocabularyLimit: SUBSCRIPTION_CONFIG.FREE_MAX_VOCABULARY,
  });
  const [isUpgrading, setIsUpgrading] = useState(false);

  useEffect(() => {
    loadSubscriptionData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const loadSubscriptionData = async () => {
    setIsLoading(true);
    try {
      const { data: subData } = await supabase
        .from("subscriptions")
        .select("status, billing_cycle, current_period_end")
        .eq("user_id", userId)
        .maybeSingle();

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count: recordingsCount } = await supabase
        .from("recordings")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", startOfMonth.toISOString());

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
        recordingsLimit: isPro
          ? null
          : SUBSCRIPTION_CONFIG.FREE_MONTHLY_RECORDINGS,
        vocabularyCount: vocabCount || 0,
        vocabularyLimit: isPro ? null : SUBSCRIPTION_CONFIG.FREE_MAX_VOCABULARY,
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
      await openUrl(PRICING_URL);
    } catch (e) {
      console.error("Failed to open pricing:", e);
    } finally {
      setIsUpgrading(false);
    }
  }, []);

  const pct = (current: number, limit: number | null) => {
    if (!limit) return 0;
    return Math.min((current / limit) * 100, 100);
  };

  const isProUser = subscription.status === "active";
  const isCancelling = subscription.status === "cancelled";

  if (isLoading) {
    return (
      <div className="billing-compact billing-compact--loading">
        <Loader2 size={24} className="spin" />
      </div>
    );
  }

  return (
    <div className="billing-compact">
      {/* Current Plan Card */}
      <div className="st-card st-card--grouped">
        <div className="billing-plan-row">
          <div className="billing-plan-badge-wrap">
            <span
              className={`billing-plan-icon ${isProUser ? "pro" : "free"}`}
            >
              <Crown size={16} />
            </span>
            <div>
              <span className="billing-plan-name">
                {isProUser ? "Pro Plan" : "Free Plan"}
              </span>
              <span className="billing-plan-price">
                {isProUser
                  ? `₹${
                      subscription.billingCycle === "monthly"
                        ? PRICING.MONTHLY
                        : PRICING.YEARLY
                    }/${subscription.billingCycle === "monthly" ? "month" : "year"}`
                  : "No payment required"}
              </span>
            </div>
          </div>
          {isProUser ? (
            <span
              className={
                isCancelling
                  ? "billing-status-cancelling"
                  : "billing-status-active"
              }
            >
              <Check size={13} />
              {isCancelling ? "Cancelling" : "Active"}
            </span>
          ) : (
            <button
              className="st-btn-primary-sm"
              onClick={handleUpgrade}
              disabled={isUpgrading}
            >
              {isUpgrading ? (
                <Loader2 size={14} className="spin" />
              ) : (
                <Crown size={14} />
              )}
              {isUpgrading ? "Loading…" : "Upgrade to Pro"}
            </button>
          )}
        </div>

        {/* Pro details: cycle + next billing */}
        {isProUser && (
          <>
            <div className="st-divider" />
            <div className="billing-detail-row">
              <span className="billing-detail-label">
                <CreditCard size={13} />
                Billing cycle
              </span>
              <span className="billing-detail-val">
                {subscription.billingCycle === "monthly"
                  ? "Monthly"
                  : subscription.billingCycle === "yearly"
                    ? "Yearly"
                    : "—"}
              </span>
            </div>
            <div className="billing-detail-row">
              <span className="billing-detail-label">
                <Calendar size={13} />
                {isCancelling ? "Access until" : "Next billing date"}
              </span>
              <span className="billing-detail-val">
                {formatDate(subscription.currentPeriodEnd)}
              </span>
            </div>
            {!isCancelling && (
              <div className="billing-actions">
                <button
                  className="st-btn-ghost-sm"
                  onClick={() => openExternal(SETTINGS_URL)}
                >
                  Manage Subscription
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Usage */}
      <div className="st-section-label">Usage</div>
      <div className="st-card st-card--grouped">
        <div className="billing-usage">
          <div className="billing-usage-item">
            <div className="billing-usage-hd">
              <span className="billing-usage-label">Recordings this month</span>
              <span className="billing-usage-val">
                {subscription.recordingsLimit === null ? (
                  <span className="billing-unlimited">Unlimited</span>
                ) : (
                  `${subscription.recordingsThisMonth} / ${subscription.recordingsLimit}`
                )}
              </span>
            </div>
            {subscription.recordingsLimit !== null && (
              <div className="billing-bar">
                <div
                  className={`billing-bar-fill${
                    pct(
                      subscription.recordingsThisMonth,
                      subscription.recordingsLimit,
                    ) > 80
                      ? " warning"
                      : ""
                  }`}
                  style={{
                    width: `${pct(subscription.recordingsThisMonth, subscription.recordingsLimit)}%`,
                  }}
                />
              </div>
            )}
          </div>

          <div className="billing-usage-item">
            <div className="billing-usage-hd">
              <span className="billing-usage-label">Vocabulary entries</span>
              <span className="billing-usage-val">
                {subscription.vocabularyLimit === null ? (
                  <span className="billing-unlimited">Unlimited</span>
                ) : (
                  `${subscription.vocabularyCount} / ${subscription.vocabularyLimit}`
                )}
              </span>
            </div>
            {subscription.vocabularyLimit !== null && (
              <div className="billing-bar">
                <div
                  className={`billing-bar-fill${
                    pct(
                      subscription.vocabularyCount,
                      subscription.vocabularyLimit,
                    ) > 80
                      ? " warning"
                      : ""
                  }`}
                  style={{
                    width: `${pct(subscription.vocabularyCount, subscription.vocabularyLimit)}%`,
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pro Benefits (free users) */}
      {!isProUser && (
        <>
          <div className="st-section-label">Why Upgrade to Pro?</div>
          <div className="st-card st-card--grouped billing-benefits">
            <ul className="billing-benefits-list">
              <li>
                <Check size={14} />
                <span>Unlimited recordings every month</span>
              </li>
              <li>
                <Check size={14} />
                <span>Unlimited vocabulary entries</span>
              </li>
              <li>
                <Check size={14} />
                <span>Priority AI processing</span>
              </li>
              <li>
                <Check size={14} />
                <span>Priority customer support</span>
              </li>
              <li>
                <Check size={14} />
                <span>Early access to new features</span>
              </li>
            </ul>
            <button
              className="st-btn-primary-sm billing-benefits-cta"
              onClick={handleUpgrade}
              disabled={isUpgrading}
            >
              {isUpgrading ? (
                <Loader2 size={14} className="spin" />
              ) : (
                <Crown size={14} />
              )}
              Upgrade — Starting at ₹{PRICING.MONTHLY}/month
            </button>
          </div>
        </>
      )}
    </div>
  );
}
