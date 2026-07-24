import type {NextRequest} from 'next/server'
import {DEV, PROD, TEST} from './lib/runtime'
import {
  LOGGED_OUT_COOKIE,
  LOGGED_OUT_VALUE,
  PRYV_LEGACY_AUTH_COOKIE,
  SESSION_CONFIRMED_COOKIE,
  THIRDWEB_SESSION_COOKIE,
  WALLET_ADDRESS_COOKIE,
} from './lib/auth/cookie-names'
import {getAuthenticatedRedirectTarget} from './lib/auth/redirect-target'
import {
  parseAndVerifyAuthCookie,
  parseAndVerifyLegacyAuthCookie,
  PRYV_AUTH_COOKIE,
} from './lib/auth/edge-auth-cookie'
import {
  WORLDAPP_WALLET_ADDRESS_COOKIE,
  WORLDCOIN_NONCE_COOKIE,
  WORLDCOIN_VERIFIED_COOKIE,
} from './lib/worldcoin/cookies'
import {deriveCookieDomainFromHostname} from './lib/auth/cookie-domain'

// Clear browser/site data once per dev server boot
let didClearSiteDataOnBoot = false

function maybeAddBootClearSiteDataHeader(response: Response) {
  // In dev, we clear browser state once per boot to prevent stale auth issues.
  // During Playwright runs, this breaks deterministic session setup (cookies get wiped),
  // so we skip it when TEST mode is enabled.
  if (DEV && !TEST && !didClearSiteDataOnBoot) {
    response.headers.set('Clear-Site-Data', '"cache", "cookies", "storage", "executionContexts"')
    didClearSiteDataOnBoot = true
  }
  return response
}

const AUTH_DEBUG = DEV && process.env.AUTH_DEBUG === '1'
const TRAFFIC_OVERLOAD = process.env.TRAFFIC_OVERLOAD === 'true'

const TEE_CONTENT_SECURITY_POLICY =
  "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; " +
  "script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; " +
  "base-uri 'none'; form-action 'none';"
const TEE_PERMISSIONS_POLICY = 'camera=(), microphone=(), geolocation=(), payment=()'
const OVERLOAD_RESPONSE_BODY =
  '{"error":"temporarily_unavailable","message":"Service is experiencing high load. Please try again later."}'

const LEGACY_NEXTAUTH_SESSION_COOKIE_NAME_RE =
  /^(?:__Secure-)?(?:authjs|next-auth)\.session-token(?:\..*)?$/

const BASE_LOGOUT_COOKIE_NAMES = [
  THIRDWEB_SESSION_COOKIE,
  WALLET_ADDRESS_COOKIE,
  SESSION_CONFIRMED_COOKIE,
  PRYV_AUTH_COOKIE,
  PRYV_LEGACY_AUTH_COOKIE,
  WORLDCOIN_NONCE_COOKIE,
  WORLDCOIN_VERIFIED_COOKIE,
  WORLDAPP_WALLET_ADDRESS_COOKIE,
  'authjs.session-token',
  '__Secure-authjs.session-token',
  'authjs.csrf-token',
  '__Host-authjs.csrf-token',
  'authjs.callback-url',
  '__Secure-authjs.callback-url',
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
  'next-auth.csrf-token',
  '__Host-next-auth.csrf-token',
  'next-auth.callback-url',
  '__Secure-next-auth.callback-url',
]

const AUTH_COOKIE_PREFIX_RE = /^(?:__Secure-|__Host-)?(?:authjs|next-auth)\./

function debugAuth(label: string) {
  if (!AUTH_DEBUG) return
  try {
    // eslint-disable-next-line no-console
    console.info(`[AUTH] ${label}`)
  } catch {}
}

type RequestCookie = {
  name: string
  value: string
}

type MiddlewareRequestCookies = {
  loggedOutCookie?: RequestCookie
  serverAuthCookies: RequestCookie[]
  legacyAuthCookie?: RequestCookie
}

type FallbackAuthCookies = {
  thirdwebSession?: RequestCookie
  legacyNextAuthCookieName?: string
}

type CookieSegmentName = {
  index: number
  name: string
}

