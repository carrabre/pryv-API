import {getWorldcoinServerConfig} from '@/lib/worldcoin/config'

const PUBLIC_CONFIG_CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
} as const
const PUBLIC_CONFIG_JSON_HEADERS = {
  ...PUBLIC_CONFIG_CACHE_HEADERS,
  'Content-Type': 'application/json',
} as const

export function GET() {
  try {
    const {appId, actionId} = getWorldcoinServerConfig()
    return new Response(JSON.stringify({appId, actionId}), {headers: PUBLIC_CONFIG_JSON_HEADERS})
  } catch {
    return Response.json(
      {
        error: 'Worldcoin configuration unavailable',
      },
      {status: 500},
    )
  }
}
