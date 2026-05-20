"use client";

import type {
  ActiveOrganization,
  InvitedRole,
  Organization,
  OrganizationInvite,
  OrganizationInviteCreated,
  OrganizationMemberWithUser,
  OrganizationRole,
} from "@oscar/shared/types";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const organizationService = {
  async listMine(): Promise<Array<{ organization: Organization; role: OrganizationRole }>> {
    return api(`/api/org`);
  },

  async current(): Promise<ActiveOrganization | null> {
    return api(`/api/org/current`);
  },

  async create(input: { name: string; slug?: string }): Promise<Organization> {
    return api(`/api/org`, { method: "POST", body: JSON.stringify(input) });
  },

  async update(id: string, patch: Partial<Pick<Organization, "name" | "slug" | "logo_url">>): Promise<Organization> {
    return api(`/api/org/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
  },

  async switchTo(organizationId: string): Promise<void> {
    await api(`/api/org/switch`, {
      method: "POST",
      body: JSON.stringify({ organization_id: organizationId }),
    });
  },

  async listMembers(id: string): Promise<OrganizationMemberWithUser[]> {
    return api(`/api/org/${id}/members`);
  },

  async removeMember(id: string, userId: string): Promise<void> {
    await api(`/api/org/${id}/members/${userId}`, { method: "DELETE" });
  },

  async updateMemberRole(id: string, userId: string, role: OrganizationRole): Promise<void> {
    await api(`/api/org/${id}/members/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
  },

  async transferOwnership(id: string, newOwnerId: string): Promise<void> {
    await api(`/api/org/${id}/transfer-ownership`, {
      method: "PATCH",
      body: JSON.stringify({ user_id: newOwnerId }),
    });
  },

  async listInvites(orgId: string): Promise<OrganizationInvite[]> {
    return api(`/api/org/invites?organization_id=${encodeURIComponent(orgId)}`);
  },

  async createInvite(input: {
    organization_id: string;
    email?: string | null;
    role?: InvitedRole;
  }): Promise<OrganizationInviteCreated> {
    return api(`/api/org/invites`, { method: "POST", body: JSON.stringify(input) });
  },

  async revokeInvite(inviteId: string): Promise<void> {
    await api(`/api/org/invites/${inviteId}`, { method: "DELETE" });
  },

  async acceptInvite(token: string): Promise<{ organization_id: string }> {
    return api(`/api/org/invites/accept`, {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  },
};
