export type OrganizationRole = "owner" | "admin" | "member";
export type InvitedRole = Exclude<OrganizationRole, "owner">;

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /**
   * When true, meetings recorded by members are auto-published (visibility
   * "public" + a share token) so the summary surfaces a public link. Default
   * false. See migration 014. Superseded by `default_meeting_visibility` —
   * retained for back-compat; the auto-publish trigger no longer reads it.
   */
  auto_publish_minutes: boolean;
  /**
   * Visibility applied to every new meeting a member records, unless an
   * explicit choice is made. "public" → a /m/{token} share link in the summary
   * (anyone with the link can read), "org" → shared with the workspace,
   * "private" → owner only. Product default is "public". See migration 015.
   */
  default_meeting_visibility: "private" | "org" | "public";
  /**
   * Email domain (lowercase, e.g. "navgurukul.org"). When set, any user
   * signing up with an email matching this domain is auto-added as a Member
   * of this org on signup, and their active org is flipped to this team org.
   * Only one org can claim a given domain. Generic public domains
   * (gmail.com, yahoo.com, outlook.com, etc.) are blocked at the API layer.
   * Null = feature off for this org. See migration 016.
   */
  auto_join_email_domain: string | null;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrganizationRole;
  joined_at: string;
}

export interface OrganizationMemberWithUser extends OrganizationMember {
  email: string | null;
  display_name: string | null;
}

export interface OrganizationInvite {
  id: string;
  organization_id: string;
  token_hash: string;
  email: string | null;
  role: InvitedRole;
  invited_by: string | null;
  expires_at: string | null;
  accepted_at: string | null;
  accepted_by: string | null;
  created_at: string;
}

export interface OrganizationInviteCreated extends OrganizationInvite {
  token: string;
  url: string;
  email_status?: "sent" | "skipped" | "failed";
  email_error?: string | null;
}

export interface UserActiveOrg {
  user_id: string;
  organization_id: string;
  updated_at: string;
}

export interface ActiveOrganization {
  organization: Organization;
  role: OrganizationRole;
}
