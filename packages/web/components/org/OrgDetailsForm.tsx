"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { organizationService } from "@/lib/services/organization.service";
import type { Organization, OrganizationRole } from "@oscar/shared/types";

interface Props {
  organization: Organization;
  role: OrganizationRole;
  onUpdated?: (org: Organization) => void;
}

export function OrgDetailsForm({ organization, role, onUpdated }: Props) {
  const { toast } = useToast();
  const canEdit = role === "owner" || role === "admin";
  const [name, setName] = useState(organization.name);
  const [slug, setSlug] = useState(organization.slug);
  const [busy, setBusy] = useState(false);

  const dirty = name.trim() !== organization.name || slug.trim() !== organization.slug;

  const save = async () => {
    if (!dirty || !canEdit) return;
    setBusy(true);
    try {
      const updated = await organizationService.update(organization.id, {
        name: name.trim(),
        slug: slug.trim(),
      });
      toast({ title: "Workspace updated" });
      onUpdated?.(updated);
    } catch (err) {
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="bg-slate-900 border-cyan-700/30">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Building2 className="w-5 h-5 text-cyan-500" />
          Workspace details
        </CardTitle>
        <CardDescription className="text-gray-400">
          {canEdit ? "Edit your workspace name and URL slug." : "Only admins can edit these details."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="org-name" className="text-gray-300">Name</Label>
          <Input
            id="org-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!canEdit}
            className="bg-slate-800 border-slate-700 text-white"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="org-slug" className="text-gray-300">Slug</Label>
          <Input
            id="org-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            disabled={!canEdit}
            className="bg-slate-800 border-slate-700 text-white"
          />
        </div>
        {canEdit && (
          <Button
            onClick={save}
            disabled={busy || !dirty || !name.trim()}
            className="bg-cyan-500 hover:bg-cyan-600 text-white"
          >
            {busy ? "Saving..." : "Save changes"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
