'use client'

import type {ModelId} from '@/lib/ai/models'
import {buildTeeApiUrl} from '@/lib/constants'
import {generateUuid} from '@/lib/utils'
import {atom, getDefaultStore, useAtom} from 'jotai'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {useActiveAccount, useActiveWallet, useIsAutoConnecting} from 'thirdweb/react'
import type {Account, Wallet, WalletId} from 'thirdweb/wallets'
import {logAuthDebug} from '@/lib/debug'
import {useMiniApp} from '@/hooks/use-mini-app'
import {getCachedAccountPreload, preloadAccountData} from '@/lib/account/preload'
import {cacheUserHash, getCachedUserHash} from '@/lib/auth/user-hash-cache'
import {
  writeWalletAddressCookie,
  clearWalletAddressCookie,
  isLikelyWalletAddress,
} from '@/lib/auth/cookies'
import {
  readSessionCookieInfo,
  hasLoggedOutCookie,
  AUTH_STATE_CHANGED_EVENT,
} from '@/lib/auth/cookie-read'
import {getClientAuthSessionStatus} from '@/lib/auth/client-session-status'

type AuthStatus = 'signed-out' | 'session' | 'wallet'

interface AccountContext {
  userHash: string | null
  user: User | null
  account: Account | null
  wallet: Wallet<WalletId> | null
  walletAddressDisplayString: string
  walletAddressDisplayStringLong: string
  isConnecting: boolean
  isAuthenticated: boolean
  isWalletReady: boolean
  authStatus: AuthStatus
  hasSessionCookie: boolean
  sessionWalletAddress: string | null
  refreshUser: () => Promise<void>
}

export interface User {
  tier: 'free' | 'basic' | 'pro'
  requestsLeft: Record<ModelId, number>
  // New: spending/limit tracking fields from backend
  usdSpentInPeriod?: number
  maxUsdSpent?: number
  usdLeftInPeriod?: number
  timeUntilReset?: number
  daysUntilReset?: number
}

const AccountContext = createContext<AccountContext | null>(null)
export const modelPromptsLeftAtom = atom<Record<ModelId, number> | null>(null)

let setUserExternal: ((user: User | null) => void) | null = null

export function primeAccountUser(user: User | null) {
  if (typeof window === 'undefined') return

  setUserExternal?.(user)

  const store = getDefaultStore()
  store.set(modelPromptsLeftAtom, user?.requestsLeft ?? null)

  try {
    const win = window as any
    win.__INITIAL_DATA__ = {
      ...(win.__INITIAL_DATA__ ?? {}),
      user,
    }
  } catch {
    // ignore
  }
}

export function useAccount() {
  const context = useContext(AccountContext)
  if (context == null) {
    throw 'useAccount must be used within a AccountProvider.'
  }

  return context
}

// Helper function to parse server-preloaded user data
function getInitialUser(): User | null {
  if (typeof window === 'undefined') return null
  const userData = (window as any).__INITIAL_DATA__?.user
  if (!userData) return null

  return {
    tier: userData.tier || 'free',
    requestsLeft: userData.requestsLeft || {},
    usdSpentInPeriod: userData.usdSpentInPeriod,
    maxUsdSpent: userData.maxUsdSpent,
    usdLeftInPeriod: userData.usdLeftInPeriod,
    timeUntilReset: userData.timeUntilReset,
    daysUntilReset: userData.daysUntilReset,
  }
}

function getInitialSessionWallet(): string | null {
  if (typeof window === 'undefined') return null

  try {
    const initial = (window as any).__INITIAL_DATA__?.walletAddress
    if (typeof initial === 'string' && isLikelyWalletAddress(initial)) {
      return initial
    }
  } catch {
    // ignore
  }

  try {
    const info = readSessionCookieInfo(document.cookie)
    if (info.hasValidPair && info.walletAddress) {
      return info.walletAddress
    }
  } catch {
    // ignore cookie parse failures
  }
  return null
}

