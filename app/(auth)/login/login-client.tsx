'use client'

import {useEffect, useState, useRef, type ComponentType} from 'react'
import type {LoginWalletAuthProps} from './login-wallet-auth'
import type {WorldcoinLoginGateProps} from './worldcoin-login-gate'
import {getAuthenticatedRedirectTarget} from '@/lib/auth/redirect-target'

let loginWalletAuthPromise: Promise<ComponentType<LoginWalletAuthProps>> | null = null
let worldcoinLoginGatePromise: Promise<ComponentType<WorldcoinLoginGateProps>> | null = null

const LOGGED_OUT_COOKIE_RE = /(?:^|;)\s*pryv-logged-out=1(?:;|$)/
const SESSION_CONFIRMED_COOKIE_RE = /(?:^|;)\s*pryv-session-confirmed=1(?:;|$)/
const THIRDWEB_SESSION_COOKIE_RE = /(?:^|;)\s*thirdweb-session=0x[^;]{40,}(?:;|$)/
const WALLET_ADDRESS_COOKIE_RE = /(?:^|;)\s*walletAddress=0x[^;]{40,}(?:;|$)/

function loadLoginWalletAuth() {
  loginWalletAuthPromise ??= import('./login-wallet-auth').then((mod) => mod.LoginWalletAuth)
  return loginWalletAuthPromise
}

function preloadLoginWalletAuth() {
  void loadLoginWalletAuth()
}

function loadWorldcoinLoginGate() {
  worldcoinLoginGatePromise ??= import('./worldcoin-login-gate').then(
    (mod) => mod.WorldcoinLoginGate,
  )
  return worldcoinLoginGatePromise
}

