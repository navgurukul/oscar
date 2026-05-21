"use client";

import { useState, useEffect, Suspense, type ReactElement } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useSubscriptionContext } from "@/lib/contexts/SubscriptionContext";
import { Spinner } from "@/components/ui/spinner";
import { ROUTES } from "@/lib/constants";
import {
  v2,
  v2Serif,
  V2Caps,
  V2WebHeader,
} from "@/components/v2/V2Primitives";

const VocabularySection = dynamic(
  () => import("@/components/settings/VocabularySection"),
  { loading: () => <SectionSkeleton /> }
);
const BillingSection = dynamic(
  () => import("@/components/settings/BillingSection"),
  { loading: () => <SectionSkeleton /> }
);
const AccountSection = dynamic(
  () => import("@/components/settings/AccountSection"),
  { loading: () => <SectionSkeleton /> }
);
const DataPrivacySection = dynamic(
  () => import("@/components/settings/DataPrivacySection"),
  { loading: () => <SectionSkeleton /> }
);
const FolderManagementSection = dynamic(
  () => import("@/components/settings/FolderManagementSection"),
  { loading: () => <SectionSkeleton /> }
);

function SectionSkeleton() {
  return (
    <div
      className="rounded-2xl p-6"
      style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}
    >
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: v2.accent }} />
      </div>
    </div>
  );
}

type Tab = "billing" | "vocabulary" | "folders" | "account" | "privacy";

const SECTIONS: Array<{ id: Tab; label: string; sub: string }> = [
  { id: "account", label: "Account", sub: "You" },
  { id: "billing", label: "Plans & billing", sub: "Subscription" },
  { id: "vocabulary", label: "Vocabulary", sub: "Words Oscar knows" },
  { id: "folders", label: "Folders", sub: "How you group things" },
  { id: "privacy", label: "Data & privacy", sub: "Export · delete" },
];

const TITLES: Record<Tab, { eyebrow: string; h1: ReactElement; lead: string }> = {
  account: {
    eyebrow: "SETTINGS · ACCOUNT",
    h1: (
      <>
        You, on <em style={{ fontStyle: "italic", color: v2.accent }}>Oscar</em>.
      </>
    ),
    lead: "Your identity, voice profile, and how Oscar shows up when it pastes for you.",
  },
  billing: {
    eyebrow: "SETTINGS · PLANS & BILLING",
    h1: (
      <>
        Plan & <em style={{ fontStyle: "italic", color: v2.accent }}>billing</em>.
      </>
    ),
    lead: "Manage your subscription, payment method, and invoices.",
  },
  vocabulary: {
    eyebrow: "SETTINGS · VOCABULARY",
    h1: (
      <>
        Words Oscar should <em style={{ fontStyle: "italic", color: v2.accent }}>know</em>.
      </>
    ),
    lead: "Names, jargon, file paths — the words Whisper would otherwise miss.",
  },
  folders: {
    eyebrow: "SETTINGS · FOLDERS",
    h1: (
      <>
        How you <em style={{ fontStyle: "italic", color: v2.accent }}>group</em> things.
      </>
    ),
    lead: "Folders organize Scribbles. Manage what exists and where new ones land.",
  },
  privacy: {
    eyebrow: "SETTINGS · DATA & PRIVACY",
    h1: (
      <>
        What we <em style={{ fontStyle: "italic", color: v2.accent }}>do</em> with your voice.
      </>
    ),
    lead: "Oscar transcribes locally on desktop when possible. Audio never leaves your machine unless you opt in.",
  },
};

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
    scribblesCount,
    scribblesLimit,
    isProUser,
    isLoading: subscriptionLoading,
    refetch,
  } = useSubscriptionContext();

  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const tabParam = searchParams.get("tab");
    return (tabParam as Tab) || "billing";
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`${ROUTES.AUTH}?redirectTo=${ROUTES.SETTINGS}`);
    }
  }, [user, authLoading, router]);

  if (authLoading || !user) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ background: v2.cream }}
      >
        <Spinner />
      </main>
    );
  }

  const titleData = TITLES[activeTab];

  return (
    <main
      style={{
        background: v2.cream,
        color: v2.ink,
        minHeight: "100vh",
        fontFamily: "var(--font-figtree), system-ui",
      }}
    >
      <V2WebHeader active="SETTINGS" />
      <div className="grid grid-cols-12" style={{ borderTop: `1px solid ${v2.rule}` }}>
        <aside
          className="col-span-12 md:col-span-3 px-6 md:px-12 py-8 md:py-14"
          style={{ borderRight: `1px solid ${v2.rule}` }}
        >
          <V2Caps>SETTINGS</V2Caps>
          <nav className="mt-7 space-y-5">
            {SECTIONS.map((s) => {
              const isActive = activeTab === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveTab(s.id)}
                  className="w-full text-left"
                  style={{
                    borderLeft: isActive
                      ? `2px solid ${v2.accent}`
                      : "2px solid transparent",
                    paddingLeft: 14,
                  }}
                >
                  <div
                    style={{
                      fontFamily: v2Serif,
                      fontSize: 19,
                      fontWeight: 500,
                      color: isActive ? v2.ink : v2.inkSoft,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {s.label}
                  </div>
                  <div className="mt-0.5">
                    <V2Caps>{s.sub.toUpperCase()}</V2Caps>
                  </div>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="col-span-12 md:col-span-9 px-6 md:px-14 py-8 md:py-14">
          <V2Caps>{titleData.eyebrow}</V2Caps>
          <h1
            className="mt-3"
            style={{
              fontFamily: v2Serif,
              fontSize: "clamp(40px, 6vw, 60px)",
              lineHeight: 0.98,
              letterSpacing: "-0.025em",
              fontWeight: 500,
            }}
          >
            {titleData.h1}
          </h1>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed" style={{ color: v2.inkSoft }}>
            {titleData.lead}
          </p>

          <div className="mt-10">
            {activeTab === "billing" && (
              <BillingSection
                status={status as "active" | "cancelled" | "expired" | "past_due"}
                billingCycle={billingCycle as "monthly" | "yearly" | null}
                currentPeriodEnd={currentPeriodEnd}
                recordingsThisMonth={recordingsThisMonth}
                recordingsLimit={recordingsLimit}
                scribblesCount={scribblesCount}
                scribblesLimit={scribblesLimit}
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
        </main>
      </div>
    </main>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <main
          className="min-h-screen flex items-center justify-center"
          style={{ background: v2.cream }}
        >
          <Spinner />
        </main>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
