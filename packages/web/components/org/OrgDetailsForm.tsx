"use client";

import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { organizationService } from "@/lib/services/organization.service";
import type { Organization, OrganizationRole } from "@oscar/shared/types";
import { v2, v2Serif, V2Caps } from "@/components/v2/V2Primitives";

interface Props {
  organization: Organization;
  role: OrganizationRole;
  onUpdated?: (org: Organization) => void;
}

function Row({
  label,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  placeholder?: string;
}) {
  return (
    <div
      className="flex items-center justify-between py-4 gap-4"
      style={{ borderBottom: `1px solid ${v2.rule}` }}
    >
      <V2Caps>{label}</V2Caps>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="text-right bg-transparent outline-none disabled:opacity-60"
        style={{
          fontSize: 14,
          color: v2.ink,
          fontFamily: "var(--font-figtree), system-ui",
          width: "60%",
          textAlign: "right",
        }}
      />
    </div>
  );
}

export function OrgDetailsForm({ organization, role, onUpdated }: Props) {
  const { toast } = useToast();
  const canEdit = role === "owner" || role === "admin";
  const [name, setName] = useState(organization.name);
  const [slug, setSlug] = useState(organization.slug);
  const [busy, setBusy] = useState(false);
  const [autoPublish, setAutoPublish] = useState(
    organization.auto_publish_minutes
  );
  const [sharingBusy, setSharingBusy] = useState(false);

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

  const toggleAutoPublish = async () => {
    if (!canEdit || sharingBusy) return;
    const next = !autoPublish;
    setSharingBusy(true);
    setAutoPublish(next); // optimistic
    try {
      const updated = await organizationService.update(organization.id, {
        auto_publish_minutes: next,
      });
      onUpdated?.(updated);
      toast({
        title: next ? "Auto-publish on" : "Auto-publish off",
        description: next
          ? "New meetings get a public share link in their summary."
          : "New meetings stay private unless you share them.",
      });
    } catch (err) {
      setAutoPublish(!next); // revert
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setSharingBusy(false);
    }
  };

  return (
    <div className="space-y-12">
      {/* Identity */}
      <section
        className="grid grid-cols-12 gap-6 md:gap-10"
        style={{ borderTop: `1px solid ${v2.rule}`, paddingTop: 24 }}
      >
        <div className="col-span-12 md:col-span-3">
          <V2Caps>IDENTITY</V2Caps>
          {!canEdit && (
            <p className="mt-2 text-[12px]" style={{ color: v2.inkFaint }}>
              Read-only — only owners and admins can edit.
            </p>
          )}
        </div>
        <div className="col-span-12 md:col-span-9">
          <Row label="NAME" value={name} onChange={setName} disabled={!canEdit} placeholder="Acme team" />
          <Row label="SLUG" value={slug} onChange={setSlug} disabled={!canEdit} placeholder="acme-team" />
          {canEdit && (
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                onClick={save}
                disabled={busy || !dirty || !name.trim()}
                className="text-[12px] rounded-full px-4 py-2 font-medium disabled:opacity-50"
                style={{ background: v2.ink, color: v2.cream }}
              >
                {busy ? "Saving…" : "Save changes"}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Sharing — workspace-wide default for new Minutes */}
      <section
        className="grid grid-cols-12 gap-6 md:gap-10"
        style={{ borderTop: `1px solid ${v2.rule}`, paddingTop: 24 }}
      >
        <div className="col-span-12 md:col-span-3">
          <V2Caps>SHARING</V2Caps>
          {!canEdit && (
            <p className="mt-2 text-[12px]" style={{ color: v2.inkFaint }}>
              Read-only — only owners and admins can change this.
            </p>
          )}
        </div>
        <div className="col-span-12 md:col-span-9">
          <div
            className="flex items-start justify-between gap-6 py-4"
            style={{ borderBottom: `1px solid ${v2.rule}` }}
          >
            <div className="min-w-0">
              <p className="text-[14px] font-medium" style={{ color: v2.ink }}>
                Auto-publish new Minutes
              </p>
              <p
                className="mt-1 text-[12px] leading-relaxed"
                style={{ color: v2.inkSoft, maxWidth: 460 }}
              >
                Every meeting a member records gets a public link in its summary —
                anyone with the link can read it, no sign-in. Off by default;
                existing meetings stay private.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autoPublish}
              aria-label="Auto-publish new Minutes"
              disabled={!canEdit || sharingBusy}
              onClick={() => void toggleAutoPublish()}
              className="relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50"
              style={{ background: autoPublish ? v2.accent : v2.rule }}
            >
              <span
                className="inline-block h-5 w-5 rounded-full bg-white transition-transform"
                style={{
                  transform: autoPublish ? "translateX(22px)" : "translateX(2px)",
                }}
              />
            </button>
          </div>
        </div>
      </section>

      {/* Workspace mark — visual placeholder, no upload service wired yet */}
      <section
        className="grid grid-cols-12 gap-6 md:gap-10"
        style={{ borderTop: `1px solid ${v2.rule}`, paddingTop: 24 }}
      >
        <div className="col-span-12 md:col-span-3">
          <V2Caps>WORKSPACE MARK</V2Caps>
        </div>
        <div className="col-span-12 md:col-span-9 flex items-center gap-6 flex-wrap">
          <div
            style={{
              height: 64,
              width: 64,
              borderRadius: 14,
              background: v2.accent,
              color: v2.cream,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: v2Serif,
              fontWeight: 500,
              fontSize: 32,
            }}
          >
            {organization.name.charAt(0).toUpperCase()}
          </div>
          <p className="text-[12px]" style={{ color: v2.inkSoft, maxWidth: 320 }}>
            Auto-generated from the workspace name. Used in the org switcher and on shared
            Minutes.
          </p>
        </div>
      </section>
    </div>
  );
}
