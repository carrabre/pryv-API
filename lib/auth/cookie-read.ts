import {
  LOGGED_OUT_COOKIE,
  LOGGED_OUT_VALUE,
  SESSION_CONFIRMED_COOKIE,
  SESSION_CONFIRMED_VALUE,
  THIRDWEB_SESSION_COOKIE,
  WALLET_ADDRESS_COOKIE,
} from '@/lib/auth/cookie-names'
import {isLikelyWalletAddress} from '@/lib/auth/wallet-address'

export const AUTH_STATE_CHANGED_EVENT = 'pryv-auth-state-changed'

const LOGGED_OUT_COOKIE_RE = /(?:^|;)\s*pryv-logged-out=1(?:;|$)/
const SESSION_CONFIRMED_COOKIE_RE = /(?:^|;)\s*pryv-session-confirmed=1(?:;|$)/
const THIRDWEB_SESSION_COOKIE_RE = /(?:^|;)\s*thirdweb-session=0x[^;]{40,}(?:;|$)/
const WALLET_ADDRESS_COOKIE_RE = /(?:^|;)\s*walletAddress=0x[^;]{40,}(?:;|$)/

export function normalizeWalletCookieValue(cookieValue?: string | null): string | null {
  if (!cookieValue) return null
  let decoded = cookieValue
  try {
    decoded = decodeURIComponent(cookieValue)
  } catch {
    decoded = cookieValue
  }
  const trimmed = decoded.trim()
  return isLikelyWalletAddress(trimmed) ? trimmed : null
}

export type CookieMap = Record<string, string>

export function parseCookieString(cookieString?: string | null): CookieMap {
  const result: CookieMap = {}
  if (!cookieString) return result
  const segments = cookieString.split(';')
  for (const segment of segments) {
    if (!segment) continue
    const [rawName, ...rest] = segment.split('=')
    if (!rawName) continue
    const name = rawName.trim()
    if (!name) continue
    const value = rest.join('=').trim()
    result[name] = value
  }
  return result
}

export function hasValidSessionPair(
  thirdwebValue?: string | null,
  walletValue?: string | null,
  confirmedValue?: string | null,
): boolean {
  return (
    confirmedValue === SESSION_CONFIRMED_VALUE &&
    isLikelyWalletAddress(thirdwebValue) &&
    isLikelyWalletAddress(walletValue)
  )
}

export function hasValidSessionFromCookieString(cookieString?: string | null): boolean {
  if (!cookieString) return false
  return (
    !LOGGED_OUT_COOKIE_RE.test(cookieString) &&
    SESSION_CONFIRMED_COOKIE_RE.test(cookieString) &&
    THIRDWEB_SESSION_COOKIE_RE.test(cookieString) &&
    WALLET_ADDRESS_COOKIE_RE.test(cookieString)
  )
}

export interface SessionCookieInfo {
  thirdwebAddress: string | null
  walletAddress: string | null
  hasValidPair: boolean
  isConfirmed: boolean
}

export function readSessionCookieInfo(cookieString?: string | null): SessionCookieInfo {
  if (!cookieString) {
    return {thirdwebAddress: null, walletAddress: null, hasValidPair: false, isConfirmed: false}
  }
  const parsed = parseCookieString(cookieString)
  const thirdwebValue = parsed[THIRDWEB_SESSION_COOKIE]
  const walletValue = parsed[WALLET_ADDRESS_COOKIE]
  const confirmedValue = parsed[SESSION_CONFIRMED_COOKIE]
  const loggedOut = parsed[LOGGED_OUT_COOKIE] === LOGGED_OUT_VALUE
  const normalizedThirdweb = isLikelyWalletAddress(thirdwebValue) ? thirdwebValue : null
  const normalizedWallet = isLikelyWalletAddress(walletValue) ? walletValue : null
  const isConfirmed = confirmedValue === SESSION_CONFIRMED_VALUE

  return {
    thirdwebAddress: normalizedThirdweb,
    walletAddress: normalizedWallet,
    hasValidPair: loggedOut
      ? false
      : hasValidSessionPair(thirdwebValue, walletValue, confirmedValue),
    isConfirmed,
  }
}

export function hasLoggedOutCookie(cookieString?: string | null): boolean {
  return !!cookieString && LOGGED_OUT_COOKIE_RE.test(cookieString)
}
