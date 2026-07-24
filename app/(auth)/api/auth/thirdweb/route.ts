import type {NextRequest} from 'next/server'
import {LOGGED_OUT_VALUE} from '@/lib/auth/cookie-names'
import {parseAndVerifyAuthCookie} from '@/lib/auth/server-auth-cookie'
import {readAuthCookieHeaderState} from '@/lib/auth/legacy-nextauth'

const NO_STORE_HEADERS = {'Cache-Control': 'no-store'} as const

export async function POST(request: NextRequest) {
  const {POST: handlePost} = await import('./mutations')
  return handlePost(request)
}

export async function GET(request: NextRequest) {
  const cookieHeader = request.headers.get('cookie')
  const authCookieState = readAuthCookieHeaderState(cookieHeader)
  const loggedOut = authCookieState.loggedOutValue === LOGGED_OUT_VALUE
  if (loggedOut) {
    return Response.json({authenticated: false, loggedOut: true}, {headers: NO_STORE_HEADERS})
  }
  for (const authCookie of authCookieState.serverAuthCookies) {
    const serverAuth = parseAndVerifyAuthCookie(authCookie)
    if (serverAuth?.address) {
      return Response.json(
        {authenticated: true, address: serverAuth.address},
        {headers: NO_STORE_HEADERS},
      )
    }
  }

  // Fall back to NextAuth if available (legacy accounts)
  if (authCookieState.hasLegacyNextAuthCookie) {
    try {
      const {getLegacyNextAuthSession} = await import('@/lib/auth/legacy-nextauth-session')
      const session = await getLegacyNextAuthSession()
      if (session?.user?.id) {
        return Response.json(
          {authenticated: true, address: session.user.id},
          {headers: NO_STORE_HEADERS},
        )
      }
    } catch {
      // ignore
    }
  }

  return Response.json({authenticated: false}, {headers: NO_STORE_HEADERS})
}

export async function DELETE(request: NextRequest) {
  const {DELETE: handleDelete} = await import('./mutations')
  return handleDelete(request)
}
