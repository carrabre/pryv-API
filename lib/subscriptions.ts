import {loadStripe, type Stripe} from '@stripe/stripe-js'
import {STRIPE_PK} from './constants'

type BillingPortalOptions = {
  userId?: string
  userHash?: string | null
  subscriptionId?: string
  returnUrl?: string
  configuration?: string
}

export type SubscriptionStatus =
  | {
      has_subscription: true
      status: 'active' | 'trialing' | string
      subscription_id?: string
      expires_at?: number | null
    }
  | {has_subscription: false; status: null}

export type PricesResponse = {prices: Record<string, string>}
export type CheckoutResponse = {sessionId: string; url: string}
export type PortalResponse = {url: string}

type BillingPortalPayload = {
  userId: string
  userHash?: string
  walletAddress?: string
  subscriptionId?: string
  returnUrl?: string
  configuration?: string
}

type PortalCacheEntry = {
  url?: string
  fetchedAt?: number
  inflight?: Promise<string> | null
}

const BILLING_PORTAL_CACHE_TTL_MS = 2 * 60 * 1000
const portalCache = new Map<string, PortalCacheEntry>()

async function getStripe(): Promise<Stripe> {
  if (!STRIPE_PK) {
    throw new Error('Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY')
  }
  const stripe = await loadStripe(STRIPE_PK)
  if (!stripe) throw new Error('Failed to initialize Stripe.js')
  return stripe
}

export async function fetchPrices(): Promise<Record<string, string>> {
  const res = await fetch(`/api/subscribe/prices`, {method: 'GET'})
  const data = (await res.json()) as PricesResponse | {error: string}
  if (!res.ok || 'error' in data) {
    throw new Error(('error' in data && data.error) || `HTTP ${res.status}`)
  }
  return (data as PricesResponse).prices
}

export async function ensurePriceId(preferred?: string): Promise<string> {
  if (preferred) return preferred
  const prices = await fetchPrices()
  const first = Object.values(prices)[0]
  if (!first) throw new Error('No Stripe prices configured on server')
  return first
}

export async function createCheckout(userId: string, walletAddress: string, priceId?: string) {
  if (!userId) throw new Error('userId is required')
  if (!walletAddress) throw new Error('walletAddress is required')

  const finalPriceId = await ensurePriceId(priceId)
  const res = await fetch(`/api/subscribe`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({userId, walletAddress, priceId: finalPriceId}),
  })

  const data = (await res.json()) as CheckoutResponse | {error: string; details?: string}
  if (!res.ok || 'error' in data) {
    const msg = ('error' in data && (data.details || data.error)) || `HTTP ${res.status}`
    throw new Error(msg)
  }

  // Prefer redirectToCheckout with sessionId; fallback to URL if present
  const {sessionId, url} = data as CheckoutResponse
  if (sessionId) {
    const stripe = await getStripe()
    const {error} = await stripe.redirectToCheckout({sessionId})
    if (error) throw error
  } else if (url) {
    window.location.href = url
  } else {
    throw new Error('Checkout response missing sessionId/url')
  }
}

export async function fetchSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
  if (!userId) throw new Error('userId is required')
  const res = await fetch(`/api/subscribe/status?userId=${encodeURIComponent(userId)}`, {
    method: 'GET',
    headers: {Accept: 'application/json', 'Cache-Control': 'no-store'},
    cache: 'no-store',
    credentials: 'include',
  } as RequestInit)
  const data = (await res.json()) as SubscriptionStatus | {error: string}
  if (!res.ok || 'error' in data) {
    throw new Error(('error' in data && data.error) || `HTTP ${res.status}`)
  }
  return data as SubscriptionStatus
}

