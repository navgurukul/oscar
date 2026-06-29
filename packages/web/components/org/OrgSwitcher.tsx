"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  Plus,
  Settings as SettingsIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { organizationService } from "@/lib/services/organization.service";
import { ROUTES } from "@/lib/constants";
import { v2 } from "@/components/v2/V2Primitives";
import type {
  ActiveOrganization,
  Organization,
  OrganizationRole,
} from "@oscar/shared/types";

type Membership = { organization: Organization; role: OrganizationRole };

export function OrgSwitcher() {
  const router = useRouter();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [active, setActive] = useState<ActiveOrganization | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [mine, current] = await Promise.all([
        organizationService.listMine(),
        organizationService.current(),
      ]);
      setMemberships(mine);
      setActive(current);
    } catch (err) {
      console.error("[OrgSwitcher] load failed", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const switchTo = useCallback(
    async (orgId: string) => {
      if (busy || active?.organization.id === orgId) return;
      setBusy(true);
      try {
        await organizationService.switchTo(orgId);
        router.refresh();
        await load();
      } catch (err) {
        console.error("[OrgSwitcher] switch failed", err);
      } finally {
        setBusy(false);
      }
    },
    [active?.organization.id, busy, load, router]
  );

  if (loading) return null;

  // Belt-and-suspenders: never render the switcher for a solo user (only a
  // personal org). The header already gates the mount on hasTeam; this guards
  // any other call-site. After lazy-heal there is always an active org, so the
  // old "no active org → Create workspace" branch is dead and intentionally gone.
  if (!active || !active.hasTeam) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors max-w-[220px]"
        style={{
          background: v2.cream2,
          border: `1px solid ${v2.rule}`,
          color: v2.ink,
        }}
        disabled={busy}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            height: 20,
            width: 20,
            borderRadius: 5,
            background: v2.accent,
            color: v2.cream,
            fontFamily: "var(--font-eb-garamond), Georgia, serif",
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          {active.organization.name.charAt(0).toUpperCase()}
        </span>
        <span className="truncate">{active.organization.name}</span>
        <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" style={{ color: v2.inkFaint }} />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-72"
        style={{ background: v2.cream, border: `1px solid ${v2.rule}`, color: v2.ink }}
      >
        <DropdownMenuLabel
          style={{
            fontFamily: "var(--font-ibm-plex-mono), ui-monospace, monospace",
            fontSize: 10,
            letterSpacing: "0.18em",
            color: v2.inkFaint,
            textTransform: "uppercase",
          }}
        >
          Workspaces
        </DropdownMenuLabel>
        {memberships.map(({ organization, role }) => {
          const isActive = organization.id === active.organization.id;
          return (
            <DropdownMenuItem
              key={organization.id}
              onClick={() => void switchTo(organization.id)}
              className="flex items-center justify-between gap-2 cursor-pointer py-2"
            >
              <div className="flex flex-col min-w-0">
                <span className="truncate text-[13px]" style={{ color: v2.ink }}>
                  {organization.name}
                </span>
                <span
                  className="capitalize"
                  style={{
                    fontFamily: "var(--font-ibm-plex-mono), ui-monospace, monospace",
                    fontSize: 10,
                    letterSpacing: "0.14em",
                    color: v2.inkFaint,
                    textTransform: "uppercase",
                  }}
                >
                  {role}
                </span>
              </div>
              {isActive ? <Check className="h-4 w-4" style={{ color: v2.accent }} /> : null}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator style={{ background: v2.rule }} />
        <DropdownMenuItem
          onClick={() => router.push(ROUTES.ORG_SETTINGS)}
          className="cursor-pointer"
        >
          <SettingsIcon className="h-4 w-4 mr-2" style={{ color: v2.inkSoft }} />
          <span style={{ fontSize: 13, color: v2.ink }}>Workspace settings</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => router.push(`${ROUTES.ORG_SETTINGS}?create=1`)}
          className="cursor-pointer"
        >
          <Plus className="h-4 w-4 mr-2" style={{ color: v2.inkSoft }} />
          <span style={{ fontSize: 13, color: v2.ink }}>Create workspace</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
