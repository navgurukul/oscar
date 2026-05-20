"use client";

import { useCallback, useEffect, useState } from "react";
import { Users, UserMinus, Shield, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

interface Props {
  organizationId: string;
  currentUserId: string;
  currentRole: OrganizationRole;
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

  return (
    <Card className="bg-slate-900 border-cyan-700/30">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-cyan-500" />
          Members
        </CardTitle>
        <CardDescription className="text-gray-400">
          {members.length} {members.length === 1 ? "member" : "members"} in this workspace
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-gray-500 text-sm">Loading members...</p>
        ) : (
          <ul className="divide-y divide-cyan-700/20">
            {members.map((m) => {
              const isSelf = m.user_id === currentUserId;
              const isOwner = m.role === "owner";
              return (
                <li key={m.user_id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm font-medium truncate">
                      {m.display_name ?? m.email ?? m.user_id}
                      {isSelf ? <span className="text-gray-500"> (you)</span> : null}
                    </p>
                    {m.email && m.display_name ? (
                      <p className="text-gray-500 text-xs truncate">{m.email}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {canChangeRoles && !isOwner && !isSelf ? (
                      <Select
                        value={m.role}
                        onValueChange={(value) => void changeRole(m.user_id, value as OrganizationRole)}
                        disabled={busyId === m.user_id}
                      >
                        <SelectTrigger className="w-28 h-8 bg-slate-800 border-slate-700 text-white text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-cyan-700/30 text-white">
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-gray-400 text-xs capitalize flex items-center gap-1">
                        {isOwner && <Shield className="w-3 h-3" />}
                        {m.role}
                      </span>
                    )}
                    {canTransferOwnership && !isOwner && !isSelf ? (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busyId === m.user_id}
                            className="h-8 w-8 p-0 text-gray-400 hover:text-amber-300 hover:bg-amber-400/10"
                            aria-label="Transfer ownership"
                          >
                            <Crown className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-slate-900 border-slate-800 text-white">
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Make {m.display_name ?? m.email ?? "this member"} the owner?
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-slate-400">
                              They will gain full control of this workspace including billing
                              and member management. You will be demoted to admin and lose the
                              ability to transfer ownership back without their consent.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="bg-slate-800 border-slate-700 text-white">
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => void transferOwnership(m.user_id)}
                              className="bg-amber-500 hover:bg-amber-600 text-slate-900"
                            >
                              Transfer ownership
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ) : null}
                    {canManage && !isOwner && !isSelf ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void remove(m.user_id)}
                        disabled={busyId === m.user_id}
                        className="h-8 w-8 p-0 text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                      >
                        <UserMinus className="w-4 h-4" />
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
