"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useSubscriptionContext } from "@/lib/contexts/SubscriptionContext";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { organizationService } from "@/lib/services/organization.service";
import { ROUTES, SUBSCRIPTION_CONFIG } from "@/lib/constants";
import type {
  ActiveOrganization,
  OrganizationMemberWithUser,
} from "@oscar/shared/types";
import {
  v2,
  v2Serif,
  V2Caps,
  V2Mono,
} from "@/components/v2/V2Primitives";
import {
  createOrgSettingsSections,
  V2OrgSettingsShell,
} from "@/components/v2/V2OrgSettingsShell";

export default function OrgBillingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const subscription = useSubscriptionContext();
  const [active, setActive] = useState<ActiveOrganization | null>(null);
  const [members, setMembers] = useState<OrganizationMemberWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const current = await organizationService.current();
      setActive(current);
      if (current) {
        const list = await organizationService.listMembers(current.organization.id);
        setMembers(list);
      }
    } catch (err) {
      console.error("[org billing] load failed", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push(`${ROUTES.AUTH}?redirectTo=${ROUTES.ORG_SETTINGS}/billing`);
      return;
    }
    void load();
  }, [authLoading, user, router, load]);

  useEffect(() => {
    if (active && !active.hasTeam) {
      router.replace(ROUTES.SETTINGS);
    }
  }, [active, router]);

  const cancel = useCallback(async () => {
    setCancelling(true);
    try {
      const res = await fetch("/api/razorpay/cancel", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Cancellation failed");
      }
      toast({
        title: "Subscription cancelled",
        description: "Your workspace stays on Pro until the end of the billing period.",
      });
      subscription.refetch();
      setConfirmCancel(false);
    } catch (err) {
      toast({
        title: "Could not cancel",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setCancelling(false);
    }
  }, [subscription, toast]);

  if (authLoading || loading || subscription.isLoading) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ background: v2.cream }}
      >
        <Spinner />
      </main>
    );
  }

  if (active && !active.hasTeam) {
    return null;
  }

  if (!active) {
    return (
      <main
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: v2.cream, color: v2.ink }}
      >
        <p style={{ color: v2.inkSoft }}>No active workspace.</p>
      </main>
    );
  }

  const canManage = active.role === "owner" || active.role === "admin";
  const isPro = subscription.isProUser;
  const limit = SUBSCRIPTION_CONFIG.FREE_ORG_MONTHLY_RECORDINGS;
  const used = subscription.recordingsThisMonth;
  const pct = isPro ? null : Math.min(100, Math.round((used / limit) * 100));
  const billingSub = isPro ? "Pro · workspace" : "Free · workspace";

  return (
    <V2OrgSettingsShell
      active="billing"
      orgName={active.organization.name}
      eyebrow="ORG SETTINGS · BILLING"
      title={
        <>
          The workspace plan, <em style={{ fontStyle: "italic", color: v2.accent }}>not</em> yours.
        </>
      }
      lead={
        <>
          Plan and usage for <strong>{active.organization.name}</strong>. Different from your
          personal Pro — workspace billing covers shared Minutes and the team feed.
        </>
      }
      sections={createOrgSettingsSections({
        active: "billing",
        memberCount: members.length,
        billingSub,
      })}
    >
      <div className="space-y-10">
        {/* CURRENT PLAN */}
        <div
          className="grid grid-cols-12 gap-6 md:gap-10"
          style={{ borderTop: `1px solid ${v2.rule}`, paddingTop: 28 }}
        >
          <div className="col-span-12 md:col-span-3">
            <V2Caps>CURRENT PLAN</V2Caps>
          </div>
          <div
            className="col-span-12 md:col-span-9 rounded-lg p-7"
            style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}
          >
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <V2Caps color={isPro ? v2.accent : v2.inkFaint}>
                  WORKSPACE · {isPro ? "PRO" : "FREE"}
                </V2Caps>
                <div className="mt-2 flex items-baseline gap-3 flex-wrap">
                  <span
                    style={{
                      fontFamily: v2Serif,
                      fontSize: 48,
                      fontWeight: 500,
                      letterSpacing: 0,
                    }}
                  >
                    {isPro ? "Pro" : "₹0"}
                  </span>
                  <span style={{ fontSize: 13, color: v2.inkSoft }}>
                    {isPro
                      ? subscription.billingCycle
                        ? `· ${subscription.billingCycle === "monthly" ? "monthly" : "annual"}${
                            subscription.currentPeriodEnd
                              ? ` · renews ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                              : ""
                          }`
                        : "· active"
                      : `· ${limit} recordings / month shared across members`}
                  </span>
                </div>
                {!isPro && (
                  <p className="mt-3 text-[13px]" style={{ color: v2.inkSoft, maxWidth: 460 }}>
                    Members each have their own personal quota too — this is the shared pool for
                    things saved to the workspace.
                  </p>
                )}
              </div>
              {canManage && !isPro && (
                <button
                  onClick={() => router.push(ROUTES.PRICING)}
                  className="text-[12px] rounded-full px-4 py-2 font-medium"
                  style={{ background: v2.accent, color: v2.cream }}
                >
                  Upgrade workspace →
                </button>
              )}
              {canManage && isPro && subscription.status === "active" && (
                <button
                  onClick={() => setConfirmCancel(true)}
                  className="text-[12px] rounded-full px-4 py-2"
                  style={{ border: `1px solid ${v2.dangerSoft}`, color: v2.danger }}
                >
                  Cancel subscription
                </button>
              )}
            </div>

            {!isPro && (
              <div className="mt-7">
                <div className="flex items-baseline justify-between mb-2.5">
                  <V2Caps>SHARED USAGE · THIS MONTH</V2Caps>
                  <V2Mono style={{ fontSize: 12, color: v2.ink }}>
                    {used} / {limit} · {pct}%
                  </V2Mono>
                </div>
                <div
                  className="rounded-full overflow-hidden"
                  style={{ height: 8, background: v2.rule }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${pct ?? 0}%`,
                      background: pct && pct > 80 ? v2.accent : v2.ink,
                      transition: "all 0.3s ease",
                    }}
                  />
                </div>
              </div>
            )}

            {isPro && subscription.status === "cancelled" && (
              <div
                className="mt-7 rounded-md px-4 py-3 flex items-start gap-2"
                style={{ background: v2.cream, border: `1px solid ${v2.dangerSoft}`, color: v2.danger }}
              >
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p className="text-[13px] leading-relaxed">
                  Cancellation scheduled — Pro stays active until{" "}
                  {subscription.currentPeriodEnd
                    ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
                    : "the end of the billing period"}
                  .
                </p>
              </div>
            )}
          </div>
        </div>

        {!isPro && (
          <div
            className="grid grid-cols-12 gap-6 md:gap-10"
            style={{ borderTop: `1px solid ${v2.rule}`, paddingTop: 28 }}
          >
            <div className="col-span-12 md:col-span-3">
              <V2Caps>UPGRADE</V2Caps>
            </div>
            <div
              className="col-span-12 md:col-span-9 rounded-lg p-7"
              style={{ background: v2.ink, color: v2.cream }}
            >
              <V2Caps color={v2.accentSoft}>WORKSPACE PRO</V2Caps>
              <div className="mt-3 flex items-baseline gap-3 flex-wrap">
                <span
                  style={{
                    fontFamily: v2Serif,
                    fontSize: 48,
                    fontWeight: 500,
                    letterSpacing: 0,
                  }}
                >
                  Unlimited
                </span>
                <span style={{ fontSize: 13, color: "rgba(247,244,238,0.65)" }}>
                  shared Minutes, team feed, and workspace usage.
                </span>
              </div>
              <ul className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-[14px] list-none p-0">
                {[
                  "Unlimited shared Minutes",
                  "Shared workspace vocabulary",
                  "Posted Minutes for team review",
                  "Org-wide audit log",
                  "Org-wide analytics",
                  "Priority workspace support",
                ].map((feature) => (
                  <li key={feature} className="flex items-start gap-2" style={{ color: v2.cream }}>
                    <span style={{ color: v2.accent, fontFamily: "var(--font-ibm-plex-mono), ui-monospace", fontSize: 12, marginTop: 4 }}>·</span>
                    <span style={{ fontFamily: v2Serif, fontSize: 15 }}>{feature}</span>
                  </li>
                ))}
              </ul>
              {canManage && (
                <button
                  onClick={() => router.push(ROUTES.PRICING)}
                  className="mt-7 text-[13px] rounded-full px-5 py-2.5 font-medium"
                  style={{ background: v2.cream, color: v2.ink }}
                >
                  Upgrade workspace →
                </button>
              )}
            </div>
          </div>
        )}

        {/* SEATS */}
        <div
          className="grid grid-cols-12 gap-6 md:gap-10"
          style={{ borderTop: `1px solid ${v2.rule}`, paddingTop: 28 }}
        >
          <div className="col-span-12 md:col-span-3">
            <V2Caps>SEATS</V2Caps>
          </div>
          <div className="col-span-12 md:col-span-9">
            <div
              className="flex items-center justify-between py-4"
              style={{ borderBottom: `1px solid ${v2.rule}` }}
            >
              <div>
                <div style={{ fontSize: 14, color: v2.ink }}>
                  {members.length} {members.length === 1 ? "member" : "members"} in workspace
                </div>
                <V2Caps>{members.length} ACTIVE</V2Caps>
              </div>
              {!canManage && (
                <V2Mono style={{ fontSize: 11, color: v2.inkFaint }}>VIEW ONLY</V2Mono>
              )}
            </div>
          </div>
        </div>

        {/* WORKSPACE INVOICES */}
        <div
          className="grid grid-cols-12 gap-6 md:gap-10"
          style={{ borderTop: `1px solid ${v2.rule}`, paddingTop: 28 }}
        >
          <div className="col-span-12 md:col-span-3">
            <V2Caps>WORKSPACE INVOICES</V2Caps>
          </div>
          <div className="col-span-12 md:col-span-9">
            {[
              ["THIS CYCLE", isPro ? "Active subscription" : "Free · workspace"],
              ["LAST CYCLE", isPro ? "Available in Razorpay" : "No charge"],
              ["ARCHIVE", "Invoices appear after workspace upgrades"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="grid grid-cols-12 gap-4 py-3 items-center"
                style={{ borderBottom: `1px solid ${v2.rule}` }}
              >
                <V2Mono style={{ fontSize: 12, color: v2.ink, gridColumn: "span 4 / span 4" }}>
                  {label}
                </V2Mono>
                <span className="col-span-8 text-[13px]" style={{ color: v2.inkSoft }}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {!canManage && (
          <p className="text-[12px]" style={{ color: v2.inkFaint }}>
            Only workspace owners or admins can change billing.
          </p>
        )}
      </div>

      {confirmCancel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(15,13,10,0.55)" }}
        >
          <div
            className="rounded-2xl w-full max-w-md p-7"
            style={{ background: v2.cream, border: `1px solid ${v2.rule}` }}
          >
            <V2Caps color={v2.danger}>CANCEL SUBSCRIPTION</V2Caps>
            <h2
              className="mt-2"
              style={{
                fontFamily: v2Serif,
                fontSize: 32,
                lineHeight: 1.0,
                letterSpacing: 0,
                fontWeight: 500,
              }}
            >
              Cancel the workspace subscription?
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed" style={{ color: v2.inkSoft }}>
              Pro features stay active until the end of the current billing period. Members will
              drop back to the shared free quota afterwards.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={() => setConfirmCancel(false)}
                className="text-[13px] rounded-full px-5 py-2.5"
                style={{ background: v2.ink, color: v2.cream }}
              >
                Keep it
              </button>
              <button
                onClick={() => void cancel()}
                disabled={cancelling}
                className="text-[13px] rounded-full px-5 py-2.5 disabled:opacity-50"
                style={{ border: `1px solid ${v2.dangerSoft}`, color: v2.danger }}
              >
                {cancelling ? (
                  <>
                    <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />
                    Cancelling…
                  </>
                ) : (
                  "Cancel anyway"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </V2OrgSettingsShell>
  );
}
