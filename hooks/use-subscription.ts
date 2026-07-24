'use client'

import {useAccount} from '@/components/account-provider'
import {DISABLE_STRIPE_LOGS, STRIPE_PK, TEE_ENCLAVE_URL} from '@/lib/constants'
import {getBillingPortalUrl} from '@/lib/subscriptions'
import {atom, getDefaultStore, useAtom} from 'jotai'
import {useCallback, useEffect, useState} from 'react'
import type {SubscriptionData} from '@/lib/subscription/types'
import {normalizeSubscriptionResponse} from '@/lib/subscription/utils'

export type {SubscriptionData} from '@/lib/subscription/types'

function sanitizeErrorMessage(message: string | undefined | null): string {
  const text = String(message || '')
  const lower = text.toLowerCase()
  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('fetch failed')
  ) {
    return 'Network error. Please try again.'
  }
  return text
}

/**
 * Subscription Hook - Stripe Only
 * Simple, reliable subscription management using Stripe as the single source of truth
 */ /** */

interface UseSubscriptionReturn {
  // Subscription state
  subscription: SubscriptionData | null
  isActive: boolean
  isLoading: boolean
  isSubsInitialized: boolean
  error: string | null

  // Actions
  createSubscription: () => Promise<void>
  createSubscriptionWithPrice: (priceId: string) => Promise<void>
  refreshSubscription: () => Promise<void>
  getPortalUrl: () => Promise<string | null>
  cancelSubscription: (mode?: 'now' | 'period_end') => Promise<void>

  // Status helpers
  hasSubscription: boolean
  statusDisplay: string
}

// Helper function to parse server-preloaded subscription data
function getInitialSubscription(): SubscriptionData | null {
  if (typeof window === 'undefined') return null
  const initial = (window as any).__INITIAL_DATA__?.subscription
  if (!initial || typeof initial !== 'object') return null

  const data = initial as any
  if (!data.status) return null

  return {
    status: data.status,
    stripeSubId: data.subscription_id || '',
    customerId: '',
    periodEnd: data.expires_at
      ? Number(data.expires_at)
      : data.current_period_end
        ? Number(data.current_period_end)
        : 0,
    priceId: data.plan_id || '',
    walletAddress: '',
    cancelAtPeriodEnd:
      typeof data.cancel_at_period_end === 'boolean'
        ? Boolean(data.cancel_at_period_end)
        : undefined,
    cancelAt: data.cancel_at ? Number(data.cancel_at) : null,
    tier:
      data.tier && ['free', 'basic', 'pro'].includes(data.tier) ? (data.tier as any) : undefined,
    uiState: data.ui_state,
    hasPendingUpdate:
      typeof data.has_pending_update === 'boolean' ? Boolean(data.has_pending_update) : undefined,
    previousPlanId: data.previous_plan_id ?? null,
    previousTier: data.previous_tier ?? null,
    planChange: data.plan_change ?? null,
    planChangedAt: data.plan_changed_at ? Number(data.plan_changed_at) : null,
    expiresAt:
      typeof data.expires_at !== 'undefined'
        ? Number(data.expires_at)
        : typeof data.current_period_end !== 'undefined'
          ? Number(data.current_period_end)
          : null,
  }
}

function getInitialServerHasSubscription(): boolean | null {
  if (typeof window === 'undefined') return null
  const initial = (window as any).__INITIAL_DATA__?.subscription
  return initial?.has_subscription ?? null
}

// Global atoms initialized with server-preloaded data for instant availability
const subscriptionAtom = atom<SubscriptionData | null>(getInitialSubscription())
const isLoadingAtom = atom<boolean>(false)
const errorAtom = atom<string | null>(null)
const serverHasSubscriptionAtom = atom<boolean | null>(getInitialServerHasSubscription())

type PrimeSubscriptionPayload = {
  subscription: SubscriptionData | null
  serverHasSubscription?: boolean | null
}

export function primeSubscriptionCache(payload: PrimeSubscriptionPayload) {
  if (typeof window === 'undefined') return

  const store = getDefaultStore()
  store.set(subscriptionAtom, payload.subscription)
  if (payload.serverHasSubscription !== undefined) {
    store.set(serverHasSubscriptionAtom, payload.serverHasSubscription)
  }
  store.set(errorAtom, null)
  store.set(isLoadingAtom, false)

  const walletAddress = payload.subscription?.walletAddress
  if (walletAddress) {
    getGlobalSubsState().lastFetchAtByWallet.set(walletAddress, Date.now())
  }
}

