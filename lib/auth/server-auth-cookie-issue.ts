import {createHmac} from 'node:crypto'
export {PRYV_AUTH_COOKIE} from '@/lib/auth/server-auth-cookie-name'

const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days
const textEncoder = new TextEncoder()
let cachedSecret: string | null | undefined

function getSecret(): string | null {
  if (cachedSecret !== undefined) return cachedSecret
  // Keep this server-only (do NOT use NEXT_PUBLIC_*).
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  cachedSecret = typeof secret === 'string' && secret.length >= 32 ? secret : null
  return cachedSecret
}

function utf8ToBytes(input: string): Uint8Array<ArrayBuffer> {
  return textEncoder.encode(input) as Uint8Array<ArrayBuffer>
}

function bytesToBase64(bytes: Uint8Array): string {
  const B = (globalThis as any).Buffer as typeof Buffer | undefined
  if (B) return B.from(bytes).toString('base64')

  // Browser/Edge runtime
  if (typeof btoa === 'function') {
    let binary = ''
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i] ?? 0)
    return btoa(binary)
  }

  throw new Error('No base64 encoder available')
}

function base64UrlFromBytes(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function hmacSha256(secret: string, message: string): Uint8Array {
  return new Uint8Array(createHmac('sha256', secret).update(message).digest())
}

export function makeAuthCookieValue(address: string, ttlSeconds = DEFAULT_TTL_SECONDS): string {
  const secret = getSecret()
  if (!secret) {
    throw new Error(
      'AUTH_SECRET (or NEXTAUTH_SECRET) must contain at least 32 characters to issue pryv-auth cookie',
    )
  }
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds
  const payload = `${address}|${exp}`
  const sigBytes = hmacSha256(secret, payload)
  return `${base64UrlFromBytes(utf8ToBytes(address))}.${exp}.${base64UrlFromBytes(sigBytes)}`
}
