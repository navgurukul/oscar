"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { scribblesService } from "@/lib/services/scribbles.service";
import type {
  DBScribble,
  DBScribbleUpdate,
} from "@/lib/types/scribble.types";
import type { ActiveOrganization } from "@oscar/shared/types";
import { queryKeys } from "./keys";

function useActiveOrg(enabled = true) {
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

// refetchOnMount: "always" — the provider sets staleTime 30s + refetchOnWindowFocus
// false, so without this a client-side <Link> back into the library would serve the
// pre-mutation cache (a saved scribble / folder change would not appear until a hard
// refresh). "always" forces a network refetch every time the list page mounts.
export function useScribbles(enabled = true) {
  const { data: activeOrg } = useActiveOrg(enabled);

  return useQuery<DBScribble[]>({
    queryKey: [queryKeys.scribbles, activeOrg?.organization.id] as const,
    queryFn: async () => {
      const { data, error } = await scribblesService.getScribbles();
      if (error) throw error;
      
      // Filter scribbles to show:
      // 1. Personal scribbles (organization_id is null)
      // 2. Scribbles shared with the current organization
      const currentOrgId = activeOrg?.organization.id;
      const filtered = (data ?? []).filter(
        (s) => !s.organization_id || s.organization_id === currentOrgId
      );
      return filtered;
    },
    enabled: enabled && !!activeOrg,
    refetchOnMount: "always",
  });
}

export function useTrashedScribbles(enabled = true) {
  const { data: activeOrg } = useActiveOrg(enabled);

  return useQuery<DBScribble[]>({
    queryKey: [queryKeys.trashedScribbles, activeOrg?.organization.id] as const,
    queryFn: async () => {
      const { data, error } = await scribblesService.getTrashedScribbles();
      if (error) throw error;
      
      // Filter to show only trashed scribbles from current org
      const currentOrgId = activeOrg?.organization.id;
      const filtered = (data ?? []).filter(
        (s) => !s.organization_id || s.organization_id === currentOrgId
      );
      return filtered;
    },
    enabled: enabled && !!activeOrg,
    refetchOnMount: "always",
  });
}

export function useFolders(enabled = true) {
  const { data: activeOrg } = useActiveOrg(enabled);

  return useQuery<string[]>({
    queryKey: [queryKeys.folders, activeOrg?.organization.id] as const,
    queryFn: async () => {
      const { data, error } = await scribblesService.getFolders();
      if (error) throw error;
      return data ?? [];
    },
    enabled,
    refetchOnMount: "always",
  });
}

export function useUpdateScribble() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: DBScribbleUpdate;
    }) => {
      const { data, error } = await scribblesService.updateScribble(id, updates);
      if (error) throw error;
      return data!;
    },
    onSuccess: (updated) => {
      // Invalidate all scribble query variations
      qc.invalidateQueries({ queryKey: [queryKeys.scribbles] });
      qc.invalidateQueries({ queryKey: queryKeys.folders });
    },
  });
}

export function useDeleteScribble() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await scribblesService.deleteScribble(id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      // Invalidate all scribble query variations
      qc.invalidateQueries({ queryKey: [queryKeys.scribbles] });
      qc.invalidateQueries({ queryKey: queryKeys.trashedScribbles });
    },
  });
}

export function useRestoreScribble() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await scribblesService.restoreScribble(id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.scribbles });
      qc.invalidateQueries({ queryKey: queryKeys.trashedScribbles });
    },
  });
}
