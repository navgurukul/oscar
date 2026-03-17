import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase admin credentials not configured");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("notes")
      .select("title, original_formatted_text, edited_text, created_at, updated_at, share_enabled, share_token, deleted_at")
      .eq("share_token", token)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    if (!data.share_enabled || data.deleted_at) {
      return NextResponse.json({ error: "Sharing disabled" }, { status: 403 });
    }

    const text = data.edited_text || data.original_formatted_text || "";
    return NextResponse.json({
      title: data.title || "Untitled Note",
      text,
      created_at: data.created_at,
      updated_at: data.updated_at,
    });
  } catch (err) {
    console.error("Public note fetch failed:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

