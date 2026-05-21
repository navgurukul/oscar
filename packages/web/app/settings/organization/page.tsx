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
import { isOrgFeatureEnabled } from "@/lib/featureFlags";
import type { ActiveOrganization } from "@oscar/shared/types";
import Link from "next/link";
import {
  v2,
  v2Serif,
  V2Caps,
  V2TeamHeader,
} from "@/components/v2/V2Primitives";

type Tab = "details" | "members" | "invites";

function OrgSettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();
  const [active, setActive] = useState<ActiveOrganization | null>(null);
  const [loading, setLoading] = useState(true);
  const showCreate = searchParams.get("create") === "1";
  const initialTab = (searchParams.get("tab") as Tab) || "details";
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

  if (!isOrgFeatureEnabled()) {
    return (
      <main
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: v2.cream, color: v2.ink }}
      >
        <div className="text-center">
          <h1
            className="mb-2"
            style={{
              fontFamily: v2Serif,
              fontSize: 28,
              fontWeight: 500,
              letterSpacing: "-0.015em",
            }}
          >
            Workspaces are not enabled
          </h1>
          <p style={{ color: v2.inkSoft }}>Ask an admin to enable the organization feature flag.</p>
        </div>
      </main>
    );
  }

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

  const SECTIONS: Array<{ id: Tab; label: string }> = [
    { id: "details", label: "Details" },
    { id: "members", label: "Members & roles" },
    { id: "invites", label: "Invites" },
  ];

  const EXTERNAL_LINKS: Array<{ href: string; label: string }> = [
    { href: "/settings/organization/billing", label: "Billing" },
    { href: "/settings/organization/analytics", label: "Analytics" },
    { href: "/settings/organization/audit", label: "Audit log" },
  ];

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

  return (
    <main
      style={{
        background: v2.cream,
        color: v2.ink,
        minHeight: "100vh",
        fontFamily: "var(--font-figtree), system-ui",
      }}
    >
      <V2TeamHeader active="SETTINGS" org={orgName} />
      <div className="grid grid-cols-12 px-6 md:px-14 py-10 md:py-14 gap-10">
        <aside className="col-span-12 md:col-span-3">
          <V2Caps>ORG SETTINGS</V2Caps>
          <nav className="mt-5 space-y-5">
            {SECTIONS.map((s) => {
              const isActive = activeTab === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveTab(s.id)}
                  className="w-full text-left"
                  style={{
                    borderLeft: isActive ? `2px solid ${v2.accent}` : "2px solid transparent",
                    paddingLeft: 14,
                  }}
                >
                  <div
                    style={{
                      fontFamily: v2Serif,
                      fontSize: 18,
                      fontWeight: 500,
                      color: isActive ? v2.ink : v2.inkSoft,
                      letterSpacing: "-0.005em",
                    }}
                  >
                    {s.label}
                  </div>
                </button>
              );
            })}
            <div style={{ height: 12 }} />
            {EXTERNAL_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="block"
                style={{ borderLeft: "2px solid transparent", paddingLeft: 14 }}
              >
                <div
                  style={{
                    fontFamily: v2Serif,
                    fontSize: 18,
                    fontWeight: 500,
                    color: v2.inkSoft,
                    letterSpacing: "-0.005em",
                  }}
                >
                  {l.label}
                  <span style={{ marginLeft: 8, color: v2.inkFaint, fontSize: 13 }}>→</span>
                </div>
              </Link>
            ))}
          </nav>
        </aside>

        <section className="col-span-12 md:col-span-9">
          <V2Caps>{titleData.eyebrow}</V2Caps>
          <h1
            className="mt-2"
            style={{
              fontFamily: v2Serif,
              fontSize: "clamp(36px, 5.5vw, 52px)",
              lineHeight: 0.98,
              letterSpacing: "-0.025em",
              fontWeight: 500,
            }}
          >
            {titleData.h1}
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed max-w-xl" style={{ color: v2.inkSoft }}>
            {titleData.lead}
          </p>

          <div className="mt-10 space-y-6">
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
        </section>
      </div>
    </main>
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
