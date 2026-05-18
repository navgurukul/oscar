"use client";

import { useState, useEffect, useMemo, useDeferredValue, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import {
  useMeetings,
  useUpdateMeeting,
  useDeleteMeeting,
} from "@/lib/hooks/queries/useMeetings";
import { Spinner } from "@/components/ui/spinner";
import { MeetingCard } from "@/components/meetings/MeetingCard";
import { MeetingSearchBar } from "@/components/meetings/MeetingSearchBar";
import { MeetingEmptyState } from "@/components/meetings/MeetingEmptyState";
import type {
  SavedMeetingRecord,
  MeetingTypeHint,
} from "@oscar/shared/types";

export default function MeetingsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) router.push("/auth");
  }, [user, authLoading, router]);

  const {
    data: meetings = [],
    isLoading: meetingsLoading,
    isError,
  } = useMeetings(!authLoading && !!user);
  const updateMutation = useUpdateMeeting();
  const deleteMutation = useDeleteMeeting();

  // Search & filter
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery);
  const [typeFilter, setTypeFilter] = useState<MeetingTypeHint | "all">("all");

  const filteredMeetings = useMemo(() => {
    let result = meetings;
    if (typeFilter !== "all") {
      result = result.filter((m) => m.meetingTypeHint === typeFilter);
    }
    if (deferredSearch.trim()) {
      const q = deferredSearch.toLowerCase();
      result = result.filter(
        (m) =>
          m.meetingTitle.toLowerCase().includes(q) ||
          m.attendeesCompact.toLowerCase().includes(q) ||
          m.notesMarkdown.toLowerCase().includes(q) ||
          m.myNotesMarkdown.toLowerCase().includes(q)
      );
    }
    return result;
  }, [meetings, typeFilter, deferredSearch]);

  const handleUpdate = useCallback(
    async (id: string, updates: Partial<SavedMeetingRecord>) => {
      await updateMutation.mutateAsync({ id, updates });
    },
    [updateMutation]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteMutation.mutateAsync(id);
    },
    [deleteMutation]
  );

  const error = isError ? "Failed to load meetings. Please try again." : null;

  if (authLoading || meetingsLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Spinner className="text-cyan-500" />
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 pt-28 pb-24 max-w-2xl mx-auto">
      {/* Page header */}
      <div className="mb-6 space-y-1">
        <h1 className="text-3xl font-bold text-white">Meetings</h1>
        <p className="text-slate-400 text-sm">
          Meeting notes recorded on the OSCAR desktop app. Edit notes, copy, and
          share from here.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-950/60 border border-red-800/50 text-red-300 text-sm">
          {error}
        </div>
      )}

      {meetings.length === 0 ? (
        <MeetingEmptyState />
      ) : (
        <>
          <div className="mb-5">
            <MeetingSearchBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              typeFilter={typeFilter}
              onTypeChange={setTypeFilter}
            />
          </div>

          {filteredMeetings.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-slate-400 text-sm">
                No meetings match your search.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMeetings.map((m) => (
                <MeetingCard
                  key={m.id}
                  meeting={m}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
