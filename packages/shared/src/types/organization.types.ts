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
