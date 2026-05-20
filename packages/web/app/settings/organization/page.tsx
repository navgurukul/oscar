"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
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
import { isOrgFeatureEnabled } from "@/lib/featureFlags";
import type { ActiveOrganization } from "@oscar/shared/types";

function OrgSettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();
  const [active, setActive] = useState<ActiveOrganization | null>(null);
  const [loading, setLoading] = useState(true);
  const showCreate = searchParams.get("create") === "1";

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

  if (!isOrgFeatureEnabled()) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl text-white mb-2">Workspaces are not enabled</h1>
          <p className="text-gray-400">Ask an admin to enable the organization feature flag.</p>
        </div>
      </main>
    );
  }

  if (authLoading || loading || !user) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Spinner className="text-cyan-500" />
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center px-4 pt-8 pb-24">
      <div className="w-full max-w-3xl mt-16 space-y-6">
        <header className="mb-2 mt-5">
          <h1 className="text-3xl font-bold text-white mb-2">Organization</h1>
          <p className="text-gray-400">Manage your workspace, members, and invites.</p>
        </header>

        {active ? (
          <>
            <OrgDetailsForm
              organization={active.organization}
              role={active.role}
              onUpdated={(org) =>
                setActive((prev) => (prev ? { ...prev, organization: org } : prev))
              }
            />
            <MemberList
              organizationId={active.organization.id}
              currentUserId={user.id}
              currentRole={active.role}
            />
            {(active.role === "owner" || active.role === "admin") && (
              <InvitePanel organizationId={active.organization.id} />
            )}
          </>
        ) : (
          <div className="rounded-lg border border-cyan-700/30 bg-slate-900 p-6 text-gray-300 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
            Setting up your workspace...
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
    </main>
  );
}

export default function OrgSettingsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center">
          <Spinner className="text-cyan-500" />
        </main>
      }
    >
      <OrgSettingsContent />
    </Suspense>
  );
}
