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
      <body>{children}</body>
    </html>
  )
}

