import type {Account} from 'thirdweb/wallets'
import {fetchJson, walletAuthParams} from './api-client'
import type {ApiKeySummary, CreditPack, LedgerEntry} from './types'

export async function listApiKeys(baseUrl: string, account: Account) {
  const auth = await walletAuthParams(account, {action: 'list'})
  const qs = new URLSearchParams(auth)
  return fetchJson<{keys: ApiKeySummary[]}>(baseUrl, `/api/v1/keys?${qs.toString()}`)
}

export async function createApiKey(
  baseUrl: string,
  account: Account,
  input: {
    name: string
    rate_limit_rpm?: number
    rate_limit_tpm?: number
    daily_spend_limit_usd?: number
  },
) {
  const auth = await walletAuthParams(account, {action: 'create'})
  return fetchJson<{api_key: string; key_id: string; created_at: number}>(baseUrl, '/api/v1/keys', {
    method: 'POST',
    body: JSON.stringify({
      ...auth,
      name: input.name,
      rate_limit_rpm: input.rate_limit_rpm,
      rate_limit_tpm: input.rate_limit_tpm,
      daily_spend_limit_usd: input.daily_spend_limit_usd,
    }),
  })
}

export async function revokeApiKey(baseUrl: string, account: Account, keyId: string) {
  const auth = await walletAuthParams(account, {action: 'revoke', keyId})
  return fetchJson<{success: boolean}>(baseUrl, `/api/v1/keys/${encodeURIComponent(keyId)}`, {
    method: 'DELETE',
    body: JSON.stringify(auth),
  })
}

export async function getCreditsBalance(baseUrl: string, account: Account) {
  const auth = await walletAuthParams(account, {action: 'balance'})
  const qs = new URLSearchParams(auth)
  const result = await fetchJson<{balanceMicrousd?: number; balance_microusd?: number}>(
    baseUrl,
    `/api/v1/billing/balance?${qs.toString()}`,
  )
  const balanceMicrousd = result.balanceMicrousd ?? result.balance_microusd
  return {balanceMicrousd: typeof balanceMicrousd === 'number' ? balanceMicrousd : null}
}

export async function getLedger(baseUrl: string, account: Account, yearMonth: string) {
  const auth = await walletAuthParams(account, {action: 'ledger'})
  const qs = new URLSearchParams({...auth, yearMonth})
  return fetchJson<{yearMonth: string; entries: LedgerEntry[]}>(
    baseUrl,
    `/api/v1/billing/ledger?${qs.toString()}`,
  )
}

export async function startCreditsCheckout(baseUrl: string, account: Account, usdAmount: number) {
  const auth = await walletAuthParams(account, {action: 'checkout'})
  return fetchJson<{url: string}>(baseUrl, '/api/v1/billing/checkout', {
    method: 'POST',
    body: JSON.stringify({...auth, usdAmount}),
  })
}

export async function startCreditsCheckoutWithPack(
  baseUrl: string,
  account: Account,
  packId: string,
) {
  const auth = await walletAuthParams(account, {action: 'checkout'})
  return fetchJson<{url: string}>(baseUrl, '/api/v1/billing/checkout', {
    method: 'POST',
    body: JSON.stringify({...auth, packId}),
  })
}

export async function getCreditPacks(baseUrl: string) {
  const result = await fetchJson<{
    packs?: Array<{id: string; creditMicrousd?: number; credit_microusd?: number}>
  }>(baseUrl, '/api/v1/billing/credit-packs')
  const packs = (result.packs ?? [])
    .map((pack) => ({
      id: pack.id,
      creditMicrousd: pack.creditMicrousd ?? pack.credit_microusd ?? 0,
    }))
    .filter((pack) => pack.creditMicrousd > 0)
  return {packs: packs as CreditPack[]}
}
