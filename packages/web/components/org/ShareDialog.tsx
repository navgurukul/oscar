"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Lock,
  Users,
  Globe,
  Copy,
  Check,
  Loader2,
  Share2,
  Trash2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogTrigger,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import type { Visibility } from "@oscar/shared/types";

interface Props {
  kind: "scribble" | "meeting";
  id: string;
  visibility: Visibility | null;
  publicShareToken: string | null;
  organizationName?: string | null;
  /**
   * Whether to offer the "Workspace" (org) visibility option. False for solo
   * users with no real team — they see only Private / Public link. Defaults to
   * false so the collaboration option never leaks unless explicitly enabled.
   */
  allowOrgShare?: boolean;
  onChange?: (next: {
    visibility: Visibility;
    public_share_token: string | null;
  }) => void;
}

interface OptionConfig {
  value: Visibility;
  label: string;
  description: string;
  Icon: typeof Lock;
}

const OPTIONS: OptionConfig[] = [
  {
    value: "private",
    label: "Private",
    description: "Only you can see this.",
    Icon: Lock,
  },
  {
    value: "org",
    label: "Workspace",
    description: "Members of your workspace can read it from the team feed.",
    Icon: Users,
  },
  {
    value: "public",
    label: "Anyone with the link",
    description: "Generates a public URL. Anyone with the link can read it, no sign-in.",
    Icon: Globe,
  },
];

export function ShareDialog({
  kind,
  id,
  visibility,
  publicShareToken,
  organizationName,
  allowOrgShare = false,
  onChange,
}: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<Visibility>(visibility ?? "private");
  const [token, setToken] = useState<string | null>(publicShareToken);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => setCurrent(visibility ?? "private"), [visibility]);
  useEffect(() => setToken(publicShareToken), [publicShareToken]);

  const shareUrl = useMemo(() => {
    if (!token) return null;
    if (typeof window === "undefined") return null;
    const path = kind === "scribble" ? `/s/${token}` : `/m/${token}`;
    return `${window.location.origin}${path}`;
  }, [kind, token]);

  const apply = useCallback(
    async (next: Visibility) => {
      if (busy) return;
      setBusy(true);
      try {
        const res = await fetch(
          `/api/${kind === "scribble" ? "scribbles" : "meetings"}/${id}/share`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ visibility: next }),
          }
        );
        if (!res.ok) {
          const text = await res.text().catch(() => res.statusText);
          throw new Error(text || "Share update failed");
        }
        const json = (await res.json()) as {
          visibility: Visibility;
          public_share_token: string | null;
        };
        setCurrent(json.visibility);
        setToken(json.public_share_token);
        onChange?.({
          visibility: json.visibility,
          public_share_token: json.public_share_token,
        });
        toast({
          title:
            json.visibility === "public"
              ? "Public link ready"
              : json.visibility === "org"
                ? `Shared with ${organizationName ?? "your workspace"}`
                : "Made private",
        });
      } catch (err) {
        toast({
          title: "Share failed",
          description: err instanceof Error ? err.message : "Try again.",
          variant: "destructive",
        });
      } finally {
        setBusy(false);
      }
    },
    [busy, id, kind, onChange, organizationName, toast]
  );

  const copy = useCallback(async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [shareUrl]);

  const ActiveIcon =
    current === "public" ? Globe : current === "org" ? Users : Lock;

  // Solo users (no real team) never see the "Workspace" option. Still shown if
  // the item is somehow already org-shared, so its current state stays editable.
  const visibleOptions = useMemo(
    () =>
      allowOrgShare || current === "org"
        ? OPTIONS
        : OPTIONS.filter((o) => o.value !== "org"),
    [allowOrgShare, current]
  );

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <button
          className="p-2 rounded-full transition-all duration-200"
          style={{
            color: current === "private" ? "#8b8780" : "#b8623d",
            background: current === "public" ? "rgba(184,98,61,0.10)" : "transparent",
          }}
          aria-label="Share"
        >
          {current === "private" ? (
            <Share2 className="w-4 h-4" />
          ) : (
            <ActiveIcon className="w-4 h-4" />
          )}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent
        className="max-w-md"
        style={{ background: "#f7f4ee", border: "1px solid #e5e0d6", color: "#1a1816" }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle
            style={{
              fontFamily: '"EB Garamond", Georgia, serif',
              fontSize: 24,
              fontWeight: 500,
              letterSpacing: "-0.01em",
              color: "#1a1816",
            }}
          >
            Share this {kind}
          </AlertDialogTitle>
          <AlertDialogDescription style={{ color: "#5a5852" }}>
            Pick who can read it.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <ul className="space-y-2">
          {visibleOptions.map(({ value, label, description, Icon }) => {
            const selected = current === value;
            return (
              <li key={value}>
                <button
                  onClick={() => void apply(value)}
                  disabled={busy || selected}
                  className="w-full text-left flex items-start gap-3 p-3 rounded-lg transition-colors disabled:cursor-default"
                  style={{
                    background: selected ? "rgba(184,98,61,0.10)" : "#efeae0",
                    border: `1px solid ${selected ? "#b8623d" : "#e5e0d6"}`,
                  }}
                >
                  <Icon
                    className="w-5 h-5 mt-0.5 flex-shrink-0"
                    style={{ color: selected ? "#b8623d" : "#8b8780" }}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-sm font-medium flex items-center gap-2"
                      style={{ color: "#1a1816" }}
                    >
                      {label}
                      {selected && <Check className="w-4 h-4" style={{ color: "#b8623d" }} />}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "#5a5852" }}>
                      {description}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        {current === "public" && shareUrl && (
          <div className="mt-2 space-y-2">
            <p
              className="text-xs"
              style={{
                fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "#8b8780",
                fontSize: 10,
              }}
            >
              PUBLIC LINK
            </p>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={shareUrl}
                className="text-xs"
                style={{ background: "#efeae0", border: "1px solid #e5e0d6", color: "#1a1816" }}
              />
              <Button
                onClick={() => void copy()}
                variant="outline"
                size="sm"
                className="flex-shrink-0"
                style={{ background: "#1a1816", color: "#f7f4ee", border: "none" }}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <button
              onClick={() => void apply("private")}
              disabled={busy}
              className="text-xs inline-flex items-center gap-1"
              style={{ color: "#b8623d" }}
            >
              <Trash2 className="w-3 h-3" />
              Revoke link
            </button>
            <p className="text-xs" style={{ color: "#8b8780" }}>
              Revoking destroys this URL. A future re-share generates a new link.
            </p>
          </div>
        )}

        <AlertDialogFooter className="mt-4">
          <AlertDialogCancel style={{ background: "#1a1816", color: "#f7f4ee", border: "none" }}>
            {busy ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </span>
            ) : (
              "Done"
            )}
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
