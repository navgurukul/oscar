import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isOrgFeatureEnabled } from "@/lib/featureFlags";

export type RouteAuth =
  | { ok: true; user: User; supabase: Awaited<ReturnType<typeof createClient>> }
  | { ok: false; response: NextResponse };

export async function requireAuth(): Promise<RouteAuth> {
  if (!isOrgFeatureEnabled()) {
    return { ok: false, response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { ok: true, user: data.user, supabase };
}

export function getOrigin(request: Request): string {
  const headers = new Headers(request.headers);
  const forwardedHost = headers.get("x-forwarded-host") ?? headers.get("host");
  if (forwardedHost) {
    const protocol = headers.get("x-forwarded-proto") ?? "https";
    return `${protocol}://${forwardedHost}`;
  }
  return new URL(request.url).origin;
}
