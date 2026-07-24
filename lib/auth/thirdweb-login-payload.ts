import 'server-only'

import type {NextRequest} from 'next/server'
import type {LoginPayload} from 'thirdweb/auth'
import {getTrustedRequestOrigin} from '@/lib/auth/request-origin'
import {
  THIRDWEB_LOGIN_NONCE_TTL_SECONDS,
  THIRDWEB_LOGIN_STATEMENT,
  THIRDWEB_LOGIN_VERSION,
} from '@/lib/auth/thirdweb-login-cookie'

function createNonce() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '')
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
}

export function generateThirdwebLoginPayload({
  request,
  address,
  chainId,
}: {
  request: NextRequest
  address: string
  chainId?: number
}): LoginPayload {
  const {domain, uri} = getTrustedRequestOrigin(request)
  const now = Date.now()
  const expirationMs = THIRDWEB_LOGIN_NONCE_TTL_SECONDS * 1000

  return {
    address,
    chain_id: chainId ? chainId.toString() : undefined,
    domain,
    expiration_time: new Date(now + expirationMs).toISOString(),
    invalid_before: new Date(now - expirationMs).toISOString(),
    issued_at: new Date(now).toISOString(),
    nonce: createNonce(),
    statement: THIRDWEB_LOGIN_STATEMENT,
    uri,
    version: THIRDWEB_LOGIN_VERSION,
  }
}
