import {AUTH_DEBUG_ENABLED, logAuthDebug} from '@/lib/server-debug'
import {deriveCookieDomainFromHostname} from '@/lib/auth/cookie-domain'
import {PROD} from '@/lib/runtime'
import {WORLDCOIN_NONCE_COOKIE, WORLDCOIN_NONCE_TTL_SECONDS} from '@/lib/worldcoin/cookies'

export const runtime = 'edge'

const JSON_NO_STORE_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json',
} as const

function buildNonceCookie(nonce: string, domain?: string) {
  return `${WORLDCOIN_NONCE_COOKIE}=${nonce}; Path=/; Max-Age=${WORLDCOIN_NONCE_TTL_SECONDS}; SameSite=Lax; HttpOnly${PROD ? '; Secure' : ''}${domain ? `; Domain=${domain}` : ''}`
}

export function GET(request: Request) {
  const nonce = crypto.randomUUID().replace(/-/g, '')
  const domain = deriveCookieDomainFromHostname(new URL(request.url).hostname)

  if (AUTH_DEBUG_ENABLED) {
    logAuthDebug('worldcoin:nonce:issued', {
      domain,
      requestUrl: request.url,
    })
  }

  return new Response(`{"nonce":${JSON.stringify(nonce)}}`, {
    headers: {
      ...JSON_NO_STORE_HEADERS,
      'Set-Cookie': buildNonceCookie(nonce, domain),
    },
  })
}
