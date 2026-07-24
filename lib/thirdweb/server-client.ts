import 'server-only'

import {createThirdwebClient, type ThirdwebClient} from 'thirdweb'

let cachedClient: ThirdwebClient | null = null

export function getThirdwebServerClient(): ThirdwebClient | null {
  if (cachedClient) return cachedClient

  const secretKey = process.env.THIRDWEB_SECRET_KEY
  if (typeof secretKey === 'string' && secretKey.length > 0) {
    cachedClient = createThirdwebClient({secretKey})
    return cachedClient
  }

  const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID
  if (typeof clientId === 'string' && clientId.length > 0) {
    cachedClient = createThirdwebClient({clientId})
    return cachedClient
  }

  return null
}
