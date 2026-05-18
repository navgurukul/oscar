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
} from "@oscar/shared/types";
import { queryKeys } from "./keys";

export function useMeetings(enabled = true) {
  return useQuery<SavedMeetingRecord[]>({
    queryKey: queryKeys.meetings,
    queryFn: async () => {
      const { data, error } = await meetingsService.getMeetings();
      if (error) throw error;
      return data ?? [];
    },
    enabled,
  });
}

export function useUpdateMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: MeetingUpdate }) => {
      const { data, error } = await meetingsService.updateMeeting(id, updates);
      if (error) throw error;
      return data!;
    },
    onSuccess: (updated) => {
      qc.setQueryData<SavedMeetingRecord[]>(queryKeys.meetings, (prev) =>
        prev ? prev.map((m) => (m.id === updated.id ? updated : m)) : prev,
      );
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
    onSuccess: (id) => {
      qc.setQueryData<SavedMeetingRecord[]>(queryKeys.meetings, (prev) =>
        prev ? prev.filter((m) => m.id !== id) : prev,
      );
    },
  });
}
