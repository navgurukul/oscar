"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CreditCard, Users, Zap, AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useSubscriptionContext } from "@/lib/contexts/SubscriptionContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { organizationService } from "@/lib/services/organization.service";
import { ROUTES, SUBSCRIPTION_CONFIG } from "@/lib/constants";
import { isOrgFeatureEnabled } from "@/lib/featureFlags";
import type {
  ActiveOrganization,
  OrganizationMemberWithUser,
} from "@oscar/shared/types";

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
    if (!isOrgFeatureEnabled()) return;
    if (authLoading) return;
    if (!user) {
      router.push(`${ROUTES.AUTH}?redirectTo=${ROUTES.ORG_SETTINGS}/billing`);
      return;
    }
    void load();
  }, [authLoading, user, router, load]);

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

  if (!isOrgFeatureEnabled()) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <p className="text-gray-400">Workspace billing is not enabled.</p>
      </main>
    );
  }

  if (authLoading || loading || subscription.isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Spinner className="text-cyan-500" />
      </main>
    );
  }

  if (!active) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <p className="text-gray-300">No active workspace.</p>
      </main>
    );
  }

  const canManage = active.role === "owner" || active.role === "admin";
  const isPro = subscription.isProUser;
  const limit = SUBSCRIPTION_CONFIG.FREE_ORG_MONTHLY_RECORDINGS;
  const used = subscription.recordingsThisMonth;
  const pct = isPro ? null : Math.min(100, Math.round((used / limit) * 100));

  return (
    <main className="flex flex-col items-center px-4 pt-8 pb-24">
      <div className="w-full max-w-3xl mt-16 space-y-6">
        <header className="mb-2 mt-5">
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <CreditCard className="w-7 h-7 text-cyan-400" />
            Billing
          </h1>
          <p className="text-gray-400">
            Plan and usage for <span className="text-white">{active.organization.name}</span>.
          </p>
        </header>

        <Card className="bg-slate-900 border-cyan-700/30">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-cyan-400" />
              {isPro ? "Pro" : "Free"}
            </CardTitle>
            <CardDescription className="text-gray-400">
              {isPro
                ? subscription.billingCycle
                  ? `${subscription.billingCycle === "monthly" ? "Monthly" : "Yearly"} plan${
                      subscription.currentPeriodEnd
                        ? ` · renews ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                        : ""
                    }`
                  : "Active subscription"
                : `Shared ${limit} recordings / month across all workspace members.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {!isPro && (
              <div>
                <div className="flex items-center justify-between mb-2 text-sm text-gray-300">
                  <span>This month</span>
                  <span>
                    {used} / {limit}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-cyan-500 transition-all"
                    style={{ width: `${pct ?? 0}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Users className="w-4 h-4" />
              {members.length} {members.length === 1 ? "member" : "members"}
            </div>

            {canManage ? (
              <div className="flex gap-2 pt-2">
                {!isPro && (
                  <Button
                    onClick={() => router.push(ROUTES.PRICING)}
                    className="bg-cyan-500 hover:bg-cyan-600 text-white"
                  >
                    Upgrade to Pro
                  </Button>
                )}
                {isPro && subscription.status === "active" && (
                  <Button
                    variant="outline"
                    onClick={() => setConfirmCancel(true)}
                    className="border-red-700/40 text-red-300 hover:bg-red-500/10"
                  >
                    Cancel subscription
                  </Button>
                )}
                {isPro && subscription.status === "cancelled" && (
                  <p className="text-xs text-amber-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Cancellation scheduled — Pro stays active until{" "}
                    {subscription.currentPeriodEnd
                      ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
                      : "the end of the billing period"}
                    .
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-500">
                Only workspace owners or admins can change billing.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent className="bg-slate-900 border-slate-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel the workspace subscription?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Pro features stay active until the end of the current billing period. Members will drop back to the shared free quota afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 border-slate-700 text-white">
              Keep it
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void cancel()}
              disabled={cancelling}
              className="bg-red-600 hover:bg-red-700"
            >
              {cancelling ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                "Cancel subscription"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
