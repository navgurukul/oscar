import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/orgRoutes";
import { getActiveOrg } from "@/lib/server/organization";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";

type FeedItem = {
  kind: "scribble" | "meeting";
  id: string;
  title: string;
  preview: string;
  created_at: string;
  user_id: string;
  author_name: string | null;
  author_email: string | null;
};

function previewFrom(text: string | null | undefined, limit = 240): string {
  if (!text) return "";
  const stripped = text.replace(/[#*_>`-]+/g, " ").replace(/\s+/g, " ").trim();
  return stripped.length > limit ? `${stripped.slice(0, limit)}…` : stripped;
}

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const active = await getActiveOrg(auth.user.id);
  if (!active) {
    return NextResponse.json({ items: [], organization: null });
  }

  const supabase = getSupabaseAdmin();
  const orgId = active.organization.id;

  const [{ data: scribbles }, meetingsRes] = await Promise.all([
    supabase
      .from("scribbles")
      .select("id, title, original_formatted_text, edited_text, created_at, user_id")
      .eq("organization_id", orgId)
      .eq("shared_with_org", true)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("meetings")
      .select("id, meeting_title, notes_markdown, started_at, created_at, user_id")
      .eq("organization_id", orgId)
      .eq("shared_with_org", true)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  // meetings table may not exist on web-only Supabase envs — degrade gracefully.
  const meetings = meetingsRes.error ? [] : meetingsRes.data ?? [];

  const userIds = new Set<string>();
  for (const s of scribbles ?? []) userIds.add(s.user_id);
  for (const m of meetings) userIds.add(m.user_id);

  const authors = new Map<string, { name: string | null; email: string | null }>();
  if (userIds.size > 0) {
    const { data: usersData } = await supabase.auth.admin.listUsers({ perPage: 200 });
    for (const u of usersData?.users ?? []) {
      if (!userIds.has(u.id)) continue;
      authors.set(u.id, {
        email: u.email ?? null,
        name:
          (u.user_metadata?.full_name as string | undefined) ??
          (u.user_metadata?.name as string | undefined) ??
          null,
      });
    }
  }

  const items: FeedItem[] = [];
  for (const s of scribbles ?? []) {
    const a = authors.get(s.user_id);
    items.push({
      kind: "scribble",
      id: s.id,
      title: s.title || "Untitled Scribble",
      preview: previewFrom(s.edited_text ?? s.original_formatted_text),
      created_at: s.created_at,
      user_id: s.user_id,
      author_name: a?.name ?? null,
      author_email: a?.email ?? null,
    });
  }
  for (const m of meetings) {
    const a = authors.get(m.user_id);
    items.push({
      kind: "meeting",
      id: m.id,
      title: m.meeting_title || "Untitled Meeting",
      preview: previewFrom(m.notes_markdown),
      created_at: m.created_at ?? m.started_at,
      user_id: m.user_id,
      author_name: a?.name ?? null,
      author_email: a?.email ?? null,
    });
  }
  items.sort((a, b) => (b.created_at > a.created_at ? 1 : -1));

  return NextResponse.json({
    organization: active.organization,
    items,
  });
}