// Global fetch de-duplication and soft TTL to avoid redundant network calls
// NOTE: Use a window-scoped singleton so multiple bundles/instances share the same state
const GLOBAL_KEY = '__SUBS_GLOBAL_STATE__'

type GlobalSubsState = {
  inflightFetchByWallet: Map<string, Promise<void>>
  lastFetchAtByWallet: Map<string, number>
  lifecycleListenersRegistered: boolean
  storageListenerRegistered: boolean
  acceleratedPollingStarted: boolean
  cancelAcceleratedPolling: (() => void) | null
  lastFocusAtMs: number
}

function getGlobalSubsState(): GlobalSubsState {
  if (typeof window !== 'undefined') {
    const w = window as any
    if (!w[GLOBAL_KEY]) {
      w[GLOBAL_KEY] = {
        inflightFetchByWallet: new Map<string, Promise<void>>(),
        lastFetchAtByWallet: new Map<string, number>(),
        lifecycleListenersRegistered: false,
        storageListenerRegistered: false,
        acceleratedPollingStarted: false,
        cancelAcceleratedPolling: null,
        lastFocusAtMs: 0,
      } as GlobalSubsState
    }
    return w[GLOBAL_KEY] as GlobalSubsState
  }
  // SSR fallback (shouldn't be used by this client hook)
  return {
    inflightFetchByWallet: new Map<string, Promise<void>>(),
    lastFetchAtByWallet: new Map<string, number>(),
    lifecycleListenersRegistered: false,
    storageListenerRegistered: false,
    acceleratedPollingStarted: false,
    cancelAcceleratedPolling: null,
    lastFocusAtMs: 0,
  }
}

// Soft TTLs
const MIN_STATUS_REFRESH_MS = 60000 // 60s TTL for status checks (was 30s)
const CHECKOUT_POLL_WINDOW_MS = 10 * 60 * 1000 // 10 minutes window to bypass TTL during checkout polling
// New: Short burst guard to prevent sub-second duplicate requests even when force=true
const MIN_BURST_GUARD_MS = 3000 // 3s

// One-time guards to avoid duplicate listeners/pollers across multiple hook instances
// (moved into window-scoped global)
// consts removed in favor of getGlobalSubsState()
// let globalLifecycleListenersRegistered = false
// let globalStorageListenerRegistered = false
// let acceleratedPollingStartedOnce = false
// let cancelAcceleratedPollingOnce: (() => void) | null = null

// LocalStorage keys for coordinating post-checkout refresh across tabs
const CHECKOUT_PENDING_KEY = 'stripeCheckoutPending'
const CHECKOUT_STARTED_AT_KEY = 'stripeCheckoutStartedAt'