export function AccountProvider({children}: {children: ReactNode}) {
  const _isAutoConnecting = useIsAutoConnecting()
  const account = useActiveAccount()
  const wallet = useActiveWallet()
  const {isMiniApp} = useMiniApp()

  const [userHash, setUserHash] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(getInitialUser())
  const [_, setModelPromptsLeft] = useAtom(modelPromptsLeftAtom)
  const [sessionWalletAddress, setSessionWalletAddress] = useState<string | null>(
    getInitialSessionWallet,
  )
  const [hasSessionCookie, setHasSessionCookie] = useState<boolean>(
    () => sessionWalletAddress != null,
  )
  const [isLoggedOut, setIsLoggedOut] = useState<boolean>(() => {
    if (typeof document === 'undefined') return false
    return hasLoggedOutCookie(document.cookie)
  })
  const hasRecordedSessionMark = useRef(false)
  const hasRecordedWalletMark = useRef(false)

  useEffect(() => {
    setUserExternal = setUser
    return () => {
      if (setUserExternal === setUser) {
        setUserExternal = null
      }
    }
  }, [setUser])

  // Initialize model prompts left from preloaded data
  useEffect(() => {
    const initialUser = getInitialUser()
    if (initialUser?.requestsLeft) {
      setModelPromptsLeft(initialUser.requestsLeft)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Ignore the first value from useIsAutoConnecting,
  // because it is `false` until <AutoConnect /> kicks in.
  const [isConnecting, setIsConnecting] = useState(true)
  const hasSeenFirstValue = useRef(false)
  const lastPreloadedWalletRef = useRef<string | null>(null)
  useEffect(() => {
    if (!hasSeenFirstValue.current) {
      hasSeenFirstValue.current = true
      return
    }
    if (userHash) {
      setIsConnecting(_isAutoConnecting)
      logAuthDebug('account-provider:auto-connecting-flag', {
        isAutoConnecting: _isAutoConnecting,
        hasUserHash: !!userHash,
      })
    }
  }, [_isAutoConnecting, userHash])

  // World App (mini app) identity must come from the Thirdweb wallet only.
  // Avoid showing or treating cookie-derived addresses as the active wallet in mini app mode.
  const effectiveWalletAddress = isLoggedOut
    ? null
    : (account?.address ?? (isMiniApp ? null : sessionWalletAddress) ?? null)
  const displayWalletAddress =
    effectiveWalletAddress ?? (isLoggedOut ? null : sessionWalletAddress) ?? null

  const walletAddressDisplayString = useMemo(() => {
    if (displayWalletAddress) {
      return `${displayWalletAddress.slice(0, 6)}...${displayWalletAddress.slice(-4)}`
    }
    if (isMiniApp) return 'Sign in with email'
    if (hasSessionCookie) return 'Restoring wallet…'
    return 'Connect wallet'
  }, [displayWalletAddress, hasSessionCookie, isMiniApp])

  const walletAddressDisplayStringLong = useMemo(() => {
    if (displayWalletAddress) {
      return `${displayWalletAddress.slice(0, 18)}...${displayWalletAddress.slice(-4)}`
    }
    if (isMiniApp) return 'Sign in with email'
    if (hasSessionCookie) return 'Restoring wallet…'
    return 'Connect wallet'
  }, [displayWalletAddress, hasSessionCookie, isMiniApp])

  const isWalletReady = !isLoggedOut && !!account
  const hasSessionAuth = !isLoggedOut && !!sessionWalletAddress
  const authStatus: AuthStatus = isLoggedOut
    ? 'signed-out'
    : isWalletReady
      ? 'wallet'
      : hasSessionAuth
        ? 'session'
        : 'signed-out'
  const isAuthenticated = authStatus !== 'signed-out'

  useEffect(() => {
    if (!isLoggedOut) return
    setUserHash(null)
    setUser(null)
    setModelPromptsLeft(null)
  }, [isLoggedOut, setModelPromptsLeft])

  useEffect(() => {
    if (typeof performance === 'undefined') return
    if (!hasSessionCookie || hasRecordedSessionMark.current) return
    hasRecordedSessionMark.current = true
    try {
      performance.mark('auth_session_cookie_detected')
    } catch {}
  }, [hasSessionCookie])

  useEffect(() => {
    if (typeof performance === 'undefined') return
    if (!account?.address || hasRecordedWalletMark.current) return
    hasRecordedWalletMark.current = true
    try {
      performance.mark('auth_wallet_hydrated')
      performance.measure(
        'auth_session_to_wallet',
        'auth_session_cookie_detected',
        'auth_wallet_hydrated',
      )
    } catch {}
  }, [account?.address])

  const fetchUser = useCallback(async () => {
    if (userHash == null) return

    logAuthDebug('account-provider:fetch-user:start', {userHash})
    const userUrl = buildTeeApiUrl('/user', {userHash})
    if (!userUrl) return

    try {
      const res = await fetch(userUrl, {cache: 'no-store'})
      const data = await res.json()

      if (res.ok) {
        setUser(data.user)
        setModelPromptsLeft(data.user.requestsLeft)
        logAuthDebug('account-provider:fetch-user:success', {
          tier: data.user?.tier,
          requestsLeft: data.user?.requestsLeft,
        })
      } else {
        logAuthDebug('account-provider:fetch-user:error', {
          status: res.status,
          body: data,
        })
      }
    } catch {
      logAuthDebug('account-provider:fetch-user:network-error')
    }
  }, [userHash])

  useEffect(() => {
    ;(async () => {
      if (account == null) return
      if (isLoggedOut) return
      if (userHash) return

      const cached = getCachedUserHash(account.address)
      if (cached) {
        logAuthDebug('account-provider:user-hash-cache-hit', {
          address: account.address,
          cachedLength: cached.length,
        })
        setUserHash(cached)
        return
      }

      try {
        logAuthDebug('account-provider:account-detected', {address: account.address})
        const userHashMessage = `Retrieve My User Hash. UUID: ${generateUuid()}`

        const signature = await account.signMessage({message: userHashMessage})

        logAuthDebug('account-provider:user-hash-signature-info', {
          signatureLength: signature.length,
          walletType: signature.length > 200 ? 'Smart Wallet' : 'EOA Wallet',
          signature: `${signature.slice(0, 66)}...`,
        })

        const userHashUrl = buildTeeApiUrl('/user-hash', {
          walletAddress: account.address,
          message: userHashMessage,
          signature,
        })
        if (!userHashUrl) {
          return
        }

        const res = await fetch(userHashUrl)

        const data = await res.json()

        logAuthDebug('account-provider:user-hash-received', {
          walletAddress: account.address,
          userHash: data.userHash,
          userHashLength: data.userHash?.length,
        })

        setUserHash(data.userHash)
        cacheUserHash(account.address, data.userHash)
        logAuthDebug('account-provider:set-user-hash', {userHash: data.userHash})
      } catch {
        logAuthDebug('account-provider:user-hash-error')
      }
    })()
  }, [account, isLoggedOut, userHash])

  // Persist wallet address for server-side subscription prefetch
  useEffect(() => {
    try {
      if (isLoggedOut) {
        clearWalletAddressCookie()
        setSessionWalletAddress(null)
        setHasSessionCookie(false)
        logAuthDebug('account-provider:wallet-cookie-skipped', {reason: 'logged-out'})
        return
      }
      if (account?.address) {
        writeWalletAddressCookie(account.address)
        setSessionWalletAddress(account.address)
        setHasSessionCookie(true)
        logAuthDebug('account-provider:wallet-cookie-set', {address: account.address})
      } else if (!hasSessionCookie) {
        // If we already have a valid session cookie pair, don't clear it just because
        // the Thirdweb wallet hasn't hydrated / connected yet.
        clearWalletAddressCookie()
        logAuthDebug('account-provider:wallet-cookie-cleared')
      }
    } catch {}
  }, [account?.address, hasSessionCookie, isLoggedOut])

  useEffect(() => {
    if (typeof window === 'undefined') return
    let cancelled = false
    let refreshInFlight = false

    const refreshServerSession = async () => {
      if (!isMiniApp || account?.address || refreshInFlight) return
      if (typeof document !== 'undefined' && hasLoggedOutCookie(document.cookie)) {
        setIsLoggedOut(true)
        setSessionWalletAddress(null)
        setHasSessionCookie(false)
        return
      }
      refreshInFlight = true
      try {
        const data = await getClientAuthSessionStatus()
        if (cancelled) return
        const nextAddress = typeof data?.address === 'string' ? data.address : null
        if (data?.authenticated === true && isLikelyWalletAddress(nextAddress)) {
          setSessionWalletAddress(nextAddress)
          setHasSessionCookie(true)
          return
        }
        if (!account?.address) {
          setSessionWalletAddress(null)
          setHasSessionCookie(false)
        }
      } catch {
        if (!cancelled && !hasSessionCookie && !account?.address) {
          setSessionWalletAddress(null)
          setHasSessionCookie(false)
        }
      } finally {
        refreshInFlight = false
      }
    }

    const updateSessionFromCookies = () => {
      try {
        if (hasLoggedOutCookie(document.cookie)) {
          setIsLoggedOut(true)
          setSessionWalletAddress(null)
          setHasSessionCookie(false)
          return
        }
        setIsLoggedOut(false)
        const info = readSessionCookieInfo(document.cookie)
        if (info.hasValidPair && info.walletAddress) {
          setSessionWalletAddress(info.walletAddress)
          setHasSessionCookie(true)
          return
        }
        if (!account?.address) {
          if (isMiniApp) {
            void refreshServerSession()
            return
          }
          setSessionWalletAddress(null)
          setHasSessionCookie(false)
        }
      } catch {}
    }

    updateSessionFromCookies()

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        updateSessionFromCookies()
      }
    }

    window.addEventListener('focus', updateSessionFromCookies)
    window.addEventListener('storage', updateSessionFromCookies)
    window.addEventListener(AUTH_STATE_CHANGED_EVENT, updateSessionFromCookies)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      cancelled = true
      window.removeEventListener('focus', updateSessionFromCookies)
      window.removeEventListener('storage', updateSessionFromCookies)
      window.removeEventListener(AUTH_STATE_CHANGED_EVENT, updateSessionFromCookies)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [account?.address, hasSessionCookie, isMiniApp])

  useEffect(() => {
    const walletAddress = isLoggedOut ? null : (account?.address ?? sessionWalletAddress ?? null)
    if (!walletAddress) {
      lastPreloadedWalletRef.current = null
      return
    }

    const normalized = walletAddress.toLowerCase()
    const cached = getCachedAccountPreload(walletAddress)
    if (cached && lastPreloadedWalletRef.current === normalized) {
      return
    }

    lastPreloadedWalletRef.current = normalized
    preloadAccountData(walletAddress).catch(() => {})
  }, [account?.address, isLoggedOut, sessionWalletAddress])

  useEffect(() => {
    fetchUser()
  }, [userHash])

  const contextValue = useMemo<AccountContext>(
    () => ({
      userHash,
      user,
      account: account ?? null,
      wallet: wallet ?? null,
      walletAddressDisplayString,
      walletAddressDisplayStringLong,
      isConnecting,
      isAuthenticated,
      isWalletReady,
      authStatus,
      hasSessionCookie,
      sessionWalletAddress,
      refreshUser: fetchUser,
    }),
    [
      userHash,
      user,
      account,
      wallet,
      walletAddressDisplayString,
      walletAddressDisplayStringLong,
      isConnecting,
      isAuthenticated,
      isWalletReady,
      authStatus,
      hasSessionCookie,
      sessionWalletAddress,
    ],
  )

  return <AccountContext.Provider value={contextValue}>{children}</AccountContext.Provider>
}
