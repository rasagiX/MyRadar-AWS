import type { Metadata, Viewport } from 'next'
import './globals.css'
import { DisasterProvider } from '@/store/disasterStore'

export const metadata: Metadata = {
  title: 'MyRadar — Disaster Response Intelligence',
  description: 'Offline-first disaster response intelligence platform. When the network goes down, response doesn\'t.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon-dark-32x32.png',  media: '(prefers-color-scheme: dark)' },
      { url: '/icon-light-32x32.png', media: '(prefers-color-scheme: light)' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#030810',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <DisasterProvider>
          {children}
        </DisasterProvider>
      </body>
    </html>
  )
}