function LoginWalletAuthLoading() {
  return <LoginSignInButton disabled label='Opening sign in...' />
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

function navigateAfterAuth(target: string | null) {
  const nextTarget = target ?? '/docs'
  if (replaceWithBrowserLocation(nextTarget)) return
  window.location.replace(nextTarget)
}

function readRedirectTargetFromLocation() {
  if (typeof window === 'undefined') return null
  try {
    return getAuthenticatedRedirectTarget(
      new URLSearchParams(window.location.search).get('redirect'),
    )
  } catch {
    return null
  }
}

function LoginSignInButton({
  disabled = false,
  label = 'Sign In',
  onClick,
}: {
  disabled?: boolean
  label?: string
  onClick?: () => void
}) {
  return (
    <button type='button' className='auth-signin-btn' disabled={disabled} onClick={onClick}>
      {label}
    </button>
  )
}

function isMiniAppEnvironment() {
  if (typeof window === 'undefined') return false

  const win = window as Window & {
    WorldApp?: unknown
    worldApp?: unknown
    MiniKit?: unknown
    minikit?: unknown
  }
  if (
    win.WorldApp !== undefined ||
    win.worldApp !== undefined ||
    win.MiniKit !== undefined ||
    win.minikit !== undefined
  ) {
    return true
  }

  if (typeof navigator !== 'undefined' && navigator.userAgent) {
    if (/world ?app|minikit/.test(navigator.userAgent.toLowerCase())) return true
  }

  return /(?:[?&])miniapp=(?:1|true)(?:&|$)/.test(window.location.search)
}

function useLoginMiniAppDetection() {
  const [isMiniApp, setIsMiniApp] = useState(isMiniAppEnvironment)

  useEffect(() => {
    let cancelled = false

    const checkAndUpdate = () => {
      if (cancelled) return true
      const detected = isMiniAppEnvironment()
      if (detected) setIsMiniApp(true)
      return detected
    }

    if (checkAndUpdate()) return

    const timers = [500, 1500].map((delay) => window.setTimeout(checkAndUpdate, delay))

    return () => {
      cancelled = true
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [])

  return isMiniApp
}

export function LoginClient() {
  const isMiniApp = useLoginMiniAppDetection()
  const [authStatus, setAuthStatus] = useState<'idle' | 'signing-in' | 'redirecting'>('idle')
  const [walletAuthRequested, setWalletAuthRequested] = useState(false)
  const [LoginWalletAuth, setLoginWalletAuth] =
    useState<ComponentType<LoginWalletAuthProps> | null>(null)
  const [WorldcoinLoginGate, setWorldcoinLoginGate] =
    useState<ComponentType<WorldcoinLoginGateProps> | null>(null)
  const authIsSettling = authStatus !== 'idle'
  const hasCheckedReadableCookies = useRef(false)
  const redirectTargetRef = useRef<string | null>(null)

  useEffect(() => {
    const nextRedirectTarget = readRedirectTargetFromLocation()
    redirectTargetRef.current = nextRedirectTarget
  }, [])

  // Keep support for older readable wallet cookies by opening the wallet auth flow immediately.
  // Server-issued and legacy HttpOnly sessions are redirected by middleware before this shell renders.
  useEffect(() => {
    if (hasCheckedReadableCookies.current) return
    hasCheckedReadableCookies.current = true

    if (typeof document === 'undefined') return
    const cookieString = document.cookie
    if (LOGGED_OUT_COOKIE_RE.test(cookieString)) return
    if (
      SESSION_CONFIRMED_COOKIE_RE.test(cookieString) &&
      THIRDWEB_SESSION_COOKIE_RE.test(cookieString) &&
      WALLET_ADDRESS_COOKIE_RE.test(cookieString)
    ) {
      setWalletAuthRequested(true)
    }
  }, [])

  const handleAuthSuccess = () => {
    setAuthStatus('redirecting')
    navigateAfterAuth(redirectTargetRef.current)
  }

  const handleAuthError = () => {
    setAuthStatus('idle')
  }

  const handleWalletAuthRequest = () => {
    const nextRedirectTarget = readRedirectTargetFromLocation()
    redirectTargetRef.current = nextRedirectTarget
    preloadLoginWalletAuth()
    setWalletAuthRequested(true)
  }

  useEffect(() => {
    if (!isMiniApp || WorldcoinLoginGate) return
    let cancelled = false
    void loadWorldcoinLoginGate().then((Component) => {
      if (!cancelled) setWorldcoinLoginGate(() => Component)
    })
    return () => {
      cancelled = true
    }
  }, [WorldcoinLoginGate, isMiniApp])

  useEffect(() => {
    if (!walletAuthRequested || LoginWalletAuth) return
    let cancelled = false
    void loadLoginWalletAuth().then((Component) => {
      if (!cancelled) setLoginWalletAuth(() => Component)
    })
    return () => {
      cancelled = true
    }
  }, [LoginWalletAuth, walletAuthRequested])

  const authStatusLabel =
    authStatus === 'redirecting' ? 'Opening your platform...' : 'Signing you in...'

  if (authIsSettling) {
    return (
      <div className='flex min-h-[48px] items-center justify-center gap-3 rounded-md border border-border bg-muted/30 px-4 py-3 text-sm font-semibold text-foreground'>
        <span
          className='h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground'
          aria-hidden
        />
        <span>{authStatusLabel}</span>
      </div>
    )
  }

  return (
    <div className='flex flex-col gap-4'>
      {isMiniApp ? (
        WorldcoinLoginGate ? (
          <WorldcoinLoginGate
            authIsSettling={authIsSettling}
            redirectTarget={redirectTargetRef.current}
            onStart={() => setAuthStatus('signing-in')}
            onSuccess={handleAuthSuccess}
            onError={handleAuthError}
          />
        ) : null
      ) : (
        <>
          {walletAuthRequested && LoginWalletAuth ? (
            <LoginWalletAuth
              autoOpen
              authIsSettling={authIsSettling}
              redirectTarget={redirectTargetRef.current}
              onStart={() => setAuthStatus('signing-in')}
              onSuccess={handleAuthSuccess}
              onError={handleAuthError}
            />
          ) : walletAuthRequested ? (
            <LoginWalletAuthLoading />
          ) : (
            <LoginSignInButton onClick={handleWalletAuthRequest} />
          )}
        </>
      )}
    </div>
  )
}
