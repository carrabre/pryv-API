'use client'

import {useRouter} from 'next/navigation'
import {useEffect, useRef} from 'react'
import {useActiveAccount} from 'thirdweb/react'
import type {Account} from 'thirdweb/wallets'
import {toast} from '@/components/toast-store'
import {AppExtras} from '@/components/app-extras'
import {ThirdwebAuth} from '@/components/thirdweb-auth'
import {ThirdwebClientProvider} from '@/components/thirdweb-provider'
import {createThirdwebServerSession} from '@/lib/auth/thirdweb-client-session'
import {getClientAuthSessionStatus} from '@/lib/auth/client-session-status'
import {logAuthDebug, isAuthDebugEnabled} from '@/lib/debug'

const LOGGED_OUT_COOKIE_RE = /(?:^|;)\s*pryv-logged-out=1(?:;|$)/

export interface LoginWalletAuthProps {
  autoOpen?: boolean
  authIsSettling: boolean
  redirectTarget: string | null
  onStart: () => void
  onSuccess: () => void
  onError: () => void
}

function replaceWithBrowserLocation(target: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    window.location.replace(new URL(target, window.location.origin).toString())
    return true
  } catch {
    return false
  }
}

function navigateAfterAuth(router: ReturnType<typeof useRouter>, target: string | null) {
  const nextTarget = target ?? '/docs'
  if (replaceWithBrowserLocation(nextTarget)) return
  router.replace(nextTarget)
}

function hasLoggedOutCookie(cookieString: string) {
  return LOGGED_OUT_COOKIE_RE.test(cookieString)
}

async function hasServerAuthenticatedSession(): Promise<boolean> {
  const data = await getClientAuthSessionStatus({maxAgeMs: 0})
  return data?.authenticated === true
}

async function ensureServerSessionForAccount(
  account: Account,
): Promise<{ok: true} | {ok: false; errorCode?: string; error?: string; status?: number}> {
  try {
    const result = await createThirdwebServerSession(account, 'thirdweb')

    if (isAuthDebugEnabled()) {
      try {
        localStorage.setItem(
          'AUTH_DEBUG_LAST_POST',
          JSON.stringify({
            ts: Date.now(),
            status: result.status,
            errorCode: result.ok ? undefined : result.errorCode,
          }),
        )
      } catch {}
    }

    if (!result.ok) {
      return {
        ok: false,
        status: result.status,
        errorCode: result.errorCode,
        error: result.error,
      }
    }

    const start = Date.now()
    while (Date.now() - start < 2_000) {
      const ok = await hasServerAuthenticatedSession()
      if (ok) return {ok: true}
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    return {ok: false, errorCode: 'server_auth_not_ready'}
  } catch (e) {
    if (isAuthDebugEnabled()) {
      try {
        localStorage.setItem(
          'AUTH_DEBUG_LAST_POST',
          JSON.stringify({ts: Date.now(), status: 0, errorCode: 'network_error'}),
        )
      } catch {}
    }
    return {
      ok: false,
      errorCode: 'network_error',
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

export function LoginWalletAuth(props: LoginWalletAuthProps) {
  return (
    <ThirdwebClientProvider>
      <LoginWalletAuthContent {...props} />
      <AppExtras />
    </ThirdwebClientProvider>
  )
}

function LoginWalletAuthContent({
  autoOpen = false,
  authIsSettling,
  redirectTarget,
  onStart,
  onSuccess,
  onError,
}: LoginWalletAuthProps) {
  const router = useRouter()
  const account = useActiveAccount()

  const lastServerSyncAttemptRef = useRef<{address: string; ts: number} | null>(null)
  useEffect(() => {
    // The auto-open sign-in flow owns session creation; background sync can race its nonce.
    if (autoOpen) return
    const address = account?.address
    if (!address) return
    if (authIsSettling) return
    if (typeof document !== 'undefined' && hasLoggedOutCookie(document.cookie)) {
      logAuthDebug('login-page:server-session-sync:skipped', {
        address,
        reason: 'logged-out',
      })
      return
    }
    const now = Date.now()
    const last = lastServerSyncAttemptRef.current
    const isThrottled = !!last && last.address === address && now - last.ts < 3_000
    if (isThrottled) return
    lastServerSyncAttemptRef.current = {address, ts: now}

    void (async () => {
      const alreadyOk = await hasServerAuthenticatedSession()
      if (alreadyOk) {
        logAuthDebug('login-page:account-redirect', {address})
        navigateAfterAuth(router, redirectTarget)
        return
      }

      logAuthDebug('login-page:server-session-sync:start', {address})
      const result = await ensureServerSessionForAccount(account)
      if (!result.ok) {
        logAuthDebug('login-page:server-session-sync:failed', {
          address,
          status: result.status,
          errorCode: result.errorCode,
          error: result.error,
        })
        toast({
          type: 'error',
          description:
            result.errorCode === 'missing_auth_signing_secret'
              ? 'Server is missing an auth secret. Please try again later.'
              : `Could not establish server session (${result.errorCode ?? 'unknown'}). Please refresh and try again.`,
        })
        return
      }

      logAuthDebug('login-page:server-session-sync:ok', {address})
      navigateAfterAuth(router, redirectTarget)
    })()
  }, [account, account?.address, authIsSettling, autoOpen, router, redirectTarget])

  return (
    <ThirdwebAuth
      autoOpen={autoOpen}
      onStart={onStart}
      onSuccess={onSuccess}
      onError={onError}
      label='Sign In'
    />
  )
}
