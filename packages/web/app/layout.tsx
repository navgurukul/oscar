"use client";

// Force dynamic rendering - this app uses client-side auth with Supabase
// which requires environment variables not available at build time
export const dynamic = "force-dynamic";

import { Figtree, EB_Garamond } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { FloatingNavbar } from "@/components/shared/FloatingNavbar";
import { AuthEdgeButton } from "@/components/shared/AuthEdgeButton";
import { HomeRecordingButton } from "@/components/recording/HomeRecordingButton";
import { Footer } from "@/components/shared/Footer";
import { AuthProvider, useAuth } from "@/lib/contexts/AuthContext";
import { SubscriptionProvider } from "@/lib/contexts/SubscriptionContext";
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

function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { session } = useAuth();

  const isAuthenticated = !!session;
  const isLandingPage = pathname === "/";
  const isSettingsPage = pathname === "/settings";
  const isDownloadPage = pathname === "/download";
  const isLegalPage =
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname === "/refund-policy";

  // Footer visibility rules:
  // 1. Unauthenticated on landing page -> show footer
  // 2. Authenticated only on settings page -> show footer
  const shouldShowFooter =
    (!isAuthenticated && isLandingPage) || (isAuthenticated && isSettingsPage);

  // Hide recording button on download and legal pages
  const shouldShowRecordingButton = !isDownloadPage && !isLegalPage;

  return (
    <div className="flex flex-col min-h-screen">
      <FloatingNavbar />
      <AuthEdgeButton />
      {children}
      {shouldShowFooter && (
        <div className="mt-auto">
          <Footer />
        </div>
      )}
      {shouldShowRecordingButton && (
        <div className="fixed bottom-6 sm:bottom-10 left-1/2 -translate-x-1/2 z-50">
          <HomeRecordingButton />
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
    <html lang="en" className={`${figtree.variable} ${ebGaramond.variable}`} suppressHydrationWarning>
      <head>
        {/* PWA manifest */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#06B6D4" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/OSCARLOGO.png" />

        {/* Load ONNX Runtime Web from CDN to avoid bundling issues and fix 'onnxruntime' missing error */}
        <Script
          src="https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.min.js"
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
      <body className="bg-slate-950 text-white antialiased font-sans" suppressHydrationWarning>
        <AuthProvider>
          <SubscriptionProvider>
            <LayoutContent>{children}</LayoutContent>
          </SubscriptionProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
