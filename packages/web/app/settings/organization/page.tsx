"use client";

import { Suspense, useCallback, useEffect, useState, type ReactElement } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { Spinner } from "@/components/ui/spinner";
import { CreateOrgForm } from "@/components/org/CreateOrgForm";
import { OrgDetailsForm } from "@/components/org/OrgDetailsForm";
import { MemberList } from "@/components/org/MemberList";
import { InvitePanel } from "@/components/org/InvitePanel";
import { organizationService } from "@/lib/services/organization.service";
import { ROUTES } from "@/lib/constants";
import type { ActiveOrganization } from "@oscar/shared/types";
import { v2 } from "@/components/v2/V2Primitives";
import {
  createOrgSettingsSections,
  V2OrgSettingsShell,
} from "@/components/v2/V2OrgSettingsShell";

type Tab = "details" | "members" | "invites";

function isOrgSettingsTab(value: string | null): value is Tab {
  return value === "details" || value === "members" || value === "invites";
}

function OrgSettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();
  const [active, setActive] = useState<ActiveOrganization | null>(null);
  const [loading, setLoading] = useState(true);
  const showCreate = searchParams.get("create") === "1";
  const requestedTab = searchParams.get("tab");
  const initialTab = isOrgSettingsTab(requestedTab) ? requestedTab : "details";
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const current = await organizationService.current();
      setActive(current);
    } catch (err) {
      console.error("[org settings] load failed", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push(`${ROUTES.AUTH}?redirectTo=${ROUTES.ORG_SETTINGS}`);
      return;
    }
    void load();
  }, [authLoading, user, router, load]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  if (authLoading || loading || !user) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ background: v2.cream }}
      >
        <Spinner />
      </main>
    );
  }

  const orgName = active?.organization.name || "Workspace";

  const TITLES: Record<Tab, { eyebrow: string; h1: ReactElement; lead: string }> = {
    details: {
      eyebrow: "SETTINGS · ORG DETAILS",
      h1: (
        <>
          How the workspace <em style={{ fontStyle: "italic", color: v2.accent }}>shows up</em>.
        </>
      ),
      lead: "Identity, branding, and the danger zone.",
    },
    members: {
      eyebrow: "SETTINGS · MEMBERS",
      h1: (
        <>
          The people <em style={{ fontStyle: "italic", color: v2.accent }}>here</em>.
        </>
      ),
      lead: "Names, roles, and when each joined the workspace.",
    },
    invites: {
      eyebrow: "SETTINGS · INVITES",
      h1: (
        <>
          Who&rsquo;s next <em style={{ fontStyle: "italic", color: v2.accent }}>to join</em>.
        </>
      ),
      lead: "Pending invitations and recent acceptances.",
    },
  };

  const titleData = TITLES[activeTab];
  const sections = createOrgSettingsSections({
    active: activeTab,
    billingSub: "Workspace plan",
    onSectionSelect: (section) => {
      setActiveTab(section);
      router.replace(`${ROUTES.ORG_SETTINGS}?tab=${section}`);
    },
  });

  return (
    <V2OrgSettingsShell
      active={activeTab}
      orgName={orgName}
      eyebrow={titleData.eyebrow}
      title={titleData.h1}
      lead={titleData.lead}
      sections={sections}
    >
      <div className="space-y-6">
        {active ? (
          <>
            {activeTab === "details" && (
              <OrgDetailsForm
                organization={active.organization}
                role={active.role}
                onUpdated={(org) =>
                  setActive((prev) => (prev ? { ...prev, organization: org } : prev))
                }
              />
            )}
            {activeTab === "members" && (
              <MemberList
                organizationId={active.organization.id}
                currentUserId={user.id}
                currentRole={active.role}
              />
            )}
            {activeTab === "invites" &&
              (active.role === "owner" || active.role === "admin") && (
                <InvitePanel organizationId={active.organization.id} />
              )}
            {activeTab === "invites" &&
              !(active.role === "owner" || active.role === "admin") && (
                <p className="text-[14px]" style={{ color: v2.inkSoft }}>
                  Only owners and admins can manage invites.
                </p>
              )}
          </>
        ) : (
          <div
            className="rounded-lg p-6 flex items-center gap-2"
            style={{ background: v2.cream2, border: `1px solid ${v2.rule}`, color: v2.inkSoft }}
          >
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: v2.accent }} />
            Setting up your workspace…
          </div>
        )}

        {showCreate && (
          <CreateOrgForm
            onCreated={() => {
              router.replace(ROUTES.ORG_SETTINGS);
              void load();
            }}
          />
        )}
      </div>
    </V2OrgSettingsShell>
  );
}

export default function OrgSettingsPage() {
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
      <OrgSettingsContent />
    </Suspense>
  );
}
