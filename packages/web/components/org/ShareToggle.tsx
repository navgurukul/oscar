"use client";

import { useCallback, useEffect, useState } from "react";
import { Lock, Users } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { organizationService } from "@/lib/services/organization.service";
import { v2 } from "@/components/v2/V2Primitives";
import type { ActiveOrganization } from "@oscar/shared/types";

interface Props {
  kind: "scribble" | "meeting";
  id: string;
  shared: boolean;
  organizationName?: string | null;
  onChange?: (shared: boolean) => void;
  className?: string;
}

export function ShareToggle({ kind, id, shared, organizationName, onChange, className }: Props) {
  const { toast } = useToast();
  const [active, setActive] = useState<ActiveOrganization | null>(null);
  const [busy, setBusy] = useState(false);
  const [localShared, setLocalShared] = useState(shared);

  useEffect(() => setLocalShared(shared), [shared]);

  useEffect(() => {
    organizationService.current().then(setActive).catch(() => setActive(null));
  }, []);

  const orgLabel = organizationName ?? active?.organization.name ?? "your workspace";

  const toggle = useCallback(async () => {
    if (busy) return;
    const next = !localShared;
    setBusy(true);
    setLocalShared(next);
    try {
      const res = await fetch(`/api/${kind === "scribble" ? "scribbles" : "meetings"}/${id}/share`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shared_with_org: next }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(text || "Share toggle failed");
      }
      onChange?.(next);
      toast({
        title: next ? `Shared with ${orgLabel}` : "Made private",
        description: next
          ? "Members of this workspace can now read it in the Team feed."
          : "Only you can see this now.",
      });
    } catch (err) {
      setLocalShared(!next);
      toast({
        title: "Share failed",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }, [busy, id, kind, localShared, onChange, orgLabel, toast]);

  const Icon = localShared ? Users : Lock;

  // Sharing-with-workspace is collaboration: never show it to a solo user (no
  // real team). Hidden once we know the active org isn't a team.
  if (active && !active.hasTeam) return null;

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <button
            onClick={() => void toggle()}
            disabled={busy}
            className={`p-2 rounded-lg transition-all duration-300 ${className ?? ""}`}
            style={
              localShared
                ? { color: v2.accent, background: v2.accentSoft }
                : { color: v2.inkFaint, background: "transparent" }
            }
          >
            <Icon className="w-4 h-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>
            <span className="font-semibold">{localShared ? "Shared" : "Private"}</span>
            {" — "}
            {localShared
              ? `Visible to ${orgLabel}`
              : `Click to share with ${orgLabel}`}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
