import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import { FloatingNavbar } from "@/components/shared/FloatingNavbar";
import { AuthProvider } from "@/lib/contexts/AuthContext";
import "./globals.css";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-roboto",
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
    <html lang="en" className={roboto.variable}>
      <body className="bg-slate-950 text-white antialiased font-sans">
        <AuthProvider>
          <FloatingNavbar />
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
