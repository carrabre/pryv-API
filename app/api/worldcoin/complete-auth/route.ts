import type {MiniAppVerifyActionPayload, MiniAppWalletAuthPayload} from '@worldcoin/minikit-js'
import {AUTH_DEBUG_ENABLED, logAuthDebug} from '@/lib/server-debug'
import {
  WORLDAPP_WALLET_ADDRESS_COOKIE,
  WORLDCOIN_NONCE_COOKIE,
  WORLDCOIN_VERIFIED_COOKIE,
  WORLDCOIN_VERIFIED_TTL_SECONDS,
} from '@/lib/worldcoin/cookies'
import {deriveCookieDomainFromHostname} from '@/lib/auth/cookie-domain'
import {PROD} from '@/lib/runtime'

type CompleteAuthRequest = {
  walletPayload?: MiniAppWalletAuthPayload
  verifyPayload?: MiniAppVerifyActionPayload
  nonce?: string
}

function buildWorldcoinCookie(name: string, value: string, maxAge: number, domain?: string) {
  return `${name}=${value}; Path=/; Max-Age=${maxAge}; SameSite=Lax; HttpOnly${PROD ? '; Secure' : ''}${domain ? `; Domain=${domain}` : ''}`
}

function readCookieValue(cookieHeader: string | null, cookieName: string) {
  if (!cookieHeader) return null
  let start = 0
  while (start < cookieHeader.length) {
    let end = cookieHeader.indexOf(';', start)
    if (end < 0) end = cookieHeader.length

    const separator = cookieHeader.indexOf('=', start)
    if (separator >= start && separator < end) {
      const name = cookieHeader.slice(start, separator).trim()
      if (name === cookieName) return cookieHeader.slice(separator + 1, end).trim()
    }

    start = end + 1
  }
  return null
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CompleteAuthRequest
    const {walletPayload, verifyPayload, nonce} = body ?? {}

    if (!walletPayload || !verifyPayload || !nonce) {
      return Response.json({error: 'Missing parameters'}, {status: 400})
    }

    const storedNonce = readCookieValue(request.headers.get('cookie'), WORLDCOIN_NONCE_COOKIE)
    if (!storedNonce || storedNonce !== nonce) {
      if (AUTH_DEBUG_ENABLED) {
        logAuthDebug('worldcoin:complete-auth:nonce-mismatch', {
          storedNonce: !!storedNonce,
        })
      }
      return Response.json({error: 'Invalid nonce'}, {status: 401})
    }

    if (walletPayload.status !== 'success') {
      return Response.json({error: 'Wallet authentication failed'}, {status: 401})
    }
    if (verifyPayload.status !== 'success') {
      return Response.json(
        {error: 'World ID verification failed', code: 'invalid_proof_payload'},
        {status: 401},
      )
    }

    const {verifyWalletAuthPayload, verifyWorldcoinProof} = await import('@/lib/worldcoin/server')
    const [walletResult, proofResult] = await Promise.all([
      verifyWalletAuthPayload(walletPayload, nonce),
      verifyWorldcoinProof(verifyPayload),
    ])
    if (!walletResult.isValid || !walletResult.address) {
      return Response.json({error: 'Wallet authentication failed'}, {status: 401})
    }

    if (!proofResult.success) {
      const errorPayload: Record<string, unknown> = {
        error: 'World ID verification failed',
        code: proofResult.code,
      }
      if ('detail' in proofResult) {
        errorPayload.detail = proofResult.detail
      }
      return Response.json(errorPayload, {status: 401})
    }

    const domain = deriveCookieDomainFromHostname(new URL(request.url).hostname)

    // IMPORTANT: Do not establish a Thirdweb session from World App verification.
    // The Thirdweb (email) wallet is the only wallet that should populate
    // `thirdweb-session` / `walletAddress` and be used as the UI identity.
    const headers = new Headers()
    const appendWorldcoinCookie = (
      name: string,
      value: string,
      maxAge = WORLDCOIN_VERIFIED_TTL_SECONDS,
    ) => headers.append('Set-Cookie', buildWorldcoinCookie(name, value, maxAge, domain))
    appendWorldcoinCookie(WORLDCOIN_VERIFIED_COOKIE, '1')
    appendWorldcoinCookie(WORLDAPP_WALLET_ADDRESS_COOKIE, walletResult.address)
    appendWorldcoinCookie(WORLDCOIN_NONCE_COOKIE, '', 0)

    if (AUTH_DEBUG_ENABLED) {
      logAuthDebug('worldcoin:complete-auth:success', {
        address: walletResult.address,
      })
    }

    return Response.json({success: true}, {headers})
  } catch (error) {
    if (AUTH_DEBUG_ENABLED) {
      logAuthDebug('worldcoin:complete-auth:error', {
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    }
    return Response.json({error: 'Failed to complete Worldcoin auth'}, {status: 500})
  }
}
