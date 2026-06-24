"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { meetingsService } from "@/lib/services/meetings.service";
import type {
  MeetingUpdate,
  SavedMeetingRecord,
  ActiveOrganization,
} from "@oscar/shared/types";
import { queryKeys } from "./keys";

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

export function useMeetings(enabled = true) {
  const { data: activeOrg } = useActiveOrg(enabled);

  return useQuery<SavedMeetingRecord[]>({
    queryKey: [queryKeys.meetings, activeOrg?.organization.id] as const,
    queryFn: async () => {
      const { data, error } = await meetingsService.getMeetings();
      if (error) throw error;
      
      // Filter meetings to only show those from the current organization
      // Personal meetings (organization_id is null) are always shown
      // Organization meetings must match the current active org
      const currentOrgId = activeOrg?.organization.id;
      const filtered = (data ?? []).filter(
        (m) => !m.organizationId || m.organizationId === currentOrgId
      );
      return filtered;
    },
    // Wait for the active-org lookup to settle, but never require it truthy:
    // a user with no org resolves activeOrg to null, and gating on !!activeOrg
    // would disable the query and blank the list. The filter above already
    // keeps personal meetings (organizationId null) when there is no active org.
    enabled: enabled && activeOrg !== undefined,
    // Meetings are distilled on the desktop app and written to Supabase out of
    // band, so the web list goes stale silently. Refetch when the window
    // regains focus (overrides the global default) so a freshly distilled
    // meeting shows up without a manual refresh. Scoped to this query only.
    refetchOnWindowFocus: true,
  });
}

export function useUpdateMeeting() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: MeetingUpdate }) => {
      const { data, error } = await meetingsService.updateMeeting(id, updates);
      if (error) throw error;
      if (!data) {
        throw new Error("Meeting update returned no data");
      }
      return data;
    },
    onSuccess: () => {
      // Invalidate all meeting query variations (with or without org filtering)
      qc.invalidateQueries({ queryKey: [queryKeys.meetings] });
    },
  });
}

export function useDeleteMeeting() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await meetingsService.deleteMeeting(id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      // Invalidate all meeting query variations
      qc.invalidateQueries({ queryKey: [queryKeys.meetings] });
    },
  });
}
