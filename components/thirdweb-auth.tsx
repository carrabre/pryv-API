'use client'

import {useCallback, useEffect, useMemo, useRef} from 'react'
import {type UseConnectModalOptions, useConnectModal} from 'thirdweb/react'
import {inAppWallet, createWallet, type Wallet} from 'thirdweb/wallets'
import {getThirdwebClient} from '@/lib/thirdweb/client'
import {pryvTheme} from '@/lib/thirdweb/theme'
import {logAuthDebug, isAuthDebugEnabled} from '@/lib/debug'
import {toast} from '@/components/toast-store'
import {clearThirdwebClientStorage} from '@/lib/auth/reset'
import {
  PRYV_IN_APP_AUTH_OPTIONS,
  MINI_APP_AUTH_OPTIONS,
  getMiniAppEnvironmentInfo,
} from '@/lib/thirdweb/auth-options'
import {createThirdwebServerSession} from '@/lib/auth/thirdweb-client-session'
import {
  clearThirdwebSessionCookie,
  clearLoggedOutCookie,
  clearWalletAddressCookie,
  writeSessionConfirmedCookie,
  writeThirdwebSessionCookie,
  writeWalletAddressCookie,
} from '@/lib/auth/cookies'
import {getClientAuthSessionStatus} from '@/lib/auth/client-session-status'

interface ThirdwebAuthProps {
  autoOpen?: boolean
  onStart?: () => void
  onSuccess?: () => void
  onError?: () => void
  label?: string
}

const SERVER_AUTH_WAIT_MS = 2_000
const SERVER_AUTH_POLL_INTERVAL_MS = 100

async function waitForServerAuth(): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < SERVER_AUTH_WAIT_MS) {
    const data = await getClientAuthSessionStatus({maxAgeMs: 0})
    if (data?.authenticated === true) return true
    await new Promise((resolve) => setTimeout(resolve, SERVER_AUTH_POLL_INTERVAL_MS))
  }
  const data = await getClientAuthSessionStatus({maxAgeMs: 0})
  return data?.authenticated === true
}

function isLocalAuthHost() {
  if (typeof window === 'undefined') return false
  return /^(?:localhost|127\.0\.0\.1|\[?::1\]?)$/.test(window.location.hostname)
}

export function ThirdwebAuth({
  autoOpen = false,
  onStart,
  onSuccess,
  onError,
  label = 'Sign in',
}: ThirdwebAuthProps) {
  const thirdwebClient = getThirdwebClient()
  const {connect, isConnecting} = useConnectModal()
  const autoOpenAttemptedRef = useRef(false)

  // Detect mini app environment and restrict auth options accordingly
  const miniAppInfo = useMemo(() => {
    const info = getMiniAppEnvironmentInfo()
    const authDebug = isAuthDebugEnabled()
    if (authDebug) {
      logAuthDebug('thirdweb-auth:mini-app-detection', {
        ...info,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
      })
    }
    if (authDebug && info.isWorldApp) {
      logAuthDebug('thirdweb-auth:world-app', {
        version: info.worldAppVersion,
        deviceOS: info.deviceOS,
        hasMiniKit: info.hasMiniKit,
      })
    }
    return info
  }, [])

  const isMiniApp = miniAppInfo.isMiniApp

  const handleConnect = useCallback(
    async (wallet: Wallet) => {
      const authDebug = isAuthDebugEnabled()
      try {
        onStart?.()
        clearLoggedOutCookie()
        const account = await wallet.getAccount()
        if (!account) {
          throw new Error('wallet_account_missing')
        }
        if (authDebug) logAuthDebug('thirdweb-auth:on-connect', {address: account?.address})

        const result = await createThirdwebServerSession(account, 'thirdweb')
        if (authDebug) logAuthDebug('thirdweb-auth:api-response', result)

        if (authDebug) {
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
          clearThirdwebSessionCookie()
          clearWalletAddressCookie()
          throw new Error(
            `Failed to create session (${result.status})${result.errorCode ? ` code=${result.errorCode}` : ''}`,
          )
        }

        writeThirdwebSessionCookie(account?.address)
        writeWalletAddressCookie(account?.address)
        writeSessionConfirmedCookie()

        const serverReady = await waitForServerAuth()
        if (authDebug) logAuthDebug('thirdweb-auth:server-auth-ready', {ok: serverReady})
        if (!serverReady) {
          onError?.()
          toast({
            type: 'error',
            description:
              'Signed in, but the server session did not become active. Please refresh and try again.',
          })
          return
        }

        onSuccess?.()
      } catch (error) {
        onError?.()
        clearThirdwebSessionCookie()
        clearWalletAddressCookie()
        if (isLocalAuthHost()) {
          clearThirdwebClientStorage('local-login-error')
        }
        if (authDebug) {
          logAuthDebug('thirdweb-auth:session-error', {
            message: error instanceof Error ? error.message : String(error),
          })
        }
        toast({
          type: 'error',
          description: 'Sign-in failed to establish a session. Please refresh and try again.',
        })
      }
    },
    [onError, onStart, onSuccess],
  )

  // Configure in-app wallet with client storage
  // Only include most popular wallets for fast initial load
  // ThirdwebConnect modal will show additional wallets on-demand
  // In mini app environments, restrict to email-only auth (OAuth redirects don't work in WebViews)
  const authOptions = isMiniApp ? MINI_APP_AUTH_OPTIONS : PRYV_IN_APP_AUTH_OPTIONS
  const wallets = useMemo(
    () => [
      inAppWallet({
        auth: {
          options: [...authOptions],
        },
        metadata: {name: 'Pryv'},
      }),
      // Only show external wallets in non-mini-app environments
      ...(isMiniApp
        ? []
        : [
            createWallet('io.metamask'),
            createWallet('com.coinbase.wallet'),
            createWallet('walletConnect'),
          ]),
    ],
    [isMiniApp, authOptions],
  )

  const connectOptions = useMemo<UseConnectModalOptions | null>(() => {
    if (!thirdwebClient) return null

    return {
      client: thirdwebClient,
      theme: pryvTheme,
      wallets,
      appMetadata: {
        name: 'Pryv',
      },
      title: isMiniApp ? 'Sign in with Email' : 'Welcome to Pryv',
      size: 'compact',
      showThirdwebBranding: false,
    }
  }, [thirdwebClient, isMiniApp, wallets])

  const handleSignIn = useCallback(async () => {
    if (!connectOptions || isConnecting) return

    try {
      if (isLocalAuthHost()) {
        clearThirdwebClientStorage('local-login-start')
      }
      const wallet = await connect(connectOptions)
      await handleConnect(wallet)
    } catch (error) {
      if (isAuthDebugEnabled()) {
        logAuthDebug('thirdweb-auth:connect-modal-error', {
          message: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }, [connect, connectOptions, handleConnect, isConnecting])

  useEffect(() => {
    if (!autoOpen || autoOpenAttemptedRef.current) return
    if (!connectOptions) return

    autoOpenAttemptedRef.current = true
    void handleSignIn()
  }, [autoOpen, connectOptions, handleSignIn])

  return thirdwebClient ? (
    <button
      type='button'
      className='auth-signin-btn'
      disabled={isConnecting}
      aria-busy={isConnecting}
      onClick={() => void handleSignIn()}
    >
      {isConnecting ? 'Opening sign in...' : label}
    </button>
  ) : null
}
