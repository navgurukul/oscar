import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protected routes - redirect to auth if not logged in
  const protectedPaths = [
    "/recording",
    "/results",
    "/notes",
    "/settings",
    "/billing",
  ];
  const isProtectedPath = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (isProtectedPath && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Redirect logged in users away from auth page
  if (request.nextUrl.pathname === "/auth" && user) {
    const rawRedirectTo =
      request.nextUrl.searchParams.get("redirectTo") || "/";
    // Prevent open redirect: only allow relative paths that start with /
    // and do not contain protocol schemes (e.g. //evil.com or javascript:)
    const isSafeRedirect =
      rawRedirectTo.startsWith("/") &&
      !rawRedirectTo.startsWith("//") &&
      !rawRedirectTo.toLowerCase().includes(":");
    const safePath = isSafeRedirect ? rawRedirectTo : "/";
    const url = request.nextUrl.clone();
    url.pathname = safePath;
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
