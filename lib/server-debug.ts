export const AUTH_DEBUG_ENABLED =
  process.env.NODE_ENV !== 'production' && process.env.AUTH_DEBUG === '1'

export function logAuthDebug(label: string, _data?: unknown) {
  if (!AUTH_DEBUG_ENABLED) return
  try {
    // eslint-disable-next-line no-console
    console.info(`[AUTH DEBUG] ${label}`)
  } catch {}
}
