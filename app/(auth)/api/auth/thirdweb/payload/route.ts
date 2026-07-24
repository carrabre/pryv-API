import type {NextRequest} from 'next/server'
import {isLikelyWalletAddress} from '@/lib/auth/wallet-address'
import {generateThirdwebLoginPayload} from '@/lib/auth/thirdweb-login-payload'
import {AUTH_DEBUG_ENABLED, logAuthDebug} from '@/lib/server-debug'
import {deriveCookieDomainFromHostname} from '@/lib/auth/cookie-domain'
import {
  appendThirdwebLoginNonceCookieValue,
  THIRDWEB_LOGIN_NONCE_COOKIE,
  THIRDWEB_LOGIN_NONCE_TTL_SECONDS,
} from '@/lib/auth/thirdweb-login-cookie'
import {PROD} from '@/lib/runtime'

const NO_STORE_HEADERS = {'Cache-Control': 'no-store'} as const

function buildLoginNonceCookie(request: NextRequest, value: string) {
  const domain = deriveCookieDomainFromHostname(request.nextUrl.hostname)
  const secure = PROD || request.nextUrl.protocol === 'https:'
  return `${THIRDWEB_LOGIN_NONCE_COOKIE}=${value}; Path=/; Max-Age=${THIRDWEB_LOGIN_NONCE_TTL_SECONDS}; SameSite=Lax; HttpOnly${secure ? '; Secure' : ''}${domain ? `; Domain=${domain}` : ''}`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const address = typeof body?.address === 'string' ? body.address.trim() : ''
    const chainIdRaw = body?.chainId
    const chainId =
      chainIdRaw === undefined || chainIdRaw === null || chainIdRaw === ''
        ? undefined
        : Number(chainIdRaw)

    if (!isLikelyWalletAddress(address)) {
      return Response.json(
        {error: 'Invalid wallet address', errorCode: 'invalid_wallet_address'},
        {status: 400, headers: NO_STORE_HEADERS},
      )
    }
    if (chainId !== undefined && (!Number.isInteger(chainId) || chainId <= 0)) {
      return Response.json(
        {error: 'Invalid chain id', errorCode: 'invalid_chain_id'},
        {status: 400, headers: NO_STORE_HEADERS},
      )
    }

    const payload = generateThirdwebLoginPayload({request, address, chainId})

    if (AUTH_DEBUG_ENABLED) {
      logAuthDebug('api:auth/thirdweb/payload:created', {
        address,
        chainId,
        nonce: payload.nonce,
      })
    }

    const nonceCookieValue = appendThirdwebLoginNonceCookieValue(
      request.cookies.get(THIRDWEB_LOGIN_NONCE_COOKIE)?.value,
      payload.nonce,
    )

    return Response.json(
      {payload},
      {
        headers: {
          'Cache-Control': 'no-store',
          'Set-Cookie': buildLoginNonceCookie(request, nonceCookieValue),
        },
      },
    )
  } catch (error) {
    if (AUTH_DEBUG_ENABLED) {
      logAuthDebug('api:auth/thirdweb/payload:error', {
        message: error instanceof Error ? error.message : String(error),
      })
    }
    return Response.json(
      {error: 'Failed to create login payload', errorCode: 'login_payload_failed'},
      {status: 500, headers: NO_STORE_HEADERS},
    )
  }
}