export async function fetchSubscriptionDetails<T = any>(userId: string): Promise<T | null> {
  if (!userId) throw new Error('userId is required')
  const res = await fetch(`/api/subscribe/details?userId=${encodeURIComponent(userId)}`, {
    headers: {Accept: 'application/json', 'Cache-Control': 'no-store'},
    cache: 'no-store',
    credentials: 'include',
  } as RequestInit)
  if (res.status === 404) return null
  const data = (await res.json()) as T | {error: string}
  if (!res.ok || (data as any)?.error) {
    throw new Error(((data as any)?.error as string) || `HTTP ${res.status}`)
  }
  return data as T
}

export async function openBillingPortal(opts: {
  userId?: string
  userHash?: string | null
  subscriptionId?: string // pass this if IPFS storage isn’t available yet
  returnUrl?: string // defaults to the configured platform URL on the server
  configuration?: string // optional Stripe Billing Portal configuration ID
}) {
  const url = await getBillingPortalUrl(opts)
  if (!url) throw new Error('Portal response missing url')
  window.location.href = url
}

function normalizePortalPayload(opts: BillingPortalOptions): BillingPortalPayload {
  const resolvedUserId = opts.userHash || opts.userId
  if (!resolvedUserId) throw new Error('userId is required')

  const payload: BillingPortalPayload = {
    userId: resolvedUserId,
  }
  if (opts.userHash) payload.userHash = opts.userHash
  if (opts.userId) payload.walletAddress = opts.userId
  if (opts.subscriptionId) payload.subscriptionId = opts.subscriptionId
  if (opts.returnUrl) payload.returnUrl = opts.returnUrl
  if (opts.configuration) payload.configuration = opts.configuration
  return payload
}

function getPortalCacheKey(payload: BillingPortalPayload): string {
  return [
    payload.subscriptionId || '',
    payload.userHash || '',
    payload.walletAddress || '',
    payload.userId || '',
    payload.returnUrl || '',
    payload.configuration || '',
  ].join('|')
}

async function fetchPortalFromServer(payload: BillingPortalPayload): Promise<string> {
  const res = await fetch(`/api/subscribe/portal`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(payload),
    cache: 'no-store',
  })
  const text = await res.text()
  let data: PortalResponse | {error?: string; details?: string; message?: string} = {}
  try {
    data = JSON.parse(text)
  } catch {
    // ignore
  }
  if (!res.ok || (data as any).error || (data as any).message) {
    const msg =
      (data as any).details || (data as any).error || (data as any).message || `HTTP ${res.status}`
    throw new Error(msg)
  }
  const url = (data as PortalResponse).url
  if (!url) throw new Error('Portal response missing url')
  return url
}

async function ensureBillingPortalUrl(opts: BillingPortalOptions): Promise<string> {
  const payload = normalizePortalPayload(opts)
  const cacheKey = getPortalCacheKey(payload)
  const cached = portalCache.get(cacheKey)
  const now = Date.now()
  if (cached?.url && cached.fetchedAt && now - cached.fetchedAt < BILLING_PORTAL_CACHE_TTL_MS) {
    return cached.url
  }
  if (cached?.inflight) {
    return cached.inflight
  }

  const inflight = fetchPortalFromServer(payload)
    .then((url) => {
      portalCache.set(cacheKey, {url, fetchedAt: Date.now(), inflight: null})
      return url
    })
    .catch((error) => {
      const current = portalCache.get(cacheKey)
      if (current?.inflight === inflight) {
        portalCache.delete(cacheKey)
      }
      throw error
    })

  portalCache.set(cacheKey, {url: cached?.url, fetchedAt: cached?.fetchedAt, inflight})
  return inflight
}

export async function getBillingPortalUrl(opts: BillingPortalOptions): Promise<string> {
  return ensureBillingPortalUrl(opts)
}

export function prefetchBillingPortal(opts: BillingPortalOptions) {
  try {
    void ensureBillingPortalUrl(opts)
  } catch {
    // Swallow sync errors (e.g., missing user) for fire-and-forget usage
  }
}

// Optional convenience
export function isActive(status: SubscriptionStatus): boolean {
  return status.has_subscription && ['active', 'trialing'].includes(status.status)
}
