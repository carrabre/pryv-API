export function normalizeRedirectTarget(raw?: string | string[] | null): string | null {
  if (!raw) return null

  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value) return null

  const trimmed = value.trim()
  if (!trimmed) return null

  let decoded = trimmed
  try {
    decoded = decodeURIComponent(trimmed)
  } catch {
    decoded = trimmed
  }

  if (!decoded.startsWith('/')) return null
  if (decoded.startsWith('//')) return null

  return decoded
}

export function getSafeRedirectTarget(raw?: string | string[] | null, fallback = '/docs'): string {
  return normalizeRedirectTarget(raw) ?? fallback
}

function getTargetPathname(target: string): string {
  try {
    return new URL(target, 'https://platform.example.com').pathname
  } catch {
    return target.split(/[?#]/)[0] ?? target
  }
}

function isAuthHandoffTarget(target: string): boolean {
  const pathname = getTargetPathname(target)
  return (
    pathname === '/' ||
    pathname === '/login' ||
    pathname.startsWith('/login/') ||
    pathname === '/logout' ||
    pathname.startsWith('/logout/')
  )
}

export function getAuthenticatedRedirectTarget(
  raw?: string | string[] | null,
  fallback = '/docs',
): string {
  const target = getSafeRedirectTarget(raw, fallback)
  return isAuthHandoffTarget(target) ? fallback : target
}
