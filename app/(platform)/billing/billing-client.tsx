'use client'

import {useCallback, useEffect, useMemo, useState} from 'react'
import {useActiveAccount} from 'thirdweb/react'
import {PageHeader} from '@/components/platform/page-header'
import {toast} from '@/components/toast-store'
import {getApiBaseUrl} from '@/lib/platform/api-client'
import {
  getCreditPacks,
  getCreditsBalance,
  getLedger,
  startCreditsCheckout,
  startCreditsCheckoutWithPack,
} from '@/lib/platform/client'
import type {CreditPack, LedgerEntry} from '@/lib/platform/types'

const currencyFormatter = new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'})
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  year: 'numeric',
})

function formatMicrousd(value?: number | null) {
  if (value == null) return '--'
  return currencyFormatter.format(value / 1_000_000)
}

function formatSignedMicrousd(value: number) {
  const sign = value < 0 ? '-' : '+'
  return `${sign}${currencyFormatter.format(Math.abs(value) / 1_000_000)}`
}

function formatDate(value?: number | null) {
  if (!value) return '--'
  return dateFormatter.format(new Date(value))
}

function BillingContent() {
  const account = useActiveAccount()
  const apiBaseUrl = getApiBaseUrl()
  const [balanceMicrousd, setBalanceMicrousd] = useState<number | null>(null)
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([])
  const [creditPacks, setCreditPacks] = useState<CreditPack[]>([])
  const [loadingPacks, setLoadingPacks] = useState(false)
  const [loadingBalance, setLoadingBalance] = useState(false)
  const [loadingLedger, setLoadingLedger] = useState(false)
  const [amountInput, setAmountInput] = useState('25')
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  const canUseApi = Boolean(apiBaseUrl)
  const yearMonth = useMemo(() => new Date().toISOString().slice(0, 7), [])

  const refreshBalance = useCallback(async () => {
    if (!account || !canUseApi) return
    setLoadingBalance(true)
    try {
      const result = await getCreditsBalance(apiBaseUrl, account)
      setBalanceMicrousd(result.balanceMicrousd)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load balance.'
      toast({type: 'error', description: message})
    } finally {
      setLoadingBalance(false)
    }
  }, [account, apiBaseUrl, canUseApi])

  const refreshLedger = useCallback(async () => {
    if (!account || !canUseApi) return
    setLoadingLedger(true)
    try {
      const result = await getLedger(apiBaseUrl, account, yearMonth)
      setLedgerEntries(result.entries ?? [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load ledger.'
      toast({type: 'error', description: message})
    } finally {
      setLoadingLedger(false)
    }
  }, [account, apiBaseUrl, canUseApi, yearMonth])

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshBalance(), refreshLedger()])
  }, [refreshBalance, refreshLedger])

  useEffect(() => {
    if (!account || !canUseApi) return
    refreshAll()
  }, [account, canUseApi, refreshAll])

  useEffect(() => {
    if (!canUseApi) return
    let active = true
    const loadPacks = async () => {
      setLoadingPacks(true)
      try {
        const result = await getCreditPacks(apiBaseUrl)
        if (active) setCreditPacks(result.packs ?? [])
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load credit packs.'
        toast({type: 'error', description: message})
      } finally {
        if (active) setLoadingPacks(false)
      }
    }
    loadPacks()
    return () => {
      active = false
    }
  }, [apiBaseUrl, canUseApi])

  useEffect(() => {
    setBalanceMicrousd(null)
    setLedgerEntries([])
    setCreditPacks([])
  }, [account?.address, canUseApi])

  const handleCheckout = useCallback(async () => {
    if (!account) {
      toast({type: 'error', description: 'Connect your wallet to add credits.'})
      return
    }
    if (!canUseApi) {
      toast({type: 'error', description: 'Missing NEXT_PUBLIC_API_BASE_URL.'})
      return
    }
    const amount = Number(amountInput)
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({type: 'error', description: 'Enter a valid USD amount.'})
      return
    }

    setCheckoutLoading(true)
    try {
      const result = await startCreditsCheckout(apiBaseUrl, account, amount)
      window.location.assign(result.url)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start checkout.'
      toast({type: 'error', description: message})
    } finally {
      setCheckoutLoading(false)
    }
  }, [account, amountInput, apiBaseUrl, canUseApi])

  const handlePackCheckout = useCallback(
    async (packId: string) => {
      if (!account) {
        toast({type: 'error', description: 'Connect your wallet to add credits.'})
        return
      }
      if (!canUseApi) {
        toast({type: 'error', description: 'Missing NEXT_PUBLIC_API_BASE_URL.'})
        return
      }

      setCheckoutLoading(true)
      try {
        const result = await startCreditsCheckoutWithPack(apiBaseUrl, account, packId)
        window.location.assign(result.url)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to start checkout.'
        toast({type: 'error', description: message})
      } finally {
        setCheckoutLoading(false)
      }
    },
    [account, apiBaseUrl, canUseApi],
  )

  const sortedLedger = useMemo(() => {
    return [...ledgerEntries].sort((a, b) => (b.timestamp_ms ?? 0) - (a.timestamp_ms ?? 0))
  }, [ledgerEntries])

  return (
    <div className='mx-auto max-w-5xl space-y-10'>
      <PageHeader
        kicker='Billing & Credits'
        title='Prepaid credits with Stripe Checkout.'
        description='Purchase credits in any amount, then watch the balance update from webhook confirmations.'
      >
        <button
          type='button'
          onClick={refreshAll}
          className='rounded-md border border-border bg-background px-5 py-2 text-sm font-semibold text-foreground'
          disabled={loadingBalance || loadingLedger}
        >
          Refresh
        </button>
      </PageHeader>

      {!canUseApi ? (
        <div className='rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800'>
          NEXT_PUBLIC_API_BASE_URL is not configured.
        </div>
      ) : null}

      {!account ? (
        <div className='rounded-md border border-border bg-background p-6 text-sm text-muted-foreground'>
          Connect your wallet to view balance and start checkout.
        </div>
      ) : null}

      <section className='grid gap-6 lg:grid-cols-3'>
        <div className='rounded-md border border-border bg-background p-6 text-foreground'>
          <p className='text-xs font-semibold uppercase tracking-widest text-muted-foreground'>
            Balance
          </p>
          <p className='mt-3 text-3xl font-semibold text-foreground'>
            {loadingBalance ? 'Loading...' : formatMicrousd(balanceMicrousd)}
          </p>
          <p className='mt-2 text-xs text-muted-foreground'>
            Configure low-balance policy in the billing service.
          </p>
          <button
            type='button'
            onClick={handleCheckout}
            disabled={checkoutLoading || !account}
            className='mt-4 rounded-md bg-brand-blue-500 px-5 py-2 text-xs font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60'
          >
            {checkoutLoading ? 'Redirecting...' : 'Add credits'}
          </button>
        </div>
        <div className='rounded-md border border-border bg-background p-6 text-foreground'>
          <p className='text-xs font-semibold uppercase tracking-widest text-muted-foreground'>
            Pricing logic
          </p>
          <p className='mt-3 text-sm text-muted-foreground'>
            The configured billing service is the source of truth for prices, fees, and available
            credit packs.
          </p>
          <div className='mt-4 rounded-md border border-border bg-background px-4 py-3 text-xs text-muted-foreground'>
            Balance stored in microusd (1e-6 USD).
          </div>
        </div>
        <div className='rounded-md border border-border bg-background p-6 text-foreground'>
          <p className='text-xs font-semibold uppercase tracking-widest text-muted-foreground'>
            Checkout status
          </p>
          <p className='mt-3 text-sm text-muted-foreground'>
            Stripe checkout may take a few seconds to confirm. Poll balance on return.
          </p>
          <div className='mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800'>
            If checkout is canceled, no credits are added.
          </div>
        </div>
      </section>

      <section className='grid gap-6 lg:grid-cols-[1.1fr_0.9fr]'>
        <div className='rounded-md border border-border bg-background p-6 text-foreground lg:p-8'>
          <h2 className='text-2xl font-semibold text-foreground'>Add credits</h2>
          <p className='mt-2 text-sm text-muted-foreground'>
            Select a preset or enter a custom amount. Minimums and maximums are validated
            server-side.
          </p>
          <div className='mt-6'>
            <p className='text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground'>
              Credit packs
            </p>
            {loadingPacks ? (
              <div className='mt-3 rounded-md border border-border bg-background px-4 py-3 text-xs text-muted-foreground'>
                Loading packs...
              </div>
            ) : creditPacks.length === 0 ? (
              <div className='mt-3 rounded-md border border-border bg-background px-4 py-3 text-xs text-muted-foreground'>
                No packs available. Use a custom amount.
              </div>
            ) : (
              <div className='mt-3 grid gap-3 sm:grid-cols-2'>
                {creditPacks.map((pack) => (
                  <div
                    key={pack.id}
                    className='rounded-md border border-border bg-background px-4 py-3 text-xs text-muted-foreground'
                  >
                    <p className='text-[11px] font-semibold uppercase tracking-widest text-muted-foreground'>
                      {pack.id}
                    </p>
                    <p className='mt-2 text-lg font-semibold text-foreground'>
                      {formatMicrousd(pack.creditMicrousd)}
                    </p>
                    <button
                      type='button'
                      onClick={() => handlePackCheckout(pack.id)}
                      disabled={checkoutLoading || !account}
                      className='mt-3 rounded-md border border-border bg-background px-3 py-1 text-xs font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-60'
                    >
                      {checkoutLoading ? 'Redirecting...' : 'Checkout pack'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className='mt-6 flex flex-wrap gap-3'>
            {[10, 25, 50, 100].map((amount) => (
              <button
                type='button'
                key={amount}
                onClick={() => setAmountInput(String(amount))}
                className='rounded-md border border-border bg-background px-5 py-2 text-sm font-semibold text-foreground'
              >
                ${amount}
              </button>
            ))}
          </div>
          <div className='mt-5'>
            <label
              htmlFor='billing-custom-amount'
              className='text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground'
            >
              Custom amount
            </label>
            <div className='mt-2 flex flex-col gap-3 sm:flex-row'>
              <input
                id='billing-custom-amount'
                placeholder='75'
                value={amountInput}
                onChange={(event) => setAmountInput(event.target.value)}
                className='w-full rounded-md border border-input bg-background px-4 py-3 text-sm text-foreground'
              />
              <button
                type='button'
                onClick={handleCheckout}
                disabled={checkoutLoading || !account}
                className='rounded-md bg-brand-blue-500 px-6 py-3 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60'
              >
                {checkoutLoading ? 'Redirecting...' : 'Checkout'}
              </button>
            </div>
          </div>
        </div>

        <div className='rounded-md border border-border bg-background p-6 text-foreground lg:p-8'>
          <h2 className='text-2xl font-semibold text-foreground'>Billing ledger</h2>
          <p className='mt-2 text-sm text-muted-foreground'>
            Credits, debits, and adjustments for {yearMonth}.
          </p>
          <div className='mt-5 space-y-3 text-sm text-muted-foreground'>
            {loadingLedger ? (
              <div className='rounded-md border border-border bg-background px-4 py-4'>
                Loading ledger...
              </div>
            ) : sortedLedger.length === 0 ? (
              <div className='rounded-md border border-border bg-background px-4 py-4'>
                No ledger entries yet.
              </div>
            ) : (
              sortedLedger.map((entry) => (
                <div
                  key={entry.id}
                  className='rounded-md border border-border bg-background px-4 py-3'
                >
                  <div className='flex items-center justify-between text-xs'>
                    <span className='rounded-md bg-muted px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground'>
                      {entry.reason}
                    </span>
                    <span>{formatDate(entry.timestamp_ms)}</span>
                  </div>
                  <div className='mt-2 flex items-center justify-between'>
                    <span className='font-semibold text-foreground'>
                      {formatSignedMicrousd(entry.amount_microusd)}
                    </span>
                    <span className='text-xs'>
                      Balance: {formatMicrousd(entry.balance_after_microusd)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

export default function BillingClient() {
  return <BillingContent />
}
