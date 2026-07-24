export type ClientAuthSessionStatus = {
  authenticated?: boolean
  address?: string
  loggedOut?: boolean
}

type SessionStatusOptions = {
  maxAgeMs?: number
}

const DEFAULT_SESSION_STATUS_MAX_AGE_MS = 500

let cachedSessionStatus: {at: number; value: ClientAuthSessionStatus | null} | null = null
let sessionStatusPromise: Promise<ClientAuthSessionStatus | null> | null = null
let sessionStatusCacheVersion = 0

export function clearClientAuthSessionStatusCache() {
  cachedSessionStatus = null
  sessionStatusCacheVersion += 1
}

export function getClientAuthSessionStatus({
  maxAgeMs = DEFAULT_SESSION_STATUS_MAX_AGE_MS,
}: SessionStatusOptions = {}): Promise<ClientAuthSessionStatus | null> {
  const now = Date.now()
  if (maxAgeMs > 0 && cachedSessionStatus && now - cachedSessionStatus.at <= maxAgeMs) {
    return Promise.resolve(cachedSessionStatus.value)
  }

  if (sessionStatusPromise) return sessionStatusPromise

  const requestCacheVersion = sessionStatusCacheVersion
  sessionStatusPromise = fetch('/api/auth/session', {
    cache: 'no-store',
    credentials: 'include',
  })
    .then(async (res) => {
      if (!res.ok) return null
      return (await res.json()) as ClientAuthSessionStatus
    })
    .catch(() => null)
    .then((value) => {
      if (requestCacheVersion === sessionStatusCacheVersion) {
        cachedSessionStatus = {at: Date.now(), value}
      }
      return value
    })
    .finally(() => {
      sessionStatusPromise = null
    })

  return sessionStatusPromise
}
