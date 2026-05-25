"use client";

import { useCallback, useEffect, useState } from "react";
import { Mail, Link2, Copy, X, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { organizationService } from "@/lib/services/organization.service";
import type {
  InvitedRole,
  OrganizationInvite,
  OrganizationInviteCreated,
} from "@oscar/shared/types";
import { v2, v2Mono, V2Caps } from "@/components/v2/V2Primitives";

interface Props {
  organizationId: string;
}

function formatRelative(iso: string | null | undefined) {
  if (!iso) return "NEVER";
  const date = new Date(iso);
  const now = Date.now();
  const diffMs = date.getTime() - now;
  if (diffMs <= 0) return "EXPIRED";
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (days < 1) return "TODAY";
  if (days === 1) return "1 DAY";
  if (days < 30) return `${days} DAYS`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" }).toUpperCase();
}

export function InvitePanel({ organizationId }: Props) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InvitedRole>("member");
  const [busy, setBusy] = useState(false);
  const [latest, setLatest] = useState<OrganizationInviteCreated | null>(null);
  const [invites, setInvites] = useState<OrganizationInvite[]>([]);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await organizationService.listInvites(organizationId);
      setInvites(list);
    } catch (err) {
      console.error("[InvitePanel] load failed", err);
    }
  }, [organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async (withEmail: boolean) => {
    setBusy(true);
    try {
      const invite = await organizationService.createInvite({
        organization_id: organizationId,
        email: withEmail ? email.trim().toLowerCase() : null,
        role,
      });
      setLatest(invite);
      if (withEmail) setEmail("");
      await load();
      let description = "Anyone with this link can join.";
      if (withEmail) {
        if (invite.email_status === "sent") {
          description = `Invite emailed to ${invite.email ?? "your teammate"}. They can also use the link below.`;
        } else if (invite.email_status === "failed") {
          description = `Email delivery failed${invite.email_error ? `: ${invite.email_error}` : ""}. Share the link manually.`;
        } else {
          description = "Email isn't configured yet — share the link manually.";
        }
      }
      toast({ title: withEmail ? "Email invite created" : "Invite link ready", description });
    } catch (err) {
      toast({
        title: "Invite failed",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    try {
      await organizationService.revokeInvite(id);
      setInvites((prev) => prev.filter((i) => i.id !== id));
      toast({ title: "Invite revoked" });
    } catch (err) {
      toast({
        title: "Revoke failed",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    }
  };

  const copy = async () => {
    if (!latest) return;
    await navigator.clipboard.writeText(latest.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="space-y-10">
      {/* Send an invite */}
      <section
        className="rounded-lg p-7"
        style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}
      >
        <V2Caps>SEND AN INVITE</V2Caps>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
          <Input
            type="email"
            placeholder="name@work.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="text-[14px]"
            style={{ background: v2.cream, border: `1px solid ${v2.rule}`, color: v2.ink }}
          />
          <Select value={role} onValueChange={(value) => setRole(value as InvitedRole)}>
            <SelectTrigger
              className="w-32 text-[13px]"
              style={{ background: v2.cream, border: `1px solid ${v2.rule}`, color: v2.ink }}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent
              style={{ background: v2.cream, border: `1px solid ${v2.rule}`, color: v2.ink }}
            >
              <SelectItem value="member">Member</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="mt-4 flex gap-2 flex-wrap">
          <button
            onClick={() => void create(true)}
            disabled={busy || !email.includes("@")}
            className="text-[12px] rounded-full px-4 py-2 font-medium inline-flex items-center gap-1.5 disabled:opacity-50"
            style={{ background: v2.ink, color: v2.cream }}
          >
            <Mail className="w-3.5 h-3.5" />
            Send invite
          </button>
          <button
            onClick={() => void create(false)}
            disabled={busy}
            className="text-[12px] rounded-full px-4 py-2 inline-flex items-center gap-1.5 disabled:opacity-50"
            style={{ border: `1px solid ${v2.rule}`, color: v2.inkSoft }}
          >
            <Link2 className="w-3.5 h-3.5" />
            Get shareable link
          </button>
        </div>

        {latest && (
          <div
            className="mt-5 rounded-md p-4"
            style={{ background: v2.cream, border: `1px solid ${v2.rule}` }}
          >
            <V2Caps>INVITE LINK</V2Caps>
            <div className="mt-2 flex items-center gap-2">
              <Input
                readOnly
                value={latest.url}
                className="text-xs"
                style={{
                  background: v2.cream2,
                  border: `1px solid ${v2.rule}`,
                  color: v2.ink,
                  fontFamily: v2Mono,
                }}
              />
              <button
                onClick={() => void copy()}
                className="p-2 rounded-full"
                style={{ background: v2.ink, color: v2.cream }}
                aria-label="Copy"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="mt-2 text-[12px]" style={{ color: v2.inkSoft }}>
              {latest.email
                ? `Only ${latest.email} can accept this invite.`
                : "Anyone with this link can join until it expires."}
            </p>
          </div>
        )}
      </section>

      {/* Pending list */}
      {invites.length > 0 && (
        <section>
          <V2Caps>PENDING · {invites.length}</V2Caps>
          <div className="mt-3">
            {invites.map((inv) => (
              <div
                key={inv.id}
                className="grid grid-cols-12 gap-2 md:gap-4 py-4 items-center"
                style={{ borderBottom: `1px solid ${v2.rule}` }}
              >
                <span
                  className="truncate md:hidden"
                  style={{
                    fontFamily: v2Mono,
                    fontSize: 13,
                    color: v2.ink,
                    gridColumn: "span 12 / span 12",
                  }}
                >
                  {inv.email ?? "Shareable link"}
                </span>
                <span
                  className="hidden md:block truncate"
                  style={{
                    fontFamily: v2Mono,
                    fontSize: 13,
                    color: v2.ink,
                    gridColumn: "span 5 / span 5",
                  }}
                >
                  {inv.email ?? "Shareable link"}
                </span>
                <span
                  className="col-span-4 md:col-span-3 capitalize"
                  style={{ fontSize: 13, color: v2.inkSoft }}
                >
                  {inv.role}
                </span>
                <div className="col-span-6 md:col-span-3">
                  <V2Caps>
                    EXPIRES {formatRelative(inv.expires_at)}
                  </V2Caps>
                </div>
                <div className="col-span-2 md:col-span-1 text-right">
                  <button
                    onClick={() => void revoke(inv.id)}
                    className="p-1.5 rounded-full"
                    style={{ color: v2.inkFaint }}
                    title="Revoke"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
