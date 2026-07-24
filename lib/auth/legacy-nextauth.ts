import {LOGGED_OUT_COOKIE, LOGGED_OUT_VALUE} from '@/lib/auth/cookie-names'
import {PRYV_AUTH_COOKIE} from '@/lib/auth/server-auth-cookie-name'

const LEGACY_NEXTAUTH_SESSION_COOKIE_NAME_RE =
  /^(?:__Secure-)?(?:authjs|next-auth)\.session-token(?:\.[^=;]*)?$/

type AuthCookieHeaderState = {
  loggedOutValue: string | null
  serverAuthCookies: string[]
  hasLegacyNextAuthCookie: boolean
}

export function readAuthCookieHeaderState(cookieHeader: string | null): AuthCookieHeaderState {
  const state: AuthCookieHeaderState = {
    loggedOutValue: null,
    serverAuthCookies: [],
    hasLegacyNextAuthCookie: false,
  }
  if (!cookieHeader) return state

  let start = 0
  while (start < cookieHeader.length) {
    let end = cookieHeader.indexOf(';', start)
    if (end < 0) end = cookieHeader.length

    const separator = cookieHeader.indexOf('=', start)
    if (separator >= start && separator < end) {
      const name = cookieHeader.slice(start, separator).trim()
      if (name === LOGGED_OUT_COOKIE) {
        const value = cookieHeader.slice(separator + 1, end).trim()
        if (value === LOGGED_OUT_VALUE) {
          state.loggedOutValue = value
        } else {
          state.loggedOutValue ??= value
        }
      } else if (name === PRYV_AUTH_COOKIE) {
        const value = cookieHeader.slice(separator + 1, end).trim()
        if (value) state.serverAuthCookies.push(value)
      } else if (
        !state.hasLegacyNextAuthCookie &&
        LEGACY_NEXTAUTH_SESSION_COOKIE_NAME_RE.test(name)
      ) {
        state.hasLegacyNextAuthCookie = true
      }
    }

    start = end + 1
  }

  return state
}
