"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { organizationService } from "@/lib/services/organization.service";

export function CreateOrgForm({ onCreated }: { onCreated?: (orgId: string) => void }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const org = await organizationService.create({
        name: trimmed,
        slug: slug.trim() || undefined,
      });
      toast({ title: "Workspace created", description: org.name });
      await organizationService.switchTo(org.id);
      onCreated?.(org.id);
      setName("");
      setSlug("");
    } catch (err) {
      toast({
        title: "Could not create workspace",
        description: err instanceof Error ? err.message : "Try a different name.",
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
          <Plus className="w-5 h-5 text-cyan-500" />
          Create a workspace
        </CardTitle>
        <CardDescription className="text-gray-400">
          Spin up a new team workspace. You become the owner.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="new-org-name" className="text-gray-300">Name</Label>
          <Input
            id="new-org-name"
            placeholder="Acme team"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-slate-800 border-slate-700 text-white"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-org-slug" className="text-gray-300">Slug (optional)</Label>
          <Input
            id="new-org-slug"
            placeholder="acme-team"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="bg-slate-800 border-slate-700 text-white"
          />
        </div>
        <Button onClick={submit} disabled={busy || !name.trim()} className="bg-cyan-500 hover:bg-cyan-600 text-white">
          {busy ? "Creating..." : "Create workspace"}
        </Button>
      </CardContent>
    </Card>
  );
}
