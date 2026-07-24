import {PROD} from '@/lib/runtime'

export function isSecureFromRequestUrl(requestUrl?: string): boolean {
  if (!requestUrl) return PROD
  try {
    return new URL(requestUrl).protocol === 'https:'
  } catch {
    return PROD
  }
}

export function deriveCookieDomainFromHostname(hostname?: string | null): string | undefined {
  if (!hostname) return undefined
  const configured = process.env.AUTH_COOKIE_DOMAIN?.trim().toLowerCase()
  if (!configured) return undefined

  const domain = configured.startsWith('.') ? configured : `.${configured}`
  const apex = domain.slice(1)
  const requestHostname = hostname.toLowerCase()
  return requestHostname === apex || requestHostname.endsWith(domain) ? domain : undefined
}

export function deriveCookieDomain(requestUrl?: string): string | undefined {
  if (!requestUrl) return undefined
  try {
    return deriveCookieDomainFromHostname(new URL(requestUrl).hostname)
  } catch {
    // ignore invalid URLs
  }
  return undefined
}