function decodeCookieValue(value: string): string {
  if (!value.includes('%')) return value
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function parseRequestCookieNames(cookieHeader: string | null): string[] {
  if (!cookieHeader) return []
  const names: string[] = []
  for (const segment of cookieHeader.split(';')) {
    const index = segment.indexOf('=')
    if (index < 0) continue

    const name = segment.slice(0, index).trim()
    if (!name) continue

    names.push(name)
  }
  return names
}

function isLegacyNextAuthSessionCookieName(cookieName: string) {
  return LEGACY_NEXTAUTH_SESSION_COOKIE_NAME_RE.test(cookieName)
}

function getCookieSegmentName(cookieHeader: string, start: number, end: number) {
  const index = cookieHeader.indexOf('=', start)
  if (index < start || index >= end) return null
  const name = cookieHeader.slice(start, index).trim()
  if (!name) return null
  return {index, name}
}

function readCookieSegment(
  cookieHeader: string,
  segment: CookieSegmentName,
  end: number,
): RequestCookie {
  return {
    name: segment.name,
    value: decodeCookieValue(cookieHeader.slice(segment.index + 1, end).trim()),
  }
}

function readMiddlewareRequestCookies(cookieHeader: string | null): MiddlewareRequestCookies {
  const cookies: MiddlewareRequestCookies = {serverAuthCookies: []}
  if (!cookieHeader) return cookies

  let start = 0
  while (start < cookieHeader.length) {
    let end = cookieHeader.indexOf(';', start)
    if (end < 0) end = cookieHeader.length

    const segment = getCookieSegmentName(cookieHeader, start, end)
    if (segment) {
      switch (segment.name) {
        case PRYV_AUTH_COOKIE:
          cookies.serverAuthCookies.push(readCookieSegment(cookieHeader, segment, end))
          break
        case LOGGED_OUT_COOKIE:
          {
            const loggedOutCookie = readCookieSegment(cookieHeader, segment, end)
            if (loggedOutCookie.value === LOGGED_OUT_VALUE) {
              cookies.loggedOutCookie = loggedOutCookie
              return cookies
            }
            if (!cookies.loggedOutCookie) {
              cookies.loggedOutCookie = loggedOutCookie
            }
          }
          break
        case PRYV_LEGACY_AUTH_COOKIE:
          if (!cookies.legacyAuthCookie) {
            cookies.legacyAuthCookie = readCookieSegment(cookieHeader, segment, end)
          }
          break
      }
    }

    start = end + 1
  }

  return cookies
}

async function getFirstValidAuthCookieAddress(cookieValues: readonly string[]) {
  for (const cookieValue of cookieValues) {
    const serverAuth = await parseAndVerifyAuthCookie(cookieValue)
    if (serverAuth?.address) return serverAuth.address
  }
  return null
}

function readFallbackAuthCookies(cookieHeader: string | null): FallbackAuthCookies {
  const cookies: FallbackAuthCookies = {}
  if (!cookieHeader) return cookies

  let start = 0
  while (start < cookieHeader.length) {
    let end = cookieHeader.indexOf(';', start)
    if (end < 0) end = cookieHeader.length

    const segment = getCookieSegmentName(cookieHeader, start, end)
    if (segment) {
      if (segment.name === THIRDWEB_SESSION_COOKIE) {
        cookies.thirdwebSession = readCookieSegment(cookieHeader, segment, end)
        return cookies
      }
      if (!cookies.legacyNextAuthCookieName && isLegacyNextAuthSessionCookieName(segment.name)) {
        cookies.legacyNextAuthCookieName = segment.name
      }
    }

    start = end + 1
  }

  return cookies
}

function isLogoutCookieName(name: string) {
  return BASE_LOGOUT_COOKIE_NAMES.includes(name) || AUTH_COOKIE_PREFIX_RE.test(name)
}

function isHttpOnlyLogoutCookieName(name: string) {
  return name === PRYV_AUTH_COOKIE || name.includes('session-token')
}

function appendExpiredCookie(
  headers: Headers,
  name: string,
  {
    domain,
    httpOnly,
    secure,
  }: {
    domain?: string | null
    httpOnly: boolean
    secure: boolean
  },
) {
  headers.append(
    'Set-Cookie',
    `${name}=; Path=/; Max-Age=0; SameSite=Lax${secure ? '; Secure' : ''}${httpOnly ? '; HttpOnly' : ''}${domain ? `; Domain=${domain}` : ''}`,
  )
}

function applyTeePrivacyHeaders(response: Response) {
  response.headers.set('Content-Security-Policy', TEE_CONTENT_SECURITY_POLICY)
  response.headers.set('Permissions-Policy', TEE_PERMISSIONS_POLICY)
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Referrer-Policy', 'no-referrer')
  response.headers.set('X-DNS-Prefetch-Control', 'off')
}

function applyTeePrivacyHeadersIfNeeded(response: Response, request: Request, requestUrl: URL) {
  if (isTeeRequest(request, requestUrl)) applyTeePrivacyHeaders(response)
}

function finishNextResponse(response: Response, request: Request, requestUrl: URL) {
  applyTeePrivacyHeadersIfNeeded(response, request, requestUrl)
  return maybeAddBootClearSiteDataHeader(response)
}

function clearAuthCookies(
  response: Response,
  request: Request,
  requestUrl: Pick<URL, 'hostname' | 'protocol'>,
  existingCookieNames: Iterable<string>,
) {
  const domain = deriveCookieDomainFromHostname(requestUrl.hostname)
  const isSecureRequest = PROD || requestUrl.protocol === 'https:'
  const logoutCookieNames = new Set<string>(BASE_LOGOUT_COOKIE_NAMES)
  for (const name of existingCookieNames) {
    if (isLogoutCookieName(name)) logoutCookieNames.add(name)
  }

  for (const name of logoutCookieNames) {
    const httpOnly = isHttpOnlyLogoutCookieName(name)
    if (domain) {
      appendExpiredCookie(response.headers, name, {domain, httpOnly, secure: isSecureRequest})
    }
    appendExpiredCookie(response.headers, name, {httpOnly, secure: isSecureRequest})
  }
}

function isTeeRequest(request: Request, requestUrl: URL) {
  return (
    request.headers.get('X-TEE-Request') === 'true' ||
    requestUrl.searchParams.get('tee') === '1' ||
    requestUrl.hostname.includes('tee')
  )
}

function nextResponse() {
  return new Response(null, {headers: {'x-middleware-next': '1'}})
}

function redirectResponse(url: {toString(): string}, status = 307) {
  return new Response(null, {status, headers: {Location: url.toString()}})
}

function redirectToLogin(requestUrl: NextRequest['nextUrl']) {
  const redirectTarget = `${requestUrl.pathname}${requestUrl.search || ''}`
  return redirectResponse(
    `${requestUrl.origin}/login?redirect=${encodeURIComponent(redirectTarget)}`,
  )
}

function redirectToLegacyHandoff(requestUrl: NextRequest['nextUrl']) {
  const redirectTarget = `${requestUrl.pathname}${requestUrl.search || ''}`
  return redirectResponse(
    `${requestUrl.origin}/api/auth/legacy-handoff?redirect=${encodeURIComponent(redirectTarget)}`,
  )
}

export async function middleware(request: NextRequest) {
  const requestUrl = request.nextUrl
  const {pathname, searchParams} = requestUrl
  const stayOnPage = searchParams.get('stay')

  // Always keep /login URL clean (even if an older client navigates to /login?stay=1).
  // The logged-out cookie is the canonical mechanism to prevent immediate bounce-backs.
  if (pathname === '/login' && (stayOnPage === '1' || stayOnPage?.toLowerCase() === 'true')) {
    const url = requestUrl.clone()
    url.searchParams.delete('stay')
    return redirectResponse(url)
  }

  // Global overload gate for heavy or write endpoints
  if (TRAFFIC_OVERLOAD) {
    const isHeavyApi =
      pathname.startsWith('/api/mint') ||
      pathname.startsWith('/api/subscribe') ||
      pathname.startsWith('/api/admin')
    if (isHeavyApi) {
      return new Response(OVERLOAD_RESPONSE_BODY, {
        status: 503,
        headers: {'Content-Type': 'application/json', 'Retry-After': '60'},
      })
    }
  }

  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) {
    if (pathname === '/login') {
      const response = nextResponse()
      return finishNextResponse(response, request, requestUrl)
    }

    debugAuth('no-session')
    const response = redirectToLogin(requestUrl)
    return maybeAddBootClearSiteDataHeader(response)
  }

  const requestCookies = readMiddlewareRequestCookies(cookieHeader)
  const {serverAuthCookies, loggedOutCookie, legacyAuthCookie} = requestCookies
  const loggedOut = loggedOutCookie?.value === LOGGED_OUT_VALUE
  const serverAuthCookieValues = loggedOut ? [] : serverAuthCookies.map((cookie) => cookie.value)
  const legacyAuthCookieValue = loggedOut ? undefined : legacyAuthCookie?.value
  let serverAuthAddress: string | null | undefined

  // FAST PATH: Redirect authenticated users from landing/login directly to /docs.
  // Supports marketing escape hatch via ?stay=1 to keep users on landing page.
  //
  // IMPORTANT: Keep this on the server-issued Pryv auth cookie only. Legacy NextAuth cookies
  // are validated by Node.js server guards to keep @auth/jose out of the Edge middleware bundle.
  if (!loggedOut && (pathname === '/' || pathname === '/login')) {
    const skipFastRedirect = stayOnPage === '1' || stayOnPage?.toLowerCase() === 'true'
    if (!skipFastRedirect) {
      const target = getAuthenticatedRedirectTarget(searchParams.get('redirect'))

      serverAuthAddress = await getFirstValidAuthCookieAddress(serverAuthCookieValues)
      if (serverAuthAddress) {
        debugAuth('fast-redirect')
        const response = redirectResponse(new URL(target, request.url))
        return maybeAddBootClearSiteDataHeader(response)
      }
    }
  }

  if (!loggedOut && pathname === '/login') {
    const fallbackAuthCookies = readFallbackAuthCookies(cookieHeader)
    if (fallbackAuthCookies.legacyNextAuthCookieName) {
      debugAuth('login-legacy-handoff')
      const target = getAuthenticatedRedirectTarget(searchParams.get('redirect'))
      const response = redirectResponse(
        `${requestUrl.origin}/api/auth/legacy-handoff?redirect=${encodeURIComponent(target)}`,
      )
      return finishNextResponse(response, request, requestUrl)
    }
  }

  // Check if it's a public route
  if (pathname === '/login') {
    const response = nextResponse()

    if (loggedOut) {
      clearAuthCookies(response, request, requestUrl, parseRequestCookieNames(cookieHeader))
    }

    return finishNextResponse(response, request, requestUrl)
  }

  if (loggedOut) {
    debugAuth('logged-out')
    const response = redirectToLogin(requestUrl)
    clearAuthCookies(response, request, requestUrl, parseRequestCookieNames(cookieHeader))
    return maybeAddBootClearSiteDataHeader(response)
  }

  if (serverAuthAddress === undefined) {
    serverAuthAddress = await getFirstValidAuthCookieAddress(serverAuthCookieValues)
  }
  if (serverAuthAddress) {
    debugAuth('auth-ok')
    const response = nextResponse()

    return finishNextResponse(response, request, requestUrl)
  }

  const legacyAuth = legacyAuthCookieValue
    ? await parseAndVerifyLegacyAuthCookie(legacyAuthCookieValue)
    : null
  if (legacyAuth?.subject && !pathname.startsWith('/api/')) {
    debugAuth('legacy-ok')
    const response = nextResponse()

    return finishNextResponse(response, request, requestUrl)
  }

  // For protected routes without a signed server auth cookie, clean up stale legacy client cookies.
  const fallbackAuthCookies: FallbackAuthCookies = readFallbackAuthCookies(cookieHeader)
  const thirdwebSession = fallbackAuthCookies.thirdwebSession
  debugAuth('cookie-check')

  if (thirdwebSession) {
    debugAuth('invalid-thirdweb')
    const response = redirectToLogin(requestUrl)
    clearAuthCookies(response, request, requestUrl, parseRequestCookieNames(cookieHeader))
    return maybeAddBootClearSiteDataHeader(response)
  }

  if (fallbackAuthCookies.legacyNextAuthCookieName && !pathname.startsWith('/api/')) {
    debugAuth('legacy-handoff')
    const response = redirectToLegacyHandoff(requestUrl)
    return finishNextResponse(response, request, requestUrl)
  }

  // No authentication found, redirect to login for protected routes
  debugAuth('no-session')
  const response = redirectToLogin(requestUrl)
  return maybeAddBootClearSiteDataHeader(response)
}

export const config = {
  matcher: [
    // Exclude internals, health checks, public auth/bootstrap APIs, static assets, and files.
    '/((?!_next|_vercel|ping|logout|api/auth|api/worldcoin|.*\\..*).*)',
  ],
}
