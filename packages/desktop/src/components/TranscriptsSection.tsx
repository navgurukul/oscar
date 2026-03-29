import { Sparkles } from "lucide-react";
import type { LocalTranscript } from "../types/note.types";

interface TranscriptsSectionProps {
  transcripts: LocalTranscript[];
  onDeleteTranscript: (id: string) => void;
  onClearAll: () => void;
  selectedTranscriptId?: string | null;
  onSelectTranscript?: (id: string | null) => void;
}

export function TranscriptsSection({
  transcripts,
  onDeleteTranscript,
  onClearAll,
  selectedTranscriptId,
  onSelectTranscript,
}: TranscriptsSectionProps) {
  if (!transcripts || transcripts.length === 0) {
    return (
      <div className="mt-8 text-center text-slate-400 text-sm">
        <p>No transcripts yet. Hold Ctrl+Space to start recording.</p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider">
          Recent Transcripts
        </h2>
        <button
          onClick={onClearAll}
          className="text-xs text-slate-400 hover:text-red-500 transition-colors"
        >
          Clear all
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {transcripts.map((t) => (
          <div
            key={t.id}
            className={`group bg-white border rounded-xl p-4 transition-colors cursor-pointer ${
              selectedTranscriptId === t.id
                ? "border-indigo-400 ring-2 ring-indigo-100"
                : "border-slate-200 hover:border-slate-300"
            }`}
            onClick={() => onSelectTranscript?.(selectedTranscriptId === t.id ? null : t.id)}
          >
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
              {t.text}
            </p>
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-slate-400">
                {new Date(t.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectTranscript?.(t.id);
                  }}
                  className={`text-xs px-2 py-1 rounded transition-colors flex items-center gap-1 ${
                    selectedTranscriptId === t.id
                      ? "text-indigo-500"
                      : "text-slate-400 hover:text-indigo-500 opacity-0 group-hover:opacity-100"
                  }`}
                  title="AI Actions"
                >
                  <Sparkles size={12} />
                  AI
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteTranscript(t.id);
                  }}
                  className="text-xs text-slate-400 hover:text-red-500 px-2 py-1 rounded transition-colors opacity-0 group-hover:opacity-100"
                  title="Delete"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
