import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { sanitizeInternalPath } from "@/lib/safe-redirect";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Keep users signed in across browser restarts by persisting auth cookies.
      cookieOptions: {
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 30, // 30 days
      },
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
    "/scribble",
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
    // Prevent open redirect: only allow in-app paths (see sanitizeInternalPath).
    const safePath = sanitizeInternalPath(
      request.nextUrl.searchParams.get("redirectTo"),
      "/"
    );
    const url = request.nextUrl.clone();
    url.pathname = safePath;
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
