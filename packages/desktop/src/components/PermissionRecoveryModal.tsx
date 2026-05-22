import { useEffect } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";

interface PermissionRecoveryModalProps {
  open: boolean;
  /** Optional permission name (Microphone, Accessibility). */
  permission?: "microphone" | "accessibility";
  onClose: () => void;
  /** Optional override; defaults to opening the OS Privacy pane. */
  onOpenSystemSettings?: () => void;
}

const COPY = {
  microphone: {
    eyebrow: "OSCAR CAN'T HEAR YOU",
    headline: "We need ",
    italic: "three permissions",
    tail: " back.",
    body: "The OS revoked microphone access. Here's how to get Oscar listening again.",
    steps: [
      "Open System Settings → Privacy & Security",
      "Scroll to Microphone, find Oscar, toggle it on",
      "Come back — we'll resume from where you left off",
    ],
    cta: "Open Privacy settings",
    deepLink: "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone",
  },
  accessibility: {
    eyebrow: "OSCAR CAN'T PASTE FOR YOU",
    headline: "We need ",
    italic: "Accessibility",
    tail: " back.",
    body: "Accessibility access lets Oscar paste your transcript into the active app. The OS revoked it.",
    steps: [
      "Open System Settings → Privacy & Security",
      "Scroll to Accessibility, find Oscar, toggle it on",
      "Come back — we'll resume from where you left off",
    ],
    cta: "Open Privacy settings",
    deepLink: "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
  },
} as const;

export function PermissionRecoveryModal({
  open,
  permission = "microphone",
  onClose,
  onOpenSystemSettings,
}: PermissionRecoveryModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const copy = COPY[permission];

  const handleOpen = () => {
    if (onOpenSystemSettings) {
      onOpenSystemSettings();
      return;
    }
    openUrl(copy.deepLink).catch((err) =>
      console.warn("[permission-recovery] failed to open system settings", err),
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="permission-recovery-title"
      className="fixed inset-0 z-[2000] flex items-center justify-center p-10"
      style={{ background: "rgba(15,13,10,0.45)" }}
      onClick={onClose}
    >
      <div
        className="w-[520px] max-w-full rounded-2xl bg-cream text-ink overflow-hidden"
        style={{ boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-9 pt-9 pb-9">
          <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-terracotta">
            {copy.eyebrow}
          </span>
          <h1
            id="permission-recovery-title"
            className="mt-2 font-serif font-medium tracking-[-0.025em] leading-[1.02] text-ink"
            style={{ fontSize: 36 }}
          >
            {copy.headline}
            <em className="italic text-terracotta">{copy.italic}</em>
            {copy.tail}
          </h1>
          <p className="mt-4 text-[14px] leading-relaxed text-ink-soft">{copy.body}</p>

          <ol className="mt-6 space-y-0">
            {copy.steps.map((step, i) => (
              <li
                key={i}
                className="flex items-start gap-4 py-4 border-b border-cream-300"
              >
                <span className="font-mono text-[11px] text-terracotta mt-0.5 shrink-0">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-[14px] text-ink leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>

          <div className="mt-7 flex items-center gap-3">
            <button
              type="button"
              onClick={handleOpen}
              className="flex-1 rounded-full py-3 text-[14px] font-medium bg-ink text-cream cursor-pointer transition-opacity hover:opacity-90 border-none"
            >
              {copy.cta}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-[13px] text-ink-soft cursor-pointer bg-transparent border-none px-3 py-3"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
