import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'OSCAR - AI Voice Notes',
  description: 'Turn your voice into clear, formatted text using AI',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-gradient-to-b from-gray-50 to-white text-gray-900 antialiased">
        <header className="w-full border-b bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-gray-900">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-purple-500 to-indigo-500 text-white">O</span>
              <span>OSCAR</span>
            </div>
          </div>
        </header>
        {children}
      </body>
    </html>
  )
}

