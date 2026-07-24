'use client'

import {useEffect, useState} from 'react'
import {useActiveAccount} from 'thirdweb/react'
import {getApiBaseUrl} from '@/lib/platform/api-client'
import {getCreditsBalance} from '@/lib/platform/client'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})
const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
})

export function PlatformCreditsCard() {
  const account = useActiveAccount()
  const apiBaseUrl = getApiBaseUrl()
  const canUseApi = Boolean(apiBaseUrl)
  const [balanceMicrousd, setBalanceMicrousd] = useState<number | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null)
  const [loadingBalance, setLoadingBalance] = useState(false)
  const [balanceError, setBalanceError] = useState<string | null>(null)

  useEffect(() => {
    if (!account || !canUseApi) return

    void (async () => {
      setLoadingBalance(true)
      setBalanceError(null)
      try {
        const result = await getCreditsBalance(apiBaseUrl, account)
        setBalanceMicrousd(result.balanceMicrousd)
        setLastUpdatedAt(Date.now())
      } catch (err) {
        setBalanceError(err instanceof Error ? err.message : 'Failed to load credits.')
      } finally {
        setLoadingBalance(false)
      }
    })()
  }, [account, apiBaseUrl, canUseApi])

  useEffect(() => {
    setBalanceMicrousd(null)
    setLastUpdatedAt(null)
    setBalanceError(null)
  }, [account?.address, canUseApi])

  const balanceDisplay = loadingBalance
    ? 'Loading...'
    : balanceMicrousd == null
      ? '--'
      : currencyFormatter.format(balanceMicrousd / 1_000_000)
  let updatedLabel = 'Connect wallet to view credits.'
  if (account) {
    updatedLabel = 'Not synced yet.'
    if (!canUseApi) updatedLabel = 'Missing NEXT_PUBLIC_API_BASE_URL.'
    if (balanceError) updatedLabel = balanceError
  }
  if (account && canUseApi && !balanceError && lastUpdatedAt) {
    updatedLabel = `Updated at ${timeFormatter.format(new Date(lastUpdatedAt))}`
  }

  return (
    <div
      data-testid='platform-credits-card'
      className='rounded-md border border-border bg-background p-4 text-foreground'
    >
      <p className='text-xs font-semibold uppercase tracking-widest text-muted-foreground'>
        Credits
      </p>
      <p className='mt-2 text-2xl font-semibold'>{balanceDisplay}</p>
      <p className='mt-1 text-xs text-muted-foreground'>{updatedLabel}</p>
      <div className='mt-4 flex flex-wrap gap-2 text-xs font-semibold'>
        <a href='/billing' className='rounded-md bg-brand-blue-500 px-3 py-1 text-black'>
          Add credits
        </a>
        <a
          href='/usage'
          className='rounded-md border border-border bg-background px-3 py-1 text-foreground'
        >
          View usage
        </a>
      </div>
    </div>
  )
}
