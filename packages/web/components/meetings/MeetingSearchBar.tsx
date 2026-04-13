"use client";

import { Search } from "lucide-react";
import type { MeetingTypeHint } from "@oscar/shared/types";

const MEETING_TYPES: { value: MeetingTypeHint | "all"; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: "discovery", label: "Discovery" },
  { value: "1on1", label: "1-on-1" },
  { value: "standup", label: "Stand-up" },
  { value: "general", label: "General" },
  { value: "auto", label: "Meeting" },
];

interface MeetingSearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  typeFilter: MeetingTypeHint | "all";
  onTypeChange: (type: MeetingTypeHint | "all") => void;
}

export function MeetingSearchBar({
  searchQuery,
  onSearchChange,
  typeFilter,
  onTypeChange,
}: MeetingSearchBarProps) {
  return (
    <div className="flex gap-3">
      <div className="relative flex-1">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search meetings..."
          className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 transition-all duration-150"
        />
      </div>
      <select
        value={typeFilter}
        onChange={(e) => onTypeChange(e.target.value as MeetingTypeHint | "all")}
        className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 transition-all duration-150 cursor-pointer"
      >
        {MEETING_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
    </div>
  );
}
