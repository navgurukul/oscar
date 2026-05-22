"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  v2,
  v2Serif,
  V2Caps,
  V2TeamHeader,
} from "@/components/v2/V2Primitives";
import { ROUTES } from "@/lib/constants";

export interface V2OrgSettingsSection {
  id: string;
  label: string;
  sub: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
}

export function createOrgSettingsSections({
  active,
  memberCount,
  pendingInvites,
  billingSub,
  onSectionSelect,
}: {
  active: string;
  memberCount?: number;
  pendingInvites?: number;
  billingSub?: string;
  onSectionSelect?: (section: "details" | "members" | "invites") => void;
}): V2OrgSettingsSection[] {
  const tabHref = (tab: "details" | "members" | "invites") =>
    `${ROUTES.ORG_SETTINGS}?tab=${tab}`;

  return [
    {
      id: "details",
      label: "Details",
      sub: "Identity · mark",
      href: tabHref("details"),
      onClick: onSectionSelect ? () => onSectionSelect("details") : undefined,
    },
    {
      id: "members",
      label: "Members & roles",
      sub:
        typeof memberCount === "number"
          ? `${memberCount} ${memberCount === 1 ? "member" : "members"}`
          : "Members",
      href: tabHref("members"),
      onClick: onSectionSelect ? () => onSectionSelect("members") : undefined,
    },
    {
      id: "invites",
      label: "Invites",
      sub:
        typeof pendingInvites === "number"
          ? `${pendingInvites} pending`
          : "Pending",
      href: tabHref("invites"),
      onClick: onSectionSelect ? () => onSectionSelect("invites") : undefined,
    },
    {
      id: "billing",
      label: "Billing",
      sub: billingSub ?? "Workspace plan",
      href: `${ROUTES.ORG_SETTINGS}/billing`,
    },
    {
      id: "analytics",
      label: "Analytics",
      sub: "Usage · members",
      href: `${ROUTES.ORG_SETTINGS}/analytics`,
    },
    {
      id: "audit",
      label: "Audit log",
      sub: "Shares · access",
      href: `${ROUTES.ORG_SETTINGS}/audit`,
    },
    {
      id: "integrations",
      label: "Integrations",
      sub: "Slack · Notion",
      disabled: true,
    },
    {
      id: "sso",
      label: "SSO",
      sub: "Coming soon",
      disabled: true,
    },
  ].map((section) => ({
    ...section,
    disabled: section.disabled ?? false,
    href: section.id === active && !section.onClick ? undefined : section.href,
  }));
}

function OrgSettingsNavItem({
  section,
  active,
}: {
  section: V2OrgSettingsSection;
  active: string;
}) {
  const isActive = section.id === active;
  const content = (
    <>
      <div
        style={{
          fontFamily: v2Serif,
          fontSize: 18,
          fontWeight: 500,
          color: isActive ? v2.ink : v2.inkSoft,
          letterSpacing: 0,
        }}
      >
        {section.label}
        {section.disabled && (
          <span style={{ marginLeft: 8, color: v2.inkFaint, fontSize: 12 }}>
            soon
          </span>
        )}
      </div>
      <div className="mt-0.5">
        <V2Caps>{section.sub.toUpperCase()}</V2Caps>
      </div>
    </>
  );

  const className = "block w-full text-left transition-opacity hover:opacity-80";
  const style = {
    borderLeft: isActive ? `2px solid ${v2.accent}` : "2px solid transparent",
    paddingLeft: 14,
    opacity: section.disabled ? 0.55 : 1,
  };

  if (section.disabled) {
    return (
      <div className={className} style={style}>
        {content}
      </div>
    );
  }

  if (section.onClick) {
    return (
      <button
        type="button"
        onClick={section.onClick}
        className={className}
        style={style}
      >
        {content}
      </button>
    );
  }

  if (section.href) {
    return (
      <Link href={section.href} className={className} style={style}>
        {content}
      </Link>
    );
  }

  return (
    <div className={className} style={style}>
      {content}
    </div>
  );
}

export function V2OrgSettingsShell({
  active,
  orgName,
  eyebrow,
  title,
  lead,
  sections,
  children,
}: {
  active: string;
  orgName: string;
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  sections: V2OrgSettingsSection[];
  children: ReactNode;
}) {
  return (
    <main
      style={{
        background: v2.cream,
        color: v2.ink,
        minHeight: "100vh",
        fontFamily: "var(--font-figtree), system-ui",
      }}
    >
      <V2TeamHeader active="SETTINGS" org={orgName} />
      <div className="grid grid-cols-12 px-6 md:px-14 py-10 md:py-14 gap-8 md:gap-10">
        <aside className="col-span-12 md:col-span-3">
          <Link href={ROUTES.SETTINGS} className="inline-block mb-5 hover:opacity-80">
            <V2Caps>← PERSONAL SETTINGS</V2Caps>
          </Link>
          <V2Caps>ORG SETTINGS</V2Caps>
          <nav className="mt-5 grid grid-cols-1 gap-4">
            {sections.map((section) => (
              <OrgSettingsNavItem
                key={section.id}
                section={section}
                active={active}
              />
            ))}
          </nav>
        </aside>

        <section className="col-span-12 md:col-span-9">
          <V2Caps>{eyebrow.toUpperCase()}</V2Caps>
          <h1
            className="mt-2 text-[38px] md:text-[52px]"
            style={{
              fontFamily: v2Serif,
              lineHeight: 0.98,
              letterSpacing: 0,
              fontWeight: 500,
            }}
          >
            {title}
          </h1>
          {lead && (
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed" style={{ color: v2.inkSoft }}>
              {lead}
            </p>
          )}
          <div className={lead ? "mt-12" : "mt-10"}>{children}</div>
        </section>
      </div>
    </main>
  );
}
