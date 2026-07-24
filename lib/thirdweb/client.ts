import {createThirdwebClient, type ThirdwebClient} from 'thirdweb'

const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID

let cachedClient: ThirdwebClient | null = null

export function getThirdwebClient(): ThirdwebClient | null {
  if (cachedClient) return cachedClient
  if (typeof clientId !== 'string' || clientId.length === 0) return null
  cachedClient = createThirdwebClient({clientId})
  return cachedClient
}
