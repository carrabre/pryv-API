'use client'

import {useCallback, useEffect, useMemo, useState} from 'react'
import {useActiveAccount} from 'thirdweb/react'
import {PageHeader} from '@/components/platform/page-header'
import {toast} from '@/components/toast-store'
import {getApiBaseUrl} from '@/lib/platform/api-client'
import {getCreditsBalance, getLedger, listApiKeys} from '@/lib/platform/client'
import type {ApiKeySummary, LedgerEntry} from '@/lib/platform/types'

const currencyFormatter = new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'})
const weekdayFormatter = new Intl.DateTimeFormat('en-US', {weekday: 'short'})

function formatMicrousd(value?: number | null) {
  if (value == null) return '--'
  return currencyFormatter.format(value / 1_000_000)
}

function formatSignedMicrousd(value: number) {
  const sign = value < 0 ? '-' : '+'
  return `${sign}${currencyFormatter.format(Math.abs(value) / 1_000_000)}`
}

function UsageContent() {
  const account = useActiveAccount()
  const apiBaseUrl = getApiBaseUrl()
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([])
  const [keys, setKeys] = useState<ApiKeySummary[]>([])
  const [balanceMicrousd, setBalanceMicrousd] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  const canUseApi = Boolean(apiBaseUrl)
  const yearMonth = useMemo(() => new Date().toISOString().slice(0, 7), [])

  const refreshAll = useCallback(async () => {
    if (!account || !canUseApi) return
    setLoading(true)
    try {
      const [balance, ledger, keyList] = await Promise.all([
        getCreditsBalance(apiBaseUrl, account),
        getLedger(apiBaseUrl, account, yearMonth),
        listApiKeys(apiBaseUrl, account),
      ])
      setBalanceMicrousd(balance.balanceMicrousd)
      setLedgerEntries(ledger.entries ?? [])
      setKeys(keyList.keys ?? [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load usage data.'
      toast({type: 'error', description: message})
    } finally {
      setLoading(false)
    }
  }, [account, apiBaseUrl, canUseApi, yearMonth])

  useEffect(() => {
    if (!account || !canUseApi) return
    refreshAll()
  }, [account, canUseApi, refreshAll])

  useEffect(() => {
    setBalanceMicrousd(null)
    setLedgerEntries([])
    setKeys([])
  }, [account?.address, canUseApi])

  const keyNameById = useMemo(() => {
    const map = new Map<string, string>()
    keys.forEach((key) => map.set(key.key_id, key.name))
    return map
  }, [keys])

  const activeLimits = useMemo(() => {
    const activeKeys = keys.filter((key) => key.is_active)
    if (!activeKeys.length)
      return {hasActiveKeys: false, rpm: null as number | null, tpm: null as number | null}

    const rpmValues = activeKeys
      .map((key) => key.rate_limit_rpm)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    const tpmValues = activeKeys
      .map((key) => key.rate_limit_tpm)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

    return {
      hasActiveKeys: true,
      rpm: rpmValues.length ? Math.max(...rpmValues) : null,
      tpm: tpmValues.length ? Math.max(...tpmValues) : null,
    }
  }, [keys])

  const dailySpend = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const days = Array.from({length: 7}, (_, index) => {
      const date = new Date(today)
      date.setDate(today.getDate() - (6 - index))
      return date
    })
    const spendMap = new Map<string, number>()
    days.forEach((date) => {
      spendMap.set(date.toISOString().slice(0, 10), 0)
    })
    ledgerEntries.forEach((entry) => {
      if (entry.type !== 'debit') return
      const entryDate = new Date(entry.timestamp_ms)
      entryDate.setHours(0, 0, 0, 0)
      const key = entryDate.toISOString().slice(0, 10)
      if (!spendMap.has(key)) return
      const current = spendMap.get(key) ?? 0
      spendMap.set(key, current + Math.abs(entry.amount_microusd) / 1_000_000)
    })
    return days.map((date) => ({
      day: weekdayFormatter.format(date),
      amount: spendMap.get(date.toISOString().slice(0, 10)) ?? 0,
    }))
  }, [ledgerEntries])

  const sevenDaySpend = useMemo(() => {
    return dailySpend.reduce((sum, entry) => sum + entry.amount, 0)
  }, [dailySpend])

  const recentRequests = useMemo(() => {
    return [...ledgerEntries]
      .filter((entry) => entry.request_id)
      .sort((a, b) => (b.timestamp_ms ?? 0) - (a.timestamp_ms ?? 0))
      .slice(0, 5)
      .map((entry) => {
        const keyLabel = entry.key_id ? (keyNameById.get(entry.key_id) ?? entry.key_id) : 'Unknown'
        return {
          id: entry.request_id ?? entry.id,
          model: entry.model_id ?? 'Unknown',
          key: keyLabel,
          cost: formatSignedMicrousd(entry.amount_microusd),
          status: entry.reason === 'preview' ? 'Preview' : entry.reason,
        }
      })
  }, [keyNameById, ledgerEntries])

  const maxSpend = Math.max(1, ...dailySpend.map((entry) => entry.amount))

  return (
    <div className='mx-auto max-w-5xl space-y-10'>
      <PageHeader
        kicker='Usage'
        title='Track credits, request IDs, and rate limits.'
        description='Ledger entries roll up to daily spend. Use request IDs to correlate with backend logs and support.'
      >
        <button
          type='button'
          onClick={refreshAll}
          className='rounded-md border border-border bg-background px-5 py-2 text-sm font-semibold text-foreground'
          disabled={loading}
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
          Connect your wallet to view usage and ledger data.
        </div>
      ) : null}

      <section className='grid gap-6 lg:grid-cols-3'>
        {[
          {
            label: 'Current balance',
            value: loading ? 'Loading...' : formatMicrousd(balanceMicrousd),
            note: 'Review the configured low-balance policy.',
          },
          {
            label: '7-day spend',
            value: loading ? 'Loading...' : currencyFormatter.format(sevenDaySpend),
            note: 'Rolling total',
          },
          {
            label: 'Rate limits',
            value: activeLimits.hasActiveKeys ? `${activeLimits.rpm ?? 'Unlimited'} RPM` : '--',
            note: activeLimits.hasActiveKeys
              ? `${activeLimits.tpm ?? 'Unlimited'} TPM`
              : 'No active keys',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className='rounded-md border border-border bg-background p-6 text-sm text-muted-foreground'
          >
            <p className='text-xs font-semibold uppercase tracking-widest text-muted-foreground'>
              {stat.label}
            </p>
            <p className='mt-3 text-3xl font-semibold text-foreground'>{stat.value}</p>
            <p className='mt-2 text-xs'>{stat.note}</p>
          </div>
        ))}
      </section>

      <section className='rounded-md border border-border bg-background p-6 text-foreground lg:p-8'>
        <div className='flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between'>
          <div>
            <p className='text-xs font-semibold uppercase tracking-widest text-muted-foreground'>
              Daily spend
            </p>
            <h2 className='mt-2 text-2xl font-semibold text-foreground'>Last 7 days</h2>
          </div>
          <div className='rounded-md border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground'>
            Ledger synced on refresh
          </div>
        </div>
        <div className='mt-6 grid grid-cols-7 gap-3'>
          {dailySpend.map((entry) => (
            <div key={entry.day} className='flex flex-col items-center gap-3'>
              <div className='flex h-32 w-full items-end'>
                <div
                  className='w-full rounded-md bg-brand-blue-500'
                  style={{height: `${(entry.amount / maxSpend) * 100}%`}}
                />
              </div>
              <div className='text-xs font-semibold text-foreground'>{entry.day}</div>
              <div className='text-[11px] text-muted-foreground'>
                {currencyFormatter.format(entry.amount)}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className='rounded-md border border-border bg-background p-6 text-foreground lg:p-8'>
        <div className='flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between'>
          <div>
            <p className='text-xs font-semibold uppercase tracking-widest text-muted-foreground'>
              Recent requests
            </p>
            <h2 className='mt-2 text-2xl font-semibold text-foreground'>Request IDs and models</h2>
          </div>
          <div className='rounded-md border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground'>
            {yearMonth}
          </div>
        </div>
        <div className='mt-6 space-y-3 text-sm text-muted-foreground'>
          {loading ? (
            <div className='rounded-md border border-border bg-background px-4 py-4'>
              Loading requests...
            </div>
          ) : recentRequests.length === 0 ? (
            <div className='rounded-md border border-border bg-background px-4 py-4'>
              No request IDs yet.
            </div>
          ) : (
            recentRequests.map((request) => (
              <div
                key={request.id}
                className='grid grid-cols-[1.2fr_1fr_1fr_0.6fr_0.8fr] items-center gap-3 rounded-md border border-border bg-background px-4 py-3'
              >
                <div className='font-mono text-xs text-foreground'>{request.id}</div>
                <div>{request.model}</div>
                <div>{request.key}</div>
                <div>{request.cost}</div>
                <div className='text-xs font-semibold text-foreground'>{request.status}</div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}

export default function UsageClient() {
  return <UsageContent />
}
