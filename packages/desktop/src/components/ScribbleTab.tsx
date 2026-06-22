import { useState, useEffect, useMemo, useRef } from "react";
import {
  Search,
  Star,
  Trash2,
  Loader2,
  Mic,
  Square,
  Download,
  FileText,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Sparkles,
  X,
  Pencil,
  Folder,
  Plus,
  Upload,
  RotateCcw,
  Wand2,
  Languages,
  Share2,
} from "lucide-react";
import { AIPanel, type AIMode } from "./AIPanel";
import { ContextLabel } from "./ContextLabel";
import { TrashPanel } from "./TrashPanel";
import { CaptureTakeover } from "./scribble/CaptureTakeover";
import { ProcessingScreen } from "./scribble/ProcessingScreen";
import { TransformView } from "./scribble/TransformView";
import { TranslateView } from "./scribble/TranslateView";
import { ShareModal } from "./scribble/ShareModal";
import { scribblesService } from "../services/scribbles.service";
import { formatScribbleDate } from "../lib/utils";
import type { DBScribble } from "../types/scribble.types";

type SortOption = "created" | "updated" | "length";
type DetailMode = "read" | "edit" | "transform" | "translate";
type SaveState = "idle" | "saving" | "saved";

interface ScribbleTabProps {
  userId: string;
  refreshKey?: number;
  isRecording: boolean;
  isProcessing?: boolean;
  statusMessage?: string | null;
  onToggleRecording: () => void;
  /** Import an existing audio file as a Scribble (decode → transcribe → save). */
  onImportAudio?: (file: File) => void;
  recordingTime: number;
}

interface FolderSummary {
  name: string;
  count: number;
}

const ITEMS_PER_PAGE = 30;

function wordCount(text: string | null | undefined): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function cleanBody(s: DBScribble): string {
  return s.edited_text || s.original_formatted_text || "";
}

/** "SCRIBBLE · MAY 18 · 13:42 · IN PRICING" — mono caption above the title. */
function buildMeta(s: DBScribble): string {
  const d = new Date(s.created_at);
  const date = d
    .toLocaleDateString("en-US", { month: "short", day: "numeric" })
    .toUpperCase();
  const time = d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = ["SCRIBBLE", date, time];
  if (s.folder && s.folder.trim()) parts.push(`IN ${s.folder.toUpperCase()}`);
  return parts.join(" · ");
}

