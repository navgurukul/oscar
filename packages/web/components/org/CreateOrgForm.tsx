"use client";

import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { organizationService } from "@/lib/services/organization.service";
import { v2, v2Serif, v2Mono, V2Caps, V2Mono } from "@/components/v2/V2Primitives";

const USE_CASES = [
  "Product team",
  "Customer calls",
  "Research interviews",
  "Founder journals",
  "Engineering syncs",
  "Something else",
] as const;

export function CreateOrgForm({ onCreated }: { onCreated?: (orgId: string) => void }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [useCase, setUseCase] = useState<string | null>(null);
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
      setUseCase(null);
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
    <div
      className="rounded-lg p-7 md:p-9"
      style={{
        background: v2.cream2,
        border: `1px solid ${v2.rule}`,
        color: v2.ink,
      }}
    >
      <V2Caps color={v2.accent}>NEW WORKSPACE</V2Caps>
      <h2
        className="mt-3"
        style={{
          fontFamily: v2Serif,
          fontSize: "clamp(32px, 5vw, 44px)",
          lineHeight: 1.0,
          letterSpacing: "-0.025em",
          fontWeight: 500,
        }}
      >
        What&rsquo;s the <em style={{ fontStyle: "italic", color: v2.accent }}>name</em> of it?
      </h2>
      <p className="mt-4 text-[14px] leading-relaxed" style={{ color: v2.inkSoft }}>
        Pick a name for your workspace. You can change it later. This becomes the home for your
        team&rsquo;s shared Minutes, docs, and vocabulary.
      </p>

      <div className="mt-8">
        <V2Caps>WORKSPACE NAME</V2Caps>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. NavGurukul · Product"
          className="mt-2 w-full bg-transparent outline-none py-3 text-[20px]"
          style={{
            borderBottom: `1px solid ${v2.ink}`,
            color: v2.ink,
            fontFamily: v2Serif,
            fontWeight: 500,
          }}
        />
        <p className="mt-2 text-[12px]" style={{ color: v2.inkFaint }}>
          This appears in the org switcher and on shared Minutes.
        </p>
      </div>

      <div className="mt-7">
        <V2Caps>SLUG · USED IN LINKS</V2Caps>
        <div className="mt-2 flex items-baseline gap-2">
          <V2Mono style={{ fontSize: 14, color: v2.inkFaint }}>oscar.so/team/</V2Mono>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
            placeholder="acme-team"
            className="flex-1 bg-transparent outline-none py-3 text-[15px]"
            style={{ borderBottom: `1px solid ${v2.ink}`, color: v2.ink, fontFamily: v2Mono }}
          />
        </div>
      </div>

      <div className="mt-7">
        <V2Caps>WHAT WILL YOU USE IT FOR? (OPTIONAL)</V2Caps>
        <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-3">
          {USE_CASES.map((t) => {
            const active = useCase === t;
            return (
              <button
                key={t}
                onClick={() => setUseCase(active ? null : t)}
                className="rounded-md py-3 px-4 text-left text-[13px] transition-colors"
                style={{
                  background: active ? v2.cream2 : "transparent",
                  border: `1px solid ${active ? v2.accent : v2.rule}`,
                  color: v2.ink,
                  fontWeight: active ? 500 : 400,
                }}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-10 flex items-center gap-3">
        <button
          onClick={() => void submit()}
          disabled={busy || !name.trim()}
          className="rounded-full px-7 py-3.5 text-[14px] font-medium disabled:opacity-50"
          style={{ background: v2.ink, color: v2.cream }}
        >
          {busy ? "Creating…" : "Create workspace"}
        </button>
      </div>
    </div>
  );
}
