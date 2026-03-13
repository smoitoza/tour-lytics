import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Tour-Lytics - Commercial Real Estate Intelligence',
  description: 'AI-powered lease analytics, interactive maps, and tour management for corporate real estate teams.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600,700&f[]=cabinet-grotesk@500,700,800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
