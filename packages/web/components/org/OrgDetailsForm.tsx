"use client";

import { useCallback, useEffect, useState } from "react";
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
  const [visibility, setVisibility] = useState<
    "private" | "org" | "public"
  >(organization.default_meeting_visibility ?? "public");
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

  const changeVisibility = async (next: "private" | "org" | "public") => {
    if (!canEdit || sharingBusy || next === visibility) return;
    const prev = visibility;
    setSharingBusy(true);
    setVisibility(next); // optimistic
    try {
      const updated = await organizationService.update(organization.id, {
        default_meeting_visibility: next,
      });
      onUpdated?.(updated);
      toast({
        title: "Default visibility updated",
        description:
          next === "public"
            ? "New meetings get a public share link in their summary."
            : next === "org"
            ? "New meetings are shared with the workspace only."
            : "New meetings stay private unless you share them.",
      });
    } catch (err) {
      setVisibility(prev); // revert
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setSharingBusy(false);
    }
  };

  const VISIBILITY_OPTIONS: Array<{
    value: "public" | "org" | "private";
    label: string;
    blurb: string;
  }> = [
    {
      value: "public",
      label: "Public link",
      blurb:
        "Every new meeting gets a public /m/ link in its summary — anyone with the link can read it, no sign-in.",
    },
    {
      value: "org",
      label: "Workspace",
      blurb: "New meetings are visible to workspace members only.",
    },
    {
      value: "private",
      label: "Private",
      blurb: "New meetings stay private to the recorder until shared.",
    },
  ];

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
          <p
            className="text-[14px] font-medium"
            style={{ color: v2.ink }}
          >
            Default visibility for new Minutes
          </p>
          <p
            className="mt-1 text-[12px] leading-relaxed"
            style={{ color: v2.inkSoft, maxWidth: 480 }}
          >
            Applies to meetings recorded from now on. Existing meetings keep their
            current visibility — change any one from its own page.
          </p>
          <div className="mt-4 space-y-2">
            {VISIBILITY_OPTIONS.map((opt) => {
              const active = visibility === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={!canEdit || sharingBusy}
                  onClick={() => void changeVisibility(opt.value)}
                  className="flex w-full items-start gap-3 rounded-xl px-4 py-3 text-left transition-colors disabled:opacity-50"
                  style={{
                    border: `1px solid ${active ? v2.accent : v2.rule}`,
                    background: active ? v2.accentSoft : "transparent",
                  }}
                >
                  <span
                    className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                    style={{
                      border: `1.5px solid ${active ? v2.accent : v2.rule}`,
                    }}
                  >
                    {active && (
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: v2.accent }}
                      />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span
                      className="block text-[13.5px] font-medium"
                      style={{ color: v2.ink }}
                    >
                      {opt.label}
                    </span>
                    <span
                      className="mt-0.5 block text-[12px] leading-relaxed"
                      style={{ color: v2.inkSoft }}
                    >
                      {opt.blurb}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Team auto-join — owner-only, gates membership on email domain */}
      <AutoJoinSection
        organization={organization}
        role={role}
        onUpdated={onUpdated}
      />

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

function AutoJoinSection({
  organization,
  role,
  onUpdated,
}: {
  organization: Organization;
  role: OrganizationRole;
  onUpdated?: (org: Organization) => void;
}) {
  const { toast } = useToast();
  const canEdit = role === "owner";
  const initialDomain = organization.auto_join_email_domain ?? "";
  const [domain, setDomain] = useState(initialDomain);
  const [saving, setSaving] = useState(false);
  const [candidates, setCandidates] = useState<
    Array<{ user_id: string; email: string; display_name: string }>
  >([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  const enabled = !!organization.auto_join_email_domain;
  const dirty = domain.trim().toLowerCase() !== initialDomain.toLowerCase();

  const reloadCandidates = useCallback(async () => {
    if (!organization.auto_join_email_domain) {
      setCandidates([]);
      return;
    }
    setCandidatesLoading(true);
    try {
      const list = await organizationService.listAutoJoinCandidates(organization.id);
      setCandidates(list);
    } catch (err) {
      console.error("[org] list auto-join candidates failed", err);
    } finally {
      setCandidatesLoading(false);
    }
  }, [organization.auto_join_email_domain, organization.id]);

  useEffect(() => {
    void reloadCandidates();
  }, [reloadCandidates]);

  const save = async (nextDomain: string | null) => {
    if (!canEdit || saving) return;
    setSaving(true);
    try {
      const updated = await organizationService.update(organization.id, {
        auto_join_email_domain: nextDomain,
      });
      onUpdated?.(updated);
      setDomain(nextDomain ?? "");
      toast({
        title: nextDomain ? "Auto-join enabled" : "Auto-join disabled",
        description: nextDomain
          ? `New users with @${nextDomain} emails will auto-join.`
          : "Sign-ups no longer auto-join this workspace.",
      });
    } catch (err) {
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const addAll = async () => {
    if (adding || candidates.length === 0) return;
    setAdding(true);
    try {
      const result = await organizationService.backfillAutoJoin(
        organization.id,
        candidates.map((c) => c.user_id)
      );
      toast({
        title: result.added > 0 ? `Added ${result.added} member${result.added === 1 ? "" : "s"}` : "No new members",
        description:
          result.added > 0
            ? "They'll see the workspace next time they open Oscar."
            : "Everyone matching is already a member.",
      });
      await reloadCandidates();
    } catch (err) {
      toast({
        title: "Add failed",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setAdding(false);
    }
  };

  return (
    <section
      className="grid grid-cols-12 gap-6 md:gap-10"
      style={{ borderTop: `1px solid ${v2.rule}`, paddingTop: 24 }}
    >
      <div className="col-span-12 md:col-span-3">
        <V2Caps>TEAM AUTO-JOIN</V2Caps>
        {!canEdit && (
          <p className="mt-2 text-[12px]" style={{ color: v2.inkFaint }}>
            Owner-only control.
          </p>
        )}
      </div>
      <div className="col-span-12 md:col-span-9">
        <p className="text-[14px] font-medium" style={{ color: v2.ink }}>
          Auto-join by email domain
        </p>
        <p
          className="mt-1 text-[12px] leading-relaxed"
          style={{ color: v2.inkSoft, maxWidth: 480 }}
        >
          Anyone signing up with an email from this domain joins as a Member
          automatically. Domain must match your own email. Generic providers
          (gmail.com, yahoo.com, etc.) are not allowed.
        </p>

        <div className="mt-4 flex items-center gap-3">
          <div
            className="flex items-center gap-2 rounded-md px-3 py-2"
            style={{ border: `1px solid ${v2.rule}`, flex: 1, maxWidth: 320 }}
          >
            <span className="text-[13px]" style={{ color: v2.inkFaint }}>
              @
            </span>
            <input
              value={domain}
              onChange={(e) =>
                setDomain(e.target.value.toLowerCase().replace(/^@/, ""))
              }
              disabled={!canEdit || saving}
              placeholder="navgurukul.org"
              className="flex-1 bg-transparent outline-none disabled:opacity-60"
              style={{
                fontSize: 13,
                color: v2.ink,
                fontFamily: "var(--font-figtree), system-ui",
              }}
            />
          </div>
          {canEdit && (
            <>
              <button
                onClick={() => void save(domain.trim() || null)}
                disabled={!dirty || saving}
                className="text-[12px] rounded-full px-4 py-2 font-medium disabled:opacity-50"
                style={{ background: v2.ink, color: v2.cream }}
              >
                {saving ? "Saving…" : enabled && !dirty ? "Saved" : "Save"}
              </button>
              {enabled && (
                <button
                  onClick={() => void save(null)}
                  disabled={saving}
                  className="text-[12px] rounded-full px-4 py-2 font-medium disabled:opacity-50"
                  style={{ border: `1px solid ${v2.rule}`, color: v2.ink }}
                >
                  Turn off
                </button>
              )}
            </>
          )}
        </div>

        {enabled && (
          <div
            className="mt-5 rounded-xl px-4 py-3"
            style={{ border: `1px solid ${v2.rule}`, background: v2.cream2 }}
          >
            {candidatesLoading ? (
              <p className="text-[12px]" style={{ color: v2.inkSoft }}>
                Checking for existing users…
              </p>
            ) : candidates.length === 0 ? (
              <p className="text-[12px]" style={{ color: v2.inkSoft }}>
                No existing users with @{organization.auto_join_email_domain}{" "}
                emails are waiting to be added.
              </p>
            ) : (
              <>
                <p className="text-[13px] font-medium" style={{ color: v2.ink }}>
                  {candidates.length} existing user
                  {candidates.length === 1 ? "" : "s"} with @
                  {organization.auto_join_email_domain} email
                  {candidates.length === 1 ? "" : "s"} not in this workspace yet
                </p>
                <ul
                  className="mt-2 text-[12px] space-y-1"
                  style={{ color: v2.inkSoft }}
                >
                  {candidates.slice(0, 5).map((c) => (
                    <li key={c.user_id}>
                      • {c.display_name} ({c.email})
                    </li>
                  ))}
                  {candidates.length > 5 && (
                    <li>…and {candidates.length - 5} more</li>
                  )}
                </ul>
                {canEdit && (
                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={() => void addAll()}
                      disabled={adding}
                      className="text-[12px] rounded-full px-4 py-2 font-medium disabled:opacity-50"
                      style={{ background: v2.accent, color: v2.cream }}
                    >
                      {adding ? "Adding…" : `Add all as Members`}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
