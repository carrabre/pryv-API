'use client'

import {getThirdwebClient} from '@/lib/thirdweb/client'
import {isAuthDebugEnabled, logAuthDebug} from '@/lib/debug'
import type {ReactNode} from 'react'
import {useEffect, useRef} from 'react'
import {AutoConnect, ThirdwebProvider, useActiveAccount, useConnect} from 'thirdweb/react'
import {inAppWallet} from 'thirdweb/wallets'
import {hasLoggedOutCookie, hasValidSessionFromCookieString} from '@/lib/auth/cookie-read'
import {createThirdwebServerSession} from '@/lib/auth/thirdweb-client-session'
import {clearAuthState} from '@/lib/auth/reset'
import {safeLocalStorageGetItem} from '@/lib/auth/client-storage'
import {getClientAuthSessionStatus} from '@/lib/auth/client-session-status'

async function hasServerAuthenticatedSession(): Promise<boolean | null> {
  const data = await getClientAuthSessionStatus()
  return data ? data.authenticated === true : null
}

function AutoConnectManager() {
  const account = useActiveAccount()
  const attemptedRef = useRef(false)
  const attemptedJwtConnectRef = useRef(false)
  const resetInFlightRef = useRef(false)
  const {connect} = useConnect()

  useEffect(() => {
    const attemptReconnect = async () => {
      if (typeof window === 'undefined') return
      if (attemptedRef.current) return

      const cookieString = document.cookie
      const hasValidSession = hasValidSessionFromCookieString(cookieString)
      const authDebug = isAuthDebugEnabled()
      if (hasLoggedOutCookie(cookieString)) {
        if (authDebug) logAuthDebug('provider:autoconnect-skip', {reason: 'logged-out'})
        return
      }

      if (authDebug) logAuthDebug('provider:cookie-scan')

      const currentPath = window.location.pathname
      const isHomepage = currentPath === '/'

      // CRITICAL: Force wallet connection if we have session but no account
      if (hasValidSession && !account) {
        if (authDebug) logAuthDebug('provider:has-session-no-account', {isHomepage})
        // Try a one-time silent JWT connect if a token exists
        const storedAuthToken = safeLocalStorageGetItem('thirdweb_in_app_wallet_auth_token')
        if (storedAuthToken && !attemptedJwtConnectRef.current) {
          try {
            attemptedJwtConnectRef.current = true
            const client = getThirdwebClient()
            if (client) {
              if (authDebug) logAuthDebug('provider:attempt-silent-connect')
              await connect(async () => {
                const w = inAppWallet()
                await w.connect({client, strategy: 'jwt', jwt: storedAuthToken})
                return w
              })
              if (authDebug) logAuthDebug('provider:silent-connect-done')
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            if (authDebug) logAuthDebug('provider:silent-connect-error', {message})
            const serverOk = await hasServerAuthenticatedSession()
            if (serverOk === false && !resetInFlightRef.current) {
              resetInFlightRef.current = true
              if (authDebug) {
                logAuthDebug('provider:stale-session-reset', {reason: 'silent-connect-failed'})
              }
              clearAuthState('silent-connect-failed')
              try {
                await fetch('/api/auth/thirdweb', {
                  method: 'DELETE',
                  cache: 'no-store',
                  credentials: 'include',
                  keepalive: true,
                })
              } catch {}
              const onLogin =
                window.location.pathname === '/login' || window.location.pathname === '/logout'
              if (!onLogin) {
                const target = `${window.location.pathname}${window.location.search || ''}`
                const url = new URL('/login', window.location.origin)
                url.searchParams.set('redirect', target)
                url.searchParams.set('reason', 'session-invalidated')
                window.location.assign(url.toString())
              }
            }
          }
        }

        attemptedRef.current = true
        // Note: Login page redirects are now handled by middleware (server-side)
        // and LoginClient (client-side) for faster performance
      }
    }

    // Run once on mount
    attemptReconnect()
  }, [account, connect])

  // Sync session creation when account connects
  useEffect(() => {
    if (!account?.address) return
    let cancelled = false

    void (async () => {
      const authDebug = isAuthDebugEnabled()
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : null
      if (currentPath === '/login' || currentPath === '/logout') {
        if (authDebug) {
          logAuthDebug('provider:server-sync-skipped', {
            address: account.address,
            reason: 'auth-route',
          })
        }
        return
      }

      if (typeof document !== 'undefined' && hasLoggedOutCookie(document.cookie)) {
        if (authDebug) {
          logAuthDebug('provider:server-sync-skipped', {
            address: account.address,
            reason: 'logged-out',
          })
        }
        return
      }

      const serverOk = await hasServerAuthenticatedSession()
      if (cancelled || serverOk === true) return

      const result = await createThirdwebServerSession(account, 'thirdweb')
      if (authDebug) {
        logAuthDebug('provider:server-sync-result', {
          address: account.address,
          ...result,
        })
      }
    })().catch((error) => {
      if (isAuthDebugEnabled()) {
        logAuthDebug('provider:server-sync-error', {
          address: account.address,
          message: error instanceof Error ? error.message : String(error),
        })
      }
    })

    return () => {
      cancelled = true
    }
  }, [account])

  return null
}

export function ThirdwebClientProvider({children}: {children: ReactNode}) {
  const client = getThirdwebClient()
  return (
    <ThirdwebProvider>
      <AutoConnectManager />

      {client && <AutoConnect client={client} appMetadata={{name: 'Pryv'}} />}

      {children}
    </ThirdwebProvider>
  )
}
