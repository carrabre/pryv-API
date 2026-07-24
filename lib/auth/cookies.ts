import {
  LOGGED_OUT_COOKIE,
  LOGGED_OUT_TTL_SECONDS,
  LOGGED_OUT_VALUE,
  SESSION_CONFIRMED_COOKIE,
  SESSION_CONFIRMED_VALUE,
  THIRDWEB_SESSION_COOKIE,
  THIRDWEB_SESSION_TTL_SECONDS,
  WALLET_ADDRESS_COOKIE,
  WALLET_ADDRESS_TTL_SECONDS,
} from '@/lib/auth/cookie-names'

export {
  LOGGED_OUT_COOKIE,
  LOGGED_OUT_TTL_SECONDS,
  LOGGED_OUT_VALUE,
  SESSION_CONFIRMED_COOKIE,
  SESSION_CONFIRMED_VALUE,
  THIRDWEB_SESSION_COOKIE,
  THIRDWEB_SESSION_TTL_SECONDS,
  WALLET_ADDRESS_COOKIE,
  WALLET_ADDRESS_TTL_SECONDS,
} from '@/lib/auth/cookie-names'
export {
  AUTH_STATE_CHANGED_EVENT,
  hasLoggedOutCookie,
  hasValidSessionFromCookieString,
  hasValidSessionPair,
  normalizeWalletCookieValue,
  parseCookieString,
  readSessionCookieInfo,
  type CookieMap,
  type SessionCookieInfo,
} from '@/lib/auth/cookie-read'
export {isLikelyWalletAddress} from '@/lib/auth/wallet-address'

const AUTH_STATE_CHANGED_EVENT_NAME = 'pryv-auth-state-changed'

function isBrowser(): boolean {
  return typeof document !== 'undefined'
}

function notifyAuthStateChanged() {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new Event(AUTH_STATE_CHANGED_EVENT_NAME))
  } catch {
    // ignore
  }
}

function getSecureSuffix(): string {
  if (typeof window === 'undefined') return ''
  return window.location.protocol === 'https:' ? '; Secure' : ''
}

function getCookieDomainFromHost(host: string): string | null {
  // Browser-issued cookies are deliberately host-only. Cross-subdomain cookies
  // must be issued by the server after validating AUTH_COOKIE_DOMAIN.
  return null
}

function getCookieDomain(): string | null {
  if (typeof window === 'undefined') return null
  return getCookieDomainFromHost(window.location.hostname)
}

function buildCookieString(
  name: string,
  value: string,
  maxAgeSeconds: number,
  domain?: string | null,
): string {
  const secure = getSecureSuffix()
  const domainPart = domain ? `; Domain=${domain}` : ''
  return `${name}=${value}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}${domainPart}`
}

export function writeThirdwebSessionCookie(address?: string | null) {
  if (!isBrowser() || !address) return
  const domain = getCookieDomain()
  document.cookie = buildCookieString(
    THIRDWEB_SESSION_COOKIE,
    address,
    THIRDWEB_SESSION_TTL_SECONDS,
    domain,
  )
  notifyAuthStateChanged()
}

export function writeWalletAddressCookie(address?: string | null) {
  if (!isBrowser() || !address) return
  const domain = getCookieDomain()
  document.cookie = buildCookieString(
    WALLET_ADDRESS_COOKIE,
    address,
    WALLET_ADDRESS_TTL_SECONDS,
    domain,
  )
  notifyAuthStateChanged()
}

export function writeSessionConfirmedCookie() {
  if (!isBrowser()) return
  const domain = getCookieDomain()
  document.cookie = buildCookieString(
    SESSION_CONFIRMED_COOKIE,
    SESSION_CONFIRMED_VALUE,
    THIRDWEB_SESSION_TTL_SECONDS,
    domain,
  )
  notifyAuthStateChanged()
}

function clearCookie(name: string) {
  if (!isBrowser()) return
  const secure = getSecureSuffix()
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax${secure}`
  try {
    const host = window.location.hostname
    const parts = host.split('.')
    if (parts.length >= 2) {
      const apex = parts.slice(-2).join('.')
      document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax${secure}; Domain=.${apex}`
    }
  } catch {}
}

export function writeLoggedOutCookie() {
  if (!isBrowser()) return
  const domain = getCookieDomain()
  document.cookie = buildCookieString(
    LOGGED_OUT_COOKIE,
    LOGGED_OUT_VALUE,
    LOGGED_OUT_TTL_SECONDS,
    domain,
  )
  notifyAuthStateChanged()
}

export function clearLoggedOutCookie() {
  clearCookie(LOGGED_OUT_COOKIE)
  notifyAuthStateChanged()
}

export function clearThirdwebSessionCookie() {
  clearCookie(THIRDWEB_SESSION_COOKIE)
  clearSessionConfirmedCookie()
  notifyAuthStateChanged()
}

export function clearWalletAddressCookie() {
  clearCookie(WALLET_ADDRESS_COOKIE)
  notifyAuthStateChanged()
}

export function clearSessionConfirmedCookie() {
  clearCookie(SESSION_CONFIRMED_COOKIE)
  notifyAuthStateChanged()
}
