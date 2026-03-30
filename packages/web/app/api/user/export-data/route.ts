/**
 * Export User Data API Route
 * GET /api/user/export-data
 *
 * Returns all user data (notes, vocabulary) as a downloadable JSON file.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [notesResult, vocabularyResult] = await Promise.all([
      supabase.from("notes").select("*").eq("user_id", user.id),
      supabase.from("user_vocabulary").select("*").eq("user_id", user.id),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      account: {
        id: user.id,
        email: user.email,
        createdAt: user.created_at,
      },
      notes: notesResult.data ?? [],
      vocabulary: vocabularyResult.data ?? [],
    };

    const json = JSON.stringify(exportData, null, 2);

    return new NextResponse(json, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="oscar-data-export-${new Date().toISOString().split("T")[0]}.json"`,
      },
    });
  } catch (error) {
    console.error("Export data error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
