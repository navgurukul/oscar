"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { BookOpen, CreditCard, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useSubscriptionContext } from "@/lib/contexts/SubscriptionContext";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { ROUTES } from "@/lib/constants";

// Lazy load section components
const VocabularySection = dynamic(
  () => import("@/components/settings/VocabularySection"),
  {
    loading: () => <SectionSkeleton />,
  }
);

const BillingSection = dynamic(
  () => import("@/components/settings/BillingSection"),
  {
    loading: () => <SectionSkeleton />,
  }
);

// Loading skeleton for lazy-loaded sections
function SectionSkeleton() {
  return (
    <div className="bg-slate-900 rounded-2xl border border-cyan-700/30 p-6 shadow-xl">
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
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

  const [activeTab, setActiveTab] = useState("vocabulary");

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`${ROUTES.AUTH}?redirectTo=${ROUTES.SETTINGS}`);
    }
  }, [user, authLoading, router]);

  if (authLoading || !user) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Spinner className="text-cyan-500" />
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center px-4 pt-8 pb-24">
      <div className="w-full max-w-4xl mt-16">
        {/* Header */}
        <div className="mb-8 mt-5">
          <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
          <p className="text-gray-400">
            Manage your vocabulary, subscription, and billing
          </p>
        </div>

        {/* Mobile Dropdown */}
        <div className="md:hidden mb-4">
          <Select value={activeTab} onValueChange={setActiveTab}>
            <SelectTrigger className="w-full bg-slate-900 border-cyan-700/30 font-bold text-white">
              <SelectValue placeholder="Choose section" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-cyan-700/30 font-bold text-white">
              <SelectItem value="vocabulary">Vocabulary</SelectItem>
              <SelectItem value="billing">Billing</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabs Layout */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          orientation="vertical"
          className="md:flex gap-6"
        >
          {/* Desktop Tab List */}
          <TabsList className="hidden md:flex md:flex-col h-fit w-48 bg-slate-900 border border-cyan-700/30 p-2">
            <TabsTrigger
              value="vocabulary"
              className="w-full justify-start data-[state=active]:bg-cyan-500 data-[state=active]:text-white py-2 font-semibold"
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Vocabulary
            </TabsTrigger>
            <TabsTrigger
              value="billing"
              className="w-full justify-start data-[state=active]:bg-cyan-500 data-[state=active]:text-white py-2 font-semibold"
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Billing
            </TabsTrigger>
          </TabsList>

          {/* Tab Content - Conditional rendering for optimization */}
          <div className="flex-1">
            {activeTab === "vocabulary" && (
              <VocabularySection userId={user.id} isProUser={isProUser} />
            )}

            {activeTab === "billing" && (
              <BillingSection
                status={
                  status as "active" | "cancelled" | "expired" | "past_due"
                }
                billingCycle={billingCycle as "monthly" | "yearly" | null}
                currentPeriodEnd={currentPeriodEnd}
                recordingsThisMonth={recordingsThisMonth}
                recordingsLimit={recordingsLimit}
                notesCount={notesCount}
                notesLimit={notesLimit}
                isProUser={isProUser}
                isLoading={subscriptionLoading}
                onRefetch={refetch}
              />
            )}
          </div>
        </Tabs>
      </div>
    </main>
  );
}
