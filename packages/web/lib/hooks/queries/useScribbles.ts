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
import { queryKeys } from "./keys";

// refetchOnMount: "always" — the provider sets staleTime 30s + refetchOnWindowFocus
// false, so without this a client-side <Link> back into the library would serve the
// pre-mutation cache (a saved scribble / folder change would not appear until a hard
// refresh). "always" forces a network refetch every time the list page mounts.
export function useScribbles(enabled = true) {
  return useQuery<DBScribble[]>({
    queryKey: queryKeys.scribbles,
    queryFn: async () => {
      const { data, error } = await scribblesService.getScribbles();
      if (error) throw error;
      return data ?? [];
    },
    enabled,
    refetchOnMount: "always",
  });
}

export function useTrashedScribbles(enabled = true) {
  return useQuery<DBScribble[]>({
    queryKey: queryKeys.trashedScribbles,
    queryFn: async () => {
      const { data, error } = await scribblesService.getTrashedScribbles();
      if (error) throw error;
      return data ?? [];
    },
    enabled,
    refetchOnMount: "always",
  });
}

export function useFolders(enabled = true) {
  return useQuery<string[]>({
    queryKey: queryKeys.folders,
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
      qc.setQueryData<DBScribble[]>(queryKeys.scribbles, (prev) =>
        prev ? prev.map((s) => (s.id === updated.id ? updated : s)) : prev,
      );
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
      qc.setQueryData<DBScribble[]>(queryKeys.scribbles, (prev) =>
        prev ? prev.filter((s) => s.id !== id) : prev,
      );
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
