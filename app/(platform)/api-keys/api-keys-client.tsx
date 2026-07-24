'use client'

import {useCallback, useEffect, useMemo, useState} from 'react'
import {useActiveAccount} from 'thirdweb/react'
import {PageHeader} from '@/components/platform/page-header'
import {toast} from '@/components/toast-store'
import {getApiBaseUrl} from '@/lib/platform/api-client'
import {createApiKey, listApiKeys, revokeApiKey} from '@/lib/platform/client'
import type {ApiKeySummary} from '@/lib/platform/types'

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  year: 'numeric',
})
const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
})

const RECOMMENDED_RATE_LIMIT_RPM = 120
const RECOMMENDED_RATE_LIMIT_TPM = 60_000

function formatTimestamp(value?: number | null) {
  if (!value) return 'Never'
  const ms = value > 1_000_000_000_000 ? value : value * 1000
  return dateFormatter.format(new Date(ms))
}

function formatUsd(value?: number | null) {
  if (value == null) return 'Unlimited'
  return currencyFormatter.format(value)
}

function parseOptionalLimit(raw: string) {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  if (trimmed.toLowerCase() === 'unlimited') return undefined
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function StatusBadge({active}: {active: boolean}) {
  return (
    <span
      className={
        active
          ? 'rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700'
          : 'rounded-full bg-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-600'
      }
    >
      {active ? 'Active' : 'Revoked'}
    </span>
  )
}

function ApiKeysContent() {
  const account = useActiveAccount()
  const apiBaseUrl = getApiBaseUrl()
  const [keys, setKeys] = useState<ApiKeySummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [busyKeyId, setBusyKeyId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formRpm, setFormRpm] = useState('')
  const [formTpm, setFormTpm] = useState('')
  const [formDailyLimit, setFormDailyLimit] = useState('')
  const [newKey, setNewKey] = useState<{
    apiKey: string
    keyId: string
    createdAt: number
    rotatedFrom?: {keyId: string; name: string}
  } | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)

  const canUseApi = Boolean(apiBaseUrl)
  const rotatedFrom = newKey?.rotatedFrom

  const fetchKeys = useCallback(async () => {
    if (!account || !canUseApi) return
    setLoading(true)
    setError(null)
    try {
      const result = await listApiKeys(apiBaseUrl, account)
      setKeys(result.keys ?? [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load keys.'
      setError(message)
      toast({type: 'error', description: message})
    } finally {
      setLoading(false)
    }
  }, [account, apiBaseUrl, canUseApi])

  useEffect(() => {
    if (!account || !canUseApi) return
    fetchKeys()
  }, [account, canUseApi, fetchKeys])

  const sortedKeys = useMemo(() => {
    return [...keys].sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0))
  }, [keys])

  const handleCreate = useCallback(async () => {
    if (!account) {
      toast({type: 'error', description: 'Connect your wallet to create a key.'})
      return
    }
    if (!canUseApi) {
      toast({type: 'error', description: 'Missing NEXT_PUBLIC_API_BASE_URL.'})
      return
    }
    if (!formName.trim()) {
      toast({type: 'error', description: 'Key name is required.'})
      return
    }

    const rpm = parseOptionalLimit(formRpm)
    const tpm = parseOptionalLimit(formTpm)
    const dailyLimit = parseOptionalLimit(formDailyLimit)

    if (
      (typeof rpm === 'number' && !Number.isFinite(rpm)) ||
      (typeof tpm === 'number' && !Number.isFinite(tpm)) ||
      (typeof dailyLimit === 'number' && !Number.isFinite(dailyLimit))
    ) {
      toast({type: 'error', description: 'Rate limits must be valid numbers.'})
      return
    }

    setCreating(true)
    try {
      const created = await createApiKey(apiBaseUrl, account, {
        name: formName.trim(),
        rate_limit_rpm: rpm,
        rate_limit_tpm: tpm,
        daily_spend_limit_usd: dailyLimit,
      })
      setNewKey({apiKey: created.api_key, keyId: created.key_id, createdAt: created.created_at})
      setAcknowledged(false)
      setFormName('')
      setFormRpm('')
      setFormTpm('')
      setFormDailyLimit('')
      toast({type: 'success', description: 'API key created. Copy it now.'})
      await fetchKeys()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create key.'
      toast({type: 'error', description: message})
    } finally {
      setCreating(false)
    }
  }, [account, apiBaseUrl, canUseApi, fetchKeys, formDailyLimit, formName, formRpm, formTpm])

  const handleCopy = useCallback(async () => {
    if (!newKey?.apiKey) return
    try {
      await navigator.clipboard.writeText(newKey.apiKey)
      toast({type: 'success', description: 'API key copied to clipboard.'})
    } catch {
      toast({type: 'error', description: 'Unable to copy API key.'})
    }
  }, [newKey])

  const handleRevoke = useCallback(
    async (keyId: string, requireConfirm: boolean) => {
      if (!account) {
        toast({type: 'error', description: 'Connect your wallet to revoke a key.'})
        return false
      }
      if (!canUseApi) {
        toast({type: 'error', description: 'Missing NEXT_PUBLIC_API_BASE_URL.'})
        return false
      }
      if (requireConfirm) {
        const confirmation = window.prompt('Type REVOKE to confirm this action.')
        if (confirmation !== 'REVOKE') return false
      }
      setBusyKeyId(keyId)
      try {
        await revokeApiKey(apiBaseUrl, account, keyId)
        toast({type: 'success', description: 'API key revoked.'})
        await fetchKeys()
        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to revoke key.'
        toast({type: 'error', description: message})
        return false
      } finally {
        setBusyKeyId(null)
      }
    },
    [account, apiBaseUrl, canUseApi, fetchKeys],
  )

  const handleDeleteRotatedKey = useCallback(
    async (rotatedFrom: {keyId: string; name: string}) => {
      const success = await handleRevoke(rotatedFrom.keyId, true)
      if (success) {
        setNewKey((prev) =>
          prev?.rotatedFrom?.keyId === rotatedFrom.keyId ? {...prev, rotatedFrom: undefined} : prev,
        )
      }
    },
    [handleRevoke],
  )

  const handleRotate = useCallback(
    async (key: ApiKeySummary) => {
      if (!account) {
        toast({type: 'error', description: 'Connect your wallet to rotate a key.'})
        return
      }
      if (!canUseApi) {
        toast({type: 'error', description: 'Missing NEXT_PUBLIC_API_BASE_URL.'})
        return
      }
      const ok = window.confirm(
        'Create a new key for rotation? You can delete the old key after saving the new one.',
      )
      if (!ok) return

      setBusyKeyId(key.key_id)
      try {
        const created = await createApiKey(apiBaseUrl, account, {
          name: `${key.name} (rotated)`,
          rate_limit_rpm: key.rate_limit_rpm ?? undefined,
          rate_limit_tpm: key.rate_limit_tpm ?? undefined,
          daily_spend_limit_usd: key.daily_spend_limit_usd ?? undefined,
        })
        setNewKey({
          apiKey: created.api_key,
          keyId: created.key_id,
          createdAt: created.created_at,
          rotatedFrom: {keyId: key.key_id, name: key.name},
        })
        setAcknowledged(false)
        toast({type: 'success', description: 'New key created. Delete the old key when ready.'})
        await fetchKeys()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to rotate key.'
        toast({type: 'error', description: message})
      } finally {
        setBusyKeyId(null)
      }
    },
    [account, apiBaseUrl, canUseApi, fetchKeys],
  )

  return (
    <div className='mx-auto max-w-5xl space-y-10'>
      <PageHeader
        kicker='API Keys'
        title='Issue keys once, store safely, rotate on schedule.'
        description='Keys are shown only at creation. Rotate proactively and revoke immediately if you suspect exposure.'
      >
        <button
          type='button'
          onClick={fetchKeys}
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
          <p>Connect your wallet to manage keys.</p>
          <a
            href='/login'
            className='mt-4 inline-flex rounded-md bg-brand-blue-500 px-4 py-2 text-xs font-semibold text-black'
          >
            Go to login
          </a>
        </div>
      ) : null}

      <section className='grid gap-6 lg:grid-cols-[1.1fr_0.9fr]'>
        <div className='rounded-md border border-border bg-background p-6 text-foreground lg:p-8'>
          <h2 className='text-2xl font-semibold text-foreground'>Create API key</h2>
          <p className='mt-2 text-sm text-muted-foreground'>
            Wallet signature required. Optional rate limits and spend caps are best-effort.
          </p>
          <div className='mt-6 grid gap-4'>
            <div>
              <label
                htmlFor='api-key-name'
                className='text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground'
              >
                Key name
              </label>
              <input
                id='api-key-name'
                placeholder='Production - Web'
                value={formName}
                onChange={(event) => setFormName(event.target.value)}
                className='mt-2 w-full rounded-md border border-input bg-background px-4 py-3 text-sm text-foreground'
              />
            </div>
            <div className='grid gap-3 sm:grid-cols-3'>
              <div>
                <label
                  htmlFor='api-key-rpm'
                  className='text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground'
                >
                  RPM
                </label>
                <input
                  id='api-key-rpm'
                  inputMode='numeric'
                  type='number'
                  min={0}
                  placeholder={String(RECOMMENDED_RATE_LIMIT_RPM)}
                  value={formRpm}
                  onChange={(event) => setFormRpm(event.target.value)}
                  className='mt-2 w-full rounded-md border border-input bg-background px-4 py-3 text-sm text-foreground'
                />
                <p className='mt-1 text-xs text-muted-foreground'>
                  Requests per minute. Default Unlimited. Suggested {RECOMMENDED_RATE_LIMIT_RPM}.
                </p>
              </div>
              <div>
                <label
                  htmlFor='api-key-tpm'
                  className='text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground'
                >
                  TPM
                </label>
                <input
                  id='api-key-tpm'
                  inputMode='numeric'
                  type='number'
                  min={0}
                  placeholder={String(RECOMMENDED_RATE_LIMIT_TPM)}
                  value={formTpm}
                  onChange={(event) => setFormTpm(event.target.value)}
                  className='mt-2 w-full rounded-md border border-input bg-background px-4 py-3 text-sm text-foreground'
                />
                <p className='mt-1 text-xs text-muted-foreground'>
                  Tokens per minute. Default Unlimited. Suggested{' '}
                  {RECOMMENDED_RATE_LIMIT_TPM.toLocaleString('en-US')}.
                </p>
              </div>
              <div>
                <label
                  htmlFor='api-key-daily-usd'
                  className='text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground'
                >
                  Daily USD
                </label>
                <input
                  id='api-key-daily-usd'
                  inputMode='decimal'
                  type='number'
                  min={0}
                  step='0.01'
                  placeholder='Unlimited'
                  value={formDailyLimit}
                  onChange={(event) => setFormDailyLimit(event.target.value)}
                  className='mt-2 w-full rounded-md border border-input bg-background px-4 py-3 text-sm text-foreground'
                />
                <p className='mt-1 text-xs text-muted-foreground'>
                  Daily spend cap in USD. Default Unlimited (no cap).
                </p>
              </div>
            </div>
            <button
              type='button'
              onClick={handleCreate}
              disabled={creating || !account}
              className='rounded-md bg-brand-blue-500 px-6 py-3 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60'
            >
              {creating ? 'Creating...' : 'Create API key'}
            </button>
          </div>

          {newKey ? (
            <div className='mt-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800'>
              <p className='text-xs font-semibold uppercase tracking-widest'>Show once</p>
              <p className='mt-2 text-sm font-semibold text-amber-900'>
                Copy this key now. It will not be shown again.
              </p>
              <div className='mt-3 rounded-md border border-amber-200 bg-white px-3 py-2 font-mono text-xs text-amber-900'>
                {newKey.apiKey}
              </div>
              {rotatedFrom ? (
                <div className='mt-4 rounded-md border border-amber-200 bg-white px-3 py-2 text-xs text-amber-900'>
                  <p className='text-[10px] font-semibold uppercase tracking-widest'>Old key</p>
                  <p className='mt-1 text-sm font-semibold text-amber-900'>{rotatedFrom.name}</p>
                  <p className='mt-1 font-mono text-[11px] text-amber-900'>{rotatedFrom.keyId}</p>
                  <p className='mt-2 text-xs text-amber-800'>Delete after updating deployments.</p>
                </div>
              ) : null}
              <div className='mt-3 flex flex-wrap gap-2'>
                <button
                  type='button'
                  onClick={handleCopy}
                  className='rounded-md bg-brand-blue-500 px-4 py-2 text-xs font-semibold text-black'
                >
                  Copy key
                </button>
                <label className='flex items-center gap-2 rounded-md border border-amber-300 bg-white px-4 py-2 text-xs font-semibold text-amber-900'>
                  <input
                    type='checkbox'
                    checked={acknowledged}
                    onChange={(event) => setAcknowledged(event.target.checked)}
                  />
                  I stored this key
                </label>
                {rotatedFrom ? (
                  <button
                    type='button'
                    onClick={() => handleDeleteRotatedKey(rotatedFrom)}
                    disabled={!acknowledged || busyKeyId === rotatedFrom.keyId}
                    className='rounded-md border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-60'
                  >
                    {busyKeyId === rotatedFrom.keyId ? 'Deleting...' : 'Delete old key'}
                  </button>
                ) : null}
                <button
                  type='button'
                  onClick={() => setNewKey(null)}
                  disabled={!acknowledged}
                  className='rounded-md border border-amber-300 bg-white px-4 py-2 text-xs font-semibold text-amber-900 disabled:cursor-not-allowed disabled:opacity-60'
                >
                  Close
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className='rounded-md border border-border bg-background p-6 text-foreground lg:p-8'>
          <h2 className='text-2xl font-semibold text-foreground'>Security warnings</h2>
          <ul className='mt-4 space-y-3 text-sm text-muted-foreground'>
            {[
              'Never commit keys to Git or client code.',
              'Keys are shown once and cannot be recovered.',
              'If leaked, revoke immediately and rotate.',
              'Use separate keys per environment or app.',
            ].map((warning) => (
              <li key={warning} className='rounded-md border border-border bg-background px-4 py-3'>
                {warning}
              </li>
            ))}
          </ul>
          <div className='mt-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800'>
            This key is shown once. Confirm you stored it securely before closing the modal.
          </div>
        </div>
      </section>

      <section className='rounded-md border border-border bg-background p-6 text-foreground lg:p-8'>
        <div className='flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between'>
          <div>
            <p className='text-xs font-semibold uppercase tracking-widest text-muted-foreground'>
              Key list
            </p>
            <h2 className='mt-2 text-2xl font-semibold text-foreground'>Active and revoked keys</h2>
          </div>
          {error ? <div className='text-xs text-red-600'>{error}</div> : null}
        </div>
        <div className='mt-6 overflow-x-auto'>
          {loading ? (
            <div className='rounded-md border border-border bg-background px-4 py-6 text-sm text-muted-foreground'>
              Loading keys...
            </div>
          ) : sortedKeys.length === 0 ? (
            <div className='rounded-md border border-border bg-background px-4 py-6 text-sm text-muted-foreground'>
              No keys yet. Create your first API key.
            </div>
          ) : (
            <div className='min-w-[920px] space-y-2 text-sm text-muted-foreground'>
              <div className='grid grid-cols-[1.6fr_1fr_1fr_1fr_1fr_0.8fr_1fr] gap-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground'>
                <span>Key</span>
                <span>Created</span>
                <span>Last used</span>
                <span>RPM/TPM</span>
                <span>Daily cap</span>
                <span>Status</span>
                <span>Actions</span>
              </div>
              {sortedKeys.map((key) => (
                <div
                  key={key.key_id}
                  className='grid grid-cols-[1.6fr_1fr_1fr_1fr_1fr_0.8fr_1fr] items-center gap-3 rounded-md border border-border bg-background px-4 py-3'
                >
                  <div>
                    <p className='text-sm font-semibold text-foreground'>{key.name}</p>
                    <p className='text-xs text-muted-foreground'>{key.key_id}</p>
                  </div>
                  <span>{formatTimestamp(key.created_at)}</span>
                  <span>{formatTimestamp(key.last_used_at)}</span>
                  <span>
                    {key.rate_limit_rpm ?? 'Unlimited'}/{key.rate_limit_tpm ?? 'Unlimited'}
                  </span>
                  <span>{formatUsd(key.daily_spend_limit_usd)}</span>
                  <StatusBadge active={key.is_active} />
                  <div className='flex gap-2'>
                    <button
                      type='button'
                      onClick={() => handleRotate(key)}
                      disabled={busyKeyId === key.key_id || !key.is_active}
                      className='rounded-md border border-border bg-background px-3 py-1 text-xs font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-60'
                    >
                      Rotate
                    </button>
                    <button
                      type='button'
                      onClick={() => handleRevoke(key.key_id, true)}
                      disabled={busyKeyId === key.key_id || !key.is_active}
                      className='rounded-md border border-border bg-background px-3 py-1 text-xs font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-60'
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default function ApiKeysClient() {
  return <ApiKeysContent />
}
