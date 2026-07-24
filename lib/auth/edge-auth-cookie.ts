export const PRYV_AUTH_COOKIE = 'pryv-auth'
const MAX_VERIFIED_COOKIE_CACHE_ENTRIES = 256

type ParsedAuthCookie = {
  address: string
  exp: number
}

type ParsedSignedAuthCookie = {
  subject: string
  exp: number
}

let cachedHmacKey: CryptoKey | null = null
let cachedHmacSecret: string | null = null
let cachedSecret: string | null | undefined
let verifiedCookieCacheSecret: string | null = null
const verifiedCookieCache = new Map<string, ParsedSignedAuthCookie>()
const textEncoder = new TextEncoder()

function getSecret(): string | null {
  if (cachedSecret !== undefined) return cachedSecret
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  cachedSecret = typeof secret === 'string' && secret.length >= 32 ? secret : null
  return cachedSecret
}

function utf8ToBytes(input: string): Uint8Array<ArrayBuffer> {
  return textEncoder.encode(input) as Uint8Array<ArrayBuffer>
}

function base64UrlToBinary(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  return atob(normalized + '='.repeat((4 - (normalized.length % 4)) % 4))
}

function bytesFromBase64Url(input: string): Uint8Array {
  const binary = base64UrlToBinary(input)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i)
  return out
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= (a[i] ?? 0) ^ (b[i] ?? 0)
  return diff === 0
}

async function hmacSha256(secret: string, message: string): Promise<Uint8Array> {
  const key =
    cachedHmacKey && cachedHmacSecret === secret
      ? cachedHmacKey
      : await crypto.subtle.importKey(
          'raw',
          utf8ToBytes(secret),
          {name: 'HMAC', hash: 'SHA-256'},
          false,
          ['sign'],
        )

  cachedHmacKey = key
  cachedHmacSecret = secret

  const sig = await crypto.subtle.sign('HMAC', key, utf8ToBytes(message))
  return new Uint8Array(sig)
}

async function parseAndVerifySignedAuthCookie(
  raw: string | undefined | null,
): Promise<ParsedSignedAuthCookie | null> {
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

  let subject: string
  try {
    subject = base64UrlToBinary(addrB64).trim()
  } catch {
    return null
  }
  if (!subject) return null

  let sigBytes: Uint8Array
  try {
    sigBytes = bytesFromBase64Url(sig)
  } catch {
    return null
  }

  const expected = await hmacSha256(secret, `${subject}|${exp}`)
  if (!timingSafeEqual(expected, sigBytes)) return null

  const parsed = {subject, exp}
  verifiedCookieCache.set(raw, parsed)
  if (verifiedCookieCache.size > MAX_VERIFIED_COOKIE_CACHE_ENTRIES) {
    const oldestKey = verifiedCookieCache.keys().next().value
    if (oldestKey) verifiedCookieCache.delete(oldestKey)
  }

  return parsed
}

export async function parseAndVerifyAuthCookie(
  raw: string | undefined | null,
): Promise<ParsedAuthCookie | null> {
  const parsed = await parseAndVerifySignedAuthCookie(raw)
  if (!parsed) return null
  const address = parsed.subject
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return null
  return {address, exp: parsed.exp}
}

export async function parseAndVerifyLegacyAuthCookie(
  raw: string | undefined | null,
): Promise<ParsedSignedAuthCookie | null> {
  return parseAndVerifySignedAuthCookie(raw)
}