function Caps({
  children,
  tone = "faint",
  className = "",
}: {
  children: React.ReactNode;
  tone?: "faint" | "ink" | "terra";
  className?: string;
}) {
  const toneClass =
    tone === "terra"
      ? "text-terracotta"
      : tone === "ink"
        ? "text-ink"
        : "text-ink-faint";
  return (
    <span
      className={`font-mono text-[10px] tracking-[0.18em] uppercase ${toneClass} ${className}`}
    >
      {children}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EMPTY / FIRST-RUN — nothing kept yet (design screen 01)
// ═══════════════════════════════════════════════════════════════════════════
function EmptyState({
  isRecording,
  isProcessing,
  onStart,
  onPickFile,
}: {
  isRecording: boolean;
  isProcessing: boolean;
  onStart: () => void;
  onPickFile: () => void;
}) {
  const examples: [string, string][] = [
    ["A QUICK THOUGHT", "The one idea you don’t want to lose before standup."],
    ["A LONG RAMBLE", "Twelve minutes out loud. Oscar finds the spine."],
    ["A VOICE MEMO", "Speak it once. Oscar keeps a clean version too."],
  ];
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-16 text-center bg-cream overflow-y-auto">
      <Caps>SCRIBBLES · 0 KEPT</Caps>
      <h1
        className="mt-4 font-serif font-medium text-ink"
        style={{
          fontSize: 56,
          lineHeight: 0.98,
          letterSpacing: "-0.03em",
          maxWidth: 620,
        }}
      >
        Say it once.{" "}
        <em className="italic text-terracotta">Oscar keeps</em> the rest.
      </h1>
      <p
        className="mt-6 text-[15px] leading-relaxed text-ink-soft"
        style={{ maxWidth: 460 }}
      >
        A Scribble is a thought you spoke aloud. Oscar transcribes it on-device,
        strips the filler, and writes a clean version &mdash; you keep both.
      </p>

      {/* Scribble starts with a click — the audio pen. Not the dictation
          hotkey (Ctrl+Space is for streaming into other apps). */}
      {/* Single control on the empty screen: this button IS the audio pen —
          it toggles start → stop in place. The floating record control is
          suppressed here (see ScribbleTab) so there's never a double control. */}
      <div className="mt-10 flex flex-col items-center gap-3.5">
        <button
          type="button"
          onClick={onStart}
          disabled={isProcessing}
          title={isRecording ? "Stop recording" : undefined}
          className="inline-flex items-center gap-3 rounded-full pl-3 pr-6 py-2.5 bg-ink text-cream border-none cursor-pointer shadow-lg transition-opacity hover:opacity-90 disabled:cursor-wait"
        >
          <span
            className="inline-flex items-center justify-center rounded-full bg-terracotta shrink-0"
            style={{ height: 34, width: 34 }}
          >
            {isRecording ? (
              <Square size={13} fill="currentColor" />
            ) : isProcessing ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Mic size={15} />
            )}
          </span>
          <span className="text-[15px] font-medium">
            {isRecording ? "Stop recording" : isProcessing ? "Distilling…" : "Start a Scribble"}
          </span>
        </button>
        {isRecording ? (
          <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-terracotta">
            ● Recording on this Mac · click to stop
          </p>
        ) : isProcessing ? (
          <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-faint">
            Oscar is distilling your Scribble…
          </p>
        ) : (
          <>
            <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-faint">
              Click to record · your voice stays on this Mac
            </p>
            <button
              type="button"
              onClick={onPickFile}
              className="mt-1 inline-flex items-center gap-1.5 text-[12px] text-ink-soft bg-transparent border-none cursor-pointer hover:text-ink transition-colors"
            >
              <Upload size={12} /> or import an audio file
            </button>
          </>
        )}
      </div>

      <div
        className="mt-14 grid grid-cols-3 gap-5"
        style={{ maxWidth: 620 }}
      >
        {examples.map(([cap, body]) => (
          <div
            key={cap}
            className="text-left rounded-lg p-4 bg-cream-200 border border-cream-300"
          >
            <Caps>{cap}</Caps>
            <p className="mt-2 text-[12.5px] leading-relaxed text-ink-soft">
              {body}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LOAD-ERROR — initial fetch failed (distinct from the first-run empty state)
// ═══════════════════════════════════════════════════════════════════════════
function LoadErrorState({
  message,
  onRetry,
  isRetrying,
}: {
  message: string | null;
  onRetry: () => void;
  isRetrying: boolean;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-16 text-center bg-cream">
      <Caps tone="terra">SCRIBBLES · COULDN&rsquo;T LOAD</Caps>
      <h1
        className="mt-4 font-serif font-medium text-ink"
        style={{ fontSize: 44, lineHeight: 1.0, letterSpacing: "-0.025em", maxWidth: 540 }}
      >
        We couldn&rsquo;t reach your{" "}
        <em className="italic text-terracotta">Scribbles</em>.
      </h1>
      <p
        className="mt-5 text-[14px] leading-relaxed text-ink-soft"
        style={{ maxWidth: 420 }}
      >
        {message || "Something went wrong loading your library."} Check your
        connection and try again &mdash; nothing was lost.
      </p>
      <button
        type="button"
        onClick={onRetry}
        disabled={isRetrying}
        className="mt-8 inline-flex items-center gap-2 rounded-full px-5 py-2.5 bg-ink text-cream text-[13px] font-medium border-none cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-60 disabled:cursor-wait"
      >
        {isRetrying ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <RotateCcw size={13} />
        )}
        {isRetrying ? "Retrying…" : "Try again"}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MOVE-TO-FOLDER popover (design screen 07)
// ═══════════════════════════════════════════════════════════════════════════
function FolderPopover({
  folders,
  current,
  onMove,
  onClose,
}: {
  folders: FolderSummary[];
  current: string | null;
  onMove: (folder: string | null) => void;
  onClose: () => void;
}) {
  const [newName, setNewName] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);

  const createAndMove = () => {
    const name = newName.trim();
    if (!name) return;
    onMove(name);
  };

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-1.5 z-30 w-64 rounded-xl bg-cream border border-cream-300 overflow-hidden"
      style={{ boxShadow: "0 16px 44px rgba(26,24,22,0.18)" }}
    >
      <div className="px-3.5 py-2.5 border-b border-cream-300">
        <Caps>MOVE TO FOLDER</Caps>
      </div>
      <div className="py-1.5 max-h-56 overflow-y-auto">
        <button
          type="button"
          onClick={() => onMove(null)}
          className="w-full flex items-center justify-between px-3.5 py-2 bg-transparent border-none cursor-pointer hover:bg-cream-100"
        >
          <span className="flex items-center gap-2.5">
            <span
              className={`inline-block h-2 w-2 rounded-sm ${
                current === null ? "bg-terracotta" : "bg-cream-400"
              }`}
            />
            <span
              className={`text-[13px] ${current === null ? "text-ink font-medium" : "text-ink-soft"}`}
            >
              No folder
            </span>
          </span>
        </button>
        {folders.map((f) => {
          const on = f.name === current;
          return (
            <button
              key={f.name}
              type="button"
              onClick={() => onMove(f.name)}
              className={`w-full flex items-center justify-between px-3.5 py-2 bg-transparent border-none cursor-pointer hover:bg-cream-100 ${
                on ? "bg-cream-200" : ""
              }`}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`inline-block h-2 w-2 rounded-sm shrink-0 ${
                    on ? "bg-terracotta" : "bg-cream-400"
                  }`}
                />
                <span
                  className={`text-[13px] truncate ${on ? "text-ink font-medium" : "text-ink"}`}
                >
                  {f.name}
                </span>
              </span>
              <span className="font-mono text-[10px] text-ink-faint shrink-0 ml-2">
                {f.count}
              </span>
            </button>
          );
        })}
      </div>
      <div className="px-3.5 py-2.5 flex items-center gap-2 border-t border-cream-300">
        <Plus size={14} className="text-terracotta shrink-0" />
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") createAndMove();
          }}
          placeholder="New folder…"
          className="flex-1 bg-transparent outline-none border-none text-[13px] text-ink placeholder-ink-faint font-sans min-w-0"
        />
        {newName.trim() && (
          <button
            type="button"
            onClick={createAndMove}
            className="font-mono text-[10px] tracking-[0.14em] uppercase text-terracotta bg-transparent border-none cursor-pointer hover:opacity-80"
          >
            ADD
          </button>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ADD-TAG popover (bulk organize)
// ═══════════════════════════════════════════════════════════════════════════
function TagInputPopover({
  onAdd,
  onClose,
}: {
  onAdd: (tag: string) => void;
  onClose: () => void;
}) {
  const [val, setVal] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);

  const submit = () => {
    const t = val.trim();
    if (!t) return;
    onAdd(t);
  };

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-1.5 z-30 w-56 rounded-xl bg-cream border border-cream-300 overflow-hidden"
      style={{ boxShadow: "0 16px 44px rgba(26,24,22,0.18)" }}
    >
      <div className="px-3.5 py-2.5 border-b border-cream-300">
        <Caps>ADD A TAG</Caps>
      </div>
      <div className="px-3.5 py-2.5 flex items-center gap-2">
        <span className="text-ink-faint text-[13px]">#</span>
        <input
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="tag name…"
          className="flex-1 bg-transparent outline-none border-none text-[13px] text-ink placeholder-ink-faint font-sans min-w-0"
        />
        {val.trim() && (
          <button
            type="button"
            onClick={submit}
            className="font-mono text-[10px] tracking-[0.14em] uppercase text-terracotta bg-transparent border-none cursor-pointer hover:opacity-80"
          >
            ADD
          </button>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LIST ROW
// ═══════════════════════════════════════════════════════════════════════════
function ScribbleRow({
  scribble,
  isActive,
  onClick,
  selectable = false,
  checked = false,
  onToggleCheck,
}: {
  scribble: DBScribble;
  isActive: boolean;
  onClick: () => void;
  selectable?: boolean;
  checked?: boolean;
  onToggleCheck?: () => void;
}) {
  const preview = (() => {
    const text = cleanBody(scribble);
    return text.length > 110 ? text.slice(0, 110) + "…" : text;
  })();

  return (
    <button
      type="button"
      onClick={selectable ? onToggleCheck : onClick}
      className={`w-full text-left px-5 py-4 border-b border-cream-300 transition-colors cursor-pointer bg-transparent border-l-0 border-r-0 border-t-0 ${
        (selectable ? checked : isActive) ? "bg-cream-200" : "hover:bg-cream-100"
      }`}
    >
      <div className="flex items-start gap-3">
        {selectable && (
          <span
            className={`mt-0.5 h-4 w-4 rounded inline-flex items-center justify-center shrink-0 border-[1.6px] ${
              checked ? "bg-terracotta border-terracotta" : "border-cream-400"
            }`}
          >
            {checked && <Check size={10} className="text-cream" />}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] tracking-[0.04em] text-ink">
              {formatScribbleDate(scribble.created_at)}
            </span>
            <ContextLabel
              appKey={scribble.dictation_app_key}
              source={scribble.dictation_context_source}
              variant="compact"
            />
          </div>
          <h3
            className="mt-1.5 font-serif text-[16px] font-medium text-ink leading-[1.2]"
            style={{ letterSpacing: "-0.005em" }}
          >
            {scribble.title || "Untitled Scribble"}
          </h3>
          <p className="mt-1 text-[12px] text-ink-soft leading-relaxed line-clamp-2">
            {preview}
          </p>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {scribble.folder && scribble.folder.trim() && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-cream-200 border border-cream-300 text-[10.5px] text-ink-soft">
                <span className="inline-block h-1.5 w-1.5 rounded-sm bg-terracotta" />
                {scribble.folder}
              </span>
            )}
            {(scribble.tags ?? []).slice(0, 3).map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 bg-cream-200 border border-cream-300 text-[10.5px] text-ink-soft"
              >
                <span className="text-ink-faint">#</span>
                {t}
              </span>
            ))}
            {scribble.is_starred && (
              <Star size={10} className="text-terracotta" fill="currentColor" />
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// READING VIEW — raw voice ‖ Oscar's clean version (design screens 04 / 05)
// ═══════════════════════════════════════════════════════════════════════════
interface ReadingViewProps {
  scribble: DBScribble;
  folders: FolderSummary[];
  isAIOpen: boolean;
  copyState: "idle" | "clean" | "raw";
  isDeleting: boolean;
  onEdit: () => void;
  onTransform: () => void;
  onTranslate: () => void;
  onShare: () => void;
  onToggleAI: () => void;
  onReshape: (mode: AIMode) => void;
  onCopyClean: () => void;
  onCopyRaw: () => void;
  onToggleStar: () => void;
  onMoveToFolder: (folder: string | null) => void;
  onExportTxt: () => void;
  onExportMarkdown: () => void;
  onDelete: () => void;
}

const RESHAPE_PROMPTS: { mode: AIMode; label: string }[] = [
  { mode: "bullets", label: "Pull out the action items" },
  { mode: "email", label: "Reshape as an email draft" },
  { mode: "summary", label: "Summarize in 3–5 sentences" },
];

function ReadingView({
  scribble,
  folders,
  isAIOpen,
  copyState,
  isDeleting,
  onEdit,
  onTransform,
  onTranslate,
  onShare,
  onToggleAI,
  onReshape,
  onCopyClean,
  onCopyRaw,
  onToggleStar,
  onMoveToFolder,
  onExportTxt,
  onExportMarkdown,
  onDelete,
}: ReadingViewProps) {
  const [folderOpen, setFolderOpen] = useState(false);
  const clean = cleanBody(scribble);
  const raw = scribble.raw_text || "";
  const hasRaw = raw.trim().length > 0 && raw.trim() !== clean.trim();

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-cream">
      {/* Action bar */}
      <div className="flex items-center justify-between gap-3 px-8 py-3 border-b border-cream-300 shrink-0">
        <Caps className="flex items-center gap-1.5">
          {scribble.folder ? `SCRIBBLES · ${scribble.folder.toUpperCase()}` : "SCRIBBLES"}
        </Caps>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-medium bg-ink text-cream border-none cursor-pointer transition-opacity hover:opacity-90"
          >
            <Pencil size={11} /> Edit
          </button>
          <button
            type="button"
            onClick={onTransform}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] border border-cream-300 text-ink-soft bg-transparent hover:text-terracotta hover:border-terracotta/50 cursor-pointer transition-colors"
          >
            <Wand2 size={11} /> Transform
          </button>
          <button
            type="button"
            onClick={onTranslate}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] border border-cream-300 text-ink-soft bg-transparent hover:text-terracotta hover:border-terracotta/50 cursor-pointer transition-colors"
          >
            <Languages size={11} /> Translate
          </button>
          <button
            type="button"
            onClick={onShare}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] border border-cream-300 text-ink-soft bg-transparent hover:text-terracotta hover:border-terracotta/50 cursor-pointer transition-colors"
          >
            <Share2 size={11} /> Share
          </button>
          <button
            type="button"
            onClick={onToggleAI}
            aria-pressed={isAIOpen}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] border bg-transparent cursor-pointer transition-colors ${
              isAIOpen
                ? "border-terracotta text-terracotta"
                : "border-cream-300 text-ink-soft hover:text-terracotta hover:border-terracotta/50"
            }`}
          >
            {isAIOpen ? <X size={11} /> : <Sparkles size={11} />}
            {isAIOpen ? "Close AI" : "Ask Oscar"}
          </button>
          <span className="w-px h-4 bg-cream-300 mx-0.5" />
          <button
            type="button"
            onClick={onCopyClean}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] border border-cream-300 text-ink-soft bg-transparent hover:text-ink cursor-pointer transition-colors"
          >
            {copyState === "clean" ? <Check size={11} /> : <Copy size={11} />}
            {copyState === "clean" ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={onToggleStar}
            title={scribble.is_starred ? "Starred" : "Star"}
            className={`inline-flex items-center justify-center rounded-full h-7 w-7 border bg-transparent cursor-pointer transition-colors ${
              scribble.is_starred
                ? "border-terracotta text-terracotta"
                : "border-cream-300 text-ink-soft hover:text-ink"
            }`}
          >
            <Star size={12} fill={scribble.is_starred ? "currentColor" : "none"} />
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setFolderOpen((v) => !v)}
              title="Move to folder"
              className={`inline-flex items-center justify-center rounded-full h-7 w-7 border bg-transparent cursor-pointer transition-colors ${
                folderOpen
                  ? "border-terracotta text-terracotta"
                  : "border-cream-300 text-ink-soft hover:text-ink"
              }`}
            >
              <Folder size={12} />
            </button>
            {folderOpen && (
              <FolderPopover
                folders={folders}
                current={scribble.folder ?? null}
                onMove={(f) => {
                  onMoveToFolder(f);
                  setFolderOpen(false);
                }}
                onClose={() => setFolderOpen(false)}
              />
            )}
          </div>
          <button
            type="button"
            onClick={onExportTxt}
            title="Export as .txt"
            className="inline-flex items-center justify-center rounded-full h-7 w-7 border border-cream-300 text-ink-soft bg-transparent hover:text-ink cursor-pointer transition-colors"
          >
            <Download size={12} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={isDeleting}
            title="Delete"
            className="inline-flex items-center justify-center rounded-full h-7 w-7 border border-cream-300 text-ink-faint bg-transparent hover:text-[#8c2f25] hover:border-[#8c2f25] cursor-pointer transition-colors"
          >
            {isDeleting ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Trash2 size={12} />
            )}
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-10 py-9">
        <div className="mx-auto" style={{ maxWidth: 920 }}>
          <ContextLabel
            appKey={scribble.dictation_app_key}
            source={scribble.dictation_context_source}
          />
          <p className="mt-1">
            <Caps>{buildMeta(scribble)}</Caps>
          </p>
          <h1
            className="mt-2 font-serif font-medium text-ink"
            style={{ fontSize: 38, lineHeight: 1.04, letterSpacing: "-0.025em", maxWidth: 760 }}
          >
            {scribble.title || "Untitled Scribble"}
          </h1>

          {/* two-pane: raw ‖ clean */}
          <div
            className="mt-9"
            style={{
              display: "grid",
              gridTemplateColumns: hasRaw
                ? "repeat(auto-fit, minmax(300px, 1fr))"
                : "1fr",
              gap: 40,
            }}
          >
            {hasRaw && (
              <div className="min-w-0">
                <div className="flex items-center justify-between">
                  <Caps>YOUR VOICE · UNEDITED</Caps>
                  <span className="font-mono text-[10px] text-ink-faint">
                    {wordCount(raw)} WORDS
                  </span>
                </div>
                <div
                  className="mt-4 font-serif text-ink-soft whitespace-pre-wrap"
                  style={{ fontSize: 15.5, lineHeight: 1.6 }}
                >
                  {raw}
                </div>
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center justify-between">
                <Caps tone="terra">
                  {hasRaw ? "OSCAR’S CLEAN VERSION" : "OSCAR’S EDIT ↓"}
                </Caps>
                <span className="font-mono text-[10px] text-ink-faint">
                  {wordCount(clean)} WORDS
                  {hasRaw ? " · FILLER REMOVED" : ""}
                </span>
              </div>
              <div
                className="mt-4 font-serif text-ink whitespace-pre-wrap"
                style={{ fontSize: 16.5, lineHeight: 1.65 }}
              >
                {clean}
              </div>

              {/* Ask Oscar to reshape */}
              <div className="mt-8 rounded-md p-4 bg-cream-200 border border-cream-300">
                <Caps tone="terra">ASK OSCAR TO RESHAPE</Caps>
                <div className="mt-2.5 space-y-1.5">
                  {RESHAPE_PROMPTS.map((p) => (
                    <button
                      key={p.mode}
                      type="button"
                      onClick={() => onReshape(p.mode)}
                      className="flex items-center gap-2.5 w-full text-left text-[12.5px] text-ink bg-transparent border-none cursor-pointer hover:opacity-80"
                    >
                      <span className="text-terracotta">&rarr;</span>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {hasRaw && (
                <button
                  type="button"
                  onClick={onCopyRaw}
                  className="mt-4 inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.14em] uppercase text-ink-faint bg-transparent border-none cursor-pointer hover:text-ink-soft"
                >
                  {copyState === "raw" ? <Check size={11} /> : <Copy size={11} />}
                  {copyState === "raw" ? "RAW COPIED" : "COPY RAW TRANSCRIPT"}
                </button>
              )}
            </div>
          </div>

          <div className="mt-10 pt-5 border-t border-cream-300 flex items-center gap-4">
            <button
              type="button"
              onClick={onExportMarkdown}
              className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.14em] uppercase text-ink-faint bg-transparent border-none cursor-pointer hover:text-ink-soft"
            >
              <Download size={11} /> EXPORT .MD
            </button>
            <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-ink-faint">
              BOTH VERSIONS KEPT · YOUR RAW VOICE IS NEVER OVERWRITTEN
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EDIT VIEW — inline editing of the clean version (design screen 06)
// ═══════════════════════════════════════════════════════════════════════════
interface EditViewProps {
  scribble: DBScribble;
  draftTitle: string;
  draftBody: string;
  saveState: SaveState;
  onTitleChange: (v: string) => void;
  onBodyChange: (v: string) => void;
  onDone: () => void;
  onDiscard: () => void;
}

function EditView({
  scribble,
  draftTitle,
  draftBody,
  saveState,
  onTitleChange,
  onBodyChange,
  onDone,
  onDiscard,
}: EditViewProps) {
  const [showRaw, setShowRaw] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const raw = scribble.raw_text || "";
  const hasRaw = raw.trim().length > 0;

  // Auto-grow the body textarea to fit content.
  useEffect(() => {
    const el = bodyRef.current;
    if (el && !showRaw) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [draftBody, showRaw]);

  const saveLabel =
    saveState === "saving"
      ? "SAVING…"
      : saveState === "saved"
        ? "AUTOSAVED"
        : "EDITING";

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-cream">
      {/* Editing bar */}
      <div className="flex items-center justify-between px-8 py-3 border-b border-cream-300 bg-cream-200 shrink-0">
        <div className="flex items-center gap-3">
          <Caps tone="terra" className="flex items-center gap-1.5">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full bg-terracotta ${
                saveState === "saving" ? "animate-pulse" : ""
              }`}
            />
            {saveLabel}
          </Caps>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDiscard}
            className="text-[11px] rounded-full px-3.5 py-1.5 text-ink-soft bg-transparent border-none cursor-pointer hover:text-ink"
          >
            Discard changes
          </button>
          <button
            type="button"
            onClick={onDone}
            className="text-[11px] rounded-full px-4 py-1.5 font-medium bg-ink text-cream border-none cursor-pointer transition-opacity hover:opacity-90"
          >
            Done
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-10 py-9">
        <div className="mx-auto" style={{ maxWidth: 720 }}>
          <Caps>{buildMeta(scribble)}</Caps>

          {/* editable title */}
          <input
            value={draftTitle}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Untitled Scribble"
            className="mt-2 w-full bg-cream font-serif font-medium text-ink outline-none rounded"
            style={{
              fontSize: 38,
              lineHeight: 1.04,
              letterSpacing: "-0.025em",
              border: "1.5px solid transparent",
              padding: "4px 8px",
              margin: "0 -8px",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#b8623d")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "transparent")}
          />

          {/* Clean / Raw toggle */}
          <div className="mt-7 inline-flex items-center rounded-full p-0.5 bg-cream-200 border border-cream-300">
            <button
              type="button"
              onClick={() => setShowRaw(false)}
              className={`rounded-full px-3 py-1 text-[11.5px] border-none cursor-pointer transition-colors ${
                !showRaw ? "bg-ink text-cream font-medium" : "bg-transparent text-ink-soft"
              }`}
            >
              Clean
            </button>
            <button
              type="button"
              onClick={() => setShowRaw(true)}
              disabled={!hasRaw}
              className={`rounded-full px-3 py-1 text-[11.5px] border-none cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-default ${
                showRaw ? "bg-ink text-cream font-medium" : "bg-transparent text-ink-soft"
              }`}
            >
              Raw
            </button>
          </div>

          {showRaw ? (
            <div className="mt-5">
              <div
                className="font-serif text-ink-soft whitespace-pre-wrap"
                style={{ fontSize: 16.5, lineHeight: 1.65 }}
              >
                {raw || "No raw transcript saved for this Scribble."}
              </div>
              <p className="mt-5 text-[12px] leading-relaxed text-ink-faint">
                Your raw transcript is read-only &mdash; it is never overwritten.
                Edits apply to the clean version.
              </p>
            </div>
          ) : (
            <textarea
              ref={bodyRef}
              value={draftBody}
              onChange={(e) => onBodyChange(e.target.value)}
              placeholder="Write the clean version…"
              className="mt-5 w-full bg-cream font-serif text-ink outline-none border-none resize-none overflow-hidden"
              style={{ fontSize: 16.5, lineHeight: 1.65, minHeight: 240 }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EMPTY DETAIL placeholder (no selection)
// ═══════════════════════════════════════════════════════════════════════════
function NoSelection() {
  return (
    <div className="flex-1 flex items-center justify-center px-12 bg-cream">
      <div className="max-w-sm text-center">
        <FileText className="mx-auto mb-5 text-ink-faint" size={32} />
        <p className="font-serif text-[20px] text-ink leading-snug">
          Pick a Scribble to read.
        </p>
        <p className="mt-2 text-[13px] text-ink-soft leading-relaxed">
          Or hit <span className="font-medium text-ink">New Scribble</span> to record
          one — it lands in the list on the left.
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════
export function ScribbleTab({
  userId,
  refreshKey = 0,
  isRecording,
  isProcessing = false,
  statusMessage = null,
  onToggleRecording,
  onImportAudio,
  recordingTime,
}: ScribbleTabProps) {
  const [allScribbles, setAllScribbles] = useState<DBScribble[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DBScribble | null>(null);
  const [trashCount, setTrashCount] = useState(0);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "clean" | "raw">("idle");
  const [shareOpen, setShareOpen] = useState(false);

  // Bulk organize (design screen 07): multi-select + bulk move/delete.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkFolderOpen, setBulkFolderOpen] = useState(false);
  const [bulkTagOpen, setBulkTagOpen] = useState(false);
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("created");
  const [folderFilter, setFolderFilter] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showStarredOnly, setShowStarredOnly] = useState(false);

  // Detail mode + edit drafts
  const [mode, setMode] = useState<DetailMode>("read");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const editOriginRef = useRef<{ title: string; body: string } | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // AI reshape request (mode + nonce so the same mode can re-trigger)
  const [aiRequest, setAiRequest] = useState<{ mode: AIMode; nonce: number } | null>(
    null,
  );

  // Audio-file import — a hidden picker is the reliable path in the Tauri
  // webview (no fs plugin, so OS drag-drop paths can't be read).
  const fileInputRef = useRef<HTMLInputElement>(null);
  const openFilePicker = () => {
    if (isRecording || isProcessing) return;
    fileInputRef.current?.click();
  };
  const handleFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onImportAudio?.(file);
    e.target.value = ""; // allow re-picking the same file
  };

  useEffect(() => {
    loadScribbles();
    loadTrashCount();
  }, [userId, refreshKey]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy, showStarredOnly, folderFilter]);

  const loadTrashCount = async () => {
    const { data, error } = await scribblesService.getTrashedScribbles();
    if (!error && data) setTrashCount(data.length);
  };

  const loadScribbles = async () => {
    setIsLoading(true);
    const { data, error } = await scribblesService.getScribbles();
    if (error) {
      console.error("[ScribbleTab] load failed:", error);
      setError("Failed to load scribbles. Please try again.");
    } else {
      setError(null);
      setAllScribbles(data || []);
    }
    setIsLoading(false);
  };

  const folders = useMemo<FolderSummary[]>(() => {
    const map = new Map<string, number>();
    for (const s of allScribbles) {
      const f = s.folder?.trim();
      if (f) map.set(f, (map.get(f) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allScribbles]);

  // Drop a folder filter that no longer has any scribbles.
  useEffect(() => {
    if (folderFilter && !folders.some((f) => f.name === folderFilter)) {
      setFolderFilter(null);
    }
  }, [folders, folderFilter]);

  const filteredScribbles = useMemo(() => {
    let result = [...allScribbles];
    if (showStarredOnly) result = result.filter((s) => s.is_starred);
    if (folderFilter) result = result.filter((s) => s.folder === folderFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((s) => {
        const title = (s.title || "").toLowerCase();
        const content = cleanBody(s).toLowerCase();
        const tags = (s.tags ?? []).join(" ").toLowerCase();
        return title.includes(q) || content.includes(q) || tags.includes(q);
      });
    }
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "created":
          cmp = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          break;
        case "updated":
          cmp = new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
          break;
        case "length": {
          const aLen = cleanBody(a).length;
          const bLen = cleanBody(b).length;
          cmp = bLen - aLen;
          break;
        }
      }
      if (cmp === 0) cmp = a.id.localeCompare(b.id);
      return cmp;
    });
    return result;
  }, [allScribbles, searchQuery, sortBy, showStarredOnly, folderFilter]);

  const totalPages = Math.ceil(filteredScribbles.length / ITEMS_PER_PAGE);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredScribbles.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredScribbles, currentPage]);

  // Auto-select first scribble if none selected and list non-empty
  useEffect(() => {
    if (!selectedId && filteredScribbles.length > 0) {
      setSelectedId(filteredScribbles[0].id);
    } else if (selectedId && !filteredScribbles.find((s) => s.id === selectedId)) {
      setSelectedId(filteredScribbles[0]?.id ?? null);
    }
  }, [filteredScribbles, selectedId]);

  const selected = useMemo(
    () => allScribbles.find((s) => s.id === selectedId) ?? null,
    [allScribbles, selectedId],
  );

  // Leaving a scribble (or switching selection) cancels edit mode.
  useEffect(() => {
    setMode("read");
    setSaveState("idle");
    editOriginRef.current = null;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  }, [selectedId]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const persist = async (
    id: string,
    updates: Parameters<typeof scribblesService.updateScribble>[1],
  ) => {
    const { data, error } = await scribblesService.updateScribble(id, updates);
    if (error || !data) {
      setError("Failed to save changes. Please try again.");
      setTimeout(() => setError(null), 3000);
      return false;
    }
    setAllScribbles((prev) => prev.map((s) => (s.id === id ? { ...s, ...data } : s)));
    return true;
  };

  // ── edit lifecycle ────────────────────────────────────────────────────────
  const enterEdit = () => {
    if (!selected) return;
    const body = cleanBody(selected);
    const title = selected.title || "";
    editOriginRef.current = { title, body };
    setDraftTitle(title);
    setDraftBody(body);
    setSaveState("idle");
    setMode("edit");
  };

  const scheduleAutosave = (next: { title?: string; body?: string }) => {
    if (!selected) return;
    setSaveState("saving");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const id = selected.id;
    const title = next.title ?? draftTitle;
    const body = next.body ?? draftBody;
    saveTimerRef.current = setTimeout(async () => {
      const ok = await persist(id, {
        title: title.trim() || "Untitled Scribble",
        edited_text: body,
      });
      setSaveState(ok ? "saved" : "idle");
    }, 800);
  };

  const handleTitleChange = (v: string) => {
    setDraftTitle(v);
    scheduleAutosave({ title: v });
  };
  const handleBodyChange = (v: string) => {
    setDraftBody(v);
    scheduleAutosave({ body: v });
  };

  const finishEdit = async () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (selected) {
      await persist(selected.id, {
        title: draftTitle.trim() || "Untitled Scribble",
        edited_text: draftBody,
      });
    }
    editOriginRef.current = null;
    setMode("read");
    setSaveState("idle");
  };

  const discardEdit = async () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const origin = editOriginRef.current;
    if (selected && origin) {
      // Autosave may have already written drafts — restore the snapshot taken
      // when editing began so "Discard" truly reverts.
      await persist(selected.id, {
        title: origin.title.trim() || "Untitled Scribble",
        edited_text: origin.body,
      });
    }
    editOriginRef.current = null;
    setMode("read");
    setSaveState("idle");
  };

  // ── other actions ──────────────────────────────────────────────────────────
  const handleDelete = async (scribble: DBScribble) => {
    setDeletingId(scribble.id);
    try {
      const { error } = await scribblesService.deleteScribble(scribble.id);
      if (error) {
        setError("Failed to delete scribble. Please try again.");
        setTimeout(() => setError(null), 3000);
      } else {
        setAllScribbles((prev) => prev.filter((s) => s.id !== scribble.id));
        setTrashCount((prev) => prev + 1);
        if (selectedId === scribble.id) setSelectedId(null);
      }
    } catch (err) {
      console.error("[ScribbleTab] delete error:", err);
      setError("Failed to delete scribble. Please try again.");
      setTimeout(() => setError(null), 3000);
    }
    setDeletingId(null);
  };

  const handleToggleStar = async (scribble: DBScribble) => {
    const newStarred = !scribble.is_starred;
    setAllScribbles((prev) =>
      prev.map((n) => (n.id === scribble.id ? { ...n, is_starred: newStarred } : n)),
    );
    const { data, error } = await scribblesService.toggleStar(scribble.id, newStarred);
    if (error || !data) {
      setAllScribbles((prev) =>
        prev.map((n) =>
          n.id === scribble.id ? { ...n, is_starred: scribble.is_starred } : n,
        ),
      );
    } else {
      setAllScribbles((prev) =>
        prev.map((n) => (n.id === data.id ? { ...n, is_starred: data.is_starred } : n)),
      );
    }
  };

  const handleMoveToFolder = async (scribble: DBScribble, folder: string | null) => {
    const previous = scribble.folder ?? null;
    setAllScribbles((prev) =>
      prev.map((n) => (n.id === scribble.id ? { ...n, folder } : n)),
    );
    const ok = await persist(scribble.id, { folder });
    if (!ok) {
      setAllScribbles((prev) =>
        prev.map((n) => (n.id === scribble.id ? { ...n, folder: previous } : n)),
      );
    }
  };

  // Save a transformed result as a brand-new Scribble (Transform screen).
  const handleSaveAsNew = async (title: string, body: string) => {
    const { data, error } = await scribblesService.createScribble({
      user_id: userId,
      title: title.trim() || "Untitled Scribble",
      raw_text: "",
      original_formatted_text: body,
      edited_text: body,
    });
    if (error || !data) {
      setError("Failed to save the new Scribble. Please try again.");
      setTimeout(() => setError(null), 3000);
      return;
    }
    await loadScribbles();
    setSelectedId(data.id);
    setMode("read");
  };

  // ── bulk organize ───────────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
    setBulkFolderOpen(false);
    setBulkTagOpen(false);
    setPendingBulkDelete(false);
  };

  const bulkMove = async (folder: string | null) => {
    const targets = allScribbles.filter((s) => selectedIds.has(s.id));
    for (const s of targets) await handleMoveToFolder(s, folder);
    exitSelectMode();
  };

  const bulkAddTag = async (tag: string) => {
    const t = tag.trim();
    if (!t) return;
    const targets = allScribbles.filter((s) => selectedIds.has(s.id));
    for (const s of targets) {
      const existing = s.tags ?? [];
      if (existing.includes(t)) continue;
      const next = [...existing, t];
      // Optimistic, with rollback on failure (mirrors handleMoveToFolder).
      setAllScribbles((prev) =>
        prev.map((n) => (n.id === s.id ? { ...n, tags: next } : n)),
      );
      const ok = await persist(s.id, { tags: next });
      if (!ok) {
        setAllScribbles((prev) =>
          prev.map((n) => (n.id === s.id ? { ...n, tags: existing } : n)),
        );
      }
    }
    exitSelectMode();
  };

  const bulkDelete = async () => {
    const targets = allScribbles.filter((s) => selectedIds.has(s.id));
    for (const s of targets) await handleDelete(s);
    exitSelectMode();
  };

  const triggerDownload = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportTxt = (scribble: DBScribble) => {
    const body = cleanBody(scribble);
    const slug = (scribble.title || "scribble").replace(/[^a-z0-9]/gi, "_");
    triggerDownload(body, `${slug}.txt`, "text/plain");
  };

  const handleExportMarkdown = (scribble: DBScribble) => {
    const title = scribble.title || "Untitled Scribble";
    const date = new Date(scribble.created_at).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const body = cleanBody(scribble);
    const md = `# ${title}\n\n_${date}_\n\n---\n\n${body}`;
    const slug = title.replace(/[^a-z0-9]/gi, "_");
    triggerDownload(md, `${slug}.md`, "text/markdown");
  };

  const handleCopyClean = async (scribble: DBScribble) => {
    const body = cleanBody(scribble);
    if (!body) return;
    await navigator.clipboard.writeText(body);
    setCopyState("clean");
    setTimeout(() => setCopyState("idle"), 1500);
  };

  const handleCopyRaw = async (scribble: DBScribble) => {
    if (!scribble.raw_text) return;
    await navigator.clipboard.writeText(scribble.raw_text);
    setCopyState("raw");
    setTimeout(() => setCopyState("idle"), 1500);
  };

  const handleAIApply = async (text: string) => {
    if (!selected) return;
    const ok = await persist(selected.id, { edited_text: text });
    if (ok) {
      // Keep an in-progress edit draft in sync with an AI-applied change.
      if (mode === "edit") setDraftBody(text);
      setIsAIOpen(false);
    }
  };

  const openReshape = (m: AIMode) => {
    setIsAIOpen(true);
    setAiRequest({ mode: m, nonce: Date.now() });
  };

  // An initial-load failure leaves the list empty — surface a real error state
  // with Retry rather than the first-run "Start a Scribble" empty screen.
  const hasLoadError = !isLoading && !!error && allScribbles.length === 0;
  const isEmpty = !isLoading && !error && allScribbles.length === 0;
  // AI panel only coexists with the reading view — the Transform/Translate
  // screens are themselves AI surfaces, and suppressing it keeps the detail
  // pane above the 960px compact floor.
  const showAI = isAIOpen && selected && !isEmpty && !hasLoadError && mode === "read";
  // Status toast sits over the detail region: nav (240) + list (360) when the
  // list is shown; just past the nav when the editorial empty state takes over.
  const toastLeft = isEmpty ? 240 : 600;

  // Capture + processing take over the whole tab (design screens 02 / 03) —
  // full-screen, no sidebar. Driven by the global recording props; the detail
  // mode underneath is preserved and restored when the capture ends.
  if (isRecording) {
    return (
      <div className="flex-1 flex bg-cream overflow-hidden">
        <CaptureTakeover
          recordingTime={recordingTime}
          caption={statusMessage || undefined}
          onStop={onToggleRecording}
        />
      </div>
    );
  }
  if (isProcessing) {
    return (
      <div className="flex-1 flex bg-cream overflow-hidden">
        <ProcessingScreen statusMessage={statusMessage} />
      </div>
    );
  }

  return (
    <div className="flex-1 flex bg-cream overflow-hidden relative">
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.m4a,.wav,.webm,.ogg,.aac,.flac,.mp4"
        className="hidden"
        onChange={handleFileChosen}
      />
      {hasLoadError ? (
        <LoadErrorState
          message={error}
          onRetry={() => void loadScribbles()}
          isRetrying={isLoading}
        />
      ) : isEmpty ? (
        <EmptyState
          isRecording={isRecording}
          isProcessing={isProcessing}
          onStart={onToggleRecording}
          onPickFile={openFilePicker}
        />
      ) : (
        <>
          {/* LEFT — list pane */}
          <aside className="w-[360px] shrink-0 border-r border-cream-300 flex flex-col bg-cream">
            <div className="px-5 pt-6 pb-4 border-b border-cream-300">
              <div className="flex items-center justify-between gap-2">
                <Caps>SCRIBBLES · {allScribbles.length}</Caps>
                <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={openFilePicker}
                  disabled={isRecording || isProcessing}
                  title="Import an audio file"
                  className="inline-flex items-center justify-center rounded-full h-[26px] w-[26px] border border-cream-300 text-ink-soft bg-transparent hover:text-ink cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-default"
                >
                  <Upload size={12} />
                </button>
                {/* Contextual "audio pen" — the way to start a Scribble once the
                    list has content. Lives here, not in the global sidebar. */}
                <button
                  type="button"
                  onClick={onToggleRecording}
                  disabled={isRecording || isProcessing}
                  title="Start a new Scribble"
                  className="inline-flex items-center gap-1.5 rounded-full pl-1 pr-3 py-1 bg-ink text-cream text-[11px] font-medium border-none cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-default"
                >
                  <span
                    className="inline-flex items-center justify-center rounded-full bg-terracotta shrink-0"
                    style={{ height: 18, width: 18 }}
                  >
                    {isRecording ? (
                      <Square size={9} fill="currentColor" />
                    ) : isProcessing ? (
                      <Loader2 size={10} className="animate-spin" />
                    ) : (
                      <Mic size={10} />
                    )}
                  </span>
                  New Scribble
                </button>
                </div>
              </div>
              <h1
                className="mt-2 font-serif font-medium text-ink"
                style={{ fontSize: 26, lineHeight: 1.05, letterSpacing: "-0.02em" }}
              >
                Everything you <em className="italic text-terracotta">said</em>.
              </h1>

              <div className="mt-4 flex items-center gap-2 rounded-full bg-cream-200 border border-cream-300 px-3 py-2">
                <Search size={13} className="text-ink-faint shrink-0" />
                <input
                  type="text"
                  placeholder="Find by what you said"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent outline-none border-none text-[13px] text-ink placeholder-ink-faint min-w-0"
                />
              </div>

              <div className="mt-3 flex items-center gap-3">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="bg-transparent border-none font-mono text-[10px] tracking-[0.16em] uppercase text-ink-soft cursor-pointer outline-none"
                >
                  <option value="created">NEWEST</option>
                  <option value="updated">UPDATED</option>
                  <option value="length">LONGEST</option>
                </select>
                {folders.length > 0 && (
                  <select
                    value={folderFilter ?? ""}
                    onChange={(e) => setFolderFilter(e.target.value || null)}
                    className="bg-transparent border-none font-mono text-[10px] tracking-[0.16em] uppercase text-ink-soft cursor-pointer outline-none max-w-[110px]"
                    title="Filter by folder"
                  >
                    <option value="">ALL FOLDERS</option>
                    {folders.map((f) => (
                      <option key={f.name} value={f.name}>
                        {f.name.toUpperCase()} · {f.count}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={() => setShowStarredOnly((v) => !v)}
                  className={`inline-flex items-center gap-1.5 bg-transparent border-none font-mono text-[10px] tracking-[0.16em] uppercase cursor-pointer ${
                    showStarredOnly ? "text-terracotta" : "text-ink-soft"
                  }`}
                >
                  <Star size={10} fill={showStarredOnly ? "currentColor" : "none"} />
                  STARRED
                </button>
                <button
                  type="button"
                  onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
                  className={`inline-flex items-center gap-1.5 bg-transparent border-none font-mono text-[10px] tracking-[0.16em] uppercase cursor-pointer ${
                    selectMode ? "text-terracotta" : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {selectMode ? "DONE" : "SELECT"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsTrashOpen(true)}
                  className="ml-auto inline-flex items-center gap-1.5 bg-transparent border-none font-mono text-[10px] tracking-[0.16em] uppercase text-ink-soft cursor-pointer hover:text-ink"
                >
                  <Trash2 size={10} />
                  TRASH {trashCount > 0 ? `· ${trashCount}` : ""}
                </button>
              </div>
            </div>

            {/* Bulk action bar (design screen 07) — shown while selecting. */}
            {selectMode && selectedIds.size > 0 && (
              <div className="px-5 py-2.5 border-b border-cream-300 bg-cream-200 flex items-center gap-2">
                <Caps tone="ink">{selectedIds.size} SELECTED</Caps>
                <div className="ml-auto flex items-center gap-1.5">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setBulkFolderOpen((v) => !v)}
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] bg-ink text-cream border-none cursor-pointer"
                    >
                      <Folder size={11} /> Move to…
                    </button>
                    {bulkFolderOpen && (
                      <FolderPopover
                        folders={folders}
                        current={null}
                        onMove={(f) => {
                          setBulkFolderOpen(false);
                          void bulkMove(f);
                        }}
                        onClose={() => setBulkFolderOpen(false)}
                      />
                    )}
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setBulkTagOpen((v) => !v)}
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] border border-cream-300 text-ink-soft bg-transparent hover:text-terracotta hover:border-terracotta/50 cursor-pointer transition-colors"
                    >
                      <Plus size={11} /> Add tag
                    </button>
                    {bulkTagOpen && (
                      <TagInputPopover
                        onAdd={(t) => void bulkAddTag(t)}
                        onClose={() => setBulkTagOpen(false)}
                      />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingBulkDelete(true)}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] border border-cream-300 text-ink-faint bg-transparent hover:text-[#8c2f25] hover:border-[#8c2f25] cursor-pointer transition-colors"
                  >
                    <Trash2 size={11} /> Delete
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="px-5 py-3 bg-[#fbe9e7] text-[12px] text-[#8c2f25] border-b border-cream-300">
                {error}
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="py-2" aria-busy="true">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="px-5 py-4 border-b border-cream-300">
                      <div className="h-2 w-20 rounded bg-cream-200 animate-pulse" />
                      <div className="mt-2.5 h-3.5 w-3/4 rounded bg-cream-200 animate-pulse" />
                      <div className="mt-2 h-2.5 w-full rounded bg-cream-200 animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : paginated.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <p className="font-serif text-[16px] text-ink-soft leading-snug">
                    Nothing matches that filter.
                  </p>
                  <p className="mt-1.5 text-[12px] text-ink-faint">
                    Try a different search or folder.
                  </p>
                </div>
              ) : (
                paginated.map((s) => (
                  <ScribbleRow
                    key={s.id}
                    scribble={s}
                    isActive={s.id === selectedId}
                    onClick={() => setSelectedId(s.id)}
                    selectable={selectMode}
                    checked={selectedIds.has(s.id)}
                    onToggleCheck={() => toggleSelect(s.id)}
                  />
                ))
              )}
            </div>

            {totalPages > 1 && (
              <div className="px-5 py-3 border-t border-cream-300 flex items-center justify-between text-[11px] text-ink-soft">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="bg-transparent border-none text-ink-soft disabled:text-ink-faint cursor-pointer disabled:cursor-default"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="font-mono">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="bg-transparent border-none text-ink-soft disabled:text-ink-faint cursor-pointer disabled:cursor-default"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </aside>

          {/* CENTER — detail pane (reading or editing) */}
          {!selected ? (
            <NoSelection />
          ) : mode === "edit" ? (
            <EditView
              scribble={selected}
              draftTitle={draftTitle}
              draftBody={draftBody}
              saveState={saveState}
              onTitleChange={handleTitleChange}
              onBodyChange={handleBodyChange}
              onDone={() => void finishEdit()}
              onDiscard={() => void discardEdit()}
            />
          ) : mode === "transform" ? (
            <TransformView
              scribble={selected}
              onBack={() => setMode("read")}
              onSaveAsNew={handleSaveAsNew}
            />
          ) : mode === "translate" ? (
            <TranslateView scribble={selected} onBack={() => setMode("read")} />
          ) : (
            <ReadingView
              scribble={selected}
              folders={folders}
              isAIOpen={isAIOpen}
              copyState={copyState}
              isDeleting={!!(selected && deletingId === selected.id)}
              onEdit={enterEdit}
              onTransform={() => setMode("transform")}
              onTranslate={() => setMode("translate")}
              onShare={() => setShareOpen(true)}
              onToggleAI={() => setIsAIOpen((v) => !v)}
              onReshape={openReshape}
              onCopyClean={() => void handleCopyClean(selected)}
              onCopyRaw={() => void handleCopyRaw(selected)}
              onToggleStar={() => void handleToggleStar(selected)}
              onMoveToFolder={(f) => void handleMoveToFolder(selected, f)}
              onExportTxt={() => handleExportTxt(selected)}
              onExportMarkdown={() => handleExportMarkdown(selected)}
              onDelete={() => setPendingDelete(selected)}
            />
          )}

          {/* RIGHT — AI panel */}
          {showAI && selected && (
            <div className="w-[340px] shrink-0 border-l border-cream-300 overflow-hidden flex flex-col">
              <AIPanel
                key={selected.id}
                transcript={cleanBody(selected)}
                onApply={(text) => void handleAIApply(text)}
                appKey={selected.dictation_app_key}
                contextSource={selected.dictation_context_source}
                request={aiRequest}
                onRequestConsumed={() => setAiRequest(null)}
              />
            </div>
          )}
        </>
      )}

      {/* Trash panel */}
      <TrashPanel
        isOpen={isTrashOpen}
        onClose={() => setIsTrashOpen(false)}
        onRestore={() => {
          loadScribbles();
          loadTrashCount();
        }}
      />

      {/* Confirm before soft-deleting a scribble — parity with the web app,
          which guards delete with a confirmation. Prevents an accidental
          single-click trashing (the Trash button had no confirmation). */}
      {pendingDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-confirm-title"
          className="fixed inset-0 z-[2000] flex items-center justify-center p-10"
          style={{ background: "rgba(15,13,10,0.55)" }}
          onClick={() => setPendingDelete(null)}
        >
          <div
            className="w-[420px] max-w-full rounded-2xl bg-cream text-ink overflow-hidden"
            style={{ boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-8 pt-8 pb-7">
              <h1
                id="delete-confirm-title"
                className="font-serif font-medium tracking-[-0.025em] leading-[1.05] text-ink"
                style={{ fontSize: 26 }}
              >
                Move to trash?
              </h1>
              <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">
                "{pendingDelete.title?.trim() || "Untitled Scribble"}" will be moved to
                trash. You can restore it from the trash later.
              </p>
              <div className="mt-7 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPendingDelete(null)}
                  className="rounded-full px-5 py-2.5 text-[13px] font-medium text-ink-soft bg-transparent border border-cream-300 cursor-pointer transition-colors hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const target = pendingDelete;
                    setPendingDelete(null);
                    void handleDelete(target);
                  }}
                  className="rounded-full px-5 py-2.5 text-[13px] font-medium text-cream cursor-pointer transition-opacity hover:opacity-90 border-none"
                  style={{ background: "#8c2f25" }}
                >
                  Move to trash
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share / Publish dialog over the dimmed reading view. */}
      {shareOpen && selected && (
        <ShareModal
          scribble={selected}
          onClose={() => setShareOpen(false)}
          onShared={(state) =>
            setAllScribbles((prev) =>
              prev.map((s) =>
                s.id === selected.id
                  ? {
                      ...s,
                      visibility: state.visibility,
                      public_share_token: state.public_share_token,
                    }
                  : s,
              ),
            )
          }
        />
      )}

      {/* Confirm bulk trash. */}
      {pendingBulkDelete && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[2000] flex items-center justify-center p-10"
          style={{ background: "rgba(15,13,10,0.55)" }}
          onClick={() => setPendingBulkDelete(false)}
        >
          <div
            className="w-[420px] max-w-full rounded-2xl bg-cream text-ink overflow-hidden"
            style={{ boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-8 pt-8 pb-7">
              <h1
                className="font-serif font-medium tracking-[-0.025em] leading-[1.05] text-ink"
                style={{ fontSize: 26 }}
              >
                Move {selectedIds.size} to trash?
              </h1>
              <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">
                {selectedIds.size} Scribble{selectedIds.size === 1 ? "" : "s"} will be
                moved to trash. You can restore them from the trash later.
              </p>
              <div className="mt-7 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPendingBulkDelete(false)}
                  className="rounded-full px-5 py-2.5 text-[13px] font-medium text-ink-soft bg-transparent border border-cream-300 cursor-pointer transition-colors hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void bulkDelete()}
                  className="rounded-full px-5 py-2.5 text-[13px] font-medium text-cream cursor-pointer transition-opacity hover:opacity-90 border-none"
                  style={{ background: "#8c2f25" }}
                >
                  Move to trash
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status toast — surfaces a post-capture message (error / info) once a
          recording finishes or fails. Recording + processing themselves take
          over the whole tab (see the early returns above), so this is just the
          quiet after-the-fact feedback. */}
      {!isEmpty && statusMessage && (
        <div
          className="fixed bottom-8 z-40 flex justify-center pointer-events-none"
          style={{ left: toastLeft, right: showAI ? 340 : 0 }}
        >
          <div
            className={`pointer-events-auto text-[11px] font-medium px-3 py-1.5 rounded-full shadow-sm border font-mono tracking-[0.04em] ${
              statusMessage.toLowerCase().startsWith("failed") ||
              statusMessage.toLowerCase().includes("too short") ||
              statusMessage.toLowerCase().includes("no audio") ||
              statusMessage.toLowerCase().includes("no speech") ||
              statusMessage.toLowerCase().startsWith("sign in")
                ? "bg-[#fbe9e7] text-[#8c2f25] border-[#e8c9b8]"
                : "bg-cream-200 text-ink border-cream-300"
            }`}
          >
            {statusMessage}
          </div>
        </div>
      )}
    </div>
  );
}
