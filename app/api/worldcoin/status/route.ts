const WORLDCOIN_VERIFIED_COOKIE_RE = /(?:^|;)\s*worldcoin-verified=1(?:;|$)/
const NO_STORE_HEADERS = {'Cache-Control': 'no-store'} as const

export const runtime = 'edge'

export function GET(request: Request) {
  const verified = WORLDCOIN_VERIFIED_COOKIE_RE.test(request.headers.get('cookie') || '')
  return Response.json({verified}, {headers: NO_STORE_HEADERS})
}
