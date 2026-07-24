import {
  PRYV_LEGACY_AUTH_COOKIE,
  SESSION_CONFIRMED_COOKIE,
  THIRDWEB_SESSION_COOKIE,
  WALLET_ADDRESS_COOKIE,
} from '@/lib/auth/cookie-names'
import {
  WORLDAPP_WALLET_ADDRESS_COOKIE,
  WORLDCOIN_NONCE_COOKIE,
  WORLDCOIN_VERIFIED_COOKIE,
} from '@/lib/worldcoin/cookies'
import {PRYV_AUTH_COOKIE} from '@/lib/auth/server-auth-cookie-name'

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

const ALWAYS_CLEAR_SERVER_LOGOUT_COOKIE_NAMES = [
  PRYV_AUTH_COOKIE,
  PRYV_LEGACY_AUTH_COOKIE,
  'authjs.session-token',
  '__Secure-authjs.session-token',
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
]

const AUTH_COOKIE_PREFIX_RE = /^(?:__Secure-|__Host-)?(?:authjs|next-auth)\./

export function isLogoutCookieName(name: string) {
  return BASE_LOGOUT_COOKIE_NAMES.includes(name) || AUTH_COOKIE_PREFIX_RE.test(name)
}

export function isHttpOnlyLogoutCookieName(name: string) {
  return (
    name === PRYV_AUTH_COOKIE || name === PRYV_LEGACY_AUTH_COOKIE || name.includes('session-token')
  )
}

export function getLogoutCookieNames(existingCookieNames: Iterable<string> = []) {
  const names = new Set<string>()
  for (const name of ALWAYS_CLEAR_SERVER_LOGOUT_COOKIE_NAMES) {
    names.add(name)
  }
  for (const name of existingCookieNames) {
    if (isLogoutCookieName(name)) {
      names.add(name)
    }
  }
  return names
}
