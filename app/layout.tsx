import '@/app/globals.css'

const metadataBase =
  process.env.NEXT_PUBLIC_PLATFORM_URL?.trim().replace(/\/+$/, '') || 'http://localhost:1147'
const metadataBaseUrl = /^https?:\/\//.test(metadataBase) ? metadataBase : `https://${metadataBase}`

export const metadata = {
  metadataBase: new URL(metadataBaseUrl),
  title: 'Pryv API Platform',
  description: 'Manage Pryv API keys, credits, usage, private AI controls, and MCP access.',
  icons: {
    icon: '/icon.svg',
  },
}

export const viewport = {
  maximumScale: 1,
}

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang='en' suppressHydrationWarning>
      <head>
        {/* Resource hints for better performance */}
        <meta name='color-scheme' content='light dark' />
        <meta name='format-detection' content='telephone=no' />

        {/* PWA theme color */}
        <meta name='theme-color' content='#76CFF8' />
        <meta name='apple-mobile-web-app-capable' content='yes' />
        <meta name='apple-mobile-web-app-status-bar-style' content='default' />
        <meta name='apple-mobile-web-app-title' content='Pryv API Platform' />
      </head>
      <body>{children}</body>
    </html>
  )
}
