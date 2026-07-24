import {normalizeProxyBaseUrl, proxyRequestToBackend} from '@/lib/platform/proxy'

export const runtime = 'edge'

const targetBaseUrl = normalizeProxyBaseUrl(process.env.PRIVATE_API_BASE_URL)
const MISSING_CONFIG_MESSAGE = 'Missing PRIVATE_API_BASE_URL (server-side proxy target).'

async function proxyToBackend(req: Request, pathname: string) {
  return proxyRequestToBackend(req, targetBaseUrl, pathname, {
    missingConfigMessage: MISSING_CONFIG_MESSAGE,
  })
}

export async function DELETE(req: Request, {params}: {params: Promise<{keyId: string}>}) {
  const {keyId} = await params
  return proxyToBackend(req, `/api/v1/keys/${encodeURIComponent(keyId)}`)
}
