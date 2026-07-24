import {LOGGED_OUT_COOKIE, LOGGED_OUT_VALUE} from '@/lib/auth/cookie-names'
import {parseAndVerifyAuthCookie, PRYV_AUTH_COOKIE} from '@/lib/auth/edge-auth-cookie'

export const runtime = 'edge'

const NO_STORE_HEADERS = {'Cache-Control': 'no-store'} as const

function readSessionCookies(cookieHeader: string | null) {
  const cookies = {authCookies: [] as string[], loggedOut: false}
  if (!cookieHeader) return cookies

  let start = 0
  while (start < cookieHeader.length) {
    let end = cookieHeader.indexOf(';', start)
    if (end < 0) end = cookieHeader.length

    const separator = cookieHeader.indexOf('=', start)
    if (separator >= start && separator < end) {
      const name = cookieHeader.slice(start, separator).trim()
      if (name === PRYV_AUTH_COOKIE) {
        const value = cookieHeader.slice(separator + 1, end).trim()
        if (value) cookies.authCookies.push(value)
      } else if (name === LOGGED_OUT_COOKIE) {
        cookies.loggedOut ||= cookieHeader.slice(separator + 1, end).trim() === LOGGED_OUT_VALUE
      }
    }

    start = end + 1
  }

  return cookies
}

export async function GET(request: Request) {
  const {authCookies, loggedOut} = readSessionCookies(request.headers.get('cookie'))
  if (loggedOut) {
    return Response.json({authenticated: false, loggedOut: true}, {headers: NO_STORE_HEADERS})
  }

  for (const authCookie of authCookies) {
    const serverAuth = await parseAndVerifyAuthCookie(authCookie)
    if (serverAuth?.address) {
      return Response.json(
        {authenticated: true, address: serverAuth.address},
        {headers: NO_STORE_HEADERS},
      )
    }
  }

  return Response.json({authenticated: false}, {headers: NO_STORE_HEADERS})
}
