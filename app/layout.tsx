import type { Metadata } from 'next'
import Link from 'next/link'
import { Toaster } from '@/components/ui/toaster'
import './globals.css'

export const metadata: Metadata = {
  title: 'OSCAR - AI Voice Notes',
  description: 'Turn your voice into clear, formatted text using AI',
  icons: {
    icon: '/OSCARLOGO.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-black text-white antialiased">
        <header className="w-full bg-black">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center">
            <Link href="/" className="flex items-center gap-3 font-bold text-teal-500 text-xl hover:opacity-80 transition-opacity">
              <img src="/OSCARLOGO.png" alt="OSCAR Logo" className="h-10 w-10" />
              <span>OSCAR</span>
            </Link>
          </div>
        </header>
        {children}
        <Toaster />
      </body>
    </html>
  )
}

