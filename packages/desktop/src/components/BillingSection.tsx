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
import {
  SUBSCRIPTION_CONFIG,
  PRICING,
  getSubscriptionEntitlement,
  type SubscriptionStatus,
  type SubscriptionTier,
} from "@oscar/shared/constants";
import { SettingsSection } from "./SettingsTab";

interface BillingSectionProps {
  userId: string;
}

interface SubscriptionData {
  tier: SubscriptionTier | null;
  status: SubscriptionStatus | null;
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
    tier: null,
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
        .select("tier, status, billing_cycle, current_period_end")
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

      const entitlement = getSubscriptionEntitlement({
        tier: subData?.tier,
        status: subData?.status,
        currentPeriodEnd: subData?.current_period_end,
      });

      setSubscription({
        tier: subData?.tier || null,
        status: subData?.status || null,
        billingCycle: subData?.billing_cycle || null,
        currentPeriodEnd: subData?.current_period_end || null,
        recordingsThisMonth: recordingsCount || 0,
        recordingsLimit: entitlement.recordingsLimit,
        vocabularyCount: vocabCount || 0,
        vocabularyLimit: entitlement.vocabularyLimit,
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

  const entitlement = getSubscriptionEntitlement({
    tier: subscription.tier,
    status: subscription.status,
    currentPeriodEnd: subscription.currentPeriodEnd,
  });
  const isProUser = entitlement.isPro;
  const isCancelling = entitlement.isCancelling;

  if (isLoading) {
    return (
      <div className="billing-compact billing-compact--loading">
        <Loader2 size={24} className="spin" />
      </div>
    );
  }

  return (
    <div className="billing-compact">
      {/* CURRENT PLAN — V2WebSettingsBilling:293 */}
      <SettingsSection caps="CURRENT PLAN" topBorder={false}>
        <div className="rounded-lg p-7 bg-cream-200 border border-cream-300">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="min-w-0">
              <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-terracotta">
                {isProUser ? "PRO · ACTIVE" : "FREE TIER"}
              </span>
              <div className="mt-2 flex items-baseline gap-3 flex-wrap">
                <span
                  className="font-serif font-medium text-ink"
                  style={{ fontSize: 40, letterSpacing: "-0.025em", lineHeight: 1 }}
                >
                  {isProUser
                    ? `₹${
                        subscription.billingCycle === "monthly"
                          ? PRICING.MONTHLY
                          : PRICING.YEARLY
                      }`
                    : "₹0"}
                </span>
                <span className="text-[13px] text-ink-soft">
                  {isProUser
                    ? `per ${subscription.billingCycle === "monthly" ? "month" : "year"}`
                    : "no payment required"}
                </span>
              </div>
              {isProUser && subscription.currentPeriodEnd && (
                <p className="mt-2 text-[13px] text-ink-soft">
                  {isCancelling ? "Access until " : "Renews "}
                  {formatDate(subscription.currentPeriodEnd)}
                  {subscription.billingCycle === "yearly" && !isCancelling && " · saving 20% vs monthly"}
                </p>
              )}
            </div>
            <div className="shrink-0">
              {isProUser ? (
                <button
                  className="text-[12px] rounded-full px-4 py-2 border border-cream-300 text-ink-soft bg-transparent cursor-pointer hover:text-ink transition-colors"
                  onClick={() => openExternal(SETTINGS_URL)}
                >
                  Manage plan
                </button>
              ) : (
                <button
                  className="inline-flex items-center gap-1.5 text-[12px] rounded-full px-4 py-2 bg-ink text-cream border-none cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-50"
                  onClick={handleUpgrade}
                  disabled={isUpgrading}
                >
                  {isUpgrading ? (
                    <Loader2 size={12} className="spin" />
                  ) : (
                    <Crown size={12} />
                  )}
                  {isUpgrading ? "Loading…" : "Upgrade to Pro"}
                </button>
              )}
            </div>
          </div>
          {isProUser && (
            <div className="mt-6 pt-5 border-t border-cream-300 grid grid-cols-2 gap-6">
              <div>
                <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-faint inline-flex items-center gap-1.5">
                  <CreditCard size={10} /> BILLING CYCLE
                </span>
                <div className="mt-1 text-[14px] text-ink">
                  {subscription.billingCycle === "monthly"
                    ? "Monthly"
                    : subscription.billingCycle === "yearly"
                      ? "Yearly"
                      : "—"}
                </div>
              </div>
              <div>
                <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-faint inline-flex items-center gap-1.5">
                  <Calendar size={10} /> {isCancelling ? "ACCESS UNTIL" : "NEXT BILLING"}
                </span>
                <div className="mt-1 text-[14px] text-ink">
                  {formatDate(subscription.currentPeriodEnd)}
                </div>
              </div>
            </div>
          )}
        </div>
      </SettingsSection>

      {/* USAGE — V2WebSettingsBilling-style */}
      <SettingsSection caps={`USAGE · ${new Date().toLocaleDateString("en-US", { month: "long" }).toUpperCase()}`}>
        <div className="billing-usage-grid">
        <div className="billing-usage-card">
          <span className="billing-usage-card-label">
            Recordings this month
          </span>
          <span className="billing-usage-card-val">
            {subscription.recordingsLimit === null ? (
              <span className="billing-unlimited-inline">Unlimited</span>
            ) : (
              <>
                {subscription.recordingsThisMonth}
                <span className="billing-usage-card-limit">
                  {" / "}
                  {subscription.recordingsLimit}
                </span>
              </>
            )}
          </span>
          {subscription.recordingsLimit !== null && (
            <div className="billing-usage-card-bar">
              <div
                className={`billing-usage-card-fill${
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

        <div className="billing-usage-card">
          <span className="billing-usage-card-label">Vocabulary entries</span>
          <span className="billing-usage-card-val">
            {subscription.vocabularyLimit === null ? (
              <span className="billing-unlimited-inline">Unlimited</span>
            ) : (
              <>
                {subscription.vocabularyCount}
                <span className="billing-usage-card-limit">
                  {" / "}
                  {subscription.vocabularyLimit}
                </span>
              </>
            )}
          </span>
          {subscription.vocabularyLimit !== null && (
            <div className="billing-usage-card-bar">
              <div
                className={`billing-usage-card-fill${
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
      </SettingsSection>

      {/* PRO BENEFITS (free users) — V2OverlayUpgrade pattern */}
      {!isProUser && (
        <SettingsSection caps="WHY UPGRADE">
          <div className="rounded-lg p-6 bg-cream-200 border border-cream-300">
            <ul className="space-y-2.5 text-[13px] text-ink list-none">
              {[
                "Unlimited recordings every month",
                "Unlimited vocabulary entries",
                "Priority AI processing",
                "Priority customer support",
                "Early access to new features",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2.5">
                  <Check size={13} className="text-terracotta shrink-0 mt-0.5" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <button
              className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-ink text-cream px-4 py-2.5 text-[13px] font-medium border-none cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-50"
              onClick={handleUpgrade}
              disabled={isUpgrading}
            >
              {isUpgrading ? (
                <Loader2 size={13} className="spin" />
              ) : (
                <Crown size={13} />
              )}
              Upgrade — Starting at ₹{PRICING.MONTHLY}/month
            </button>
          </div>
        </SettingsSection>
      )}
    </div>
  );
}
