'use client'

import {logAuthDebug} from '../debug'
import {
  clearThirdwebSessionCookie,
  clearWalletAddressCookie,
  writeLoggedOutCookie,
} from '@/lib/auth/cookies'
import {clearClientAuthSessionStatusCache} from '@/lib/auth/client-session-status'

const STORAGE_MATCHES = ['thirdweb', 'wallet', 'tw_auth', 'passkey-credential-id']

function isThirdwebStorageKey(key: string) {
  const lowerKey = key.toLowerCase()
  if (STORAGE_MATCHES.some((match) => lowerKey.includes(match))) return true

  const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID?.toLowerCase()
  return !!clientId && lowerKey.includes(clientId)
}

export function clearThirdwebClientStorage(reason?: string) {
  if (typeof window === 'undefined') return

  try {
    logAuthDebug('auth-reset:thirdweb-storage:start', {reason})
  } catch {}

  try {
    localStorage.removeItem('__tw_auth')
  } catch {}

  try {
    localStorage.removeItem('thirdweb_in_app_wallet_auth_token')
  } catch {}

  try {
    localStorage.removeItem('thirdweb_connected_wallet')
  } catch {}

  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (key && isThirdwebStorageKey(key)) keysToRemove.push(key)
    }
    keysToRemove.forEach((key) => {
      try {
        localStorage.removeItem(key)
      } catch {}
    })
    logAuthDebug('auth-reset:local-storage-cleared', {keysRemoved: keysToRemove})
  } catch {}
}

export function clearAuthState(reason?: string) {
  try {
    logAuthDebug('auth-reset:start', {
      reason,
      location: typeof window !== 'undefined' ? window.location.href : undefined,
    })
  } catch {}

  if (typeof window === 'undefined') return

  clearClientAuthSessionStatusCache()

  try {
    clearThirdwebSessionCookie()
  } catch {}

  try {
    clearWalletAddressCookie()
  } catch {}

  try {
    writeLoggedOutCookie()
  } catch {}

  clearThirdwebClientStorage(reason)
}
