import { useEffect } from "react";

interface UpgradeModalProps {
  open: boolean;
  /** Editorial caps eyebrow, e.g. "YOU'VE HIT THE FREE CAP". */
  eyebrow?: string;
  /** Headline minutes count for the dynamic hero, e.g. 30. */
  minutesSpent?: number;
  /** Pricing display. */
  priceLabel?: string;
  pricePeriodLabel?: string;
  onClose: () => void;
  onUpgrade: () => void;
  onDefer?: () => void;
}

/**
 * V2OverlayUpgrade — editorial limit-reached modal. Cream surface on ink
 * scrim, EB Garamond H1 with terracotta italic, ink CTA. Used when the user
 * hits the free dictation cap.
 */
export function UpgradeModal({
  open,
  eyebrow = "YOU'VE HIT THE FREE CAP",
  minutesSpent = 30,
  priceLabel = "₹699",
  pricePeriodLabel = "/ month · billed annually",
  onClose,
  onUpgrade,
  onDefer,
}: UpgradeModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
      className="fixed inset-0 z-[2000] flex items-center justify-center p-10"
      style={{ background: "rgba(15,13,10,0.55)" }}
      onClick={onClose}
    >
      <div
        className="w-[540px] max-w-full rounded-2xl bg-cream text-ink overflow-hidden"
        style={{ boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-9 pt-9 pb-9">
          <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-terracotta">
            {eyebrow}
          </span>
          <h1
            id="upgrade-modal-title"
            className="mt-2 font-serif font-medium tracking-[-0.025em] leading-[1.0] text-ink"
            style={{ fontSize: 40 }}
          >
            {minutesSpent} minutes spent.<br />
            <em className="italic text-terracotta">Worth it</em> yet?
          </h1>
          <p className="mt-5 text-[14px] leading-relaxed text-ink-soft">
            Most people are hooked at 18 minutes. You made it to {minutesSpent}.
            Upgrade to Pro and don't lose the momentum.
          </p>

          <div className="mt-7 rounded-lg p-5 bg-cream-200 border border-cream-300">
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-faint">
                PRO · ANNUAL
              </span>
              <span className="font-mono text-[12px] text-terracotta">SAVE 20%</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-serif font-medium tracking-[-0.025em] text-ink" style={{ fontSize: 36 }}>
                {priceLabel}
              </span>
              <span className="text-[12px] text-ink-soft">{pricePeriodLabel}</span>
            </div>
            <ul className="mt-4 space-y-1.5 text-[12px] text-ink-soft">
              <li>· Unlimited dictation</li>
              <li>· Unlimited Scribbles + Minutes</li>
              <li>· Context-aware dictation, vocabulary, transforms</li>
            </ul>
          </div>

          <button
            type="button"
            onClick={onUpgrade}
            className="mt-7 w-full rounded-full py-3.5 text-[14px] font-medium bg-ink text-cream cursor-pointer transition-opacity hover:opacity-90 border-none"
          >
            Upgrade to Pro
          </button>
          {onDefer && (
            <button
              type="button"
              onClick={onDefer}
              className="mt-3 w-full text-[12px] text-ink-soft cursor-pointer bg-transparent border-none"
            >
              Maybe later
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
