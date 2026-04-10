"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { BookOpen, CreditCard, User, Shield, Loader2, Folder } from "lucide-react";
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

const AccountSection = dynamic(
  () => import("@/components/settings/AccountSection"),
  {
    loading: () => <SectionSkeleton />,
  }
);

const DataPrivacySection = dynamic(
  () => import("@/components/settings/DataPrivacySection"),
  {
    loading: () => <SectionSkeleton />,
  }
);

const FolderManagementSection = dynamic(
  () => import("@/components/settings/FolderManagementSection"),
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

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
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

  const [activeTab, setActiveTab] = useState(() => {
    const tabParam = searchParams.get("tab");
    return (tabParam as "billing" | "vocabulary" | "folders" | "account" | "privacy") || "billing";
  });

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
            Manage your account, subscription, vocabulary, and privacy settings
          </p>
        </div>

        {/* Mobile Dropdown */}
        <div className="md:hidden mb-4">
          <Select value={activeTab} onValueChange={(value) => setActiveTab(value as "billing" | "vocabulary" | "folders" | "account" | "privacy")}>
            <SelectTrigger className="w-full bg-slate-900 border-cyan-700/30 font-bold text-white">
              <SelectValue placeholder="Choose section" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-cyan-700/30 font-bold text-white">
              <SelectItem value="billing">Plans & Billing</SelectItem>
              <SelectItem value="vocabulary">Vocabulary</SelectItem>
              <SelectItem value="folders">Folder Management</SelectItem>
              <SelectItem value="account">Account</SelectItem>
              <SelectItem value="privacy">Data & Privacy</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabs Layout */}
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as "billing" | "vocabulary" | "folders" | "account" | "privacy")}
          orientation="vertical"
          className="md:flex gap-6"
        >
          {/* Desktop Tab List */}
          <TabsList className="hidden md:flex md:flex-col h-fit w-48 bg-slate-900 border border-cyan-700/30 p-2">
            <TabsTrigger
              value="billing"
              className="w-full justify-start data-[state=active]:bg-cyan-500 data-[state=active]:text-white py-2 font-semibold"
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Plans & Billing
            </TabsTrigger>
            <TabsTrigger
              value="vocabulary"
              className="w-full justify-start data-[state=active]:bg-cyan-500 data-[state=active]:text-white py-2 font-semibold"
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Vocabulary
            </TabsTrigger>
            <TabsTrigger
              value="folders"
              className="w-full justify-start data-[state=active]:bg-cyan-500 data-[state=active]:text-white py-2 font-semibold"
            >
              <Folder className="w-4 h-4 mr-2" />
              Folder Management
            </TabsTrigger>
            <TabsTrigger
              value="account"
              className="w-full justify-start data-[state=active]:bg-cyan-500 data-[state=active]:text-white py-2 font-semibold"
            >
              <User className="w-4 h-4 mr-2" />
              Account
            </TabsTrigger>
            <TabsTrigger
              value="privacy"
              className="w-full justify-start data-[state=active]:bg-cyan-500 data-[state=active]:text-white py-2 font-semibold"
            >
              <Shield className="w-4 h-4 mr-2" />
              Data & Privacy
            </TabsTrigger>
          </TabsList>

          {/* Tab Content - Conditional rendering for optimization */}
          <div className="flex-1">
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

            {activeTab === "vocabulary" && (
              <VocabularySection userId={user.id} isProUser={isProUser} />
            )}

            {activeTab === "account" && <AccountSection />}

            {activeTab === "folders" && <FolderManagementSection />}

            {activeTab === "privacy" && <DataPrivacySection />}
          </div>
        </Tabs>
      </div>
    </main>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center">
        <Spinner className="text-cyan-500" />
      </main>
    }>
      <SettingsContent />
    </Suspense>
  );
}
