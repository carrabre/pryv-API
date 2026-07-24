import {buildTeeApiUrl} from '@/lib/constants'
import {atom, getDefaultStore, useAtom} from 'jotai'
import {useCallback, useEffect} from 'react'

export interface PriceDetails {
  id: string
  unit_amount: number
  currency: string
  recurring: {interval: 'month' | 'year'; interval_count: number}
  nickname?: string | null
  product?: string
}

// Helper function to parse server-preloaded price data
function getInitialPriceDetails(): Record<'basic' | 'pro', PriceDetails> | null {
  if (typeof window === 'undefined') return null
  const priceData = (window as any).__INITIAL_DATA__?.prices
  if (!priceData || typeof priceData !== 'object') return null

  // Validate that we have both basic and pro prices
  if (priceData.basic && priceData.pro) {
    return priceData as Record<'basic' | 'pro', PriceDetails>
  }

  return null
}

// Atoms for shared state across app, initialized with preloaded data
const pricesListAtom = atom<Array<{id: string; label: string}>>([])
const priceDetailsAtom = atom<Record<'basic' | 'pro', PriceDetails> | null>(
  getInitialPriceDetails(),
)
const isLoadingPricesAtom = atom<boolean>(false)

type PrimePricesPayload = {
  details?: Record<'basic' | 'pro', PriceDetails> | null
  list?: Array<{id: string; label: string}> | null
}

export function primePriceCaches(payload: PrimePricesPayload) {
  if (typeof window === 'undefined') {
    // Avoid touching client-only caches on the server
    return
  }

  const store = getDefaultStore()

  if (payload.details !== undefined) {
    store.set(priceDetailsAtom, payload.details ?? null)
  }

  if (payload.list) {
    store.set(pricesListAtom, payload.list)
  }

  store.set(isLoadingPricesAtom, false)

  // Also hydrate the lightweight fetch cache to prevent redundant network calls
  if (payload.details) {
    const url = buildTeeApiUrl('/stripe/price-details')
    if (url) {
      cache.set(url, {data: {prices: payload.details}, expiresAt: Date.now() + cacheTtlMs})
    }
  }
}

// Lightweight caches to avoid redundant fetches
const cacheTtlMs = 15 * 60_000 // 15 minutes
const cache = new Map<string, {data: any; expiresAt: number}>()
const inflight = new Map<string, Promise<any>>()

async function fetchJsonWithDedupe(url: string, options?: RequestInit) {
  const cacheKey = url
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.data

  let promise = inflight.get(cacheKey)
  if (!promise) {
    promise = fetch(url, options)
      .catch(() => {
        throw new Error('Network error while fetching prices')
      })
      .then(async (res) => {
        if (!res.ok) throw new Error(`${res.status}`)
        const data = await res.json()
        cache.set(cacheKey, {data, expiresAt: Date.now() + cacheTtlMs})
        return data
      })
      .finally(() => inflight.delete(cacheKey))
    inflight.set(cacheKey, promise)
  }
  return promise
}

async function loadPriceList(): Promise<Array<{id: string; label: string}>> {
  try {
    const data = await fetchJsonWithDedupe('/api/subscribe/prices', {
      headers: {'Cache-Control': 'no-store'},
    })
    // Support both formats
    if (Array.isArray(data?.prices)) {
      return (data.prices as any[]).map((p) =>
        typeof p === 'string' ? {id: p, label: p} : {id: p?.id, label: p?.nickname || p?.id},
      )
    }
    const entries = Object.entries<string>(data?.prices || {})
    return entries.map(([label, id]) => ({id, label}))
  } catch {
    return []
  }
}

async function loadPriceDetails(): Promise<Record<'basic' | 'pro', PriceDetails> | null> {
  const priceDetailsUrl = buildTeeApiUrl('/stripe/price-details')
  if (!priceDetailsUrl) return null
  try {
    const data = await fetchJsonWithDedupe(priceDetailsUrl, {
      headers: {'Cache-Control': 'no-store'},
    })

    const normalize = (input: any): Partial<Record<'basic' | 'pro', PriceDetails>> => {
      let basic: PriceDetails | undefined
      let pro: PriceDetails | undefined

      const tryFromEntries = (entries: Array<[string, any]>) => {
        const getByKey = (k: string) => entries.find(([key]) => key?.toLowerCase?.() === k)?.[1]
        const values = entries.map(([, v]) => v)
        const getByNickname = (needle: string) =>
          values.find((v) => (v?.nickname || '').toLowerCase().includes(needle))
        basic = getByKey('basic') || getByNickname('basic') || getByNickname('starter') || basic
        pro = getByKey('pro') || getByNickname('pro') || pro
      }

      if (Array.isArray(input)) {
        for (const v of input as any[]) {
          const nick = (v?.nickname || '').toLowerCase()
          if (!pro && nick.includes('pro')) pro = v
          if (!basic && (nick.includes('basic') || nick.includes('starter'))) basic = v
        }
      } else if (input && typeof input === 'object') {
        tryFromEntries(Object.entries(input))
      }
      const out: Partial<Record<'basic' | 'pro', PriceDetails>> = {}
      if (basic) out.basic = basic
      if (pro) out.pro = pro
      return out
    }

    const normalized = normalize((data as any)?.prices)

    const stripePricesUrl = buildTeeApiUrl('/stripe/prices')
    if ((!normalized.basic || !normalized.pro) && stripePricesUrl) {
      try {
        const pdata = await fetchJsonWithDedupe(stripePricesUrl, {
          headers: {'Cache-Control': 'no-store'},
        })
        const p = (pdata as any)?.prices || {}
        const ensure = (id: string | undefined): PriceDetails | undefined =>
          id
            ? ({
                id,
                unit_amount: 0,
                currency: 'usd',
                recurring: {interval: 'month', interval_count: 1},
              } as PriceDetails)
            : undefined
        if (!normalized.basic) normalized.basic = ensure(p.basic)
        if (!normalized.pro) normalized.pro = ensure(p.pro)
      } catch {}
    }

    return (normalized as Record<'basic' | 'pro', PriceDetails>) || null
  } catch {
    return null
  }
}

export async function prefetchPrices() {
  // Kick off both requests in parallel; errors are swallowed
  void loadPriceList()
  void loadPriceDetails()
}

export function usePrices() {
  const [priceList, setPriceList] = useAtom(pricesListAtom)
  const [details, setDetails] = useAtom(priceDetailsAtom)
  const [isLoading, setIsLoading] = useAtom(isLoadingPricesAtom)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    try {
      const [list, det] = await Promise.all([loadPriceList(), loadPriceDetails()])
      if (Array.isArray(list) && list.length) setPriceList(list)
      if (det) setDetails(det)
    } finally {
      setIsLoading(false)
    }
  }, [setPriceList, setDetails, setIsLoading])

  // Lazy load on first consumer mount if not preloaded
  useEffect(() => {
    // Only fetch if we don't have preloaded data
    const hasPreloadedData =
      typeof window !== 'undefined' && !!(window as any).__INITIAL_DATA__?.prices
    if (priceList.length === 0 && !details && !hasPreloadedData) {
      refresh()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {prices: priceList, details, isLoading, refresh}
}
