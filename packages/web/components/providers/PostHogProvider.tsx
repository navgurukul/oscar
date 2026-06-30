"use client";

// PostHog initialisation + provider. Mounted high in the layout provider stack
// so the whole app shares one initialised singleton (see lib/analytics/events.ts
// and lib/contexts/AuthContext.tsx for the call sites).
//
// Config notes:
//   - api_host: '/ingest' — same-origin reverse proxy (next.config.js rewrites)
//     so ad-blockers can't drop the requests. NOT '/analytics' (blocklisted).
//   - US region (decided): ui_host points at us.posthog.com for in-app links.
//   - capture_exceptions: true — this is the web app's JS error net; there is no
//     app-level error.tsx boundary.
//   - capture_pageview: false + manual $pageview on pathname change — the
//     App Router does client-side navigation, which the default autocapture
//     would miss. pathname-only (no useSearchParams) avoids a Suspense bail-out.
//   - person_profiles: 'identified_only' — anonymous traffic still emits events
//     (funnels work on events) but doesn't burn person-profile quota.

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
// Dashboard/links host only — ingestion goes through the same-origin /ingest
// proxy. Distinct from the server's POSTHOG_HOST (ingest) so one env value can't
// silently break the other.
const POSTHOG_UI_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_UI_HOST || "https://us.posthog.com";

if (typeof window !== "undefined" && POSTHOG_KEY && !posthog.__loaded) {
  posthog.init(POSTHOG_KEY, {
    api_host: "/ingest",
    ui_host: POSTHOG_UI_HOST,
    capture_pageview: false,
    capture_pageleave: true,
    capture_exceptions: true,
    persistence: "localStorage+cookie",
    person_profiles: "identified_only",
  });
}

function PostHogPageView() {
  const pathname = usePathname();

  useEffect(() => {
    if (!POSTHOG_KEY || typeof window === "undefined") return;
    posthog.capture("$pageview", { $current_url: window.location.href });
  }, [pathname]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  // When unconfigured (no env key) skip the provider entirely; posthog no-ops
  // anyway, but this keeps the tree clean in local/dev without a key.
  if (!POSTHOG_KEY) return <>{children}</>;

  return (
    <PHProvider client={posthog}>
      <PostHogPageView />
      {children}
    </PHProvider>
  );
}
