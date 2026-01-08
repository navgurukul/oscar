import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'OSCAR - AI Voice Notes',
  description: 'Turn your voice into clear, formatted text using AI',
  icons: {
    icon: '/favicon.svg',
  },
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
          <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
            <div className="flex items-center gap-3 font-semibold text-teal-700 text-xl">
              <svg className="h-8 w-8" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                <circle cx="10" cy="10" r="10" fill="#0f766e"/>
                <g fill="white">
                  <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                </g>
              </svg>
              <span>OSCAR</span>
            </div>
          </div>
        </header>
        {children}
      </body>
    </html>
  )
}

