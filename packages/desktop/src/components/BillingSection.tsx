import { useState, useEffect, useCallback } from "react";
import { Loader2, Crown, ChevronRight } from "lucide-react";
import { supabase } from "../supabase";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  SUBSCRIPTION_CONFIG,
  PRICING,
  getSubscriptionEntitlement,
  type SubscriptionStatus,
  type SubscriptionTier,
} from "@oscar/shared/constants";
import { Group } from "./SettingsTab";

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

const RULE = "#e5e0d6"; // cream-300

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

/** Usage meter — label + used/total + a bar that warns near the cap. */
function Meter({
  label,
  used,
  total,
  unit,
  last = false,
}: {
  label: string;
  used: number;
  total: number;
  unit?: string;
  last?: boolean;
}) {
  const pct = total ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const near = pct >= 80;
  return (
    <div className="py-3.5" style={{ borderBottom: last ? "none" : `1px solid ${RULE}` }}>
      <div className="flex items-baseline justify-between">
        <span className="text-[13.5px] text-ink">{label}</span>
        <span
          className={`font-mono text-[11.5px] ${near ? "text-terracotta" : "text-ink-soft"}`}
        >
          {used} / {total}
          {unit ? ` ${unit}` : ""}
        </span>
      </div>
      <div
        className="mt-2 rounded-full overflow-hidden"
        style={{ height: 6, background: "#d8d2c4" }}
      >
        <div
          className="rounded-full h-full"
          style={{ width: `${pct}%`, background: near ? "#b8623d" : "#5a5852" }}
        />
      </div>
    </div>
  );
}

