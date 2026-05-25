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
    <div className="flex gap-3 items-center">
      <div
        className="relative flex-1 rounded-full"
        style={{ background: "#efeae0", border: "1px solid #e5e0d6" }}
      >
        <Search
          size={15}
          className="absolute left-4 top-1/2 -translate-y-1/2"
          style={{ color: "#8b8780" }}
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search meetings..."
          className="w-full pl-10 pr-4 py-2.5 bg-transparent outline-none text-sm"
          style={{ color: "#1a1816" }}
        />
      </div>
      <select
        value={typeFilter}
        onChange={(e) => onTypeChange(e.target.value as MeetingTypeHint | "all")}
        className="px-4 py-2.5 rounded-full text-sm cursor-pointer outline-none"
        style={{
          background: "transparent",
          border: "1px solid #e5e0d6",
          color: "#5a5852",
          fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
          fontSize: 11,
          letterSpacing: "0.06em",
        }}
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
