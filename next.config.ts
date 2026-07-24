import type {NextConfig} from 'next'

const isProd = process.env.NODE_ENV === 'production'
const ENABLE_EXPERIMENTAL_PPR = process.env.NEXT_EXPERIMENTAL_PPR === 'true'
const TEE_ENCLAVE_URL = process.env.PRIVATE_TEE_ENCLAVE_URL || process.env.PRIVATE_API_BASE_URL
// World App loads Pryv inside a secure iframe, so we explicitly allow their origins
const WORLD_APP_FRAME_ANCESTORS = ["'self'", 'https://app.worldcoin.org', 'https://world.app']
const DOCUMENT_SECURITY_HEADERS = [
  {
    key: 'Content-Security-Policy',
    value: `frame-ancestors ${WORLD_APP_FRAME_ANCESTORS.join(' ')};`,
  },
  {key: 'X-Content-Type-Options', value: 'nosniff'},
  {key: 'Referrer-Policy', value: 'no-referrer'},
  {key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()'},
] satisfies Array<{key: string; value: string}>
const LOGOUT_HEADERS = [
  {key: 'Cache-Control', value: 'no-store'},
  ...DOCUMENT_SECURITY_HEADERS,
] satisfies Array<{key: string; value: string}>
const STATIC_CACHE_HEADERS = [
  {key: 'Cache-Control', value: 'public, max-age=31536000, immutable'},
  {key: 'X-Content-Type-Options', value: 'nosniff'},
] satisfies Array<{key: string; value: string}>
const PUBLIC_SHORT_CACHE_HEADERS = [
  {key: 'Cache-Control', value: 'public, max-age=3600'},
  {key: 'X-Content-Type-Options', value: 'nosniff'},
] satisfies Array<{key: string; value: string}>
const API_SECURITY_HEADERS = [
  {key: 'X-Content-Type-Options', value: 'nosniff'},
  {key: 'Sec-GPC', value: '1'},
] satisfies Array<{key: string; value: string}>
let withBundleAnalyzer: (config: NextConfig) => NextConfig = (config) => config
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const bundleAnalyzer = require('@next/bundle-analyzer')({
    enabled: process.env.ANALYZE === 'true',
  })
  withBundleAnalyzer = bundleAnalyzer
} catch {
  // optional dependency; ignore if not installed
}

let nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // PPR currently only works on Next.js canary builds. Keep it disabled unless explicitly opted-in.
    ppr: ENABLE_EXPERIMENTAL_PPR,
    optimizePackageImports: ['lucide-react'],
  },
  compiler: {
    removeConsole: isProd,
  },
  images: {
    deviceSizes: [360, 420, 768, 1024, 1280, 1536],
    imageSizes: [16, 32, 48, 64, 96],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 31536000, // 1 year
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none';",
    remotePatterns: [
      {
        hostname: 'avatar.vercel.sh',
      },
      {
        hostname: 'cdn.jsdelivr.net',
      },
    ],
  },
  compress: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        source: '/logout',
        headers: LOGOUT_HEADERS,
      },
      {
        source: '/logout.html',
        headers: LOGOUT_HEADERS,
      },
      {
        source: '/((?!api(?:/|$)|_next/static|_next/image|static|fonts|.*\\..*).*)',
        headers: DOCUMENT_SECURITY_HEADERS,
      },
      {
        source: '/static/:path*',
        headers: STATIC_CACHE_HEADERS,
      },
      {
        source: '/_next/image',
        headers: STATIC_CACHE_HEADERS,
      },
      {
        source: '/_next/static/:path*',
        headers: STATIC_CACHE_HEADERS,
      },
      {
        source: '/fonts/:path*',
        headers: STATIC_CACHE_HEADERS,
      },
      {source: '/manifest.json', headers: PUBLIC_SHORT_CACHE_HEADERS},
      {source: '/llms.txt', headers: PUBLIC_SHORT_CACHE_HEADERS},
      {source: '/llms-full.txt', headers: PUBLIC_SHORT_CACHE_HEADERS},
      {source: '/robots.txt', headers: PUBLIC_SHORT_CACHE_HEADERS},
      {source: '/sitemap.xml', headers: PUBLIC_SHORT_CACHE_HEADERS},
      {source: '/icon.svg', headers: STATIC_CACHE_HEADERS},
      {source: '/api/:path*', headers: API_SECURITY_HEADERS},
    ]
  },
  async rewrites() {
    const logoutRewrite = {source: '/logout', destination: '/logout.html'}
    if (!TEE_ENCLAVE_URL) return [logoutRewrite]
    return [
      logoutRewrite,
      {source: '/api/subscribe', destination: `${TEE_ENCLAVE_URL}/stripe/create-checkout-session`},
      {
        source: '/api/subscribe-simple',
        destination: `${TEE_ENCLAVE_URL}/stripe/create-checkout-session`,
      },
      {source: '/api/subscribe/status', destination: `${TEE_ENCLAVE_URL}/subscription-status`},
      {
        source: '/api/subscribe/portal',
        destination: `${TEE_ENCLAVE_URL}/stripe/create-portal-session`,
      },
      {
        source: '/api/subscribe/cancel',
        destination: `${TEE_ENCLAVE_URL}/stripe/cancel-subscription`,
      },
      {source: '/api/subscribe/prices', destination: `${TEE_ENCLAVE_URL}/stripe/prices`},
      {source: '/api/subscribe/details', destination: `${TEE_ENCLAVE_URL}/subscription-details`},
    ]
  },
}

if (process.env.ANALYZE === 'true') {
  nextConfig = withBundleAnalyzer(nextConfig)
}

export default nextConfig
