export type ApiKeySummary = {
  key_id: string
  name: string
  created_at: number
  last_used_at: number | null
  rate_limit_rpm: number | null
  rate_limit_tpm: number | null
  daily_spend_limit_usd: number | null
  is_active: boolean
  metadata: Record<string, unknown>
}

export type LedgerEntry = {
  id: string
  user_id: string
  type: 'credit' | 'debit' | 'adjustment'
  reason: 'purchase' | 'usage' | 'preview' | 'refund' | 'admin_adjust'
  amount_microusd: number
  balance_after_microusd: number
  timestamp_ms: number
  request_id?: string | null
  key_id?: string | null
  model_id?: string | null
}

export type CreditPack = {
  id: string
  creditMicrousd: number
}
