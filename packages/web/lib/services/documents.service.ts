"use client";

import type {
  OrgDocument,
  OrgDocumentWithDownload,
  Organization,
} from "@oscar/shared/types";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const documentsService = {
  async list(params: { search?: string; tag?: string } = {}): Promise<{
    items: OrgDocument[];
    organization: Organization | null;
  }> {
    const search = params.search?.trim();
    const url = new URL("/api/org/documents", window.location.origin);
    if (search) url.searchParams.set("q", search);
    if (params.tag) url.searchParams.set("tag", params.tag);
    const res = await fetch(url.toString(), { cache: "no-store" });
    const data = await json<{ items: OrgDocument[]; organization?: Organization }>(res);
    return { items: data.items ?? [], organization: data.organization ?? null };
  },

  async get(id: string): Promise<OrgDocumentWithDownload> {
    const res = await fetch(`/api/org/documents/${id}`, { cache: "no-store" });
    return json(res);
  },

  async upload(file: File, title?: string): Promise<OrgDocument> {
    const fd = new FormData();
    fd.set("file", file);
    if (title) fd.set("title", title);
    const res = await fetch("/api/org/documents", { method: "POST", body: fd });
    return json(res);
  },

  async update(
    id: string,
    patch: Partial<Pick<OrgDocument, "title" | "tags" | "summary">>
  ): Promise<OrgDocument> {
    const res = await fetch(`/api/org/documents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    return json(res);
  },

  async remove(id: string): Promise<void> {
    const res = await fetch(`/api/org/documents/${id}`, { method: "DELETE" });
    await json(res);
  },
};
