import type {NextRequest} from 'next/server'

export function getTrustedRequestOrigin(request: NextRequest) {
  const configured = process.env.AUTH_ORIGIN || process.env.NEXT_PUBLIC_PLATFORM_URL
  const candidate = configured?.trim() || request.nextUrl.origin
  const url = new URL(candidate)

  if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    throw new Error('AUTH_ORIGIN must use HTTPS outside local development')
  }

  return {
    domain: url.host,
    uri: url.origin,
  }
}
