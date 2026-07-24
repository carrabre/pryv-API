const USER_HASH_STORAGE_PREFIX = 'pryv:user-hash:'
const USER_HASH_REGEX = /^[a-f0-9]{64}$/i

function buildStorageKey(walletAddress: string) {
  return `${USER_HASH_STORAGE_PREFIX}${walletAddress.toLowerCase()}`
}

export function getCachedUserHash(walletAddress?: string | null): string | null {
  if (typeof window === 'undefined') return null
  if (!walletAddress) return null

  try {
    const key = buildStorageKey(walletAddress)
    const value = window.localStorage?.getItem(key)
    if (!value) return null
    return USER_HASH_REGEX.test(value) ? value : null
  } catch {
    return null
  }
}

export function cacheUserHash(walletAddress?: string | null, userHash?: string | null) {
  if (typeof window === 'undefined') return
  if (!walletAddress || !userHash) return
  if (!USER_HASH_REGEX.test(userHash)) return

  try {
    const key = buildStorageKey(walletAddress)
    window.localStorage?.setItem(key, userHash)
  } catch {
    // Ignore storage quota errors
  }
}

export function clearCachedUserHash(walletAddress?: string | null) {
  if (typeof window === 'undefined') return
  if (!walletAddress) return

  try {
    const key = buildStorageKey(walletAddress)
    window.localStorage?.removeItem(key)
  } catch {
    // Ignore storage errors
  }
}
