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
import type {
  SavedMeetingRecord,
  MeetingTypeHint,
} from "@oscar/shared/types";
import {
  v2,
  v2Serif,
  V2Caps,
  V2WebHeader,
} from "@/components/v2/V2Primitives";

export default function MeetingsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) router.push("/auth?redirectTo=/meetings");
  }, [user, authLoading, router]);

  const {
    data: meetings = [],
    isLoading: meetingsLoading,
    isError,
  } = useMeetings(!authLoading && !!user);
  const updateMutation = useUpdateMeeting();
  const deleteMutation = useDeleteMeeting();

  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery);
  const [typeFilter, setTypeFilter] = useState<MeetingTypeHint | "all">("all");

  const filteredMeetings = useMemo(() => {
    let result = meetings;
    if (typeFilter !== "all") result = result.filter((m) => m.meetingTypeHint === typeFilter);
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
    async (id: string, updates: Partial<SavedMeetingRecord>): Promise<void> => {
      await updateMutation.mutateAsync({ id, updates });
    },
    [updateMutation]
  );

  const handleDelete = useCallback(
    async (id: string): Promise<void> => {
      await deleteMutation.mutateAsync(id);
    },
    [deleteMutation]
  );

  if (authLoading || meetingsLoading) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ background: v2.cream }}
      >
        <Spinner />
      </main>
    );
  }

  return (
    <main
      style={{
        background: v2.cream,
        color: v2.ink,
        minHeight: "100vh",
        fontFamily: "var(--font-figtree), system-ui",
      }}
    >
      <V2WebHeader active="MINUTES" />

      <section className="px-6 md:px-14 pt-16 md:pt-20 pb-10 md:pb-12">
        <V2Caps>
          MINUTES · {meetings.length} MEETING{meetings.length === 1 ? "" : "S"}
        </V2Caps>
        <h1
          className="mt-3"
          style={{
            fontFamily: v2Serif,
            fontSize: "clamp(48px, 9vw, 84px)",
            lineHeight: 0.96,
            letterSpacing: "-0.025em",
            fontWeight: 500,
          }}
        >
          What was <em style={{ fontStyle: "italic", color: v2.accent }}>decided</em>,
          <br />
          in order.
        </h1>
        <p className="mt-7 max-w-xl text-[16px] leading-relaxed" style={{ color: v2.inkSoft }}>
          Oscar listens to your meetings and writes back what mattered — decisions, actions,
          follow-ups. Publish the whole thing or just the parts that move work forward.
        </p>
      </section>

      <section className="px-6 md:px-14 pb-20" style={{ borderTop: `1px solid ${v2.rule}` }}>
        {isError && (
          <div
            className="mt-8 px-4 py-3 rounded-lg text-[13px]"
            style={{
              background: "rgba(184,98,61,0.08)",
              border: `1px solid ${v2.accent}`,
              color: v2.accent,
            }}
          >
            Failed to load meetings. Please refresh.
          </div>
        )}

        {meetings.length === 0 ? (
          <div className="py-20 text-center">
            <V2Caps color={v2.accent}>MINUTES · DAY ONE</V2Caps>
            <h3
              className="mt-3"
              style={{
                fontFamily: v2Serif,
                fontSize: 56,
                lineHeight: 0.98,
                letterSpacing: "-0.025em",
                fontWeight: 500,
              }}
            >
              No meetings <em style={{ color: v2.accent }}>yet</em>.
            </h3>
            <p
              className="mt-6 mx-auto max-w-md text-[15px] leading-relaxed"
              style={{ color: v2.inkSoft }}
            >
              Record a meeting on the Oscar desktop app. Decisions, actions, and follow-ups show
              up here.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-8 mb-6">
              <MeetingSearchBar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                typeFilter={typeFilter}
                onTypeChange={setTypeFilter}
              />
            </div>

            {filteredMeetings.length === 0 ? (
              <div className="py-16 text-center text-[14px]" style={{ color: v2.inkSoft }}>
                No meetings match this search.
              </div>
            ) : (
              <div className="space-y-4">
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
      </section>
    </main>
  );
}
