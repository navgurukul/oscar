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

  // After the personal org is in place, check if the user's email domain
  // matches an org with auto_join_email_domain set. If so, add them as a
  // Member and flip their active org to the team org. Non-blocking — if it
  // fails the user still has their personal org from ensure_default_org.
  if (userEmail) {
    const { error: joinErr } = await supabase.rpc("auto_join_matching_org", {
      p_user_id: userId,
      p_user_email: userEmail,
    });
    if (joinErr) {
      console.error("[org] auto_join_matching_org failed", joinErr);
    }
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

/**
 * True when the user belongs to at least one real (non-personal) team org.
 * The single signal that drives whether ANY org chrome shows in the UI.
 */
async function userHasTeam(userId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("organization_members")
    .select("organizations(is_personal)")
    .eq("user_id", userId);
  if (error) {
    // Never silently downgrade a real team member to solo-mode (which would
    // hide their switcher / TEAM tab / share-to-workspace) on a transient
    // query failure — log so the chrome-loss is diagnosable.
    console.error("[org] userHasTeam failed", error);
  }
  const rows = (data ?? []) as Array<{
    organizations:
      | { is_personal: boolean }
      | { is_personal: boolean }[]
      | null;
  }>;
  return rows.some((r) => {
    const o = Array.isArray(r.organizations) ? r.organizations[0] : r.organizations;
    return o ? o.is_personal === false : false;
  });
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

  // Lazy-heal: a user with no org at all (e.g. a desktop-first / Bearer-only
  // user who never hit the web OAuth callback, or a signup the auth.users
  // trigger somehow missed) gets their personal org provisioned on the spot,
  // so every quota/billing/UI path downstream sees a real org instead of
  // hard-failing. ensure_default_org is idempotent, so this is safe to call.
  if (!orgId) {
    const { data: userData } = await supabase.auth.admin.getUserById(userId);
    const email = userData?.user?.email ?? "";
    const displayName =
      (userData?.user?.user_metadata?.full_name as string | undefined) ??
      (userData?.user?.user_metadata?.name as string | undefined) ??
      null;
    orgId = await getOrCreateDefaultOrg(userId, email, displayName);
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
    // If the active org is itself a real team, hasTeam is true with no second
    // query (and can't disagree with the org row we just loaded). Only when the
    // active org is personal do we scan memberships for another team.
    hasTeam: org.is_personal === false ? true : await userHasTeam(userId),
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
  slug?: string,
  autoJoinEmailDomain?: string | null
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

  const insertPayload: Record<string, unknown> = {
    name,
    slug: candidate,
    created_by: ownerId,
    // Explicit team creation — never a personal org, so org chrome shows.
    is_personal: false,
  };
  if (autoJoinEmailDomain) {
    insertPayload.auto_join_email_domain = autoJoinEmailDomain;
  }

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert(insertPayload)
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
    Pick<
      Organization,
      | "name"
      | "slug"
      | "logo_url"
      | "auto_publish_minutes"
      | "default_meeting_visibility"
      | "auto_join_email_domain"
    >
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
