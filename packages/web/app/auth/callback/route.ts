import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  
  // Check if this is a desktop app auth flow
  const isDesktopFlow = searchParams.get("desktop") === "true";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // If this is a desktop app flow, redirect back to the desktop app via deep link
      if (isDesktopFlow) {
        // Redirect to the desktop app with a success indicator
        return NextResponse.redirect("oscar://auth/callback?success=true");
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // If desktop flow failed, redirect to desktop app with error
  if (isDesktopFlow) {
    return NextResponse.redirect("oscar://auth/callback?error=authentication_failed");
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth?error=Could not authenticate`);
}
