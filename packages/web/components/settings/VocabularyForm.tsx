"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { v2, v2Mono, V2Mono } from "@/components/v2/V2Primitives";

interface VocabularyFormProps {
  onSubmit: (data: {
    term: string;
    pronunciation: string;
    context: string;
  }) => Promise<boolean>;
  isLoading: boolean;
}

export function VocabularyForm({ onSubmit, isLoading }: VocabularyFormProps) {
  const [term, setTerm] = useState("");
  const [pronunciation, setPronunciation] = useState("");
  const [context, setContext] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await onSubmit({
      term: term.trim(),
      pronunciation: pronunciation.trim(),
      context: context.trim(),
    });
    if (success) {
      setTerm("");
      setPronunciation("");
      setContext("");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div
        className="max-w-2xl flex items-center gap-3 rounded-full pl-5 pr-2 py-2"
        style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}
      >
        <V2Mono style={{ fontSize: 11, color: v2.inkFaint }}>ADD A WORD</V2Mono>
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="e.g. Hinglish, NavGurukul, processItems"
          maxLength={100}
          className="flex-1 bg-transparent outline-none py-2 text-[14px]"
          style={{ color: v2.ink }}
        />
        <button
          type="submit"
          disabled={isLoading || !term.trim()}
          className="text-[12px] rounded-full px-4 py-2 font-medium inline-flex items-center gap-1.5 disabled:opacity-40"
          style={{ background: v2.ink, color: v2.cream }}
        >
          {isLoading ? <Spinner className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          Add
        </button>
      </div>

      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl">
        <div className="flex items-center gap-3">
          <span
            style={{
              fontFamily: v2Mono,
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: v2.inkFaint,
              minWidth: 110,
            }}
          >
            SOUNDS LIKE
          </span>
          <input
            value={pronunciation}
            onChange={(e) => setPronunciation(e.target.value)}
            placeholder="e.g. nav-gu-roo-kul"
            maxLength={100}
            className="flex-1 bg-transparent outline-none py-1.5 text-[13px]"
            style={{ borderBottom: `1px solid ${v2.rule}`, color: v2.ink }}
          />
        </div>
        <div className="flex items-center gap-3">
          <span
            style={{
              fontFamily: v2Mono,
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: v2.inkFaint,
              minWidth: 90,
            }}
          >
            CATEGORY
          </span>
          <input
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Person · Tech · Org"
            maxLength={50}
            className="flex-1 bg-transparent outline-none py-1.5 text-[13px]"
            style={{ borderBottom: `1px solid ${v2.rule}`, color: v2.ink }}
          />
        </div>
      </div>
    </form>
  );
}
