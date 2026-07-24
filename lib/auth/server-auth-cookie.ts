import {createHmac} from 'node:crypto'
export {PRYV_AUTH_COOKIE} from '@/lib/auth/server-auth-cookie-name'
const MAX_VERIFIED_COOKIE_CACHE_ENTRIES = 256

type ParsedAuthCookie = {
  address: string
  exp: number
}

let verifiedCookieCacheSecret: string | null = null
let cachedSecret: string | null | undefined
const verifiedCookieCache = new Map<string, ParsedAuthCookie>()
const textDecoder = new TextDecoder()

function getSecret(): string | null {
  if (cachedSecret !== undefined) return cachedSecret
  // Keep this server-only (do NOT use NEXT_PUBLIC_*).
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  cachedSecret = typeof secret === 'string' && secret.length >= 32 ? secret : null
  return cachedSecret
}

function bytesToUtf8(bytes: Uint8Array): string {
  return textDecoder.decode(bytes)
}

function base64ToBytes(b64: string): Uint8Array {
  const B = (globalThis as any).Buffer as typeof Buffer | undefined
  if (B) return B.from(b64, 'base64')

  if (typeof atob === 'function') {
    const binary = atob(b64)
    const out = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i)
    return out
  }

  throw new Error('No base64 decoder available')
}

function bytesFromBase64Url(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/')
  const padLen = (4 - (padded.length % 4)) % 4
  const withPad = padded + '='.repeat(padLen)
  return base64ToBytes(withPad)
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= (a[i] ?? 0) ^ (b[i] ?? 0)
  return diff === 0
}

function hmacSha256(secret: string, message: string): Uint8Array {
  return new Uint8Array(createHmac('sha256', secret).update(message).digest())
}

export function parseAndVerifyAuthCookie(raw: string | undefined | null): ParsedAuthCookie | null {
  if (!raw) return null
  const secret = getSecret()
  if (!secret) return null

  const now = Math.floor(Date.now() / 1000)
  if (verifiedCookieCacheSecret !== secret) {
    verifiedCookieCacheSecret = secret
    verifiedCookieCache.clear()
  }
  const cached = verifiedCookieCache.get(raw)
  if (cached) {
    if (cached.exp > now) return cached
    verifiedCookieCache.delete(raw)
  }

  const parts = raw.split('.')
  if (parts.length !== 3) return null
  const [addrB64, expRaw, sig] = parts
  if (!addrB64 || !expRaw || !sig) return null

  const exp = Number(expRaw)
  if (!Number.isFinite(exp) || exp <= 0) return null
  if (exp <= now) return null

  let address: string
  try {
    address = bytesToUtf8(bytesFromBase64Url(addrB64)).trim()
  } catch {
    return null
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return null

  let sigBytes: Uint8Array
  try {
    sigBytes = bytesFromBase64Url(sig)
  } catch {
    return null
  }

  const expected = hmacSha256(secret, `${address}|${exp}`)
  if (!timingSafeEqual(expected, sigBytes)) return null

  const parsed = {address, exp}
  verifiedCookieCache.set(raw, parsed)
  if (verifiedCookieCache.size > MAX_VERIFIED_COOKIE_CACHE_ENTRIES) {
    const oldestKey = verifiedCookieCache.keys().next().value
    if (oldestKey) verifiedCookieCache.delete(oldestKey)
  }

  return parsed
}
