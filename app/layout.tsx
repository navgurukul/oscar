import type { Metadata } from "next";
import { Roboto, Inter } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import Script from "next/script";
import { FloatingNavbar } from "@/components/shared/FloatingNavbar";
import { AuthEdgeButton } from "@/components/shared/AuthEdgeButton";
import { HomeRecordingButton } from "@/components/recording/HomeRecordingButton";
import { Footer } from "@/components/shared/Footer";
import { AuthProvider } from "@/lib/contexts/AuthContext";
import { SubscriptionProvider } from "@/lib/contexts/SubscriptionContext";
import "./globals.css";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-roboto",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "OSCAR - AI Voice Notes",
  description: "Turn your voice into clear, formatted text using AI",
  icons: {
    icon: "/OSCARLOGO.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${roboto.variable} ${inter.variable} font-inter`}
    >
      <head>
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
      </head>
      <body className="bg-slate-950 text-white antialiased font-sans">
        <AuthProvider>
          <SubscriptionProvider>
            {/* Apply saved theme and font preferences */}
            {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}

            <FloatingNavbar />
            <AuthEdgeButton />
            {children}
            <Footer />
            <div className="fixed bottom-6 sm:bottom-10 left-1/2 -translate-x-1/2 z-50">
              <HomeRecordingButton />
            </div>
            <Toaster />
          </SubscriptionProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
