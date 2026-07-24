import {buildTeeApiUrl} from '@/lib/constants'
import type {PriceDetails} from '@/hooks/use-prices'
import {primePriceCaches} from '@/hooks/use-prices'
import type {SubscriptionData} from '@/lib/subscription/types'
import {normalizeSubscriptionResponse} from '@/lib/subscription/utils'
import {primeSubscriptionCache} from '@/hooks/use-subscription'

export interface UserDataResponse {
  has_active_subscription: boolean
  subscription?: {plan_id?: string; status?: string}
}

export type AccountPreloadResult = {
  walletAddress: string
  priceDetails: Record<'basic' | 'pro', PriceDetails> | null
  userData: UserDataResponse | null
  subscription: SubscriptionData | null
  hasSubscription: boolean | null
  fetchedAt: number
}

const CACHE_TTL_MS = 60_000
const cache = new Map<string, {data: AccountPreloadResult; expiresAt: number}>()
const inflight = new Map<string, Promise<AccountPreloadResult>>()

async function fetchPriceDetails(): Promise<Record<'basic' | 'pro', PriceDetails> | null> {
  const priceDetailsUrl = buildTeeApiUrl('/stripe/price-details')
  if (!priceDetailsUrl) return null

  try {
    const res = await fetch(priceDetailsUrl, {cache: 'no-store'})
    if (!res.ok) return null
    const data = await res.json().catch(() => null)
    const prices = (data as any)?.prices
    if (prices?.basic && prices?.pro) {
      return prices as Record<'basic' | 'pro', PriceDetails>
    }
    return null
  } catch {
    return null
  }
}

async function fetchUserData(walletAddress: string): Promise<UserDataResponse | null> {
  const url = buildTeeApiUrl(`/stripe/user-data/${encodeURIComponent(walletAddress)}`)
  if (!url) return null

  try {
    const res = await fetch(url, {cache: 'no-store'})
    if (!res.ok) return null
    return (await res.json()) as UserDataResponse
  } catch {
    return null
  }
}

async function fetchSubscription(walletAddress: string): Promise<{
  subscription: SubscriptionData | null
  hasSubscription: boolean | null
}> {
  try {
    const res = await fetch(`/api/subscribe/status?userId=${encodeURIComponent(walletAddress)}`, {
      cache: 'no-store',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-wallet-address': walletAddress,
      },
    })

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return {subscription: null, hasSubscription: false}
      }
      throw new Error(`HTTP ${res.status}`)
    }

    const data = await res.json()
    const hasSubscription =
      typeof data.has_subscription === 'boolean' ? Boolean(data.has_subscription) : null
    let subscription = normalizeSubscriptionResponse(data, walletAddress)

    if (subscription && typeof subscription.cancelAtPeriodEnd === 'undefined') {
      try {
        const detailsRes = await fetch(
          `/api/subscribe/details?userId=${encodeURIComponent(walletAddress)}`,
          {
            cache: 'no-store',
            credentials: 'include',
            headers: {Accept: 'application/json'},
          },
        )
        if (detailsRes.ok) {
          const details = await detailsRes.json().catch(() => ({}))
          subscription = {
            ...subscription,
            cancelAtPeriodEnd:
              typeof details.cancel_at_period_end === 'boolean'
                ? Boolean(details.cancel_at_period_end)
                : subscription.cancelAtPeriodEnd,
            cancelAt:
              typeof details.cancel_at !== 'undefined'
                ? Number(details.cancel_at)
                : (subscription.cancelAt ?? null),
            periodEnd:
              subscription.periodEnd ||
              (details.current_period_end
                ? Number(details.current_period_end)
                : subscription.periodEnd),
            expiresAt:
              typeof details.expires_at !== 'undefined'
                ? Number(details.expires_at)
                : (subscription.expiresAt ?? null),
          }
        }
      } catch {}
    }

    return {subscription, hasSubscription}
  } catch {
    return {subscription: null, hasSubscription: null}
  }
}

export function getCachedAccountPreload(
  walletAddress?: string | null,
): AccountPreloadResult | null {
  if (!walletAddress) return null
  const cacheKey = walletAddress.toLowerCase()
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data
  }
  return null
}

export async function preloadAccountData(
  walletAddress: string | null | undefined,
  options?: {force?: boolean},
): Promise<AccountPreloadResult | null> {
  if (typeof window === 'undefined') return null
  if (!walletAddress) return null
  const cacheKey = walletAddress.toLowerCase()

  const force = Boolean(options?.force)
  const existing = cache.get(cacheKey)
  if (!force && existing && existing.expiresAt > Date.now()) {
    return existing.data
  }

  const inflightPromise = inflight.get(cacheKey)
  if (inflightPromise) return inflightPromise

  const promise = (async (): Promise<AccountPreloadResult> => {
    const [priceDetails, userData, subscriptionResult] = await Promise.all([
      fetchPriceDetails(),
      fetchUserData(walletAddress),
      fetchSubscription(walletAddress),
    ])

    if (priceDetails) {
      primePriceCaches({details: priceDetails})
    }
    if (subscriptionResult) {
      primeSubscriptionCache({
        subscription: subscriptionResult.subscription,
        serverHasSubscription: subscriptionResult.hasSubscription,
      })
    }

    const payload: AccountPreloadResult = {
      walletAddress,
      priceDetails,
      userData,
      subscription: subscriptionResult.subscription,
      hasSubscription: subscriptionResult.hasSubscription,
      fetchedAt: Date.now(),
    }

    cache.set(cacheKey, {data: payload, expiresAt: Date.now() + CACHE_TTL_MS})
    return payload
  })()

  inflight.set(cacheKey, promise)
  try {
    return await promise
  } finally {
    inflight.delete(cacheKey)
  }
}

export function primeAccountPreloadCache(payload: AccountPreloadResult | null) {
  if (!payload?.walletAddress) return
  const cacheKey = payload.walletAddress.toLowerCase()
  const ttlExpiry = payload.fetchedAt + CACHE_TTL_MS
  const expiresAt = Math.min(ttlExpiry, Date.now() + CACHE_TTL_MS)
  cache.set(cacheKey, {data: payload, expiresAt})
}

export function clearAccountPreloadCache(walletAddress?: string | null) {
  if (!walletAddress) return
  const cacheKey = walletAddress.toLowerCase()
  cache.delete(cacheKey)
  inflight.delete(cacheKey)
}
