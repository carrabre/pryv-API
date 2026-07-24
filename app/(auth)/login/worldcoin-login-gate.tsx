'use client'

import {useEffect, useState, type ComponentType} from 'react'
import {isAuthDebugEnabled, logAuthDebug} from '@/lib/debug'
import {useWorldcoinMiniKitAuth} from '@/hooks/use-worldcoin-minikit-auth'
import type {LoginWalletAuthProps} from './login-wallet-auth'

let loginWalletAuthPromise: Promise<ComponentType<LoginWalletAuthProps>> | null = null

const LOGGED_OUT_COOKIE_RE = /(?:^|;)\s*pryv-logged-out=1(?:;|$)/

function loadLoginWalletAuth() {
  loginWalletAuthPromise ??= import('./login-wallet-auth').then((mod) => mod.LoginWalletAuth)
  return loginWalletAuthPromise
}

export type WorldcoinLoginGateProps = {
  authIsSettling: boolean
  redirectTarget: string | null
  onStart: () => void
  onSuccess: () => void
  onError: () => void
}

export function WorldcoinLoginGate({
  authIsSettling,
  redirectTarget,
  onStart,
  onSuccess,
  onError,
}: WorldcoinLoginGateProps) {
  const [serverWorldcoinVerified, setServerWorldcoinVerified] = useState<boolean | null>(null)
  const [worldcoinStatusLoaded, setWorldcoinStatusLoaded] = useState(false)
  const [worldcoinStatusError, setWorldcoinStatusError] = useState<string | null>(null)
  const [LoginWalletAuth, setLoginWalletAuth] =
    useState<ComponentType<LoginWalletAuthProps> | null>(null)

  useEffect(() => {
    let cancelled = false
    const authDebug = isAuthDebugEnabled()
    setWorldcoinStatusLoaded(false)
    setWorldcoinStatusError(null)
    setServerWorldcoinVerified(null)
    fetch('/api/worldcoin/status', {cache: 'no-store'})
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`status-endpoint-failed:${res.status}`)
        }
        return (await res.json()) as {verified?: boolean} | null
      })
      .then((data) => {
        if (cancelled) return
        const verified = data?.verified === true
        setServerWorldcoinVerified(verified)
        setWorldcoinStatusLoaded(true)
        if (authDebug) logAuthDebug('login-page:worldcoin-status', {verified})
      })
      .catch((error) => {
        if (cancelled) return
        const message = error instanceof Error ? error.message : 'Unknown error'
        setWorldcoinStatusError(message)
        setWorldcoinStatusLoaded(true)
        setServerWorldcoinVerified(null)
        if (authDebug) logAuthDebug('login-page:worldcoin-status-error', {message})
      })
    return () => {
      cancelled = true
    }
  }, [])

  const shouldAutoStartWorldcoin =
    worldcoinStatusLoaded && serverWorldcoinVerified === false && !worldcoinStatusError
  const autoStartWorldcoin = (() => {
    if (typeof document === 'undefined') return shouldAutoStartWorldcoin
    if (LOGGED_OUT_COOKIE_RE.test(document.cookie)) return false
    return shouldAutoStartWorldcoin
  })()

  useEffect(() => {
    if (!isAuthDebugEnabled()) return
    logAuthDebug('login-page:worldcoin-autostart-decision', {
      requiresWorldcoin: true,
      worldcoinStatusLoaded,
      serverWorldcoinVerified,
      hasStatusError: !!worldcoinStatusError,
      shouldAutoStartWorldcoin,
      autoStartWorldcoin,
    })
  }, [
    worldcoinStatusLoaded,
    serverWorldcoinVerified,
    worldcoinStatusError,
    shouldAutoStartWorldcoin,
    autoStartWorldcoin,
  ])

  const worldcoinAuthEnabled = worldcoinStatusLoaded && serverWorldcoinVerified !== true
  const worldcoinAuth = useWorldcoinMiniKitAuth(autoStartWorldcoin, worldcoinAuthEnabled)
  const worldcoinVerified = serverWorldcoinVerified === true || worldcoinAuth.status === 'success'
  const worldcoinBusy = worldcoinAuth.status === 'running' || worldcoinAuth.status === 'installing'
  const worldcoinCtaDisabled =
    serverWorldcoinVerified === true || worldcoinBusy || worldcoinAuth.status === 'success'
  const worldcoinStatusLabel = (() => {
    if (!worldcoinStatusLoaded) {
      return 'Checking World App verification status...'
    }
    if (serverWorldcoinVerified === true) {
      return 'Verification complete! Continue with email sign-in below.'
    }
    if (worldcoinStatusError) {
      return 'Unable to confirm verification status. Use the button below to verify and continue.'
    }
    switch (worldcoinAuth.status) {
      case 'installing':
        return 'Preparing World App...'
      case 'running':
        return 'Verifying your World ID...'
      case 'success':
        return 'Verification complete! Continue with email sign-in below.'
      case 'error':
        return 'Verification failed. Retry to continue.'
      default:
        return 'Verify your World ID to continue with email sign-in.'
    }
  })()
  const worldcoinButtonLabel =
    serverWorldcoinVerified === true || worldcoinAuth.status === 'success'
      ? 'Verification complete'
      : worldcoinBusy
        ? 'Verifying...'
        : 'Start verification'

  useEffect(() => {
    if (!worldcoinVerified || LoginWalletAuth) return
    let cancelled = false
    void loadLoginWalletAuth().then((Component) => {
      if (!cancelled) setLoginWalletAuth(() => Component)
    })
    return () => {
      cancelled = true
    }
  }, [LoginWalletAuth, worldcoinVerified])

  return (
    <>
      <div className='rounded-lg border border-primary/30 p-4'>
        <p className='text-xs font-semibold uppercase tracking-wide text-primary/80'>Step 1</p>
        <h2 className='mt-1 text-base font-semibold'>Verify unique personhood</h2>
        <p className='mt-1 text-sm text-muted-foreground'>{worldcoinStatusLabel}</p>
        {worldcoinAuth.error && (
          <p className='mt-2 text-sm text-destructive'>
            {worldcoinAuth.error || 'Automatic verification failed. Retry to continue.'}
          </p>
        )}
        <button
          type='button'
          className='mt-4 h-12 w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground transition disabled:cursor-not-allowed disabled:opacity-60'
          onClick={() => void worldcoinAuth.runAuth()}
          disabled={worldcoinCtaDisabled}
        >
          {worldcoinButtonLabel}
        </button>
      </div>

      {!worldcoinVerified && (
        <div className='rounded-md bg-muted/40 p-3 text-sm text-muted-foreground'>
          Complete the verification above to unlock email sign-in.
        </div>
      )}

      {worldcoinVerified && LoginWalletAuth && (
        <>
          <div className='text-sm font-semibold text-muted-foreground'>
            Step 2: Sign in with email
          </div>
          <LoginWalletAuth
            authIsSettling={authIsSettling}
            redirectTarget={redirectTarget}
            onStart={onStart}
            onSuccess={onSuccess}
            onError={onError}
          />
        </>
      )}
    </>
  )
}
