"use client";

import type { DBStream } from "@oscar/shared/types";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const streamsService = {
  async list(params: { limit?: number; before?: string } = {}): Promise<DBStream[]> {
    const url = new URL("/api/streams", window.location.origin);
    if (params.limit) url.searchParams.set("limit", String(params.limit));
    if (params.before) url.searchParams.set("before", params.before);
    const res = await fetch(url.toString(), { cache: "no-store" });
    const data = await json<{ items: DBStream[] }>(res);
    return data.items;
  },

  async remove(id: string): Promise<void> {
    const res = await fetch(`/api/streams/${id}`, { method: "DELETE" });
    await json(res);
  },
};