export function useSubscription(): UseSubscriptionReturn {
  const {
    isAuthenticated,
    account: user,
    isConnecting: authLoading,
    user: userData,
    userHash,
    sessionWalletAddress,
  } = useAccount()

  const [subscription, setSubscription] = useAtom(subscriptionAtom)
  const [isLoading, setIsLoading] = useAtom(isLoadingAtom)
  const [error, setError] = useAtom(errorAtom)
  const [serverHasSubscription, setServerHasSubscription] = useAtom(serverHasSubscriptionAtom)

  // Start initialized if we have preloaded data, otherwise wait for first fetch
  const [isInitialized, setIsInitialized] = useState(
    typeof window !== 'undefined' && !!(window as any).__INITIAL_DATA__?.subscription,
  )

  useEffect(() => {
    if (!isInitialized && (subscription !== null || serverHasSubscription !== null)) {
      setIsInitialized(true)
    }
  }, [isInitialized, subscription, serverHasSubscription])

  // Extract wallet address from user object or session fallback
  const walletAddress = user?.address ?? sessionWalletAddress ?? null
  const isBillingConfigured = Boolean(TEE_ENCLAVE_URL)

  // Prime TTL cache on mount if we have preloaded data
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      (window as any).__INITIAL_DATA__?.subscription &&
      walletAddress
    ) {
      getGlobalSubsState().lastFetchAtByWallet.set(walletAddress, Date.now())
    }
  }, [walletAddress])

  if (!DISABLE_STRIPE_LOGS) {
  }

  /**
   * Fetch subscription from Stripe API
   */
  const fetchSubscription = useCallback(
    async (options?: {force?: boolean}) => {
      const force = Boolean(options?.force)
      // If auth is still reconnecting (e.g., tab was idle), avoid clearing
      // the last-known subscription state to prevent flashing the UI icon.
      if (authLoading) {
        setIsInitialized(true)
        return
      }

      // If we are unauthenticated or missing wallet address, clear state
      if (!walletAddress) {
        setSubscription(null)
        setServerHasSubscription(null)
        setIsInitialized(true)
        return
      }

      if (!isBillingConfigured) {
        // In development without a billing server, treat as no subscription
        setSubscription(null)
        setServerHasSubscription(false)
        setIsInitialized(true)
        return
      }

      // De-dupe concurrent calls and throttle repeated refreshes
      const currentWallet = walletAddress
      const globals = getGlobalSubsState()
      const inflight = currentWallet ? globals.inflightFetchByWallet.get(currentWallet) : undefined
      if (inflight) {
        await inflight
        setIsInitialized(true)
        return
      }
      if (currentWallet) {
        // Allow fast polling if we're in the checkout pending window
        let bypassTTL = false
        try {
          const pending =
            typeof window !== 'undefined' &&
            window.localStorage &&
            localStorage.getItem(CHECKOUT_PENDING_KEY) === 'true'
          const startedAt = Number(
            (typeof window !== 'undefined' &&
              window.localStorage &&
              localStorage.getItem(CHECKOUT_STARTED_AT_KEY)) ||
              '0',
          )
          const onBillingPage =
            typeof window !== 'undefined' &&
            window.location &&
            window.location.pathname.startsWith('/account')
          bypassTTL = Boolean(
            pending &&
              onBillingPage &&
              startedAt &&
              Date.now() - startedAt < CHECKOUT_POLL_WINDOW_MS,
          )
        } catch {}

        const lastAt = globals.lastFetchAtByWallet.get(currentWallet) || 0
        // Apply 60s TTL when not forced and not in checkout polling window
        if (!force && !bypassTTL && Date.now() - lastAt < MIN_STATUS_REFRESH_MS) {
          setIsInitialized(true)
          return
        }
        // Apply a short burst guard even when forcing (unless very first time with no lastAt)
        if (lastAt > 0 && Date.now() - lastAt < MIN_BURST_GUARD_MS) {
          setIsInitialized(true)
          return
        }
      }

      const performFetch = async () => {
        try {
          setIsLoading(true)
          setError(null)

          const url = `/api/subscribe/status?userId=${encodeURIComponent(walletAddress)}`

          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              'Cache-Control': 'no-store',
              'x-wallet-address': walletAddress,
            },
            cache: 'no-store',
            credentials: 'include',
          })

          if (!response.ok) {
            // Gracefully handle unauthorized/forbidden as "no subscription" without error noise
            if (response.status === 401 || response.status === 403) {
              setSubscription(null)
              setServerHasSubscription(false)
              return
            }
            const errorData = await response.text().catch(() => '')
            throw new Error(errorData || `HTTP ${response.status}`)
          }

          const data = await response.json()

          // Keep the raw has_subscription for accurate gating
          if (typeof data.has_subscription === 'boolean')
            setServerHasSubscription(data.has_subscription)

          const baseSub = normalizeSubscriptionResponse(data, walletAddress)
          // Optionally enrich with details if cancel flags are missing
          const needsDetails = Boolean(baseSub && typeof baseSub.cancelAtPeriodEnd === 'undefined')
          if (baseSub && needsDetails) {
            try {
              const detailsRes = await fetch(
                `/api/subscribe/details?userId=${encodeURIComponent(walletAddress)}`,
                {
                  headers: {Accept: 'application/json', 'Cache-Control': 'no-store'},
                  cache: 'no-store',
                  credentials: 'include',
                },
              )
              if (detailsRes.ok) {
                const details = await detailsRes.json().catch(() => ({}) as any)
                const cancelAtPeriodEnd =
                  typeof details.cancel_at_period_end === 'boolean'
                    ? Boolean(details.cancel_at_period_end)
                    : undefined
                const cancelAt = details.cancel_at ? Number(details.cancel_at) : null
                const periodEnd =
                  baseSub.periodEnd ||
                  (details.current_period_end ? Number(details.current_period_end) : 0)
                setSubscription({...baseSub, cancelAtPeriodEnd, cancelAt, periodEnd})
              } else {
                setSubscription(baseSub)
              }
            } catch {
              setSubscription(baseSub)
            }
          } else if (baseSub) {
            setSubscription(baseSub)
          } else {
            setSubscription(null)
          }
        } catch (err: any) {
          // Preserve last-known state on transient errors; surface error for UI
          setError(sanitizeErrorMessage(err?.message))
          // Do not clear subscription/serverHasSubscription here to avoid flashing "not active"
        } finally {
          setIsLoading(false)
          setIsInitialized(true)
          if (currentWallet) getGlobalSubsState().lastFetchAtByWallet.set(currentWallet, Date.now())
        }
      }

      // Reserve the fetch slot early to avoid bursts across multiple instances
      const globalsBefore = getGlobalSubsState()
      if (currentWallet) {
        globalsBefore.lastFetchAtByWallet.set(currentWallet, Date.now())
      }

      const p = performFetch()
      if (currentWallet) getGlobalSubsState().inflightFetchByWallet.set(currentWallet, p)
      try {
        await p
      } finally {
        if (currentWallet) getGlobalSubsState().inflightFetchByWallet.delete(currentWallet)
      }
    },
    [isAuthenticated, walletAddress, authLoading, isBillingConfigured],
  )

  const createCheckout = useCallback(
    async (priceId?: string) => {
      if (!isAuthenticated || !walletAddress) {
        throw new Error('Please connect your wallet first')
      }
      if (!userHash) {
        throw new Error('Wallet authentication is still in progress. Please try again.')
      }
      if (!isBillingConfigured) {
        throw new Error('Billing server not configured')
      }

      try {
        setIsLoading(true)
        setError(null)

        // Mark checkout as pending for accelerated refresh on return
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.setItem(CHECKOUT_PENDING_KEY, 'true')
            localStorage.setItem(CHECKOUT_STARTED_AT_KEY, String(Date.now()))
          }
        } catch {}

        // Auto-fetch a price if none provided and no default is set
        let finalPriceId = priceId || process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO
        if (!finalPriceId) {
          try {
            const res = await fetch(`/api/subscribe/prices`)
            if (res.ok) {
              const data = await res.json()
              // Support both formats: array and object map
              if (Array.isArray(data.prices)) {
                const first = data.prices[0]
                finalPriceId = typeof first === 'string' ? first : first?.id
              } else if (data.prices && typeof data.prices === 'object') {
                finalPriceId =
                  (data.prices.basic as string) || (Object.values(data.prices)[0] as string)
              }
            }
          } catch {}
        }

        if (!finalPriceId) {
          throw new Error(
            'No Stripe price configured. Set NEXT_PUBLIC_STRIPE_PRICE_ID_PRO or configure /stripe/prices on the server.',
          )
        }

        const url = `/api/subscribe`
        const body = {userId: userHash, walletAddress, priceId: finalPriceId}

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-wallet-address': walletAddress,
          },
          body: JSON.stringify(body),
        })

        const text = await response.text()
        if (!response.ok) {
          throw new Error(text || 'Failed to create checkout session')
        }

        let sessionId: string | undefined
        let checkoutUrl: string | undefined
        try {
          const json = JSON.parse(text)
          sessionId = json.sessionId
          checkoutUrl = json.url || json.checkoutUrl
        } catch {
          // ignore parse error; server might be plain text
        }

        if (sessionId && typeof window !== 'undefined' && STRIPE_PK && (window as any).Stripe) {
          const stripe = (window as any).Stripe(STRIPE_PK)
          const {error} = await stripe.redirectToCheckout({sessionId})
          if (error) throw error
          return
        }

        if (checkoutUrl) {
          window.location.href = checkoutUrl
          return
        }

        throw new Error('Backend did not return sessionId or url')
      } catch (err: any) {
        setError(sanitizeErrorMessage(err?.message))
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [isAuthenticated, walletAddress, isBillingConfigured, userHash],
  )

  const createSubscription = useCallback(async () => createCheckout(), [createCheckout])
  const createSubscriptionWithPrice = useCallback(
    async (priceId: string) => createCheckout(priceId),
    [createCheckout],
  )

  const getPortalUrl = useCallback(async (): Promise<string | null> => {
    if (!isAuthenticated || !walletAddress) return null
    if (!isBillingConfigured) return null

    try {
      const url = await getBillingPortalUrl(
        subscription?.stripeSubId
          ? {userId: walletAddress, subscriptionId: subscription.stripeSubId, userHash}
          : {userId: walletAddress, userHash},
      )
      return url || null
    } catch {
      return null
    }
  }, [isAuthenticated, walletAddress, isBillingConfigured, subscription?.stripeSubId, userHash])

  const cancelSubscription = useCallback(
    async (mode: 'now' | 'period_end' = 'period_end') => {
      if (!isAuthenticated || !walletAddress) throw new Error('Please connect your wallet first')
      if (!isBillingConfigured) throw new Error('Billing server not configured')
      try {
        setIsLoading(true)
        setError(null)
        const res = await fetch(`/api/subscribe/cancel`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({userId: walletAddress, mode}),
        })
        const text = await res.text()
        if (!res.ok) {
          setError(sanitizeErrorMessage(text))
          throw new Error(text || 'Failed to cancel subscription')
        }
        await fetchSubscription({force: true})
      } finally {
        setIsLoading(false)
      }
    },
    [isAuthenticated, walletAddress, fetchSubscription, isBillingConfigured],
  )

  /**
   * Refresh subscription data
   */
  const refreshSubscription = useCallback(async () => {
    await fetchSubscription({force: true})
  }, [fetchSubscription])

  // Auto-fetch subscription when auth state changes
  useEffect(() => {
    fetchSubscription()
  }, [fetchSubscription])

  // Refresh when user returns to the tab or window regains focus (e.g., after Stripe portal)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const globals = getGlobalSubsState()
    if (globals.lifecycleListenersRegistered) return
    globals.lifecycleListenersRegistered = true

    // Debounce focus/visibility triggers within 3s to prevent bursts (shared across instances)
    const onFocus = () => {
      const now = Date.now()
      if (now - getGlobalSubsState().lastFocusAtMs < 3000) return
      getGlobalSubsState().lastFocusAtMs = now
      // Respect TTL; don't force to avoid redundant requests when many components mount
      fetchSubscription()
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    // Intentionally no cleanup to keep a single global listener for the lifetime of the app
  }, [fetchSubscription])

  // Start accelerated polling if we detect a recent checkout redirect
  useEffect(() => {
    if (typeof window === 'undefined') return

    const MAX_WINDOW_MS = 10 * 60 * 1000 // 10 minutes
    // Poll conservatively to reduce server load (>=60s intervals)
    const FAST_PHASE = {intervalMs: 60_000, repeats: 2} // 2 minutes
    const MED_PHASE = {intervalMs: 60_000, repeats: 3} // 3 minutes
    const SLOW_PHASE = {intervalMs: 90_000, repeats: 4} // 6 minutes (was 5x60s)

    function shouldRun(): boolean {
      try {
        const pending = localStorage.getItem(CHECKOUT_PENDING_KEY) === 'true'
        const startedAt = Number(localStorage.getItem(CHECKOUT_STARTED_AT_KEY) || '0')
        const onBillingPage =
          typeof window !== 'undefined' &&
          window.location &&
          window.location.pathname.startsWith('/account')
        if (!pending) return false
        if (!onBillingPage) return false
        if (!startedAt) return false
        if (Date.now() - startedAt > MAX_WINDOW_MS) return false
        return true
      } catch {
        return false
      }
    }

    // Ensure only one global accelerated poller runs across all hook instances
    const globals = getGlobalSubsState()
    if (globals.acceleratedPollingStarted) return
    if (!shouldRun()) return
    globals.acceleratedPollingStarted = true

    let cancelled = false
    const cancel = () => {
      cancelled = true
      getGlobalSubsState().acceleratedPollingStarted = false
    }
    getGlobalSubsState().cancelAcceleratedPolling = cancel

    const runPhase = async (intervalMs: number, repeats: number) => {
      for (let i = 0; i < repeats; i++) {
        if (cancelled) return
        await fetchSubscription({force: true})
        // Stop early if we became active
        if (subscription?.status === 'active' || subscription?.status === 'trialing') return
        await new Promise((r) => setTimeout(r, intervalMs))
      }
    }
    ;(async () => {
      try {
        await runPhase(FAST_PHASE.intervalMs, FAST_PHASE.repeats)
        if (cancelled) return
        await runPhase(MED_PHASE.intervalMs, MED_PHASE.repeats)
        if (cancelled) return
        await runPhase(SLOW_PHASE.intervalMs, SLOW_PHASE.repeats)
      } finally {
        getGlobalSubsState().acceleratedPollingStarted = false
      }
    })()

    return cancel
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchSubscription, subscription?.status])

  // Clear pending flag as soon as we detect an active subscription
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (subscription?.status === 'active' || subscription?.status === 'trialing') {
      try {
        localStorage.removeItem(CHECKOUT_PENDING_KEY)
        localStorage.removeItem(CHECKOUT_STARTED_AT_KEY)
        // Also stop any global accelerated poller if running
        getGlobalSubsState().cancelAcceleratedPolling?.()
      } catch {}
    }
  }, [subscription?.status])

  // Also listen to storage events to start/stop polling across tabs
  useEffect(() => {
    if (typeof window === 'undefined') return
    const globals = getGlobalSubsState()
    if (globals.storageListenerRegistered) return
    globals.storageListenerRegistered = true
    const onStorage = (e: StorageEvent) => {
      if (e.key === CHECKOUT_PENDING_KEY || e.key === CHECKOUT_STARTED_AT_KEY) {
        // Trigger a refresh immediately and allow the effect above to start polling if needed
        fetchSubscription({force: true})
      }
    }
    window.addEventListener('storage', onStorage)
    // Intentionally no cleanup: keep a single listener for the lifetime of the app
  }, [fetchSubscription])

  // Detect Stripe return in URL and trigger instant refresh (works for pricing-table redirects)
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const url = new URL(window.location.href)
      const hasStripeParam =
        url.searchParams.has('session_id') ||
        url.searchParams.has('checkout_session_id') ||
        url.searchParams.has('stripe_session_id') ||
        url.searchParams.get('success') === 'true' ||
        url.searchParams.get('subscription') === 'updated'

      if (hasStripeParam) {
        try {
          localStorage.setItem(CHECKOUT_PENDING_KEY, 'true')
          localStorage.setItem(CHECKOUT_STARTED_AT_KEY, String(Date.now()))
        } catch {}
        // Force immediate refresh
        fetchSubscription({force: true})
        // Clean URL to avoid repeated triggers
        url.search = ''
        window.history.replaceState({}, document.title, url.toString())
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Computed values - check BOTH Stripe status AND user tier for single source of truth
  const stripeHasSubscription = Boolean(
    subscription && (subscription.status === 'active' || subscription.status === 'trialing'),
  )
  const hasPaidTier = userData?.tier === 'basic' || userData?.tier === 'pro'

  // User has subscription if EITHER Stripe says so OR they have a paid tier assigned
  const hasSubscription = stripeHasSubscription || hasPaidTier
  const isActive = hasSubscription

  // Status display: prefer Stripe data, fallback to tier
  const statusDisplay = subscription
    ? `${subscription.status}${subscription.cancelAtPeriodEnd ? ' (cancels at period end)' : ''}`
    : hasPaidTier
      ? `${userData?.tier?.charAt(0).toUpperCase()}${userData?.tier?.slice(1)}`
      : 'No subscription'

  return {
    // State
    subscription,
    isActive,
    isLoading,
    isSubsInitialized: isInitialized,
    error,

    // Actions
    createSubscription,
    createSubscriptionWithPrice,
    refreshSubscription,
    getPortalUrl,
    cancelSubscription,

    // Helpers
    hasSubscription,
    statusDisplay,
  }
}
