import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { getActiveOrg } from "@/lib/server/organization";
import { isOrgFeatureEnabled } from "@/lib/featureFlags";
import type { DBStreamInsert } from "@oscar/shared/types";

async function authedUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

export async function GET(request: Request) {
  const user = await authedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? "50") || 50));
  const before = url.searchParams.get("before");

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("streams")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (before) query = query.lt("created_at", before);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: Request) {
  const user = await authedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Partial<DBStreamInsert>;
  try {
    body = (await request.json()) as Partial<DBStreamInsert>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawTranscript = (body.raw_transcript ?? "").toString();
  const formattedText = (body.formatted_text ?? "").toString();
  if (!rawTranscript.trim() && !formattedText.trim()) {
    return NextResponse.json(
      { error: "raw_transcript or formatted_text required" },
      { status: 400 }
    );
  }

  let organizationId: string | null = null;
  if (isOrgFeatureEnabled()) {
    const active = await getActiveOrg(user.id);
    organizationId = active?.organization.id ?? null;
  }

  const insert: DBStreamInsert = {
    user_id: user.id,
    organization_id: organizationId,
    app_key: body.app_key ?? null,
    destination_app: body.destination_app ?? null,
    raw_transcript: rawTranscript,
    formatted_text: formattedText,
    duration_ms: typeof body.duration_ms === "number" ? body.duration_ms : null,
    dictation_category: body.dictation_category ?? null,
    dictation_variant: body.dictation_variant ?? null,
    dictation_context_source: body.dictation_context_source ?? null,
    dictation_prompt_version: body.dictation_prompt_version ?? null,
  };

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("streams")
    .insert(insert)
    .select("*")
    .single();

  if (error) {
    console.error("[streams] insert failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
