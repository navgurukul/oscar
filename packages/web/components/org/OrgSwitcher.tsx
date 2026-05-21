"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Plus, Settings as SettingsIcon, Users } from "lucide-react";
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

  if (loading || !active) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2 rounded-lg border border-cyan-700/30 bg-slate-900/80 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 transition-colors max-w-[220px]"
        disabled={busy}
      >
        <Users className="h-4 w-4 text-cyan-400 flex-shrink-0" />
        <span className="truncate">{active.organization.name}</span>
        <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-64 bg-slate-900 border-cyan-700/30 text-white"
      >
        <DropdownMenuLabel className="text-gray-400 text-xs uppercase tracking-wide">
          Switch workspace
        </DropdownMenuLabel>
        {memberships.map(({ organization, role }) => {
          const isActive = organization.id === active.organization.id;
          return (
            <DropdownMenuItem
              key={organization.id}
              onClick={() => void switchTo(organization.id)}
              className="flex items-center justify-between gap-2 cursor-pointer focus:bg-slate-800"
            >
              <div className="flex flex-col min-w-0">
                <span className="truncate text-sm">{organization.name}</span>
                <span className="text-xs text-gray-500 capitalize">{role}</span>
              </div>
              {isActive ? <Check className="h-4 w-4 text-cyan-400" /> : null}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator className="bg-cyan-700/30" />
        <DropdownMenuItem
          onClick={() => router.push(ROUTES.ORG_SETTINGS)}
          className="cursor-pointer focus:bg-slate-800"
        >
          <SettingsIcon className="h-4 w-4 mr-2 text-gray-400" />
          Organization settings
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => router.push(`${ROUTES.ORG_SETTINGS}?create=1`)}
          className="cursor-pointer focus:bg-slate-800"
        >
          <Plus className="h-4 w-4 mr-2 text-gray-400" />
          Create workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
