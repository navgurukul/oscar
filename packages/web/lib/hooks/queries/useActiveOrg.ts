"use client";

import { useQuery } from "@tanstack/react-query";
import type { ActiveOrganization } from "@oscar/shared/types";
import { queryKeys } from "./keys";

/**
 * App-wide active-org fetch. Hits /api/org/current (cached on ["org","active"]),
 * which every signed-in list page already triggers, so the result is available
 * everywhere without a dedicated provider.
 */
export function useActiveOrg(enabled = true) {
  return useQuery<ActiveOrganization | null>({
    queryKey: queryKeys.activeOrg,
    queryFn: async () => {
      const response = await fetch("/api/org/current");
      if (!response.ok) return null;
      return response.json();
    },
    enabled,
    staleTime: Infinity, // Active org rarely changes
  });
}

/**
 * Single source of truth for "should ANY org/collaboration chrome show?".
 * False for a solo user whose only membership is their invisible personal org —
 * they see no switcher, no TEAM tab, no workspace settings, no share-to-workspace.
 * Returns false while the lookup is loading (chrome appears only once we KNOW the
 * user has a real team, never optimistically).
 */
export function useHasTeam(enabled = true): boolean {
  const { data } = useActiveOrg(enabled);
  return data?.hasTeam === true;
}
