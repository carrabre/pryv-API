import {NextResponse, type NextRequest} from 'next/server'
import {PRYV_LEGACY_AUTH_COOKIE} from '@/lib/auth/cookie-names'
import {deriveCookieDomainFromHostname} from '@/lib/auth/cookie-domain'
import {makeAuthCookieValue} from '@/lib/auth/server-auth-cookie-issue'
import {getAuthenticatedRedirectTarget} from '@/lib/auth/redirect-target'
import {PROD} from '@/lib/runtime'

const LEGACY_HANDOFF_TTL_SECONDS = 60 * 60
const NO_STORE_HEADERS = {'Cache-Control': 'no-store'} as const

function buildLegacyHandoffCookie(value: string, domain?: string | null) {
  return `${PRYV_LEGACY_AUTH_COOKIE}=${value}; Path=/; Max-Age=${LEGACY_HANDOFF_TTL_SECONDS}; SameSite=Lax; HttpOnly${PROD ? '; Secure' : ''}${domain ? `; Domain=${domain}` : ''}`
}

function redirectToLogin(request: NextRequest, target: string) {
  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('redirect', target)
  const response = NextResponse.redirect(loginUrl)
  response.headers.set('Cache-Control', NO_STORE_HEADERS['Cache-Control'])
  return response
}

export async function GET(request: NextRequest) {
  const target = getAuthenticatedRedirectTarget(request.nextUrl.searchParams.get('redirect'))
  const session = await import('@/lib/auth/legacy-nextauth-session')
    .then(({getLegacyNextAuthSession}) => getLegacyNextAuthSession())
    .catch(() => null)

  const subject = session?.user?.id
  if (!subject) {
    return redirectToLogin(request, target)
  }

  const response = NextResponse.redirect(new URL(target, request.url))
  response.headers.set('Cache-Control', NO_STORE_HEADERS['Cache-Control'])
  const cookieValue = makeAuthCookieValue(subject, LEGACY_HANDOFF_TTL_SECONDS)
  const domain = deriveCookieDomainFromHostname(request.nextUrl.hostname)
  response.headers.append('Set-Cookie', buildLegacyHandoffCookie(cookieValue))
  if (domain) {
    response.headers.append('Set-Cookie', buildLegacyHandoffCookie(cookieValue, domain))
  }
  return response
}
