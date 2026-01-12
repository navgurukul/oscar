import type { Metadata } from "next";
import { Toaster } from "@/components/ui/toaster";
import { FloatingNavbar } from "@/components/shared/FloatingNavbar";
import "./globals.css";

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
    <html lang="en">
      <body className="bg-slate-950 text-white antialiased">
        <FloatingNavbar />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
