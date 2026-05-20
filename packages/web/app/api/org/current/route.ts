import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/orgRoutes";
import { getActiveOrg } from "@/lib/server/organization";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const active = await getActiveOrg(auth.user.id);
  return NextResponse.json(active);
}
