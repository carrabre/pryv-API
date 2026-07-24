'use client'

import {useCallback, useEffect, useRef, useState} from 'react'
import type {
  MiniAppVerifyActionPayload,
  MiniAppWalletAuthPayload,
  VerificationLevel,
} from '@worldcoin/minikit-js'
import {isAuthDebugEnabled, logAuthDebug} from '@/lib/debug'
import {useMiniApp} from '@/hooks/use-mini-app'

type AuthStatus = 'idle' | 'installing' | 'running' | 'success' | 'error'

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000
const ORB_VERIFICATION_LEVEL = 'orb' as VerificationLevel

type WorldcoinClientConfig = {
  appId: string
  actionId: string
}

async function requestWorldcoinClientConfig(): Promise<WorldcoinClientConfig> {
  const response = await fetch('/api/worldcoin/config')
  if (!response.ok) {
    throw new Error(`Failed to fetch Worldcoin config (${response.status})`)
  }

  const data = (await response.json()) as Partial<WorldcoinClientConfig>
  if (!data.appId || !data.actionId) {
    throw new Error('Worldcoin config response missing appId/actionId')
  }

  return {
    appId: data.appId,
    actionId: data.actionId,
  }
}

export interface WorldcoinAuthResult {
  status: AuthStatus
  error: string | null
  runAuth: () => Promise<void>
  lastSuccessAt: number | null
}

export function useWorldcoinMiniKitAuth(autoStart = true, enabled = true): WorldcoinAuthResult {
  const {isMiniApp} = useMiniApp()
  const [status, setStatus] = useState<AuthStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [lastSuccessAt, setLastSuccessAt] = useState<number | null>(null)
  const hasAutoAttemptedRef = useRef(false)
  const configRef = useRef<WorldcoinClientConfig | null>(null)
  const [configState, setConfigState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')

  const LOCK_KEY = 'pryv_worldcoin_auth_lock_ts'
  const LOCK_TTL_MS = 15_000

  const acquireLock = useCallback((): boolean => {
    if (typeof window === 'undefined') return true
    try {
      const raw = window.sessionStorage.getItem(LOCK_KEY)
      if (raw) {
        const ts = Number(raw)
        if (Number.isFinite(ts) && Date.now() - ts < LOCK_TTL_MS) {
          return false
        }
      }
      window.sessionStorage.setItem(LOCK_KEY, String(Date.now()))
      return true
    } catch {
      // If storage is unavailable, fall back to best-effort behavior.
      return true
    }
  }, [])

  const releaseLock = useCallback(() => {
    if (typeof window === 'undefined') return
    try {
      window.sessionStorage.removeItem(LOCK_KEY)
    } catch {
      // ignore
    }
  }, [])

  const ensureConfig = useCallback(async () => {
    if (configRef.current) return configRef.current

    setConfigState((prev) => (prev === 'ready' ? prev : 'loading'))

    try {
      const config = await requestWorldcoinClientConfig()
      configRef.current = config
      setConfigState('ready')
      return config
    } catch (configError) {
      setConfigState('error')
      throw configError
    }
  }, [])

  const runAuth = useCallback(async () => {
    if (typeof window === 'undefined') return
    const authDebug = isAuthDebugEnabled()
    if (!enabled) {
      if (authDebug) logAuthDebug('worldcoin:hook:skipping', {reason: 'disabled'})
      return
    }
    if (status === 'installing' || status === 'running') {
      if (authDebug) logAuthDebug('worldcoin:hook:skipping', {reason: 'already-running', status})
      return
    }
    if (status === 'success') {
      if (authDebug) logAuthDebug('worldcoin:hook:skipping', {reason: 'already-success'})
      return
    }
    if (!isMiniApp) {
      if (authDebug) logAuthDebug('worldcoin:hook:skipping', {reason: 'not-mini-app'})
      return
    }
    if (!acquireLock()) {
      if (authDebug) logAuthDebug('worldcoin:hook:skipping', {reason: 'locked'})
      return
    }

    try {
      let config: WorldcoinClientConfig
      try {
        config = await ensureConfig()
      } catch (configError) {
        const message = configError instanceof Error ? configError.message : 'Unknown error'
        if (authDebug) logAuthDebug('worldcoin:hook:missing-config', {message})
        setError('Worldcoin configuration missing')
        setStatus('error')
        return
      }

      setStatus('installing')
      setError(null)

      const {MiniKit} = await import('@worldcoin/minikit-js')
      if (!MiniKit.isInstalled()) {
        const installResult = MiniKit.install(config.appId)
        if (!installResult?.success) {
          throw new Error(`MiniKit install failed: ${installResult?.errorCode ?? 'unknown-error'}`)
        }
      }

      setStatus('running')

      const nonceResponse = await fetch('/api/worldcoin/nonce', {cache: 'no-store'})
      if (!nonceResponse.ok) {
        throw new Error(`Failed to fetch nonce (${nonceResponse.status})`)
      }
      const {nonce} = (await nonceResponse.json()) as {nonce: string}
      if (!nonce) {
        throw new Error('Nonce response missing value')
      }

      const walletResult = await MiniKit.commandsAsync.walletAuth({
        nonce,
        expirationTime: new Date(Date.now() + ONE_WEEK_MS),
      })
      const walletPayload = walletResult.finalPayload as MiniAppWalletAuthPayload
      if (!walletPayload || walletPayload.status === 'error') {
        throw new Error(`Wallet auth failed: ${walletPayload?.error_code ?? 'unknown'}`)
      }

      const verifyResult = await MiniKit.commandsAsync.verify({
        action: config.actionId,
        verification_level: ORB_VERIFICATION_LEVEL,
      })
      const verifyPayload = verifyResult.finalPayload as MiniAppVerifyActionPayload
      if (!verifyPayload || verifyPayload.status === 'error') {
        throw new Error(`Verification failed: ${verifyPayload?.error_code ?? 'unknown'}`)
      }

      const completeResponse = await fetch('/api/worldcoin/complete-auth', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        cache: 'no-store',
        body: JSON.stringify({walletPayload, verifyPayload, nonce}),
      })
      if (!completeResponse.ok) {
        const text = await completeResponse.text()
        throw new Error(`Worldcoin auth failed (${completeResponse.status}): ${text}`)
      }

      if (authDebug) logAuthDebug('worldcoin:hook:success')
      setStatus('success')
      setLastSuccessAt(Date.now())
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      if (authDebug) logAuthDebug('worldcoin:hook:error', {message})
      setStatus('error')
      setError(message)
      return
    } finally {
      releaseLock()
    }
  }, [acquireLock, enabled, ensureConfig, isMiniApp, releaseLock, status])

  useEffect(() => {
    if (!enabled) return
    if (!isMiniApp) return
    if (configRef.current || configState === 'loading' || configState === 'ready') return

    ensureConfig().catch((configError) => {
      if (isAuthDebugEnabled()) {
        logAuthDebug('worldcoin:hook:config-error', {
          message: configError instanceof Error ? configError.message : 'Unknown error',
        })
      }
    })
  }, [enabled, isMiniApp, ensureConfig, configState])

  useEffect(() => {
    if (!enabled) return
    if (!autoStart) return
    if (!isMiniApp) return
    if (hasAutoAttemptedRef.current) return
    hasAutoAttemptedRef.current = true
    void runAuth()
  }, [autoStart, enabled, isMiniApp, runAuth])

  return {
    status,
    error,
    runAuth,
    lastSuccessAt,
  }
}
