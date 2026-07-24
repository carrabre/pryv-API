export type SubscriptionTier = 'free' | 'basic' | 'pro'

export type SubscriptionUiState =
  | 'free'
  | 'subscribed_basic'
  | 'subscribed_pro'
  | 'cancelled_ending_soon'
  | 'upgraded'
  | 'downgraded'
  | 'subscribed'

export interface SubscriptionData {
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete'
  stripeSubId: string
  customerId: string
  periodEnd: number
  priceId: string
  walletAddress: string
  cancelAtPeriodEnd?: boolean
  cancelAt?: number | null
  tier?: SubscriptionTier
  uiState?: SubscriptionUiState
  hasPendingUpdate?: boolean
  previousPlanId?: string | null
  previousTier?: SubscriptionTier | null
  planChange?: 'upgrade' | 'downgrade' | null
  planChangedAt?: number | null
  expiresAt?: number | null
}
