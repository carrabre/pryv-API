import type {Account} from 'thirdweb/wallets'

export type ApiError = {
  error: {message: string; type?: string; code?: string; details?: unknown}
}

export type WalletAction = 'create' | 'list' | 'revoke' | 'checkout' | 'balance' | 'ledger'

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').trim().replace(/\/+$/, '')

export function getApiBaseUrl() {
  return apiBaseUrl
}

export async function fetchJson<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(
    `${baseUrl}${path}`,
    init?.body == null
      ? init
      : {
          ...init,
          headers: {
            'Content-Type': 'application/json',
            ...(init.headers || {}),
          },
        },
  )

  const text = await res.text()
  let body: unknown = null
  if (text) {
    try {
      body = JSON.parse(text) as unknown
    } catch {
      body = null
    }
  }

  if (!res.ok) {
    const apiErr = body as ApiError | null
    const msg = apiErr?.error?.message || `Request failed: ${res.status}`
    const err = new Error(msg)
    ;(err as any).status = res.status
    ;(err as any).code = apiErr?.error?.code
    ;(err as any).details = apiErr?.error?.details
    throw err
  }

  return body as T
}

function buildNonce() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function buildWalletAuthMessage(params: {action: WalletAction; keyId?: string}) {
  const nonce = buildNonce()
  const ts = new Date().toISOString()
  const keyId = params.keyId ?? ''
  return `Pryv API key mgmt | action=${params.action} | keyId=${keyId} | nonce=${nonce} | ts=${ts}`
}

export async function signWalletMessage(account: Account, message: string) {
  if (!account?.address) {
    throw new Error('Wallet not connected.')
  }
  const signature = await account.signMessage({message})
  return {walletAddress: account.address, signature}
}

export async function walletAuthParams(
  account: Account,
  params: {action: WalletAction; keyId?: string},
) {
  const message = buildWalletAuthMessage(params)
  const {walletAddress, signature} = await signWalletMessage(account, message)
  return {walletAddress, message, signature}
}
