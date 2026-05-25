"use client";

import { useCallback, useEffect, useState } from "react";
import { UserMinus, Crown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { organizationService } from "@/lib/services/organization.service";
import type {
  OrganizationMemberWithUser,
  OrganizationRole,
} from "@oscar/shared/types";
import {
  v2,
  v2Serif,
  V2Caps,
  V2Mono,
  V2Avatar,
} from "@/components/v2/V2Primitives";

interface Props {
  organizationId: string;
  currentUserId: string;
  currentRole: OrganizationRole;
}

function formatJoined(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso)
    .toLocaleDateString(undefined, { month: "short", year: "numeric" })
    .toUpperCase();
}

export function MemberList({ organizationId, currentUserId, currentRole }: Props) {
  const { toast } = useToast();
  const [members, setMembers] = useState<OrganizationMemberWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await organizationService.listMembers(organizationId);
      setMembers(list);
    } catch (err) {
      console.error("[MemberList] load failed", err);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const canManage = currentRole === "owner" || currentRole === "admin";
  const canChangeRoles = currentRole === "owner";
  const canTransferOwnership = currentRole === "owner";

  const transferOwnership = async (userId: string) => {
    setBusyId(userId);
    try {
      await organizationService.transferOwnership(organizationId, userId);
      setMembers((prev) =>
        prev.map((m) => {
          if (m.user_id === userId) return { ...m, role: "owner" };
          if (m.user_id === currentUserId) return { ...m, role: "admin" };
          return m;
        })
      );
      toast({
        title: "Ownership transferred",
        description: "You are now an admin of this workspace.",
      });
    } catch (err) {
      toast({
        title: "Transfer failed",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (userId: string) => {
    if (!canManage) return;
    setBusyId(userId);
    try {
      await organizationService.removeMember(organizationId, userId);
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
      toast({ title: "Member removed" });
    } catch (err) {
      toast({
        title: "Remove failed",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const changeRole = async (userId: string, role: OrganizationRole) => {
    if (!canChangeRoles) return;
    setBusyId(userId);
    try {
      await organizationService.updateMemberRole(organizationId, userId, role);
      setMembers((prev) => prev.map((m) => (m.user_id === userId ? { ...m, role } : m)));
      toast({ title: "Role updated" });
    } catch (err) {
      toast({
        title: "Role update failed",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <p className="text-[14px]" style={{ color: v2.inkSoft }}>
        Loading members…
      </p>
    );
  }

  return (
    <div>
      {/* Header row */}
      <div
        className="grid grid-cols-12 gap-4 py-3"
        style={{ borderTop: `1px solid ${v2.rule}`, borderBottom: `1px solid ${v2.rule}` }}
      >
        <div className="col-span-12 md:col-span-4">
          <V2Caps>NAME</V2Caps>
        </div>
        <div className="hidden md:block md:col-span-4">
          <V2Caps>EMAIL</V2Caps>
        </div>
        <div className="hidden md:block md:col-span-2">
          <V2Caps>ROLE</V2Caps>
        </div>
        <div className="hidden md:block md:col-span-2 text-right">
          <V2Caps>SINCE</V2Caps>
        </div>
      </div>

      {members.map((m) => {
        const isSelf = m.user_id === currentUserId;
        const isOwner = m.role === "owner";
        const name = m.display_name ?? m.email ?? m.user_id;
        return (
          <div
            key={m.user_id}
            className="grid grid-cols-12 gap-4 py-4 items-center"
            style={{ borderBottom: `1px solid ${v2.rule}` }}
          >
            <div className="col-span-12 md:col-span-4 flex items-center gap-3">
              <V2Avatar size={30} initial={name.charAt(0).toUpperCase()} />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate" style={{ fontSize: 14, color: v2.ink }}>
                    {name}
                  </span>
                  {isSelf && (
                    <V2Mono style={{ fontSize: 10, color: v2.accent, letterSpacing: "0.16em" }}>
                      YOU
                    </V2Mono>
                  )}
                </div>
                {m.email && m.display_name && (
                  <div className="md:hidden">
                    <V2Mono style={{ fontSize: 11, color: v2.inkSoft }}>{m.email}</V2Mono>
                  </div>
                )}
              </div>
            </div>
            <div className="hidden md:block md:col-span-4 truncate">
              <V2Mono style={{ fontSize: 12, color: v2.inkSoft }}>{m.email ?? "—"}</V2Mono>
            </div>
            <div className="col-span-8 md:col-span-2 flex items-center gap-2">
              {canChangeRoles && !isOwner && !isSelf ? (
                <Select
                  value={m.role}
                  onValueChange={(value) =>
                    void changeRole(m.user_id, value as OrganizationRole)
                  }
                  disabled={busyId === m.user_id}
                >
                  <SelectTrigger
                    className="h-7 w-24 text-xs"
                    style={{ background: v2.cream2, border: `1px solid ${v2.rule}`, color: v2.ink }}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    style={{ background: v2.cream, border: `1px solid ${v2.rule}`, color: v2.ink }}
                  >
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="member">Member</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <span
                  style={{
                    fontSize: 13,
                    color: isOwner ? v2.accent : v2.ink,
                    fontWeight: isOwner ? 500 : 400,
                    fontFamily: v2Serif,
                    letterSpacing: "-0.005em",
                    textTransform: "capitalize",
                  }}
                >
                  {m.role}
                </span>
              )}
            </div>
            <div className="col-span-4 md:col-span-2 flex items-center justify-end gap-1">
              <span
                className="hidden md:block"
                style={{
                  fontFamily: "var(--font-ibm-plex-mono), ui-monospace, monospace",
                  fontSize: 11,
                  color: v2.inkFaint,
                  marginRight: 8,
                }}
              >
                {formatJoined(m.joined_at)}
              </span>
              {canTransferOwnership && !isOwner && !isSelf && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      disabled={busyId === m.user_id}
                      className="p-1.5 rounded-full disabled:opacity-50"
                      style={{ color: v2.inkFaint }}
                      aria-label="Transfer ownership"
                      title="Transfer ownership"
                    >
                      <Crown className="w-3.5 h-3.5" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent
                    style={{ background: v2.cream, border: `1px solid ${v2.rule}`, color: v2.ink }}
                  >
                    <AlertDialogHeader>
                      <AlertDialogTitle
                        style={{
                          fontFamily: v2Serif,
                          fontSize: 24,
                          fontWeight: 500,
                          letterSpacing: "-0.01em",
                        }}
                      >
                        Make {name} the owner?
                      </AlertDialogTitle>
                      <AlertDialogDescription style={{ color: v2.inkSoft }}>
                        They will gain full control of this workspace including billing and member
                        management. You will be demoted to admin.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel
                        style={{
                          background: "transparent",
                          border: `1px solid ${v2.rule}`,
                          color: v2.inkSoft,
                        }}
                      >
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => void transferOwnership(m.user_id)}
                        style={{ background: v2.accent, color: v2.cream }}
                      >
                        Transfer ownership
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {canManage && !isOwner && !isSelf && (
                <button
                  onClick={() => void remove(m.user_id)}
                  disabled={busyId === m.user_id}
                  className="p-1.5 rounded-full disabled:opacity-50"
                  style={{ color: v2.inkFaint }}
                  title="Remove"
                >
                  <UserMinus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
