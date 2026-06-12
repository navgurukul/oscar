"use client";

// Force dynamic rendering - this app uses client-side auth with Supabase
// which requires environment variables not available at build time
export const dynamic = "force-dynamic";

import { Figtree, EB_Garamond, IBM_Plex_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { V2Footer } from "@/components/v2/V2Primitives";
import { AuthProvider, useAuth } from "@/lib/contexts/AuthContext";
import { SubscriptionProvider } from "@/lib/contexts/SubscriptionContext";
import { QueryProvider } from "@/lib/providers/QueryProvider";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-figtree",
  display: "swap",
});

const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-eb-garamond",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { session } = useAuth();

  // Every signed-in surface and every marketing/auth route now mounts its
  // own V2 header. The legacy FloatingNavbar / AuthEdgeButton / HomeRecordingButton
  // were retired with the v2 redesign — kept only the Footer, which now
  // injects on settings (signed-in) only.
  const isAuthenticated = !!session;
  const isSettingsPage = pathname === "/settings";
  const shouldShowFooter = isAuthenticated && isSettingsPage;

  return (
    <div className="flex flex-col min-h-screen">
      {children}
      {shouldShowFooter && (
        <div className="mt-auto">
          <V2Footer />
        </div>
      )}
      <Toaster />
    </div>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${figtree.variable} ${ebGaramond.variable} ${ibmPlexMono.variable}`} suppressHydrationWarning>
      <head>
        {/* PWA manifest */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#f7f4ee" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/OSCAR_AVATAR.png" />

        {/* Load ONNX Runtime Web from CDN to avoid bundling issues and fix 'onnxruntime' missing error.
            Pinned to the exact version resolved in pnpm-lock (onnxruntime-web 1.24.3) and locked with an
            SRI hash so a mutated/compromised CDN object can't execute (WS-I). crossOrigin is required for
            the browser to enforce integrity. */}
        <Script
          src="https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/ort.min.js"
          integrity="sha384-09HTvetYSJEPi/TX/YYkdYV65QeZNB3CkUjX70KjHf7+fnGTtmBbzCkrX9jq57cF"
          strategy="beforeInteractive"
          crossOrigin="anonymous"
        />
        <Script id="onnx-shim" strategy="beforeInteractive">
          {`
            if (typeof window !== 'undefined') {
              // Shim for libraries that expect 'onnxruntime' instead of 'ort'
              window.onnxruntime = window.ort;
            }
          `}
        </Script>
        {/* Register service worker for offline support */}
        <Script id="sw-register" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js', { scope: '/' })
                  .then(function(reg) { console.log('[SW] registered:', reg.scope); })
                  .catch(function(err) { console.warn('[SW] registration failed:', err); });
              });
            }
          `}
        </Script>
      </head>
      <body className="bg-cream text-ink antialiased font-sans" suppressHydrationWarning>
        <QueryProvider>
          <AuthProvider>
            <SubscriptionProvider>
              <LayoutContent>{children}</LayoutContent>
            </SubscriptionProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
