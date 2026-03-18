import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  
  // Check if this is a desktop app auth flow
  const isDesktopFlow = searchParams.get("desktop") === "true";
  // Get desktop_state from query params for state validation
  const desktopState = searchParams.get("desktop_state");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.session) {
      // If this is a desktop app flow, redirect back to the desktop app via deep link
      // with the session tokens so the desktop app can establish its own session
      if (isDesktopFlow) {
        const { access_token, refresh_token, expires_in } = data.session;
        const redirectUrl = `oscar://auth/callback?success=true&access_token=${encodeURIComponent(access_token)}&refresh_token=${encodeURIComponent(refresh_token)}&expires_in=${expires_in}${desktopState ? `&state=${encodeURIComponent(desktopState)}` : ""}`;
        return NextResponse.redirect(redirectUrl);
      }
      // Important: after server-side code exchange, the browser Supabase client may
      // still have a stale session until it re-syncs. Redirect through a small
      // client page that forces a session read/refresh before entering the app.
      return NextResponse.redirect(
        `${origin}/auth/post-callback?next=${encodeURIComponent(next)}`
      );
    }
  }

  // If desktop flow failed, redirect to desktop app with error
  if (isDesktopFlow) {
    return NextResponse.redirect("oscar://auth/callback?error=authentication_failed");
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth?error=Could not authenticate`);
}
