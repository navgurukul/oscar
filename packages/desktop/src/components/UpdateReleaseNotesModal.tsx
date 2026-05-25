import { useEffect } from "react";

interface UpdateReleaseNotesModalProps {
  open: boolean;
  version?: string;
  currentVersion?: string;
  body?: string;
  size?: string;
  onClose: () => void;
  onInstall: () => void;
  onDefer?: () => void;
  readyToInstall?: boolean;
}

interface ParsedLine {
  tag?: string;
  text: string;
}

/**
 * Parse a release-notes body line into a tag (NEW / FIX / FAST / etc.) and
 * text. Supports lines like:
 *   - "NEW: pill settings popover"
 *   - "* FIX bug XYZ"
 *   - bare "some plain line"
 */
function parseLine(raw: string): ParsedLine {
  const trimmed = raw.replace(/^[-*•]\s*/, "").trim();
  const m = trimmed.match(/^(NEW|FIX|FAST|FIXED|CHANGED|IMPROVED|REMOVED)\s*[:\-]?\s*(.*)$/i);
  if (m) {
    return { tag: m[1].toUpperCase(), text: m[2].trim() || m[0] };
  }
  return { text: trimmed };
}

const HIGHLIGHT_TAGS = new Set(["NEW", "IMPROVED", "CHANGED"]);

/**
 * V2DesktopUpdate — full release-notes screen overlay. Editorial cream
 * surface, EB Garamond H1, NEW/FIX/FAST tagged release lines, cream2 install
 * sidebar.
 */
export function UpdateReleaseNotesModal({
  open,
  version,
  currentVersion,
  body,
  size,
  onClose,
  onInstall,
  onDefer,
  readyToInstall = false,
}: UpdateReleaseNotesModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const lines = (body ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map(parseLine);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="release-notes-title"
      className="fixed inset-0 z-[2000] flex items-center justify-center p-8"
      style={{ background: "rgba(15,13,10,0.55)" }}
      onClick={onClose}
    >
      <div
        className="w-[820px] max-w-full max-h-[88vh] rounded-2xl bg-cream text-ink overflow-hidden flex flex-col"
        style={{ boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-10 pt-10 pb-2">
          <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-terracotta">
            {readyToInstall ? "UPDATE READY" : "UPDATE AVAILABLE"} · v{version ?? "?"}
          </span>
          <h1
            id="release-notes-title"
            className="mt-2 font-serif font-medium tracking-[-0.025em] leading-[1.0] text-ink"
            style={{ fontSize: 40 }}
          >
            Quieter, <em className="italic text-terracotta">faster</em>, fewer bugs.
          </h1>
          {currentVersion && (
            <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">
              You are on v{currentVersion}. Worth restarting for.
            </p>
          )}
        </div>

        <div className="flex-1 overflow-auto px-10 py-6 grid grid-cols-12 gap-10">
          <div className="col-span-8 min-w-0">
            <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-faint">
              RELEASE NOTES · v{version ?? "?"}
            </span>
            {lines.length === 0 ? (
              <p className="mt-4 text-[14px] text-ink-soft leading-relaxed">
                Bug fixes and improvements.
              </p>
            ) : (
              <ul className="mt-4 space-y-3 text-[14px] leading-relaxed text-ink">
                {lines.map((line, i) => (
                  <li key={i} className="flex gap-3">
                    {line.tag && (
                      <span
                        className={`font-mono text-[10px] tracking-[0.16em] mt-[6px] shrink-0 ${
                          HIGHLIGHT_TAGS.has(line.tag) ? "text-terracotta" : "text-ink-faint"
                        }`}
                      >
                        {line.tag}
                      </span>
                    )}
                    <span className="flex-1">{line.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <aside className="col-span-4 rounded-lg bg-cream-200 border border-cream-300 p-6 self-start">
            <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-faint">
              {readyToInstall ? "READY TO INSTALL" : "AVAILABLE TO INSTALL"}
            </span>
            <div className="mt-3 font-serif font-medium text-ink" style={{ fontSize: 22 }}>
              {size ?? "Update available"} · 1 min restart
            </div>
            <button
              type="button"
              onClick={onInstall}
              className="mt-5 w-full rounded-full py-3 text-[13px] font-medium bg-ink text-cream border-none cursor-pointer hover:opacity-90"
            >
              {readyToInstall ? "Restart and update" : "Download and install"}
            </button>
            {onDefer && (
              <button
                type="button"
                onClick={onDefer}
                className="mt-2 w-full text-[12px] text-ink-soft bg-transparent border-none cursor-pointer"
              >
                Later — install on quit
              </button>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
