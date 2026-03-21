import type { LocalTranscript } from "../types/note.types";

interface TranscriptsSectionProps {
  transcripts: LocalTranscript[];
  onDeleteTranscript: (id: string) => void;
  onToggleStarTranscript: (id: string) => void;
  onClearAll: () => void;
}

export function TranscriptsSection({
  transcripts,
  onDeleteTranscript,
  onToggleStarTranscript,
  onClearAll,
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
            className="group bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors"
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
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => onToggleStarTranscript(t.id)}
                  className={`text-xs px-2 py-1 rounded ${
                    t.starred
                      ? "text-amber-500"
                      : "text-slate-400 hover:text-amber-500"
                  } transition-colors`}
                  title={t.starred ? "Unstar" : "Star"}
                >
                  {t.starred ? "\u2605" : "\u2606"}
                </button>
                <button
                  onClick={() => onDeleteTranscript(t.id)}
                  className="text-xs text-slate-400 hover:text-red-500 px-2 py-1 rounded transition-colors"
                  title="Delete"
                >
                  \u2715
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
