import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, context: Ctx) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("streams")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}
