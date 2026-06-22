import { useState } from "react";
import { X, Copy, Check, Loader2 } from "lucide-react";
import { aiService } from "../../services/ai.service";
import { WEB_APP_URL } from "../../lib/web-app-url";
import type { DBScribble, Visibility } from "../../types/scribble.types";
import { Caps } from "./_shared";

// Share / Publish dialog (design screen 10) over a dimmed reading view. Wires
// to the web share route (Bearer) which mints/rotates the public token. Only
// the core public-link flow is implemented; the design's audio/margin/reaction
// toggles have no backing columns yet and are deferred.
export function ShareModal({
  scribble,
  onClose,
  onShared,
}: {
  scribble: DBScribble;
  onClose: () => void;
  onShared: (state: { visibility: Visibility; public_share_token: string | null }) => void;
}) {
  const [visibility, setVisibility] = useState<Visibility>(
    scribble.visibility ?? "private",
  );
  const [token, setToken] = useState<string | null>(
    scribble.public_share_token ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const isPublic = visibility === "public" && !!token;
  const link = token ? `${WEB_APP_URL}/s/${token}` : "";

  const apply = async (vis: Visibility) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await aiService.setScribbleSharing(scribble.id, vis);
      setVisibility(res.visibility);
      setToken(res.public_share_token);
      onShared({
        visibility: res.visibility,
        public_share_token: res.public_share_token,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[2000] flex items-center justify-center p-10"
      style={{ background: "rgba(15,13,10,0.55)" }}
      onClick={onClose}
    >
      <div
        className="w-[480px] max-w-full rounded-2xl bg-cream text-ink overflow-hidden"
        style={{ boxShadow: "0 28px 70px rgba(0,0,0,0.4)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-7 pt-6 pb-6">
          <div className="flex items-center justify-between">
            <Caps tone="terra">PUBLISH THIS SCRIBBLE</Caps>
            <button
              type="button"
              onClick={onClose}
              className="bg-transparent border-none cursor-pointer text-ink-faint hover:text-ink"
            >
              <X size={16} />
            </button>
          </div>
          <h2
            className="mt-2.5 font-serif font-medium text-ink"
            style={{ fontSize: 24, lineHeight: 1.08, letterSpacing: "-0.02em" }}
          >
            Anyone with the link can <em className="italic text-terracotta">read</em> it.
          </h2>

          <div className="mt-5 rounded-xl p-1 flex bg-cream-200 border border-cream-300">
            <button
              type="button"
              disabled={busy}
              onClick={() => void apply("public")}
              className={`flex-1 text-center rounded-lg py-2 text-[13px] border-none cursor-pointer disabled:cursor-wait ${
                isPublic ? "bg-ink text-cream font-medium" : "bg-transparent text-ink-soft"
              }`}
            >
              Anyone with link
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void apply("private")}
              className={`flex-1 text-center rounded-lg py-2 text-[13px] border-none cursor-pointer disabled:cursor-wait ${
                !isPublic ? "bg-ink text-cream font-medium" : "bg-transparent text-ink-soft"
              }`}
            >
              Private
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-md p-3 text-[13px] text-[#8c2f25] bg-[#fbe9e7] border border-[#e8c9b8]">
              {error}
            </div>
          )}

          {isPublic && link && (
            <div className="mt-4 flex items-center gap-2 rounded-full pl-4 pr-1.5 py-1.5 bg-cream-200 border border-cream-300">
              <span className="font-mono text-[12.5px] text-ink flex-1 overflow-hidden whitespace-nowrap text-ellipsis">
                {link}
              </span>
              <button
                type="button"
                onClick={() => void copy()}
                className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 bg-ink text-cream text-[12px] font-medium border-none cursor-pointer shrink-0"
              >
                {copied ? <Check size={11} /> : <Copy size={11} />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          )}

          <p className="mt-4 text-[12px] leading-relaxed text-ink-soft">
            Re-publishing generates a new link &mdash; the previous one stops working.
          </p>
        </div>

        <div className="px-7 py-4 flex items-center justify-between bg-cream-200 border-t border-cream-300">
          <Caps>YOUR RAW VOICE STAYS PRIVATE</Caps>
          {busy ? (
            <span className="inline-flex items-center gap-1.5 text-terracotta text-[12px]">
              <Loader2 size={12} className="animate-spin" /> Working…
            </span>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-5 py-2 bg-ink text-cream text-[13px] font-medium border-none cursor-pointer"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
