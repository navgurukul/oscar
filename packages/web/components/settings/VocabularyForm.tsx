"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

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
    <form onSubmit={handleSubmit} className="mb-6">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end">
        <div className="space-y-2">
          <Label htmlFor="term" className="text-xs text-gray-400">
            Term *
          </Label>
          <Input
            id="term"
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="e.g., Sourav"
            maxLength={100}
            className="bg-slate-800 border-slate-700 text-white placeholder-gray-500 focus-visible:ring-cyan-500 focus-visible:border-cyan-500"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pronunciation" className="text-xs text-gray-400">
            Sounds like
          </Label>
          <Input
            id="pronunciation"
            type="text"
            value={pronunciation}
            onChange={(e) => setPronunciation(e.target.value)}
            placeholder="e.g., Shourabh, Saurav"
            maxLength={100}
            className="bg-slate-800 border-slate-700 text-white placeholder-gray-500 focus-visible:ring-cyan-500 focus-visible:border-cyan-500"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="context" className="text-xs text-gray-400">
            Category
          </Label>
          <Input
            id="context"
            type="text"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="e.g., Person, Tech Term"
            maxLength={50}
            className="bg-slate-800 border-slate-700 text-white placeholder-gray-500 focus-visible:ring-cyan-500 focus-visible:border-cyan-500"
          />
        </div>
        <Button
          type="submit"
          disabled={isLoading || !term.trim()}
          className="border-2 hover:bg-cyan-600 px-2 h-9"
          variant="ghost"
        >
          {isLoading ? (
            <Spinner className="w-5 h-5" strokeWidth={2.5} />
          ) : (
            <Plus className="w-5 h-5" strokeWidth={2.5} />
          )}
        </Button>
      </div>
    </form>
  );
}
