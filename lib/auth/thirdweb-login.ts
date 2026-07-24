import 'server-only'

import type {NextRequest} from 'next/server'
import {
  createAuth,
  type AuthOptions,
  type LoginPayload,
  type VerifyLoginPayloadParams,
} from 'thirdweb/auth'
import type {ThirdwebClient} from 'thirdweb'
import {deriveCookieDomainFromHostname} from '@/lib/auth/cookie-domain'
import {getTrustedRequestOrigin} from '@/lib/auth/request-origin'
import type {ServerCookieStore} from '@/lib/auth/server-session'
import {
  parseThirdwebLoginNonceCookie,
  THIRDWEB_LOGIN_NONCE_COOKIE,
  THIRDWEB_LOGIN_NONCE_TTL_SECONDS,
  THIRDWEB_LOGIN_STATEMENT,
} from '@/lib/auth/thirdweb-login-cookie'

function isSecureRequest(request: NextRequest) {
  return request.nextUrl.protocol === 'https:'
}

function getNonceCookieOptions(request: NextRequest, maxAgeSeconds: number) {
  const domain = deriveCookieDomainFromHostname(request.nextUrl.hostname)
  return {
    httpOnly: true,
    secure: isSecureRequest(request),
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
    ...(domain ? {domain} : {}),
  }
}

function buildAuthOptions(
  request: NextRequest,
  expectedNonces?: readonly string[] | null,
  client?: ThirdwebClient | null,
): AuthOptions {
  const {domain, uri} = getTrustedRequestOrigin(request)
  const login: AuthOptions['login'] = {
    statement: THIRDWEB_LOGIN_STATEMENT,
    payloadExpirationTimeSeconds: THIRDWEB_LOGIN_NONCE_TTL_SECONDS,
    uri,
  }

  if (expectedNonces !== undefined) {
    const nonces = expectedNonces ?? []
    login.nonce = {
      generate: () => nonces.at(-1) ?? '',
      validate: (nonce) => nonces.includes(nonce),
    }
  }

  return {
    domain,
    ...(client ? {client} : {}),
    login,
  }
}

function getThirdwebAuth(
  request: NextRequest,
  expectedNonces?: readonly string[] | null,
  client?: ThirdwebClient | null,
) {
  return createAuth(buildAuthOptions(request, expectedNonces, client))
}

async function getThirdwebAuthClient() {
  const {getThirdwebServerClient} = await import('@/lib/thirdweb/server-client')
  return getThirdwebServerClient()
}

export async function verifyThirdwebLoginPayload({
  request,
  expectedNonceCookie,
  payload,
  signature,
}: {
  request: NextRequest
  expectedNonceCookie?: string | null
} & VerifyLoginPayloadParams) {
  const client = await getThirdwebAuthClient()
  const expectedNonces = parseThirdwebLoginNonceCookie(expectedNonceCookie)
  return getThirdwebAuth(request, expectedNonces, client).verifyPayload({payload, signature})
}

export function setThirdwebLoginNonceCookie({
  cookieStore,
  request,
  nonce,
}: {
  cookieStore: ServerCookieStore
  request: NextRequest
  nonce: string
}) {
  cookieStore.set(
    THIRDWEB_LOGIN_NONCE_COOKIE,
    nonce,
    getNonceCookieOptions(request, THIRDWEB_LOGIN_NONCE_TTL_SECONDS),
  )
}

export function clearThirdwebLoginNonceCookie({
  cookieStore,
  request,
}: {
  cookieStore: ServerCookieStore
  request: NextRequest
}) {
  cookieStore.set(THIRDWEB_LOGIN_NONCE_COOKIE, '', getNonceCookieOptions(request, 0))
  const domain = deriveCookieDomainFromHostname(request.nextUrl.hostname)
  if (domain) {
    const {domain: _domain, ...hostOnlyOptions} = getNonceCookieOptions(request, 0)
    cookieStore.set(THIRDWEB_LOGIN_NONCE_COOKIE, '', hostOnlyOptions)
  }
}

export function isLoginPayload(value: unknown): value is LoginPayload {
  if (!value || typeof value !== 'object') return false
  const payload = value as Record<string, unknown>
  return (
    typeof payload.domain === 'string' &&
    typeof payload.address === 'string' &&
    typeof payload.statement === 'string' &&
    typeof payload.version === 'string' &&
    typeof payload.nonce === 'string' &&
    typeof payload.issued_at === 'string' &&
    typeof payload.expiration_time === 'string' &&
    typeof payload.invalid_before === 'string'
  )
}
