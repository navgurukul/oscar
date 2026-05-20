"use client";

import { useCallback, useEffect, useState } from "react";
import { Mail, Link2, Copy, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

interface Props {
  organizationId: string;
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
      toast({
        title: withEmail ? "Email invite created" : "Invite link ready",
        description: withEmail
          ? "Share the link with the invited teammate (email delivery ships in Phase 4)."
          : "Anyone with this link can join.",
      });
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
    <Card className="bg-slate-900 border-cyan-700/30">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Mail className="w-5 h-5 text-cyan-500" />
          Invite teammates
        </CardTitle>
        <CardDescription className="text-gray-400">
          Send an email-pinned invite or generate a shareable link.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
            <div className="space-y-2">
              <Label htmlFor="invite-email" className="text-gray-300">Email</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="teammate@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Role</Label>
              <Select value={role} onValueChange={(value) => setRole(value as InvitedRole)}>
                <SelectTrigger className="w-32 bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-cyan-700/30 text-white">
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => void create(true)}
              disabled={busy || !email.includes("@")}
              className="bg-cyan-500 hover:bg-cyan-600 text-white"
            >
              <Mail className="w-4 h-4 mr-2" /> Send invite
            </Button>
            <Button
              variant="outline"
              onClick={() => void create(false)}
              disabled={busy}
              className="border-cyan-700/40 text-gray-200 hover:bg-slate-800"
            >
              <Link2 className="w-4 h-4 mr-2" /> Get shareable link
            </Button>
          </div>
        </div>

        {latest && (
          <div className="rounded-lg border border-cyan-700/30 bg-slate-800/60 p-3">
            <Label className="text-gray-300 text-xs">Invite link</Label>
            <div className="mt-1 flex items-center gap-2">
              <Input
                readOnly
                value={latest.url}
                className="bg-slate-900 border-slate-700 text-white text-xs"
              />
              <Button
                onClick={() => void copy()}
                variant="ghost"
                size="sm"
                className="text-cyan-400 hover:bg-cyan-500/10"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-gray-500 text-xs mt-2">
              {latest.email
                ? `Only ${latest.email} can accept this invite.`
                : "Anyone with this link can join until it expires."}
            </p>
          </div>
        )}

        {invites.length > 0 && (
          <div>
            <Label className="text-gray-300 text-xs uppercase tracking-wide">Pending invites</Label>
            <ul className="mt-2 divide-y divide-cyan-700/20">
              {invites.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between py-2">
                  <div className="min-w-0">
                    <p className="text-white text-sm truncate">
                      {inv.email ?? "Shareable link"}
                    </p>
                    <p className="text-gray-500 text-xs">
                      {inv.role} · expires{" "}
                      {inv.expires_at ? new Date(inv.expires_at).toLocaleDateString() : "never"}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void revoke(inv.id)}
                    className="h-8 w-8 p-0 text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