/** A "manage on the web" hairline row — desktop defers payment + invoices to web. */
function WebLinkRow({
  label,
  onClick,
  last = false,
}: {
  label: string;
  onClick: () => void;
  last?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-between w-full py-3.5 bg-transparent border-0 cursor-pointer text-left group"
      style={{ borderBottom: last ? "none" : `1px solid ${RULE}` }}
    >
      <span className="text-[13.5px] text-ink group-hover:text-terracotta transition-colors">
        {label}
      </span>
      <ChevronRight size={13} className="text-ink-faint" />
    </button>
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

  const entitlement = getSubscriptionEntitlement({
    tier: subscription.tier,
    status: subscription.status,
    currentPeriodEnd: subscription.currentPeriodEnd,
  });
  const isProUser = entitlement.isPro;
  const isCancelling = entitlement.isCancelling;
  const isAnnual = subscription.billingCycle === "yearly";
  const monthLabel = new Date()
    .toLocaleDateString("en-US", { month: "long" })
    .toUpperCase();

  if (isLoading) {
    return (
      <div className="flex justify-center py-12 text-ink-faint">
        <Loader2 size={22} className="animate-spin" />
      </div>
    );
  }

  /* ── PRO ── */
  if (isProUser) {
    return (
      <div>
        {/* Current plan card */}
        <div className="rounded-lg p-6 bg-cream-200 border border-cream-300">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="min-w-0">
              <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-terracotta">
                PRO · {isAnnual ? "ANNUAL" : "MONTHLY"}
              </span>
              <div className="mt-2 flex items-baseline gap-3 flex-wrap">
                <span
                  className="font-serif font-medium text-ink"
                  style={{ fontSize: 40, letterSpacing: "-0.025em", lineHeight: 1 }}
                >
                  ₹{isAnnual ? PRICING.YEARLY : PRICING.MONTHLY}
                </span>
                <span className="text-[12.5px] text-ink-soft">
                  per {isAnnual ? "year · billed annually" : "month"}
                </span>
              </div>
              {subscription.currentPeriodEnd && (
                <p className="mt-2.5 text-[12.5px] text-ink-soft">
                  {isCancelling ? "Access until " : "Renews "}
                  {formatDate(subscription.currentPeriodEnd)}
                  {isAnnual && !isCancelling && " · saving 20% vs monthly"}
                </p>
              )}
            </div>
            <button
              type="button"
              className="shrink-0 text-[12px] rounded-full px-4 py-2 border border-cream-300 text-ink-soft bg-transparent cursor-pointer hover:text-ink transition-colors"
              onClick={() => openExternal(SETTINGS_URL)}
            >
              Manage plan
            </button>
          </div>
        </div>

        {/* Usage */}
        <Group title={`USAGE · ${monthLabel}`}>
          {subscription.recordingsLimit === null ? (
            <div className="flex items-center justify-between py-3.5" style={{ borderBottom: `1px solid ${RULE}` }}>
              <span className="text-[13.5px] text-ink">Recordings this month</span>
              <span className="font-mono text-[11.5px] text-terracotta">UNLIMITED</span>
            </div>
          ) : (
            <Meter
              label="Recordings this month"
              used={subscription.recordingsThisMonth}
              total={subscription.recordingsLimit}
            />
          )}
          {subscription.vocabularyLimit === null ? (
            <div className="flex items-center justify-between py-3.5">
              <span className="text-[13.5px] text-ink">Vocabulary entries</span>
              <span className="font-mono text-[11.5px] text-terracotta">UNLIMITED</span>
            </div>
          ) : (
            <Meter
              label="Vocabulary entries"
              used={subscription.vocabularyCount}
              total={subscription.vocabularyLimit}
              last
            />
          )}
        </Group>

        {/* Payment + invoices live on the web */}
        <Group title="PAYMENT">
          <WebLinkRow
            label="Manage payment method"
            onClick={() => openExternal(SETTINGS_URL)}
            last
          />
        </Group>
        <Group title="INVOICES">
          <WebLinkRow
            label="View invoices & receipts"
            onClick={() => openExternal(SETTINGS_URL)}
            last
          />
        </Group>

        <div className="mt-8">
          <button
            type="button"
            onClick={() => openExternal(SETTINGS_URL)}
            className="text-[12px] text-ink-faint bg-transparent border-none cursor-pointer hover:text-ink transition-colors"
          >
            Cancel subscription
          </button>
        </div>
      </div>
    );
  }

  /* ── FREE ── */
  return (
    <div>
      <Group title="THIS MONTH" first>
        <Meter
          label="Recordings"
          used={subscription.recordingsThisMonth}
          total={subscription.recordingsLimit ?? SUBSCRIPTION_CONFIG.FREE_MONTHLY_RECORDINGS}
        />
        <Meter
          label="Vocabulary entries"
          used={subscription.vocabularyCount}
          total={subscription.vocabularyLimit ?? SUBSCRIPTION_CONFIG.FREE_MAX_VOCABULARY}
          last
        />
      </Group>

      {/* Upsell — dark ink card */}
      <div className="mt-7 rounded-lg p-6 bg-ink text-cream">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0">
            <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-terracotta">
              OSCAR · PRO
            </span>
            <div className="mt-2 flex items-baseline gap-3 flex-wrap">
              <span
                className="font-serif font-medium text-cream"
                style={{ fontSize: 40, letterSpacing: "-0.025em", lineHeight: 1 }}
              >
                ₹{PRICING.MONTHLY}
              </span>
              <span className="text-[12.5px]" style={{ color: "#cfc9bd" }}>
                per month · save 20% annually
              </span>
            </div>
            <p
              className="mt-3 text-[13px] leading-relaxed"
              style={{ color: "#cfc9bd", maxWidth: 340 }}
            >
              Unlimited recordings and Scribbles, Minutes, every device,
              context-aware dictation, vocabulary &amp; folders.
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 inline-flex items-center gap-1.5 text-[13px] rounded-full px-5 py-2.5 font-medium bg-terracotta text-cream border-none cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-50"
            onClick={handleUpgrade}
            disabled={isUpgrading}
          >
            {isUpgrading ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Crown size={13} />
            )}
            Upgrade to Pro
          </button>
        </div>
      </div>

      <Group title="PAYMENT">
        <p className="py-4 text-[13px] italic text-ink-faint">
          No payment method on file. You’ll add one when you upgrade.
        </p>
      </Group>
      <Group title="INVOICES">
        <p className="py-4 text-[13px] italic text-ink-faint">
          No invoices yet.
        </p>
      </Group>
    </div>
  );
}
