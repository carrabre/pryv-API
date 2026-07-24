import 'server-only'

import type {NextRequest} from 'next/server'
import {AUTH_DEBUG_ENABLED, logAuthDebug} from '@/lib/server-debug'
import {clearLoggedOutCookie, persistSessionCookies} from '@/lib/auth/server-session'
import {deriveCookieDomainFromHostname} from '@/lib/auth/cookie-domain'
import {LOGGED_OUT_COOKIE, LOGGED_OUT_TTL_SECONDS, LOGGED_OUT_VALUE} from '@/lib/auth/cookie-names'
import type {LoginPayload, VerifyLoginPayloadParams} from 'thirdweb/auth'
import {THIRDWEB_LOGIN_NONCE_COOKIE} from '@/lib/auth/thirdweb-login-cookie'
import {makeAuthCookieValue, PRYV_AUTH_COOKIE} from '@/lib/auth/server-auth-cookie-issue'
import {getLogoutCookieNames, isHttpOnlyLogoutCookieName} from '@/lib/auth/logout-cookies'
import {PROD} from '@/lib/runtime'

const NO_STORE_HEADERS = {'Cache-Control': 'no-store'} as const
const JSON_NO_STORE_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json',
} as const
const LOGOUT_SUCCESS_BODY = '{"success":true}'

function getSessionCreateErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  const lower = message.toLowerCase()
  if (
    lower.includes('auth_secret') ||
    lower.includes('nextauth_secret') ||
    lower.includes('must contain at least 32')
  ) {
    return 'missing_auth_signing_secret'
  }
  if (lower.includes('webcrypto not available')) {
    return 'webcrypto_unavailable'
  }
  return 'session_create_failed'
}

function isLoginPayload(value: unknown): value is LoginPayload {
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

function getVerifyPayloadParams(body: any): VerifyLoginPayloadParams | null {
  const payload = body?.payload as LoginPayload | undefined
  const signature = body?.signature
  if (!isLoginPayload(payload) || typeof signature !== 'string' || !signature.startsWith('0x')) {
    return null
  }
  return {payload, signature}
}

function parseCookieNames(cookieHeader: string | null) {
  if (!cookieHeader) return []
  const names: string[] = []
  let start = 0
  while (start < cookieHeader.length) {
    let end = cookieHeader.indexOf(';', start)
    if (end < 0) end = cookieHeader.length

    const separator = cookieHeader.indexOf('=', start)
    if (separator >= start && separator < end) {
      const name = cookieHeader.slice(start, separator).trim()
      if (name) names.push(name)
    }

    start = end + 1
  }
  return names
}

function appendCookie(
  headers: Headers,
  name: string,
  value: string,
  {
    maxAge,
    domain,
    httpOnly,
    secure,
  }: {
    maxAge: number
    domain?: string
    httpOnly: boolean
    secure: boolean
  },
) {
  headers.append(
    'Set-Cookie',
    `${name}=${value}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure ? '; Secure' : ''}${httpOnly ? '; HttpOnly' : ''}${domain ? `; Domain=${domain}` : ''}`,
  )
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const isSecureRequest = PROD || request.nextUrl.protocol === 'https:'
    const verifyParams = getVerifyPayloadParams(body)

    if (!verifyParams) {
      if (AUTH_DEBUG_ENABLED) {
        logAuthDebug('api:auth/thirdweb:missing-signature')
      }
      return Response.json(
        {error: 'Wallet signature is required', errorCode: 'missing_wallet_signature'},
        {status: 401, headers: NO_STORE_HEADERS},
      )
    }

    const [{cookies: getCookies}, {clearThirdwebLoginNonceCookie, verifyThirdwebLoginPayload}] =
      await Promise.all([import('next/headers'), import('@/lib/auth/thirdweb-login')])
    const cookieStore = await getCookies()
    const expectedNonceCookie = cookieStore.get(THIRDWEB_LOGIN_NONCE_COOKIE)?.value ?? null
    const verified = await verifyThirdwebLoginPayload({
      request,
      expectedNonceCookie,
      ...verifyParams,
    })
    clearThirdwebLoginNonceCookie({cookieStore, request})

    if (!verified.valid) {
      if (AUTH_DEBUG_ENABLED) {
        logAuthDebug('api:auth/thirdweb:signature-invalid')
      }
      return Response.json(
        {
          error: 'Wallet signature verification failed',
          errorCode: 'invalid_wallet_signature',
        },
        {status: 401, headers: NO_STORE_HEADERS},
      )
    }

    const address = verified.payload.address

    if (AUTH_DEBUG_ENABLED) {
      logAuthDebug('api:auth/thirdweb:input')
    }

    const {domain} = persistSessionCookies({
      cookieStore,
      address,
      requestUrl: request.url,
    })
    clearLoggedOutCookie({cookieStore, requestUrl: request.url})

    try {
      const authCookieValue = makeAuthCookieValue(address)
      cookieStore.set(PRYV_AUTH_COOKIE, authCookieValue, {
        httpOnly: true,
        secure: isSecureRequest,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
        ...(domain ? {domain} : {}),
      })
    } catch (cookieError) {
      const errorCode = getSessionCreateErrorCode(cookieError)
      if (AUTH_DEBUG_ENABLED) {
        logAuthDebug('api:auth/thirdweb:pryv-auth-issue-failed')
      }

      return Response.json({error: 'Failed to establish server session', errorCode}, {status: 500})
    }

    if (AUTH_DEBUG_ENABLED) {
      logAuthDebug('api:auth/thirdweb:set-cookie')
    }
    return Response.json({success: true}, {headers: NO_STORE_HEADERS})
  } catch (error) {
    const errorCode = getSessionCreateErrorCode(error)
    if (AUTH_DEBUG_ENABLED) {
      logAuthDebug('api:auth/thirdweb:error')
    }
    return Response.json(
      {error: 'Failed to create session', errorCode},
      {status: 500, headers: NO_STORE_HEADERS},
    )
  }
}

export async function DELETE(request: NextRequest) {
  const headers = new Headers(JSON_NO_STORE_HEADERS)
  const domain = deriveCookieDomainFromHostname(request.nextUrl.hostname)
  const secure = PROD || request.nextUrl.protocol === 'https:'
  const existingCookieNames = parseCookieNames(request.headers.get('cookie'))

  for (const name of getLogoutCookieNames(existingCookieNames)) {
    const httpOnly = isHttpOnlyLogoutCookieName(name)
    if (domain) appendCookie(headers, name, '', {domain, httpOnly, maxAge: 0, secure})
    appendCookie(headers, name, '', {httpOnly, maxAge: 0, secure})
  }

  appendCookie(headers, LOGGED_OUT_COOKIE, LOGGED_OUT_VALUE, {
    domain,
    httpOnly: false,
    maxAge: LOGGED_OUT_TTL_SECONDS,
    secure,
  })

  return new Response(LOGOUT_SUCCESS_BODY, {headers})
}
