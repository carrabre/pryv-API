const DEFAULT_STRIPPED_REQUEST_HEADERS = [
  'content-length',
  'cookie',
  'host',
  'origin',
  'referer',
] as const
const DEFAULT_HOP_BY_HOP_HEADERS = [
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
] as const
const PRIVATE_RESPONSE_HEADERS = ['server', 'set-cookie', 'x-powered-by', 'x-vercel-id'] as const

type ProxyRequestOptions = {
  missingConfigMessage: string
  stripRequestHeaders?: readonly string[]
}

export function normalizeProxyBaseUrl(raw?: string | null) {
  const value = (raw ?? '').trim()
  if (!value) return null

  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Proxy base URL must use HTTP or HTTPS')
  }
  if (url.username || url.password) {
    throw new Error('Proxy base URL must not contain credentials')
  }
  url.hash = ''
  url.search = ''
  return url.toString().replace(/\/+$/, '')
}

export async function proxyRequestToBackend(
  req: Request,
  baseUrl: string | null,
  pathname: string,
  {
    missingConfigMessage,
    stripRequestHeaders = DEFAULT_STRIPPED_REQUEST_HEADERS,
  }: ProxyRequestOptions,
) {
  if (!baseUrl) {
    return Response.json({error: {message: missingConfigMessage}}, {status: 500})
  }

  const url = new URL(`${baseUrl}${pathname}`)
  url.search = new URL(req.url).search

  const headers = new Headers(req.headers)
  for (const header of stripRequestHeaders) {
    headers.delete(header)
  }

  const method = req.method
  const init: RequestInit & {duplex?: 'half'} = {
    method,
    headers,
    cache: 'no-store',
    redirect: 'manual',
  }

  if (method !== 'GET' && method !== 'HEAD') {
    init.body = req.body
    init.duplex = 'half'
  }

  const upstream = await fetch(url.toString(), init)
  const responseHeaders = new Headers(upstream.headers)
  for (const header of DEFAULT_HOP_BY_HOP_HEADERS) {
    responseHeaders.delete(header)
  }
  for (const header of PRIVATE_RESPONSE_HEADERS) {
    responseHeaders.delete(header)
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  })
}
