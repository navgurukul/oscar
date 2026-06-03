import { createHash, randomBytes } from "crypto";
import type {
  ActiveOrganization,
  InvitedRole,
  Organization,
  OrganizationInvite,
  OrganizationInviteCreated,
  OrganizationMember,
  OrganizationMemberWithUser,
  OrganizationRole,
} from "@oscar/shared/types";
import { getSupabaseAdmin } from "./supabase-admin";

const INVITE_TTL_DAYS = 14;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function buildInviteUrl(origin: string, token: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/invite/${token}`;
}

export async function getOrCreateDefaultOrg(
  userId: string,
  userEmail: string,
  displayName?: string | null
): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("ensure_default_org", {
    p_user_id: userId,
    p_user_email: userEmail,
    p_user_name: displayName ?? null,
  });
  if (error) {
    console.error("[org] ensure_default_org failed", error);
    return null;
  }
  return (data as string | null) ?? null;
}

type JoinedOrgRow = {
  role: OrganizationRole;
  organization: Organization | Organization[] | null;
};

function unwrapOrg(value: JoinedOrgRow["organization"]): Organization | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export async function listMemberships(userId: string): Promise<
  Array<{ organization: Organization; role: OrganizationRole }>
> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("organization_members")
    .select("role, organization:organizations(*)")
    .eq("user_id", userId);

  if (error) {
    console.error("[org] listMemberships failed", error);
    return [];
  }
  const rows = (data ?? []) as unknown as JoinedOrgRow[];
  return rows
    .map((row) => ({ role: row.role, organization: unwrapOrg(row.organization) }))
    .filter((row): row is { role: OrganizationRole; organization: Organization } =>
      row.organization !== null
    );
}

export async function getActiveOrg(
  userId: string
): Promise<ActiveOrganization | null> {
  const supabase = getSupabaseAdmin();

  const { data: active } = await supabase
    .from("user_active_org")
    .select("organization_id")
    .eq("user_id", userId)
    .maybeSingle();

  let orgId = active?.organization_id ?? null;

  if (!orgId) {
    const { data: anyMembership } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId)
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    orgId = anyMembership?.organization_id ?? null;
    if (orgId) {
      await supabase.from("user_active_org").upsert({
        user_id: userId,
        organization_id: orgId,
      });
    }
  }

  if (!orgId) return null;

  const { data: row } = await supabase
    .from("organization_members")
    .select("role, organization:organizations(*)")
    .eq("user_id", userId)
    .eq("organization_id", orgId)
    .maybeSingle();

  const joined = row as unknown as JoinedOrgRow | null;
  const org = unwrapOrg(joined?.organization ?? null);
  if (!joined || !org) return null;
  return {
    organization: org,
    role: joined.role,
  };
}

export async function setActiveOrg(
  userId: string,
  organizationId: string
): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data: member } = await supabase
    .from("organization_members")
    .select("id")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!member) return false;

  const { error } = await supabase.from("user_active_org").upsert({
    user_id: userId,
    organization_id: organizationId,
  });
  if (error) {
    console.error("[org] setActiveOrg failed", error);
    return false;
  }
  return true;
}

export async function getMemberRole(
  userId: string,
  organizationId: string
): Promise<OrganizationRole | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("organization_members")
    .select("role")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  return (data?.role as OrganizationRole | undefined) ?? null;
}

export async function listMembers(
  organizationId: string
): Promise<OrganizationMemberWithUser[]> {
  const supabase = getSupabaseAdmin();
  const { data: members, error } = await supabase
    .from("organization_members")
    .select("*")
    .eq("organization_id", organizationId)
    .order("joined_at", { ascending: true });

  if (error || !members) {
    if (error) console.error("[org] listMembers failed", error);
    return [];
  }

  const userIds = members.map((m: OrganizationMember) => m.user_id);
  if (userIds.length === 0) return [];

  const { data: usersData } = await supabase.auth.admin.listUsers({ perPage: 200 });
  const userMap = new Map<string, { email: string | null; name: string | null }>();
  for (const u of usersData?.users ?? []) {
    userMap.set(u.id, {
      email: u.email ?? null,
      name:
        (u.user_metadata?.full_name as string | undefined) ??
        (u.user_metadata?.name as string | undefined) ??
        null,
    });
  }

  return members.map((m: OrganizationMember) => {
    const info = userMap.get(m.user_id);
    return {
      ...m,
      email: info?.email ?? null,
      display_name: info?.name ?? null,
    };
  });
}

export async function createOrganization(
  ownerId: string,
  ownerEmail: string,
  name: string,
  slug?: string
): Promise<Organization | null> {
  const supabase = getSupabaseAdmin();
  const fallback = (slug ?? name)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "team";

  let candidate = fallback;
  for (let n = 0; n < 25; n++) {
    const { data: existing } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!existing) break;
    candidate = `${fallback}-${n + 1}`;
  }

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({ name, slug: candidate, created_by: ownerId })
    .select("*")
    .single();

  if (orgError || !org) {
    console.error("[org] createOrganization failed", orgError, { ownerEmail });
    return null;
  }

  await supabase.from("organization_members").insert({
    organization_id: org.id,
    user_id: ownerId,
    role: "owner",
  });
  await supabase.from("user_active_org").upsert({
    user_id: ownerId,
    organization_id: org.id,
  });

  return org as Organization;
}

export async function updateOrganization(
  organizationId: string,
  patch: Partial<
    Pick<Organization, "name" | "slug" | "logo_url" | "auto_publish_minutes">
  >
): Promise<Organization | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("organizations")
    .update(patch)
    .eq("id", organizationId)
    .select("*")
    .single();
  if (error) {
    console.error("[org] updateOrganization failed", error);
    return null;
  }
  return data as Organization;
}

export async function removeMember(
  organizationId: string,
  userId: string
): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("organization_members")
    .delete()
    .eq("organization_id", organizationId)
    .eq("user_id", userId);
  if (error) {
    console.error("[org] removeMember failed", error);
    return false;
  }
  return true;
}

export async function updateMemberRole(
  organizationId: string,
  userId: string,
  role: OrganizationRole
): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("organization_members")
    .update({ role })
    .eq("organization_id", organizationId)
    .eq("user_id", userId);
  if (error) {
    console.error("[org] updateMemberRole failed", error);
    return false;
  }
  return true;
}

export async function transferOwnership(
  organizationId: string,
  currentOwnerId: string,
  newOwnerId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.rpc("transfer_org_ownership", {
    p_org_id: organizationId,
    p_current_owner: currentOwnerId,
    p_new_owner: newOwnerId,
  });
  if (error) {
    console.error("[org] transferOwnership failed", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function createInvite(params: {
  organizationId: string;
  invitedBy: string;
  email?: string | null;
  role?: InvitedRole;
  origin: string;
  ttlDays?: number;
}): Promise<OrganizationInviteCreated | null> {
  const supabase = getSupabaseAdmin();
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(
    Date.now() + (params.ttlDays ?? INVITE_TTL_DAYS) * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from("organization_invites")
    .insert({
      organization_id: params.organizationId,
      token_hash: tokenHash,
      email: params.email ?? null,
      role: params.role ?? "member",
      invited_by: params.invitedBy,
      expires_at: expiresAt,
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("[org] createInvite failed", error);
    return null;
  }

  return {
    ...(data as OrganizationInvite),
    token,
    url: buildInviteUrl(params.origin, token),
  };
}

export async function listInvites(
  organizationId: string
): Promise<OrganizationInvite[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("organization_invites")
    .select("*")
    .eq("organization_id", organizationId)
    .is("accepted_at", null)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[org] listInvites failed", error);
    return [];
  }
  return (data ?? []) as OrganizationInvite[];
}

export async function revokeInvite(
  organizationId: string,
  inviteId: string
): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("organization_invites")
    .delete()
    .eq("organization_id", organizationId)
    .eq("id", inviteId);
  if (error) {
    console.error("[org] revokeInvite failed", error);
    return false;
  }
  return true;
}

export async function acceptInvite(params: {
  token: string;
  userId: string;
  userEmail: string;
}): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const tokenHash = hashToken(params.token);
  const { data, error } = await supabase.rpc("accept_org_invite", {
    p_token_hash: tokenHash,
    p_user_id: params.userId,
    p_user_email: params.userEmail,
  });
  if (error) {
    console.error("[org] acceptInvite failed", error);
    return null;
  }
  return (data as string | null) ?? null;
}

export const orgInternals = { hashToken, buildInviteUrl };
