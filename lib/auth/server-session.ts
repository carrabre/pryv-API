import type {RequestCookies} from 'next/dist/server/web/spec-extension/cookies'
import {deriveCookieDomain, isSecureFromRequestUrl} from '@/lib/auth/cookie-domain'
import {
  LOGGED_OUT_COOKIE,
  LOGGED_OUT_TTL_SECONDS,
  SESSION_CONFIRMED_COOKIE,
  THIRDWEB_SESSION_COOKIE,
  THIRDWEB_SESSION_TTL_SECONDS,
  WALLET_ADDRESS_COOKIE,
  WALLET_ADDRESS_TTL_SECONDS,
} from '@/lib/auth/cookie-names'

export {deriveCookieDomain} from '@/lib/auth/cookie-domain'

type CookieSetter = (name: string, value: string, options?: Record<string, unknown>) => unknown
export type ServerCookieStore = {
  get: RequestCookies['get']
  set: CookieSetter
}

export interface SessionCookieOptions {
  cookieStore: ServerCookieStore
  address?: string | null
  fallbackSessionValue?: string
  requestUrl?: string
}

export function persistSessionCookies({
  cookieStore,
  address,
  fallbackSessionValue,
  requestUrl,
}: SessionCookieOptions) {
  const sessionValue = address ?? fallbackSessionValue
  if (!sessionValue) {
    throw new Error('persistSessionCookies requires an address or fallback session value')
  }
  const secure = isSecureFromRequestUrl(requestUrl)
  const domain = deriveCookieDomain(requestUrl)
  cookieStore.set(THIRDWEB_SESSION_COOKIE, sessionValue, {
    httpOnly: false,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: THIRDWEB_SESSION_TTL_SECONDS,
    ...(domain ? {domain} : {}),
  })
  cookieStore.set(SESSION_CONFIRMED_COOKIE, '1', {
    httpOnly: false,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: THIRDWEB_SESSION_TTL_SECONDS,
    ...(domain ? {domain} : {}),
  })

  if (address) {
    cookieStore.set(WALLET_ADDRESS_COOKIE, address, {
      httpOnly: false,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: WALLET_ADDRESS_TTL_SECONDS,
      ...(domain ? {domain} : {}),
    })
  }

  return {domain, sessionValue}
}

export function setLoggedOutCookie({
  cookieStore,
  requestUrl,
  maxAgeSeconds = LOGGED_OUT_TTL_SECONDS,
}: {
  cookieStore: ServerCookieStore
  requestUrl?: string
  maxAgeSeconds?: number
}) {
  const secure = isSecureFromRequestUrl(requestUrl)
  const domain = deriveCookieDomain(requestUrl)
  cookieStore.set(LOGGED_OUT_COOKIE, '1', {
    httpOnly: false,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSeconds,
    ...(domain ? {domain} : {}),
  })
}

export function clearLoggedOutCookie({
  cookieStore,
  requestUrl,
}: {
  cookieStore: ServerCookieStore
  requestUrl?: string
}) {
  const secure = isSecureFromRequestUrl(requestUrl)
  const domain = deriveCookieDomain(requestUrl)
  cookieStore.set(LOGGED_OUT_COOKIE, '', {
    httpOnly: false,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    ...(domain ? {domain} : {}),
  })
  if (domain) {
    cookieStore.set(LOGGED_OUT_COOKIE, '', {
      httpOnly: false,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    })
  }
}
