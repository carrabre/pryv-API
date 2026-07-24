import {normalizeProxyBaseUrl, proxyRequestToBackend} from '@/lib/platform/proxy'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

const targetBaseUrl =
  normalizeProxyBaseUrl(process.env.PRIVATE_MPP_API_BASE_URL) ??
  normalizeProxyBaseUrl(process.env.PRIVATE_API_BASE_URL)
const MISSING_CONFIG_MESSAGE =
  'Missing PRIVATE_MPP_API_BASE_URL (or PRIVATE_API_BASE_URL) for the MPP playground proxy.'

function buildUpstreamPath(path: string[]) {
  return `/mpp/${path.map((segment) => encodeURIComponent(segment)).join('/')}`
}

async function proxyToBackend(req: Request, pathname: string) {
  try {
    return await proxyRequestToBackend(req, targetBaseUrl, pathname, {
      missingConfigMessage: MISSING_CONFIG_MESSAGE,
    })
  } catch {
    return Response.json(
      {
        error: {
          message: 'Failed to reach the configured MPP upstream.',
        },
      },
      {status: 502},
    )
  }
}

type RouteContext = {
  params: Promise<{path: string[]}>
}

async function handleRequest(req: Request, {params}: RouteContext) {
  const {path} = await params
  return proxyToBackend(req, buildUpstreamPath(path))
}

export async function GET(req: Request, ctx: RouteContext) {
  return handleRequest(req, ctx)
}

export async function HEAD(req: Request, ctx: RouteContext) {
  return handleRequest(req, ctx)
}

export async function POST(req: Request, ctx: RouteContext) {
  return handleRequest(req, ctx)
}

export async function PUT(req: Request, ctx: RouteContext) {
  return handleRequest(req, ctx)
}

export async function PATCH(req: Request, ctx: RouteContext) {
  return handleRequest(req, ctx)
}

export async function DELETE(req: Request, ctx: RouteContext) {
  return handleRequest(req, ctx)
}
