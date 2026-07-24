import {DEV} from './runtime'

export function isAuthDebugEnabled(): boolean {
  if (!DEV) return false
  if (typeof window !== 'undefined') {
    try {
      const url = new URL(window.location.href)
      if (url.searchParams.get('debugAuth') === '1') return true
      if (localStorage.getItem('AUTH_DEBUG') === '1') return true
    } catch {}
  }
  return process.env.NEXT_PUBLIC_AUTH_DEBUG === '1'
}

export function logAuthDebug(label: string, _data?: unknown) {
  if (!isAuthDebugEnabled()) return
  try {
    // eslint-disable-next-line no-console
    console.info(`[AUTH DEBUG] ${label}`)
  } catch {}
}

export function isPiiDebugEnabled(): boolean {
  if (!DEV) return false
  if (typeof window !== 'undefined') {
    try {
      const url = new URL(window.location.href)
      if (url.searchParams.get('debugPii') === '1') return true
      if (url.searchParams.get('debugPii') === '2') return true
      if (localStorage.getItem('PII_DEBUG') === '1') return true
    } catch {}
  }
  return process.env.NEXT_PUBLIC_PII_DEBUG === '1'
}

export function isPiiDebugVerboseEnabled(): boolean {
  if (!DEV) return false
  if (typeof window !== 'undefined') {
    try {
      const url = new URL(window.location.href)
      if (url.searchParams.get('debugPii') === '2') return true
      if (localStorage.getItem('PII_DEBUG_VERBOSE') === '1') return true
    } catch {}
  }
  return process.env.NEXT_PUBLIC_PII_DEBUG_VERBOSE === '1'
}

export function logPiiDebug(label: string, _data?: unknown) {
  if (!DEV && !isPiiDebugEnabled()) return
  try {
    // eslint-disable-next-line no-console
    console.info(`[PII DEBUG] ${label}`)
  } catch {}
}
