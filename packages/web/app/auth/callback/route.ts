import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Derive the real origin the user is visiting.
 *
 * On platforms like AWS Amplify the server-side function runs behind a
 * reverse-proxy / CDN, so `request.url` may contain an internal address
 * (e.g. http://localhost:3000).  We check forwarded headers first and
 * fall back to the URL parsed from the request only as a last resort.
 */
function getOrigin(request: Request): string {
  const headers = new Headers(request.headers);

  // x-forwarded-host is set by most reverse proxies / CDNs
  const forwardedHost = headers.get("x-forwarded-host") ?? headers.get("host");
  if (forwardedHost) {
    const protocol = headers.get("x-forwarded-proto") ?? "https";
    return `${protocol}://${forwardedHost}`;
  }

  // Fallback – works fine in local dev / environments without a proxy
  return new URL(request.url).origin;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const origin = getOrigin(request);
  const code = searchParams.get("code");

  // Check if this is a desktop app auth flow
  const isDesktopFlow = searchParams.get("desktop") === "true";
  // Get desktop_state from query params for state validation
  const desktopState = searchParams.get("desktop_state");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.session) {
      // If this is a desktop app flow, redirect back to the desktop-callback page
      // with tokens in the hash fragment.  We CANNOT redirect directly to
      // oscar:// because browsers silently drop 3xx redirects to custom URL
      // schemes.  The desktop-callback page will parse the tokens from the
      // hash and open the deep link client-side (which works from a click).
      if (isDesktopFlow) {
        const { access_token, refresh_token, expires_in } = data.session;
        const provider_token = data.session.provider_token || "";
        const fragment = [
          `access_token=${encodeURIComponent(access_token)}`,
          `refresh_token=${encodeURIComponent(refresh_token)}`,
          `expires_in=${expires_in}`,
          provider_token ? `provider_token=${encodeURIComponent(provider_token)}` : "",
        ].filter(Boolean).join("&");
        const desktopCallbackUrl = `${origin}/auth/desktop-callback${desktopState ? `?desktop_state=${encodeURIComponent(desktopState)}` : ""}#${fragment}`;
        return NextResponse.redirect(desktopCallbackUrl);
      }
      // Important: after server-side code exchange, the browser Supabase client may
      // still have a stale session until it re-syncs. Redirect through a small
      // client page that forces a session read/refresh before entering the app.
      return NextResponse.redirect(
        `${origin}/auth/post-callback`
      );
    }
  }

  // If desktop flow failed, redirect back to the desktop-callback page with error
  if (isDesktopFlow) {
    return NextResponse.redirect(`${origin}/auth/desktop-callback#error=authentication_failed`);
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth?error=Could not authenticate`);
}
